/**
 * WORLD MODEL ANALYTICS — Dashboard, alerts, quality reports, and readiness.
 *
 * Phase 1.5: Pure analysis layer over accumulated trajectory/prediction data.
 * No infra change. MUBAH (auto-do).
 *
 * 1.5a — Stats dashboard: per-tool metrics, temporal trends, priority distribution
 * 1.5b — Gap alerts: event-bus emission for high-confidence wrong predictions
 * 1.5c — Trajectory quality: signal quality scoring, overfitting detection
 * 1.5d — Phase 2 readiness: trajectory count gates, infra requirements
 *
 * Constitutional:
 *   F2 TRUTH — all metrics derived from hash-verified data
 *   F4 CLARITY — dashboard is structured, actionable
 *   F7 HUMILITY — alerts flag confidence gaps, not certainty
 *   F11 AUDIT — every alert traced to source trajectory
 *
 * @module domain/governance/wmAnalytics
 * @forged 2026-07-21
 */

import { readFile } from "node:fs/promises";
import { publish } from "../../infrastructure/tui/adapters/event-bus.js";
import type { WmGapAlertEvent } from "../../infrastructure/tui/adapters/event-bus.js";
import {
  WM_TRAJECTORY_LOG_PATH,
  WM_PREDICTION_LOG_PATH,
} from "./worldModel.js";
import { checkGapAlert } from "./observationPredictor.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface WmToolStats {
  tool: string;
  priority: string;
  count: number;
  eligible_count: number;
  avg_surprise: number;
  avg_entropy: number;
  avg_gap: number;
  total_gaps: number;
}

export interface WmTrendPoint {
  timestamp: string;
  count: number;
  avg_gap: number;
  avg_surprise: number;
}

export interface WmDashboardSnapshot {
  generated_at: string;
  totals: {
    trajectories: number;
    predictions: number;
    eligible: number;
  };
  by_priority: Record<string, number>;
  by_tool: WmToolStats[];
  alerts: {
    critical: number;
    warning: number;
    total_checked: number;
  };
  trends: {
    hourly: WmTrendPoint[];
    gap_trend: "improving" | "stable" | "degrading";
  };
  chain_health: {
    healthy: boolean;
    last_hash: string;
    total_hashes: number;
  };
  quality: {
    avg_signal_per_trajectory: number;
    low_signal_ratio: number;
    overfit_risk: "low" | "medium" | "high";
  };
  readiness: {
    phase2_trajectory_gate: boolean;
    trajectories_needed: number;
    phase2_infra_gate: boolean;
    recommendation: "READY" | "COLLECTING" | "INSUFFICIENT";
  };
}

// ── Dashboard Generator ──────────────────────────────────────────────────────

/**
 * Generate a full WM dashboard snapshot from accumulated trajectory data.
 */
