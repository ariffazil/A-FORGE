/**
 * METABOLIC LOOP — Failure → weight adjustment engine.
 *
 * The metabolic loop is the learning component of the Jacobian kernel.
 * It adjusts risk weights and constraint weights based on task outcomes:
 *
 *   Task FAIL → risk_weight × 1.2, constraint_weight × 1.2
 *   Task PASS → no change (weights gradually regress toward 1.0)
 *
 * This is what makes the federation learn from execution:
 *   - "this type of task failed under this risk level"
 *   - "next time, increase sensitivity to risk for similar tasks"
 *
 * Before this module: tasks failed silently, no structural learning.
 * After this module: every failure adjusts Jacobian weights for next cycle.
 *
 * @module cognition/metabolicLoop
 * @constitutional F8 GENIUS — learning from failure is constitutional mandate
 * @constitutional F11 AUDIT — every metabolic adjustment is logged
 */

import {
  type TaskVectorEntry,
  type GoalVector,
  computeGFromJacobian,
} from "./taskJacobian.js";

// ── Metabolic constants ──────────────────────────────────────────────────────

/** Risk weight multiplier on task failure */
export const FAILURE_RISK_MULTIPLIER = 1.2;

/** Constraint weight multiplier on task failure */
export const FAILURE_CONSTRAINT_MULTIPLIER = 1.2;

/** Regression rate toward baseline after success (per cycle) */
const REGRESSION_RATE = 0.95;

/** Maximum weight before saturation */
const MAX_WEIGHT = 3.0;

/** Minimum weight (can't go below baseline) */
const MIN_WEIGHT = 0.5;

/** Maximum metabolism cycles before HOLD */
export const MAX_METABOLISM_CYCLES = 5;

// ── Metabolic result ─────────────────────────────────────────────────────────

export interface MetabolicResult {
  /** Which task was metabolized */
  task_id: string;
  /** Previous risk weight */
  previous_risk_weight: number;
  /** New risk weight */
  new_risk_weight: number;
  /** Previous constraint weight */
  previous_constraint_weight: number;
  /** New constraint weight */
  new_constraint_weight: number;
  /** Did this task succeed? */
  success: boolean;
  /** Adjusted sensitivity — was sensitivity increased? */
  sensitivity_adjusted: boolean;
  /** Which sensitivities were adjusted */
  adjusted_fields: string[];
  /** Warning if approaching max metabolism cycles */
  warning: string | null;
}

export interface MetabolicSummary {
  /** Total tasks metabolized this cycle */
  total_metabolized: number;
  /** Tasks that succeeded */
  successes: number;
  /** Tasks that failed */
  failures: number;
  /** Per-task results */
  results: MetabolicResult[];
  /** Updated G score after metabolism */
  G: number;
  /** Updated C_dark after metabolism */
  C_dark: number;
  /** Any tasks approaching HOLD threshold */
  warnings: string[];
}

// ── Per-task metabolism ──────────────────────────────────────────────────────

/**
 * Metabolize a single task — adjust weights based on outcome.
 *
 * On FAILURE:
 *   risk_weight *= 1.2
 *   constraint_weight *= 1.2
 *   sensitivity.risk += 0.1 (bump sensitivity to risk)
 *   sensitivity.authority += 0.05 (slight bump to authority)
 *
 * On SUCCESS:
 *   weights regress toward 1.0 (REGRESSION_RATE)
 */
