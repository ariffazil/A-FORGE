/**
 * A-FORGE Containment: Execution Sandbox Lifecycle
 * ═══════════════════════════════════════════════
 *
 * Manages the full lifecycle: provision → exec → stream → deprovision.
 * Integrates with arifOS constitutional verdict chain.
 *
 * Flow:
 *   1. Constitutional Verdict (arif_judge_deliberate)
 *   2. Policy Derivation (derivePolicyFromVerdict)
 *   3. Sandbox Provision (createSandbox)
 *   4. Command Execution (executeInSandbox)
 *   5. Audit Trail (sandbox result → VAULT999)
 *   6. Deprovision (cleanup)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { executeInSandbox, validatePolicy, testBackend } from './ContainmentEngine.js';
import { derivePolicyFromVerdict, PRESETS } from './SandboxPolicy.js';
import type { SandboxPolicy, ConstitutionalVerdict, SandboxBackend } from './SandboxPolicy.js';
import type { ContainmentResult } from './ContainmentEngine.js';

// ── Sandbox Session ────────────────────────────────────────────
export interface SandboxSession {
  sandboxId: string;
  policy: SandboxPolicy;
  backend: SandboxBackend;
  state: 'PROVISIONING' | 'READY' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'DEPROVISIONED';
  createdAt: string;
  verdict: ConstitutionalVerdict;
  verdictHash?: string;
  result?: ContainmentResult;
}

// ── In-memory session store ───────────────────────────────────
const activeSessions = new Map<string, SandboxSession>();

// ── Create Sandbox ────────────────────────────────────────────
export async function createSandbox(
  verdict: ConstitutionalVerdict,
  opts?: {
    customPolicy?: SandboxPolicy;
    verdictHash?: string;
    sessionId?: string;
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
  const backend = policy.backend === 'auto' ? 'bwrap' : policy.backend;

  const backendTest = await testBackend(backend);
  if (!backendTest.ok) {
    throw new Error(`Backend "${backend}" not available: ${backendTest.error}`);
  }

  const session: SandboxSession = {
    sandboxId,
    policy: { ...policy, audit: { ...policy.audit, sessionId: opts?.sessionId, verdictHash: opts?.verdictHash } },
    backend,
    state: 'READY',
    createdAt: new Date().toISOString(),
    verdict,
    verdictHash: opts?.verdictHash,
  };

  activeSessions.set(sandboxId, session);
  console.error(`[sandbox:provision] ${sandboxId} backend=${backend} policy=${policy.name} verdict=${verdict}`);
  return session;
}

// ── Execute in Sandbox ────────────────────────────────────────
export async function runInSandbox(
  session: SandboxSession,
  command: string,
): Promise<ContainmentResult> {
  if (session.state !== 'READY') {
    throw new Error(`Sandbox ${session.sandboxId} is in state "${session.state}", expected READY`);
  }

  session.state = 'EXECUTING';
  activeSessions.set(session.sandboxId, session);

  try {
    const result = await executeInSandbox(session.policy, command);
    session.result = result;
    session.state = result.exitCode === 0 && !result.killed ? 'COMPLETED' : 'FAILED';
    activeSessions.set(session.sandboxId, session);

    console.error(
      `[sandbox:${result.exitCode === 0 ? 'complete' : 'fail'}] ` +
      `${session.sandboxId} exit=${result.exitCode} wall=${result.wallTimeMs}ms ` +
      `backend=${result.backend} killed=${result.killed}`,
    );

    return result;
  } catch (err: any) {
    session.state = 'FAILED';
    activeSessions.set(session.sandboxId, session);
    throw err;
  }
}

// ── Deprovision Sandbox ───────────────────────────────────────
export function deprovisionSandbox(sandboxId: string): void {
  const session = activeSessions.get(sandboxId);
  if (session) {
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
  },
): Promise<{ session: SandboxSession; result: ContainmentResult }> {
  const session = await createSandbox(verdict, opts);
  const result = await runInSandbox(session, command);
  deprovisionSandbox(session.sandboxId);
  return { session, result };
}

// ── Health Probe ──────────────────────────────────────────────
export async function containmentHealth(): Promise<{
  available: boolean;
  primaryBackend: SandboxBackend;
  backends: Record<SandboxBackend, { ok: boolean; version?: string }>;
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
  };
}
