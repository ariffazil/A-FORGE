/**
 * PlanFactory — pure Plan builder from OutcomeSpec + RunConfig (W2 WAJIB).
 *
 * NO I/O. NO LLM. Just decomposition + veto insertion + floor context.
 * The intent decomposer is injected (an LLM-backed decomposer can be
 * added in v0.2; v0.1 accepts explicit task templates).
 *
 * Authority chain (canonical):
 *   OutcomeSpec (P5) + RunConfig
 *     → PlanFactory.build(mission, decomposer) → Plan
 *     → FloorEnforcer (C1) gates each Task
 *     → A-FORGE execute (carries plan_id)
 *     → arifOS WorkflowEngine (Python) executes the plan
 *     → VAULT999 seals the result
 *
 * The Plan is a PROPOSAL. A-FORGE orchestrates; arifOS alone SEALS.
 *
 * Plan: PLAN-2026-06-07-W2-PlanningOrgan
 *
 * @constitutional F1 Amanah — the factory is a pure function; no side effects
 */

import {
  type Mission,
  type MaterializedMission,
  type SensitivityLevel,
  type OutcomeConstraints,
  materialize,
  triggersHold,
  sensitivityRequiresHuman,
  ALWAYS_HOLD_ACTIONS,
} from "../types/outcome-spec.js";
import {
  type Plan,
  type Task,
  type Edge,
  type VetoPoint,
  type ReversibilityClass,
  type RiskTier,
  aggregateReversibility,
  aggregateRisk,
  getToolFloorContext,
  rankRisk,
} from "../types/plan.js";
import {
  newPlanId,
  newMissionId,
  newOutcomeSpecId,
  newVetoId,
} from "../util/id.js";

// ─── Intent decomposer interface ────────────────────────────────────────

/**
 * A TaskTemplate is a pre-decomposition task spec from the LLM agent.
 * v0.1 requires explicit templates; v0.2+ will accept a free-text
 * intent and call the LLM to produce the templates.
 */
export interface TaskTemplate {
  task_id: string;
  tool: string;
  args: Record<string, unknown>;
  depends_on?: string[];
  reversibility_hint?: "reversible" | "irreversible";
  timeout_s?: number;
  label?: string;
}

/**
 * Intent decomposer — pure function from materialized mission to task list.
 * The decomposer does the "human purpose → machine steps" bridge.
 * v0.1 callers pass explicit task lists; v0.2+ will use an LLM-backed
 * decomposer that respects the OutcomeSpec and RunConfig.
 */
export type IntentDecomposer = (
  mat: MaterializedMission
) => TaskTemplate[];

// ─── Default v0.1 decomposer — pass-through (expects task list in inputs) ─

/**
 * The default v0.1 decomposer reads task templates from the OutcomeSpec
 * inputs. To use:
 *   mission.outcome.inputs = { tasks: [TaskTemplate, ...] }
 *
 * If no tasks are provided, the factory returns an error. This is a
 * conscious v0.1 design choice: an LLM-free factory needs the LLM's
 * output to be passed in explicitly.
 */
export const passThroughDecomposer: IntentDecomposer = (mat) => {
  const tasks = mat.outcome.inputs?.["tasks"];
  if (!Array.isArray(tasks)) {
    throw new Error(
      "passThroughDecomposer: mission.outcome.inputs.tasks must be an array of TaskTemplate. " +
        "Provide explicit task templates; an LLM-backed decomposer is v0.2+."
    );
  }
  return tasks as TaskTemplate[];
};

// ─── F1 surface tool set (irreversible, requires F1 AMANAH gate) ──────

/**
 * Tools whose execution has irreversible side effects. The factory
 * automatically tags them as "irreversible" and inserts an F1 AMANAH
 * veto point. (Mirrors the arifOS Python workflow engine's F1_SURFACE_TOOLS.)
 */
export const F1_SURFACE_TOOLS: ReadonlySet<string> = new Set([
  "arif_vault_seal",
  "arif_forge_execute",
  "arif_judge_deliberate",
]);

// ─── Tool → risk tier mapping ──────────────────────────────────────────

/**
 * Default risk tier for tools not explicitly mapped.
 * Tools that touch F1 surface are CRITICAL by default.
 */
