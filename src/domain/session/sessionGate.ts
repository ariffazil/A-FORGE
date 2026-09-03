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
 * P1 STATELESS SIMPLIFICATION (2026-08-01): ACT-first validation for
 * stateless MCP 2026-07-28. The act_v1.* token (legacy sct_v1 accepted
 * during migration) is self-contained (HMAC-SHA256 signed). External callers
 * skip the in-memory Map entirely — their ACT is verified directly against
 * arifOS kernel. The Map remains only for locally-registered sessions
 * (arif_init/forge_session_init in-process registration). This reduces
 * session state entropy and eliminates the Map-as-single-point-of-truth
 * for remote callers.
 *
 * Authority sources:
 *   1. arif_init → returns session_id → registerSession() [local only]
 *   2. forge_session_init (proxy) → registers sessions via registerSession() [local only]
 *   3. External callers → ACT verification via verifySessionTokenWithKernel() [primary]
 *
 * F11 AUTH: Session identity is verified before any sovereign tool access.
 * F1 AMANAH: Sessions auto-expire after TTL (default 1 hour).
 * F8 LAW: Remote callers must cryptographically verify sessions.
 * F4 CLARITY: Stateless MCP 2026-07-28 eliminates transport session state.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1, F4, F8, F11
 */

import { createHmac, timingSafeEqual } from "node:crypto";

