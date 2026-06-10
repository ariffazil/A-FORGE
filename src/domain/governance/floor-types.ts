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

export type Severity = "SEAL" | "CAUTION" | "HOLD" | "VOID";

export interface FloorReason {
  floor: FloorName;
  code: string;
  message: string;
  severity: Severity;
}
