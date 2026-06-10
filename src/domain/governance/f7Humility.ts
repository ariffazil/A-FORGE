/**
 * F7: Humility / UNCERTAINTY BAND
 *
 * Proxy confidence calculation — since OpenAI doesn't expose token probs.
 * Uses evidence count, consistency, and tool agreement.
 *
 * @module governance/f7Humility
 * @constitutional F7 HUMILITY — Ω₀ band [0.03, 0.05]
 */

export type HumilityVerdict = "PASS" | "HOLD";

export interface HumilityResult {
  verdict: HumilityVerdict;
  confidence: number;
  uncertainty: number;
  reason?: string;
  message?: string;
}

export interface HumilityContext {
  evidenceCount: number;
  toolCallCount: number;
  turnCount: number;
  hasContradictions?: boolean;
  memoryHits?: number;
}

export interface HumilityThresholds {
  overconfident?: [number, number];
  underconfident?: [number, number];
}

/**
 * Compute proxy confidence without LLM token probabilities.
 * Formula: confidence = min(1.0, evidence*0.2 + toolAgreement*0.3 + stability*0.3)
 */
export function computeHumility(ctx: HumilityContext): number {
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
export function checkHumility(
  ctx: HumilityContext,
  thresholds: HumilityThresholds = {},
): HumilityResult {
  const confidence = computeHumility(ctx);

  // Uncertainty is inverse of confidence, with noise factor
  const uncertainty = 1 - confidence + 0.1; // Base uncertainty of 0.1

  const [ocConf, ocUnc] = thresholds.overconfident ?? [0.85, 0.35];
  const [ucConf, ucTurns] = thresholds.underconfident ?? [0.3, 3];

  // Ω₀ band check
  const overconfident = confidence > ocConf && uncertainty > ocUnc;

  // Also HOLD if very low confidence
  const underconfident = confidence < ucConf && ctx.turnCount > ucTurns;

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
