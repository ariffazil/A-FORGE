/**
 * P0 Deterministic Pre-Execution Gates — Barrel export.
 *
 * Phase 1: Schema + gate implementations + runner.
 * Phase 2: Integration with A-FORGE tool execution pipeline.
 *
 * Usage:
 *   import { runP0Gates, P0_GATES } from "./p0-gates/index.js";
 *   const result = runP0Gates(P0_GATES, toolName, args, dbState, lease);
 *   if (!result.passed) {
 *     return { blocked: true, reason: result.blockingGate?.reason };
 *   }
 *
 * @module governance/p0-gates
 * @forged 2026-08-03 by 333-AGI
 *
 * DITEMPA BUKAN DIBERI
 */

// Types
export type {
  DBSnapshot,
  LeaseState,
  GateResult,
  GatePredicate,
  GateRegistration,
  GateSuiteResult,
} from "./types.js";

// Gate implementations
export {
  leaseValidityGate,
  reversibilityGate,
  observeBeforeMutateGate,
  blastRadiusGate,
  P0_GATES,
} from "./gates.js";

// Runner
export { runP0Gates } from "./runner.js";
