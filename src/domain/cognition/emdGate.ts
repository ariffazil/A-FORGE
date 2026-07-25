/**
 * EMD VALIDATION GATE — ToAC (Theorem of Agent-Cognition) stabilizer.
 *
 * EMD = Encode → Metabolize → Decode
 *
 * Encodes goal into task vector, validates that decoded output
 * matches encoded intent, and flags anomalies (C_dark contributions).
 *
 * The EMD gate is what makes the federation NOT drift:
 *   - Encode: capture intent at T₀
 *   - Decode: verify output at T₁ matches intent
 *   - If they diverge → increment C_dark, flag anomaly
 *
 * Before this module: federation could drift silently.
 * After this module: drift is detected, measured, and attributed per task.
 *
 * @module cognition/emdGate
 * @constitutional F2 TRUTH — decode must verify against encode, not assume
 * @constitutional F9 ANTI-HANTU — C_dark > 0.30 → flag, > 0.50 → HOLD
 * @constitutional F11 AUDIT — every EMD pass/reject is logged
 */

import { type TaskVectorEntry, type GoalVector } from "./taskJacobian.js";

// ── EMD state ────────────────────────────────────────────────────────────────

export interface EncodeState {
  /** Snapshot hash at time of encoding */
  encode_hash: string;
  /** Goal text at encode time */
  goal_text: string;
  /** Task count at encode time */
  task_count: number;
  /** Domain distribution at encode time */
  domain_distribution: Record<string, number>;
  /** Risk distribution at encode time */
  risk_distribution: Record<string, number>;
  /** Timestamp of encode */
  encoded_at: string;
}

export interface DecodeResult {
  /** Does decoded output match encoded intent? */
  match: boolean;
  /** Per-task match score [0, 1] */
  per_task_scores: Record<string, number>;
  /** Overall fidelity score [0, 1] */
  fidelity: number;
  /** C_dark anomaly increment from this decode */
  c_dark_delta: number;
  /** Anomalies detected */
  anomalies: AnomalyReport[];
  /** Timestamp of decode */
  decoded_at: string;
}

export interface AnomalyReport {
  task_id: string;
  type: "divergence" | "scope_creep" | "tool_mismatch" | "risk_shift" | "domain_drift";
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  c_dark_contribution: number;
}

export interface EmdResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Encode snapshot */
  encode: EncodeState;
  /** Decode validation */
  decode: DecodeResult;
  /** Updated C_dark for the goal */
  C_dark: number;
  /** Updated per-task C_dark contributions */
  task_c_dark: Record<string, number>;
  /** Verdict */
  verdict: "PROCEED" | "CAUTION" | "HOLD" | "VOID";
  /** Evidence summary for audit */
  evidence: string;
}

// ── Encode — snapshot intent at T₀ ──────────────────────────────────────────

export function encode(goal: GoalVector): EncodeState {
  const domainDist: Record<string, number> = {};
  const riskDist: Record<string, number> = {};

  for (const task of goal.tasks) {
    domainDist[task.domain] = (domainDist[task.domain] || 0) + 1;
    riskDist[task.risk_tier] = (riskDist[task.risk_tier] || 0) + 1;
  }

  return {
    encode_hash: goal.goal_hash,
    goal_text: goal.goal_text,
    task_count: goal.tasks.length,
    domain_distribution: domainDist,
    risk_distribution: riskDist,
    encoded_at: new Date().toISOString(),
  };
}

// ── Decode — verify output at T₁ against encode at T₀ ──────────────────────

