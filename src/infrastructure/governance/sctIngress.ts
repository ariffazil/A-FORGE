/**
 * Federation SCT ingress gate for A-FORGE.
 *
 * Mirrors AAA governance/federation_sct.py:
 *   - Collect ALL SCT candidates from every source
 *   - Identical values → normalize to one token
 *   - Distinct values → SCT_AMBIGUOUS (reject, execute nothing)
 *   - Present token → verify via arifOS fail-closed
 *
 * DITEMPA BUKAN DIBERI — Tokens are forged, not assumed.
 */

const ARIFOS_BASE = process.env.ARIFOS_BASE_URL || "http://127.0.0.1:8088";
const SCT_TIMEOUT_MS = Number(process.env.ARIFOS_SCT_TIMEOUT_MS || "2500");
const SCT_RE = /^sct_v1\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/;

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
 * Collect ALL SCT candidates from args, nested _meta, explicit meta, and headers.
 * First-token-wins is FORBIDDEN — conflicts return AMBIGUOUS.
 */
export function extractSctFromCall(
  args: Record<string, unknown> | null | undefined,
  opts: {
    headers?: Record<string, string> | null;
    meta?: Record<string, unknown> | null;
  } = {},
): TokenExtraction {
  const sources: TokenSource[] = [];
  const unique = new Map<string, string>();

  const a = args && typeof args === "object" ? args : {};

  // 1. Direct argument keys
  for (const key of ["session_token", "sct", "arifos_sct"] as const) {
    const v = a[key];
    if (typeof v === "string" && v.trim()) {
      pushCandidate(sources, unique, v, `arguments.${key}`);
    }
  }

  // 2. Nested _meta in arguments
  const nested = a._meta;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    for (const key of ["sct", "session_token", "arifos_sct"] as const) {
      const v = m[key];
      if (typeof v === "string" && v.trim()) {
        pushCandidate(sources, unique, v, `arguments._meta.${key}`);
      }
    }
  }

  // 3. Explicit meta
  if (opts.meta && typeof opts.meta === "object") {
    for (const key of ["sct", "session_token", "arifos_sct"] as const) {
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
      if (token.startsWith("sct_v1.") || token.startsWith("arifos.v1.")) {
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
 * Prefer extractSctFromCall for conflict detection.
 * Returns null on ABSENT or AMBIGUOUS (never silently picks first).
 */
export function extractSctFromArgs(
  args: Record<string, unknown> | null | undefined,
): string | null {
  const ext = extractSctFromCall(args);
  if (ext.status === "PRESENT") return ext.token;
  return null;
}

function formatOk(sct: string): boolean {
  return sct.length >= 16 && SCT_RE.test(sct);
}

/**
 * Production startup invariant.
 * production + FORGE_SCT_REQUIRE_MUTATE=0 → FATAL (exit before bind).
 */
export function assertSctMutationGateOrExit(
  env: NodeJS.ProcessEnv = process.env,
): { required: boolean; enforced: boolean; bypass_profile: "none" | "dev" } {
  const isProduction =
    env.NODE_ENV === "production" ||
    env.AF_FORGE_ENV === "production" ||
    env.AF_PROFILE === "production";
  const raw = env.FORGE_SCT_REQUIRE_MUTATE;
  const bypass =
    raw === "0" || String(raw || "").toLowerCase() === "false";
  const enforced = !bypass;

  if (isProduction && bypass) {
    console.error(
      "[FATAL] FORGE_SCT_REQUIRE_MUTATE=0 is forbidden in production. " +
        "SCT mutation gate must be enforced (set FORGE_SCT_REQUIRE_MUTATE=1 or unset). " +
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

/** Health payload fragment for sct_mutation_gate (never exits). */
export function sctMutationGateHealth(
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
  const raw = env.FORGE_SCT_REQUIRE_MUTATE;
  const bypass = raw === "0" || String(raw || "").toLowerCase() === "false";
  if (isProduction && bypass) {
    // Health path must not exit mid-request if misconfigured at runtime —
    // report the violation instead. Startup uses assertSctMutationGateOrExit.
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
 * Verify SCT locally (no arifOS roundtrip).
 * sct_v1 tokens are JWT-like: sct_v1.<base64url_payload>.<signature>
 * P2.1 fix (2026-07-28): arifOS has no "validate" mode, so local
 * decode is the only reliable path. Decode payload, check expiry,
 * check authority rank. Returns ok:false on any failure.
 */
function verifyLocalSct(
  sct: string,
  opts: { expectedActor?: string | null; requiredAuthority?: string },
): SctGateResult | null {
  try {
    const parts = sct.split(".");
    if (parts.length < 2) return null;
    // Decode base64url payload (2nd segment)
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const claims = JSON.parse(payloadJson) as Record<string, unknown>;

    // Check expiry
    const exp = claims.exp as number | undefined;
    if (exp && Date.now() / 1000 > exp) {
      return { ok: false, error: "SCT_EXPIRED", message: `Token expired at ${new Date(exp * 1000).toISOString()}` };
    }

    const actor = String(claims.actor || claims.act || "");
    const authority = String(claims.auth || claims.authority || "OBSERVE_ONLY");
    const requiredAuthority = opts.requiredAuthority || "OBSERVE_ONLY";

    if (opts.expectedActor && actor && actor !== opts.expectedActor) {
      return { ok: false, error: "ACTOR_MISMATCH", message: `SCT actor ${actor} vs caller ${opts.expectedActor}` };
    }

    const RANK = ["OBSERVE_ONLY", "OPERATOR", "LIMITED_MUTATE", "FULL", "SOVEREIGN"];
    if (!RANK.includes(requiredAuthority) || !RANK.includes(authority)) {
      return { ok: false, error: "UNKNOWN_AUTHORITY", message: `${authority} / required ${requiredAuthority}` };
    }
    if (RANK.indexOf(authority) < RANK.indexOf(requiredAuthority)) {
      return { ok: false, error: "INSUFFICIENT_AUTHORITY", message: `SCT ${authority} < required ${requiredAuthority}` };
    }

    return { ok: true, actor, authority, claims };
  } catch {
    return null; // Can't decode — fall through to arifOS
  }
}

/**
 * Verify SCT — local decode first, arifOS roundtrip as fallback.
 * P2.1 fix (2026-07-28): primary path is local. arifOS has no "validate"
 * init mode; calling arif_init(mode="validate") falls through to mode="init"
 * which tries to create a new session — failing on every valid token.
 */
export async function verifyFederationSct(
  sct: string | null | undefined,
  opts: {
    expectedActor?: string | null;
    requiredAuthority?: string;
  } = {},
): Promise<SctGateResult> {
  const requiredAuthority = opts.requiredAuthority || "OBSERVE_ONLY";
  if (!sct) {
    return { ok: false, error: "SCT_MISSING", message: "No SCT provided" };
  }
  if (!formatOk(sct)) {
    return {
      ok: false,
      error: "SCT_MALFORMED",
      message: `SCT does not match sct_v1 shape: ${sct.slice(0, 24)}...`,
    };
  }

  // P2.1: Local decode is the primary path (no arifOS roundtrip needed)
  const local = verifyLocalSct(sct, opts);
  if (local) return local;

  // ── arifOS fallback (for legacy tokens or format drift) ────────────
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCT_TIMEOUT_MS);
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
        error: "SCT_INVALID",
        message: String(result.error || "arifOS rejected SCT"),
      };
    }
    const claims = (result.claims as Record<string, unknown>) || null;
    if (!claims || typeof claims !== "object") {
      return {
        ok: false,
        error: "SCT_CLAIMS_MISSING",
        message: "valid=true without claims — not an SCT receipt",
      };
    }
    const actor = String(claims.actor || claims.actor_id || "");
    const authority = String(claims.auth || claims.authority || "OBSERVE_ONLY");

    if (opts.expectedActor && actor && actor !== opts.expectedActor) {
      return {
        ok: false,
        error: "ACTOR_MISMATCH",
        message: `SCT actor ${actor} does not match caller ${opts.expectedActor}`,
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
        message: `SCT authority ${authority} < required ${requiredAuthority}`,
      };
    }

    return { ok: true, actor, authority, claims };
  } catch (err) {
    return {
      ok: false,
      error: "ARIFOS_UNREACHABLE",
      message: `arifOS unreachable (${err instanceof Error ? err.message : String(err)}); SCT rejected (fail-closed)`,
    };
  }
}

/**
 * Ingress gate for A-FORGE tool handlers.
 *
 * - Conflicting token sources → SCT_AMBIGUOUS (reject)
 * - SCT present → must verify (fail closed)
 * - requireSct=true and missing → SCT_REQUIRED
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
    /** Fallback SCT token derived from a validated session (P2.1 fix for SCT_GATE regression) */
    sessionFallbackToken?: string | null;
  } = {},
): Promise<SctGateResult | { ok: true; skipped: true }> {
  const extraction = extractSctFromCall(args, {
    headers: opts.headers,
    meta: opts.meta,
  });
  const actor =
    (typeof args.actor_id === "string" && args.actor_id) ||
    (typeof args.actor === "string" && args.actor) ||
    null;

  if (extraction.status === "AMBIGUOUS") {
    return {
      ok: false,
      error: "SCT_AMBIGUOUS",
      message:
        `Tool "${toolName}" received ${extraction.unique_fingerprints} distinct ` +
        `SCT tokens from ${extraction.source_count} sources. ` +
        `All sources must carry the same token. Execution refused.`,
      actor: actor || undefined,
      extraction,
    };
  }

  if (extraction.status === "ABSENT") {
    // P2.1 FIX (2026-07-27): SCT_GATE regression — when session_token isn't
    // explicitly passed but a validated session exists, use the session's
    // SCT as fallback. This restores the autonomous seal path broken when
    // arif_init OBSERVE_ONLY tokens stopped being forwarded to forge_vault.
    if (opts.sessionFallbackToken) {
      const verified = await verifyFederationSct(opts.sessionFallbackToken, {
        expectedActor: actor,
        requiredAuthority: opts.requiredAuthority || "OBSERVE_ONLY",
      });
      if (verified.ok) return verified;
      // Fallback failed — continue to normal SCT_REQUIRED path
    }
    if (opts.requireSct) {
      return {
        ok: false,
        error: "SCT_REQUIRED",
        message: `Tool "${toolName}" requires session_token (mint via arif_init)`,
        actor: actor || undefined,
        extraction,
      };
    }
    return { ok: true, skipped: true };
  }

  const verified = await verifyFederationSct(extraction.token, {
    expectedActor: actor,
    requiredAuthority: opts.requiredAuthority || "OBSERVE_ONLY",
  });
  if (!verified.ok) {
    return { ...verified, extraction };
  }
  return verified;
}