export const TOOL_RISK_DEFAULTS: Readonly<Record<string, RiskTier>> = {
  // F1 surface = CRITICAL
  arif_vault_seal: "CRITICAL",
  arif_forge_execute: "CRITICAL",
  arif_judge_deliberate: "CRITICAL",
  // Read/observe = LOW
  arif_sense_observe: "LOW",
  arif_evidence_fetch: "LOW",
  arif_memory_recall: "LOW",
  arif_ops_measure: "LOW",
  arif_floor_status: "LOW",
  // Reason/synthesize = MEDIUM
  arif_mind_reason: "MEDIUM",
  arif_heart_critique: "MEDIUM",
  arif_kernel_route: "MEDIUM",
  arif_session_init: "MEDIUM",
  // Internal workflow = MEDIUM (can become HIGH if F1 tools are inside)
  arifos_workflow_compile: "MEDIUM",
  arifos_workflow_execute: "MEDIUM",
  arifos_plan_build: "MEDIUM",
};

const DEFAULT_TOOL_RISK: RiskTier = "MEDIUM";

/** Look up default risk for a tool. */
export function getDefaultToolRisk(tool: string): RiskTier {
  return TOOL_RISK_DEFAULTS[tool] ?? DEFAULT_TOOL_RISK;
}

// ─── F1 + F8: forbid skip-on-failure on F1 surface ─────────────────────

/**
 * Tools that, if they fail, MUST halt the plan (F8 REVERSIBILITY).
 * The PlanFactory does NOT need to enforce this — the executor will.
 * This constant is exported for downstream consumers (e.g., the Python
 * workflow engine) to import.
 */
export const F1_SURFACE_NO_SKIP: ReadonlySet<string> = F1_SURFACE_TOOLS;

// ─── Build options ─────────────────────────────────────────────────────

export interface PlanBuildOptions {
  /** Identifier of the agent or operator creating the plan. */
  created_by: string;
  /** Set of MCP tool names that the plan can dispatch to. */
  tool_registry: ReadonlyArray<string>;
  /** Optional custom decomposer. Defaults to passThroughDecomposer. */
  decomposer?: IntentDecomposer;
  /** Optional human-readable plan name. */
  name?: string;
  /** Optional mission_id override. If absent, one is generated. */
  mission_id?: string;
}

// ─── Build result ──────────────────────────────────────────────────────

export type PlanBuildResult =
  | { ok: true; plan: Plan; warnings: string[] }
  | { ok: false; errors: string[] };

// ─── PlanFactory — the orchestrator ────────────────────────────────────

/**
 * The factory is a pure function. No state, no I/O. The same mission +
 * same decomposer + same tool_registry → same plan (modulo plan_id and
 * timestamps, which are non-semantic).
 */
