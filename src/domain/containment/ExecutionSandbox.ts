/**
 * A-FORGE Containment: Execution Sandbox Lifecycle
 * ═══════════════════════════════════════════════
 *
 * Manages the full lifecycle: provision → exec → stream → [pause] → [resume] → deprovision.
 * Integrates with arifOS constitutional verdict chain.
 *
 * V2 (2026-07-29): Added pause/resume with overlayfs persistence.
 * Pattern: mount overlay OUTSIDE bwrap, bind merged INTO bwrap.
 * This is Docker overlay2 — tested and proven on af-forge.
 *
 * Flow:
 *   1. Constitutional Verdict (arif_judge)  [AGI vs ASI tier already classified]
 *   2. Policy Derivation (derivePolicyFromVerdict)
 *   3. Sandbox Provision (createSandbox) + optional overlay setup
 *   4. Command Execution (runInSandbox)
 *   5. [NEW] Pause → tar upperdir → cold storage
 *   6. [NEW] Resume → lease re-verify → extract upperdir → re-mount
 *   7. Audit Trail (sandbox result → VAULT999)
 *   8. Deprovision (cleanup) / Eviction (auto-clean after 24h)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { executeInSandbox, testBackend } from './ContainmentEngine.js';
import { executeInOverlaySandbox, validatePolicy } from './ContainmentEngine.js';
import { derivePolicyFromVerdict, PRESETS } from './SandboxPolicy.js';
import { SandboxStorage, MAX_PAUSE_AGE_HOURS } from './SandboxStorage.js';
import type { SandboxPolicy, ConstitutionalVerdict, SandboxBackend } from './SandboxPolicy.js';
import type { ContainmentResult } from './ContainmentEngine.js';
import type { OverlayLayout, SnapshotMetadata } from './SandboxStorage.js';

// ── Sandbox Session ────────────────────────────────────────────
export interface SandboxSession {
  sandboxId: string;
  policy: SandboxPolicy;
  backend: SandboxBackend;
  state: SandboxState;
  createdAt: string;
  verdict: ConstitutionalVerdict;
  verdictHash?: string;
  result?: ContainmentResult;
  /** Overlay layout — only set when persistent mode is enabled */
  overlay?: OverlayLayout;
  /** Snapshot metadata — set after pause */
  snapshot?: SnapshotMetadata;
  /** Lease hash for resume re-verification */
  leaseHash?: string;
}

export type SandboxState =
  | 'PROVISIONING'
  | 'READY'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED'
  | 'RESUMING'
  | 'DEPROVISIONED';

// ── In-memory session store ───────────────────────────────────
const activeSessions = new Map<string, SandboxSession>();

