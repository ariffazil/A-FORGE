/**
 * Plan + Task + Edge + VetoPoint — canonical planning organ schemas (W2 WAJIB).
 *
 * The Planning Organ bridges OutcomeSpec (P5 — what/why) and the executor
 * (how, in what order, under which gates). Without a first-class Plan
 * object, missions become "smart agent that does stuff" rather than
 * "governed intelligence machine" — the difference between hobbyist
 * and Perplexity-Computer-class.
 *
 * Authority chain (canonical):
 *   Operator intent → OutcomeSpec + RunConfig
 *     → PlanFactory.build(mission) → Plan
 *     → FloorEnforcer (C1) gates each Task on the way out
 *     → A-FORGE execute (carries plan_id + mission_id)
 *     → arifOS WorkflowEngine (Python) executes the plan
 *     → VAULT999 seals the result
 *
 * The Plan is a PROPOSAL. A-FORGE orchestrates; arifOS alone SEALS.
 * F13 SOVEREIGN gate is at plan level (judge_verdict field).
 *
 * Plan: PLAN-2026-06-07-W2-PlanningOrgan
 * Authority: F13 ratification required for canonical state machine transitions
 *
 * @constitutional F1 Amanah — plan_id is the trust boundary for missions
 */

// ─── Enumerations ───────────────────────────────────────────────────────

export type PlanState =
  | "DRAFT"        // freshly built, not yet judged
  | "REVIEW"       // under human/F13 review
  | "APPROVED"     // judge_verdict=SEAL, ready to execute
  | "RUNNING"      // executor is processing tasks
  | "PAUSED"       // executor paused (human request or budget)
  | "COMPLETED"    // all tasks completed; result sealed
  | "ABORTED";     // human aborted or unrecoverable failure

export type ReversibilityClass = "reversible" | "irreversible" | "mixed";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TaskVerdict = "SEAL" | "HOLD" | "VOID" | "SABAR";

// ─── VetoPoint — explicit gate before an irreversible / SOVEREIGN task ──

export interface VetoPoint {
  /** Stable id (ulid). */
  veto_id: string;
  /** Task that requires this veto to pass before running. */
  before_task_id: string;
  /** Which floor's gate must be cleared (F1, F13, etc.). */
  floor: string;
  /** Human-readable reason. */
  reason: string;
  /** True if a human (F13 SOVEREIGN) must explicitly ratify. */
  human_required: boolean;
  /** Channel to send the HOLD notification (Telegram, Matrix, webhook). */
  notifier_channel?: string;
  /** When the veto was inserted (ISO 8601). */
  inserted_at: string;
}

// ─── Task — single step in a Plan's DAG ─────────────────────────────────

export interface Task {
  /** Stable id (ulid). Unique within the plan. */
  task_id: string;
  /** MCP tool name to invoke. */
  tool: string;
  /** Arguments to pass to the tool. Must be JSON-serializable. */
  args: Record<string, unknown>;
  /** task_ids of tasks that must complete before this one. */
  depends_on: string[];
  /** Per-task reversibility. Plan-level reversibility is computed from this set. */
  reversibility_class: "reversible" | "irreversible";
  /** Per-task risk tier. Plan-level risk_tier = max(task.risk_tier). */
  risk_tier: RiskTier;
  /** Which floors are most relevant to gate this task (e.g., ["F1", "F5", "F12"]). */
  floor_context: string[];
  /** Veto point inserted at this task, if any. */
  veto_point?: VetoPoint;
  /** Per-task wall-clock timeout in seconds. Default: 60. */
  timeout_s: number;
  /** Optional human-readable label. */
  label?: string;
  /** Receipt once executed (populated by executor, not at build time). */
  receipt?: TaskReceipt;
}

// ─── TaskReceipt — execution record of a single task (populated post-hoc) ─

export interface TaskReceipt {
  task_id: string;
  verdict: TaskVerdict;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  args_digest: string;     // SHA-256 hex prefix
  result_digest: string;   // SHA-256 hex prefix
  result_preview?: unknown;
  error?: string;
}

// ─── Edge — DAG edge between two tasks ───────────────────────────────────

export interface Edge {
  from_task_id: string;
  to_task_id: string;
}

// ─── Plan — the first-class planning organ object ───────────────────────

export interface Plan {
  /** Stable id (ulid). The plan's identity. */
  plan_id: string;
  /** Reference to the Mission this plan fulfills. */
  mission_id: string;
  /** Reference to the OutcomeSpec this plan was built from. */
  outcome_spec_id: string;
  /** Ordered list of tasks. Order = declaration order; depends_on = execution order. */
  tasks: Task[];
  /** DAG edges. Derived from task.depends_on but materialized for A-FORGE inspection. */
  edges: Edge[];
  /** Plan-level reversibility. "mixed" if any task is irreversible. */
  reversibility_class: ReversibilityClass;
  /** Plan-level risk = max(task.risk_tier). */
  risk_tier: RiskTier;
  /** Lifecycle state. Default "DRAFT". Transitions: DRAFT → REVIEW → APPROVED → RUNNING → COMPLETED/ABORTED. */
  plan_state: PlanState;
  /** All veto points in the plan. Derived from task.veto_point but materialized for inspection. */
  veto_points: VetoPoint[];
  /** ISO 8601 timestamp of plan creation. */
  created_at: string;
  /** Who created the plan (agent id, operator id, etc.). */
  created_by: string;
  /** Free-form notes added during the plan's lifecycle. */
  notes: string[];
  // ── F13 SOVEREIGN gate ──
  /** arifOS judge verdict on this plan. Default "HOLD". Only "SEAL" permits execution. */
  judge_verdict: TaskVerdict;
  /** Hash of the judge state at time of verdict. Set by arifOS, not the factory. */
  judge_state_hash: string | null;
  /** Optional human-readable name. */
  name?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Risk tier ranking: CRITICAL > HIGH > MEDIUM > LOW. */
export function rankRisk(t: RiskTier): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[t];
}

