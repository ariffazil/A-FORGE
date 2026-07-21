/**
 * WM Stats — World Model Telemetry Dashboard
 * Phase 1.5a — Real-time analysis of WM instrumentation data
 * 
 * Reads trajectory/prediction logs and computes:
 *   - Prediction accuracy by tool & priority tier
 *   - Gap score distribution
 *   - Surprise trending
 *   - Phase 2 readiness indicators
 * 
 * Forged: 2026-07-21 by FORGE (000Ω)
 * DITEMPA BUKAN DIBERI
 */

import { readFileSync, existsSync } from "node:fs";
import {
  WM_TRAJECTORY_LOG_PATH,
  WM_PREDICTION_LOG_PATH,
  WmPriority,
} from "./worldModel.js";

// ── Types ────────────────────────────────────────────────────

export interface WmToolStats {
  tool: string;
  priority: WmPriority;
  total_calls: number;
  eligible_calls: number;
  avg_gap_score: number;
  avg_surprise: number;
  avg_entropy: number;
  avg_confidence: number;
}

export interface WmDashboard {
  generated_at: string;
  summary: {
    total_trajectories: number;
    total_predictions: number;
    by_priority: Record<WmPriority, number>;
    eligible_ratio: number;
  };
  tools: WmToolStats[];
  gap_distribution: {
    low: number;    // gap < 0.3 — good predictions
    medium: number; // 0.3 ≤ gap < 0.7 — partial
    high: number;   // 0.7 ≤ gap < 1.0 — poor
    critical: number; // gap ≥ 1.0 — completely wrong
  };
  trends: {
    prediction_accuracy: number; // rolling average of (1 - gap)
    surprise_trend: "IMPROVING" | "STABLE" | "DEGRADING";
    gap_trend: "IMPROVING" | "STABLE" | "DEGRADING";
  };
  readiness: Phase2Readiness;
}

export interface Phase2Readiness {
  status: "NOT_READY" | "MINIMAL" | "ADEQUATE" | "READY";
  p0_trajectories: number;
  min_p0_required: number;
  prediction_accuracy: number;
  min_accuracy_required: number;
  recommendations: string[];
}

// ── Constants ────────────────────────────────────────────────

const MIN_P0_TRAJECTORIES = 100;        // minimum before RL training
const MIN_PREDICTION_ACCURACY = 0.6;    // minimum accuracy before RL

// ── Parsing ──────────────────────────────────────────────────

function parseJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  const records: T[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // skip invalid lines
    }
  }
  return records;
}

// ── Stats Computation ────────────────────────────────────────