// ── Create Sandbox ────────────────────────────────────────────
export async function createSandbox(
  verdict: ConstitutionalVerdict,
  opts?: {
    customPolicy?: SandboxPolicy;
    verdictHash?: string;
    sessionId?: string;
    actorId?: string;
    leaseHash?: string;
    /** Enable persistent overlay mode (pause/resume capable) */
    persistent?: boolean;
    /** Base template paths for overlay lowerdir */
    baseTemplates?: string[];
  },
): Promise<SandboxSession> {
  const policy = opts?.customPolicy || derivePolicyFromVerdict(verdict);

  if (!policy) {
    throw new Error(`Cannot create sandbox: verdict is ${verdict} (VOID = no execution allowed)`);
  }

  // Validate policy before provisioning
  const validation = validatePolicy(policy);
  if (!validation.valid) {
    throw new Error(`Policy validation failed: ${validation.errors.join('; ')}`);
  }

  // Verify backend is available
  const sandboxId = `aforge-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let backend: SandboxBackend = policy.backend === 'auto' ? 'bwrap' : policy.backend;

  if (policy.backend === 'auto') {
    const health = await containmentHealth();
    if (health.available) {
      backend = health.primaryBackend;
    }
  }

  const backendTest = await testBackend(backend);
  if (!backendTest.ok) {
    throw new Error(`Backend "${backend}" not available: ${backendTest.error}`);
  }

  // Provision overlay layout if persistent mode
  let overlay: OverlayLayout | undefined;
  if (opts?.persistent) {
    overlay = SandboxStorage.provision(
      sandboxId,
      opts?.baseTemplates || ['/root/A-FORGE', '/root/arifOS', '/root/AAA'],
    );
  }

  const session: SandboxSession = {
    sandboxId,
    policy: { ...policy, backend, audit: { ...policy.audit, sessionId: opts?.sessionId, verdictHash: opts?.verdictHash } },
    backend,
    state: 'READY',
    createdAt: new Date().toISOString(),
    verdict,
    verdictHash: opts?.verdictHash,
    overlay,
    leaseHash: opts?.leaseHash,
  };

  activeSessions.set(sandboxId, session);
  console.error(
    `[sandbox:provision] ${sandboxId} backend=${backend} policy=${policy.name} ` +
    `verdict=${verdict} persistent=${!!opts?.persistent}`,
  );
  return session;
}

// ── Execute in Sandbox ────────────────────────────────────────
export async function runInSandbox(
  session: SandboxSession,
  command: string,
): Promise<ContainmentResult> {
  if (session.state !== 'READY' && session.state !== 'RESUMING') {
    throw new Error(`Sandbox ${session.sandboxId} is in state "${session.state}", expected READY or RESUMING`);
  }

  // Resume: mount overlay if persistent
  if (session.state === 'RESUMING' && session.overlay) {
    // Overlay was already mounted in resumeSandbox() — verify
    if (!SandboxStorage.isMounted(session.overlay.mergedDir)) {
      SandboxStorage.mountOverlay(session.overlay);
    }
  }

  session.state = 'EXECUTING';
  activeSessions.set(session.sandboxId, session);

  try {
    // Use overlay-aware execution if persistent mode
    const result = session.overlay
      ? await executeInOverlaySandbox(session.policy, command, session.overlay.mergedDir)
      : await executeInSandbox(session.policy, command);

    session.result = result;
    session.state = result.exitCode === 0 && !result.killed ? 'COMPLETED' : 'FAILED';
    activeSessions.set(session.sandboxId, session);

    console.error(
      `[sandbox:${result.exitCode === 0 ? 'complete' : 'fail'}] ` +
      `${session.sandboxId} exit=${result.exitCode} wall=${result.wallTimeMs}ms ` +
      `backend=${result.backend} killed=${result.killed} overlay=${!!session.overlay}`,
    );

    return result;
  } catch (err: any) {
    session.state = 'FAILED';
    activeSessions.set(session.sandboxId, session);
    throw err;
  }
}

// ── PAUSE: Freeze sandbox to cold storage ─────────────────────
/**
 * Pause a persistent sandbox — tar upperdir, unmount overlay, store snapshot.
 *
 * F1 AMANAH:
 *   - All processes terminated (bwrap exits after command)
 *   - No network connections retained
 *   - No file descriptors held
 *   - Filesystem diff preserved as cold tarball
 *   - Delete tarball = full reversal
 *
 * F11 AUDIT:
 *   - Snapshot metadata written to disk
 *   - SHA256 integrity hash on tarball
 *   - Caller must seal pause event to VAULT999
 */
export function pauseSandbox(
  session: SandboxSession,
  opts?: { sessionId?: string; actorId?: string; leaseHash?: string },
): SnapshotMetadata {
  if (!session.overlay) {
    throw new Error(`Sandbox ${session.sandboxId} is not persistent — no overlay to pause`);
  }

  if (session.state === 'PAUSED' || session.state === 'DEPROVISIONED') {
    throw new Error(`Sandbox ${session.sandboxId} is already ${session.state}`);
  }

  const leaseHash = opts?.leaseHash || session.leaseHash || 'unbound';
  const sessionId = opts?.sessionId || session.policy.audit?.sessionId || 'unbound';
  const actorId = opts?.actorId || session.policy.audit?.actorId || 'unknown';

  const snapshot = SandboxStorage.pause(session.overlay, {
    sessionId,
    actorId,
    leaseHash,
    policyName: session.policy.name,
  });

  session.snapshot = snapshot;
  session.state = 'PAUSED';
  activeSessions.set(session.sandboxId, session);

  return snapshot;
}

// ── RESUME: Restore sandbox from cold storage ─────────────────
/**
 * Resume a paused sandbox — extract upperdir, re-mount overlay, re-validate lease.
 *
 * F13 SOVEREIGN GATE:
 *   - Lease hash MUST match the one used at pause time
 *   - If lease expired or revoked → HOLD → snapshot purged
 *   - Snapshot age > 24h → HOLD → auto-eviction
 *
 * Returns the session ready for re-execution.
 */
export function resumeSandbox(
  session: SandboxSession,
  opts: {
    /** Fresh lease hash from arif_judge re-verification */
    currentLeaseHash: string;
    /** Allow resume even if lease hash changed? (DEFAULT: false — strict) */
    allowLeaseChange?: boolean;
  },
): SandboxSession {
  if (!session.overlay) {
    throw new Error(`Sandbox ${session.sandboxId} is not persistent — nothing to resume`);
  }

  if (session.state !== 'PAUSED') {
    throw new Error(`Sandbox ${session.sandboxId} is in state "${session.state}", expected PAUSED`);
  }

  // ── F13 GATE: Lease Re-verification ──────────────────────
  if (!opts.allowLeaseChange && session.leaseHash && session.leaseHash !== opts.currentLeaseHash) {
    // Lease changed — purge snapshot, deny resume
    SandboxStorage.evict(session.sandboxId);
    session.state = 'DEPROVISIONED';
    activeSessions.set(session.sandboxId, session);
    throw new Error(
      `[888_HOLD] Lease mismatch for ${session.sandboxId}. ` +
      `Pause lease: ${session.leaseHash.slice(0, 16)}... ` +
      `Current lease: ${opts.currentLeaseHash.slice(0, 16)}... ` +
      `Snapshot purged. Resume DENIED.`,
    );
  }

  // ── Check snapshot age ──────────────────────────────────
  const snapshotAgeHours =
    (Date.now() - new Date(session.snapshot?.pausedAt || session.createdAt).getTime()) / 3600000;
  if (snapshotAgeHours > MAX_PAUSE_AGE_HOURS) {
    SandboxStorage.evict(session.sandboxId);
    session.state = 'DEPROVISIONED';
    activeSessions.set(session.sandboxId, session);
    throw new Error(
      `[HOLD] Snapshot ${session.sandboxId} is ${snapshotAgeHours.toFixed(1)}h old ` +
      `(max: ${MAX_PAUSE_AGE_HOURS}h). Auto-evicted.`,
    );
  }

  // ── Resume ──────────────────────────────────────────────
  session.state = 'RESUMING';
  activeSessions.set(session.sandboxId, session);

  const mergedPath = SandboxStorage.resume(session.overlay);
  session.leaseHash = opts.currentLeaseHash;
  session.state = 'READY'; // Back to ready — can execute again
  activeSessions.set(session.sandboxId, session);

  console.error(
    `[sandbox:resume] ${session.sandboxId} restored ` +
    `age=${snapshotAgeHours.toFixed(1)}h merged=${mergedPath}`,
  );

  return session;
}

// ── Deprovision Sandbox ───────────────────────────────────────
export function deprovisionSandbox(sandboxId: string): void {
  const session = activeSessions.get(sandboxId);
  if (session) {
    // Clean up overlay if present
    if (session.overlay) {
      SandboxStorage.evict(sandboxId);
    }
    session.state = 'DEPROVISIONED';
    activeSessions.set(sandboxId, session);
    console.error(`[sandbox:deprovision] ${sandboxId}`);
  }
  // bwrap sandboxes are ephemeral — no persistent state to clean up
}

// ── Get Active Sessions ───────────────────────────────────────
export function getActiveSessions(): SandboxSession[] {
  return Array.from(activeSessions.values())
    .filter(s => s.state !== 'DEPROVISIONED');
}

// ── Get Session by ID ─────────────────────────────────────────
export function getSession(sandboxId: string): SandboxSession | undefined {
  return activeSessions.get(sandboxId);
}

// ── List Paused Sandboxes ─────────────────────────────────────
export function listPaused(actorId: string): SnapshotMetadata[] {
  return SandboxStorage.listPaused(actorId);
}

// ── Auto-Evict Expired Snapshots ──────────────────────────────
export function autoEvict(): { evicted: string[]; errors: string[] } {
  return SandboxStorage.autoEvict();
}

// ── Long-Running Governed Loop ────────────────────────────────
/**
 * For long-horizon agentic workflows: execute → pause → resume → execute → ...
 *
 * Pattern:
 *   const loop = createPersistentLoop('SEAL', { leaseHash: 'xxx' });
 *   await loop.execute('npm install');
 *   loop.pause();                                    // cold storage
 *   // ... hours later ...
 *   loop.resume({ currentLeaseHash: 'yyy' });       // lease re-verified
 *   await loop.execute('npm test');
 *   loop.deprovision();
 */
export function createPersistentLoop(
  verdict: ConstitutionalVerdict,
  opts?: {
    customPolicy?: SandboxPolicy;
    verdictHash?: string;
    sessionId?: string;
    actorId?: string;
    leaseHash?: string;
    baseTemplates?: string[];
  },
) {
  let session: SandboxSession | null = null;

  return {
    async init(): Promise<SandboxSession> {
      session = await createSandbox(verdict, {
        ...opts,
        persistent: true,
      });
      return session;
    },

    async execute(command: string): Promise<ContainmentResult> {
      if (!session) throw new Error('Loop not initialized — call init() first');
      return runInSandbox(session, command);
    },

    pause(): SnapshotMetadata {
      if (!session) throw new Error('Loop not initialized');
      return pauseSandbox(session, opts);
    },

    resume(currentLeaseHash: string): SandboxSession {
      if (!session) throw new Error('Loop not initialized');
      return resumeSandbox(session, { currentLeaseHash });
    },

    deprovision(): void {
      if (!session) return;
      deprovisionSandbox(session.sandboxId);
      session = null;
    },

    getSession(): SandboxSession | null {
      return session;
    },
  };
}

// ── Full Governed Execution Pipeline ──────────────────────────
/**
 * The single entry point: constitutional verdict → sandbox → execute → result.
 *
 * This mirrors the MXC pattern:
 *   1. JSON policy config (SandboxPolicy) ← derived from verdict
 *   2. Backend dispatch (bwrap/firejail/docker) ← ContainmentEngine
 *   3. Command execution ← executeInSandbox
 *   4. Streamed output ← stdout/stderr in result
 *   5. Audit trail ← SandboxSession + VAULT999 (caller responsibility)
 *
 * For persistent (pause/resume-capable) execution:
 *   Use createPersistentLoop() or createSandbox() with persistent: true.
 *
 * Usage:
 *   const result = await governedExecute('SEAL', 'npm run build', { verdictHash: 'abc123' });
 */
export async function governedExecute(
  verdict: ConstitutionalVerdict,
  command: string,
  opts?: {
    customPolicy?: SandboxPolicy;
    verdictHash?: string;
    sessionId?: string;
    actorId?: string;
    persistent?: boolean;
    baseTemplates?: string[];
  },
): Promise<{ session: SandboxSession; result: ContainmentResult }> {
  const session = await createSandbox(verdict, {
    ...opts,
    persistent: opts?.persistent || false,
  });
  const result = await runInSandbox(session, command);

  if (!opts?.persistent) {
    deprovisionSandbox(session.sandboxId);
  }

  return { session, result };
}

// ── Health Probe ──────────────────────────────────────────────
export async function containmentHealth(): Promise<{
  available: boolean;
  primaryBackend: SandboxBackend;
  backends: Record<SandboxBackend, { ok: boolean; version?: string }>;
  storage: ReturnType<typeof SandboxStorage.health>;
}> {
  const backends: Record<string, any> = {};
  let primaryBackend: SandboxBackend = 'bwrap';

  for (const b of ['bwrap', 'firejail', 'docker'] as SandboxBackend[]) {
    const test = await testBackend(b);
    backends[b] = { ok: test.ok, version: test.version };
    if (test.ok && !backends[primaryBackend]?.ok) {
      primaryBackend = b;
    }
  }

  return {
    available: backends.bwrap?.ok || backends.firejail?.ok || backends.docker?.ok,
    primaryBackend,
    backends: backends as Record<SandboxBackend, { ok: boolean; version?: string }>,
    storage: SandboxStorage.health(),
  };
}
