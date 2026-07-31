/**
 * evaluator.test.ts — P2.2 multi-model evaluation; canonical G shape.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ArifOsEvaluator, assertCanonicalGShape } from "../src/domain/evaluation/Evaluator.js";

describe("ArifOsEvaluator — canonical G is the 4-dial geometric mean", () => {
  it("emits exactly A, P, E, X, G — no Φ", async () => {
    const ev = new ArifOsEvaluator();
    const r = await ev.evaluate(
      {
        task_id: "t1",
        capability_id: "cap.test",
        input: { x: 1 },
        prediction_gap_threshold: 0.1,
        models: ["flame.qwen", "arifos.gpt", "human.baseline"],
      },
      {},
    );
    assert.deepEqual(Object.keys(r.canonical_g).sort(), ["A", "E", "G", "P", "X"]);
    assert.ok(!("Φ" in r.canonical_g));
    assert.ok(!("phi" in r.canonical_g));
    assertCanonicalGShape(r.canonical_g);
  });

  it("ranking is sorted by score descending", async () => {
    const ev = new ArifOsEvaluator();
    const r = await ev.evaluate(
      {
        task_id: "t2",
        capability_id: "cap.test",
        input: {},
        prediction_gap_threshold: 0.1,
        models: ["a", "b", "c"],
      },
      {},
    );
    for (let i = 0; i < r.ranking.length - 1; i += 1) {
      assert.ok(r.ranking[i].score >= r.ranking[i + 1].score);
    }
  });

  it("per-model entries have signed_by = arifos-arif_judge", async () => {
    const ev = new ArifOsEvaluator();
    const r = await ev.evaluate(
      {
        task_id: "t3",
        capability_id: "cap.test",
        input: {},
        prediction_gap_threshold: 0.1,
        models: ["flame.qwen"],
      },
      {},
    );
    assert.equal(r.per_model["flame.qwen"].verifier_receipt.signed_by, "arifos-arif_judge");
    assert.ok(r.per_model["flame.qwen"].verifier_receipt.cc_id?.startsWith("cc-"));
  });
});

describe("assertCanonicalGShape — drift guard", () => {
  it("throws on extra dial Φ", () => {
    assert.throws(
      () => assertCanonicalGShape({ A: 0.7, P: 0.7, E: 0.7, X: 0.7, G: 0.7, Φ: 0.7 } as never),
      /unexpected dial: Φ/,
    );
  });
  it("throws when a dial is missing", () => {
    assert.throws(
      () => assertCanonicalGShape({ A: 0.7, P: 0.7, E: 0.7, G: 0.7 } as never),
      /Canonical G missing dial: X/,
    );
  });
});
