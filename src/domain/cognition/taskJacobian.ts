/**
 * TASK JACOBIAN — Dual-sensitivity kernel types.
 *
 * J = ∂T/∂G — maps how each task in a goal vector responds to
 * changes in governance parameters: risk, scope, authority, time, cost.
 *
 * The Jacobian is what makes the federation metabolic instead of merely
 * reactive. Without it, changing one field forces full re-plan.
 * With it, only high-sensitivity tasks (>0.6) are recalculated.
 *
 * @module cognition/taskJacobian
 * @constitutional F2 TRUTH — every sensitivity claim must be measured, not asserted
 * @constitutional F7 HUMILITY — confidence capped at 0.90 on Jacobian estimates
 * @constitutional F8 GENIUS — local G-estimate = (A·P·E·X)^(1/4) ONLY when
 *   invoked. The CONSTITUTIONAL G lives in arifOS apex_canonical (V3 seal
 *   2026-07-28, G = (A×P×E×X)^(1/4), Φ is a separate scar-gate dimension
 *   — NOT a 5th dial). Older five-factor explanations are stale.
 * @constitutional F11 AUDIT — every Jacobian snapshot is provenance-bound
 */

import { createHash } from "node:crypto";

// ── Constitutional Constants (F2 Truth, F7 Humility, F8 Genius) ──────────────
/** Absolute floating-point epsilon floor. Values below this trigger Nash Collapse. */
export const EPSILON = 1e-6;
/** Aki-Richards sparse threshold: sensitivities below 0.6 are pruned from recompute. */
export const SPARSE_SENSITIVITY_THRESHOLD = 0.6;
/** Quantum Humility Floor Ω₀ ∈ [0.03, 0.05]. Default reserve = 0.04. */
export const QUANTUM_HUMILITY_FLOOR = 0.04;
/** Maximum allowable confidence cap P(truth) ≤ 0.96. 1.0 is pathology. */
export const MAX_ALLOWABLE_CONFIDENCE = 1.0 - QUANTUM_HUMILITY_FLOOR;

// ── Domain / organ tags ──────────────────────────────────────────────────────

/** Federation organs that tasks map to */
export type OrganTag = "arifos" | "aforge" | "geox" | "wealth" | "well" | "aaa";

/** Task domain classification — derived from intent keywords */
export type TaskDomain =
  | "geoscience"    // seismic, basin, petrophysics, prospect
  | "capital"       // npv, risk, portfolio, market
  | "infrastructure" // deploy, build, docker, git
  | "governance"    // judge, seal, vault, memory
  | "human"         // well, vitality, readiness
  | "routing"       // a2a, dispatch, handoff
  | "research"      // search, fetch, observe
  | "unknown";

// ── Sensitivity fields ───────────────────────────────────────────────────────

/**
 * Per-field sensitivity: how much does this task respond to changes
 * in a specific governance parameter?
 *
 * Stored as a number [0, 1] where:
 *   0.0 = completely insensitive
 *   0.3–0.6 = moderate sensitivity — may need re-check
 *   0.6–1.0 = high sensitivity — task MUST be recomputed on field change
 */
export interface TaskSensitivity {
  /** Sensitivity to risk band changes (LOW→MEDIUM→HIGH→CRITICAL) */
  risk: number;
  /** Sensitivity to scope changes (e.g., "auth module" → "entire SSO rewrite") */
  scope: number;
  /** Sensitivity to authority changes (e.g., actor_id rotation) */
  authority: number;
  /** Sensitivity to time constraint changes */
  time: number;
  /** Sensitivity to cost/budget changes */
  cost: number;
  /** Sensitivity to organ routing changes */
  organ: number;
  /** Sensitivity to domain re-classification */
  domain: number;
}

export const ZERO_SENSITIVITY: TaskSensitivity = {
  risk: 0, scope: 0, authority: 0, time: 0, cost: 0, organ: 0, domain: 0,
};

// ── Task provenance — where did this task come from? ─────────────────────────

export interface TaskProvenance {
  /** The original goal intent that spawned this task */
  goal_intent: string;
  /** Hash of the goal text for immutability check */
  goal_hash: string;
  /** The risk band at time of task creation */
  source_risk_band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** The scope at time of task creation */
  source_scope: string;
  /** Which authority (actor_id) created this task */
  source_authority: string;
  /** ISO timestamp of task creation */
  created_at: string;
  /** Number of times this task has been metabolized (failure-adjusted) */
  metabolism_count: number;
  /** Cumulative risk weight multiplier from metabolic adjustments */
  risk_weight_multiplier: number;
  /** Cumulative constraint weight multiplier from metabolic adjustments */
  constraint_weight_multiplier: number;
}

// ── Task vector entry ────────────────────────────────────────────────────────