/** Maximum of two risk tiers. */
export function maxRisk(a: RiskTier, b: RiskTier): RiskTier {
  return rankRisk(a) >= rankRisk(b) ? a : b;
}

/** Aggregate reversibility across a set of tasks. */
export function aggregateReversibility(
  tasks: Pick<Task, "reversibility_class">[]
): ReversibilityClass {
  const hasIrrev = tasks.some((t) => t.reversibility_class === "irreversible");
  const hasRev = tasks.some((t) => t.reversibility_class === "reversible");
  if (hasIrrev && hasRev) return "mixed";
  if (hasIrrev) return "irreversible";
  return "reversible";
}

/** Aggregate risk across a set of tasks. */
export function aggregateRisk(tasks: Pick<Task, "risk_tier">[]): RiskTier {
  return tasks.reduce<RiskTier>((acc, t) => maxRisk(acc, t.risk_tier), "LOW");
}

// ─── Floor-context map (canonical tool → floor list) ────────────────────

/**
 * Maps tool names to the floors most relevant for gating.
 * The executor uses this to populate Task.floor_context at build time.
 * This is the canonical arifOS public-tool floor binding.
 *
 * Keep this list SHORT — only the most relevant 2-4 floors per tool.
 * FloorEnforcer (C1) will still check ALL 13 floors at execution time.
 */
export const TOOL_FLOOR_MAP: Readonly<Record<string, readonly string[]>> = {
  // arifOS public 13 — the canonical binding
  arif_session_init: ["F2", "F11", "F13"],
  arif_sense_observe: ["F2", "F4"],
  arif_mind_reason: ["F2", "F4", "F7"],
  arif_heart_critique: ["F6", "F9"],
  arif_judge_deliberate: ["F1", "F11", "F13"],
  arif_forge_execute: ["F1", "F7", "F11", "F13"],
  arif_vault_seal: ["F1", "F2", "F9", "F11"],
  arif_memory_recall: ["F2", "F10"],
  arif_ops_measure: ["F2", "F4"],
  arif_kernel_route: ["F1", "F2"],
  arif_evidence_fetch: ["F2", "F4", "F10"],
  arif_gateway_connect: ["F1", "F7", "F11"],
  arif_floor_status: ["F4"],
  // arifOS internal (arifos_ prefix) — workflow + planning
  arifos_workflow_compile: ["F1", "F2", "F4"],
  arifos_workflow_execute: ["F1", "F2", "F11"],
  arifos_plan_build: ["F1", "F2", "F4", "F13"],
};

/** Default floor context when a tool is not in TOOL_FLOOR_MAP. */
export const DEFAULT_FLOOR_CONTEXT: readonly string[] = ["F2", "F4"];

/** Look up floor context for a tool. Returns DEFAULT_FLOOR_CONTEXT if not mapped. */
export function getToolFloorContext(tool: string): readonly string[] {
  return TOOL_FLOOR_MAP[tool] ?? DEFAULT_FLOOR_CONTEXT;
}

// ─── DEPRECATED compat shims (pre-W2 types) ──────────────────────────────
//
// The following types lived in plan.ts before W2 and are referenced by:
//   - src/planner/PlanValidator.ts (pre-existing, partial implementation)
//   - test/PlanValidator.test.ts
//   - test/GovernanceCardGate.test.ts
// They are preserved here as DEPRECATED so the build remains green.
// In v0.2, PlanValidator will be rewritten to operate on the W2 Plan type.
// Do NOT use these in new code — use Plan/Task/Edge/VetoPoint instead.

/** @deprecated Use PlanNodeStatus-free `Task` + `plan_state` instead. */
export type PlanNodeStatus =
  | "pending"
  | "authorized"
  | "executing"
  | "completed"
  | "failed";

/** @deprecated Use the canonical `RiskTier` (LOW|MEDIUM|HIGH|CRITICAL) above. */
export type LegacyRiskTier = "safe" | "guarded" | "dangerous";

/** @deprecated Use `Plan` + `Task` + `VetoPoint` for new code. */
export interface EpistemicState {
  confidence: number;
  assumptions: Array<{
    statement: string;
    critical: boolean;
    grounded: boolean;
  }>;
  unknowns: string[];
  riskTier: LegacyRiskTier;
  evidenceCount: number;
  lastValidatedAt?: string;
}

/** @deprecated Use `Task` instead. */
export interface PlanNode {
  id: string;
  goal: string;
  dependencies: string[];
  status: PlanNodeStatus;
  epistemic: EpistemicState;
  metadata?: Record<string, any>;
}

/** @deprecated Use `Plan` instead. */
export interface PlanDAG {
  id: string;
  rootId: string;
  nodes: Map<string, PlanNode>;
  version: number;
  createdAt: string;
}

/** @deprecated Replaced by `WorkflowExecutionResult` in the arifOS Python engine. */
export interface StructuralValidationResult {
  isValid: boolean;
  isAcyclic: boolean;
  rootIntegrity: boolean;
  dependenciesValid: boolean;
  reachability: number;
  maxDepth: number;
  maxBranchingFactor: number;
  complexityScore: number;
  errors: string[];
}
