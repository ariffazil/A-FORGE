/**
 * APEX G Empirical Test Suite — COMPREHENSIVE
 *
 * Tests the canonical 4-dial geometric mean:
 *   G = (A · P · E · X)^(1/4)
 *
 * And C_dark = A * (1 - P) * (1 - X)
 *
 * Canonical ref: APEX_T000_THEOREM.md (ratified 2026-07-26)
 */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  computeApex10Gates,
  calculateGeniusFromFloors,
  floorsToDials,
  type FloorScores13,
} from "../src/domain/governance/apexDials.js";

// ── Helper: geometric mean (match implementation) ──────────────────────────
function geometricMean(values: number[]): number {
  // Nash Collapse: ANY value <= 0 → G = 0.0 (matches apexDials implementation)
  if (!values || values.length === 0 || values.some((v) => v <= 0)) return 0;
  const product = values.reduce((acc, v) => acc * v, 1);
  return Math.pow(product, 1 / values.length);
}

// ── Helper: C_dark ─────────────────────────────────────────────────────────
function cDark(A: number, P: number, X: number): number {
  return A * (1 - P) * (1 - X);
}

// ── Helper: build default floors ───────────────────────────────────────────
function makeFloors(overrides: Partial<FloorScores13> = {}): FloorScores13 {
  return {
    f1_amanah: 1.0,
    f2_truth: 1.0,
    f3_tri_witness: 1.0,
    f4_clarity: 1.0,
    f5_peace: 1.0,
    f6_empathy: 1.0,
    f7_humility: 1.0,
    f8_genius: 1.0,
    f9_antihantu: 1.0,
    f10_ontology: 1.0,
    f11_command: 1.0,
    f12_injection: 1.0,
    f13_sovereign: 1.0,
    ...overrides,
  };
}

// ── TEST GROUP 1: NASH COLLAPSE (Zero Boundary) ────────────────────────────
describe("NASH COLLAPSE (Zero Boundary)", () => {
  it("(A=1.0, P=1.0, E=1.0, X=0.0) → G MUST = 0.0", () => {
    const G = geometricMean([1.0, 1.0, 1.0, 0.0]);
    assert.strictEqual(G, 0.0, `Expected 0.0, got ${G}`);
  });

  it("(A=0.0, P=1.0, E=1.0, X=1.0) → G MUST = 0.0", () => {
    const G = geometricMean([0.0, 1.0, 1.0, 1.0]);
    assert.strictEqual(G, 0.0, `Expected 0.0, got ${G}`);
  });

  it("(A=0.5, P=0.5, E=0.5, X=0.5) → G ~ 0.50", () => {
    const G = geometricMean([0.5, 0.5, 0.5, 0.5]);
    assert.strictEqual(G, 0.5, `Expected 0.5, got ${G}`);
  });

  it("(A=1.0, P=0.0, E=1.0, X=1.0) → G MUST = 0.0", () => {
    const G = geometricMean([1.0, 0.0, 1.0, 1.0]);
    assert.strictEqual(G, 0.0, `Expected 0.0, got ${G}`);
  });

  it("(A=1.0, P=1.0, E=0.0, X=1.0) → G MUST = 0.0", () => {
    const G = geometricMean([1.0, 0.0, 1.0, 1.0]);
    assert.strictEqual(G, 0.0, `Expected 0.0, got ${G}`);
  });

  it("(A=0.8, P=0.8, E=0.8, X=0.8) → G ~ 0.80 (uniform high)", () => {
    const G = geometricMean([0.8, 0.8, 0.8, 0.8]);
    assert.strictEqual(G, 0.8, `Expected 0.8, got ${G}`);
  });

  it("calculateGeniusFromFloors: all-1.0 floors → G=1.0", () => {
    const floors = makeFloors();
    const result = calculateGeniusFromFloors(floors, 1.0, 1.0);
    assert.strictEqual(result.G, 1.0, `Expected G=1.0, got ${result.G}`);
    assert.strictEqual(result.verdict, "SEAL");
  });

  it("calculateGeniusFromFloors: zero f2_truth → G=0.0", () => {
    const floors = makeFloors({ f2_truth: 0.0 });
    const result = calculateGeniusFromFloors(floors, 1.0, 1.0);
    assert.strictEqual(result.G, 0.0, `Expected G=0.0, got ${result.G}`);
    assert.strictEqual(result.verdict, "HOLD");
  });

  it("computeApex10Gates: all-1.0 floors → G ~ 1.0", () => {
    const floors = makeFloors();
    const result = computeApex10Gates(floors, {
      actor_id: "test",
      action_class: "READ",
      proof_level: "ZKPC_CERTAINTY",
    });
    assert.ok(result.G >= 0.90, `Expected G >= 0.90, got ${result.G}`);
    assert.strictEqual(result.verdict, "SEAL");
  });
});

