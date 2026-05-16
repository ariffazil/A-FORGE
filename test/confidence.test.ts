/**
 * Tests for F7 (Humility) - Confidence Proxy Implementation
 * 
 * Acceptance Tests:
 * 1. Confidence proxy returns bounded value [0,1]
 * 2. Overconfidence mismatch triggers HOLD
 * 3. ESTIMATE ONLY tag is present
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  detectOverconfidenceMismatch,
  classifyUncertaintyBand,
  formatConfidenceDisplay,
  CONFIDENCE_THRESHOLDS,
  UNCERTAINTY_THRESHOLDS,
} from "../src/policy/confidence.js";

test("calculateConfidenceEstimate - returns bounded value [0,1]", () => {
  // Test with various inputs
  const testCases = [
    { evidence_count: 0, agreement: 0, contradictions: 0, uncertainty: 0 },
    { evidence_count: 10, agreement: 1, contradictions: 0, uncertainty: 0 },
    { evidence_count: 5, agreement: 0.5, contradictions: 3, uncertainty: 0.8 },
    { evidence_count: 100, agreement: 1, contradictions: 10, uncertainty: 1 },
  ];
  
  for (const tc of testCases) {
    const result = calculateConfidenceEstimate(
      tc.evidence_count,
      tc.agreement,
      tc.contradictions,
      tc.uncertainty,
    );
    
    assert.ok(result.value >= 0 && result.value <= 1,
      `Confidence should be in [0,1], got ${result.value} for ${JSON.stringify(tc)}`);
  }
});

test("calculateConfidenceEstimate - includes ESTIMATE ONLY tag", () => {
  const result = calculateConfidenceEstimate(3, 0.8, 0, 0.2);
  
  assert.equal(result.is_estimate, true);
  assert.ok(result.calculation_method.includes("F7_PROXY"));
});

test("calculateConfidenceEstimate - evidence increases confidence", () => {
  const lowEvidence = calculateConfidenceEstimate(0, 1, 0, 0);
  const highEvidence = calculateConfidenceEstimate(10, 1, 0, 0);
  
  assert.ok(highEvidence.value > lowEvidence.value,
    "More evidence should increase confidence");
});

test("calculateConfidenceEstimate - contradictions decrease confidence", () => {
  const noContradictions = calculateConfidenceEstimate(3, 1, 0, 0);
  const withContradictions = calculateConfidenceEstimate(3, 1, 2, 0);
  
  assert.ok(withContradictions.value < noContradictions.value,
    "Contradictions should decrease confidence");
});

test("calculateConfidenceEstimate - uncertainty dampens confidence", () => {
  const lowUncertainty = calculateConfidenceEstimate(3, 1, 0, 0);
  const highUncertainty = calculateConfidenceEstimate(3, 1, 0, 0.9);
  
  assert.ok(highUncertainty.value < lowUncertainty.value,
    "High uncertainty should dampen confidence");
});

test("calculateConfidenceEstimate - tracks all input components", () => {
  const result = calculateConfidenceEstimate(5, 0.75, 1, 0.3);
  
  assert.equal(result.evidence_count, 5);
  assert.equal(result.agreement_score, 0.75);
  assert.equal(result.contradiction_penalty, 0.15);
  assert.equal(result.uncertainty_hint, 0.3);
});

test("detectOverconfidenceMismatch - identifies high confidence + high uncertainty", () => {
  // Overconfidence: confidence > 0.85 AND uncertainty > 0.30
  assert.equal(
    detectOverconfidenceMismatch(0.9, 0.5),
    true,
    "0.9 confidence with 0.5 uncertainty should be overconfident"
  );
  
  assert.equal(
    detectOverconfidenceMismatch(0.9, 0.2),
    false,
    "0.9 confidence with 0.2 uncertainty is not overconfident"
  );
  
  assert.equal(
    detectOverconfidenceMismatch(0.8, 0.5),
    false,
    "0.8 confidence with 0.5 uncertainty is not overconfident (confidence below threshold)"
  );
  
  assert.equal(
    detectOverconfidenceMismatch(0.95, 0.35),
    true,
    "0.95 confidence with 0.35 uncertainty should be overconfident"
  );
});

test("detectOverconfidenceMismatch - uses correct thresholds", () => {
  assert.equal(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, 0.85);
  assert.equal(UNCERTAINTY_THRESHOLDS.OVERCONFIDENCE_MISMATCH, 0.30);
});

test("classifyUncertaintyBand - classifies correctly", () => {
  assert.equal(classifyUncertaintyBand(0.1), "low");
  assert.equal(classifyUncertaintyBand(0.2), "low");
  assert.equal(classifyUncertaintyBand(0.3), "medium");
  assert.equal(classifyUncertaintyBand(0.4), "medium");
  assert.equal(classifyUncertaintyBand(0.5), "high");
  assert.equal(classifyUncertaintyBand(0.6), "high");
  assert.equal(classifyUncertaintyBand(0.7), "critical");
  assert.equal(classifyUncertaintyBand(1.0), "critical");
});

test("evaluateWithConfidence - SEAL for high confidence + low uncertainty", () => {
  const confidence = calculateConfidenceEstimate(5, 0.9, 0, 0.1);
  const result = evaluateWithConfidence(confidence, "low", 0, 5);
  
  assert.equal(result.verdict, "SEAL");
  assert.equal(result.human_review_required, false);
  assert.ok(result.reason.includes("HIGH"));
  assert.equal(result.floors_triggered.length, 0);
});

test("evaluateWithConfidence - HOLD for overconfidence mismatch", () => {
  // High confidence but high uncertainty
  const confidence = calculateConfidenceEstimate(5, 0.95, 0, 0.5);
  const result = evaluateWithConfidence(confidence, "medium", 0, 5);
  
  assert.equal(result.verdict, "HOLD");
  assert.equal(result.human_review_required, true);
  assert.ok(result.reason.includes("OVERCONFIDENCE_MISMATCH"));
  assert.ok(result.floors_triggered.includes("F7_HUMILITY_OVERCONFIDENCE"));
});

test("evaluateWithConfidence - HOLD for contradictions (F11)", () => {
  const confidence = calculateConfidenceEstimate(3, 0.8, 2, 0.2);
  const result = evaluateWithConfidence(confidence, "low", 2, 3);
  
  assert.equal(result.verdict, "HOLD");
  assert.equal(result.human_review_required, true);
  assert.ok(result.reason.includes("CONTRADICTION_FOUND"));
  assert.ok(result.floors_triggered.includes("F11_COHERENCE_CONTRADICTION"));
});

test("evaluateWithConfidence - HOLD for insufficient evidence (F8)", () => {
  const confidence = calculateConfidenceEstimate(0, 0, 0, 0);
  const result = evaluateWithConfidence(confidence, "low", 0, 0);
  
  assert.equal(result.verdict, "HOLD");
  assert.equal(result.human_review_required, true);
  assert.ok(result.reason.includes("INSUFFICIENT_EVIDENCE"));
  assert.ok(result.floors_triggered.includes("F8_GROUNDING_INSUFFICIENT"));
});

test("evaluateWithConfidence - HOLD for medium confidence", () => {
  const confidence = calculateConfidenceEstimate(2, 0.6, 0, 0.3);
  const result = evaluateWithConfidence(confidence, "medium", 0, 2);
  
  assert.equal(result.verdict, "HOLD");
  assert.equal(result.human_review_required, true);
  assert.ok(result.floors_triggered.includes("F7_HUMILITY_MEDIUM_CONFIDENCE"));
});

test("evaluateWithConfidence - HOLD for low confidence/critical uncertainty", () => {
  const confidence = calculateConfidenceEstimate(0, 0, 0, 0.8);
  const result = evaluateWithConfidence(confidence, "critical", 0, 0);
  
  // HOLD is preferred over VOID for recoverable uncertainty
  assert.equal(result.verdict, "HOLD");
  assert.equal(result.human_review_required, true);
});

test("evaluateWithConfidence - includes confidence in result", () => {
  const confidence = calculateConfidenceEstimate(4, 0.85, 0, 0.15);
  const result = evaluateWithConfidence(confidence, "low", 0, 4);
  
  assert.ok(result.confidence);
  assert.equal(result.confidence.is_estimate, true);
  assert.ok(typeof result.confidence.value === "number");
});

test("formatConfidenceDisplay - includes ESTIMATE ONLY warning", () => {
  const confidence = calculateConfidenceEstimate(3, 0.8, 0, 0.2);
  const display = formatConfidenceDisplay(confidence);
  
  assert.match(display, /ESTIMATE ONLY/);
  assert.match(display, /NOT CERTAINTY/);
  assert.match(display, /⚠️/);
});

test("formatConfidenceDisplay - includes all components", () => {
  const confidence = calculateConfidenceEstimate(5, 0.75, 1, 0.3);
  const display = formatConfidenceDisplay(confidence);
  
  assert.match(display, /Value:/);
  assert.match(display, /Method:/);
  assert.match(display, /Evidence count:/);
  assert.match(display, /Agreement score:/);
  assert.match(display, /Contradictions:/);
  assert.match(display, /Uncertainty hint:/);
});

test("Confidence thresholds - values are as specified", () => {
  assert.equal(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, 0.85);
  assert.equal(CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE, 0.60);
  assert.equal(CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE, 0.30);
  assert.equal(CONFIDENCE_THRESHOLDS.CRITICAL_UNCERTAINTY, 0.30);
});

test("Uncertainty thresholds - values are as specified", () => {
  assert.equal(UNCERTAINTY_THRESHOLDS.OVERCONFIDENCE_MISMATCH, 0.30);
  assert.equal(UNCERTAINTY_THRESHOLDS.HIGH_UNCERTAINTY, 0.50);
  assert.equal(UNCERTAINTY_THRESHOLDS.MEDIUM_UNCERTAINTY, 0.30);
});

test("Integration - typical workflow with Sense output", () => {
  // Simulate Sense output
  const senseOutput = {
    evidence_count: 3,
    uncertainty_band: "medium" as const,
    contradiction_flags: 0,
  };
  
  // Calculate confidence from Sense output
  const confidence = calculateConfidenceEstimate(
    senseOutput.evidence_count,
    0.8, // agreement score
    senseOutput.contradiction_flags,
    0.35, // uncertainty hint from band
  );
  
  // Evaluate with Judge
  const judgeResult = evaluateWithConfidence(
    confidence,
    senseOutput.uncertainty_band,
    senseOutput.contradiction_flags,
    senseOutput.evidence_count,
  );
  
  // Medium confidence with medium uncertainty should HOLD
  assert.equal(judgeResult.verdict, "HOLD");
  assert.ok(judgeResult.human_review_required);
  assert.ok(judgeResult.confidence.is_estimate);
});
