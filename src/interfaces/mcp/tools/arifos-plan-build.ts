/**
 * arifos_plan_build — INTERNAL MCP tool (arifos_ prefix).
 *
 * Bridges Operator intent → Plan object. NOT exposed to public MCP
 * `tools/list` — the public 13 (arif_*) surface is preserved.
 *
 * Activation requires F13 sovereign approval to:
 *   1. Register with the main FastMCP instance
 *   2. Add list_tools filter to hide from public
 *   3. Reload the arifOS service
 *
 * Until then, this is a plain TypeScript function callable by internal
 * agents (A-FORGE, OpenClaw, arifbrain, cron jobs).
 *
 * Naming convention (F4 CLARITY):
 *   - External MCP tools: arif_*  (the 13 canonical public tools)
 *   - Internal federation tools: arifos_*  (this tool, workflow tools, etc.)
 *
 * @constitutional F1 Amanah — internal tool, never exposed externally
 */

import { PlanFactory, type PlanBuildResult, type PlanBuildOptions } from "../../../domain/governance/planFactory.js";
import type { Mission } from "../../../domain/types/outcome-spec.js";
import type { Plan } from "../../../domain/types/plan.js";

// Singleton factory — lazy
let _factory: PlanFactory | null = null;
function getFactory(): PlanFactory {
  if (_factory === null) _factory = new PlanFactory();
  return _factory;
}

// ─── INTERNAL_TOOL_NAMES — mirrors arifOS arifosmcp/runtime/internal_tools.py ──

/**
 * Tools the Planning Organ knows about (its tool registry).
 * Mirrors arifOS's PUBLIC_TOOL_NAMES + INTERNAL_TOOL_NAMES union.
 * The arifOS public 13 + the 3 arifos_ internals.
 */
export const PLAN_BUILDER_TOOL_REGISTRY: ReadonlyArray<string> = [
  // arifOS public 13 (external MCP)
  "arif_session_init",
  "arif_sense_observe",
  "arif_mind_reason",
  "arif_heart_critique",
  "arif_judge_deliberate",
  "arif_forge_execute",
  "arif_vault_seal",
  "arif_memory_recall",
  "arif_ops_measure",
  "arif_kernel_route",
  "arif_evidence_fetch",
  "arif_gateway_connect",
  "arif_floor_status",
  // arifos_ internals (arifOS internal MCP)
  "arifos_workflow_compile",
  "arifos_workflow_execute",
  "arifos_plan_build",
];

/**
 * The arifos_plan_build tool entry point.
 * Called by an internal agent (A-FORGE, OpenClaw, etc.).
 *
 * @param mission The Mission (OutcomeSpec + RunConfig) to build a plan from
 * @param created_by Identifier of the agent/operator building the plan
 * @returns PlanBuildResult — either a Plan or a list of validation errors
 */
export function arifos_plan_build(mission: Mission, created_by: string): PlanBuildResult {
  const factory = getFactory();
  const options: PlanBuildOptions = {
    created_by,
    tool_registry: PLAN_BUILDER_TOOL_REGISTRY,
    name: mission.name,
  };
  return factory.build(mission, options);
}

// ─── For A-FORGE integration: also expose a thin wrapper that mirrors
//     the Python arifOS WorkflowEngine.build() contract ────────────────

/**
 * A-FORGE integration helper: takes a Mission and returns a Plan
 * whose shape is compatible with the arifOS Python WorkflowEngine.
 * The Python engine will receive this Plan via A2A and execute it
 * with zero LLM in the loop.
 */
export function buildWorkflowCompatiblePlan(
  mission: Mission,
  created_by: string
): PlanBuildResult {
  return arifos_plan_build(mission, created_by);
}
