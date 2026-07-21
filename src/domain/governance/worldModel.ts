/**
 * WORLD MODEL — Augment forge tool receipts with action→observation metadata.
 *
 * This module implements the ECHO/PaW insight that every forge tool call
 * produces a dense supervision signal: the observation (tool output) is a
 * learnable consequence of the action (tool name + args).
 *
 * Five Architecture Laws (from AGENTIC-WORLD-MODEL-EUREKA):
 *   L1 — OBSERVATION IS SIGNAL, NOT EXHAUST
 *   L2 — ZERO-COST DENSITY (metadata from in-flight data)
 *   L3 — SURPRISE TEACHES MORE THAN ROUTINE (high-entropy actions prioritized)
 *   L4 — MODEL DYNAMICS, NOT DATA (P0 tools > P2 tools)
 *   L5 — SIMULATE BEFORE YOU DEPLOY (prediction gap = richest signal)
 *
 * Constitutional:
 *   F2 TRUTH — observations are evidence, hash-verified
 *   F4 CLARITY — structured metadata, never raw
 *   F7 HUMILITY — confidence tracked; overfitting monitored
 *   F8 GENIUS — zero extra compute; use data already in-flight
 *   F11 AUDIT — every prediction gap logged
 *
 * @module domain/governance/worldModel
 * @forged 2026-07-21
 */

import { createHash } from "node:crypto";

// ── Priority Tiers ──────────────────────────────────────────────────────────

/**
 * WM Priority — from L4 (MODEL DYNAMICS, NOT DATA).
 *
 * P0 = Tool dynamics are learnable and generalizable. Prioritize for WM training.
 * P1 = Learnable but domain-specific. Include if data available.
 * P2 = Retrieval / search tools. High memorization risk. Exclude from WM.
 */
export type WmPriority = "P0" | "P1" | "P2";

/**
 * Tool → Priority mapping.
 *
 * P0: shell, docker, git — deterministic state transitions, learnable dynamics.
 * P1: filesystem, database — state-dependent but learnable.
 * P2: fetch, search, browse — retrieval, high memorization risk.
 */
const TOOL_PRIORITY_MAP: Record<string, WmPriority> = {
  forge_shell: "P0",
  forge_docker: "P0",
  forge_git: "P0",
  forge_filesystem_read: "P1",
  forge_filesystem_write: "P1",
  forge_filesystem_edit: "P1",
  forge_postgres: "P1",
  forge_db_query: "P1",
  forge_fetch: "P2",
  forge_search: "P2",
  forge_browse: "P2",
  forge_web_search: "P2",
  forge_web_extract: "P2",
  forge_curl: "P2",
  // Proxy / gateway tools — default to P1
  forge_proxy: "P1",
  forge_gateway: "P1",
  forge_worktree: "P1",
  forge_build: "P1",
  forge_deploy: "P1",
  forge_test: "P1",
  forge_lease_request: "P1",
  forge_execute: "P1",
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface WmMetadata {
  /** SHA-256 of tool name + canonical args (action fingerprint) */
  action_hash: string;
  /** SHA-256 of tool result (observation fingerprint) */
  observation_hash: string;
  /** Agent's stated confidence before execution [0, 1] */
  agent_confidence: number;
  /** Surprise score: was the observation unexpected? [0, 1] */
  surprise_score: number;
  /** Observation entropy proxy — how "surprising" is the output? [0, ∞) */
  observation_entropy: number;
  /** Is this observation eligible for WM training? */
  wm_eligible: boolean;
  /** Priority tier for WM training queue */
  wm_priority: WmPriority;
  /** Prediction gap: delta between expected and actual observation */
  prediction_gap?: number;
  /** Timestamp of the observation */
  observed_at: string;
  /** Tool name that produced this observation */
  tool: string;
}

export interface PredictionRecord {
  /** What the agent predicted before execution */
  predicted: string;
  /** What actually happened */
  actual: string;
  /** SHA-256 of predicted */
  predicted_hash: string;
  /** SHA-256 of actual */
  actual_hash: string;
  /** Gap score [0, ∞) — higher = more surprising */
  gap_score: number;
  /** Action that produced this observation */
  action_hash: string;
  /** Timestamp */
  predicted_at: string;
  /** Tool name */
  tool: string;
}

// ── Priority Classifier ─────────────────────────────────────────────────────

/**
 * Classify a tool's WM priority based on tool name.
 *
 * Default: P1 if unrecognized (conservative — include unless proven problematic).
 */
export function classifyWmPriority(toolName: string): WmPriority {
  // Exact match
  if (TOOL_PRIORITY_MAP[toolName]) return TOOL_PRIORITY_MAP[toolName];

  // Prefix match for tool families
  if (toolName.startsWith("forge_shell")) return "P0";
  if (toolName.startsWith("forge_docker")) return "P0";
  if (toolName.startsWith("forge_git")) return "P0";
  if (toolName.startsWith("forge_filesystem")) return "P1";
  if (toolName.startsWith("forge_db") || toolName.startsWith("forge_postgres")) return "P1";
  if (toolName.startsWith("forge_fetch") || toolName.startsWith("forge_search") ||
      toolName.startsWith("forge_browse") || toolName.startsWith("forge_web")) return "P2";

  return "P1";
}

/**
 * Is this tool eligible for WM training?
 *
 * Rules:
 *   - P0 tools: always eligible (learnable dynamics)
 *   - P1 tools: eligible if output is non-trivial (not just "OK" or empty)
 *   - P2 tools: NOT eligible (memorization risk > learning benefit)
 */
export function isWmEligible(toolName: string, observation: string): boolean {
  const priority = classifyWmPriority(toolName);
  if (priority === "P2") return false;
  if (priority === "P0") return true;

  // P1: only if observation is non-trivial
  const trimmed = observation.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length < 10) return false;  // too short to learn from
  if (trimmed === "OK" || trimmed === "ok" || trimmed === "[]" || trimmed === "{}") return false;

  return true;
}

