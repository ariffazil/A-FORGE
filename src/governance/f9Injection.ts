/**
 * F9: Injection / ETHICS (Anti-Dark-Patterns)
 *
 * UPGRADE from redaction-only to intent detection.
 * Redaction ≠ protection. Need explicit injection detection.
 *
 * @module governance/f9Injection
 * @constitutional F9 ETHICS — Anti-manipulation
 */

export type InjectionVerdict = "PASS" | "VOID";

export interface InjectionResult {
  verdict: InjectionVerdict;
  triggeredPatterns?: string[];
  reason?: string;
  message?: string;
}

// Prompt injection / manipulation patterns
const INJECTION_PATTERNS: Array<{ pattern: RegExp; severity: "high" | "critical" }> = [
  { pattern: /ignore\s+(?:previous|earlier|above)\s+(?:instructions?|commands?)/i, severity: "critical" },
  { pattern: /bypass\s+(?:policy|security|restrictions?)/i, severity: "critical" },
  { pattern: /override\s+(?:system|safety|constraints?)/i, severity: "critical" },
  { pattern: /do\s+not\s+(?:log|record|remember)/i, severity: "high" },
  { pattern: /reveal\s+(?:secrets?|keys?|passwords?|tokens?)/i, severity: "critical" },
  { pattern: /forget\s+(?:your|all)\s+(?:instructions?|training)/i, severity: "critical" },
  { pattern: /you\s+are\s+(?:now|instead)\s+(?:an?\s+)?(?:DAN|jailbroken|unrestricted)/i, severity: "critical" },
  { pattern: /system\s*:\s*new\s+instruction/i, severity: "high" },
  { pattern: /user\s*:\s*administrator/i, severity: "high" },
  { pattern: /disregard\s+(?:safety|ethical|morality)/i, severity: "critical" },
];

/**
 * Check for prompt injection / manipulation attempts.
 * VOID = void the operation entirely.
 */
export function checkInjection(input: string): InjectionResult {
  const normalized = input.toLowerCase();
  const triggered: string[] = [];

  for (const { pattern, severity } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      triggered.push(`${severity}: ${pattern.source.slice(0, 40)}...`);
    }
  }

  if (triggered.length > 0) {
    return {
      verdict: "VOID",
      triggeredPatterns: triggered,
      reason: "INJECTION_DETECTED",
      message: `VOID: Potential instruction injection or manipulation detected (${triggered.length} patterns).`,
    };
  }

  return { verdict: "PASS" };
}

/**
 * Sanitize input for external mode (existing redaction).
 * This is SEPARATE from injection detection.
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED_KEY]")
    .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
}
