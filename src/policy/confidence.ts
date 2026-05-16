/**
 * F7 (Humility) - Confidence Proxy Implementation
 * 
 * Since LLM APIs don't expose native confidence scores,
 * we compute an ESTIMATE from available telemetry signals.
 * 
 * Constitutional requirement: F7 mandates no hidden certainty.
 * All confidence values must be tagged as ESTIMATE ONLY.
 */

import type { ConfidenceEstimate, JudgeResult, JudgeVerdict } from "../types/session.js";

export const CONFIDENCE_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.85,
  MEDIUM_CONFIDENCE: 0.60,
  LOW_CONFIDENCE: 0.30,
  CRITICAL_UNCERTAINTY: 0.30,
} as const;

export const UNCERTAINTY_THRESHOLDS = {
  OVERCONFIDENCE_MISMATCH: 0.30, // If confidence > 0.85 but uncertainty > 0.30 => overconfidence
  HIGH_UNCERTAINTY: 0.50,
  MEDIUM_UNCERTAINTY: 0.30,
} as const;

/**
 * Calculate confidence estimate from available signals
 * Formula: confidence = min(1, base + evidence_weight + agreement_weight - contradiction_penalty)
 * 
 * @param evidence_count - Number of evidence sources found
 * @param agreement_score - Agreement between sources (0-1)
 * @param contradiction_flags - Number of contradictions detected
 * @param uncertainty_hint - External uncertainty signal (0-1, higher = more uncertain)
 * @returns ConfidenceEstimate with ESTIMATE ONLY tag
 */
export function calculateConfidenceEstimate(
  evidence_count: number,
  agreement_score: number = 1.0,
  contradiction_flags: number = 0,
  uncertainty_hint: number = 0,
): ConfidenceEstimate {
  // Base confidence starts at 0.5 (neutral)
  const base = 0.5;
  
  // Evidence weight: each piece adds up to 0.4 max (0.1 per piece, cap at 4)
  const evidence_weight = Math.min(evidence_count * 0.1, 0.4);
  
  // Agreement weight: scaled by agreement score (0-0.2 range)
  const agreement_weight = agreement_score * 0.2;
  
  // Contradiction penalty: each flag subtracts 0.15
  const contradiction_penalty = Math.min(contradiction_flags * 0.15, 0.45);
  
  // Calculate raw confidence
  const raw_confidence = base + evidence_weight + agreement_weight - contradiction_penalty;
  
  // Apply uncertainty hint as dampening factor
  // High uncertainty_hint reduces confidence
  const uncertainty_dampening = 1 - (uncertainty_hint * 0.3);
  
  // Final bounded confidence
  const value = Math.max(0, Math.min(1, raw_confidence * uncertainty_dampening));
  
  return {
    value,
    is_estimate: true,
    evidence_count,
    agreement_score,
    contradiction_penalty,
    uncertainty_hint,
    calculation_method: "F7_PROXY_v1: min(1, 0.5 + 0.1*evidence + 0.2*agreement - 0.15*contradictions) * uncertainty_dampening",
  };
}

/**
 * Determine if overconfidence mismatch exists
 * F7 enforcement: High confidence + high uncertainty = cognitive dissonance
 * 
 * @param confidence - The confidence estimate
 * @param uncertainty - External uncertainty measure
 * @returns true if overconfidence mismatch detected
 */
export function detectOverconfidenceMismatch(
  confidence: number,
  uncertainty: number,
): boolean {
  return confidence > CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE && 
         uncertainty > UNCERTAINTY_THRESHOLDS.OVERCONFIDENCE_MISMATCH;
}

/**
 * F7-enhanced Judge evaluation
 * Applies confidence proxy to determine verdict
 * 
 * @param confidence_estimate - The calculated confidence
 * @param uncertainty_band - Uncertainty classification
 * @param contradiction_flags - Number of contradictions
 * @param evidence_count - Number of evidence pieces
 * @returns JudgeResult with F7 enforcement
 */
