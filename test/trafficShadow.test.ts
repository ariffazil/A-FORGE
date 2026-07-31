/**
 * trafficShadow.test.ts — P2.1 deterministic canary routing.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrafficShadow, shouldSample, type ShadowPolicy } from "../src/domain/cognition/TrafficShadow.js";

function makePolicy(overrides: Partial<ShadowPolicy> = {}): ShadowPolicy {
  return {
    capability_id: "cap.test",
    tier: "canary",
    shadow: { sample_rate: 0.0, compare_to: "primary", record_diffs: false },
    canary: { traffic_fraction: 0.5, max_failures: 2, window_minutes: 60 },
    rollback: { trigger: "fail_rate", threshold: 0.1 },
    arifos_seal_id: "arifos-1",
    ...overrides,
  };
}

describe("shouldSample — deterministic", () => {
  it("returns false when sample_rate=0", () => {
    assert.equal(shouldSample("c", "r1", 0), false);
  });
  it("returns true when sample_rate=1", () => {
    assert.equal(shouldSample("c", "r1", 1), true);
  });
  it("is deterministic for the same inputs", () => {
    const a = shouldSample("cap.test", "req-7", 0.5);
    const b = shouldSample("cap.test", "req-7", 0.5);
    assert.equal(a, b);
  });
});

describe("TrafficShadow — canaryTraffic", () => {
  it("does not sample shadow tier", () => {
    const ts = new TrafficShadow(makePolicy({ tier: "shadow" }));
    assert.equal(ts.canaryTraffic("req-1"), false);
  });
  it("samples canary tier", () => {
    const ts = new TrafficShadow(makePolicy({ tier: "canary", canary: { traffic_fraction: 1, max_failures: 0, window_minutes: 60 } }));
    assert.equal(ts.canaryTraffic("req-1"), true);
  });
});

describe("TrafficShadow — shouldRollback", () => {
  const NOW = 1_700_000_000_000;
  const FIVE_MIN = 5 * 60_000;
  it("does not rollback when window is empty", () => {
    const ts = new TrafficShadow(makePolicy(), { clock: () => NOW });
    const d = ts.shouldRollback(NOW);
    assert.equal(d.should_rollback, false);
    assert.equal(d.window_samples, 0);
  });
  it("does not rollback when fail_rate below threshold", () => {
    const ts = new TrafficShadow(makePolicy(), { clock: () => NOW });
    for (let i = 0; i < 10; i += 1) ts.record({ ok: true, wallTimeMs: 100 }, { ok: true, wallTimeMs: 110 });
    const d = ts.shouldRollback(NOW + FIVE_MIN);
    assert.equal(d.should_rollback, false);
  });
  it("rolls back when fail_rate above threshold", () => {
    const ts = new TrafficShadow(makePolicy({ rollback: { trigger: "fail_rate", threshold: 0.2 } }), { clock: () => NOW });
    for (let i = 0; i < 3; i += 1) ts.record({ ok: false, wallTimeMs: 100 });
    for (let i = 0; i < 7; i += 1) ts.record({ ok: true, wallTimeMs: 100 });
    const d = ts.shouldRollback(NOW + FIVE_MIN);
    assert.equal(d.should_rollback, true);
    assert.match(d.reason, /fail_rate/);
  });
});

describe("TrafficShadow — promotion gate", () => {
  it("canPromoteToCanary requires arifos_seal_id when tier is canary", () => {
    assert.equal(TrafficShadow.canPromoteToCanary(makePolicy()), true);
    assert.equal(TrafficShadow.canPromoteToCanary(makePolicy({ arifos_seal_id: undefined })), false);
  });
  it("canPromoteToCanary is permissive for non-canary tiers", () => {
    assert.equal(TrafficShadow.canPromoteToCanary(makePolicy({ tier: "shadow" })), true);
  });
});
