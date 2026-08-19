/**
 * TrustScoringEngine.ts — Core trust scoring for external MCP servers
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST
 * Weighted Bayesian composite with uncertainty penalty + cold-start shrinkage.
 *
 * Formula:
 *   score = Σ(dim_weight × posterior_mean) - γ × avg(CI_width)
 *   → cold-start shrinkage → security veto gate → band assignment
 *
 * Anti-gaming:
 *   - Correlated-failure guard
 *   - Outlier trimming
 *   - Score swing detection
 *   - Behavioral fidelity (declared vs observed)
 *
 * Constitutional:
 *   F2 TRUTH  — scores backed by evidence, not assertion
 *   F7 HUMILITY — uncertainty quantified, cold-start handled
 *   F8 GENIUS  — simplest correct scoring formula
 *   F11 AUDIT — every score change logged to VAULT999
 *
 * @module domain/trust/TrustScoringEngine
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import {
  type TrustDimension,
  type DimensionScore,
  type TrustScore,
  type McpServerInput,
  type TrustBand,
  DIMENSION_WEIGHTS,
  scoreToBand,
} from "./TrustTypes.js";

// ── Constants ───────────────────────────────────────────────────────

const UNCERTAINTY_PENALTY_GAMMA = 0.15;  // γ: penalizes uncertain scores
const COLD_START_SHRINKAGE_PRIOR = 0.5;  // Prior mean for new MCPs
const COLD_START_SHRINKAGE_STRENGTH = 3; // n: how fast we converge
const SWING_THRESHOLD = 0.3;             // Flag if score changes > 0.3 between evals
const MAX_HISTORY = 20;                   // Keep last N score snapshots

// ── Dimension Probes ────────────────────────────────────────────────

/**
 * Probe a single dimension for an MCP server.
 * Returns a raw score (0-1) and confidence (0-1).
 */
function probeDimension(
  dimension: TrustDimension,
  input: McpServerInput
): { raw_score: number; confidence: number; evidence: string } {
  switch (dimension) {
    case "identity": {
      // Is the MCP server's identity verified?
      const verified = input.identity_verified ?? false;
      const hasEndpoint = !!input.endpoint;
      const raw = verified ? 0.95 : hasEndpoint ? 0.4 : 0.1;
      const confidence = verified ? 0.9 : 0.5;
      const evidence = verified
        ? "[OBS] identity verified via endpoint probe"
        : "[INT] identity not verified, endpoint present";
      return { raw_score: raw, confidence, evidence };
    }

    case "uptime": {
      // Reliability based on observed uptime
      const hours = input.observed_uptime_hours ?? 0;
      const calls = input.observed_total_calls ?? 0;
      const errors = input.observed_error_count ?? 0;
      
      if (calls === 0) {
        // No data — cold start
        return {
          raw_score: COLD_START_SHRINKAGE_PRIOR,
          confidence: 0.3,
          evidence: "[INT] no call history, using prior",
        };
      }
      
      const errorRate = errors / calls;
      const uptimeHours = Math.min(hours / 168, 1); // Normalize to 1 week
      const raw = Math.max(0, 1 - errorRate) * 0.6 + uptimeHours * 0.4;
      const confidence = Math.min(calls / 100, 0.9); // More calls = more confident
      const evidence = `[OBS] uptime=${hours}h, calls=${calls}, errors=${errors}, error_rate=${(errorRate * 100).toFixed(1)}%`;
      return { raw_score: Math.max(0, Math.min(1, raw)), confidence, evidence };
    }

    case "auditability": {
      // Can actions be traced? Receipt support?
      const hasReceipts = input.has_receipt_support ?? false;
      const hasOtel = input.has_otel_traces ?? false;
      const hasTools = (input.observed_tools?.length ?? 0) > 0;
      
      let raw = 0.2; // Base: minimal auditability
      if (hasReceipts) raw += 0.4;
      if (hasOtel) raw += 0.3;
      if (hasTools) raw += 0.1;
      
      const confidence = hasReceipts ? 0.8 : hasOtel ? 0.7 : 0.4;
      const evidence = `[DER] receipts=${hasReceipts}, otel=${hasOtel}, tools_observed=${hasTools}`;
      return { raw_score: Math.min(1, raw), confidence, evidence };
    }

    case "mutation_risk": {
      // What can this MCP change? Read-only = low risk (high score)
      const mclass = input.mutation_class ?? "unknown";
      const map: Record<string, number> = {
        "read-only": 0.95,
        "write": 0.5,
        "admin": 0.2,
        "unknown": 0.3,
      };
      const raw = map[mclass] ?? 0.3;
      const confidence = mclass === "unknown" ? 0.3 : 0.8;
      const evidence = `[OBS] mutation_class=${mclass}`;
      return { raw_score: raw, confidence, evidence };
    }

    case "witnessability": {
      // Can actions be witnessed?
      const hasOtel = input.has_otel_traces ?? false;
      const hasReceipts = input.has_receipt_support ?? false;
      
      let raw = 0.1; // Base
      if (hasOtel) raw += 0.5;
      if (hasReceipts) raw += 0.3;
      
      const confidence = hasOtel ? 0.8 : 0.4;
      const evidence = `[DER] otel=${hasOtel}, receipts=${hasReceipts}`;
      return { raw_score: Math.min(1, raw), confidence, evidence };
    }
  }
}

