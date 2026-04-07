/**
 * F7: Confidence / HUMILITY (Uncertainty Band)
 *
 * Proxy confidence calculation — since OpenAI doesn't expose token probs.
 * Uses evidence count, consistency, and tool agreement.
 *
 * @module governance/f7Confidence
 * @constitutional F7 HUMILITY — Ω₀ band [0.03, 0.05]
 */

export type ConfidenceVerdict = "PASS" | "HOLD";

export interface ConfidenceResult {
  verdict: ConfidenceVerdict;
  confidence: number;
  uncertainty: number;
  reason?: string;
  message?: string;
}

export interface ConfidenceContext {
  evidenceCount: number;
  toolCallCount: number;
  turnCount: number;
  hasContradictions?: boolean;
  memoryHits?: number;
}

/**
 * Compute proxy confidence without LLM token probabilities.
 * Formula: confidence = min(1.0, evidence*0.2 + toolAgreement*0.3 + stability*0.3)
 */
export function computeConfidence(ctx: ConfidenceContext): number {
  // Evidence component (more evidence = higher confidence, max 0.4)
  const evidenceScore = Math.min(0.4, ctx.evidenceCount * 0.15);

  // Tool agreement component (tool execution adds confidence, max 0.3)
  const toolScore = ctx.toolCallCount > 0 ? Math.min(0.3, ctx.toolCallCount * 0.1) : 0.1;

  // Stability component (fewer turns = more stable, max 0.3)
  const stabilityScore = Math.max(0, 0.3 - ctx.turnCount * 0.05);

  // Base confidence
  let confidence = evidenceScore + toolScore + stabilityScore;

  // Penalties
  if (ctx.hasContradictions) {
    confidence *= 0.5; // Heavy penalty for contradictions
  }

  // Memory grounding bonus
  if (ctx.memoryHits && ctx.memoryHits > 0) {
    confidence += Math.min(0.1, ctx.memoryHits * 0.05);
  }

  return Math.min(1.0, Math.max(0.1, confidence));
}

/**
 * Check if confidence is within acceptable band.
 * HOLD if overconfident (high confidence + high uncertainty).
 */
export function checkConfidence(ctx: ConfidenceContext): ConfidenceResult {
  const confidence = computeConfidence(ctx);

  // Uncertainty is inverse of confidence, with noise factor
  const uncertainty = 1 - confidence + 0.1; // Base uncertainty of 0.1

  // Ω₀ band check: if confidence > 0.85 AND uncertainty > 0.35, HOLD
  const overconfident = confidence > 0.85 && uncertainty > 0.35;

  // Also HOLD if very low confidence (< 0.3)
  const underconfident = confidence < 0.3 && ctx.turnCount > 3;

  if (overconfident) {
    return {
      verdict: "HOLD",
      confidence,
      uncertainty,
      reason: "OVERSOLD_CONFIDENCE",
      message: `HOLD: Confidence (${confidence.toFixed(2)}) exceeds uncertainty band. Need more grounding.`,
    };
  }

  if (underconfident) {
    return {
      verdict: "HOLD",
      confidence,
      uncertainty,
      reason: "INSUFFICIENT_CONFIDENCE",
      message: `HOLD: Confidence too low (${confidence.toFixed(2)}) after ${ctx.turnCount} turns.`,
    };
  }

  return {
    verdict: "PASS",
    confidence,
    uncertainty,
  };
}
