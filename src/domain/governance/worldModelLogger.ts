/**
 * WORLD MODEL LOGGER — Append-only hash-chained trajectory log.
 *
 * Logs every forge tool's action→observation pair to a JSONL ledger
 * with cryptographic hash chaining (mini VAULT999 for world model).
 *
 * Two logs:
 *   1. trajectories.jsonl — action + observation fingerprints with WM metadata
 *   2. predictions.jsonl  — agent prediction vs actual observation (confidence gap)
 *
 * Constitutional:
 *   F1 AMANAH — append-only, never delete
 *   F2 TRUTH — hash-verified, not claimed
 *   F11 AUDIT — every observation leaves a trace
 *
 * @module domain/governance/worldModelLogger
 * @forged 2026-07-21
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  WM_TRAJECTORY_LOG_PATH,
  WM_PREDICTION_LOG_PATH,
  buildWmMetadata,
  serializeWmLine,
  type WmMetadata,
  type WmMetadataInput,
  type PredictionRecord,
} from "./worldModel.js";

// ── Chain State ─────────────────────────────────────────────────────────────

let trajectoryPrevHash: string = "0000000000000000000000000000000000000000000000000000000000000000";
let predictionPrevHash: string = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Initialize the logger — ensure directories exist and restore chain state.
 */
export async function initWorldModelLogger(): Promise<void> {
  const trajDir = dirname(WM_TRAJECTORY_LOG_PATH);
  const predDir = dirname(WM_PREDICTION_LOG_PATH);

  await mkdir(trajDir, { recursive: true });
  await mkdir(predDir, { recursive: true });

  // Restore chain heads from last line of each log
  trajectoryPrevHash = await readChainHead(WM_TRAJECTORY_LOG_PATH);
  predictionPrevHash = await readChainHead(WM_PREDICTION_LOG_PATH);
}

/**
 * Read the hash of the last record in a JSONL ledger.
 */
async function readChainHead(logPath: string): Promise<string> {
  const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

  try {
    const s = await stat(logPath);
    if (s.size === 0) return GENESIS_HASH;

    // Read last ~2KB to find the last line
    const fd = await readFile(logPath, "utf-8");
    const lines = fd.trim().split("\n");
    if (lines.length === 0) return GENESIS_HASH;

    const lastLine = lines[lines.length - 1];
    const record = JSON.parse(lastLine);
    return record.hash || record.h || GENESIS_HASH;
  } catch {
    return GENESIS_HASH;
  }
}

// ── Trajectory Logging ──────────────────────────────────────────────────────

export interface TrajectoryLogEntry {
  seq: number;
  ts: string;
  action_hash: string;
  observation_hash: string;
  tool: string;
  wm_priority: string;
  wm_eligible: boolean;
  agent_confidence: number;
  surprise_score: number;
  observation_entropy: number;
  prediction_gap?: number;
  exit_code?: number | null;
  prev_hash: string;
  hash: string;
}

let trajectorySeq = 0;

/**
 * Log an action→observation trajectory to the append-only ledger.
 *
 * Called after every forge_* tool execution.
 */
export async function logTrajectory(input: WmMetadataInput): Promise<TrajectoryLogEntry> {
  const meta = buildWmMetadata(input);
  const seq = ++trajectorySeq;

  const record: Omit<TrajectoryLogEntry, "hash"> = {
    seq,
    ts: meta.observed_at,
    action_hash: meta.action_hash,
    observation_hash: meta.observation_hash,
    tool: meta.tool,
    wm_priority: meta.wm_priority,
    wm_eligible: meta.wm_eligible,
    agent_confidence: meta.agent_confidence,
    surprise_score: meta.surprise_score,
    observation_entropy: meta.observation_entropy,
    prediction_gap: meta.prediction_gap,
    exit_code: (input as any).exitCode ?? null,
    prev_hash: trajectoryPrevHash,
  };

  const hash = createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex");

  const entry: TrajectoryLogEntry = { ...record, hash };

  // Write to JSONL
  const line = JSON.stringify(entry) + "\n";
  await appendFile(WM_TRAJECTORY_LOG_PATH, line, "utf-8");

  // Update chain head
  trajectoryPrevHash = hash;

  return entry;
}

// ── Prediction Logging ──────────────────────────────────────────────────────

let predictionSeq = 0;

