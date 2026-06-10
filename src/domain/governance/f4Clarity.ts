/**
 * F4: Clarity / ENTROPY REDUCTION
 *
 * UPGRADE from pattern-based to delta-risk scoring.
 * Entropy = risk_after - risk_before
 *
 * @module governance/f4Clarity
 * @constitutional F4 CLARITY — dS < 0 (entropy must decrease)
 */

export type ClarityVerdict = "PASS" | "HOLD";

export interface ClarityResult {
  verdict: ClarityVerdict;
  entropyDelta: number;
  riskBefore: number;
  riskAfter: number;
  reason?: string;
  message?: string;
}

// Risk scores for operations
const RISK_SCORES: Record<string, number> = {
  read_file: 0.1,
  list_files: 0.1,
  grep_text: 0.1,
  write_file: 0.5,
  run_tests: 0.3,
  run_command: 0.8,
};

// Additional risk modifiers
const MODIFIER_PATTERNS: Array<{ pattern: RegExp; delta: number }> = [
  { pattern: /delete|remove/i, delta: 0.3 },
  { pattern: /overwrite|replace/i, delta: 0.2 },
  { pattern: /sudo|admin|root/i, delta: 0.4 },
  { pattern: /production|prod|live/i, delta: 0.3 },
];

/**
 * Calculate risk score for a tool operation.
 */
export function calculateRisk(toolName: string, args: Record<string, unknown>): number {
  let risk = RISK_SCORES[toolName] ?? 0.5;

  // Check argument modifiers
  const argString = JSON.stringify(args);
  for (const modifier of MODIFIER_PATTERNS) {
    if (modifier.pattern.test(argString)) {
      risk += modifier.delta;
    }
  }

  return Math.min(1.0, risk);
}

/**
 * Check entropy delta before executing tool.
 * Entropy should DECREASE (clarity should INCREASE) over time.
 *
 * NOTE: First operation is allowed to increase entropy (bootstrapping).
 * Only block if entropy SPIKES after initial operations.
 */
export function checkClarity(
  toolName: string,
  args: Record<string, unknown>,
  previousRisk: number,
  isFirstCall: boolean = false,
): ClarityResult {
  const riskAfter = calculateRisk(toolName, args);
  const entropyDelta = riskAfter - previousRisk;

  // First call gets a pass (bootstrapping)
  if (isFirstCall) {
    return {
      verdict: "PASS",
      entropyDelta,
      riskBefore: previousRisk,
      riskAfter,
    };
  }

  // Threshold: entropy increase > 0.4 is concerning (after first call)
  if (entropyDelta > 0.4) {
    return {
      verdict: "HOLD",
      entropyDelta,
      riskBefore: previousRisk,
      riskAfter,
      reason: "ENTROPY_SPIKE",
      message: `HOLD: Operation increases disorder (ΔS=${entropyDelta.toFixed(2)}). Risk ${previousRisk.toFixed(2)} → ${riskAfter.toFixed(2)}`,
    };
  }

  // Entropy decrease is good (clarity increasing)
  return {
    verdict: "PASS",
    entropyDelta,
    riskBefore: previousRisk,
    riskAfter,
  };
}