export function metabolizeTask(
  task: TaskVectorEntry,
  success: boolean,
): MetabolicResult {
  const prevRisk = task.provenance.risk_weight_multiplier;
  const prevConstraint = task.provenance.constraint_weight_multiplier;
  const adjustedFields: string[] = [];

  if (success) {
    // Regress toward baseline
    const newRisk = prevRisk > 1.0
      ? Math.max(1.0, prevRisk - (prevRisk - 1.0) * (1 - REGRESSION_RATE))
      : prevRisk;
    const newConstraint = prevConstraint > 1.0
      ? Math.max(1.0, prevConstraint - (prevConstraint - 1.0) * (1 - REGRESSION_RATE))
      : prevConstraint;

    task.provenance.risk_weight_multiplier = newRisk;
    task.provenance.constraint_weight_multiplier = newConstraint;
    task.provenance.metabolism_count += 1;

    return {
      task_id: task.task_id,
      previous_risk_weight: prevRisk,
      new_risk_weight: newRisk,
      previous_constraint_weight: prevConstraint,
      new_constraint_weight: newConstraint,
      success: true,
      sensitivity_adjusted: false,
      adjusted_fields: [],
      warning: null,
    };
  }

  // FAILURE — increase weights
  const newRisk = Math.min(MAX_WEIGHT, prevRisk * FAILURE_RISK_MULTIPLIER);
  const newConstraint = Math.min(MAX_WEIGHT, prevConstraint * FAILURE_CONSTRAINT_MULTIPLIER);

  task.provenance.risk_weight_multiplier = newRisk;
  task.provenance.constraint_weight_multiplier = newConstraint;
  task.provenance.metabolism_count += 1;

  // Bump sensitivities
  task.sensitivity.risk = Math.min(1.0, task.sensitivity.risk + 0.10);
  adjustedFields.push("risk");

  task.sensitivity.authority = Math.min(1.0, task.sensitivity.authority + 0.05);
  adjustedFields.push("authority");

  // If failure was catastrophic (risk weight > 2.0), also bump scope sensitivity
  if (newRisk > 2.0) {
    task.sensitivity.scope = Math.min(1.0, task.sensitivity.scope + 0.08);
    adjustedFields.push("scope");
  }

  task.last_sensitivity_check = new Date().toISOString();

  // Warning check
  let warning: string | null = null;
  if (task.provenance.metabolism_count >= MAX_METABOLISM_CYCLES) {
    warning = `HOLD_RECOMMENDED: ${task.task_id} has been metabolized ${task.provenance.metabolism_count} times — max cycles reached`;
  } else if (newRisk > 2.5) {
    warning = `HIGH_RISK: ${task.task_id} risk weight ${newRisk.toFixed(2)} — approaching saturation`;
  }

  return {
    task_id: task.task_id,
    previous_risk_weight: prevRisk,
    new_risk_weight: newRisk,
    previous_constraint_weight: prevConstraint,
    new_constraint_weight: newConstraint,
    success: false,
    sensitivity_adjusted: adjustedFields.length > 0,
    adjusted_fields: adjustedFields,
    warning,
  };
}

// ── Full metabolic cycle ─────────────────────────────────────────────────────

export interface MetabolicInput {
  goal: GoalVector;
  /** Per-task outcomes: true = success, false = failure */
  outcomes: Record<string, boolean>;
  /** Humility cap for G recompute */
  humilityCap?: number;
}

/**
 * Run a full metabolic cycle over all tasks.
 *
 * Processes every task, adjusts weights, recomputes G and C_dark.
 * Returns the updated goal with adjusted Jacobian weights.
 */
export function metabolicCycle(input: MetabolicInput): {
  goal: GoalVector;
  summary: MetabolicSummary;
} {
  const { goal, outcomes, humilityCap = 0.04 } = input;
  const results: MetabolicResult[] = [];
  let successes = 0;
  let failures = 0;
  const warnings: string[] = [];

  for (const task of goal.tasks) {
    const success = outcomes[task.task_id] ?? true; // Default: assume success if no data
    const result = metabolizeTask(task, success);

    if (success) {
      successes++;
      task.state = "completed";
    } else {
      failures++;
      task.state = "failed";
    }

    if (result.warning) {
      warnings.push(result.warning);
    }

    results.push(result);
  }

  // Recompute G from adjusted Jacobian
  const G = computeGFromJacobian(goal.tasks, humilityCap);

  // Recompute C_dark
  const totalCDark = goal.tasks.reduce((sum, t) => sum + t.c_dark_contribution, 0) /
    Math.max(goal.tasks.length, 1);

  goal.G = G;
  goal.C_dark = totalCDark;
  goal.version += 1;

  return {
    goal,
    summary: {
      total_metabolized: goal.tasks.length,
      successes,
      failures,
      results,
      G,
      C_dark: totalCDark,
      warnings,
    },
  };
}

// ── Quick metabolism for single task update ──────────────────────────────────

/**
 * Update a single task in a goal vector after execution.
 * Used for incremental metabolism during a running cycle.
 */
export function updateTaskState(
  goal: GoalVector,
  taskId: string,
  newState: "pending" | "running" | "completed" | "failed" | "re_routed",
  success: boolean,
): GoalVector {
  const task = goal.tasks.find((t) => t.task_id === taskId);
  if (!task) return goal;

  task.state = newState;

  if (newState === "completed" || newState === "failed") {
    metabolizeTask(task, success);
  }

  goal.G = computeGFromJacobian(goal.tasks);
  goal.C_dark = goal.tasks.reduce((sum, t) => sum + t.c_dark_contribution, 0) /
    Math.max(goal.tasks.length, 1);

  return goal;
}
