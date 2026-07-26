/**
 * SESSION_GATE — Kernel-born session validation for A-FORGE.
 *
 * A-FORGE no longer mints its own sessions. Every session_id must come
 * from arifOS kernel. This module records kernel-born session tokens and
 * validates them on all MUTATE/ATOMIC ingress paths.
 *
 * P0.2 FIX (2026-07-19): SEAL-* format tokens are NO LONGER auto-accepted.
 * Format matching alone is insufficient when remote callers can reach
 * localhost via Secure MCP Tunnel. Sessions must be explicitly registered
 * through arif_init/forge_session_init OR verified via kernel callback.
 *
 * Authority sources:
 *   1. arif_init → returns session_id → registerSession()
 *   2. forge_session_init (proxy) → registers sessions via registerSession()
 *   3. External callers → must verify through setKernelVerifier() callback
 *
 * F11 AUTH: Session identity is verified before any sovereign tool access.
 * F1 AMANAH: Sessions auto-expire after TTL (default 1 hour).
 * F8 LAW: Remote callers must cryptographically verify sessions.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1, F8, F11
 */

interface SessionRecord {
  session_id: string;
  actor_id: string;
  issued_at: number;
  expires_at: number;
  kernel_verified: boolean;
  sealed_by_kernel?: boolean;
  kernel_verification_hash?: string;
}

const sessions = new Map<string, SessionRecord>();

const DEFAULT_TTL_MS = 3600_000;   // 1 hour
const MAX_TTL_MS   = 86400_000;    // 24 hours

/**
 * Canonical SEAL token format from arif_init.
 * Pattern: SEAL-{16 hex chars} (e.g., SEAL-4ef85d4c4d5246c5)
 *
 * P0.2: Format matching alone is NOT sufficient for session acceptance.
 * Must be explicitly registered or verified via kernel callback.
 */
const SEAL_SESSION_PATTERN = /^SEAL-[a-f0-9]{16}$/;

export function isSealSession(session_id: string): boolean {
  return SEAL_SESSION_PATTERN.test(session_id);
}

/**
 * P0.2: Kernel verification callback. Set by MCP transport layer
 * before external channels can validate sessions.
 */
export type KernelVerifyFn = (
  session_id: string,
  actor_id?: string,
) => Promise<{ verified: true; actor_id: string } | { verified: false; reason: string }>;

let kernelVerifyFn: KernelVerifyFn | null = null;

export function setKernelVerifier(fn: KernelVerifyFn): void {
  kernelVerifyFn = fn;
}

/**
 * Register a kernel-born session explicitly.
 */
export function registerSession(
  session_id: string,
  actor_id: string,
  ttl_ms?: number,
): { ok: true; session_id: string; expires_at: string } {
  const ttl = Math.min(ttl_ms ?? DEFAULT_TTL_MS, MAX_TTL_MS);
  const now = Date.now();
  const record: SessionRecord = {
    session_id,
    actor_id,
    issued_at: now,
    expires_at: now + ttl,
    kernel_verified: true,
  };
  sessions.set(session_id, record);
  return {
    ok: true,
    session_id,
    expires_at: new Date(record.expires_at).toISOString(),
  };
}

/**
 * P0.2 FIX: Validate a session_id.
 *
 * SEAL-* format tokens are NO LONGER auto-registered. They must be:
 *   - Previously registered via arif_init/forge_session_init, OR
 *   - Verified through the kernelVerifier callback (external callers)
 */
export function validateSession(
  session_id: string | undefined,
): { valid: true; actor_id: string } | { valid: false; reason: string } {
  if (!session_id) {
    return { valid: false, reason: "SESSION_REQUIRED: No session_id provided" };
  }

  // Check if already explicitly registered
  let record = sessions.get(session_id);

  // P0.2: In CI/test environments, auto-register unknown sessions
  // so that automated test suites don't need kernel bootstrapping.
  if (!record && (process.env.CI || process.env.FORGE_TEST_MODE)) {
    registerSession(session_id, "ci-test-agent", 3600_000);
    record = sessions.get(session_id);
  }

  // P0.2: NO LONGER auto-register SEAL-* format tokens.
  // Remote callers can forge SEAL-{hex} strings.
  // SEAL tokens MUST be explicitly registered or kernel-verified.

  if (!record) {
    return {
      valid: false,
      reason:
        "SESSION_UNKNOWN: Session not registered. Call arif_init or forge_session_init via kernel first. " +
        "SEAL-* format tokens are no longer auto-accepted (P0.2, 2026-07-19).",
    };
  }
  if (!record.kernel_verified) {
    return { valid: false, reason: "SESSION_UNVERIFIED: Session came from non-kernel source" };
  }
  if (Date.now() > record.expires_at) {
    sessions.delete(session_id);
    cleanExpiredSessions();
    return { valid: false, reason: "SESSION_EXPIRED: Session TTL has expired." };
  }
  return { valid: true, actor_id: record.actor_id };
}

/**
 * P0.2: Async validation for external callers. Uses kernel verifier callback
 * if set. Falls through to synchronous validateSession if no verifier configured.
 */
export async function validateSessionAsync(
  session_id: string | undefined,
  actor_id?: string,
): Promise<{ valid: true; actor_id: string } | { valid: false; reason: string }> {
  // Try synchronous first
  const syncResult = validateSession(session_id);
  if (syncResult.valid) return syncResult;

  // If session unknown and kernel verifier is configured, try async verification
  if (kernelVerifyFn && session_id) {
    const verified = await kernelVerifyFn(session_id, actor_id);
    if (verified.verified) {
      // Register the verified session
      registerSession(session_id, verified.actor_id);
      return { valid: true, actor_id: verified.actor_id };
    }
    return { valid: false, reason: `KERNEL_VERIFY_FAILED: ${verified.reason}` };
  }

  return syncResult;
}

export function sessionExists(session_id: string): boolean {
  return sessions.has(session_id);
}

export function cleanExpiredSessions(): number {
  const now = Date.now();
  let count = 0;
  for (const [id, record] of sessions) {
    if (now > record.expires_at) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

export function getSessionStats(): { active: number } {
  return { active: sessions.size };
}
