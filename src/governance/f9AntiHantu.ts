/**
 * F9: Anti-Hantu / ETHICS (Anti-Dark-Patterns)
 *
 * UPGRADE from redaction-only to intent detection.
 * Redaction ≠ protection. Need explicit injection detection.
 *
 * @module governance/f9AntiHantu
 * @constitutional F9 ETHICS — Anti-manipulation
 */

export type AntiHantuVerdict = "PASS" | "VOID";

export interface AntiHantuResult {
  verdict: AntiHantuVerdict;
  triggeredPatterns?: string[];
  reason?: string;
  message?: string;
}

// Prompt injection / manipulation patterns
const INJECTION_PATTERNS: Array<{ pattern: RegExp; severity: "high" | "critical" }> = [
  { pattern: /ignore\s+(?:all\s+)?(?:previous|earlier|above)\s+(?:instructions?|commands?)/i, severity: "critical" },
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

// F9 Anti-Hantu: arifOS Shadow Detection Patterns
// Only trigger VOID when vocabulary appears WITH manipulation patterns or multiple shadow terms
const SHADOW_PATTERNS: Array<{ pattern: RegExp; vocabulary: string }> = [
  { pattern: /\bmaruah\b/i, vocabulary: "Maruah" },
  { pattern: /\bseal\s+verdict\b/i, vocabulary: "SEAL" },
  { pattern: /[\u03A9\u03C9]/, vocabulary: "Omega (Ω)" }, // Ω
  { pattern: /\bmetabolic\s+pulse\b/i, vocabulary: "Metabolic Pulse" },
  { pattern: /\btri-witness\b/i, vocabulary: "Tri-Witness" },
  { pattern: /\b\u039B2\b/, vocabulary: "Lambda2 (Λ2)" }, // Λ2
];

// System names that are valid references, not shadow patterns
const VALID_SYSTEM_NAMES = ["vault999", "vaulT999", "vault", "arifOS", "A-FORGE", "arifos"];

function isShadowContext(input: string, foundVocab: string[]): boolean {
  // Shadow = vocabulary + manipulation intent OR multiple vocab items
  // NOT just single system name references
  if (foundVocab.length >= 2) return true;

  // Check for manipulation patterns alongside single vocab
  const manipulationPatterns = [
    /delete|wipe|remove|drop|truncate/i,
    /bypass|override|ignore/i,
    /fabricat|谎|假/i,
    /unauthorized|forged|shadow/i,
  ];
  const hasManipulation = manipulationPatterns.some(p => p.test(input));
  if (hasManipulation && foundVocab.length >= 1) return true;

  // Single system name reference is NOT shadow
  const singleSystemRef = foundVocab.every(v => VALID_SYSTEM_NAMES.some(s => v.toLowerCase().includes(s.toLowerCase())));
  if (singleSystemRef && foundVocab.length === 1) return false;

  return foundVocab.length >= 2;
}

export interface ShadowContext {
  sessionId?: string;
  pipelineStage?: string;
  hasTelemetry?: boolean;
}

/**
 * Check for prompt injection and Shadow-arifOS patterns.
 * VOID = void the operation entirely.
 */
export function checkAntiHantu(input: string, context?: ShadowContext): AntiHantuResult {
  const normalized = input.toLowerCase();
  const triggered: string[] = [];

  // 1. Classic Prompt Injection Checks
  for (const { pattern, severity } of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      triggered.push(`${severity}: ${pattern.source.slice(0, 40)}...`);
    }
  }

  // 2. F9 Anti-Hantu: Pattern 1 — Vocabulary Without Structure
  const foundVocab = SHADOW_PATTERNS.filter(p => p.pattern.test(input));
  if (foundVocab.length > 0 && !context?.hasTelemetry) {
    triggered.push(`shadow: Vocabulary detected [${foundVocab.map(v => v.vocabulary).join(", ")}] without telemetry`);
  }

  // 3. F9 Anti-Hantu: Pattern 4 — Identity Forgery (No Session ID)
  if (foundVocab.length > 0 && !context?.sessionId && isShadowContext(input, foundVocab.map(v => v.vocabulary))) {
    triggered.push("shadow: arifOS vocabulary used without valid session_id");
  }

  // 4. F9 Anti-Hantu: Pattern 2 — Pipeline Shortcut
  // If we are at 777_FORGE but skipped 555_HEART (indicated by context)
  // (In practice, this is enforced by the DAG, but we check here for prompt-based mimicry)
  if (normalized.includes("stage 777") && !context?.pipelineStage?.includes("555")) {
    if (!context?.pipelineStage?.includes("777")) { // if context doesn't even know we are in 777
       triggered.push("shadow: Unauthorized Stage 777 activation attempt");
    }
  }

  if (triggered.length > 0) {
    const isShadow = triggered.some(t => t.startsWith("shadow:"));
    return {
      verdict: "VOID",
      triggeredPatterns: triggered,
      reason: isShadow ? "SHADOW_ARIFOS_DETECTED" : "INJECTION_DETECTED",
      message: isShadow
        ? `VOID: Shadow-arifOS detected. Narrative laundering or identity forgery attempt.`
        : `VOID: Potential instruction injection or manipulation detected.`,
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