// ── Hash Helpers ────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of tool name + canonical args for action fingerprint.
 */
export function hashAction(toolName: string, args: Record<string, unknown>): string {
  const canonical = JSON.stringify({ tool: toolName, args }, Object.keys(args).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute SHA-256 of observation for observation fingerprint.
 */
export function hashObservation(observation: string): string {
  return createHash("sha256").update(observation).digest("hex");
}

// ── Entropy Proxy ───────────────────────────────────────────────────────────

/**
 * Compute an entropy proxy for an observation string.
 *
 * This is NOT true Shannon entropy — it's a fast heuristic based on:
 *   - Length diversity (ratio of unique chars to total)
 *   - Whitespace ratio (high whitespace = structured output, lower entropy)
 *   - Byte distribution spread
 *
 * Higher values = more "surprising" / less predictable output.
 *
 * Range: typically [0, 10] for terminal output.
 */
export function observationEntropyProxy(text: string): number {
  if (!text || text.length === 0) return 0;

  const len = text.length;
  const uniqueChars = new Set(text).size;
  const charDiversity = uniqueChars / Math.min(len, 5000); // capped to avoid tiny strings skewing

  // Whitespace ratio: structured output (tables, JSON) tends to have organized whitespace
  const whitespaceCount = (text.match(/[\s\n\r\t]/g) || []).length;
  const whitespaceRatio = whitespaceCount / len;

  // Structured output with high whitespace ratio is more predictable
  const structureBonus = whitespaceRatio > 0.1 ? 0.7 : 1.0;

  // Stack trace / error patterns are high-entropy (unique content)
  const isError = /error|traceback|exception|failed|fatal/i.test(text.slice(0, 200));
  const errorBonus = isError ? 1.5 : 1.0;

  const entropy = charDiversity * structureBonus * errorBonus * 10;

  return Math.round(entropy * 1000) / 1000;
}

// ── Surprise Score ──────────────────────────────────────────────────────────

/**
 * Compute surprise score based on prediction gap.
 *
 * Surprise = 1 - similarity(predicted, actual)
 *
 * When no prediction was made, uses entropy as a proxy.
 */
export function computeSurpriseScore(predicted: string | null, actual: string): number {
  if (!predicted) {
    // No prediction made — use entropy as surprise proxy
    const entropy = observationEntropyProxy(actual);
    return Math.min(entropy / 10, 1.0);
  }

  // Simple normalized edit-distance proxy
  const maxLen = Math.max(predicted.length, actual.length, 1);
  let matches = 0;
  const minLen = Math.min(predicted.length, actual.length);
  for (let i = 0; i < minLen; i++) {
    if (predicted[i] === actual[i]) matches++;
  }
  const similarity = matches / maxLen;
  return 1 - similarity;
}

// ── Prediction Gap ──────────────────────────────────────────────────────────

/**
 * Compute prediction gap: the delta between expected and actual observation.
 *
 * Gap = 0  → prediction perfectly matched reality
 * Gap > 1  → significant surprise (high-value training signal)
 *
 * This is the single richest signal for world model training (L3).
 */
export function computePredictionGap(predicted: string | null, actual: string): number {
  if (!predicted || predicted.length === 0) {
    // No prediction — gap is unknowable, but we note it
    return -1; // sentinel: "no prediction attempted"
  }

  // Token-level rough overlap
  const predTokens = new Set(predicted.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const actualTokens = new Set(actual.toLowerCase().split(/\s+/).filter(t => t.length > 2));

  if (predTokens.size === 0 && actualTokens.size === 0) return 0;

  const intersection = new Set([...predTokens].filter(t => actualTokens.has(t)));
  const union = new Set([...predTokens, ...actualTokens]);

  const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
  return 1 - jaccard;
}

// ── WM Metadata Builder ─────────────────────────────────────────────────────

export interface WmMetadataInput {
  tool: string;
  args: Record<string, unknown>;
  observation: string;
  agentConfidence?: number;
  predictedObservation?: string | null;
  exitCode?: number | null;
}

/**
 * Build a complete WmMetadata record from a tool call result.
 *
 * This is the single entry point for instrumenting forge tool receipts.
 * Call it after every forge_* tool execution.
 */
export function buildWmMetadata(input: WmMetadataInput): WmMetadata {
  const {
    tool,
    args,
    observation,
    agentConfidence = 0.5,
    predictedObservation = null,
    exitCode = null,
  } = input;

  const actionHash = hashAction(tool, args);
  const observationHash = hashObservation(observation);
  const priority = classifyWmPriority(tool);
  const eligible = isWmEligible(tool, observation);
  const entropy = observationEntropyProxy(observation);
  const surprise = computeSurpriseScore(predictedObservation, observation);
  const predictionGap = computePredictionGap(predictedObservation, observation);

  return {
    action_hash: actionHash,
    observation_hash: observationHash,
    agent_confidence: agentConfidence,
    surprise_score: Math.round(surprise * 1000) / 1000,
    observation_entropy: entropy,
    wm_eligible: eligible,
    wm_priority: priority,
    prediction_gap: predictionGap >= 0 ? Math.round(predictionGap * 1000) / 1000 : undefined,
    observed_at: new Date().toISOString(),
    tool,
  };
}

// ── Tool Selection (PaW L3) ─────────────────────────────────────────────────

/**
 * Check if an action should be included in WM training based on entropy.
 *
 * From PaW §3.1: high-entropy actions are more informative.
 * They correspond to decisions where the policy is most uncertain.
 *
 * @param actionProbs - probability distribution over possible actions
 * @param alpha - inclusion threshold (default 0.75 from PaW)
 */
export function isHighEntropyAction(actionProbs: number[], alpha: number = 0.75): boolean {
  if (actionProbs.length === 0) return false;

  // Compute Shannon entropy
  let entropy = 0;
  for (const p of actionProbs) {
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Max entropy for this distribution size
  const maxEntropy = Math.log2(actionProbs.length);

  // Normalize and compare
  if (maxEntropy === 0) return false;
  const normalizedEntropy = entropy / maxEntropy;

  return normalizedEntropy > alpha;
}

/**
 * Check if a single action is "high-entropy" — meaning the agent
 * was uncertain about this choice. Used when full action distribution
 * isn't available, just the confidence of the chosen action.
 *
 * @param confidence - model's confidence in the chosen action [0, 1]
 * @param threshold - below this confidence = "uncertain" (default 0.7)
 */
export function isUncertainAction(confidence: number, threshold: number = 0.7): boolean {
  return confidence < threshold;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Default λ weight for WM loss in hybrid objective (from ECHO §3.2) */
export const WM_LAMBDA_DEFAULT = 0.03;

/** Optimal λ range from ECHO ablation */
export const WM_LAMBDA_RANGE: [number, number] = [0.01, 0.05];

/** Trajectory log path */
export const WM_TRAJECTORY_LOG_PATH = "/root/.local/share/arifos/world-model/trajectories.jsonl";

/** Prediction log path */
export const WM_PREDICTION_LOG_PATH = "/root/.local/share/arifos/world-model/predictions.jsonl";

/** Filter out observations shorter than this (characters) for WM training */
export const WM_MIN_OBSERVATION_LENGTH = 10;

/** Tools excluded from WM regardless of output */
export const WM_EXCLUDED_TOOLS = [
  "forge_fetch", "forge_search", "forge_web_search", "forge_web_extract",
  "forge_browse", "forge_curl",
];

// ── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize WM metadata to a compact JSON line for trajectory log.
 */
export function serializeWmLine(meta: WmMetadata): string {
  return JSON.stringify({
    ah: meta.action_hash.slice(0, 12),
    oh: meta.observation_hash.slice(0, 12),
    t: meta.tool,
    p: meta.wm_priority,
    e: meta.wm_eligible,
    ac: meta.agent_confidence,
    ss: meta.surprise_score,
    oe: meta.observation_entropy,
    pg: meta.prediction_gap,
    ts: meta.observed_at,
  });
}
