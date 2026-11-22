/**
 * SSRF Guard — the single owner of outbound URL validation for A-FORGE.
 *
 * WHY THIS EXISTS (measured 2026-11-22 by FI-003, lane 333-AGI):
 *
 * Two independent guards used to protect caller-supplied URLs, with different
 * semantics and different bypasses:
 *
 *   1. `ssrfGuard` in interfaces/mcp/gatewayTools.ts — resolved DNS, checked
 *      private CIDRs, and restricted ports to 80/443. But it validated only the
 *      URL the caller supplied; the fetch then ran with `redirect: "follow"`, so
 *      the server's `Location` header was never re-validated. A redirector could
 *      aim the tool at an internal host.
 *
 *   2. `ssrfCheck` in interfaces/mcp/proxyTools.ts — matched the hostname
 *      STRING against a regex list. It never resolved DNS, so any hostname that
 *      resolved to a private address passed. It also did not cover the CGNAT
 *      range 100.64.0.0/10 — the tailnet — where every federation organ lives.
 *      Measured live: `forge_fetch` returned the arifOS kernel's /health payload
 *      (70470 chars) from http://100.64.0.2:8088/health.
 *
 *   3. The SearxNG branch of `forge_fetch` took the CALLER's `url` as the
 *      internal search base and fetched it with no SSRF check at all.
 *
 * This module replaces all three with one rule, enforced on the destination
 * that is actually contacted:
 *
 *   A caller-supplied URL may only reach a PUBLIC address, on port 80/443, and
 *   every redirect hop is re-validated against the same rule.
 *
 * Sanctioned internal services (the self-hosted SearxNG) are NOT reachable by
 * caller-supplied URL at all — they are reached through a config-owned base URL
 * (see interfaces/mcp/proxyTools.ts). A private address is therefore never a
 * legal destination for a caller-supplied URL, on any port.
 *
 * @constitutional F12 INJECTION — a caller must not pivot the actuator at internals
 * @constitutional F2 TRUTH — the check and the connection must agree on the target
 */

import { lookup as dnsLookup } from "node:dns/promises";

// ── Destination policy ───────────────────────────────────────────────────────

/** Ports a caller-supplied URL may reach. Non-standard ports are for sanctioned
 *  internal services, which are reached by config-owned base URL, not by caller URL. */
export const ALLOWED_PORTS: ReadonlySet<number> = new Set([80, 443]);

/** Maximum redirect hops to follow. Each hop is re-validated. */
export const MAX_REDIRECT_HOPS = 5;

/** Hostnames that are never a legal destination, whatever they resolve to. */
const BLOCKED_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "localhost.",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.google.internal.",
  "metadata.azure.internal",
  "169.254.169.254",
  "metadata",
]);

/** IPv4 ranges that are not public. [network, mask] as 32-bit ints. */
const PRIVATE_IPV4: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0xff000000], // 0.0.0.0/8   "this network"
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x64400000, 0xffc00000], // 100.64.0.0/10  CGNAT — the tailnet
  [0x7f000000, 0xff000000], // 127.0.0.0/8  loopback
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 link-local + cloud metadata
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0xc6120000, 0xfffe0000], // 198.18.0.0/15 benchmark
  [0xe0000000, 0xf0000000], // 224.0.0.0/4  multicast
  [0xf0000000, 0xf0000000], // 240.0.0.0/4  reserved (incl. 255.255.255.255)
];

/**
 * IPv6 ranges that are not public. [prefixBits, networkAs128BitInt].
 *
 * The network value is the full 128-bit address with the host bits cleared,
 * so the comparison `(v >> shift) === (net >> shift)` is exact.
 */
const PRIVATE_IPV6: ReadonlyArray<readonly [number, bigint]> = [
  [128, 0n], // ::/128  unspecified
  [128, 1n], // ::1/128 loopback
  [10, 0xfe80n << 112n], // fe80::/10 link-local
  [7, 0xfc00n << 112n], // fc00::/7 unique local
  [8, 0xff00n << 112n], // ff00::/8 multicast
];

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  // Strip zone id and brackets, expand :: shorthand.
  let s = ip.split("%")[0].replace(/^\[|\]$/g, "");
  if (!s.includes(":")) return null;
  if (s.includes(":::")) return null;

  // An IPv6 address may embed a dotted-quad in its last 32 bits, e.g.
  // "::ffff:127.0.0.1". Convert that tail to two hex groups first.
  if (s.includes(".")) {
    const lastColon = s.lastIndexOf(":");
    if (lastColon < 0) return null;
    const v4 = ipv4ToInt(s.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const head = s.split("::");
  if (head.length > 2) return null;
  const left = head[0] ? head[0].split(":") : [];
  const right = head.length === 2 ? (head[1] ? head[1].split(":") : []) : [];
  const leftCount = left.filter((g) => g !== "").length;
  const rightCount = right.filter((g) => g !== "").length;
  const missing = 8 - leftCount - rightCount;
  if (head.length === 2 && missing < 0) return null;
  const groups: string[] =
    head.length === 2
      ? [...left.filter(Boolean), ...Array(Math.max(missing, 0)).fill("0"), ...right.filter(Boolean)]
      : left.filter(Boolean);
  if (groups.length !== 8) return null;
  let v = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    v = (v << 16n) | BigInt(parseInt(g, 16));
  }
  return v;
}

