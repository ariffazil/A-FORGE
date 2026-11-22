/**
 * EgressPolicy — Governed egress abstraction layer for A-FORGE.
 *
 * Provides a profile-based resolver for outbound HTTP egress. Tools declare
 * `egress_profile` and the resolver returns the execution mode. Future
 * actuators (mubeng, corp-proxy, tor) plug in by adding resolver branches —
 * no tool-schema changes, no agent-visible changes.
 *
 * SOCKET-FIRST: This is the interface. Actuators attach to it later.
 *
 * Forged 2026-08-07 by 333-AGI under Arif directive "forge the socket first."
 * DITEMPA BUKAN DIBERI.
 */

// ── Profile type ────────────────────────────────────────────────────────────
export type EgressProfileName = "default" | "direct" | "mubeng" | "corp-proxy" | "tor";

// ── Resolver result types ───────────────────────────────────────────────────
export interface EgressDirect {
  type: "direct";
}

export interface EgressProxy {
  type: "proxy";
  uri: string;
  proxy_id: string;
}

export interface EgressUnavailable {
  type: "unavailable";
  reason: string;
}

export type EgressResolution = EgressDirect | EgressProxy | EgressUnavailable;

// ── Resolver interface ──────────────────────────────────────────────────────
export interface EgressResolver {
  (profile: EgressProfileName): EgressResolution;
}

// ── Profile registry ────────────────────────────────────────────────────────
// Only "default" and "direct" resolve to direct today.
// Future profiles exist in the registry but return "unavailable" — honest,
// never silent fallback (F9 ANTI-HANTU).

const PROFILE_REGISTRY: ReadonlySet<EgressProfileName> = new Set([
  "default",
  "direct",
  "mubeng",
  "corp-proxy",
  "tor",
]);

function isKnownProfile(name: string): name is EgressProfileName {
  return PROFILE_REGISTRY.has(name as EgressProfileName);
}

// ── Sanctioned internal services ─────────────────────────────────────────────
// Internal services are reached by a CONFIG-OWNED base URL, never by a
// caller-supplied URL. The caller cannot choose the destination, so no SSRF
// decision is needed on this path — and none is granted to the caller.
//
// This is the single owner of the canonical SearxNG base. Two files previously
// declared it with DIFFERENT defaults (gatewayTools.ts: "http://127.0.0.1:8080",
// proxyTools.ts: "http://localhost:8080") — one owner, one value.
export function canonicalSearxngBase(): string {
  return (process.env.SEARXNG_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
}

// ── Resolver implementation ─────────────────────────────────────────────────
export function resolveEgressProfile(profile: EgressProfileName): EgressResolution {
  switch (profile) {
    case "default":
    case "direct":
      return { type: "direct" };
    case "mubeng":
      return {
        type: "unavailable",
        reason:
          "egress profile 'mubeng' not yet configured. Mubeng is a Go proxy rotator (github.com/mubeng/mubeng) — a future actuator. The egress socket is forged; the actuator awaits first concrete need (429/datacenter ban).",
      };
    case "corp-proxy":
      return {
        type: "unavailable",
        reason: "egress profile 'corp-proxy' not yet configured. Intended for corporate/residential proxy pools (paid, signed). Pool file + validation not yet deployed.",
      };
    case "tor":
      return {
        type: "unavailable",
        reason: "egress profile 'tor' not yet configured. Intended for high-anonymity egress via Tor SOCKS proxy. Not yet audited for F12 injection surface.",
      };
    default:
      return { type: "unavailable", reason: `unknown egress profile '${profile}'` };
  }
}

// ── Guard: validate + resolve in one call ───────────────────────────────────
export function validateAndResolve(raw: unknown): {
  ok: true;
  profile: EgressProfileName;
  resolution: EgressResolution;
} | {
  ok: false;
  error: string;
} {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, profile: "default", resolution: { type: "direct" } };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `egress_profile must be a string, got ${typeof raw}` };
  }
  if (!isKnownProfile(raw)) {
    return {
      ok: false,
      error: `unknown egress_profile '${raw}'. Valid profiles: ${[...PROFILE_REGISTRY].join(", ")}`,
    };
  }
  const profile = raw as EgressProfileName;
  return { ok: true, profile, resolution: resolveEgressProfile(profile) };
}