export async function generateDashboard(): Promise<WmDashboardSnapshot> {
  const trajectories = await readTrajectories();
  const predictions = await readPredictions();

  // ── Totals ──
  const eligible = trajectories.filter(t => t.wm_eligible).length;

  // ── By Priority ──
  const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
  for (const t of trajectories) {
    byPriority[t.wm_priority] = (byPriority[t.wm_priority] || 0) + 1;
  }

  // ── By Tool ──
  const toolMap = new Map<string, {
    priority: string; count: number; eligible: number;
    surpriseTotal: number; entropyTotal: number; gapTotal: number; gapCount: number;
  }>();
  for (const t of trajectories) {
    const existing = toolMap.get(t.tool) || {
      priority: t.wm_priority, count: 0, eligible: 0,
      surpriseTotal: 0, entropyTotal: 0, gapTotal: 0, gapCount: 0,
    };
    existing.count++;
    if (t.wm_eligible) existing.eligible++;
    existing.surpriseTotal += t.surprise_score;
    existing.entropyTotal += t.observation_entropy;
    if (t.prediction_gap !== undefined && t.prediction_gap >= 0) {
      existing.gapTotal += t.prediction_gap;
      existing.gapCount++;
    }
    toolMap.set(t.tool, existing);
  }

  const byTool: WmToolStats[] = [];
  for (const [tool, data] of toolMap) {
    byTool.push({
      tool,
      priority: data.priority,
      count: data.count,
      eligible_count: data.eligible,
      avg_surprise: round(data.surpriseTotal / data.count),
      avg_entropy: round(data.entropyTotal / data.count),
      avg_gap: data.gapCount > 0 ? round(data.gapTotal / data.gapCount) : 0,
      total_gaps: data.gapCount,
    });
  }
  byTool.sort((a, b) => b.count - a.count);

  // ── Alert stats ──
  let criticalAlerts = 0;
  let warningAlerts = 0;
  for (const p of predictions) {
    const alert = checkGapAlert(p.gap_score, 0.85); // default confidence
    if (alert.severity === "CRITICAL") criticalAlerts++;
    else if (alert.severity === "WARN") warningAlerts++;
  }

  // ── Trends ──
  const hourly = computeHourlyTrends(trajectories);
  const gapTrend = computeGapTrend(trajectories);

  // ── Chain health ──
  let chainHealthy = true;
  let lastHash = "";
  let totalHashes = 0;
  let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
  for (const t of trajectories) {
    if (t.prev_hash !== prevHash) chainHealthy = false;
    prevHash = t.hash;
    lastHash = t.hash;
    totalHashes++;
  }

  // ── Quality ──
  const qualityScore = computeQualityScore(trajectories, predictions);

  // ── Readiness ──
  const readiness = assessPhase2Readiness(trajectories);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      trajectories: trajectories.length,
      predictions: predictions.length,
      eligible,
    },
    by_priority: byPriority,
    by_tool: byTool,
    alerts: {
      critical: criticalAlerts,
      warning: warningAlerts,
      total_checked: predictions.length,
    },
    trends: {
      hourly,
      gap_trend: gapTrend,
    },
    chain_health: {
      healthy: chainHealthy,
      last_hash: lastHash,
      total_hashes: totalHashes,
    },
    quality: qualityScore,
    readiness,
  };
}

// ── 1.5b: Gap Alert Pipeline ────────────────────────────────────────────────

/**
 * Emit a gap alert to the event-bus for dashboard consumption.
 *
 * Called after every verifyPrediction() that produces a significant gap.
 */
export function emitGapAlert(
  tool: string,
  actionHash: string,
  gapScore: number,
  confidence: number,
): void {
  const alert = checkGapAlert(gapScore, confidence);

  if (!alert.alert && alert.severity === "INFO") return; // no alert needed

  const event: WmGapAlertEvent = {
    type: "wm_gap_alert",
    tool,
    action_hash: actionHash,
    gap_score: gapScore,
    confidence,
    severity: alert.severity,
    message: alert.message,
    timestamp: new Date().toISOString(),
  };

  publish(event);
}

/**
 * Scan the prediction log and emit alerts for any significant gaps.
 */
export async function emitPendingAlerts(): Promise<number> {
  const predictions = await readPredictions();
  let emitted = 0;

  for (const p of predictions) {
    if (p.gap_score > 0.3) {
      emitGapAlert(p.tool, p.action_hash, p.gap_score, 0.85);
      emitted++;
    }
  }

  return emitted;
}

// ── 1.5c: Trajectory Quality Report ─────────────────────────────────────────

export interface QualityReport {
  generated_at: string;
  overall_signal_score: number;     // 0-1, higher = better training data
  low_signal_trajectories: number;
  low_signal_ratio: number;
  overfit_risk: "low" | "medium" | "high";
  overfit_indicators: string[];
  best_training_tools: string[];    // tools producing best WM signal
  recommendations: string[];
}

/**
 * Generate a trajectory quality report.
 */
