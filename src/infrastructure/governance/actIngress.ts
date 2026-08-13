/**
 * Federation ACT ingress gate for A-FORGE.
 *
 * Mirrors AAA governance/federation_sct.py:
 *   - Collect ALL ACT candidates from every source
 *   - Identical values → normalize to one token
 *   - Distinct values → ACT_AMBIGUOUS (reject, execute nothing)
 *   - Present token → verify via arifOS fail-closed
 *
 * DITEMPA BUKAN DIBERI — Tokens are forged, not assumed.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const ARIFOS_BASE = process.env.ARIFOS_BASE_URL || "http://127.0.0.1:8088";
const ACT_DECISION_EVENT_DIR =
  process.env.ACT_DECISION_EVENT_DIR ||
  "/root/A-FORGE/forge_work/2026-07-17/act_decision_events";
const ACT_TIMEOUT_MS = Number(process.env.ARIFOS_ACT_TIMEOUT_MS || "2500");
// P2.1 DUAL-ACCEPT (2026-08-07): Transition from SCT to ACT.
// Accepts both sct_v1.* (legacy) and act_v1.* (new) for one TTL cycle (~8h).
// After the grace period, drop sct_v1 acceptance.
const ACT_RE = /^(sct_v1|act_v1)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/;

// ── Actor Identity Canonicalization ──────────────────────────────────────
// Mirrors arifOS _resolve_canonical_actor (session.py:1506).
// canonical_actor_id = lowercase, dash-not-underscore machine identifier.
// display_name (e.g. "ARIF") is human-only — never used for comparison.
// P0 FIX (2026-07-29): No scattered .toLowerCase() — one canonical source.
const SOVEREIGN_IDENTITY_MAP: Record<string, string> = {
  ariffazil: "ariffazil",
};
const ACTOR_ALIAS_MAP: Record<string, string> = {
  "arif-fazil": "ariffazil",
  // FI agents: arifOS canonicalizes all 333-AGI lane actors to "333-agi"
  // in ACT token claims. Map each FI harness name so ACT binding checks pass.
  "opencode": "333-agi",
  "qwen-code": "333-agi",
  "kimi-code": "333-agi",
  "claude": "333-agi",
  "codex": "333-agi",
  "grok": "333-agi",
  "grok-build": "333-agi",
  "hermes": "333-agi",
};

export function canonicalizeActor(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "anonymous";
  const normalized = s.toLowerCase().replace(/_/g, "-");
  if (SOVEREIGN_IDENTITY_MAP[normalized]) return SOVEREIGN_IDENTITY_MAP[normalized];
  if (ACTOR_ALIAS_MAP[normalized]) return ACTOR_ALIAS_MAP[normalized];
  return normalized;
}

export type SctGateResult =
  | { ok: true; actor?: string; authority?: string; claims?: Record<string, unknown> }
  | {
      ok: false;
      error: string;
      message: string;
      actor?: string;
      extraction?: TokenExtraction;
    };

export type TokenSource = {
  location: string;
  fingerprint: string;
  length: number;
};

export type TokenExtraction =
  | {
      status: "ABSENT";
      sources: TokenSource[];
      source_count: number;
      unique_fingerprints: number;
    }
  | {
      status: "PRESENT";
      token: string;
      sources: TokenSource[];
      source_count: number;
      unique_fingerprints: number;
    }
  | {
      status: "AMBIGUOUS";
      sources: TokenSource[];
      source_count: number;
      unique_fingerprints: number;
      conflict_detected: true;
    };

function fingerprint(token: string): string {
  // Short non-reversible id for logs (not a crypto seal — just collision-resistant enough for audit)
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  }
  return `fp:${(h >>> 0).toString(16).padStart(8, "0")}:${token.length}`;
}

function pushCandidate(
  sources: TokenSource[],
  unique: Map<string, string>,
  token: string,
  location: string,
): void {
  const t = token.trim();
  if (!t) return;
  const fp = fingerprint(t);
  sources.push({ location, fingerprint: fp, length: t.length });
  if (!unique.has(fp)) unique.set(fp, t);
}

/**
 * Collect ALL ACT candidates from args, nested _meta, explicit meta, and headers.
 * First-token-wins is FORBIDDEN — conflicts return AMBIGUOUS.
 */
