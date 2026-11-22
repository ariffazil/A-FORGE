/**
 * SSRF Guard Tests — src/infrastructure/egress/ssrfGuard.ts
 *
 * The guard is the single owner of outbound URL validation for A-FORGE.
 * These tests pin the three bypass classes it closes, all measured live on
 * 2026-11-22 by FI-003 (lane 333-AGI):
 *
 *  1. REDIRECT BYPASS — the guard used to validate only the caller's URL while
 *     the fetch ran with `redirect: "follow"`, so a `Location` header could aim
 *     the tool at an internal host. Every hop is now re-validated.
 *
 *  2. TAILNET BYPASS — the old `proxyTools.ts` guard matched the hostname STRING
 *     against a regex list. It never resolved DNS and did not cover
 *     100.64.0.0/10, the CGNAT range that IS the tailnet where every federation
 *     organ lives. `forge_fetch` returned the arifOS kernel's /health payload
 *     (70470 chars) from http://100.64.0.2:8088/health.
 *
 *  3. DNS-REBINDING TOCTOU — the old gatewayTools.ts guard resolved DNS to
 *     check for private addresses, then let `fetch` resolve DNS again. The
 *     address that was checked and the address that was connected to were not
 *     guaranteed to be the same.
 *
 * Forged 2026-11-23 by FI-003. DITEMPA BUKAN DIBERI.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  isPrivateOrReservedAddress,
  validatePublicUrl,
  guardedFetch,
  ipv4ToInt,
  MAX_REDIRECT_HOPS,
  type HostResolver,
} from "../src/infrastructure/egress/ssrfGuard.js";

/**
 * Hermetic resolver — no network. Any `.example` host resolves to a public
 * address; a host named `private.example` resolves to the tailnet address,
 * which is how the DNS-rebinding class is exercised.
 */
const hermeticResolver: HostResolver = async (hostname) => {
  if (hostname === "private.example") return ["100.64.0.2"];
  if (hostname === "mixed.example") return ["93.184.216.34", "100.64.0.2"];
  return ["93.184.216.34"];
};

// ── 1. Address classification ───────────────────────────────────────────────

describe("isPrivateOrReservedAddress", () => {
  it("classifies loopback, RFC1918, link-local, CGNAT/tailnet as private", () => {
    for (const ip of [
      "127.0.0.1",
      "127.255.255.254",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "100.64.0.2", // CGNAT — the tailnet
      "100.127.255.255",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      assert.equal(isPrivateOrReservedAddress(ip), true, `${ip} must be private`);
    }
  });

  it("classifies public addresses as public", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "100.128.0.1"]) {
      assert.equal(isPrivateOrReservedAddress(ip), false, `${ip} must be public`);
    }
  });

  it("classifies IPv6 loopback, ULA and link-local as private", () => {
    for (const ip of ["::1", "fc00::1", "fd00::1", "fe80::1"]) {
      assert.equal(isPrivateOrReservedAddress(ip), true, `${ip} must be private`);
    }
  });

  it("classifies public IPv6 as public", () => {
    assert.equal(isPrivateOrReservedAddress("2606:4700:10::6814:179a"), false);
  });

  it("treats an IPv4-mapped IPv6 address as its IPv4 value", () => {
    assert.equal(isPrivateOrReservedAddress("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateOrReservedAddress("::ffff:8.8.8.8"), false);
  });

  it("ipv4ToInt rejects malformed input", () => {
    assert.equal(ipv4ToInt("1.2.3"), null);
    assert.equal(ipv4ToInt("1.2.3.999"), null);
    assert.equal(ipv4ToInt("1.2.3.4"), 0x01020304);
  });
});

// ── 2. URL validation ───────────────────────────────────────────────────────