export class PlanFactory {
  /**
   * Build a Plan from a Mission.
   *
   * @param mission The Mission (OutcomeSpec + RunConfig + optional name + parent_plan_id)
   * @param options Build options (created_by, tool_registry, decomposer, etc.)
   * @returns PlanBuildResult — either a Plan or a list of validation errors
   */
  build(mission: Mission, options: PlanBuildOptions): PlanBuildResult {
    // 1. Materialize the mission (apply defaults from P5 OutcomeSpec)
    let mat: MaterializedMission;
    try {
      mat = materialize(mission);
    } catch (e) {
      return { ok: false, errors: [`MISSION_MATERIALIZE_FAILED: ${(e as Error).message}`] };
    }

    // 2. Decompose the materialized mission into task templates
    const decomposer = options.decomposer ?? passThroughDecomposer;
    let taskTemplates: TaskTemplate[];
    try {
      taskTemplates = decomposer(mat);
    } catch (e) {
      return { ok: false, errors: [`DECOMPOSE_FAILED: ${(e as Error).message}`] };
    }

    if (!Array.isArray(taskTemplates) || taskTemplates.length === 0) {
      return { ok: false, errors: ["NO_TASKS: decomposer returned empty task list"] };
    }

    // 3. Build tasks + insert veto points + classify
    const errors: string[] = [];
    const warnings: string[] = [];
    const toolRegistry = new Set(options.tool_registry);
    const runAllowedTools = new Set(mat.run.allowed_tools);
    const outcomeToolScope = new Set(mat.outcome.constraints.tool_scope ?? []);
    const allowedTools = effectiveAllowedTools(toolRegistry, runAllowedTools, outcomeToolScope);

    const tasks: Task[] = taskTemplates.map((tt, i) => {
      const tool = tt.tool;
      if (!toolRegistry.has(tool)) {
        errors.push(`task[${i}] '${tt.task_id}': tool '${tool}' not in registry`);
      } else if (!allowedTools.has(tool)) {
        errors.push(
          `task[${i}] '${tt.task_id}': tool '${tool}' outside mission tool allowlist`
        );
      }
      // Reversibility: F1 surface always irreversible; honor explicit hint
      const isF1Surface = F1_SURFACE_TOOLS.has(tool);
      const reversibility: "reversible" | "irreversible" =
        isF1Surface || tt.reversibility_hint === "irreversible"
          ? "irreversible"
          : "reversible";

      // Risk tier: tool default + sensitivity adjustment
      const baseRisk = getDefaultToolRisk(tool);
      const risk = adjustRiskForSensitivity(baseRisk, mat.outcome.sensitivity, tool);

      // Floor context
      const floorContext = [...getToolFloorContext(tool)];

      // Veto point insertion
      const vetoPoint = this.buildVetoPoint(
        tt,
        tool,
        reversibility,
        risk,
        mat.outcome.sensitivity,
        mat.outcome.notifier_channel
      );
      if (vetoPoint) warnings.push(`task[${i}] '${tt.task_id}': veto inserted (${vetoPoint.floor}: ${vetoPoint.reason.slice(0, 60)}...)`);

      return {
        task_id: tt.task_id,
        tool,
        args: tt.args ?? {},
        depends_on: tt.depends_on ?? [],
        reversibility_class: reversibility,
        risk_tier: risk,
        floor_context: floorContext,
        veto_point: vetoPoint,
        timeout_s: tt.timeout_s ?? 60,
        label: tt.label,
      };
    });

    // 4. Validate DAG structure (no missing depends_on, no self-loops)
    const taskIds = new Set(tasks.map((t) => t.task_id));
    if (taskIds.size !== tasks.length) {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const t of tasks) {
        if (seen.has(t.task_id)) duplicates.add(t.task_id);
        seen.add(t.task_id);
      }
      errors.push(`duplicate task_id(s): ${[...duplicates].sort().join(", ")}`);
    }
    for (const t of tasks) {
      for (const dep of t.depends_on) {
        if (dep === t.task_id) {
          errors.push(`task '${t.task_id}': self-dependency in depends_on`);
        } else if (!taskIds.has(dep)) {
          errors.push(`task '${t.task_id}': depends_on '${dep}' is not a known task_id`);
        }
      }
    }
    const cycle = findDependencyCycle(tasks);
    if (cycle) {
      errors.push(`dependency cycle detected: ${cycle.join(" -> ")}`);
    }

