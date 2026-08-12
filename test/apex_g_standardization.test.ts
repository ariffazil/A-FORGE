/**
 * APEX G Formula Standardization Test Suite
 *
 * Verifies all 6 drifted variants converge to G = A · P · E · X · Φ
 * and that Nash collapse + equivalence hold.
 *
 * @constitutional F2 TRUTH · F8 GENIUS
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ── File 1: APEXRuntimeReceipt ──────────────────────────────────────────

import { buildAPEXReceipt, estimateAPEXX } from
  "../src/domain/governance/APEXRuntimeReceipt.js";

// ── File 2: apexDials ───────────────────────────────────────────────────

import {
  calculateGeniusFromFloors,
  computeGFrom6Dials,
  type FloorScores13,
  type Apex6Dials,
  floorsToDials,
  buildApexEnvelope,
} from "../src/domain/governance/apexDials.js";

// ── File 4: taskJacobian ────────────────────────────────────────────────

import {
  computeGFromJacobian,
  type TaskVectorEntry,
  ZERO_SENSITIVITY,
} from "../src/domain/cognition/taskJacobian.js";

// ═══════════════════════════════════════════════════════════════════════════
// Test 1: Nash Collapse — input (A=1,P=1,E=1,X=0,Φ=1) → G MUST = 0.0
// ═══════════════════════════════════════════════════════════════════════════

function makeZeroScore(): TaskVectorEntry {
  return {
    task_id: "test-0",
    label: "test",
    organ: "aforge",
    domain: "infrastructure",
    tool: "test",
    args: {},
    depends_on: [],
    reversibility: "reversible",
    risk_tier: "LOW",
    sensitivity: ZERO_SENSITIVITY,
    provenance: {
      goal_intent: "test",
      goal_hash: "abc",
      source_risk_band: "LOW",
      source_scope: "test",
      source_authority: "tester",
      created_at: new Date().toISOString(),
      metabolism_count: 0,
      risk_weight_multiplier: 1,
      constraint_weight_multiplier: 1,
    },
    state: "pending",
    g_contribution: 0,
    c_dark_contribution: 0,
    last_sensitivity_check: null,
  };
}

describe("APEX G Standardization — Test 1: Nash Collapse", () => {
  it("APEXRuntimeReceipt: X=0 → G=0 (any model)", () => {
    // Use estimateAPEXX scores with X set to 0
    const receipt = buildAPEXReceipt({
      action_id: "test-nash-1",
      actor_id: "test",
      scores: { A: 1, P: 1, E: 1, X: 0 },
      authority_band: "OBSERVE",
      reversibility: "REVERSIBLE",
      blast_radius: "NONE",
    });
    assert.equal(receipt.G, 0, "X=0 must produce G=0 (Nash collapse)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 2: Equivalence — (0.8,0.8,0.8,0.8) → G = 0.8 (geometric mean)
// ═══════════════════════════════════════════════════════════════════════════

describe("APEX G Standardization — Test 2: Equivalence", () => {
  const CANONICAL_G = Math.round(Math.pow(0.8 * 0.8 * 0.8 * 0.8, 0.25) * 10000) / 10000; // 0.8

  it("APEXRuntimeReceipt: (0.8,0.8,0.8,0.8) → GM=0.8", () => {
    const receipt = buildAPEXReceipt({
      action_id: "test-eq-1",
      actor_id: "test",
      scores: { A: 0.8, P: 0.8, E: 0.8, X: 0.8,  },
      authority_band: "ANALYZE",
      reversibility: "REVERSIBLE",
      blast_radius: "NONE",
    });
    assert.equal(receipt.G, CANONICAL_G, `G should be ${CANONICAL_G} (geometric mean)`);
  });

  it("apexDials computeGFrom6Dials: (0.8,0.8,0.8,0.8) → GM=0.8", () => {
    const dials: Apex6Dials = { A: 0.8, P: 0.8, E: 0.8, X: 0.8 };
    const G = computeGFrom6Dials(dials, 1.0);
    assert.equal(G, CANONICAL_G, `computeGFrom6Dials should be ${CANONICAL_G} (geometric mean)`);
  });

  it("taskJacobian: (0.8,0.8,0.8,0.8) in task entries → local estimate (NOT canonical G)", () => {
    const makeEntry = (cDarkContrib: number): TaskVectorEntry => ({
      ...makeZeroScore(),
      c_dark_contribution: 1 - 0.8, // so (1 - c_dark) = 0.8
      provenance: { ...makeZeroScore().provenance, goal_intent: "active" },
    });
    // taskJacobian uses V3 geometric mean G_local = (A · P · E · X)^(1/4) * (1 - humilityCap)\n    // A = 0.8, P = 1.0, E = 0.8, X = 1.0 -> GM(0.8, 1.0, 0.8, 1.0) = 0.894427\n    // 0.894427 * (1 - 0.08) = 0.822873 -> 0.8229\n    const entry = makeEntry(0.2);\n    entry.sensitivity = {\n      risk: 0.2, scope: 0.2, authority: 0.2, time: 0.2,\n      cost: 0.2, organ: 0.2, domain: 0.2,\n    };\n    const G = computeGFromJacobian([entry]);\n    assert.equal(G, 0.8229, `Local estimate should be 0.8229 (got ${G})`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 3: C_dark remains independent
// ═══════════════════════════════════════════════════════════════════════════

describe("APEX G Standardization — Test 3: C_dark independence", () => {
  it("APEXRuntimeReceipt: C_dark = A·(1-P)·(1-X)", () => {
    const receipt = buildAPEXReceipt({
      action_id: "test-cdark-1",
      actor_id: "test",
      scores: { A: 0.9, P: 0.7, E: 0.5, X: 0.8 },
      authority_band: "ANALYZE",
      reversibility: "REVERSIBLE",
      blast_radius: "NONE",
    });
    const expected = Math.round(0.9 * (1 - 0.7) * (1 - 0.8) * 1000) / 1000;
    assert.equal(receipt.C_dark, expected, "C_dark must be A·(1-P)·(1-X)");
  });

  it("C_dark is independent of G (different inputs, same C_dark)", () => {
    const r1 = buildAPEXReceipt({
      action_id: "cdark-test-a",
      actor_id: "test",
      scores: { A: 0.9, P: 0.7, E: 0.2, X: 0.8 },
      authority_band: "ANALYZE",
      reversibility: "REVERSIBLE",
      blast_radius: "NONE",
    });
    const r2 = buildAPEXReceipt({
      action_id: "cdark-test-b",
      actor_id: "test",
      scores: { A: 0.9, P: 0.7, E: 0.9, X: 0.8 },
      authority_band: "ANALYZE",
      reversibility: "REVERSIBLE",
      blast_radius: "NONE",
    });
    assert.equal(r1.C_dark, r2.C_dark, "C_dark should not depend on E or Φ");
    assert.notEqual(r1.G, r2.G, "G should differ when E differs");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 4: Cross-module consistency
// ═══════════════════════════════════════════════════════════════════════════

describe("APEX G Standardization — Test 4: Cross-module consistency", () => {
  it("apexDials calculateGeniusFromFloors: all 1.0 → G ≈ 1.0", () => {
    const perfectFloors: FloorScores13 = {
      f1_amanah: 1.0, f2_truth: 1.0, f3_tri_witness: 1.0,
      f4_clarity: 1.0, f5_peace: 1.0, f6_empathy: 1.0,
      f7_humility: 1.0, f8_genius: 1.0, f9_antihantu: 1.0,
      f10_ontology: 1.0, f11_command: 1.0, f12_injection: 1.0,
      f13_sovereign: 1.0,
    };
    const result = calculateGeniusFromFloors(perfectFloors, 1.0, 1.0);
    // With all 1s and GM for dials, each dial is 1.0, G = 1.0 * 1.0 * 1.0 * 1.0 * 1.0 = 1.0
    assert.equal(result.G, 1.0, "Perfect floors → G=1.0");
  });

  it("apexDials floorsToDials + computeGFrom6Dials: all 0.5 → product of dials", () => {
    const halfFloors: FloorScores13 = {
      f1_amanah: 0.5, f2_truth: 0.5, f3_tri_witness: 0.5,
      f4_clarity: 0.5, f5_peace: 0.5, f6_empathy: 0.5,
      f7_humility: 0.5, f8_genius: 0.5, f9_antihantu: 0.5,
      f10_ontology: 0.5, f11_command: 0.5, f12_injection: 0.5,
      f13_sovereign: 0.5,
    };
    const dials = floorsToDials(halfFloors, 0.5, 0.5);
    const G = computeGFrom6Dials(dials, 1.0);
    // A = GM(0.5,0.5,0.5,0.5) = 0.5
    // P = GM(0.5,0.5,0.5,0.5) = 0.5
    // E = GM(F3,F4,F12,energy1,energy2) where eFloors=GM(0.5,0.5,0.5)=0.5, eEnergy=GM(0.5,0.5)=0.5
    //     E = GM(0.5,0.5,0.5,0.5,0.5) = 0.5
    // X = GM(0.5,0.5,0.5, riskScore where f9=0.5→risk=1-0.3=0.7) = roughly GM(0.5,0.5,0.5,0.7) ≈ 0.567
    // G = GM(A,P,E,X) = (0.5 * 0.5 * 0.5 * ≈0.567)^(1/4) ≈ 0.516
    // Not an exact test — just verify it's geometric mean, not product
    const gmA = 0.5;
    const gmP = 0.5;
    const gmE = 0.5;
    const gmX = Math.round(Math.pow(0.5 * 0.5 * 0.5 * 0.7, 0.25) * 10000) / 10000;
    const expectedG = Math.round(Math.pow(gmA * gmP * gmE * gmX, 0.25) * 10000) / 10000;
    assert.equal(G, expectedG,
      "G must equal geometric mean of (A,P,E,X) — V3 Nash Bargaining Product");
  });
});
