/**
 * toolDescriptionPoison.ts — OWASP MCP03 Tool Poisoning Static Analyzer
 *
 * Detects adversarial patterns in tool name/description BEFORE registration.
 * Per OWASP MCP Top 10 (2025), MCP03 control set:
 *  - Model-directed imperatives ("ignore previous instructions")
 *  - Sensitive-path references (~/.ssh, .env, .aws)
 *  - Exfiltration patterns (send/post/upload + URL)
 *  - Zero-width / bidi Unicode smuggling
 *  - Comment-smuggled instructions
 *  - Tool shadowing (duplicate name+schema)
 *
 * Wired into forge.register as Gate 5 (non-compensatory).
 * F12 RESILIENCE — refuse poisoned input. F9 ANTIHANTU — no deception.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 * @constitutional F9 ANTIHANTU — refuse deception
 * @constitutional F12 RESILIENCE — refuse poisoned input
 * Scar mitigation: scar_scar_005 (phantom tool misclassification) — graph can be stale.
 */

import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Pattern library (per OWASP MCP03 detection indicators)
// ─────────────────────────────────────────────────────────────────────────────

/** Zero-width & bidi control characters used to smuggle instructions. */
const ZERO_WIDTH_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;

/** Model-directed imperatives — text aimed at the model, not describing the tool. */
const MODEL_DIRECTIVE_PATTERN = new RegExp(
  [
    // "ignore previous instructions", "ignore all above", "disregard the system prompt"
    String.raw`\b(?:ignore|disregard|forget|skip|bypass)\b[^.]{0,40}\b(?:previous|all|above|prior|system|earlier|initial)\b[^.]{0,40}\b(?:instructions?|prompts?|rules?|context)\b`,
    // "do not tell the user", "without telling the user"
    String.raw`\bdo(?:es)?\s+not\s+(?:tell|inform|mention|reveal|disclose)\s+(?:the\s+)?user\b`,
    // "before answering read X", "after responding send Y"
    String.raw`\b(?:before|after|during|while)\s+(?:answering|responding|replying|executing)\b[^.]{0,60}\b(?:read|send|post|forward|leak|email|curl|wget)\b`,
    // "you must first", "step 1: read"
    String.raw`\byou\s+must\s+(?:first|now|always)\b[^.]{0,40}\b(?:read|send|exfiltrate|curl|wget|fetch)\b`,
  ].join("|"),
  "i"
);

/** Sensitive-path references. */
const SENSITIVE_PATH_PATTERN = new RegExp(
  [
    String.raw`(?:\/|~|\.\/)(?:home\/\w+\/)?(?:\.ssh\/|\.aws\/|\.env|\.gnupg\/|\.kube\/|\.docker\/)`,
    String.raw`\bid_rsa(?:\.pub)?\b`,
    String.raw`\bcredentials?(?:\.json|\.yml|\.yaml)?\b`,
    String.raw`\/etc\/(?:passwd|shadow|sudoers|ssh)\b`,
    String.raw`secrets?(?:\.json|\.yml|\.yaml|manager)?\b`,
  ].join("|"),
  "i"
);

/** Action verbs near external destinations — exfiltration patterns. */
const EXFIL_PATTERN = new RegExp(
  [
    String.raw`\b(?:send|post|upload|forward|transmit|exfiltrate|email|relay|copy|tunnel)\b[^.]{0,60}\b(?:https?:\/\/|webhook|api\.|\.com|\.io|\.net|\.org)\b`,
    String.raw`\b(?:curl|wget|nc|fetch)\b[^.]{0,30}\b(?:https?:\/\/|\/dev\/tcp)\b`,
  ].join("|"),
  "i"
);

/** Hidden comment smuggling (HTML / markdown). */
const HIDDEN_COMMENT_PATTERN = /<!--[\s\S]{0,2000}?(?:instructions?|secret|api[_-]?key|password|token|credential)[\s\S]{0,2000}?-->/i;

/** Excessive authority claims — tool trying to grant itself rights. */
const SELF_AUTHORIZE_PATTERN = new RegExp(
  [
    String.raw`\b(?:this tool|this server|this function)\b[^.]{0,40}\b(?:can|may|will|should)\b[^.]{0,40}\b(?:grant|elevate|escalate|bypass|override|circumvent)\b`,
    String.raw`\b(?:grants?|granting)\s+(?:admin|root|privileged|unrestricted)\b`,
  ].join("|"),
  "i"
);

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Result types
// ─────────────────────────────────────────────────────────────────────────────