export function extractActFromCall(
  args: Record<string, unknown> | null | undefined,
  opts: {
    headers?: Record<string, string> | null;
    meta?: Record<string, unknown> | null;
  } = {},
): TokenExtraction {
  const sources: TokenSource[] = [];
  const unique = new Map<string, string>();

  const a = args && typeof args === "object" ? args : {};

  // 1. Direct argument keys (P2.1: dual-accept sct + act)
  for (const key of ["session_token", "sct", "act", "arifos_sct"] as const) {
    const v = a[key];
    if (typeof v === "string" && v.trim()) {
      pushCandidate(sources, unique, v, `arguments.${key}`);
    }
  }

  // 2. Nested _meta in arguments
  const nested = a._meta;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    for (const key of ["sct", "act", "session_token", "arifos_sct"] as const) {
      const v = m[key];
      if (typeof v === "string" && v.trim()) {
        pushCandidate(sources, unique, v, `arguments._meta.${key}`);
      }
    }
  }

  // 3. Explicit meta
  if (opts.meta && typeof opts.meta === "object") {
    for (const key of ["sct", "act", "session_token", "arifos_sct"] as const) {
      const v = opts.meta[key];
      if (typeof v === "string" && v.trim()) {
        pushCandidate(sources, unique, v, `_meta.${key}`);
      }
    }
  }

  // 4. HTTP headers
  if (opts.headers && typeof opts.headers === "object") {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.headers)) {
      lower[String(k).toLowerCase()] = String(v);
    }
    for (const key of ["x-arifos-sct", "x-session-token", "x-arifos-session-token"]) {
      const v = lower[key];
      if (v && v.trim()) {
        pushCandidate(sources, unique, v, `header.${key}`);
      }
    }
    const auth = lower["authorization"] || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (token.startsWith("sct_v1.") || token.startsWith("act_v1.") || token.startsWith("arifos.v1.")) {
        pushCandidate(sources, unique, token, "header.authorization");
      }
    }
  }

  const source_count = sources.length;
  const unique_fingerprints = unique.size;

  if (unique_fingerprints === 0) {
    return { status: "ABSENT", sources, source_count, unique_fingerprints: 0 };
  }
  if (unique_fingerprints === 1) {
    const token = unique.values().next().value as string;
    return {
      status: "PRESENT",
      token,
      sources,
      source_count,
      unique_fingerprints: 1,
    };
  }
  return {
    status: "AMBIGUOUS",
    sources,
    source_count,
    unique_fingerprints,
    conflict_detected: true,
  };
}

/**
 * Legacy helper — returns single token or null.
 * Prefer extractActFromCall for conflict detection.
 * Returns null on ABSENT or AMBIGUOUS (never silently picks first).
 */
export function extractSctFromArgs(
  args: Record<string, unknown> | null | undefined,
): string | null {
  const ext = extractActFromCall(args);
  if (ext.status === "PRESENT") return ext.token;
  return null;
}

function formatOk(sct: string): boolean {
  return sct.length >= 16 && ACT_RE.test(sct);
}

/**
 * Production startup invariant.
 * production + FORGE_ACT_REQUIRE_MUTATE=0 → FATAL (exit before bind).
 */
export function assertActMutationGateOrExit(
  env: NodeJS.ProcessEnv = process.env,
): { required: boolean; enforced: boolean; bypass_profile: "none" | "dev" } {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.AF_FORGE_ENV === "production" ||
    env.AF_PROFILE === "production";
  // P2.1 DUAL-ACCEPT: honor both old (FORGE_SCT_REQUIRE_MUTATE) and new (FORGE_ACT_REQUIRE_MUTATE)
  const raw = env.FORGE_ACT_REQUIRE_MUTATE ?? env.FORGE_SCT_REQUIRE_MUTATE;
  const bypass =
    raw === "0" || String(raw || "").toLowerCase() === "false";
  const enforced = !bypass;

  if (isProduction && bypass) {
    console.error(
      "[FATAL] FORGE_ACT_REQUIRE_MUTATE=0 is forbidden in production. " +
        "ACT mutation gate must be enforced (set FORGE_ACT_REQUIRE_MUTATE=1 or unset). " +
        `NODE_ENV=${env.NODE_ENV} AF_FORGE_ENV=${env.AF_FORGE_ENV}`,
    );
    process.exit(1);
  }

  return {
    required: true,
    enforced,
    bypass_profile: bypass ? "dev" : "none",
  };
}

