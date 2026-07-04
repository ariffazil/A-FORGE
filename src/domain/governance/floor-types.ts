/**
 * Floor types — shared types used by all F1-F13 floor implementations
 * and the FloorEnforcer dispatcher.
 *
 * Extracted to avoid circular dependency: floor files import these,
 * FloorEnforcer imports these AND the floor files.
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 */

export type FloorName =
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9"
  | "F10" | "F11" | "F12" | "F13";

/**
 * Constitutional verdict severity.
 *
 * Canonical vocabulary (F13 RATIFIED 2026-06-20, AOB P0 2026-07-03):
 *   SEAL  — proceed, governance satisfied
 *   SABAR — caution/warning, SOFT floor tension, proceed with conditions
 *   HOLD  — blocked pending human review or condition resolution
 *   VOID  — permanently blocked, constitutional violation
 *
 * CAUTION is retained as a legacy alias for SABAR — accepted everywhere
 * SABAR is used. New code should emit SABAR. Display surfaces emit SABAR.
 *
 * NOTE (AOB P0 — 2026-07-03): A-FORGE MUST NOT collapse SABAR → HOLD.
 * SABAR means "proceed with caution." HOLD means "blocked." They are
 * different constitutional signals and benchmark evaluators depend on
 * this distinction.
 */
export type Severity = "SEAL" | "SABAR" | "CAUTION" | "HOLD" | "VOID";

/**
 * Typed verdict reason codes — machine-readable (AOB P0 — 2026-07-03).
 * Mirrors arifOS VerdictReason enum in enforcement_envelope.py.
 */
export type VerdictCode =
  | "OK"
  | "OK.CONDITIONAL"
  | "HOLD.AUTH_REQUIRED"
  | "HOLD.WITNESS_INSUFFICIENT"
  | "HOLD.MODE3_COLLAPSE"
  | "HOLD.FLOOR_VIOLATION"
  | "HOLD.IDENTITY_UNVERIFIED"
  | "HOLD.PARADOX"
  | "HOLD.MANUAL_REVIEW"
  | "SABAR.NEEDS_MORE_EVIDENCE"
  | "SABAR.LOW_CONFIDENCE"
  | "SABAR.WITNESS_DEGRADED"
  | "SABAR.STALE_STATE"
  | "VOID.FLOOR_VIOLATION"
  | "VOID.HANTU"
  | "VOID.INJECTION"
  | "VOID.IRREVERSIBLE_UNAUTHORIZED";

/**
 * Map severity + code to a canonical verdict_code.
 */
export function toVerdictCode(severity: Severity, code: string = ""): VerdictCode {
  const s = canonicalSeverity(severity);
  switch (s) {
    case "SEAL": return "OK";
    case "SABAR": return (code.startsWith("F2_") || code.startsWith("F6_"))
      ? "SABAR.NEEDS_MORE_EVIDENCE"
      : "SABAR.LOW_CONFIDENCE";
    case "HOLD":
      if (code.startsWith("F1_")) return "HOLD.AUTH_REQUIRED";
      if (code.startsWith("F3_")) return code.includes("MODE3") ? "HOLD.MODE3_COLLAPSE" : "HOLD.WITNESS_INSUFFICIENT";
      if (code.startsWith("F5_")) return "HOLD.FLOOR_VIOLATION";
      if (code.startsWith("F7_")) return "HOLD.MANUAL_REVIEW";
      return "HOLD.FLOOR_VIOLATION";
    case "VOID":
      if (code.startsWith("F9_")) return "VOID.HANTU";
      if (code.startsWith("F12_")) return "VOID.INJECTION";
      if (code.startsWith("F1_")) return "VOID.IRREVERSIBLE_UNAUTHORIZED";
      return "VOID.FLOOR_VIOLATION";
    default: return "OK";
  }
}

/**
 * Normalize a severity string to canonical form.
 * CAUTION → SABAR, everything else passes through.
 */
export function canonicalSeverity(s: Severity): "SEAL" | "SABAR" | "HOLD" | "VOID" {
  if (s === "CAUTION") return "SABAR";
  return s;
}

export interface FloorReason {
  floor: FloorName;
  code: string;
  message: string;
  severity: Severity;
  /** Machine-readable reason code (AOB P0 — 2026-07-03) */
  verdict_code?: VerdictCode;
}