export function computeWmDashboard(): WmDashboard {
  const trajectories = parseJsonl<any>(WM_TRAJECTORY_LOG_PATH);
  const predictions = parseJsonl<any>(WM_PREDICTION_LOG_PATH);

  // ── Tool-level stats ──
  const toolMap = new Map<string, {
    gaps: number[];
    surprises: number[];
    entropies: number[];
    confidences: number[];
    priority: WmPriority;
    eligible: number;
    total: number;
  }>();

  for (const t of trajectories) {
    const key = t.tool || "unknown";
    if (!toolMap.has(key)) {
      toolMap.set(key, { gaps: [], surprises: [], entropies: [], confidences: [], priority: t.wm_priority || "P2", eligible: 0, total: 0 });
    }
    const entry = toolMap.get(key)!;
    entry.total++;
    if (t.wm_eligible) entry.eligible++;
    if (t.prediction_gap != null && t.prediction_gap !== undefined) entry.gaps.push(t.prediction_gap);
    if (t.surprise_score != null) entry.surprises.push(t.surprise_score);
    if (t.observation_entropy != null) entry.entropies.push(t.observation_entropy);
    if (t.agent_confidence != null) entry.confidences.push(t.agent_confidence);
  }

  const tools: WmToolStats[] = [];
  for (const [name, data] of toolMap) {
    tools.push({
      tool: name,
      priority: data.priority,
      total_calls: data.total,
      eligible_calls: data.eligible,
      avg_gap_score: data.gaps.length ? data.gaps.reduce((a,b) => a+b,0) / data.gaps.length : 0,
      avg_surprise: data.surprises.length ? data.surprises.reduce((a,b) => a+b,0) / data.surprises.length : 0,
      avg_entropy: data.entropies.length ? data.entropies.reduce((a,b) => a+b,0) / data.entropies.length : 0,
      avg_confidence: data.confidences.length ? data.confidences.reduce((a,b) => a+b,0) / data.confidences.length : 0,
    });
  }

  // ── Priority summary ──
  const byPriority: Record<WmPriority, number> = { P0: 0, P1: 0, P2: 0 };
  let eligibleCount = 0;
  for (const t of trajectories) {
    const p = (t.wm_priority as WmPriority) || "P2";
    byPriority[p]++;
    if (t.wm_eligible) eligibleCount++;
  }

  // ── Gap distribution ──
  const gapDist = { low: 0, medium: 0, high: 0, critical: 0 };
  const allGaps: number[] = [];
  for (const p of predictions) {
    const gap = p.gap_score ?? p.prediction_gap ?? 0;
    allGaps.push(gap);
    if (gap < 0.3) gapDist.low++;
    else if (gap < 0.7) gapDist.medium++;
    else if (gap < 1.0) gapDist.high++;
    else gapDist.critical++;
  }

  const avgGap = allGaps.length ? allGaps.reduce((a,b) => a+b,0) / allGaps.length : 0;
  const predictionAccuracy = 1 - avgGap;

  // ── Trends (simple: compare first half vs second half) ──
  const midpoint = Math.floor(predictions.length / 2);
  const firstHalf = predictions.slice(0, midpoint);
  const secondHalf = predictions.slice(midpoint);

  const avgGapFirst = firstHalf.length ? firstHalf.reduce((s,p) => s + (p.gap_score ?? 0), 0) / firstHalf.length : 0;
  const avgGapSecond = secondHalf.length ? secondHalf.reduce((s,p) => s + (p.gap_score ?? 0), 0) / secondHalf.length : 0;

  const gapTrend: WmDashboard["trends"]["gap_trend"] =
    predictions.length < 4 ? "STABLE" :
    avgGapSecond < avgGapFirst * 0.9 ? "IMPROVING" :
    avgGapSecond > avgGapFirst * 1.1 ? "DEGRADING" : "STABLE";

  // ── Surprise trend ──
  const surprises = trajectories.filter(t => t.surprise_score != null).map(t => t.surprise_score);
  const midSurprise = Math.floor(surprises.length / 2);
  const firstSurprise = surprises.slice(0, midSurprise);
  const secondSurprise = surprises.slice(midSurprise);
  const avgFirstS = firstSurprise.length ? firstSurprise.reduce((a,b) => a+b,0) / firstSurprise.length : 0;
  const avgSecondS = secondSurprise.length ? secondSurprise.reduce((a,b) => a+b,0) / secondSurprise.length : 0;

  const surpriseTrend: WmDashboard["trends"]["surprise_trend"] =
    surprises.length < 4 ? "STABLE" :
    avgSecondS < avgFirstS * 0.9 ? "IMPROVING" :
    avgSecondS > avgFirstS * 1.1 ? "DEGRADING" : "STABLE";

  // ── Phase 2 Readiness ──
  const p0Trajectories = byPriority.P0;
  const readiness: Phase2Readiness = {
    status: p0Trajectories >= MIN_P0_TRAJECTORIES && predictionAccuracy >= MIN_PREDICTION_ACCURACY ? "READY" :
            p0Trajectories >= MIN_P0_TRAJECTORIES / 2 ? "ADEQUATE" :
            p0Trajectories >= 10 ? "MINIMAL" : "NOT_READY",
    p0_trajectories: p0Trajectories,
    min_p0_required: MIN_P0_TRAJECTORIES,
    prediction_accuracy: Math.round(predictionAccuracy * 100) / 100,
    min_accuracy_required: MIN_PREDICTION_ACCURACY,
    recommendations: [],
  };

  if (p0Trajectories < MIN_P0_TRAJECTORIES) {
    readiness.recommendations.push(
      `Need ${MIN_P0_TRAJECTORIES - p0Trajectories} more P0 trajectories before RL training. Run more forge_shell/forge_git/forge_docker commands.`
    );
  }
  if (predictionAccuracy < MIN_PREDICTION_ACCURACY) {
    readiness.recommendations.push(
      `Prediction accuracy ${(predictionAccuracy*100).toFixed(0)}% below minimum ${(MIN_PREDICTION_ACCURACY*100).toFixed(0)}%. Agent needs better environment understanding first.`
    );
  }
  if (readiness.status === "READY") {
    readiness.recommendations.push("Phase 2 RL training can proceed. Submit 888_HOLD for GRPO infra deployment.");
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_trajectories: trajectories.length,
      total_predictions: predictions.length,
      by_priority: byPriority,
      eligible_ratio: trajectories.length > 0 ? eligibleCount / trajectories.length : 0,
    },
    tools,
    gap_distribution: gapDist,
    trends: {
      prediction_accuracy: Math.round(predictionAccuracy * 100) / 100,
      surprise_trend: surpriseTrend,
      gap_trend: gapTrend,
    },
    readiness,
  };
}

