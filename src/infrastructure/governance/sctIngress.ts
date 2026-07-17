/**
 * Federation SCT ingress gate for A-FORGE.
 *
 * Mirrors AAA governance/federation_sct.py over HTTP to arifOS
 * arif_init(mode=validate). Fail-closed when a token is present.
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
    };

export function extractSctFromArgs(args: Record<string, unknown> | null | undefined): string | null {
  if (!args || typeof args !== "object") return null;
  for (const key of ["session_token", "sct", "arifos_sct"] as const) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const meta = args._meta;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    for (const key of ["sct", "session_token", "arifos_sct"] as const) {
      const v = m[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function formatOk(sct: string): boolean {
  return sct.length >= 16 && SCT_RE.test(sct);
}

/**
 * Verify SCT via live arifOS. Returns ok:false on any failure (fail-closed).
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
            mode: "validate",
            session_id: sct,
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

    // Unwrap MCP content envelope
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
 * - SCT present → must verify (fail closed)
 * - requireSct=true and missing → SCT_REQUIRED
 * - otherwise allow (backward-compatible)
 */
export async function gateToolIngress(
  toolName: string,
  args: Record<string, unknown>,
  opts: { requireSct?: boolean; requiredAuthority?: string } = {},
): Promise<SctGateResult | { ok: true; skipped: true }> {
  const sct = extractSctFromArgs(args);
  const actor =
    (typeof args.actor_id === "string" && args.actor_id) ||
    (typeof args.actor === "string" && args.actor) ||
    null;

  if (!sct) {
    if (opts.requireSct) {
      return {
        ok: false,
        error: "SCT_REQUIRED",
        message: `Tool "${toolName}" requires session_token (mint via arif_init)`,
        actor: actor || undefined,
      };
    }
    return { ok: true, skipped: true };
  }

  return verifyFederationSct(sct, {
    expectedActor: actor,
    requiredAuthority: opts.requiredAuthority || "OBSERVE_ONLY",
  });
}
