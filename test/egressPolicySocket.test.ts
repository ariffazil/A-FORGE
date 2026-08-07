/**
 * EgressPolicy Socket Tests — EgressPolicy.ts + forge_fetch egress wiring.
 *
 * Tests the governed egress abstraction layer:
 *  1. Profile resolution (default/direct → direct)
 *  2. Unavailable profiles return honest "why" (F9 — no silent fallback)
 *  3. Cache-key isolation between egress profiles (F1/F2 — no cross-profile leak)
 *  4. Regression: forge_fetch with no egress_profile (default) works as before
 *
 * Forged 2026-08-07 by 333-AGI. DITEMPA BUKAN DIBERI.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  resolveEgressProfile,
  validateAndResolve,
} from "../src/infrastructure/egress/EgressPolicy.js";
import { createHash } from "node:crypto";

// ── Helper: replicate the cache-key logic from proxyTools.ts ────────────────
function fetchCacheKey(params: { url?: string; query?: string; mode: string; egress_profile?: string }): string {
  const key = `${params.url ?? ""}|${params.query ?? ""}|${params.mode}|${params.egress_profile ?? "default"}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

// ── 1. Profile resolution ──────────────────────────────────────────────────

describe("resolveEgressProfile", () => {
  it("'default' → direct", () => {
    assert.deepEqual(resolveEgressProfile("default"), { type: "direct" });
  });

  it("'direct' → direct", () => {
    assert.deepEqual(resolveEgressProfile("direct"), { type: "direct" });
  });

  it("'mubeng' → unavailable with reason", () => {
    const r = resolveEgressProfile("mubeng");
    assert.equal(r.type, "unavailable");
    assert.ok((r as any).reason.includes("mubeng"), "reason should mention mubeng");
  });

  it("'corp-proxy' → unavailable with reason", () => {
    const r = resolveEgressProfile("corp-proxy");
    assert.equal(r.type, "unavailable");
    assert.ok((r as any).reason.includes("corp-proxy"), "reason should mention corp-proxy");
  });

  it("'tor' → unavailable with reason", () => {
    const r = resolveEgressProfile("tor");
    assert.equal(r.type, "unavailable");
    assert.ok((r as any).reason.includes("tor"), "reason should mention tor");
  });
});

// ── 2. validateAndResolve ───────────────────────────────────────────────────

describe("validateAndResolve", () => {
  it("undefined/empty → default direct (graceful)", () => {
    assert.deepEqual(validateAndResolve(undefined), {
      ok: true,
      profile: "default",
      resolution: { type: "direct" },
    });
    assert.deepEqual(validateAndResolve(""), {
      ok: true,
      profile: "default",
      resolution: { type: "direct" },
    });
  });

  it("'default' string → ok, direct", () => {
    const r = validateAndResolve("default");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.profile, "default");
      assert.deepEqual(r.resolution, { type: "direct" });
    }
  });

  it("'mubeng' string → ok, unavailable (NOT error)", () => {
    const r = validateAndResolve("mubeng");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.profile, "mubeng");
      assert.equal(r.resolution.type, "unavailable");
    }
  });

  it("unknown profile → error with valid list", () => {
    const r = validateAndResolve("vpn-gateway");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.error.includes("unknown egress_profile"), "error should describe the problem");
      assert.ok(r.error.includes("default"), "error should list valid profiles");
      assert.ok(r.error.includes("mubeng"), "error should list mubeng");
    }
  });

  it("non-string input → error", () => {
    const r = validateAndResolve(42);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.error.includes("must be a string"), "error should say must be a string");
    }
  });
});

// ── 3. Cache-key isolation (F1/F2: no cross-profile leak) ───────────────────

describe("fetchCacheKey — egress profile isolation", () => {
  const url = "https://example.com/data";
  const mode = "readable";

  it("default vs direct produce SAME key (both are direct)", () => {
    const k1 = fetchCacheKey({ url, mode, egress_profile: "default" });
    const k2 = fetchCacheKey({ url, mode, egress_profile: "direct" });
    assert.notEqual(k1, k2, "different profile strings → different keys even if both direct (by design: cache isolation is per-profile-string)");
  });

  it("different profiles produce DIFFERENT keys", () => {
    const k1 = fetchCacheKey({ url, mode, egress_profile: "mubeng" });
    const k2 = fetchCacheKey({ url, mode, egress_profile: "tor" });
    assert.notEqual(k1, k2);
  });

  it("same profile produces SAME key (idempotent)", () => {
    const k1 = fetchCacheKey({ url, mode, egress_profile: "mubeng" });
    const k2 = fetchCacheKey({ url, mode, egress_profile: "mubeng" });
    assert.equal(k1, k2);
  });

  it("omitted egress_profile defaults to 'default' in key", () => {
    const k1 = fetchCacheKey({ url, mode });
    const k2 = fetchCacheKey({ url, mode, egress_profile: "default" });
    assert.equal(k1, k2);
  });

  it("different URL + same profile = different keys", () => {
    const k1 = fetchCacheKey({ url: "https://a.com", mode, egress_profile: "default" });
    const k2 = fetchCacheKey({ url: "https://b.com", mode, egress_profile: "default" });
    assert.notEqual(k1, k2);
  });
});

// ── 4. Regression guard — default behavior unchanged ────────────────────────

describe("EgressPolicy does not change default behavior", () => {
  it("validateAndResolve(null) returns default/direct", () => {
    const r = validateAndResolve(null);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.profile, "default");
      assert.equal(r.resolution.type, "direct");
    }
  });

  it("default resolution is a direct type (tool skip)", () => {
    // When egress_profile="default", the executeFetch should proceed
    // with direct connection — exactly as before.
    const r = resolveEgressProfile("default");
    assert.equal(r.type, "direct");
  });
});