// ── CLI Entry Point ──────────────────────────────────────────

export function printWmDashboard(dashboard?: WmDashboard): void {
  const d = dashboard ?? computeWmDashboard();

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║        🌐 WORLD MODEL — Telemetry Dashboard           ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║ Generated: ${d.generated_at}                  ║`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║ Trajectories: ${String(d.summary.total_trajectories).padEnd(5)} | Predictions: ${String(d.summary.total_predictions).padEnd(5)}         ║`);
  console.log(`║ P0: ${String(d.summary.by_priority.P0).padEnd(5)} | P1: ${String(d.summary.by_priority.P1).padEnd(5)} | P2: ${String(d.summary.by_priority.P2).padEnd(5)}      ║`);
  console.log(`║ Eligible ratio: ${(d.summary.eligible_ratio * 100).toFixed(0)}%                                  ║`);
  console.log("╠══════════════════════════════════════════════════════╣");

  // Tool stats
  for (const t of d.tools) {
    console.log(`║ ${t.tool.padEnd(14)} | ${t.priority} | calls:${String(t.total_calls).padEnd(3)} | gap:${t.avg_gap_score.toFixed(2).padEnd(5)} | surp:${t.avg_surprise.toFixed(2).padEnd(5)} ║`);
  }

  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║ Gap Distribution                                     ║`);
  console.log(`║   LOW (<0.3):    ${String(d.gap_distribution.low).padEnd(5)} — good predictions          ║`);
  console.log(`║   MED (0.3-0.7): ${String(d.gap_distribution.medium).padEnd(5)} — partial                 ║`);
  console.log(`║   HIGH (0.7-1.0):${String(d.gap_distribution.high).padEnd(5)} — poor                    ║`);
  console.log(`║   CRITICAL (≥1): ${String(d.gap_distribution.critical).padEnd(5)} — completely wrong       ║`);

  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║ Trends                                               ║`);
  console.log(`║   Accuracy: ${(d.trends.prediction_accuracy*100).toFixed(0)}% | Gap: ${d.trends.gap_trend.padEnd(10)} | Surprise: ${d.trends.surprise_trend.padEnd(10)} ║`);

  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║ 🔥 Phase 2 Readiness: ${d.readiness.status.padEnd(14)}                        ║`);
  console.log(`║   P0 trajectories: ${String(d.readiness.p0_trajectories).padEnd(4)} / ${d.readiness.min_p0_required} minimum                ║`);
  console.log(`║   Accuracy:        ${(d.readiness.prediction_accuracy*100).toFixed(0)}% / ${(d.readiness.min_accuracy_required*100).toFixed(0)}% minimum               ║`);
  for (const rec of d.readiness.recommendations) {
    console.log(`║   → ${rec.substring(0, 48).padEnd(48)} ║`);
  }
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

// Direct CLI execution
if (process.argv[1]?.includes("wmStats")) {
  printWmDashboard();
}