/** Health payload fragment for act_mutation_gate (never exits). */
export function actMutationGateHealth(
  env: NodeJS.ProcessEnv = process.env,
): {
  required: boolean;
  enforced: boolean;
  bypass_profile: "none" | "dev";
  env: string;
} {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.AF_FORGE_ENV === "production" ||
    env.AF_PROFILE === "production";
  // P2.1 DUAL-ACCEPT
  const raw = env.FORGE_ACT_REQUIRE_MUTATE ?? env.FORGE_SCT_REQUIRE_MUTATE;
  const bypass = raw === "0" || String(raw || "").toLowerCase() === "false";
  if (isProduction && bypass) {
    // Health path must not exit mid-request if misconfigured at runtime —
    // report the violation instead. Startup uses assertActMutationGateOrExit.
    return {
      required: true,
      enforced: false,
      bypass_profile: "dev",
      env: "production_violation",
    };
  }
  return {
    required: true,
    enforced: !bypass,
    bypass_profile: bypass ? "dev" : "none",
    env: isProduction ? "production" : "non-production",
  };
}

/**
 * Verify ACT locally (no arifOS roundtrip) — CANONICAL cross-domain verifier.
 *
 * Handles the arifOS kernel wire format (act_v1.<b64url(json)>.<hmac_hex16>)
 * exactly. Exported as the bridge entry point for A-FORGE (see actBridge.ts).
 *
 * Canonical wire format (arifOS session.py _sign_session_payload):
 *   <base64url(payload_json)>.<hmac_hex_trunc16>
 *
 * The sct_v1. prefix is a federation convention applied by callers.
 * HMAC uses SHA-256 with ARIFOS_SESSION_SECRET, truncated to 16 hex chars
 * (64 bits) matching arifOS session.py[:16]. Both sides MUST use identical
 * truncation until a coordinated upgrade to full HMAC is deployed.
 *
 * P0 FIX (2026-07-29): HMAC-SHA256 signature is NOW verified against
 * the shared ARIFOS_SESSION_SECRET. Previously the signature was
 * extracted but never checked — a fail-open path that accepted any
 * well-formed payload regardless of who signed it.
 *
 * Verification order: format → prefix → HMAC signature → expiry → actor → authority.
 * Any failure returns {ok:false} BEFORE claims are parsed.
 */
