/**
 * F3: Witness / TRI-WITNESS (Consensus)
 *
 * Minimal enforcement: Validates task input before processing.
 * Not censorship — just execution safety.
 *
 * @module governance/f3Witness
 * @constitutional F3 TRI-WITNESS — W³ consensus starts with clear input
 */

export type WitnessVerdict = "PASS" | "SABAR";

export interface WitnessResult {
  verdict: WitnessVerdict;
  reason?: string;
  message?: string;
}

export interface WitnessThresholds {
  minLength?: number;
  minWords?: number;
}

/**
 * Validate input witness before sense/mind processing.
 * SABAR = patience, need more clarity.
 *
 * NOTE: Intentionally permissive to allow test cases and short tasks.
 * Only blocks completely empty or nonsensical inputs.
 */
export function checkWitness(
  task: string,
  thresholds: WitnessThresholds = {},
): WitnessResult {
  const { minLength = 3, minWords = 1 } = thresholds;
  const trimmed = task?.trim() ?? "";

  // Check empty
  if (!trimmed) {
    return {
      verdict: "SABAR",
      reason: "INPUT_EMPTY",
      message: "Task is empty. Please provide an intent.",
    };
  }

  // Check extremely short
  if (trimmed.length < minLength) {
    return {
      verdict: "SABAR",
      reason: "INPUT_TOO_SHORT",
      message: `Task too short (${trimmed.length} chars). Minimum required: ${minLength}. Please expand your intent.`,
    };
  }

  // Check minimum word count
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < minWords) {
    return {
      verdict: "SABAR",
      reason: "INSUFFICIENT_WORDS",
      message: `Task too brief (${words.length} words). Minimum required: ${minWords}. Please expand your intent.`,
    };
  }

  // Check for gibberish/repetition (e.g., "aaaaaa" or "test test test")
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
