/**
 * A-FORGE Executor — TypeScript Execution Hands
 *
 * A-FORGE receives sealed receipts from the Python kernel and
 * executes allowed actions via forge_* tools. Returns result
 * receipts back to the kernel for audit and sealing.
 *
 * Exports:
 *   forgeExecute       — Main entry: take receipt, run actions, return report
 *   registerTool       — Register tools at startup
 *   listTools          — List registered tools
 *   reconcile          — Reconcile an UNKNOWN_OUTCOME receipt (F13-ratified 2026-09-25)
 *   recordUnknownOutcome — Record a UNKNOWN_OUTCOME for later reconcile()
 *   types              — ExecutorReceipt, ActionResult, ExecutionReport, OutcomeClass
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

export {
  forgeExecute,
  registerTool,
  listTools,
  getTool,
  validateReceipt,
} from "./forge.js";
export type { ReceiptValidation } from "./forge.js";
export type {
  ExecutorReceipt,
  ActionResult,
  ExecutionReport,
  ForgeCommand,
  OutcomeClass,
} from "./types.js";
export { outcomeClassFromStatus, ALL_OUTCOME_CLASSES } from "./types.js";
export {
  reconcile,
  reconcileBatch,
  recordUnknownOutcome,
  listUnknownOutcomes,
  clearUnknownOutcomes,
  verifyProbeIndependence,
} from "./reconcile.js";
export type {
  ProbeReceipt,
  ReconcileResult,
  EvidenceBeforeAction,
} from "./reconcile.js";