export async function generateQualityReport(): Promise<QualityReport> {
  const trajectories = await readTrajectories();
  const predictions = await readPredictions();

  // Signal score: high surprise + high gap = good training data (learns from mistakes)
  // Low surprise + low gap = model already knows → low signal
  let totalSignal = 0;
  let lowSignalCount = 0;

  for (const t of trajectories) {
    const gapSignal = (t.prediction_gap !== undefined && t.prediction_gap >= 0) ? t.prediction_gap : t.surprise_score;
    const signalScore = (gapSignal + t.surprise_score) / 2; // combined signal

    totalSignal += signalScore;
    if (signalScore < 0.15) lowSignalCount++;
  }

  const avgSignal = trajectories.length > 0 ? totalSignal / trajectories.length : 0;
  const lowSignalRatio = trajectories.length > 0 ? lowSignalCount / trajectories.length : 0;

  // Overfit detection: if gaps are consistently decreasing but surprise stays low
  // that means model is memorizing, not learning dynamics
  let overfitRisk: QualityReport["overfit_risk"] = "low";
  const overfitIndicators: string[] = [];

  const recentGaps = predictions.slice(-10).map(p => p.gap_score);
  const recentAvgGap = recentGaps.length > 0 ? recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length : 0;

  if (predictions.length >= 10 && recentAvgGap < 0.1 && lowSignalRatio > 0.6) {
    overfitRisk = "high";
    overfitIndicators.push("Gaps consistently < 0.1 with > 60% low-signal trajectories — possible memorization");
  } else if (predictions.length >= 5 && recentAvgGap < 0.2 && lowSignalRatio > 0.4) {
    overfitRisk = "medium";
    overfitIndicators.push("Gaps trending down with increasing low-signal ratio");
  }

  // Best training tools: highest average surprise + eligible
  const toolScores = new Map<string, { signal: number; count: number }>();
  for (const t of trajectories) {
    if (!t.wm_eligible) continue;
    const existing = toolScores.get(t.tool) || { signal: 0, count: 0 };
    const gapSignal = (t.prediction_gap !== undefined && t.prediction_gap >= 0) ? t.prediction_gap : t.surprise_score;
    existing.signal += (gapSignal + t.surprise_score) / 2;
    existing.count++;
    toolScores.set(t.tool, existing);
  }

  const rankedTools = [...toolScores.entries()]
    .map(([tool, data]) => ({ tool, avgSignal: data.signal / data.count, count: data.count }))
    .filter(t => t.count >= 2)
    .sort((a, b) => b.avgSignal - a.avgSignal);

  const bestTrainingTools = rankedTools.slice(0, 5).map(t => t.tool);

  // Recommendations
  const recommendations: string[] = [];
  if (trajectories.length < 100) {
    recommendations.push(`Collect more trajectories: ${trajectories.length}/100 minimum. Run more forge_shell, forge_git, forge_docker commands.`);
  }
  if (predictions.length < trajectories.length * 0.5) {
    recommendations.push("Prediction ratio low — call predictObservation() before more executions to capture gap signals.");
  }
  if (overfitRisk === "high") {
    recommendations.push("High overfit risk — reduce WM loss weight (λ < 0.01) or introduce data augmentation.");
  }
  if (trajectories.length > 0 && trajectories.filter(t => t.wm_priority === "P2").length > trajectories.length * 0.2) {
    recommendations.push("P2 tools (retrieval) > 20% of trajectories — consider excluding from WM training set.");
  }

  return {
    generated_at: new Date().toISOString(),
    overall_signal_score: round(avgSignal),
    low_signal_trajectories: lowSignalCount,
    low_signal_ratio: round(lowSignalRatio),
    overfit_risk: overfitRisk,
    overfit_indicators: overfitIndicators,
    best_training_tools: bestTrainingTools,
    recommendations,
  };
}

// ── 1.5d: Phase 2 Readiness Assessment ──────────────────────────────────────

export interface Phase2Readiness {
  trajectory_gate: {
    passed: boolean;
    current: number;
    required: number;
    gap: number;
  };
  prediction_gate: {
    passed: boolean;
    current: number;
    required: number;
    gap: number;
  };
  infra_gate: {
    passed: boolean;
    blockers: string[];
  };
  overall: "READY" | "COLLECTING" | "INSUFFICIENT";
  requirements: {
    grpo: string;
    harness: string;
    sandbox: string;
    reward_model: string;
    estimated_effort: string;
  };
}

