/**
 * P0 Deterministic Pre-Execution Gates — A-FORGE Tool Middleware.
 *
 * Inserts the P0 gate suite BEFORE tool dispatch in serve.ts.
 * Runs after session gate, before BIJAKSANA constitutional bridge.
 *
 * If any P0 gate rejects, the tool call is short-circuited and
 * the agent receives a structured GateRejection.
 *
 * Based on Reddy et al. (2026) arXiv:2607.07405
 *
 * @module interfaces/mcp/p0GateMiddleware
 * @forged 2026-08-03 by 333-AGI
 *
 * DITEMPA BUKAN DIBERI
 */

import { runP0Gates, P0_GATES } from "../../domain/governance/p0-gates/index.js";
import type { DBSnapshot, GateSuiteResult, LeaseState } from "../../domain/governance/p0-gates/types.js";

/**
 * Context extracted from the tool call for gate evaluation.
 */
export interface ToolCallContext {
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
  actorId: string;
  sct: string | undefined;
}

/**
 * Build a DBSnapshot and LeaseState from the current tool call context.
 * Extracts relevant fields for gate evaluation.
 */
function buildGateState(ctx: ToolCallContext): {
  dbState: DBSnapshot;
  lease: LeaseState;
} {
  const now = Date.now();

  const dbState: DBSnapshot = {
    session: {
      actorId: ctx.actorId,
      sessionId: ctx.sessionId,
      leaseExpiry: null, // populated from actual lease if available
      maxActionClass: "EXECUTE", // conservative default
    },
    filesystem: {
      targetPath: String(ctx.args.path || ctx.args.target || ctx.args.cwd || ""),
      exists: false, // unknown at gate level — observe_before_mutate handles this
      isDirectory: false,
      size: null,
    },
    preReadPerformed: false, // unknown at gate level
  };

  const lease: LeaseState = {
    valid: true,
    expired: false,
    maxActionClass: "EXECUTE",
    actorId: ctx.actorId,
    sessionId: ctx.sessionId,
  };

  return { dbState, lease };
}

/**
 * Run P0 gates against a proposed tool call.
 *
 * @returns GateSuiteResult — if passed=false, the tool call should be blocked.
 */
export function runP0GateMiddleware(ctx: ToolCallContext): GateSuiteResult {
  const { dbState, lease } = buildGateState(ctx);

  // Only gate MUTATE-class tools
  const writeTools = [
    "forge_filesystem", "forge_shell", "forge_git", "forge_execute",
    "forge_vault", "forge_seal", "forge_docker", "forge_receipt_draft",
    "forge_execute_sealed", "arif_forge",
  ];

  const isWrite = writeTools.some((t) => ctx.toolName.includes(t));
  if (!isWrite) {
    // Non-mutating tools skip P0 gates entirely
    return {
      passed: true,
      blockingGate: null,
      evaluations: [],
      latencyMs: 0,
    };
  }

  return runP0Gates(P0_GATES, ctx.toolName, ctx.args, dbState, lease);
}

/**
 * Format a P0 gate rejection as a structured error response suitable
 * for returning to the LLM agent. The agent can read the reason and
 * re-plan to satisfy the gate.
 */
export function formatGateRejection(result: GateSuiteResult): {
  blocked: boolean;
  gate: string;
  reason: string;
  recoverability: string;
} {
  return {
    blocked: true,
    gate: result.blockingGate?.gateId ?? "unknown",
    reason: result.blockingGate?.reason ?? "P0 gate blocked this action.",
    recoverability: "AGENT_CAN_RETRY",
  };
}