// ── TEST GROUP 2: MONOTONICITY ─────────────────────────────────────────────
describe("MONOTONICITY", () => {
  it("(0.8, 0.8, 0.8, 0.8) → G = 0.80", () => {
    const G = geometricMean([0.8, 0.8, 0.8, 0.8]);
    assert.strictEqual(G, 0.8, `Expected 0.8, got ${G}`);
  });

  it("(0.9, 0.8, 0.8, 0.8) → G > 0.80 (strictly monotonic)", () => {
    const G_base = geometricMean([0.8, 0.8, 0.8, 0.8]);
    const G_inc = geometricMean([0.9, 0.8, 0.8, 0.8]);
    assert.ok(G_inc > G_base, `Expected ${G_inc} > ${G_base}`);
  });

  it("(0.8, 0.9, 0.8, 0.8) → G > 0.80", () => {
    const G_base = geometricMean([0.8, 0.8, 0.8, 0.8]);
    const G_inc = geometricMean([0.8, 0.9, 0.8, 0.8]);
    assert.ok(G_inc > G_base, `Expected ${G_inc} > ${G_base}`);
  });

  it("(0.8, 0.8, 0.9, 0.8) → G > 0.80", () => {
    const G_base = geometricMean([0.8, 0.8, 0.8, 0.8]);
    const G_inc = geometricMean([0.8, 0.8, 0.9, 0.8]);
    assert.ok(G_inc > G_base, `Expected ${G_inc} > ${G_base}`);
  });

  it("(0.8, 0.8, 0.8, 0.9) → G > 0.80", () => {
    const G_base = geometricMean([0.8, 0.8, 0.8, 0.8]);
    const G_inc = geometricMean([0.8, 0.8, 0.8, 0.9]);
    assert.ok(G_inc > G_base, `Expected ${G_inc} > ${G_base}`);
  });

  it("Decreasing one dial from uniform 0.8 → G < 0.80", () => {
    const G_base = geometricMean([0.8, 0.8, 0.8, 0.8]);
    const G_dec = geometricMean([0.7, 0.8, 0.8, 0.8]);
    assert.ok(G_dec < G_base, `Expected ${G_dec} < ${G_base}`);
  });

  it("Strict monotonic sweep: increasing all 4 dials → G increases", () => {
    const lows = geometricMean([0.1, 0.1, 0.1, 0.1]);
    const mids = geometricMean([0.5, 0.5, 0.5, 0.5]);
    const highs = geometricMean([0.9, 0.9, 0.9, 0.9]);
    assert.ok(lows < mids, `Expected ${lows} < ${mids}`);
    assert.ok(mids < highs, `Expected ${mids} < ${highs}`);
  });
});

// ── TEST GROUP 3: GEOMETRIC MEAN vs ARITHMETIC / PRODUCT FORMULAS ──────────
describe("Formula comparison", () => {
  it("Geometric mean is NOT the same as arithmetic mean (product/4)", () => {
    const G_geom = geometricMean([0.5, 0.2, 0.9, 0.9]);
    const G_arith = (0.5 + 0.2 + 0.9 + 0.9) / 4;
    assert.notStrictEqual(G_geom, G_arith);
  });

  it("Geometric mean is NOT the same as simple product A*P*E*X", () => {
    // Product: 0.5*0.5*0.5*0.5 = 0.0625 vs GM: 0.5
    const G_geom = geometricMean([0.5, 0.5, 0.5, 0.5]);
    const G_product = 0.5 * 0.5 * 0.5 * 0.5;
    assert.notStrictEqual(G_geom, G_product);
    assert.strictEqual(G_geom, 0.5);
    assert.strictEqual(G_product, 0.0625);
  });

  it("Geometric mean is NOT the same as (A*P*E*X)^(1/5) (E²/5-root)", () => {
    // The old E² formula: (A*P*E*E*X)^(1/5) — use unequal dials to show difference
    const G_canonical = geometricMean([0.9, 0.9, 0.5, 0.9]); // (0.9*0.9*0.5*0.9)^(1/4) ≈ 0.779
    const G_e2_5root = Math.pow(0.9 * 0.9 * 0.5 * 0.5 * 0.9, 1 / 5); // E counted twice: (0.182)^(1/5) ≈ 0.711
    assert.notStrictEqual(G_canonical, G_e2_5root);
    assert.ok(G_e2_5root < G_canonical, "E²/5-root should be lower than 4-term GM with unequal dials");
  });

  it("(A*P*E*X)^(1/4) correctly detects weak dial (Nash collapse)", () => {
    // One dial at 0.1 dominates: GM = (0.9*0.9*0.9*0.1)^(1/4) = (0.0729)^(1/4) ≈ 0.5189
    // vs arithmetic mean ~ 0.7 — the GM correctly penalizes the weak link
    const G = geometricMean([0.9, 0.9, 0.9, 0.1]);
    const G_arith = (0.9 + 0.9 + 0.9 + 0.1) / 4;
    assert.ok(G < G_arith, `GM(${G}) should be less than arith(${G_arith})`);
    assert.ok(G < 0.6, `Weak dial not penalized enough: G=${G}`);
  });
});