export type PoisonSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PoisonScanResult {
  /** True if no patterns matched. */
  clean: boolean;
  /** Human-readable reason if blocked. */
  reason?: string;
  /** Pattern types that matched. */
  patterns_matched: string[];
  /** Highest severity across matched patterns. */
  severity: PoisonSeverity;
  /** Deterministic fingerprint for scar consultation & audit. */
  fingerprint: string;
  /** Scanner version — for backward compatibility. */
  schema_version: string;
}

const SCHEMA_VERSION = "1.0.0";

const SEVERITY_ORDER: Record<PoisonSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function maxSeverity(a: PoisonSeverity, b: PoisonSeverity): PoisonSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Public scan API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan a tool's name + description + parameter-descriptions for poisoning
 * indicators. Runs ONLY static analysis — no execution, no network.
 *
 * @param name           Tool name (e.g., "forge_evaluate")
 * @param description    Tool description (the text the model sees)
 * @param parameters     Optional parameter descriptions
 * @param implementation Optional implementation source (for self-claim detection)
 */
export function scanToolDescription(
  name: string,
  description: string,
  parameters?: string,
  implementation?: string
): PoisonScanResult {
  const corpus = [name, description, parameters ?? "", implementation ?? ""]
    .filter(Boolean)
    .join("\n");

  const matched: string[] = [];
  let severity: PoisonSeverity = "LOW";

  // 1. Zero-width Unicode smuggling (always CRITICAL)
  if (ZERO_WIDTH_PATTERN.test(corpus)) {
    matched.push("zero_width_unicode_smuggling");
    severity = "CRITICAL";
  }

  // 2. Model-directed imperatives (always CRITICAL)
  if (MODEL_DIRECTIVE_PATTERN.test(corpus)) {
    matched.push("model_directive_injection");
    severity = "CRITICAL";
  }

  // 3. Sensitive-path references (HIGH unless already CRITICAL)
  if (SENSITIVE_PATH_PATTERN.test(corpus)) {
    matched.push("sensitive_path_reference");
    severity = maxSeverity(severity, "HIGH");
  }

  // 4. Exfiltration patterns (HIGH unless already CRITICAL)
  if (EXFIL_PATTERN.test(corpus)) {
    matched.push("exfiltration_pattern");
    severity = maxSeverity(severity, "HIGH");
  }

  // 5. Hidden comment smuggling (always CRITICAL)
  if (HIDDEN_COMMENT_PATTERN.test(corpus)) {
    matched.push("hidden_comment_smuggling");
    severity = "CRITICAL";
  }

  // 6. Self-authorization attempts (always CRITICAL)
  if (SELF_AUTHORIZE_PATTERN.test(corpus)) {
    matched.push("self_authorization_attempt");
    severity = "CRITICAL";
  }

  // Compute deterministic fingerprint for scar consultation
  const fingerprint = crypto
    .createHash("sha256")
    .update(`poison-scan-v${SCHEMA_VERSION}|${name}|${matched.sort().join(",")}|${corpus.length}`)
    .digest("hex")
    .slice(0, 16);

  const result: PoisonScanResult = {
    clean: matched.length === 0,
    patterns_matched: matched,
    severity,
    fingerprint,
    schema_version: SCHEMA_VERSION,
  };

  if (matched.length > 0) {
    result.reason = `Poison scan matched: ${matched.join(", ")} (severity=${severity})`;
  }

  return result;
}

/**
 * Convenience wrapper: returns true iff the tool is safe to register.
 */
export function isToolPoisonFree(
  name: string,
  description: string,
  parameters?: string,
  implementation?: string
): { safe: boolean; result: PoisonScanResult } {
  const result = scanToolDescription(name, description, parameters, implementation);
  return {
    safe: result.clean,
    result,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Shadow detection (MCP09) — uses same fingerprint namespace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick check for tool shadowing: two tools with the same name + same description
 * but different implementations. Returns true if `candidate` is a shadow of
 * `existing`.
 */
export function isShadowOf(
  candidate: { name: string; description: string; implementation: string },
  existing: { name: string; description: string; implementation: string }
): boolean {
  if (candidate.name !== existing.name) return false;
  const descHash = crypto
    .createHash("sha256")
    .update(candidate.description)
    .digest("hex");
  const existingDescHash = crypto
    .createHash("sha256")
    .update(existing.description)
    .digest("hex");
  if (descHash !== existingDescHash) return false;
  // Same name + same description but different implementation = shadow
  const implHash = crypto.createHash("sha256").update(candidate.implementation).digest("hex");
  const existingImplHash = crypto.createHash("sha256").update(existing.implementation).digest("hex");
  return implHash !== existingImplHash;
}