export function evaluateWithConfidence(
  confidence_estimate: ConfidenceEstimate,
  uncertainty_band: "low" | "medium" | "high" | "critical",
  contradiction_flags: number,
  evidence_count: number,
): JudgeResult {
  const floors_triggered: string[] = [];
  let verdict: JudgeVerdict = "HOLD";
  let reason = "Default HOLD pending evaluation";
  let human_review_required = true;
  
  // F7: Check for overconfidence mismatch
  const is_overconfident = detectOverconfidenceMismatch(
    confidence_estimate.value,
    confidence_estimate.uncertainty_hint,
  );
  
  if (is_overconfident) {
    floors_triggered.push("F7_HUMILITY_OVERCONFIDENCE");
    return {
      verdict: "HOLD",
      reason: `OVERCONFIDENCE_MISMATCH: confidence=${confidence_estimate.value.toFixed(2)} but uncertainty=${confidence_estimate.uncertainty_hint.toFixed(2)}. F7 requires humility - human review required.`,
      confidence: confidence_estimate,
      floors_triggered,
      human_review_required: true,
    };
  }
  
  // F11: Coherence check - contradictions block SEAL
  if (contradiction_flags > 0) {
    floors_triggered.push("F11_COHERENCE_CONTRADICTION");
    return {
      verdict: "HOLD",
      reason: `CONTRADICTION_FOUND: ${contradiction_flags} contradiction(s) detected. F11 requires coherence - reconcile before proceeding.`,
      confidence: confidence_estimate,
      floors_triggered,
      human_review_required: true,
    };
  }
  
  // F8: Grounding check - need sufficient evidence
  if (evidence_count < 1) {
    floors_triggered.push("F8_GROUNDING_INSUFFICIENT");
    return {
      verdict: "HOLD",
      reason: `INSUFFICIENT_EVIDENCE: F8 requires grounding - no evidence sources found.`,
      confidence: confidence_estimate,
      floors_triggered,
      human_review_required: true,
    };
  }
  
  // Evaluate confidence levels for verdict
  if (confidence_estimate.value >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE && 
      uncertainty_band === "low") {
    verdict = "SEAL";
    reason = `Confidence ${confidence_estimate.value.toFixed(2)} meets HIGH threshold with LOW uncertainty. F7 satisfied.`;
    human_review_required = false;
  } else if (confidence_estimate.value >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE && 
             uncertainty_band !== "critical") {
    verdict = "HOLD";
    reason = `Confidence ${confidence_estimate.value.toFixed(2)} at MEDIUM level. F7 recommends verification.`;
    floors_triggered.push("F7_HUMILITY_MEDIUM_CONFIDENCE");
    human_review_required = true;
  } else {
    verdict = "VOID";
    reason = `Confidence ${confidence_estimate.value.toFixed(2)} below threshold or uncertainty critical. F7 mandates rejection.`;
    floors_triggered.push("F7_HUMILITY_LOW_CONFIDENCE");
    human_review_required = true;
  }
  
  return {
    verdict,
    reason,
    confidence: confidence_estimate,
    floors_triggered,
    human_review_required,
  };
}

/**
 * Get uncertainty band from numerical value
 */
export function classifyUncertaintyBand(uncertainty: number): "low" | "medium" | "high" | "critical" {
  if (uncertainty <= 0.2) return "low";
  if (uncertainty <= 0.4) return "medium";
  if (uncertainty <= 0.6) return "high";
  return "critical";
}

/**
 * Format confidence for display with ESTIMATE ONLY warning
 */
export function formatConfidenceDisplay(estimate: ConfidenceEstimate): string {
  return `
[CONFIDENCE ESTIMATE - NOT CERTAINTY]
Value: ${(estimate.value * 100).toFixed(1)}%
Method: ${estimate.calculation_method}
Inputs:
  - Evidence count: ${estimate.evidence_count}
  - Agreement score: ${(estimate.agreement_score * 100).toFixed(1)}%
  - Contradictions: ${estimate.contradiction_penalty > 0 ? 'YES' : 'NONE'}
  - Uncertainty hint: ${(estimate.uncertainty_hint * 100).toFixed(1)}%
⚠️  This is an ESTIMATE ONLY - not a calibrated probability
`.trim();
}