interface SessionRecord {
  session_id: string;
  actor_id: string;
  act_token?: string;        // P2.1: ACT stored for sessionFallbackToken handoff
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
 *   - Verified through the kernelVerifier callback (external callers), OR
 *   - HMAC-verified via session_token (stateless, P0 FIX 2026-08-13)
 *
 * P0 FIX (2026-08-13): Added session_token parameter. When the session_id
 * is not in the local Map (stdio MCP spawns fresh processes per call),
 * the caller can provide the session_token (HMAC-SHA256 signed by arifOS).
 * Token's sid claim must match the session_id. STATELESS verification —
 * no kernel roundtrip, no Map persistence.
 */
export function validateSession(
  session_id: string | undefined,
  session_token?: string,
): { valid: true; actor_id: string } | { valid: false; reason: string } {
  if (!session_id) {
    return { valid: false, reason: "SESSION_REQUIRED: No session_id provided" };
  }

  // Check if already explicitly registered
  let record = sessions.get(session_id);

  // HITV v0.2 (2026-07-29): BANGANG #7 FIXED — CI/FORGE_TEST_MODE auto-register removed.
  // Only ARIFOS_GATE_TOKEN allows auto-registration of unknown sessions.
  if (!record && process.env.ARIFOS_GATE_TOKEN) {
    registerSession(session_id, "gate-authorized-agent", 3600_000);
    record = sessions.get(session_id);
  }

  // P0.2: NO LONGER auto-register SEAL-* format tokens.
  // Remote callers can forge SEAL-{hex} strings.
  // SEAL tokens MUST be explicitly registered or kernel-verified.

  if (!record) {
    // P0 FIX (2026-08-13): Stateless ACT validation. If session_token is
    // provided, HMAC-verify it against the shared secret. The token's
    // sid claim must match the session_id. Closes the stdio MCP session
    // propagation gap (each spawn is a fresh process with empty Map).
    if (session_token && session_token.startsWith("act_v1.")) {
      const actResult = verifyActLocally(session_token, session_id);
      if (actResult.valid) {
        return { valid: true, actor_id: actResult.actor };
      }
    }
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
 * P0 FIX (2026-08-13): Stateless ACT verification — HMAC-SHA256 only.
 * Mirrors arifOS act_token.py _sign: hexdigest()[:16]. Used to recover
 * session from ACT when the local in-memory Map is empty (stdio MCP
 * spawns fresh processes per call).
 */
function verifyActLocally(
  token: string,
  expected_session_id: string,
): { valid: true; actor: string } | { valid: false } {
  try {
    const secret = process.env.ARIFOS_SESSION_SECRET;
    if (!secret) return { valid: false };
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "act_v1") return { valid: false };
    const [, payloadB64, sigHex] = parts;
    if (!payloadB64 || !sigHex || sigHex.length < 16) return { valid: false };
    // P0 FIX (2026-08-13): Use top-level imports for ESM compatibility.
    // Previous require() failed silently in ESM scope (A-FORGE package.json
    // declares "type": "module"). The try/catch hides the ReferenceError,
    // so the function returned { valid: false } without explanation.
    const expected = createHmac("sha256", secret).update(payloadB64, "ascii").digest("hex").slice(0, 16);
    const a = Buffer.from(expected, "ascii");
    const b = Buffer.from(sigHex.slice(0, 16), "ascii");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson) as Record<string, unknown>;
    const sid = String(claims.sid ?? claims.session_id ?? "");
    if (sid !== expected_session_id) return { valid: false };
    const exp = typeof claims.exp === "number" ? claims.exp : 0;
    if (exp && Date.now() / 1000 > exp) return { valid: false };
    const actor = String(claims.actor ?? claims.actor_id ?? "opencode");
    return { valid: true, actor };
  } catch {
    return { valid: false };
  }
}

/**
 * P1 STATELESS SIMPLIFICATION (2026-08-01): Async validation for all callers.
 *
 * Priority order:
 *   1. ACT token verification (self-contained, no state needed) — PRIMARY
 *   2. Local Map lookup (in-process sessions only) — FALLBACK
 *
 * For stateless MCP 2026-07-28, ACT is the canonical path. The in-memory Map
 * is retained only for locally-registered sessions from arif_init/forge_session_init.
 */
export async function validateSessionAsync(
  session_id: string | undefined,
  actor_id?: string,
  session_token?: string,
): Promise<{ valid: true; actor_id: string } | { valid: false; reason: string }> {
  // ── PATH 0 (PRIMARY): Local HMAC verification of ACT token ──
  // The ACT carries its own authority (HMAC-SHA256 signed with shared secret).
  // Verify locally first — no network roundtrip, no kernel dependency.
  // This is the critical path for HTTP clients (OpenCode, Qwen Code) whose
  // sessions are kernel-born but not registered in the local in-memory Map.
  if (session_token && session_id) {
    // act_v1.* tokens → local HMAC verification
    if (session_token.startsWith("act_v1.")) {
      const localResult = verifyActLocally(session_token, session_id);
      if (localResult.valid) {
        return { valid: true, actor_id: localResult.actor };
      }
      // Local HMAC failed — fall through to kernel verification
    }

    // ── PATH 1: Kernel verification for non-ACT or failed-local tokens ──
    const actVerified = await verifySessionTokenWithKernel(session_token, session_id, actor_id);
    if (actVerified.verified) {
      return { valid: true, actor_id: actVerified.actor_id };
    }
    // Don't return yet — try local Map and kernel callback below
  }

  // ── PATH 2 (FALLBACK): Local Map for in-process sessions ──
  // Only for sessions registered via arif_init/forge_session_init.
  // External callers without ACT tokens cannot use this path.
  const syncResult = validateSession(session_id, session_token);
  if (syncResult.valid) return syncResult;

  // ── PATH 3 (LEGACY): Kernel verifier callback ──
  // Only used when explicitly configured. Superseded by ACT path.
  if (kernelVerifyFn && session_id) {
    const verified = await kernelVerifyFn(session_id, actor_id);
    if (verified.verified) {
      registerSession(session_id, verified.actor_id);
      return { valid: true, actor_id: verified.actor_id };
    }
    return { valid: false, reason: `KERNEL_VERIFY_FAILED: ${verified.reason}` };
  }

  return syncResult;
}

/**
 * P0.6 BRIDGE FIX (2026-07-29): Verify an ACT session token with arifOS kernel.
 * 
 * The bridge gap: OpenCode binds via arif_init → gets session_token (act_v1.eyJ...).
 * A-FORGE receives this token in tool calls but has no local session registry entry.
 * This function calls arifOS kernel to verify the token and extract actor identity.
 */
async function verifySessionTokenWithKernel(
  token: string,
  session_id: string,
  actor_id?: string,
): Promise<{ verified: true; actor_id: string } | { verified: false; reason: string }> {
  const ARIFOS_BASE = process.env.ARIFOS_BASE_URL || "http://127.0.0.1:8088";
  try {
    const resp = await fetch(`${ARIFOS_BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "arif_init",
          arguments: {
            mode: "validate",
            session_id,
            session_token: token,
            actor_id: actor_id ?? "opencode",
          },
        },
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) {
      return { verified: false, reason: `arifOS kernel returned HTTP ${resp.status}` };
    }

    const body = await resp.json() as any;
    const resultText = body?.result?.content?.[0]?.text;
    if (!resultText) {
      return { verified: false, reason: "arifOS kernel returned empty response" };
    }

    const result = typeof resultText === "string" ? JSON.parse(resultText) : resultText;
    const verified = result?.actor?.actor_verified === true || result?.status === "resumed" || result?.verdict === "SEAL";
    const resolvedActor = result?.actor?.actor_id || actor_id || "opencode";

    if (verified) {
      return { verified: true, actor_id: resolvedActor };
    }

    return { verified: false, reason: `arifOS rejected: ${result?.verdict || result?.status || "unknown"}` };
  } catch (err: any) {
    return { verified: false, reason: `arifOS unreachable: ${err.message || err}` };
  }
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

/**
 * P2.1 ACT Handoff (2026-08-07): Store the ACT token alongside the session
 * so downstream tools can inherit it via sessionFallbackToken.
 *
 * When forge_session_init receives an ACT from the kernel, it is stored here.
 * Later tool calls without an explicit session_token can look up the session's
 * ACT and use it as a fallback. This closes the ACT_GATE regression where
 * autonomous seal paths broke when ACTs stopped being forwarded explicitly.
 *
 * F1 AMANAH: The ACT is bound to its session. Session expiry auto-invalidates.
 */
export function storeSessionAct(session_id: string, act_token: string): void {
  const record = sessions.get(session_id);
  if (record) {
    record.act_token = act_token;
  }
}

/**
 * P2.1 ACT Handoff: Retrieve the stored ACT for a session.
 * Returns null if no ACT was stored or the session is unknown.
 */
export function getSessionAct(session_id: string): string | null {
  const record = sessions.get(session_id);
  return record?.act_token ?? null;
}
