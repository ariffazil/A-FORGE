/**
 * SESSION_GATE — Kernel-born session validation for A-FORGE.
 *
 * A-FORGE no longer mints its own sessions. Every session_id must come
 * from arifOS kernel. This module records kernel-born session tokens and
 * validates them on all MUTATE/ATOMIC ingress paths.
 *
 * Authority sources (Option C — canonical kernel alignment):
 *   1. arif_init (public) → issues SEAL-{hex} tokens (kernel authority root)
 *   2. forge_session_init (proxy) → registers sessions via registerSession()
 *
 * SEAL-prefixed sessions are auto-recognized as kernel-authoritative because
 * arif_init IS the constitutional authority root of arifOS. A-FORGE does not
 * verify the kernel's own signatures — it accepts the token format as
 * authority-bearing, bounded by localhost transport + TTL.
 *
 * F11 AUTH: Session identity is verified before any sovereign tool access.
 * F1 AMANAH: Sessions auto-expire after TTL (default 1 hour).
 * F8 LAW: Only localhost MCP transport reaches this code (Caddy sovereign gate).
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
  /** True for SEAL-{hex} tokens minted by arif_init directly */
  sealed_by_kernel?: boolean;
}

const sessions = new Map<string, SessionRecord>();

const DEFAULT_TTL_MS = 3600_000;   // 1 hour
const MAX_TTL_MS   = 86400_000;    // 24 hours

/**
 * Canonical SEAL token format from arif_init.
 * Pattern: SEAL-{16 hex chars} (e.g., SEAL-4ef85d4c4d5246c5)
 *
 * This is the kernel's public session authority root. A-FORGE accepts it
 * as kernel-authoritative without additional signature verification,
 * gated by F8 (localhost-only MCP transport via Caddy sovereign gate).
 */
const SEAL_SESSION_PATTERN = /^SEAL-[a-f0-9]{16}$/;

export function isSealSession(session_id: string): boolean {
  return SEAL_SESSION_PATTERN.test(session_id);
}

/**
 * Register a kernel-born session in A-FORGE's local cache.
 * Called by arif_session_init MCP tool after kernel returns session_id.
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
 * Validate a session_id — is it a known kernel-born session?
 * Returns { valid: true, actor_id } or { valid: false, reason }.
 *
 * Option C authority model: if the session matches arif_init's
 * SEAL-{hex} format and is not previously registered, auto-register it
 * as kernel-authoritative. This collapses the authority story into one
 * canonical root: arif_init.
 *
 * F1 AMANAH: proactively cleans expired sessions on every validation.
 * F8 LAW: SEAL auto-accept is bounded by localhost MCP transport.
 */
export function validateSession(
  session_id: string | undefined,
): { valid: true; actor_id: string } | { valid: false; reason: string } {
  if (!session_id) {
    return { valid: false, reason: "SESSION_REQUIRED: No session_id provided" };
  }

  // Option C: auto-recognize arif_init SEAL tokens
  let record = sessions.get(session_id);
  if (!record && isSealSession(session_id)) {
    record = {
      session_id,
      actor_id: "kernel-sealed",
      issued_at: Date.now(),
      expires_at: Date.now() + DEFAULT_TTL_MS,
      kernel_verified: true,
      sealed_by_kernel: true,
    };
    sessions.set(session_id, record);
    console.error(
      `[SESSION_GATE] Auto-registered arif_init SEAL session: ${session_id} (TTL=${DEFAULT_TTL_MS / 1000}s)`,
    );
  }

  if (!record) {
    return {
      valid: false,
      reason:
        "SESSION_UNKNOWN: Session not registered. Call arif_init or forge_session_init via kernel first.",
    };
  }
  if (!record.kernel_verified) {
    return { valid: false, reason: "SESSION_UNVERIFIED: Session came from non-kernel source" };
  }
  if (Date.now() > record.expires_at) {
    sessions.delete(session_id);
    // Proactively clean other expired sessions
    cleanExpiredSessions();
    return { valid: false, reason: "SESSION_EXPIRED: Session TTL has expired. Issue a new session via arif_init." };
  }
  return { valid: true, actor_id: record.actor_id };
}

/**
 * Check if a session_id is known (regardless of expiry).
 * Useful for diagnostics — does not block or delete.
 */
export function sessionExists(session_id: string): boolean {
  return sessions.has(session_id);
}

/**
 * Clean expired sessions from memory.
 */
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

/**
 * Get session stats for diagnostics.
 */
export function getSessionStats(): { active: number } {
  return { active: sessions.size };
}