/**
 * Log a prediction-vs-actual record to the prediction ledger.
 *
 * This captures the CONFIDENCE GAP — the single richest signal
 * for world model training (L3: SURPRISE TEACHES MORE THAN ROUTINE).
 *
 * Called before execution (prediction) and after (actual).
 */
export async function logPrediction(
  tool: string,
  actionHash: string,
  predicted: string,
  actual: string,
): Promise<PredictionRecord & { seq: number; hash: string }> {
  const seq = ++predictionSeq;

  const predictedHash = createHash("sha256").update(predicted).digest("hex");
  const actualHash = createHash("sha256").update(actual).digest("hex");

  // Gap: Jaccard distance on token sets
  const predTokens = new Set(predicted.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const actualTokens = new Set(actual.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const intersection = new Set([...predTokens].filter(t => actualTokens.has(t)));
  const union = new Set([...predTokens, ...actualTokens]);
  const gapScore = union.size === 0 ? 0 : 1 - (intersection.size / union.size);

  const record = {
    seq,
    predicted,
    actual,
    predicted_hash: predictedHash,
    actual_hash: actualHash,
    gap_score: Math.round(gapScore * 1000) / 1000,
    action_hash: actionHash,
    predicted_at: new Date().toISOString(),
    tool,
    prev_hash: predictionPrevHash,
  };

  const hash = createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex");

  const entry = { ...record, hash };

  const line = JSON.stringify(entry) + "\n";
  await appendFile(WM_PREDICTION_LOG_PATH, line, "utf-8");

  predictionPrevHash = hash;

  return entry;
}

// ── Stats and Health ────────────────────────────────────────────────────────

export interface WmStats {
  total_trajectories: number;
  total_predictions: number;
  by_priority: Record<string, string>;
  eligible_count: number;
  avg_surprise: number;
  avg_gap: number;
  chain_healthy: boolean;
}

/**
 * Read current WM statistics from the trajectory log.
 */
export async function getWmStats(): Promise<WmStats> {
  const stats: WmStats = {
    total_trajectories: 0,
    total_predictions: 0,
    by_priority: { P0: "0", P1: "0", P2: "0" },
    eligible_count: 0,
    avg_surprise: 0,
    avg_gap: 0,
    chain_healthy: true,
  };

  try {
    const trajData = await readFile(WM_TRAJECTORY_LOG_PATH, "utf-8");
    const trajLines = trajData.trim().split("\n").filter(Boolean);
    stats.total_trajectories = trajLines.length;

    let totalSurprise = 0;
    let totalGap = 0;
    let gapCount = 0;
    const priorityCounts: Record<string, number> = { P0: 0, P1: 0, P2: 0 };

    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    for (const line of trajLines) {
      try {
        const r = JSON.parse(line);
        const p = r.wm_priority || "P1";
        priorityCounts[p] = (priorityCounts[p] || 0) + 1;
        if (r.wm_eligible) stats.eligible_count++;
        totalSurprise += r.surprise_score || 0;
        if (r.prediction_gap !== undefined && r.prediction_gap >= 0) {
          totalGap += r.prediction_gap;
          gapCount++;
        }
        // Verify chain
        if (r.prev_hash !== prevHash) stats.chain_healthy = false;
        prevHash = r.hash || "";
      } catch { /* skip malformed */ }
    }

    stats.by_priority = {
      P0: String(priorityCounts.P0 || 0),
      P1: String(priorityCounts.P1 || 0),
      P2: String(priorityCounts.P2 || 0),
    };
    stats.avg_surprise = trajLines.length > 0 ? Math.round((totalSurprise / trajLines.length) * 1000) / 1000 : 0;
    stats.avg_gap = gapCount > 0 ? Math.round((totalGap / gapCount) * 1000) / 1000 : 0;
  } catch {
    // Log might not exist yet
  }

  try {
    const predData = await readFile(WM_PREDICTION_LOG_PATH, "utf-8");
    const predLines = predData.trim().split("\n").filter(Boolean);
    stats.total_predictions = predLines.length;
  } catch { /* no predictions yet */ }

  return stats;
}

// ── Auto-initialize on import ───────────────────────────────────────────────

// Kick off initialization (fire-and-forget — log failures, don't block)
initWorldModelLogger().catch((err) => {
  console.error("[worldModelLogger] Init failed:", err.message);
});