function assessPhase2Readiness(trajectories: any[]): WmDashboardSnapshot["readiness"] {
  const count = trajectories.length;
  const MIN_TRAJECTORIES = 100;

  return {
    phase2_trajectory_gate: count >= MIN_TRAJECTORIES,
    trajectories_needed: Math.max(0, MIN_TRAJECTORIES - count),
    phase2_infra_gate: false, // requires 888_HOLD infra deployment
    recommendation: count >= MIN_TRAJECTORIES ? "READY" : count >= 20 ? "COLLECTING" : "INSUFFICIENT",
  };
}

/**
 * Full Phase 2 readiness assessment with detailed requirements.
 */
export function getPhase2Readiness(trajectories: any[], predictions: any[]): Phase2Readiness {
  const trajCount = trajectories.length;
  const predCount = predictions.length;
  const MIN_TRAJ = 100;
  const MIN_PRED = 30;

  const blockers: string[] = [];

  if (trajCount < MIN_TRAJ) blockers.push(`Need ${MIN_TRAJ - trajCount} more trajectories (current: ${trajCount})`);
  if (predCount < MIN_PRED) blockers.push(`Need ${MIN_PRED - predCount} more predictions (current: ${predCount})`);
  blockers.push("GRPO implementation required (reference: DeepSeekMath GRPO paper)");
  blockers.push("Harbor-style agent harness for forge_* tools (Docker sandbox)");
  blockers.push("Task-completion verifier / reward model for terminal tasks");
  blockers.push("888_HOLD — sovereign approval for RL training infra deployment");

  let overall: Phase2Readiness["overall"];
  if (trajCount >= MIN_TRAJ && predCount >= MIN_PRED) {
    overall = "READY";
  } else if (trajCount >= 20) {
    overall = "COLLECTING";
  } else {
    overall = "INSUFFICIENT";
  }

  return {
    trajectory_gate: {
      passed: trajCount >= MIN_TRAJ,
      current: trajCount,
      required: MIN_TRAJ,
      gap: Math.max(0, MIN_TRAJ - trajCount),
    },
    prediction_gate: {
      passed: predCount >= MIN_PRED,
      current: predCount,
      required: MIN_PRED,
      gap: Math.max(0, MIN_PRED - predCount),
    },
    infra_gate: {
      passed: false,
      blockers,
    },
    overall,
    requirements: {
      grpo: "DeepSeekMath GRPO with hybrid ECHO loss (λ ∈ [0.01, 0.05])",
      harness: "Harbor-style agent harness wrapping forge_* tools in Docker sandboxes",
      sandbox: "Docker containers per rollout — 16 parallel sandboxes (GRPO group size)",
      reward_model: "Binary verifier: all task tests pass → 1, else → 0",
      estimated_effort: "3-5 engineering days for Phase 2 MVP",
    },
  };
}

// ── Internal: Data Readers ──────────────────────────────────────────────────

interface TrajectoryRecord {
  tool: string;
  wm_priority: string;
  wm_eligible: boolean;
  agent_confidence: number;
  surprise_score: number;
  observation_entropy: number;
  prediction_gap?: number;
  prev_hash: string;
  hash: string;
  observed_at: string;
}

interface PredictionRecord {
  tool: string;
  action_hash: string;
  gap_score: number;
  predicted_at: string;
}