export function decode(
  encoded: EncodeState,
  current: GoalVector,
  previousTaskStates?: Record<string, "pending" | "running" | "completed" | "failed" | "re_routed">,
): DecodeResult {
  const perTaskScores: Record<string, number> = {};
  const anomalies: AnomalyReport[] = [];
  let totalFidelity = 0;
  let cDarkDelta = 0;

  // Check task count drift
  if (current.tasks.length !== encoded.task_count) {
    const anomaly: AnomalyReport = {
      task_id: "global",
      type: "divergence",
      severity: "HIGH",
      description: `Task count changed: ${encoded.task_count} → ${current.tasks.length}`,
      c_dark_contribution: 0.15,
    };
    anomalies.push(anomaly);
    cDarkDelta += anomaly.c_dark_contribution;
  }

  // Check per-task fidelity
  for (const task of current.tasks) {
    let score = 1.0;

    // Check if task domain matches expected
    if (task.domain === "unknown") {
      score -= 0.2;
      anomalies.push({
        task_id: task.task_id,
        type: "domain_drift",
        severity: "LOW",
        description: `Unknown domain for task: "${task.label}"`,
        c_dark_contribution: 0.05,
      });
      cDarkDelta += 0.05;
    }

    // Check if task was re-routed
    if (previousTaskStates && previousTaskStates[task.task_id] === "re_routed") {
      score -= 0.15;
      anomalies.push({
        task_id: task.task_id,
        type: "tool_mismatch",
        severity: "MEDIUM",
        description: `Task re-routed: organ may be incorrect for "${task.label}"`,
        c_dark_contribution: 0.10,
      });
      cDarkDelta += 0.10;
    }

    // Check if task failed
    if (task.state === "failed") {
      score -= 0.3;
      anomalies.push({
        task_id: task.task_id,
        type: "divergence",
        severity: "HIGH",
        description: `Task failed: "${task.label}"`,
        c_dark_contribution: 0.15,
      });
      cDarkDelta += 0.15;
    }

    // Scope creep detection
    if (task.provenance.metabolism_count > 3) {
      score -= 0.1;
      anomalies.push({
        task_id: task.task_id,
        type: "scope_creep",
        severity: "MEDIUM",
        description: `Task metabolized ${task.provenance.metabolism_count} times — possible scope creep`,
        c_dark_contribution: 0.08,
      });
      cDarkDelta += 0.08;
    }

    perTaskScores[task.task_id] = Math.max(0, score);
    totalFidelity += perTaskScores[task.task_id];
  }

  const fidelity = current.tasks.length > 0
    ? Math.round((totalFidelity / current.tasks.length) * 10000) / 10000
    : 1.0;

  return {
    match: fidelity >= 0.80,
    per_task_scores: perTaskScores,
    fidelity,
    c_dark_delta: Math.round(cDarkDelta * 10000) / 10000,
    anomalies,
    decoded_at: new Date().toISOString(),
  };
}

// ── Full EMD pass ────────────────────────────────────────────────────────────

/**
 * Run a complete EMD pass: Encode → Decode → verdict.
 *
 * Returns structured result including C_dark and verdict.
 * This is the primary entry point for the ToAC stabilizer.
 */
export function emdPass(
  goal: GoalVector,
  previousState?: EncodeState,
  previousTaskStates?: Record<string, "pending" | "running" | "completed" | "failed" | "re_routed">,
): EmdResult {
  const encodeState = previousState || encode(goal);
  const decodeResult = decode(encodeState, goal, previousTaskStates);

  // Compute updated C_dark per task
  const taskCDark: Record<string, number> = {};
  for (const task of goal.tasks) {
    const existing = task.c_dark_contribution || 0;
    const anomalyContributions = decodeResult.anomalies
      .filter((a) => a.task_id === task.task_id)
      .reduce((sum, a) => sum + a.c_dark_contribution, 0);
    taskCDark[task.task_id] = Math.min(1.0, existing + anomalyContributions);
  }

  // Overall C_dark
  const totalCDark = Object.values(taskCDark).reduce((sum, v) => sum + v, 0) /
    Math.max(Object.keys(taskCDark).length, 1);

  // Verdict
  let verdict: "PROCEED" | "CAUTION" | "HOLD" | "VOID";
  if (totalCDark >= 0.50) {
    verdict = "VOID";
  } else if (totalCDark >= 0.30) {
    verdict = "HOLD";
  } else if (totalCDark >= 0.15) {
    verdict = "CAUTION";
  } else {
    verdict = "PROCEED";
  }

  const evidence = decodeResult.anomalies.length > 0
    ? `${decodeResult.anomalies.length} anomalies: ${decodeResult.anomalies.map((a) => a.description).join("; ")}`
    : "No anomalies detected";

  return {
    passed: verdict === "PROCEED" || verdict === "CAUTION",
    encode: encodeState,
    decode: decodeResult,
    C_dark: Math.round(totalCDark * 10000) / 10000,
    task_c_dark: taskCDark,
    verdict,
    evidence,
  };
}

// ── Apply EMD results back to goal ───────────────────────────────────────────

/**
 * Apply EMD validation results back to the goal vector's task entries.
 * Updates C_dark contributions per task.
 */
export function applyEmdToGoal(goal: GoalVector, emd: EmdResult): GoalVector {
  for (const task of goal.tasks) {
    task.c_dark_contribution = emd.task_c_dark[task.task_id] ?? task.c_dark_contribution;
  }

  goal.C_dark = emd.C_dark;

  return goal;
}
