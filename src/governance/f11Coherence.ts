/**
 * F11: Coherence / AUDITABILITY (Transparent Logs)
 *
 * Contradiction detection across tool calls and responses.
 * Simple heuristics unlock real reasoning integrity.
 *
 * @module governance/f11Coherence
 * @constitutional F11 AUDITABILITY — No contradictions
 */

export type CoherenceVerdict = "PASS" | "HOLD";

export interface CoherenceResult {
  verdict: CoherenceVerdict;
  contradictions?: string[];
  reason?: string;
  message?: string;
}

const CONTRADICTION_PATTERNS = [
  { a: /\byes\b/i, b: /\bno\b/i },
  { a: /\bsuccess\b/i, b: /\bfailed\b/i },
  { a: /\bexists\b/i, b: /\bdoes not exist\b/i },
  { a: /\bpass\b/i, b: /\bfail\b/i },
  { a: /\bcorrect\b/i, b: /\bincorrect\b/i },
  { a: /\bvalid\b/i, b: /\binvalid\b/i },
];

const FILE_EXISTS_PATTERN = /file.*(?:exists|found)/i;
const FILE_NOT_EXISTS_PATTERN = /file.*(?:not found|does not exist|no such file)/i;

/**
 * Check for contradictions between messages.
 */
export function checkCoherence(messages: string[]): CoherenceResult {
  const contradictions: string[] = [];

  for (let i = Math.max(0, messages.length - 5); i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];
    if (!current || !next) continue;

    for (const pattern of CONTRADICTION_PATTERNS) {
      const currentHasA = pattern.a.test(current);
      const nextHasB = pattern.b.test(next);
      const currentHasB = pattern.b.test(current);
      const nextHasA = pattern.a.test(next);

      if ((currentHasA && nextHasB) || (currentHasB && nextHasA)) {
        contradictions.push(
          `Contradiction: "${pattern.a.source.replace(/\\b/g, "")}" vs "${pattern.b.source.replace(/\\b/g, "")}"`,
        );
      }
    }
  }

  const existsMsgs = messages.filter((m) => FILE_EXISTS_PATTERN.test(m));
  const notExistsMsgs = messages.filter((m) => FILE_NOT_EXISTS_PATTERN.test(m));

  if (existsMsgs.length > 0 && notExistsMsgs.length > 0) {
    contradictions.push("Contradiction: File existence claims differ");
  }

  if (contradictions.length > 0) {
    return {
      verdict: "HOLD",
      contradictions,
      reason: "CONTRADICTION_DETECTED",
      message: `HOLD: ${contradictions.length} contradiction(s) detected. Please reconcile before proceeding.`,
    };
  }

  return { verdict: "PASS" };
}

/**
 * Check if a new response contradicts previous context.
 */
export function checkResponseCoherence(previousContext: string[], newResponse: string): CoherenceResult {
  return checkCoherence([...previousContext, newResponse]);
}

/**
 * Check tool output for internal contradictions.
 */
export function checkToolOutputCoherence(outputs: string[]): CoherenceResult {
  return checkCoherence(outputs);
}