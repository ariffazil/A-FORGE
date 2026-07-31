/**
 * wmPromotionGate.test.ts — P2.5 curated-dataset promotion gate.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WmPromotionGate, type CuratedDatasetSlice } from "../src/domain/governance/WmPromotionGate.js";

const gate = new WmPromotionGate();

describe("WmPromotionGate — empty slice", () => {
  it("rejects empty slice", async () => {
    const d = await gate.evaluate(
      { sample_ids: [], min_evidence_quality: 0.8, min_independent_verifier_passes: 3, min_canonical_g: 0.7 },
      async () => [],
    );
    assert.equal(d.ok_to_promote, false);
    assert.equal(d.reason, "empty slice");
  });
});

describe("WmPromotionGate — passing slice", () => {
  it("promotes when all gates pass", async () => {
    const slice: CuratedDatasetSlice = {
      sample_ids: ["s1", "s2", "s3"],
      min_evidence_quality: 0.8,
      min_independent_verifier_passes: 6,
      min_canonical_g: 0.7,
    };
    const d = await gate.evaluate(slice, async () => [
      { evidence_quality: 0.95, verifier_passes: 3, canonical_g: 0.85 },
      { evidence_quality: 0.9, verifier_passes: 2, canonical_g: 0.8 },
      { evidence_quality: 0.85, verifier_passes: 1, canonical_g: 0.75 },
    ]);
    assert.equal(d.ok_to_promote, true);
    assert.equal(d.stats.total_samples, 3);
    assert.equal(d.stats.passing_samples, 3);
  });
});

describe("WmPromotionGate — failing slice", () => {
  it("blocks when canonical_g below threshold", async () => {
    const d = await gate.evaluate(
      { sample_ids: ["s1"], min_evidence_quality: 0.5, min_independent_verifier_passes: 0, min_canonical_g: 0.9 },
      async () => [{ evidence_quality: 0.9, verifier_passes: 1, canonical_g: 0.5 }],
    );
    assert.equal(d.ok_to_promote, false);
    assert.match(d.reason, /canonical_g/);
  });
  it("blocks when verifier_passes below threshold", async () => {
    const d = await gate.evaluate(
      { sample_ids: ["s1"], min_evidence_quality: 0.5, min_independent_verifier_passes: 10, min_canonical_g: 0.5 },
      async () => [{ evidence_quality: 0.9, verifier_passes: 1, canonical_g: 0.8 }],
    );
    assert.equal(d.ok_to_promote, false);
    assert.match(d.reason, /verifier_passes/);
  });
  it("blocks when evidence_quality below threshold", async () => {
    const d = await gate.evaluate(
      { sample_ids: ["s1"], min_evidence_quality: 0.95, min_independent_verifier_passes: 0, min_canonical_g: 0.5 },
      async () => [{ evidence_quality: 0.7, verifier_passes: 0, canonical_g: 0.8 }],
    );
    assert.equal(d.ok_to_promote, false);
    assert.match(d.reason, /evidence_quality/);
  });
});
