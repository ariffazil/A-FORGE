/**
 * evidencePromotion.test.ts — Evidence-based promotion gate.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EvidencePromotionGate,
  loadDefaultThresholds,
} from "../src/domain/forge/EvidencePromotionGate.js";
import type { EvidencePromotionEvidence } from "../src/domain/forge/EvidencePromotionGate.js";

function baseEvidence(overrides: Partial<EvidencePromotionEvidence> = {}): EvidencePromotionEvidence {
  return {
    instantiation_count: 5,
    success_rate: 0.97,
    independent_verifier_passes: 3,
    verifier_methods: { domain_witness: 1, independent_recompute: 2 },
    empirical_capability_score: 0.85,
    recent_receipts: [],
    ...overrides,
  };
}

describe("EvidencePromotionGate — default thresholds", () => {
  it("matches the documented default table", () => {
    const t = loadDefaultThresholds();
    assert.equal(t.minInstances, 5);
    assert.equal(t.minSuccessRate, 0.95);
    assert.equal(t.minIndependentVerifierPasses, 3);
    assert.equal(t.minEmpiricalCapabilityScore, 0.8);
  });
});

describe("EvidencePromotionGate — happy path", () => {
  it("returns ok_to_propose=true when all gates pass", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate("t1", baseEvidence());
    assert.equal(proposal.ok_to_propose, true);
    assert.equal(proposal.failing_gates.length, 0);
    assert.match(proposal.next_step, /arif_judge/);
  });
});

describe("EvidencePromotionGate — failing gates", () => {
  it("blocks when instantiation_count below threshold", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate("t1", baseEvidence({ instantiation_count: 4 }));
    assert.equal(proposal.ok_to_propose, false);
    assert.ok(proposal.failing_gates.includes("minInstances"));
  });

  it("blocks when success_rate below threshold", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate("t1", baseEvidence({ success_rate: 0.5 }));
    assert.equal(proposal.ok_to_propose, false);
    assert.ok(proposal.failing_gates.includes("minSuccessRate"));
  });

  it("blocks when independent_verifier_passes below threshold", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate("t1", baseEvidence({ independent_verifier_passes: 2 }));
    assert.equal(proposal.ok_to_propose, false);
    assert.ok(proposal.failing_gates.includes("minIndependentVerifierPasses"));
  });

  it("blocks when empirical_capability_score below threshold", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate("t1", baseEvidence({ empirical_capability_score: 0.5 }));
    assert.equal(proposal.ok_to_propose, false);
    assert.ok(proposal.failing_gates.includes("minEmpiricalCapabilityScore"));
  });

  it("blocks when verifier_methods has no domain_witness or independent_recompute", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate(
      "t1",
      baseEvidence({ verifier_methods: { known_answer: 3 } }),
    );
    assert.equal(proposal.ok_to_propose, false);
    assert.ok(proposal.failing_gates.includes("minIndependentVerifierPasses"));
  });

  it("accepts known_answer + independent_recompute diversity", () => {
    const gate = new EvidencePromotionGate();
    const proposal = gate.evaluate(
      "t1",
      baseEvidence({ verifier_methods: { known_answer: 1, independent_recompute: 2 } }),
    );
    assert.equal(proposal.ok_to_propose, true);
  });
});

describe("EvidencePromotionGate — custom thresholds", () => {
  it("honours a custom threshold set", () => {
    const gate = new EvidencePromotionGate({
      minInstances: 100,
      minSuccessRate: 0.99,
      minIndependentVerifierPasses: 10,
      minEmpiricalCapabilityScore: 0.9,
    });
    const proposal = gate.evaluate("t1", baseEvidence());
    assert.equal(proposal.ok_to_propose, false);
    assert.equal(proposal.failing_gates.length, 4);
  });
});
