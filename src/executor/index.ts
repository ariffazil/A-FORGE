/**
 * A-FORGE Executor — TypeScript Execution Hands
 *
 * A-FORGE receives sealed receipts from the Python kernel and
 * executes allowed actions via forge_* tools. Returns result
 * receipts back to the kernel for audit and sealing.
 *
 * Exports:
 *   forgeExecute  — Main entry: take receipt, run actions, return report
 *   registerTool  — Register tools at startup
 *   listTools     — List registered tools
 *   types         — ExecutorReceipt, ActionResult, ExecutionReport
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

export { forgeExecute, registerTool, listTools, getTool, validateReceipt } from "./forge.js";
export type { ReceiptValidation } from "./forge.js";
export type {
  ExecutorReceipt,
  ActionResult,
  ExecutionReport,
  ForgeCommand,
} from "./types.js";