export function verifyLocalAct(
  sct: string,
  opts: { expectedActor?: string | null; requiredAuthority?: string },
): SctGateResult | null {
  try {
    // ── 1. Format check: exactly 3 segments ────────────────────────────
    const parts = sct.split(".");
    if (parts.length !== 3 || (parts[0] !== "sct_v1" && parts[0] !== "act_v1")) {
      // Malformed token — no legacy fallthrough. A token with wrong segment
      // count can never be valid. Return hard error rather than null to
      // prevent arifOS roundtrip on clearly-invalid tokens.
      return { ok: false, error: "ERR_ACT_MALFORMED", message: `Expected sct_v1|act_v1.<payload>.<sig> (3 segments), got ${parts.length}` };
    }

    const [_prefix, payloadB64, sigHex] = parts;

    // ── 2. HMAC-SHA256 signature verification (P0 FIX) ─────────────────
    // Reject signatures shorter than 16 hex chars (truncation floor).
    if (!sigHex || sigHex.length < 16) {
      return { ok: false, error: "ERR_ACT_SIGNATURE_SHORT", message: "HMAC signature too short" };
    }

    // Canonical wire format: arifOS session.py _sign_session_payload() uses
    // hexdigest()[:16] (16 hex chars = 64-bit truncation).
    // Both sides MUST use identical truncation or verification fails.
    // P0.1 (2026-07-29): Aligned with arifOS issuer.
    // P0.2 (TODO): Upgrade both sides to full 64-char HMAC for 256-bit security.
    const secret = process.env.ARIFOS_SESSION_SECRET;
    if (!secret) {
      return { ok: false, error: "ERR_ACT_NO_SECRET", message: "ARIFOS_SESSION_SECRET not configured" };
    }
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64, "ascii")
      .digest("hex")
      .slice(0, 16); // Match arifOS session.py[:16] — canonical issuer determines truncation
    const receivedSig = sigHex.slice(0, 16); // Accept longer sigs, compare first 16 chars
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig, "ascii"), Buffer.from(receivedSig, "ascii"))) {
      return { ok: false, error: "ERR_ACT_SIGNATURE_INVALID", message: "HMAC-SHA256 signature mismatch" };
    }

    // ── 3. Decode payload ──────────────────────────────────────────────
    const payloadB64Std = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = Buffer.from(payloadB64Std, "base64").toString("utf-8");
    const claims = JSON.parse(payloadJson) as Record<string, unknown>;

    // ── 4. Version check (P2.1: dual-accept sct_v and act_v) ──────────
    const tokenVersion = (claims.sct_v ?? claims.act_v) as number | undefined;
    if (tokenVersion !== 1) {
      return { ok: false, error: "ACT_VERSION", message: `Unsupported ACT version: ${tokenVersion}` };
    }

    // ── 5. Expiry check ────────────────────────────────────────────────
    const exp = claims.exp as number | undefined;
    if (exp && Date.now() / 1000 > exp) {
      return { ok: false, error: "ACT_EXPIRED", message: `Token expired at ${new Date(exp * 1000).toISOString()}` };
    }
    const nbf = claims.nbf as number | undefined;
    if (nbf && Date.now() / 1000 < nbf) {
      return { ok: false, error: "ACT_NOT_YET_VALID", message: `Token not valid before ${new Date(nbf * 1000).toISOString()}` };
    }

    // ── 6. Actor + Delegation binding (P2.1 TOKEN HANDOFF) ─────────────
    // Decoupled from crypto: signature passed, now we check governance claims.
    // Three acceptance paths:
    //   (a) Direct: ACT actor matches the expected caller
    //   (b) Delegated: ACT was delegated FROM the expected caller (Token Handoff)
    //   (c) Audience: ACT audience matches the tool domain
    // Any other mismatch → ERR_ACT_BINDING_INVALID (governance rejection, NOT crypto)
    const rawActor = String(claims.canonical_actor_id || claims.actor || claims.act || "");
    const actor = canonicalizeActor(rawActor);
    const authority = String(claims.auth || claims.authority || "OBSERVE_ONLY");
    const requiredAuthority = opts.requiredAuthority || "OBSERVE_ONLY";

    if (opts.expectedActor) {
      const expected = canonicalizeActor(opts.expectedActor);
      const delegatedFrom = claims.delegated_from
        ? canonicalizeActor(String(claims.delegated_from))
        : null;

      // Path (a): Direct actor match
      const directMatch = actor === expected;
      // Path (b): Delegation — the ACT's delegator matches the caller
      const delegationMatch = delegatedFrom !== null && delegatedFrom === expected;
      // Path (c): Audience — ACT was minted for a specific domain
      const audienceMatch = false; // Reserved for aud claim check (Phase 2)

      if (!directMatch && !delegationMatch && !audienceMatch) {
        const reason = delegatedFrom !== null
          ? `ACT actor "${actor}" delegated from "${delegatedFrom}" but caller is "${expected}" — delegation chain broken`
          : `ACT actor "${actor}" (raw: "${rawActor}") vs caller "${expected}" (raw: "${opts.expectedActor}")`;
        return {
          ok: false,
          error: "ERR_ACT_BINDING_INVALID",
          message: reason,
        };
      }
    }

    // ── 7. Authority rank check ────────────────────────────────────────
    const RANK = ["OBSERVE_ONLY", "OPERATOR", "LIMITED_MUTATE", "FULL", "SOVEREIGN"];
    if (!RANK.includes(requiredAuthority) || !RANK.includes(authority)) {
      return { ok: false, error: "UNKNOWN_AUTHORITY", message: `${authority} / required ${requiredAuthority}` };
    }
    if (RANK.indexOf(authority) < RANK.indexOf(requiredAuthority)) {
      return { ok: false, error: "INSUFFICIENT_AUTHORITY", message: `ACT ${authority} < required ${requiredAuthority}` };
    }

    return { ok: true, actor, authority, claims };
  } catch {
    return null; // Can't decode — fall through to arifOS
  }
}