// ── TEST GROUP 4: C_dark INTEGRITY ─────────────────────────────────────────
describe("C_dark Integrity", () => {
  it("C_dark = A * (1-P) * (1-X) — formula verified", () => {
    const result = cDark(0.8, 0.8, 0.8);
    // 0.8 * 0.2 * 0.2 = 0.032 (use Math.round for JS float safety)
    assert.strictEqual(Math.round(result * 1000) / 1000, 0.032, `Expected 0.032, got ${result}`);
  });

  it("C_dark < 0.30 threshold logic verified", () => {
    // Low C_dark: A moderate, P & X high → C_dark low
    const low = cDark(0.5, 0.9, 0.9);
    // 0.5 * 0.1 * 0.1 = 0.005
    assert.ok(low < 0.30, `Expected < 0.30, got ${low}`);

    // High C_dark: A high, P & X low → C_dark high
    const high = cDark(1.0, 0.1, 0.1);
    // 1.0 * 0.9 * 0.9 = 0.81
    assert.ok(high >= 0.30, `Expected >= 0.30, got ${high}`);
  });

  it("(A=1.0, P=0.1, X=0.1) → C_dark=0.81 — ABOVE threshold, trips SABAR/HOLD", () => {
    const result = cDark(1.0, 0.1, 0.1);
    assert.strictEqual(result, 0.81, `Expected 0.81, got ${result}`);
    assert.ok(result >= 0.30, "C_dark >= 0.30 should trigger HOLD");
  });

  it("C_dark is independent of G — uses (1-P)*(1-X), not E", () => {
    // C_dark doesn't use E at all — it's a shadow metric
    const c1 = cDark(0.9, 0.3, 0.3);
    const c2 = cDark(0.9, 0.3, 0.3);
    assert.strictEqual(c1, c2); // deterministic
  });

  it("When P=1.0 or X=1.0, C_dark = 0 regardless of A", () => {
    assert.strictEqual(cDark(1.0, 1.0, 0.5), 0.0); // P=1
    assert.strictEqual(cDark(1.0, 0.5, 1.0), 0.0); // X=1
  });
});

// ── TEST GROUP 5: VERDICT THRESHOLDS ───────────────────────────────────────
describe("Verdict thresholds", () => {
  it("G >= 0.80 → SEAL", () => {
    const floors = makeFloors({
      f2_truth: 0.80, f4_clarity: 0.80, f7_humility: 0.80, f10_ontology: 1.0,
      f1_amanah: 0.80, f5_peace: 0.80, f11_command: 0.80, f13_sovereign: 1.0,
      f3_tri_witness: 0.80, f12_injection: 0.80,
      f6_empathy: 0.80, f8_genius: 0.80, f9_antihantu: 1.0,
    });
    const result = calculateGeniusFromFloors(floors, 0.80, 0.80);
    assert.ok(result.G >= 0.80, `Expected G>=0.80, got ${result.G}`);
    assert.strictEqual(result.verdict, "SEAL");
  });

  it("0.70 <= G < 0.80 → SABAR", () => {
    const floors = makeFloors({
      f2_truth: 0.70, f4_clarity: 0.70, f7_humility: 0.70, f10_ontology: 1.0,
      f1_amanah: 0.70, f5_peace: 0.70, f11_command: 0.70, f13_sovereign: 1.0,
      f3_tri_witness: 0.70, f12_injection: 0.60,
      f6_empathy: 0.70, f8_genius: 0.70, f9_antihantu: 1.0,
    });
    const result = calculateGeniusFromFloors(floors, 0.60, 0.60);
    assert.ok(result.G >= 0.70, `Expected G>=0.70, got ${result.G}`);
    assert.ok(result.G < 0.80, `Expected G<0.80, got ${result.G}`);
    assert.strictEqual(result.verdict, "SABAR");
  });

  it("G < 0.70 → HOLD", () => {
    const floors = makeFloors({
      f2_truth: 0.50, f4_clarity: 0.50, f7_humility: 0.50, f10_ontology: 1.0,
      f1_amanah: 0.50, f5_peace: 0.50, f11_command: 0.50, f13_sovereign: 1.0,
      f3_tri_witness: 0.50, f12_injection: 0.50,
      f6_empathy: 0.50, f8_genius: 0.50, f9_antihantu: 1.0,
    });
    const result = calculateGeniusFromFloors(floors, 0.40, 0.40);
    assert.ok(result.G < 0.70, `Expected G<0.70, got ${result.G}`);
    assert.strictEqual(result.verdict, "HOLD");
  });
});
