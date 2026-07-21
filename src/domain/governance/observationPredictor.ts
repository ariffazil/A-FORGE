/**
 * OBSERVATION PREDICTOR — Before you strike, predict what you'll hit.
 *
 * This module implements the ECHO/PaW insight that the CONFIDENCE GAP —
 * the delta between what an agent expects and what the environment returns —
 * is the richest single signal for world model training.
 *
 * Pattern:
 *   1. BEFORE execution: agent predicts expected observation
 *   2. AFTER execution: compare prediction vs actual
 *   3. LOG the gap — this is the data that trains world models
 *
 * Five Architecture Laws:
 *   L2 — ZERO-COST DENSITY: prediction uses existing tool schemas
 *   L3 — SURPRISE TEACHES MORE THAN ROUTINE: biggest gaps = best training data
 *   L5 — SIMULATE BEFORE YOU DEPLOY: prediction IS the simulation
 *
 * Constitutional:
 *   F2 TRUTH — prediction is SPEC; actual is OBS; gap is DER
 *   F7 HUMILITY — high-confidence wrong predictions flagged for review
 *   F11 AUDIT — every prediction→actual pair logged
 *
 * @module domain/governance/observationPredictor
 * @forged 2026-07-21
 */

import { createHash } from "node:crypto";
import {
  computePredictionGap,
  computeSurpriseScore,
  observationEntropyProxy,
  type WmMetadata,
  type PredictionRecord,
} from "./worldModel.js";
import { logPrediction } from "./worldModelLogger.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PredictionRequest {
  /** Which tool is about to be called */
  tool: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Agent's confidence in this prediction [0, 1] */
  confidence: number;
  /** Agent's predicted output (structured or free-text) */
  predictedOutput: string;
  /** Context: what the agent is trying to accomplish */
  intent: string;
}

export interface PredictionResult {
  /** Confirmation that prediction was recorded */
  status: "PREDICTED" | "SKIPPED";
  /** When the prediction was made */
  predicted_at: string;
  /** Hash of the prediction (for comparison after execution) */
  prediction_hash: string;
  /** Tool + args hash */
  action_hash: string;
  /** Gap will be populated after execution */
  gap_pending: boolean;
  /** Epistemic label for the prediction */
  epistemic: "SPEC";
  /** Confidence level */
  confidence: number;
}

export interface GapResult {
  /** The prediction that was made */
  predicted: string;
  /** What actually happened */
  actual: string;
  /** Jaccard distance between prediction and actual [0, 1] */
  gap_score: number;
  /** Surprise score [0, 1] */
  surprise_score: number;
  /** Is this gap large enough to warrant special attention? */
  is_significant: boolean;
  /** Epistemic: the gap is DER (derived from comparison) */
  epistemic: "DER";
  /** Recommendation based on gap */
  recommendation: "MODEL_LEARNED" | "MODEL_UNCERTAIN" | "MODEL_WRONG";
}

// ── Prediction Buffer ───────────────────────────────────────────────────────

/**
 * In-memory buffer of pending predictions.
 * Keyed by action_hash for O(1) lookup after execution.
 */
const predictionBuffer = new Map<string, PredictionRequest>();

// ── Predict ─────────────────────────────────────────────────────────────────

/**
 * Record a prediction BEFORE tool execution.
 *
 * The agent says: "I expect this tool to return X."
 * We hash it, store it, and wait for the actual result.
 *
 * @returns PredictionResult with hash for later comparison
 */
export function predictObservation(request: PredictionRequest): PredictionResult {
  const actionHash = createHash("sha256")
    .update(JSON.stringify({ tool: request.tool, args: request.args }))
    .digest("hex");

  const predictionHash = createHash("sha256")
    .update(request.predictedOutput)
    .digest("hex");

  // Store in buffer
  predictionBuffer.set(actionHash, request);

  return {
    status: "PREDICTED",
    predicted_at: new Date().toISOString(),
    prediction_hash: predictionHash,
    action_hash: actionHash,
    gap_pending: true,
    epistemic: "SPEC",
    confidence: request.confidence,
  };
}

// ── Verify ──────────────────────────────────────────────────────────────────

/**
 * Compare prediction vs actual AFTER tool execution.
 *
 * This is the MONEY FUNCTION — the confidence gap is the richest
 * signal for world model training.
 *
 * Returns a GapResult with gap_score and recommendation.
 * Also auto-logs to the prediction ledger.
 *
 * @param actionHash - the action hash from predictObservation()
 * @param actualOutput - what the tool actually returned
 */
