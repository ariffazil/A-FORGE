/**
 * generalizationGate.test.ts — the gate must REFUSE, not merely exist.
 *
 * Sabotage discipline: every "blocked" case would be promoted by the legacy
 * evidence gate (counts + success_rate measured on the same traces), so these
 * tests fail if the generalization dimension is removed.
 *
 * Reference for the paper-shaped fixture: arXiv:2610.30499 (Lehmann & Vahdati,
 * 21 Oct 2026) — 27 lineages, two revisions, held-out RHAE +2.80 points with
 * 95% interval [-1.44, 7.35]. The fixture reproduces that SHAPE (mean +0.028,
 * interval straddling zero); it is NOT the paper's raw per-item data, which the
 * abstract does not publish.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGeneralization,
  loadDefaultGeneralizationThresholds,
  unmeasuredAssessment,
} from "../src/domain/governance/GeneralizationGate.js";
import type { GeneralizationEvidence } from "../src/domain/governance/GeneralizationGate.js";

function series(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value);
}

function alternating(n: number, a: number, b: number): number[] {
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));
}

const PREREG = "a".repeat(64);

function evidence(overrides: Partial<GeneralizationEvidence> = {}): GeneralizationEvidence {
  return {
    dev_scores_before: series(20, 0.5),
    dev_scores_after: series(20, 0.62),
    heldout_scores_before: series(20, 0.5),
    heldout_scores_after: alternating(20, 0.59, 0.61),
    preregistration_sha256: PREREG,
    heldout_provenance: "HOLDOUT/BBB/actorhood_v2.1.json sha256:deadbeef decontam:ok",
    ...overrides,
  };
}

describe("GeneralizationGate — promotion is earned, not assumed", () => {
  it("GENERALIZES when held-out improvement clears the CI floor and dev is not inflated", () => {
    const a = evaluateGeneralization(evidence());
    assert.equal(a.verdict, "GENERALIZES");
    assert.equal(a.promotable, true);
    assert.ok(a.dev_delta !== null && a.dev_delta > 0.11 && a.dev_delta < 0.13);
    assert.ok(a.heldout_delta !== null && a.heldout_delta > 0.09 && a.heldout_delta < 0.11);
    assert.ok(a.heldout_ci !== null && a.heldout_ci[0] > 0);
  });

  it("refuses a dev-inflated revision as OVERFIT (sabotage case)", () => {
    const a = evaluateGeneralization(
      evidence({
        dev_scores_after: series(20, 0.9),        // ΔJ_dev = +0.40
        heldout_scores_after: series(20, 0.45),   // ΔJ_test = -0.05
      }),
    );
    assert.equal(a.verdict, "OVERFIT");
    assert.equal(a.promotable, false);
    assert.ok(a.gap !== null && a.gap > 0.4);
    assert.match(a.reasons.join(" "), /overstate/i);
  });

  it("returns UNPROVEN for the paper's headline shape: +2.80 points, interval straddling zero", () => {
    // mean(+0.12 x10, -0.064 x10) = +0.028 ; SE ≈ 0.021 → 95% interval ≈ [-0.013, +0.069]
    const a = evaluateGeneralization(
      evidence({
        dev_scores_after: series(20, 0.528),
        heldout_scores_after: [...series(10, 0.62), ...series(10, 0.436)],
      }),
    );
    assert.equal(a.verdict, "UNPROVEN");
    assert.equal(a.promotable, false);
    assert.ok(a.heldout_delta !== null && Math.abs(a.heldout_delta - 0.028) < 1e-9);
    assert.ok(a.heldout_ci !== null && a.heldout_ci[0] <= 0 && a.heldout_ci[1] > 0);
  });

  it("calls a lost capability REGRESSION when dev is flat", () => {
    const a = evaluateGeneralization(
      evidence({
        dev_scores_after: series(20, 0.52),
        heldout_scores_after: series(20, 0.45),
      }),
    );
    assert.equal(a.verdict, "REGRESSION");
    assert.equal(a.promotable, false);
  });

  it("flags a cheaper-but-not-better revision as COST_CUT_REGRESSION", () => {
    const a = evaluateGeneralization(
      evidence({
        dev_scores_after: series(20, 0.6),
        heldout_scores_after: series(20, 0.5), // ΔJ_test = 0
        run_cost_before: 1.0,
        run_cost_after: 0.4,                   // 60% cheaper
      }),
    );
    assert.equal(a.verdict, "COST_CUT_REGRESSION");
    assert.equal(a.promotable, false);
    assert.ok(a.cost !== null && a.cost.run_reduction_fraction === 0.6);
  });
});

describe("GeneralizationGate — fail-closed", () => {
  it("UNMEASURED when the revision has no pre-registration (HOLDOUT R7)", () => {
    const a = evaluateGeneralization(evidence({ preregistration_sha256: undefined }));
    assert.equal(a.verdict, "UNMEASURED");
    assert.equal(a.promotable, false);
    assert.match(a.reasons.join(" "), /pre-registration/i);
  });

  it("UNMEASURED when the held-out set has no provenance (HOLDOUT R8)", () => {
    const a = evaluateGeneralization(evidence({ heldout_provenance: undefined }));
    assert.equal(a.verdict, "UNMEASURED");
    assert.equal(a.promotable, false);
  });

  it("UNMEASURED when a non-hex pre-registration string is supplied", () => {
    const a = evaluateGeneralization(evidence({ preregistration_sha256: "true" }));
    assert.equal(a.verdict, "UNMEASURED");
    assert.equal(a.promotable, false);
  });

  it("UNMEASURED when dev and held-out arrays are unpaired", () => {
    const a = evaluateGeneralization(evidence({ heldout_scores_after: series(19, 0.6) }));
    assert.equal(a.verdict, "UNMEASURED");
    assert.equal(a.promotable, false);
  });

  it("UNPROVEN when there are too few held-out items to form an interval", () => {
    const a = evaluateGeneralization(
      evidence({
        heldout_scores_before: series(4, 0.5),
        heldout_scores_after: series(4, 0.8),
      }),
    );
    assert.equal(a.verdict, "UNPROVEN");
    assert.equal(a.promotable, false);
    assert.match(a.reasons.join(" "), /held-out items/i);
  });

  it("exported unmeasuredAssessment is always non-promotable", () => {
    const a = unmeasuredAssessment("no evidence supplied");
    assert.equal(a.promotable, false);
    assert.equal(a.verdict, "UNMEASURED");
  });
});

describe("GeneralizationGate — reproducibility and policy", () => {
  it("is deterministic for the same seed", () => {
    const first = evaluateGeneralization(evidence({ bootstrap_seed: 7 }));
    const second = evaluateGeneralization(evidence({ bootstrap_seed: 7 }));
    assert.deepEqual(first.heldout_ci, second.heldout_ci);
    assert.equal(first.bootstrap_seed, 7);
  });

  it("honours a tightened maxGap policy", () => {
    const strict = { ...loadDefaultGeneralizationThresholds(), maxGap: 0.01 };
    const a = evaluateGeneralization(evidence(), strict);
    assert.equal(a.verdict, "OVERFIT");
    assert.equal(a.promotable, false);
  });

  it("reports the policy it applied", () => {
    const t = loadDefaultGeneralizationThresholds();
    const a = evaluateGeneralization(evidence(), t);
    assert.deepEqual(a.thresholds, t);
    assert.equal(a.ci_confidence, t.ciConfidence);
  });
});
