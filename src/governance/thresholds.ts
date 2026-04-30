/**
 * Context-Adaptive Governance Thresholds
 *
 * Adjusts F3, F7, and F13 strictness based on intent model and risk level.
 */

export type IntentModel = "informational" | "advisory" | "execution" | "speculative";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AdaptiveThresholds {
  f3: {
    minLength: number;
    minWords: number;
  };
  f7: {
    overconfident: [number, number];
    underconfident: [number, number];
  };
  f13: {
    forceHold: boolean;
  };
}

/**
 * Compute adaptive thresholds for the current operational context.
 * Defaults preserve backward-compatible behavior (medium risk / advisory).
 */
export function getAdaptiveThresholds(
  intentModel: IntentModel = "advisory",
  riskLevel: RiskLevel = "medium",
): AdaptiveThresholds {
  // F3: stricter for execution/critical, looser for informational/low
  // For high/critical risk, defer to F6/F9 pattern matching rather than blocking on length
  const f3MinLength =
    riskLevel === "critical" ? 5
    : riskLevel === "high" ? 5
    : riskLevel === "medium" ? 10
    : 3;

  const f3MinWords =
    riskLevel === "critical" ? 1
    : riskLevel === "high" ? 1
    : riskLevel === "medium" ? 2
    : 1;

  // F7: overconfident [confidenceThreshold, uncertaintyThreshold]
  const f7Overconfident: [number, number] =
    riskLevel === "critical" || intentModel === "speculative"
      ? [0.70, 0.45]
      : riskLevel === "high" || intentModel === "execution"
        ? [0.75, 0.40]
        : riskLevel === "medium" || intentModel === "advisory"
          ? [0.85, 0.35]
          : [0.92, 0.25];

  const f7Underconfident: [number, number] =
    riskLevel === "critical" || intentModel === "speculative"
      ? [0.5, 1]
      : riskLevel === "high" || intentModel === "execution"
        ? [0.4, 2]
        : riskLevel === "medium" || intentModel === "advisory"
          ? [0.3, 3]
          : [0.2, 5];

  // F13: force 888_HOLD for high/critical regardless of mode
  const f13ForceHold = riskLevel === "high" || riskLevel === "critical";

  return {
    f3: { minLength: f3MinLength, minWords: f3MinWords },
    f7: { overconfident: f7Overconfident, underconfident: f7Underconfident },
    f13: { forceHold: f13ForceHold },
  };
}
