/**
 * test/webFederation.test.ts — WEBO-Ω v0.1 math + hysteresis tests
 * ═══════════════════════════════════════════════════════════════
 *
 * Verifies the properties the design doc claims:
 *   1. G_fed Nash collapse (Axiom A1): any dial ≤ 0 → 0
 *   2. G_fed normalization (A6): G(k,k,k,k) = k
 *   3. G_fed monotonicity sample (∂G/∂d > 0)
 *   4. Ω12 hysteresis: threshold, cooldown half-open, PERSISTENCE across instances
 *   5. timeToFrontier: survival condition μ > λ, UNMEASURED discipline
 *   6. Rank fail-closed (INV-5): any h ≤ 0 → rank 0
 *   7. Intent classification (F3 regression guard)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  Hysteron,
  CONSECUTIVE_FAILURE_THRESHOLD,
  COOLDOWN_MS,
  computeGFed,
  computeCDark,
  independenceFromResults,
  freshnessDecay,
  vectorRank,
  fqBand,
  timeToFrontier,
  classifyIntent,
  classifyDifficulty,
  curriculumScore,
  isEligible,
  preferenceUpdate,
  DEFAULT_STATS,
  CURRICULUM_K,
} from "../src/domain/web/federation.js";

describe("WEBO-Ω federation", () => {
  // ── 1–3. G_fed axioms ─────────────────────────────────────────────
  it("Nash collapse: any dial ≤ 0 → G_fed = 0", () => {
    for (const broken of [
      { A: 0, P: 1, E: 1, X: 1 },
      { A: 1, P: 0, E: 1, X: 1 },
      { A: 1, P: 1, E: 0, X: 1 },
      { A: 1, P: 1, E: 1, X: 0 },
    ]) {
      const r = computeGFed(broken);
      assert.strictEqual(r.value, 0, `dial zero should collapse: ${JSON.stringify(broken)}`);
      assert.strictEqual(r.verdict, "AVOID_AUTONOMY");
      assert.strictEqual(r.is_canonical_g, false, "INV-6: never claim canonical G");
    }
  });

  it("normalization: G(k,k,k,k) = k", () => {
    for (const k of [0.25, 0.5, 0.8, 1.0]) {
      const r = computeGFed({ A: k, P: k, E: k, X: k });
      assert.ok(Math.abs(r.value - k) < 1e-9, `G(${k}×4) should = ${k}, got ${r.value}`);
    }
  });

  it("monotonicity: raising any dial raises G", () => {
    const base = computeGFed({ A: 0.6, P: 0.6, E: 0.6, X: 0.6 }).value;
    const up = computeGFed({ A: 0.7, P: 0.6, E: 0.6, X: 0.6 }).value;
    assert.ok(up > base, "∂G/∂A > 0");
  });

  it("verdict gates match forge_evaluate thresholds", () => {
    assert.strictEqual(computeGFed({ A: 0.9, P: 0.9, E: 0.9, X: 0.9 }).verdict, "HEALTHY");
    assert.strictEqual(computeGFed({ A: 0.7, P: 0.7, E: 0.7, X: 0.7 }).verdict, "DEGRADED");
    // Note: (0.3,0.9,0.9,0.9) → G≈0.684 = DEGRADED (Nash product softens single dials).
    // AVOID needs the PRODUCT below 0.0625 — e.g. a near-dead lane:
    assert.strictEqual(computeGFed({ A: 0.05, P: 0.9, E: 0.9, X: 0.9 }).verdict, "AVOID_AUTONOMY");
  });

  // ── 4. Ω12 hysteresis ─────────────────────────────────────────────
  describe("Hysteron (Ω12 persistent circuit breaker)", () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "webo-"));
      file = path.join(dir, "web_federation_state.json");
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("opens only after CONSECUTIVE_FAILURE_THRESHOLD failures", () => {
      const h = new Hysteron(file);
      for (let i = 0; i < CONSECUTIVE_FAILURE_THRESHOLD - 1; i++) {
        h.recordFailure("brave");
        assert.strictEqual(h.isOpen("brave"), false, `should be closed at failure ${i + 1}`);
      }
      h.recordFailure("brave");
      assert.strictEqual(h.isOpen("brave"), true, "should open at threshold");
    });

    it("success resets the failure streak", () => {
      const h = new Hysteron(file);
      h.recordFailure("p");
      h.recordFailure("p");
      h.recordSuccess("p");
      h.recordFailure("p");
      assert.strictEqual(h.isOpen("p"), false, "streak reset by success");
    });

    it("half-open after cooldown admits one trial", () => {
      const h = new Hysteron(file);
      for (let i = 0; i < CONSECUTIVE_FAILURE_THRESHOLD; i++) h.recordFailure("p");
      assert.strictEqual(h.isOpen("p"), true);
      // Backdate openUntil to simulate cooldown expiry
      const s = h.stats("p")!;
      s.circuit.openUntil = Date.now() - 1;
      assert.strictEqual(h.isOpen("p"), false, "half-open allows a retry");
    });

    it("PERSISTENCE: a new instance remembers failures (restart-safe)", () => {
      const h1 = new Hysteron(file);
      for (let i = 0; i < CONSECUTIVE_FAILURE_THRESHOLD; i++) h1.recordFailure("searxng");
      // Simulate restart: brand-new instance on the same file
      const h2 = new Hysteron(file);
      assert.strictEqual(h2.isOpen("searxng"), true, "restart must NOT forget provider failures (F4)");
      assert.strictEqual(h2.restarts(), 2, "restart counter increments");
    });

    it("field(): dead-lane ratio from observed state", () => {
      const h = new Hysteron(file);
      for (let i = 0; i < CONSECUTIVE_FAILURE_THRESHOLD; i++) h.recordFailure("brave");
      h.recordSuccess("searxng");
      const f = h.field(["brave", "searxng", "deepseek"]);
      assert.strictEqual(f.alive, 2, "brave dead (open), others alive");
      assert.ok(Math.abs(f.deadLaneRatio - 1 / 3) < 1e-9);
    });
  });

  // ── 5. timeToFrontier ─────────────────────────────────────────────
  it("timeToFrontier: UNMEASURED discipline + survival condition", () => {
    assert.strictEqual(timeToFrontier({ uncertaintyNow: 5, uncertaintyTarget: 5, discoveryRate: 1, decayRate: 0.5 }).status, "UNMEASURED");
    const stagnant = timeToFrontier({ uncertaintyNow: 5, uncertaintyTarget: 1, discoveryRate: 0.3, decayRate: 0.5 });
    assert.strictEqual(stagnant.status, "MEASURED");
    if (stagnant.status === "MEASURED") {
      assert.strictEqual(stagnant.survival, false, "μ ≤ λ → STAGNATION");
      assert.strictEqual(stagnant.T, Infinity);
    }
    const alive = timeToFrontier({ uncertaintyNow: 8, uncertaintyTarget: 1, discoveryRate: 0.6, decayRate: 0.2 });
    if (alive.status === "MEASURED") {
      assert.strictEqual(alive.survival, true);
      // T = ln(8)/(0.6−0.2) = 2.079/0.4 ≈ 5.198
      assert.ok(Math.abs(alive.T - Math.log(8) / 0.4) < 1e-9);
    }
  });

  // ── 6. Rank fail-closed (INV-5) ───────────────────────────────────
  it("vectorRank is fail-closed and geometric", () => {
    assert.strictEqual(vectorRank([1, 0.5, 0]), 0, "INV-5: zero member → 0");
    assert.ok(Math.abs(vectorRank([1, 1, 1, 1]) - 1) < 1e-9);
    // geometric mean of [1, 0.25] = sqrt(0.25) = 0.5
    assert.ok(Math.abs(vectorRank([1, 0.25]) - 0.5) < 1e-9);
    // weighted: weights [3,1] on [1, 0.25] → 1^0.75 · 0.25^0.25 ≈ 0.7071
    assert.ok(Math.abs(vectorRank([1, 0.25], [3, 1]) - Math.pow(0.25, 0.25)) < 1e-9);
  });

  it("freshnessDecay halves at half-life", () => {
    assert.ok(Math.abs(freshnessDecay(1, 10, 10) - 0.5) < 1e-9);
    assert.ok(Math.abs(freshnessDecay(1, 0, 10) - 1) < 1e-9);
  });

  it("fqBand peaks at 1.0 for FQ=1 (QG spec)", () => {
    assert.ok(fqBand(1.0) >= 0.99, "healthy peak");
    assert.ok(fqBand(0.05) < fqBand(1.0), "BURNING below healthy");
    assert.ok(fqBand(5) < fqBand(1.0), "dominance below healthy");
  });

  // ── 7. Intent classification (F3) ─────────────────────────────────
  it("classifyIntent maps sources/tools to the 4 intents", () => {
    assert.strictEqual(classifyIntent("research"), "research");
    assert.strictEqual(classifyIntent("web", "fetch"), "extraction");
    assert.strictEqual(classifyIntent("web", "extract"), "extraction");
    assert.strictEqual(classifyIntent("verify"), "verification");
    assert.strictEqual(classifyIntent("web"), "discovery");
  });

  // ── LFD kernel (curriculum + preference weights) ──────────────────
  describe("LFD kernel (2610.17246 port)", () => {
    it("classifyDifficulty: sub-goal ladder", () => {
      assert.strictEqual(classifyDifficulty("petronas dividend"), "easy");
      assert.strictEqual(classifyDifficulty("petronas dividend policy malaysia 2026 fiscal"), "medium");
      assert.strictEqual(classifyDifficulty('"petronas" site:petronas.com dividend policy after:2025'), "hard");
    });

    it("curriculum: provider not eligible for harder class before K wins", () => {
      const s = DEFAULT_STATS();
      assert.strictEqual(isEligible(s, "easy"), true);
      assert.strictEqual(isEligible(s, "hard"), false, "hard requires medium wins first");
      for (let i = 0; i < CURRICULUM_K; i++) preferenceUpdate(s, "easy", 1);
      assert.strictEqual(isEligible(s, "medium"), true);
      for (let i = 0; i < CURRICULUM_K; i++) preferenceUpdate(s, "medium", 1);
      assert.strictEqual(isEligible(s, "hard"), true);
    });

    it("preferenceUpdate: multiplicative weights, win↑ lose↓, clipped", () => {
      const s = DEFAULT_STATS();
      preferenceUpdate(s, "easy", 1);
      assert.ok(s.weights.easy > 1, "winner weight increases");
      const w1 = s.weights.easy;
      preferenceUpdate(s, "easy", 0);
      assert.ok(s.weights.easy < w1, "loser weight decreases");
      for (let i = 0; i < 50; i++) preferenceUpdate(s, "easy", 1);
      assert.ok(s.weights.easy <= 3.0, "clip at 3.0");
    });

    it("curriculumScore: prior × weight, zero when ineligible", () => {
      const s = DEFAULT_STATS();
      assert.strictEqual(curriculumScore(0.8, s, "hard"), 0, "ineligible → 0");
      assert.ok(Math.abs(curriculumScore(0.8, s, "easy") - 0.8) < 1e-9, "fresh weight=1 → prior");
    });

    it("Hysteron LFD state persists across restarts", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webo-lfd-"));
      const file = path.join(dir, "state.json");
      const h1 = new Hysteron(file);
      h1.lfdRecord("exa", "easy", 1);
      h1.lfdRecord("exa", "easy", 1);
      const h2 = new Hysteron(file);
      const s = h2.lfdGet("exa")!;
      assert.ok(s.wins.easy === 2, "wins survive restart");
      assert.ok(s.weights.easy > 1, "learned weight survives restart");
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  // ── C_dark + independence ─────────────────────────────────────────
  it("computeCDark: EMD-style thresholds", () => {
    const clean = computeCDark({ calls: 10, successes: 9, empties: 1, failures: 0, receipts: 10, deadLaneRatio: 0, staleRatio: 0 });
    assert.strictEqual(clean.verdict, "PROCEED");
    const bad = computeCDark({ calls: 10, successes: 0, empties: 10, failures: 0, receipts: 10, deadLaneRatio: 1, staleRatio: 1 });
    assert.strictEqual(bad.verdict, "VOID_EXPLORATION");
  });

  it("independenceFromResults: Jaccard overlap decreases X", () => {
    assert.strictEqual(independenceFromResults([["a", "b"]]), 1, "single set = full independence");
    const disjoint = independenceFromResults([["a", "b"], ["c", "d"]]);
    assert.ok(Math.abs(disjoint - 1) < 1e-9);
    const identical = independenceFromResults([["a", "b"], ["a", "b"]]);
    assert.ok(Math.abs(identical - 0) < 1e-9);
  });
});