export interface TaskVectorEntry {
  /** Stable task ID (ulid-style) */
  task_id: string;

  /** Human-readable task description */
  label: string;

  /** Target organ for this task */
  organ: OrganTag;

  /** Domain classification */
  domain: TaskDomain;

  /** MCP tool to invoke */
  tool: string;

  /** Tool arguments (JSON-serializable) */
  args: Record<string, unknown>;

  /** Task IDs that must complete before this one */
  depends_on: string[];

  /** Per-task reversibility */
  reversibility: "reversible" | "irreversible";

  /** Per-task risk tier */
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  /** Jacobian sensitivity matrix for this task */
  sensitivity: TaskSensitivity;

  /** Provenance — where this task came from */
  provenance: TaskProvenance;

  /** Execution state */
  state: "pending" | "running" | "completed" | "failed" | "re_routed";

  /** Contribution to overall G score (efficiency component) */
  g_contribution: number;

  /** Deception sensitivity contribution (from EMD gate) */
  c_dark_contribution: number;

  /** When this task was last re-sensitivity-checked */
  last_sensitivity_check: string | null;

  /** Incremental version of this task (incremented on recompute) */
  version?: number;
}

// ── Goal vector — the full decomposition ─────────────────────────────────────

export interface GoalVector {
  /** Stable goal ID */
  goal_id: string;

  /** Original goal text */
  goal_text: string;

  /** Hash of goal text for integrity */
  goal_hash: string;

  /** Decomposed tasks */
  tasks: TaskVectorEntry[];

  /** Overall governance scalar G */
  G: number;

  /** Deception/anomaly scalar C_dark */
  C_dark: number;

  /** Tri-witness integrity W³ */
  W3: number;

  /** The full Jacobian matrix J = ∂T/∂G */
  jacobian: JacobianMatrix;

  /** ISO timestamp of last Jacobian computation */
  computed_at: string;

  /** Session that computed this Jacobian */
  session_id: string;

  /** Version — increments on each recompute */
  version: number;

  /** Whether this Jacobian has been persisted to VAULT999 */
  sealed: boolean;

  /** VAULT999 seal reference if sealed */
  seal_ref: string | null;
}

// ── Jacobian matrix ──────────────────────────────────────────────────────────

export interface JacobianMatrix {
  /** goal_id this Jacobian belongs to */
  goal_id: string;

  /** Per-task sensitivity entries, keyed by task_id */
  entries: Record<string, TaskSensitivity>;

  /** Overall efficiency scalar ∂G/∂E */
  efficiency: number;

  /** Overall deception sensitivity ∂G/∂C_dark */
  deception_sensitivity: number;

  /** Humbility ceiling h (from F7) */
  humility_cap: number;

  /** Number of high-sensitivity tasks (>0.6 on any field) */
  high_sensitivity_count: number;

  /** Number of stable tasks (all fields <0.3) */
  stable_task_count: number;

  /** Total task count */
  total_task_count: number;

  /** Continuity hash — allows reload on next session */
  continuity_hash: string;
}

// ── Jacobian recompute trigger ───────────────────────────────────────────────

export interface FieldChange {
  /** Which field changed */
  field: keyof TaskSensitivity;
  /** Old value description */
  from: string;
  /** New value description */
  to: string;
}

