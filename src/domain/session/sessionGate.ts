/**
 * SESSION_GATE — Kernel-born session validation for A-FORGE.
 *
 * A-FORGE no longer mints its own sessions. Every session_id must come
 * from arifOS kernel's arif_session_init tool. This module records kernel-born
 * session tokens and validates them on all MUTATE/ATOMIC ingress paths.
 *
 * F11 AUTH: Session identity is verified before any sovereign tool access.
 * F1 AMANAH: Sessions auto-expire after TTL (default 1 hour).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1, F11
 */

interface SessionRecord {
  session_id: string;
  actor_id: string;
  issued_at: number;
  expires_at: number;
  kernel_verified: boolean;
}

const sessions = new Map<string, SessionRecord>();

const DEFAULT_TTL_MS = 3600_000;   // 1 hour
const MAX_TTL_MS   = 86400_000;    // 24 hours

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
 */
export function validateSession(
  session_id: string | undefined,
): { valid: true; actor_id: string } | { valid: false; reason: string } {
  if (!session_id) {
    return { valid: false, reason: "SESSION_REQUIRED: No session_id provided" };
  }
  const record = sessions.get(session_id);
  if (!record) {
    return {
      valid: false,
      reason:
        "SESSION_UNKNOWN: Session not registered. Call arif_session_init via kernel first.",
    };
  }
  if (!record.kernel_verified) {
    return { valid: false, reason: "SESSION_UNVERIFIED: Session came from non-kernel source" };
  }
  if (Date.now() > record.expires_at) {
    sessions.delete(session_id);
    return { valid: false, reason: "SESSION_EXPIRED: Session TTL has expired. Issue a new session via arif_session_init." };
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
