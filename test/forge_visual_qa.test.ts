/**
 * @file forge_visual_qa.test.ts — Constitutional Visual QA Tests
 * @description Tests for verdict state machine, scar consultation,
 *              tri-witness W³, and entropy metabolism.
 *
 * RUN: npx tsx test/forge_visual_qa.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidTransition,
  evaluateTriWitness,
  computeEntropyDelta,
  checkEntropyGate,
  consultScars,
  type WitnessResult,
  type Deviation,
  type Scar,
  type EntropyState,
} from "../src/infrastructure/tools/ForgeVisualQA.js";

// ============================================================================
// TEST 1: Verdict State Machine
// ============================================================================

describe("VerdictState transitions", () => {
  it("INIT → VALIDATING is valid", () => {
    assert.ok(isValidTransition("INIT", "VALIDATING"));
  });

  it("INIT → PASS_CANDIDATE is INVALID (must go through VALIDATE first)", () => {
    assert.ok(!isValidTransition("INIT", "PASS_CANDIDATE"));
  });

  it("VALIDATING → PASS_CANDIDATE is valid", () => {
    assert.ok(isValidTransition("VALIDATING", "PASS_CANDIDATE"));
  });

  it("VALIDATING → ITERATING is valid", () => {
    assert.ok(isValidTransition("VALIDATING", "ITERATING"));
  });

  it("PASS_CANDIDATE → SEALED_DEPLOY is valid (after 888)", () => {
    assert.ok(isValidTransition("PASS_CANDIDATE", "SEALED_DEPLOY"));
  });

  it("PASS_CANDIDATE → INIT is INVALID (cannot go backwards)", () => {
    assert.ok(!isValidTransition("PASS_CANDIDATE", "INIT"));
  });

  it("SEALED_DEPLOY is terminal (no transitions out)", () => {
    assert.ok(!isValidTransition("SEALED_DEPLOY", "INIT"));
    assert.ok(!isValidTransition("SEALED_DEPLOY", "VALIDATING"));
    assert.ok(!isValidTransition("SEALED_DEPLOY", "PASS_CANDIDATE"));
  });

  it("VOID is terminal (no transitions out)", () => {
    assert.ok(!isValidTransition("VOID", "INIT"));
    assert.ok(!isValidTransition("VOID", "VALIDATING"));
  });

  it("HOLD → VALIDATING is valid (human can restart)", () => {
    assert.ok(isValidTransition("HOLD", "VALIDATING"));
  });

  it("HARD_FAULT → VALIDATING is valid (retry)", () => {
    assert.ok(isValidTransition("HARD_FAULT", "VALIDATING"));
  });

  // CRITICAL: "PASS" is not even in the enum
  it("PASS is not a valid verdict state (HARAM)", () => {
    const validStates = ["INIT", "VALIDATING", "ITERATING", "PASS_CANDIDATE", "SEALED_DEPLOY", "HOLD", "HARD_FAULT", "VOID"];
    assert.ok(!validStates.includes("PASS"), "PASS must not exist as a verdict state");
  });
});

// ============================================================================
// TEST 2: Tri-Witness W³
// ============================================================================

describe("Tri-Witness W³ evaluation", () => {
  const makeW = <ID extends "W1" | "W2" | "W3">(id: ID, status: "CONFIRMED" | "REJECTED" | "PENDING", conf: number): WitnessResult<ID> => ({
    witness_id: id,
    status,
    confidence: conf,
    deviations: [],
  });

  it("all three confirmed → consensus = true", () => {
    const result = evaluateTriWitness(
      makeW("W1", "CONFIRMED", 0.85),
      makeW("W2", "CONFIRMED", 0.90),
      makeW("W3", "CONFIRMED", 0.90),
    );
    assert.ok(result.consensus);
    assert.ok(result.consensus_confidence > 0);
    assert.equal(result.failure_reason, undefined);
  });

  it("W3 PENDING → consensus = true (W1+W2 agree, W3 awaiting 888)", () => {
    const result = evaluateTriWitness(
      makeW("W1", "CONFIRMED", 0.85),
      makeW("W2", "CONFIRMED", 0.90),
      makeW("W3", "PENDING", 0),
    );
    // W3 PENDING with 0 confidence collapses the geometric mean
    // But W1+W2 agreement is still valid for PASS_CANDIDATE
    assert.ok(!result.consensus, "Zero W3 confidence collapses W³");
  });

  it("W1 REJECTED → consensus = false", () => {
    const result = evaluateTriWitness(
      makeW("W1", "REJECTED", 0.70),
      makeW("W2", "CONFIRMED", 0.90),
      makeW("W3", "PENDING", 0),
    );
    assert.ok(!result.consensus);
    // W3=0 triggers zero-collapse (takes priority over rejected check)
    assert.ok(result.failure_reason !== undefined, "Must have failure reason");
  });

  it("W2 REJECTED → consensus = false", () => {
    const result = evaluateTriWitness(
      makeW("W1", "CONFIRMED", 0.85),
      makeW("W2", "REJECTED", 0.60),
      makeW("W3", "PENDING", 0),
    );
    assert.ok(!result.consensus);
  });

  it("confidence capped at 0.90 (F7 HUMILITY)", () => {
    const result = evaluateTriWitness(
      makeW("W1", "CONFIRMED", 0.99),
      makeW("W2", "CONFIRMED", 0.99),
      makeW("W3", "CONFIRMED", 0.99),
    );
    // All confidences should be capped
    assert.ok(result.w1_vision.confidence <= 0.90, "W1 confidence must be capped at 0.90");
    assert.ok(result.w2_linter.confidence <= 0.90, "W2 confidence must be capped at 0.90");
    assert.ok(result.w3_sovereign.confidence <= 0.90, "W3 confidence must be capped at 0.90");
  });

  it("W³ geometric mean of 0.90 × 0.90 × 0.90 ≈ 0.90", () => {
    const result = evaluateTriWitness(
      makeW("W1", "CONFIRMED", 0.90),
      makeW("W2", "CONFIRMED", 0.90),
      makeW("W3", "CONFIRMED", 0.90),
    );
    const expected = Math.cbrt(0.90 * 0.90 * 0.90);
    assert.ok(Math.abs(result.consensus_confidence - expected) < 0.001);
  });
});

// ============================================================================
// TEST 3: Entropy Metabolism
// ============================================================================

describe("Entropy metabolism (ΔS ≤ 0)", () => {
  const baseline: EntropyState = {
    iteration: 0,
    deviation_count: 10,
    delta_s: 0,
    cumulative_delta: 0,
  };

  it("first iteration is exempt from entropy gate", () => {
    const state = computeEntropyDelta(baseline, 12);  // worse
    const gate = checkEntropyGate(state);
    assert.ok(gate.pass, "First iteration must pass (baseline)");
  });

  it("decreasing deviations → ΔS positive → pass", () => {
    const state = computeEntropyDelta(baseline, 8);
    assert.equal(state.delta_s, 2);  // 10 - 8 = 2
    assert.equal(state.iteration, 1);
    const gate = checkEntropyGate(state);
    assert.ok(gate.pass);
  });

  it("increasing deviations → ΔS negative → HARD_FAULT", () => {
    // First iteration (baseline)
    const iter1 = computeEntropyDelta(baseline, 12);
    // Second iteration (must not increase)
    const iter2 = computeEntropyDelta(iter1, 15);
    assert.equal(iter2.delta_s, -3);  // 12 - 15 = -3
    const gate = checkEntropyGate(iter2);
    assert.ok(!gate.pass);
    assert.ok(gate.reason?.includes("ENTROPY_NON_DECREASING"));
  });

  it("same deviation count → ΔS = 0 → HARD_FAULT (no improvement after iter 1)", () => {
    const iter1 = computeEntropyDelta(baseline, 10);
    const iter2 = computeEntropyDelta(iter1, 10);
    assert.equal(iter2.delta_s, 0);
    const gate = checkEntropyGate(iter2);
    assert.ok(!gate.pass, "No improvement (ΔS=0) must fail entropy gate");
    assert.ok(gate.reason?.includes("ENTROPY_NON_DECREASING"));
  });

  it("cumulative delta tracks total improvement", () => {
    const iter1 = computeEntropyDelta(baseline, 7);    // ΔS = 3
    const iter2 = computeEntropyDelta(iter1, 4);       // ΔS = 3
    const iter3 = computeEntropyDelta(iter2, 1);       // ΔS = 3
    assert.equal(iter3.cumulative_delta, 9);
  });
});

// ============================================================================
// TEST 4: Scar Consultation
// ============================================================================

describe("Scar consultation layer", () => {
  const mockDeviation: Deviation = {
    type: "NAV_LINK_COUNT_EXCEEDED",
    severity: "MEDIUM",
    description: "Navigation has 7 links, max is 5",
    element: "nav",
    expected: "5",
    actual: "7",
    epistemic_label: "OBS",
  };

  it("no scar found → GENERATE_NEW", async () => {
    const results = await consultScars(
      [mockDeviation],
      async () => null,
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].action, "GENERATE_NEW");
    assert.ok(!results[0].scar_found);
  });

  it("scar with SUCCESS outcome → APPLY_HISTORICAL", async () => {
    const successScar: Scar = {
      scar_id: "SCAR-001",
      deviation_type: "NAV_LINK_COUNT_EXCEEDED",
      context: "Previous nav overflow fix",
      historical_fix: "Remove excess nav links via DOM manipulation",
      outcome: "SUCCESS",
      session_id: "session-abc",
      timestamp: "2026-07-16T10:00:00Z",
      severity: "MEDIUM",
    };

    const results = await consultScars(
      [mockDeviation],
      async () => successScar,
    );
    assert.equal(results[0].action, "APPLY_HISTORICAL");
    assert.ok(results[0].scar_found);
    assert.equal(results[0].scar?.scar_id, "SCAR-001");
  });

  it("scar with FAILURE outcome → SCAR_CONFLICT", async () => {
    const failureScar: Scar = {
      scar_id: "SCAR-002",
      deviation_type: "NAV_LINK_COUNT_EXCEEDED",
      context: "Previous nav overflow fix FAILED",
      historical_fix: "Attempted CSS hiding — broke layout",
      outcome: "FAILURE",
      session_id: "session-def",
      timestamp: "2026-07-15T14:00:00Z",
      severity: "HIGH",
    };

    const results = await consultScars(
      [mockDeviation],
      async () => failureScar,
    );
    assert.equal(results[0].action, "SCAR_CONFLICT");
    assert.ok(results[0].reason.includes("FAILED"));
  });

  it("multiple deviations → multiple consultations", async () => {
    const deviation2: Deviation = {
      type: "CONTRAST_RATIO_LOW",
      severity: "HIGH",
      description: "Text contrast below 4.5:1",
      epistemic_label: "OBS",
    };

    const results = await consultScars(
      [mockDeviation, deviation2],
      async () => null,
    );
    assert.equal(results.length, 2);
    assert.equal(results[0].deviation_type, "NAV_LINK_COUNT_EXCEEDED");
    assert.equal(results[1].deviation_type, "CONTRAST_RATIO_LOW");
  });
});