    // 5. Build edges (deduplicate)
    const edgeSet = new Set<string>();
    const edges: Edge[] = [];
    for (const t of tasks) {
      for (const dep of t.depends_on) {
        const key = `${dep}->${t.task_id}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ from_task_id: dep, to_task_id: t.task_id });
        }
      }
    }

    // 6. Plan-level classification
    const planReversibility = aggregateReversibility(tasks);
    const planRisk = aggregateRisk(tasks);

    // 7. Veto points list
    const vetoPoints = tasks
      .map((t) => t.veto_point)
      .filter((v): v is VetoPoint => v !== undefined);

    // 8. SOVEREIGN sensitivity → plan-level F13 veto
    if (sensitivityRequiresHuman(mat.outcome.sensitivity)) {
      const planVeto: VetoPoint = {
        veto_id: newVetoId(),
        before_task_id: tasks[0]?.task_id ?? "(no tasks)",
        floor: "F13",
        reason: "F13 SOVEREIGN: OutcomeSpec.sensitivity=SOVEREIGN requires human ratification for the entire plan",
        human_required: true,
        notifier_channel: mat.outcome.notifier_channel,
        inserted_at: new Date().toISOString(),
      };
      vetoPoints.unshift(planVeto);
      warnings.push("plan-level F13 veto inserted (sensitivity=SOVEREIGN)");
    }

    if (errors.length > 0) return { ok: false, errors };

    // 9. Build the plan
    const planId = newPlanId();
    const missionId = options.mission_id ?? newMissionId();

    const plan: Plan = {
      plan_id: planId,
      mission_id: missionId,
      outcome_spec_id: newOutcomeSpecId(),  // OutcomeSpec didn't ship with an id; synthesize
      tasks,
      edges,
      reversibility_class: planReversibility,
      risk_tier: planRisk,
      plan_state: "DRAFT",
      veto_points: vetoPoints,
      created_at: new Date().toISOString(),
      created_by: options.created_by,
      notes: [],
      // F13 SOVEREIGN gate — DRAFT plans always start as HOLD
      judge_verdict: "HOLD",
      judge_state_hash: null,
      name: options.name ?? mission.name ?? "unnamed_plan",
    };

    return { ok: true, plan, warnings };
  }

  // ─── Veto point builder ──────────────────────────────────────────

  private buildVetoPoint(
    tt: TaskTemplate,
    tool: string,
    reversibility: "reversible" | "irreversible",
    risk: RiskTier,
    sensitivity: SensitivityLevel,
    notifierChannel: string | undefined
  ): VetoPoint | undefined {
    const now = new Date().toISOString();

    // Rule 1: Irreversible tasks → F1 AMANAH veto
    if (reversibility === "irreversible") {
      return {
        veto_id: newVetoId(),
        before_task_id: tt.task_id,
        floor: "F1",
        reason: `F1 AMANAH: tool '${tool}' is on the F1 surface (irreversible side effect); F1 gate required before execution`,
        human_required: true,
        notifier_channel: notifierChannel,
        inserted_at: now,
      };
    }

    // Rule 2: HIGH or CRITICAL risk → F13 SOVEREIGN veto
    if (rankRisk(risk) >= rankRisk("HIGH")) {
      return {
        veto_id: newVetoId(),
        before_task_id: tt.task_id,
        floor: "F13",
        reason: `F13 SOVEREIGN: risk_tier=${risk} (tool='${tool}') requires sovereign veto`,
        human_required: true,
        notifier_channel: notifierChannel,
        inserted_at: now,
      };
    }

    // Rule 3: Always-hold actions (e.g., DROP DATABASE) → F13 veto
    if (ALWAYS_HOLD_ACTIONS.includes(tool)) {
      return {
        veto_id: newVetoId(),
        before_task_id: tt.task_id,
        floor: "F13",
        reason: `F13 SOVEREIGN: action '${tool}' is on ALWAYS_HOLD_ACTIONS; never autonomous`,
        human_required: true,
        notifier_channel: notifierChannel,
        inserted_at: now,
      };
    }

    // Rule 4: Sensitivity-driven triggers (e.g., FILE_DELETE @ HIGH)
    if (triggersHold(tool, sensitivity)) {
      return {
        veto_id: newVetoId(),
        before_task_id: tt.task_id,
        floor: "F13",
        reason: `888_HOLD: action '${tool}' triggers HOLD at sensitivity=${sensitivity} (OutcomeSpec HOLD_TRIGGER_MAP)`,
        human_required: true,
        notifier_channel: notifierChannel,
        inserted_at: now,
      };
    }

    return undefined;
  }
}

// ─── Sensitivity → risk tier adjustment ────────────────────────────────

/**
 * Bump a tool's default risk tier based on the mission's sensitivity.
 * SOVEREIGN → every tool is CRITICAL.
 * HIGH → MEDIUM tools become HIGH; HIGH stays HIGH.
 * MEDIUM/LOW → no adjustment.
 */
function adjustRiskForSensitivity(
  baseRisk: RiskTier,
  sensitivity: SensitivityLevel,
  tool: string
): RiskTier {
  // F1 surface is always CRITICAL regardless of sensitivity
  if (F1_SURFACE_TOOLS.has(tool)) return "CRITICAL";

  if (sensitivity === "SOVEREIGN") return "CRITICAL";
  if (sensitivity === "HIGH" && baseRisk === "MEDIUM") return "HIGH";
  return baseRisk;
}

function effectiveAllowedTools(
  toolRegistry: Set<string>,
  runAllowedTools: Set<string>,
  outcomeToolScope: Set<string>
): Set<string> {
  const scopes = [runAllowedTools, outcomeToolScope].filter((scope) => scope.size > 0);
  if (scopes.length === 0) {
    return new Set(toolRegistry);
  }
  let allowed = new Set(scopes[0]);
  for (const scope of scopes.slice(1)) {
    allowed = new Set([...allowed].filter((tool) => scope.has(tool)));
  }
  return new Set([...allowed].filter((tool) => toolRegistry.has(tool)));
}

function findDependencyCycle(tasks: Task[]): string[] | null {
  const byId = new Map(tasks.map((task) => [task.task_id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (taskId: string): string[] | null => {
    if (visiting.has(taskId)) {
      const start = stack.indexOf(taskId);
      return [...stack.slice(start), taskId];
    }
    if (visited.has(taskId)) return null;
    const task = byId.get(taskId);
    if (!task) return null;

    visiting.add(taskId);
    stack.push(taskId);
    for (const dep of task.depends_on) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  };

  for (const task of tasks) {
    const cycle = visit(task.task_id);
    if (cycle) return cycle;
  }
  return null;
}