/** True when the address is loopback, private, link-local, CGNAT/tailnet, multicast or reserved. */
export function isPrivateOrReservedAddress(ip: string): boolean {
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) {
    return PRIVATE_IPV4.some(([net, mask]) => (v4 & mask) === (net & mask));
  }
  const v6 = ipv6ToBigInt(ip);
  if (v6 !== null) {
    // IPv4-mapped (::ffff:a.b.c.d) is judged as IPv4.
    if ((v6 >> 32n) === 0xffffn) {
      const mapped = Number(v6 & 0xffffffffn);
      return PRIVATE_IPV4.some(([net, mask]) => (mapped & mask) === (net & mask));
    }
    return PRIVATE_IPV6.some(([bits, net]) => {
      const shift = 128n - BigInt(bits);
      return (v6 >> shift) === (net >> shift);
    });
  }
  return false;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface UrlValidationOk {
  ok: true;
  /** The URL as it will be requested. */
  url: string;
  /** Every address the hostname resolved to. All of them were judged public. */
  addresses: string[];
}

export interface UrlValidationBlocked {
  ok: false;
  error: string;
}

export type UrlValidation = UrlValidationOk | UrlValidationBlocked;

/** Resolves a hostname to its addresses. Injectable so tests are hermetic. */
export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
  return resolved.map((r) => r.address);
};

function blocked(error: string): UrlValidationBlocked {
  return { ok: false, error: `SSRF_BLOCKED: ${error}` };
}

/**
 * Validate a caller-supplied URL against the destination policy.
 *
 * Checks, in order: scheme, hostname literal, port, then EVERY address the
 * hostname resolves to. A hostname that resolves to any private address is
 * rejected — including one that resolves to both a public and a private
 * address.
 */
export async function validatePublicUrl(rawUrl: string, resolver: HostResolver = defaultResolver): Promise<UrlValidation> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return blocked(`invalid URL '${rawUrl}'`);
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return blocked(`scheme '${u.protocol}' not allowed (only http/https)`);
  }

  const hostname = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) return blocked("URL has no hostname");
  if (BLOCKED_HOSTS.has(hostname)) {
    return blocked(`host '${hostname}' is blocked`);
  }

  const port = u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return blocked(`port ${port} not allowed (only ${[...ALLOWED_PORTS].join("/")})`);
  }

  // IP literal — judge the address directly, no DNS involved.
  const literal = ipv4ToInt(hostname) !== null ? hostname : ipv6ToBigInt(hostname) !== null ? hostname : null;
  if (literal !== null) {
    if (isPrivateOrReservedAddress(literal)) {
      return blocked(`address '${literal}' is private/reserved`);
    }
    return { ok: true, url: u.toString(), addresses: [literal] };
  }

  // Hostname — resolve, and require EVERY answer to be public.
  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return blocked(`host '${hostname}' could not be resolved`);
  }
  if (addresses.length === 0) {
    return blocked(`host '${hostname}' resolved to no addresses`);
  }
  for (const addr of addresses) {
    if (isPrivateOrReservedAddress(addr)) {
      return blocked(`host '${hostname}' resolves to private address ${addr}`);
    }
  }
  return { ok: true, url: u.toString(), addresses };
}

// ── Guarded fetch ────────────────────────────────────────────────────────────

export interface GuardedFetchResult {
  response: Response;
  /** The URL actually served, after redirects. */
  finalUrl: string;
  /** Number of redirects followed. */
  hops: number;
}

export interface GuardedFetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  /** Injected for tests — keeps the suite hermetic (no network). */
  resolver?: HostResolver;
}

/**
 * Fetch a caller-supplied URL, validating the destination of every hop.
 *
 * Redirects are followed manually (`redirect: "manual"`) so that each
 * `Location` target is re-validated against the same policy before it is
 * requested. A redirect to a private address is blocked, not followed.
 */
export async function guardedFetch(
  rawUrl: string,
  opts: GuardedFetchOptions = {},
): Promise<GuardedFetchResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const resolver = opts.resolver ?? defaultResolver;
  let current = rawUrl;
  let hops = 0;

  for (;;) {
    const validation = await validatePublicUrl(current, resolver);
    if (!validation.ok) {
      throw Object.assign(new Error(validation.error), { code: "SSRF_BLOCKED" });
    }

    const response = await doFetch(validation.url, {
      headers: opts.headers,
      signal: opts.signal,
      redirect: "manual",
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");
    if (!isRedirect || !location) {
      return { response, finalUrl: validation.url, hops };
    }

    hops += 1;
    if (hops > MAX_REDIRECT_HOPS) {
      throw Object.assign(new Error(`SSRF_BLOCKED: too many redirects (>${MAX_REDIRECT_HOPS})`), {
        code: "SSRF_BLOCKED",
      });
    }

    // Resolve the Location against the current URL, then re-validate it.
    let next: string;
    try {
      next = new URL(location, validation.url).toString();
    } catch {
      throw Object.assign(new Error(`SSRF_BLOCKED: invalid redirect target '${location}'`), {
        code: "SSRF_BLOCKED",
      });
    }
    current = next;
  }
}
