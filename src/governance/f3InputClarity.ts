/**
 * F3: Input Clarity / TRI-WITNESS (Consensus)
 *
 * Alternative implementation with context-adaptive thresholds.
 * Validates task input before sense/mind processing.
 *
 * @module governance/f3InputClarity
 * @constitutional F3 TRI-WITNESS — W³ consensus starts with clear input
 */

export type ClarityVerdict = "PASS" | "SABAR";

export interface ClarityResult {
  verdict: ClarityVerdict;
  reason?: string;
  message?: string;
}

export interface ClarityThresholds {
  minLength?: number;
  minWords?: number;
}

/**
 * Validate input clarity before sense/mind processing.
 * SABAR = patience, need more clarity.
 *
 * NOTE: Intentionally permissive to allow test cases and short tasks.
 * Only blocks completely empty or nonsensical inputs.
 */
export function validateInputClarity(
  task: string,
  thresholds: ClarityThresholds = {},
): ClarityResult {
  const { minLength = 3, minWords = 1 } = thresholds;
  const trimmed = task?.trim() ?? "";

  if (!trimmed) {
    return {
      verdict: "SABAR",
      reason: "INPUT_EMPTY",
      message: "Task is empty. Please provide an intent.",
    };
  }

  if (trimmed.length < minLength) {
    return {
      verdict: "SABAR",
      reason: "INPUT_TOO_SHORT",
      message: `Task too short (${trimmed.length} chars). Minimum required: ${minLength}. Please expand your intent.`,
    };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < minWords) {
    return {
      verdict: "SABAR",
      reason: "INSUFFICIENT_WORDS",
      message: `Task too brief (${words.length} words). Minimum required: ${minWords}. Please expand your intent.`,
    };
  }

  if (words.length > 2) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, "")));
    if (uniqueWords.size === 1 && words.length > 3) {
      return {
        verdict: "SABAR",
        reason: "AMBIGUOUS_REPETITION",
        message: "Task appears repetitive. Please clarify your intent.",
      };
    }
  }

  return { verdict: "PASS" };
}

/**
 * Validate with context-adaptive thresholds.
 * stricter for execution/critical, looser for informational/low.
 */
export function validateInputClarityAdaptive(
  task: string,
  intentModel: "informational" | "advisory" | "execution" | "speculative" = "advisory",
  riskLevel: "low" | "medium" | "high" | "critical" = "medium",
): ClarityResult {
  const minLength =
    riskLevel === "critical" ? 30
    : riskLevel === "high" ? 20
    : riskLevel === "medium" ? 10
    : 3;

  const minWords =
    riskLevel === "critical" ? 4
    : riskLevel === "high" ? 3
    : riskLevel === "medium" ? 2
    : 1;

  return validateInputClarity(task, { minLength, minWords });
}