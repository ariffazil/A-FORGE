/**
 * F11: Auth / AUDITABILITY (Transparent Logs)
 *
 * Contradiction detection across tool calls and responses.
 * Simple heuristics unlock real reasoning integrity.
 *
 * @module governance/f11Auth
 * @constitutional F11 AUTH — No contradictions
 */

export type AuthVerdict = "PASS" | "HOLD";

export interface AuthResult {
  verdict: AuthVerdict;
  contradictions?: string[];
  reason?: string;
  message?: string;
}

// Simple contradiction patterns
const CONTRADICTION_PATTERNS = [
  { a: /\byes\b/i, b: /\bno\b/i, context: 200 },
  { a: /\bsuccess\b/i, b: /\bfailed\b/i, context: 200 },
  { a: /\bexists\b/i, b: /\bdoes not exist\b/i, context: 200 },
  { a: /\bpass\b/i, b: /\bfail\b/i, context: 200 },
  { a: /\bcorrect\b/i, b: /\bincorrect\b/i, context: 200 },
  { a: /\bvalid\b/i, b: /\binvalid\b/i, context: 200 },
];

/**
 * Check for contradictions between messages.
 */
export function checkAuth(messages: string[]): AuthResult {
  const contradictions: string[] = [];

  // Check recent message pairs
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

  // Check tool output contradictions (file exists vs doesn't exist)
  const fileExistsPattern = /file.*(?:exists|found)/i;
  const fileNotExistsPattern = /file.*(?:not found|does not exist|no such file)/i;

  const existsMsgs = messages.filter((m) => fileExistsPattern.test(m));
  const notExistsMsgs = messages.filter((m) => fileNotExistsPattern.test(m));

  if (existsMsgs.length > 0 && notExistsMsgs.length > 0) {
    // Check if they're about the same file (simplified)
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
export function checkResponseAuth(previousContext: string[], newResponse: string): AuthResult {
  return checkAuth([...previousContext, newResponse]);
}