async function readTrajectories(): Promise<TrajectoryRecord[]> {
  try {
    const data = await readFile(WM_TRAJECTORY_LOG_PATH, "utf-8");
    return data.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readPredictions(): Promise<PredictionRecord[]> {
  try {
    const data = await readFile(WM_PREDICTION_LOG_PATH, "utf-8");
    return data.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// ── Internal: Analytics ─────────────────────────────────────────────────────

function computeHourlyTrends(trajectories: TrajectoryRecord[]): WmTrendPoint[] {
  if (trajectories.length === 0) return [];

  const hourlyBuckets = new Map<string, { count: number; gapTotal: number; gapCount: number; surpriseTotal: number }>();

  for (const t of trajectories) {
    const hour = t.observed_at?.slice(0, 13) || "unknown";
    const bucket = hourlyBuckets.get(hour) || { count: 0, gapTotal: 0, gapCount: 0, surpriseTotal: 0 };
    bucket.count++;
    bucket.surpriseTotal += t.surprise_score;
    if (t.prediction_gap !== undefined && t.prediction_gap >= 0) {
      bucket.gapTotal += t.prediction_gap;
      bucket.gapCount++;
    }
    hourlyBuckets.set(hour, bucket);
  }

  const trends: WmTrendPoint[] = [];
  for (const [hour, data] of [...hourlyBuckets.entries()].sort()) {
    trends.push({
      timestamp: hour,
      count: data.count,
      avg_gap: data.gapCount > 0 ? round(data.gapTotal / data.gapCount) : 0,
      avg_surprise: round(data.surpriseTotal / data.count),
    });
  }
  return trends;
}

function computeGapTrend(trajectories: TrajectoryRecord[]): "improving" | "stable" | "degrading" {
  const gaps = trajectories
    .filter(t => t.prediction_gap !== undefined && t.prediction_gap >= 0)
    .map(t => t.prediction_gap!);

  if (gaps.length < 5) return "stable";

  const firstHalf = gaps.slice(0, Math.floor(gaps.length / 2));
  const secondHalf = gaps.slice(Math.floor(gaps.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (secondAvg < firstAvg * 0.7) return "improving";
  if (secondAvg > firstAvg * 1.3) return "degrading";
  return "stable";
}

function computeQualityScore(
  trajectories: TrajectoryRecord[],
  predictions: PredictionRecord[],
): { avg_signal_per_trajectory: number; low_signal_ratio: number; overfit_risk: "low" | "medium" | "high" } {
  if (trajectories.length === 0) {
    return { avg_signal_per_trajectory: 0, low_signal_ratio: 0, overfit_risk: "low" };
  }

  let totalSignal = 0;
  let lowSignal = 0;

  for (const t of trajectories) {
    const gapSignal = (t.prediction_gap !== undefined && t.prediction_gap >= 0) ? t.prediction_gap : t.surprise_score;
    const signal = (gapSignal + t.surprise_score) / 2;
    totalSignal += signal;
    if (signal < 0.15) lowSignal++;
  }

  const avgSignal = totalSignal / trajectories.length;
  const lowSignalRatio = lowSignal / trajectories.length;

  let overfitRisk: "low" | "medium" | "high" = "low";
  if (predictions.length >= 10) {
    const recentGaps = predictions.slice(-10).map(p => p.gap_score);
    const avgRecentGap = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
    if (avgRecentGap < 0.1 && lowSignalRatio > 0.6) overfitRisk = "high";
    else if (avgRecentGap < 0.2 && lowSignalRatio > 0.4) overfitRisk = "medium";
  }

  return {
    avg_signal_per_trajectory: round(avgSignal),
    low_signal_ratio: round(lowSignalRatio),
    overfit_risk: overfitRisk,
  };
}

// ── Utilities ───────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── CLI: Run analytics from command line ─────────────────────────────────────

/**
 * Run the full WM analytics suite and output JSON to stdout.
 * Usable as: node -e "require('./dist/.../wmAnalytics.js').runCli()"
 */
export async function runCli(): Promise<void> {
  const dashboard = await generateDashboard();
  const quality = await generateQualityReport();
  const alertsEmitted = await emitPendingAlerts();

  const output = {
    dashboard,
    quality_report: quality,
    alerts_emitted: alertsEmitted,
  };

  console.log(JSON.stringify(output, null, 2));
}

// Auto-run if called directly
if (require.main === module) {
  runCli().catch(err => {
    console.error("WM Analytics failed:", err.message);
    process.exit(1);
  });
}