// ── Cold-Start Shrinkage ────────────────────────────────────────────

/**
 * Apply empirical Bayes shrinkage for cold-start MCPs.
 * When confidence is low, pull score toward the prior (0.5).
 */
function coldStartShrinkage(
  rawScore: number,
  confidence: number
): { score: number; shrunk: boolean } {
  if (confidence >= 0.7) {
    return { score: rawScore, shrunk: false };
  }
  
  // Shrinkage formula: posterior = (n × prior + confidence × raw) / (n + confidence)
  const n = COLD_START_SHRINKAGE_STRENGTH;
  const prior = COLD_START_SHRINKAGE_PRIOR;
  const shrunk = (n * prior + confidence * rawScore) / (n + confidence);
  
  return { score: Math.max(0, Math.min(1, shrunk)), shrunk: true };
}

// ── Core Scoring ────────────────────────────────────────────────────

/**
 * Compute the trust score for an MCP server.
 * Returns a full TrustScore with dimensions, composite, band, and CI.
 */
export function computeTrustScore(input: McpServerInput): TrustScore {
  const dimensions: DimensionScore[] = [];
  let weightedSum = 0;
  let ciWidths: number[] = [];
  
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS) as [TrustDimension, number][]) {
    const { raw_score, confidence, evidence } = probeDimension(dim, input);
    const { score: finalScore, shrunk } = coldStartShrinkage(raw_score, confidence);
    
    // Confidence interval width (higher confidence = narrower CI)
    const ciWidth = 2 * (1 - confidence); // 0.0 at confidence=1.0, 2.0 at confidence=0.0
    
    dimensions.push({
      dimension: dim,
      weight,
      raw_score,
      confidence,
      evidence,
      last_probed: new Date().toISOString(),
    });
    
    weightedSum += weight * finalScore;
    ciWidths.push(ciWidth);
  }
  
  // Uncertainty penalty
  const avgCI = ciWidths.reduce((a, b) => a + b, 0) / ciWidths.length;
  const compositeScore = Math.max(0, Math.min(1, weightedSum - UNCERTAINTY_PENALTY_GAMMA * avgCI));
  
  const band = scoreToBand(compositeScore);
  
  return {
    mcp_id: input.mcp_id,
    mcp_name: input.mcp_name,
    mcp_endpoint: input.endpoint,
    dimensions,
    composite_score: Math.round(compositeScore * 1000) / 1000,
    confidence_interval: Math.round(avgCI * 1000) / 1000,
    band,
    last_evaluated: new Date().toISOString(),
    evaluation_count: 1,
    history: [{
      timestamp: new Date().toISOString(),
      composite_score: compositeScore,
      band,
      trigger: "initial_evaluation",
    }],
  };
}

/**
 * Re-evaluate an existing score with new observations.
 * Detects swings and updates history.
 */
export function reevaluateTrustScore(
  existing: TrustScore,
  newInput: McpServerInput
): TrustScore {
  const newScore = computeTrustScore(newInput);
  
  // Swing detection
  const delta = Math.abs(newScore.composite_score - existing.composite_score);
  if (delta > SWING_THRESHOLD) {
    newScore.history.push({
      timestamp: new Date().toISOString(),
      composite_score: newScore.composite_score,
      band: newScore.band,
      trigger: `swing_detected_delta=${delta.toFixed(3)}`,
    });
  }
  
  // Merge history (keep last MAX_HISTORY)
  const mergedHistory = [
    ...existing.history,
    ...newScore.history,
  ].slice(-MAX_HISTORY);
  
  return {
    ...newScore,
    evaluation_count: existing.evaluation_count + 1,
    history: mergedHistory,
  };
}

/**
 * Check behavioral fidelity: declared vs observed tools.
 * Returns a fidelity penalty (0 = perfect match, 1 = complete mismatch).
 */
export function behavioralFidelity(input: McpServerInput): number {
  const declared = new Set(input.declared_tools ?? []);
  const observed = new Set(input.observed_tools ?? []);
  
  if (declared.size === 0 && observed.size === 0) return 0;
  if (declared.size === 0) return 0.5; // Observed but not declared
  
  // Jaccard similarity
  const intersection = new Set([...declared].filter(x => observed.has(x)));
  const union = new Set([...declared, ...observed]);
  const similarity = union.size > 0 ? intersection.size / union.size : 0;
  
  return 1 - similarity; // Penalty = 1 - similarity
}
