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
 * Canonical vocabulary (F13 RATIFIED 2026-06-20):
 *   SEAL  — proceed, governance satisfied
 *   SABAR — caution/warning, SOFT floor tension
 *   HOLD  — blocked pending human review or condition resolution
 *   VOID  — permanently blocked, constitutional violation
 *
 * CAUTION is retained as a legacy alias for SABAR — accepted everywhere
 * SABAR is used. New code should emit SABAR. Display surfaces emit SABAR.
 */
export type Severity = "SEAL" | "SABAR" | "CAUTION" | "HOLD" | "VOID";

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
}