/**
 * Verify ACT — local decode first, arifOS roundtrip as fallback.
 * P2.1 fix (2026-07-28): primary path is local. arifOS has no "validate"
 * init mode; calling arif_init(mode="validate") falls through to mode="init"
 * which tries to create a new session — failing on every valid token.
 */
export async function verifyFederationAct(
  sct: string | null | undefined,
  opts: {
    expectedActor?: string | null;
    requiredAuthority?: string;
  } = {},
): Promise<SctGateResult> {
  const requiredAuthority = opts.requiredAuthority || "OBSERVE_ONLY";
  if (!sct) {
    return { ok: false, error: "ACT_MISSING", message: "No ACT provided" };
  }
  if (!formatOk(sct)) {
    return {
      ok: false,
      error: "ACT_MALFORMED",
      message: `ACT does not match sct_v1|act_v1 shape: ${sct.slice(0, 24)}...`,
    };
  }

  // P2.1: Local decode is the primary path (no arifOS roundtrip needed)
  const local = verifyLocalAct(sct, opts);
  if (local) return local;

  // ── arifOS fallback (for legacy tokens or format drift) ────────────
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ACT_TIMEOUT_MS);
    const res = await fetch(`${ARIFOS_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "arif_init",
          arguments: {
            mode: "init",
            session_token: sct,
            actor_id: opts.expectedActor || undefined,
          },
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        error: "ARIFOS_HTTP_ERROR",
        message: `arifOS returned HTTP ${res.status}`,
      };
    }

    let text = await res.text();
    if (text.includes("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      text = lines.length ? lines[lines.length - 1].slice(5).trim() : text;
    }
    const data = JSON.parse(text) as Record<string, unknown>;
    let result = (data.result as Record<string, unknown>) || {};

    const content = result.content as Array<{ text?: string }> | undefined;
    if (Array.isArray(content) && content[0]?.text) {
      try {
        const parsed = JSON.parse(content[0].text) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") {
          if ("valid" in parsed || "claims" in parsed) result = parsed;
          else if (parsed.result && typeof parsed.result === "object") {
            result = parsed.result as Record<string, unknown>;
          } else result = parsed;
        }
      } catch {
        /* keep result */
      }
    }

    if (!result.valid) {
      return {
        ok: false,
        error: "ACT_INVALID",
        message: String(result.error || "arifOS rejected SCT"),
      };
    }
    const claims = (result.claims as Record<string, unknown>) || null;
    if (!claims || typeof claims !== "object") {
      return {
        ok: false,
        error: "ACT_CLAIMS_MISSING",
        message: "valid=true without claims — not an ACT receipt",
      };
    }
    const actor = String(claims.actor || claims.actor_id || "");
    const authority = String(claims.auth || claims.authority || "OBSERVE_ONLY");

    if (opts.expectedActor && actor && actor !== opts.expectedActor) {
      return {
        ok: false,
        error: "ACTOR_MISMATCH",
        message: `ACT actor ${actor} does not match caller ${opts.expectedActor}`,
      };
    }

    const RANK = ["OBSERVE_ONLY", "OPERATOR", "LIMITED_MUTATE", "FULL", "SOVEREIGN"];
    if (!RANK.includes(requiredAuthority) || !RANK.includes(authority)) {
      return {
        ok: false,
        error: "UNKNOWN_AUTHORITY",
        message: `authority band not recognised: ${authority} / required ${requiredAuthority}`,
      };
    }
    if (RANK.indexOf(authority) < RANK.indexOf(requiredAuthority)) {
      return {
        ok: false,
        error: "INSUFFICIENT_AUTHORITY",
        message: `ACT authority ${authority} < required ${requiredAuthority}`,
      };
    }

    return { ok: true, actor, authority, claims };
  } catch (err) {
    return {
      ok: false,
      error: "ARIFOS_UNREACHABLE",
      message: `arifOS unreachable (${err instanceof Error ? err.message : String(err)}); ACT rejected (fail-closed)`,
    };
  }
}

/**
 * Ingress gate for A-FORGE tool handlers.
 *
 * - Conflicting token sources → ACT_AMBIGUOUS (reject)
 * - ACT present → must verify (fail closed)
 * - requireSct=true and missing → ACT_REQUIRED
 * - otherwise allow (backward-compatible OBSERVE)
 */
export async function gateToolIngress(
  toolName: string,
  args: Record<string, unknown>,
  opts: {
    requireSct?: boolean;
    requiredAuthority?: string;
    headers?: Record<string, string> | null;
    meta?: Record<string, unknown> | null;
    /** Fallback ACT token derived from a validated session (P2.1 fix for ACT_GATE regression) */
    sessionFallbackToken?: string | null;
  } = {},
): Promise<SctGateResult | { ok: true; skipped: true }> {
  const extraction = extractActFromCall(args, {
    headers: opts.headers,
    meta: opts.meta,
  });
  const actor =
    (typeof args.actor_id === "string" && args.actor_id) ||
    (typeof args.actor === "string" && args.actor) ||
    null;

  if (extraction.status === "AMBIGUOUS") {
    emitDecisionEvent({
      tool: toolName, decision: "REJECT", reason_code: "ACT_AMBIGUOUS",
      actor_id: actor || undefined, require_sct: true,
      sct_source_count: extraction.source_count,
      sct_unique_tokens: extraction.unique_fingerprints,
      extraction_locations: extraction.sources.map(s => s.location),
    });
    return {
      ok: false,
      error: "ACT_AMBIGUOUS",
      message:
        `Tool "${toolName}" received ${extraction.unique_fingerprints} distinct ` +
        `ACT tokens from ${extraction.source_count} sources. ` +
        `All sources must carry the same token. Execution refused.`,
      actor: actor || undefined,
      extraction,
    };
  }

  if (extraction.status === "ABSENT") {
    // P2.1 FIX (2026-07-27): ACT_GATE regression — when session_token isn't
    // explicitly passed but a validated session exists, use the session's
    // ACT as fallback. This restores the autonomous seal path broken when
    // arif_init OBSERVE_ONLY tokens stopped being forwarded to forge_vault.
    if (opts.sessionFallbackToken) {
      const verified = await verifyFederationAct(opts.sessionFallbackToken, {
        expectedActor: actor,
        requiredAuthority: opts.requiredAuthority || "OBSERVE_ONLY",
      });
      if (verified.ok) {
        emitDecisionEvent({
          tool: toolName, decision: "ALLOW", reason_code: "OK_SESSION_FALLBACK",
          actor_id: verified.actor || actor || undefined,
          require_sct: true,
          sct_fingerprint: opts.sessionFallbackToken
            ? `sha256:${crypto.createHash("sha256").update(opts.sessionFallbackToken).digest("hex").slice(0, 16)}`
            : "",
        });
        return verified;
      }
      // Fallback failed — continue to normal ACT_REQUIRED path
    }
    if (opts.requireSct) {
      emitDecisionEvent({
        tool: toolName, decision: "REJECT", reason_code: "ACT_REQUIRED",
        actor_id: actor || undefined, require_sct: true,
      });
      return {
        ok: false,
        error: "ACT_REQUIRED",
        message: `Tool "${toolName}" requires session_token (mint via arif_init)`,
        actor: actor || undefined,
        extraction,
      };
    }
    emitDecisionEvent({
      tool: toolName, decision: "ALLOW", reason_code: "OK_NO_ACT_OBSERVE",
      actor_id: actor || undefined, require_sct: false,
    });
    return { ok: true, skipped: true };
  }

  const verified = await verifyFederationAct(extraction.token, {
    expectedActor: actor,
    requiredAuthority: opts.requiredAuthority || "OBSERVE_ONLY",
  });
  if (!verified.ok) {
    emitDecisionEvent({
      tool: toolName, decision: "REJECT", reason_code: verified.error || "ACT_INVALID",
      actor_id: actor || undefined, require_sct: true,
      sct_fingerprint: extraction.sources.length > 0
        ? `sha256:${crypto.createHash("sha256").update(extraction.token).digest("hex").slice(0, 16)}`
        : "",
      sct_source_count: extraction.source_count,
      sct_unique_tokens: extraction.unique_fingerprints,
      extraction_locations: extraction.sources.map(s => s.location),
    });
    return { ...verified, extraction };
  }
  emitDecisionEvent({
    tool: toolName, decision: "ALLOW", reason_code: "OK",
    actor_id: verified.actor || actor || undefined,
    require_sct: true,
    sct_fingerprint: `sha256:${crypto.createHash("sha256").update(extraction.token).digest("hex").slice(0, 16)}`,
    sct_source_count: extraction.source_count,
    sct_unique_tokens: extraction.unique_fingerprints,
    extraction_locations: extraction.sources.map(s => s.location),
  });
  return verified;
}

// ── PR4 Decision Event Emitter ────────────────────────────────────────────
// Writes structured ACT decision events to the same JSONL directory used by
// Python organs (GEOX, WELL, WEALTH, arifOS). Format matches
// AAA/governance/act_decision_event.py SctDecisionEvent schema v1.

interface DecisionEvent {
  schema: "act_decision_event.v1";
  schema_id: string;
  event_id: string;
  trace_id: string;
  ts: string;
  organ: string;
  tool: string;
  action_class: string;
  required_authority: string;
  require_sct: boolean;
  decision: "ALLOW" | "REJECT";
  reason_code: string;
  actor_id: string;
  sct_fingerprint: string;
  sct_source_count: number;
  sct_unique_tokens: number;
  registry_source: string;
  registry_known: boolean;
  extraction_locations: string[];
  meta: Record<string, unknown>;
}

function newEventId(): string {
  const hex = crypto.randomBytes(6).toString("hex");
  return `sde-${hex}`;
}

function newTraceId(): string {
  const hex = crypto.randomBytes(8).toString("hex");
  return `trc-${hex}`;
}

function emitDecisionEvent(opts: {
  tool: string;
  decision: "ALLOW" | "REJECT";
  reason_code: string;
  actor_id?: string;
  action_class?: string;
  require_sct?: boolean;
  sct_fingerprint?: string;
  sct_source_count?: number;
  sct_unique_tokens?: number;
  extraction_locations?: string[];
  trace_id?: string;
}): void {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const filePath = path.join(ACT_DECISION_EVENT_DIR, `act_decisions_${day}.jsonl`);
    fs.mkdirSync(ACT_DECISION_EVENT_DIR, { recursive: true });

    const event: DecisionEvent = {
      schema: "act_decision_event.v1",
      schema_id: "https://arif-fazil.com/schema/act_decision_event/v1",
      event_id: newEventId(),
      trace_id: opts.trace_id || newTraceId(),
      ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      organ: "aforge",
      tool: opts.tool,
      action_class: opts.action_class || "",
      required_authority: "",
      require_sct: opts.require_sct ?? false,
      decision: opts.decision,
      reason_code: opts.reason_code,
      actor_id: opts.actor_id || "anonymous",
      sct_fingerprint: opts.sct_fingerprint || "",
      sct_source_count: opts.sct_source_count ?? 0,
      sct_unique_tokens: opts.sct_unique_tokens ?? 0,
      registry_source: "actIngress.ts",
      registry_known: true,
      extraction_locations: opts.extraction_locations || [],
      meta: {},
    };

    const line = JSON.stringify(event, Object.keys(event).sort()) + "\n";
    fs.appendFileSync(filePath, line, "utf-8");
  } catch (_err) {
    // Fail-open for observability — never block the gate on log write failure
  }
}
