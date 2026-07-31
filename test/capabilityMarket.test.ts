/**
 * capabilityMarket.test.ts — P2.3 market + F13 seal gate.
 */
import test, { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { CapabilityMarket } from "../src/domain/forge/CapabilityMarket.js";

let market: CapabilityMarket;
before(() => { market = new CapabilityMarket(); });

const SEALED = {
  arifos_seal_id: "arifos-1",
  sla: { success_rate_min: 0.95, p95_latency_ms: 200, availability: 0.99 },
  price: { unit: "invocation" as const, value: 0.01, currency: "FLAME" as const },
  evidence: { total_invocations: 100, independent_verifier_passes: 5, capability_score: 0.9 },
};

describe("CapabilityMarket — publishOffer (F13 gate)", () => {
  it("refuses offer without arifos_seal_id", () => {
    const r = market.publishOffer({
      capability_id: "cap.test",
      issuer: "aforge",
      ...SEALED,
    } as never);
    assert.equal(r.ok, false);
    assert.match(r.error, /arifos_seal_id/);
  });
  it("accepts offer with arifos_seal_id", () => {
    const r = market.publishOffer({
      capability_id: "cap.test",
      issuer: "aforge",
      ...SEALED,
      arifos_seal_id: "arifos-1",
    });
    assert.equal(r.ok, true);
    assert.ok(r.offer.offer_id.startsWith("offer-"));
  });
});

describe("CapabilityMarket — match (best-fit)", () => {
  before(() => {
    market.publishOffer({
      capability_id: "cap.other",
      issuer: "peer",
      ...SEALED,
      arifos_seal_id: "arifos-2",
    });
    market.publishOffer({
      capability_id: "cap.test",
      issuer: "peer",
      ...SEALED,
      arifos_seal_id: "arifos-3",
      evidence: { total_invocations: 50, independent_verifier_passes: 3, capability_score: 0.7 },
    });
  });

  it("returns null when no offer matches capability_id", () => {
    assert.equal(market.match("cap.nonexistent"), null);
  });

  it("returns the highest-scored offer for a capability_id", () => {
    const m = market.match("cap.test");
    assert.ok(m);
    assert.equal(m?.capability_id, "cap.test");
    assert.ok((m?.evidence.capability_score ?? 0) >= 0.7);
  });
});

describe("CapabilityMarket — subscribe (translate to local lease)", () => {
  it("refuses when offer lacks arifos_seal_id", () => {
    const offer = market.publishOffer({
      capability_id: "cap.unsealed",
      issuer: "aforge",
      ...SEALED,
    });
    assert.equal(offer.ok, false);
  });
  it("returns a local lease for a sealed offer", () => {
    const o = market.publishOffer({
      capability_id: "cap.sealed",
      issuer: "aforge",
      ...SEALED,
      arifos_seal_id: "arifos-sealed",
    });
    assert.equal(o.ok, true);
    const sub = market.subscribe(
      { request_id: "r1", requester_actor: "a", capability_id: "cap.sealed", duration_ms: 60_000 },
      o.offer.offer_id,
    );
    assert.equal(sub.ok, true);
    assert.ok(sub.lease.lease_id.startsWith("lcl-"));
    assert.equal(sub.lease.arifos_seal_id, "arifos-sealed");
  });
  it("refuses mismatched capability_id", () => {
    const o = market.publishOffer({
      capability_id: "cap.lease",
      issuer: "aforge",
      ...SEALED,
      arifos_seal_id: "arifos-lease",
    });
    assert.equal(o.ok, true);
    const sub = market.subscribe(
      { request_id: "r", requester_actor: "a", capability_id: "cap.other", duration_ms: 1000 },
      o.offer.offer_id,
    );
    assert.equal(sub.ok, false);
    assert.match(sub.error, /is for cap.lease/);
  });
});

describe("CapabilityMarket — review (routes to EvidencePromotionGate)", () => {
  it("returns ok_to_propose=false when evidence is below thresholds", () => {
    const d = market.review("cap.test", {
      instantiation_count: 1,
      success_rate: 0.5,
      independent_verifier_passes: 0,
      verifier_methods: {},
      empirical_capability_score: 0.1,
      recent_receipts: [],
    });
    assert.equal(d.ok_to_propose, false);
  });
});
