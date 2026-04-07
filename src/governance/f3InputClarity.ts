/**
 * F3: Input Clarity / TRI-WITNESS (Consensus)
 *
 * Minimal enforcement: Validates task input before processing.
 * Not censorship — just execution safety.
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

/**
 * Validate input clarity before sense/mind processing.
 * SABAR = patience, need more clarity.
 * 
 * NOTE: Intentionally permissive to allow test cases and short tasks.
 * Only blocks completely empty or nonsensical inputs.
 */
export function validateInputClarity(task: string): ClarityResult {
  const trimmed = task?.trim() ?? "";

  // Check empty
  if (!trimmed) {
    return {
      verdict: "SABAR",
      reason: "INPUT_EMPTY",
      message: "Task is empty. Please provide an intent.",
    };
  }

  // Check extremely short (less than 3 chars is likely a typo)
  if (trimmed.length < 3) {
    return {
      verdict: "SABAR",
      reason: "INPUT_TOO_SHORT",
      message: "Task too short. Please expand your intent.",
    };
  }

  // Check for gibberish/repetition (e.g., "aaaaaa" or "test test test")
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
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