describe("validatePublicUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    const r = await validatePublicUrl("file:///etc/passwd");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /scheme/);
  });

  it("rejects a private IP literal", async () => {
    const r = await validatePublicUrl("http://127.0.0.1:7071/health");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /private|port/);
  });

  it("rejects the tailnet address that the old proxyTools guard let through", async () => {
    // This exact URL returned the arifOS kernel /health payload before the fix.
    const r = await validatePublicUrl("http://100.64.0.2:8088/health");
    assert.equal(r.ok, false);
  });

  it("rejects the tailnet address on an ALLOWED port, by address not by port", async () => {
    // Port 80 is permitted by policy, so only the address check can block this.
    const r = await validatePublicUrl("http://100.64.0.2/");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /private/);
  });

  it("rejects cloud metadata", async () => {
    const r = await validatePublicUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(r.ok, false);
  });

  it("rejects non-standard ports", async () => {
    const r = await validatePublicUrl("https://example.com:8443/");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /port/);
  });

  it("rejects malformed URLs", async () => {
    const r = await validatePublicUrl("not a url");
    assert.equal(r.ok, false);
  });

  it("allows a public https URL", async () => {
    const r = await validatePublicUrl("https://example.com/", hermeticResolver);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.addresses.length > 0, true);
      for (const a of r.addresses) {
        assert.equal(isPrivateOrReservedAddress(a), false, `${a} must be public`);
      }
    }
  });

  it("rejects a hostname that resolves to a private address (DNS-rebinding class)", async () => {
    const r = await validatePublicUrl("https://private.example/", hermeticResolver);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /private address/);
  });

  it("rejects a hostname that resolves to BOTH a public and a private address", async () => {
    const r = await validatePublicUrl("https://mixed.example/", hermeticResolver);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /private address/);
  });
});

// ── 3. Redirect re-validation (the primary bypass) ──────────────────────────

/** Minimal Response stand-in for the injected fetch. */
function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe("guardedFetch — redirect hops are re-validated", () => {
  it("follows a redirect to a PUBLIC host", async () => {
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url);
      if (url.includes("first")) return redirectResponse("https://second.example/second");
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver });
    assert.equal(result.response.status, 200);
    assert.equal(result.hops, 1);
    assert.deepEqual(seen, ["https://first.example/", "https://second.example/second"]);
  });

  it("BLOCKS a redirect whose target is a private host", async () => {
    const fake = (async (url: string) => {
      if (url.includes("first")) return redirectResponse("http://100.64.0.2:8088/health");
      return new Response("should never be reached", { status: 200 });
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver }),
      (err: any) => {
        assert.equal(err.code, "SSRF_BLOCKED");
        return true;
      },
    );
  });

  it("BLOCKS a redirect whose target is a loopback host", async () => {
    const fake = (async (url: string) => {
      if (url.includes("first")) return redirectResponse("http://127.0.0.1:8080/health");
      return new Response("should never be reached", { status: 200 });
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver }),
      (err: any) => err.code === "SSRF_BLOCKED",
    );
  });

  it("BLOCKS a redirect to a non-standard port", async () => {
    const fake = (async (url: string) => {
      if (url.includes("first")) return redirectResponse("https://second.example:8443/");
      return new Response("should never be reached", { status: 200 });
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver }),
      (err: any) => err.code === "SSRF_BLOCKED",
    );
  });

  it("stops after the hop limit instead of looping", async () => {
    const fake = (async (url: string) =>
      redirectResponse("https://second.example/loop")) as unknown as typeof fetch;

    await assert.rejects(
      () => guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver }),
      (err: any) => {
        assert.equal(err.code, "SSRF_BLOCKED");
        assert.match(err.message, /too many redirects/);
        return true;
      },
    );
    assert.equal(MAX_REDIRECT_HOPS, 5);
  });

  it("does not follow a redirect when the target is already private on the FIRST hop", async () => {
    // The caller's own URL is private — blocked before any request is made.
    let called = false;
    const fake = (async () => {
      called = true;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => guardedFetch("http://169.254.169.254/latest/", { fetchImpl: fake, resolver: hermeticResolver }),
      (err: any) => err.code === "SSRF_BLOCKED",
    );
    assert.equal(called, false, "no request may be issued for a blocked URL");
  });

  it("resolves a relative redirect against the current URL", async () => {
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url);
      // Redirect only on the FIRST request; the resolved target must return 200.
      if (url === "https://first.example/") return redirectResponse("/second");
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await guardedFetch("https://first.example/", { fetchImpl: fake, resolver: hermeticResolver });
    assert.equal(result.hops, 1);
    assert.deepEqual(seen, ["https://first.example/", "https://first.example/second"]);
  });
});