export async function verifyPrediction(
  actionHash: string,
  actualOutput: string,
): Promise<GapResult | null> {
  const prediction = predictionBuffer.get(actionHash);
  if (!prediction) return null;

  // Clean up buffer
  predictionBuffer.delete(actionHash);

  const predicted = prediction.predictedOutput;
  const actual = actualOutput.slice(0, 20000); // cap to reasonable size

  const gapScore = computePredictionGap(predicted, actual);
  const surpriseScore = computeSurpriseScore(predicted, actual);
  const entropy = observationEntropyProxy(actual);

  // Significant gap: >30% token-level divergence
  const isSignificant = gapScore > 0.3;

  // Recommendation
  let recommendation: GapResult["recommendation"];
  if (gapScore < 0.15) {
    recommendation = "MODEL_LEARNED";    // prediction largely correct
  } else if (gapScore < 0.4) {
    recommendation = "MODEL_UNCERTAIN";  // partial match, needs more training
  } else {
    recommendation = "MODEL_WRONG";      // prediction completely off
  }

  // Log to prediction ledger
  try {
    await logPrediction(
      prediction.tool,
      actionHash,
      predicted,
      actual,
    );
  } catch (err: any) {
    console.error(`[observationPredictor] Log failed: ${err.message}`);
  }

  return {
    predicted,
    actual: actual.slice(0, 5000), // return truncated version
    gap_score: gapScore,
    surprise_score: Math.round(surpriseScore * 1000) / 1000,
    is_significant: isSignificant,
    epistemic: "DER",
    recommendation,
  };
}

// ── Bulk Prediction Strategy ────────────────────────────────────────────────

/**
 * Generate structured prediction formats based on tool type.
 *
 * Different tools produce different output types — the prediction
 * should match the expected format.
 */
export function formatPredictionForTool(tool: string, args: Record<string, unknown>): string {
  // Structured prediction formats per tool type
  const base = { tool, args };

  if (tool.startsWith("forge_shell")) {
    return JSON.stringify({
      expected: {
        exit_code: 0,
        stdout_contains: [],
        stderr_empty: true,
        will_modify: false,
      },
      tool: base.tool,
    });
  }

  if (tool.startsWith("forge_git")) {
    const subcommand = (args.command as string || "").split(" ")[0];
    return JSON.stringify({
      expected: {
        success: true,
        changes: subcommand === "status" ? "dirty" : "clean",
        branch: null,
      },
      tool: base.tool,
    });
  }

  if (tool.startsWith("forge_docker")) {
    return JSON.stringify({
      expected: {
        success: true,
        container_state: "running",
        exit_code: 0,
      },
      tool: base.tool,
    });
  }

  if (tool.startsWith("forge_filesystem")) {
    return JSON.stringify({
      expected: {
        success: true,
        file_exists: true,
        content_size_bytes: null,
      },
      tool: base.tool,
    });
  }

  // Default: generic structured prediction
  return JSON.stringify({
    expected: {
      success: true,
      output_type: "text",
      output_size: "small",
    },
    tool: base.tool,
  });
}

// ── Gap Dashboard ───────────────────────────────────────────────────────────

export interface GapSummary {
  total_predictions: number;
  avg_gap: number;
  significant_gaps: number;
  learned_ratio: number;
  uncertain_ratio: number;
  wrong_ratio: number;
  buffer_size: number;
}

/**
 * Get a summary of prediction gaps from the buffer and recent history.
 */
export function getGapSummary(): GapSummary {
  const predictions = predictionBuffer.size;

  // These would normally come from the prediction ledger,
  // but we provide buffer-level stats as a live snapshot.
  return {
    total_predictions: 0, // From ledger — implement when needed
    avg_gap: 0,
    significant_gaps: 0,
    learned_ratio: 0,
    uncertain_ratio: 0,
    wrong_ratio: 0,
    buffer_size: predictions,
  };
}

// ── Confidence Gap Alert ────────────────────────────────────────────────────

/**
 * Thresholds that trigger alerts for high-confidence wrong predictions.
 *
 * F7 HUMILITY: when the agent is very confident but WRONG,
 * that's the most valuable learning signal.
 */
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const HIGH_GAP_THRESHOLD = 0.4;

export interface GapAlert {
  alert: boolean;
  message: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

/**
 * Check if a prediction gap requires a human alert.
 *
 * CRITICAL: high-confidence prediction was completely wrong (gap > 0.7, confidence > 0.8)
 * WARN: medium-high gap with moderate confidence
 * INFO: low gap or low confidence — learning is working
 */
export function checkGapAlert(
  gapScore: number,
  confidence: number,
): GapAlert {
  if (confidence > HIGH_CONFIDENCE_THRESHOLD && gapScore > 0.7) {
    return {
      alert: true,
      message: `CRITICAL: Agent was ${(confidence * 100).toFixed(0)}% confident but prediction was ${(gapScore * 100).toFixed(0)}% wrong. Model may have a blind spot. F7 HUMILITY trigger.`,
      severity: "CRITICAL",
    };
  }

  if (confidence > HIGH_CONFIDENCE_THRESHOLD && gapScore > HIGH_GAP_THRESHOLD) {
    return {
      alert: true,
      message: `WARN: High-confidence prediction (${(confidence * 100).toFixed(0)}%) had significant gap (${(gapScore * 100).toFixed(0)}%).`,
      severity: "WARN",
    };
  }

  return {
    alert: false,
    message: gapScore < 0.15
      ? "Model prediction aligned with reality. World model calibrating well."
      : "Gap within acceptable range.",
    severity: "INFO",
  };
}
