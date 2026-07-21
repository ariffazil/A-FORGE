/**
 * World Model Types — Action→Observation Instrumentation
 *
 * Implements the five architecture laws from AGENTIC-WORLD-MODEL-EUREKA:
 *   L1: Observation is signal, not exhaust
 *   L2: Zero-cost density — hash what's already there
 *   L3: Surprise teaches more than routine
 *   L4: Model dynamics, not data (P0 > P1 > P2)
 *   L5: Simulate before you deploy
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { createHash } from "node:crypto";

// ── Tool Priority (L4) ────────────────────────

/** Tool priority for world model training — P0 = dynamics, P2 = retrieval */
export enum WM_PRIORITY {
  /** Dynamic, learnable, predictable — shell, docker, git */
  P0 = 0,
  /** Schema-dependent but learnable — db, filesystem */
  P1 = 1,
  /** Retrieval-heavy, memorization risk — fetch, search */
  P2 = 2,
}

/** Map tool names → WM priority */
export const TOOL_WM_PRIORITY: Record<string, WM_PRIORITY> = {
  forge_shell: WM_PRIORITY.P0,
  run_command: WM_PRIORITY.P0,
  run_tests: WM_PRIORITY.P0,
  forge_docker: WM_PRIORITY.P0,
  forge_git: WM_PRIORITY.P0,
  forge_filesystem: WM_PRIORITY.P1,
  forge_db: WM_PRIORITY.P1,
  forge_postgres: WM_PRIORITY.P1,
  forge_fetch: WM_PRIORITY.P2,
  forge_search: WM_PRIORITY.P2,
  forge_browser: WM_PRIORITY.P2,
};

// ── WM Metadata ───────────────────────────────

export interface WorldModelMetadata {
  /** SHA256 of action (tool_name + serialized args) */
  action_hash: string;
  /** SHA256 of observation (tool output string) */
  observation_hash: string;
  /** Tool priority for WM training eligibility */
  tool_priority: WM_PRIORITY;
  /** Agent's confidence in the predicted output (0-1, -1 if not predicted) */
  agent_confidence: number;
  /** Entropy of surprise — normalized edit distance or token-level divergence */
  observation_entropy: number;
  /** Gap between prediction and reality (0 = perfect match, 1 = total surprise) */
  surprise_score: number;
  /** Whether this observation is eligible for world model training (L3 + L4) */
  wm_eligible: boolean;
}

export interface WorldModelObservation {
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** Session ID from execution context */
  session_id: string;
  /** Tool name being called */
  tool_name: string;
  /** Serialized tool arguments (JSON) */
  args: string;
  /** WM metadata block */
  wm: WorldModelMetadata;
  /** Actual observation output */
  observation: string;
  /** Whether the tool call succeeded */
  ok: boolean;
  /** Duration in ms */
  duration_ms: number;
  /** Hash of previous record (mini hash chain) */
  prev_hash: string;
  /** This record's hash */
  record_hash: string;
}

// ── Hash Helpers ──────────────────────────────

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function actionHash(toolName: string, args: Record<string, unknown>): string {
  const serialized = JSON.stringify({ tool: toolName, args }, Object.keys({ tool: toolName, args }).sort());
  return sha256(serialized);
}

export function observationHash(output: string): string {
  return sha256(output);
}

// ── Entropy / Surprise ────────────────────────

/**
 * Compute normalized surprise score between expected and actual output.
 * 0 = perfect match, 1 = complete divergence.
 * Falls back to heuristic when no prediction was provided.
 */
export function computeSurpriseScore(
  expectedOutput: string | undefined,
  actualOutput: string,
): number {
  if (!expectedOutput || expectedOutput.length === 0) {
    // No prediction provided — use output length as rough entropy proxy
    // Longer outputs tend to be more surprising
    return clamp(Math.min(actualOutput.length / 10_000, 1.0), 0, 1);
  }

  // Simple normalized Levenshtein-like ratio
  const maxLen = Math.max(expectedOutput.length, actualOutput.length);
  if (maxLen === 0) return 0;

  // Count matching characters in order (not full edit distance, but fast)
  let matches = 0;
  const minLen = Math.min(expectedOutput.length, actualOutput.length);
  for (let i = 0; i < minLen; i++) {
    if (expectedOutput[i] === actualOutput[i]) matches++;
  }

  const similarity = matches / maxLen;
  return clamp(1 - similarity, 0, 1);
}

/**
 * Determine WM eligibility based on L3 (entropy gate) and L4 (priority gate).
 * P2 tools are never eligible. High surprise = eligible. Low surprise = already known.
 */
export function computeWMEligibility(
  priority: WM_PRIORITY,
  surpriseScore: number,
  agentConfidence: number,
): boolean {
  // L4: P2 retrieval tools — never eligible (memorization risk)
  if (priority === WM_PRIORITY.P2) return false;

  // L3: Low surprise + high confidence = already learned, skip
  if (surpriseScore < 0.1 && agentConfidence > 0.8) return false;

  // L3: High surprise = always eligible (teaches the most)
  if (surpriseScore > 0.3) return true;

  // P0 always eligible if surprise is non-trivial
  if (priority === WM_PRIORITY.P0) return surpriseScore > 0.05;

  // P1 eligible if surprise > threshold
  return surpriseScore > 0.15;
}

// ── Helpers ───────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