export interface RecomputeResult {
  /** Which tasks need recompute (sensitivity > 0.6) */
  recompute: string[];
  /** Which tasks are stable (all sensitivities <= 0.6) */
  stable: string[];
  /** Updated Jacobian matrix */
  jacobian: JacobianMatrix;
  /** Updated G score */
  G: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash prefix for integrity */
export function hashGoal(goalText: string): string {
  return createHash("sha256").update(goalText).digest("hex").slice(0, 16);
}

/** Generate a task ID */
let taskCounter = 0;
export function generateTaskId(prefix = "tv"): string {
  taskCounter++;
  return `${prefix}_${Date.now().toString(36)}_${taskCounter.toString(36)}`;
}

/** Generate a goal ID */
export function generateGoalId(prefix = "gv"): string {
  return `${prefix}_${Date.now().toString(36)}`;
}

/** Check if a task needs recompute given a field change */
export function needsRecompute(
  sensitivity: TaskSensitivity,
  changedField: keyof TaskSensitivity,
  threshold = SPARSE_SENSITIVITY_THRESHOLD,
): boolean {
  const val = sensitivity[changedField];
  if (val < EPSILON) return false;
  return val >= threshold;
}

/**
 * Local Jacobian vitality estimate — NOT the canonical G-fold.
 *
 * V3 RATIFIED (2026-07-28, F13 sovereign seal): G = (A×P×E×X)^(1/4).
 * Φ is a separate scar-gate dimension (H·AI·Ext tri-witness), NOT a
 * multiplicative 5th dial. Older five-factor descriptions (G = A·P·E·X·Φ)
 * are stale and must not be re-introduced.
 *
 * Local-estimator divergence: arifOS apex_canonical.py was last updated
 * 2026-07-13 (pre-V3) and STILL computes G = A·P·E·X·Φ. This is a known
 * cross-organ drift awaiting sovereign ratification. P0.1 fix confines
 * this local estimate to the V3 four-dial geometric mean; constitutional
 * G stays in arifOS where the V3 seal belongs.
 *
 * Canonical tool evaluation G = (A·P·E·X)^(1/4) lives ONLY in:
 *   - src/domain/governance/gAuthority.ts (A-FORGE canonical labels)
 *   - arif_think(mode='apex') → apex_canonical V3 (Δ Python substrate)
 *
 * This function is a Ψ-plane actuator heuristic for task sensitivity
 * recompute. Consumers must NOT treat the return as constitutional G.
 * Prefer goal.G only as continuity evidence; re-derive via arif_think apex.
 *
 * @constitutional F8 — local estimate only; kernel G is authoritative
 * @constitutional F7 — humilityCap reserve; never claim ≥0.95 certainty
 * @constitutional F2 — must match V3 four-dial geometric mean; comment
 *   and code must agree on the formula
 */
export function computeGFromJacobian(
  entries: TaskVectorEntry[],
  humilityCap = 0.08,  // F7: Ω₀ ∈ [0.03, 0.05]; reserve; not a multiplicative dial
): number {
  if (entries.length === 0) return 0;

  // A = anomaly resistance (average of (1 - C_dark_contribution))
  const A = entries.reduce((sum, t) => sum + (1 - t.c_dark_contribution), 0) / entries.length;

  // P = provenance integrity (tasks with provenance / total)
  const P = entries.filter((t) => t.provenance.goal_intent.length > 0).length / entries.length;

  // X = cross-agent consistency (tasks mapped to correct organ / total)
  const knownOrgans = entries.filter((t) => t.organ !== "aaa" || t.domain !== "unknown").length;
  const X = knownOrgans / entries.length;

  // E = efficiency from Jacobian (1 - avg sensitivity across all fields)
  const avgSensitivity = entries.reduce((sum, t) => {
    const s = t.sensitivity;
    return sum + (s.risk + s.scope + s.authority + s.time + s.cost + s.organ + s.domain) / 7;
  }, 0) / entries.length;
  const E = 1 - avgSensitivity;

  // FPA & Nash Veto: Hard collapse if any dial drops below EPSILON (1e-6)
  if (A < EPSILON || P < EPSILON || E < EPSILON || X < EPSILON) {
    return 0;
  }

  // V3 four-dial geometric mean (NOT five-factor). Φ is scar-gate, not dial.
  //   G_local = (A · P · E · X)^(1/4)
  //   humilityCap is a reserve — it REDUCES the ceiling, it does not multiply.
  //   The reserve is applied as a post-multiplier ceiling clamp, mirroring
  //   F7 humility reserve semantics, NOT as a 5th dial.
  const product = A * P * E * X;
  if (product < EPSILON) return 0;
  const G = Math.pow(product, 1 / 4) * (1 - humilityCap);

  return Math.round(G * 10000) / 10000;
}

/** Provenance tag — proves this module does not claim canonical G authority */
export const G_FOLD_AUTHORITY = {
  canonical_source: "arif_think.mode=apex",
  local_role: "jacobian_actuator_estimate",
  plane: "Psi",
  invent_g: false,
} as const;

/** Compute C_dark (deception scalar) from task entries */
export function computeCDark(entries: TaskVectorEntry[]): number {
  if (entries.length === 0) return 0;
  const avg = entries.reduce((sum, t) => sum + t.c_dark_contribution, 0) / entries.length;
  return Math.round(avg * 10000) / 10000;
}

/** Compute W³ from task entries (simplified — full tri-witness needs organ probes) */
export function computeW3Simple(entries: TaskVectorEntry[]): number {
  if (entries.length === 0) return 0;
  const completed = entries.filter((t) => t.state === "completed").length;
  const failed = entries.filter((t) => t.state === "failed").length;
  const total = entries.length;

  // W³ ≈ completion rate adjusted for failures
  const raw = completed / total;
  const penalty = failed / total;
  return Math.round(Math.max(0, raw - penalty * 0.5) * 10000) / 10000;
}

/** Build continuity hash so Jacobian can be reloaded across sessions */
export function buildContinuityHash(
  goalId: string,
  entries: TaskVectorEntry[],
  G: number,
): string {
  const payload = `${goalId}:${entries.length}:${G}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}
