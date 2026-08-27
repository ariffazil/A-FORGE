/**
 * TrustGate.ts — Score-to-action mapping with 888-APEX integration
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST
 * Maps trust scores to constitutional actions.
 *
 * Band → Action:
 *   ALLOW   (0.8-1.0) → full access
 *   LIMITED (0.6-0.8) → read-only, monitored
 *   HOLD    (0.4-0.6) → requires 888-APEX judgment
 *   DENY    (0.0-0.4) → blocked, logged
 *
 * Constitutional:
 *   F1 AMANAH — reversible decisions only at HOLD boundary
 *   F2 TRUTH  — gate decisions backed by score evidence
 *   F13 SOVEREIGN — HOLD band routes to 888-APEX
 *
 * @module domain/trust/TrustGate
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import type { TrustScore, TrustBand, TrustGateResult, McpServerInput } from "./TrustTypes.js";
import { computeTrustScore, reevaluateTrustScore } from "./TrustScoringEngine.js";

// ── Gate Configuration ──────────────────────────────────────────────

interface GateConfig {
  /** Minimum score for ALLOW band (default 0.8) */
  allow_threshold: number;
  /** Minimum score for LIMITED band (default 0.6) */
  limited_threshold: number;
  /** Minimum score for HOLD band (default 0.4) */
  hold_threshold: number;
  /** Maximum CI width before forcing HOLD regardless of score (default 0.8) */
  max_ci_for_allow: number;
  /** Maximum behavioral fidelity penalty before forcing HOLD (default 0.3) */
  max_fidelity_penalty: number;
}

const DEFAULT_CONFIG: GateConfig = {
  allow_threshold: 0.8,
  limited_threshold: 0.6,
  hold_threshold: 0.4,
  max_ci_for_allow: 0.8,
  max_fidelity_penalty: 0.3,
};

// ── Gate Evaluation ─────────────────────────────────────────────────

/**
 * Evaluate an MCP server against the trust gate.
 * Returns a TrustGateResult with action and 888 judgment requirement.
 */
export function evaluateTrustGate(
  input: McpServerInput,
  existingScore?: TrustScore,
  config: Partial<GateConfig> = {}
): TrustGateResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Compute or re-evaluate score
  const score = existingScore
    ? reevaluateTrustScore(existingScore, input)
    : computeTrustScore(input);
  
  // Check CI penalty — high uncertainty forces HOLD
  if (score.confidence_interval > cfg.max_ci_for_allow && score.band === "ALLOW") {
    return {
      mcp_id: score.mcp_id,
      score: score.composite_score,
      band: "HOLD",
      action: "HOLD",
      reason: `CI width ${score.confidence_interval.toFixed(3)} exceeds threshold ${cfg.max_ci_for_allow} — insufficient confidence for ALLOW`,
      requires_888_judgment: true,
    };
  }
  
  // Standard band mapping
  switch (score.band) {
    case "ALLOW":
      return {
        mcp_id: score.mcp_id,
        score: score.composite_score,
        band: "ALLOW",
        action: "ALLOW",
        reason: `Score ${score.composite_score.toFixed(3)} >= ${cfg.allow_threshold} — full access granted`,
        requires_888_judgment: false,
      };
    
    case "LIMITED":
      return {
        mcp_id: score.mcp_id,
        score: score.composite_score,
        band: "LIMITED",
        action: "LIMITED",
        reason: `Score ${score.composite_score.toFixed(3)} in [${cfg.limited_threshold}, ${cfg.allow_threshold}) — read-only, monitored`,
        requires_888_judgment: false,
        session_restriction: "read-only",
      };
    
    case "HOLD":
      return {
        mcp_id: score.mcp_id,
        score: score.composite_score,
        band: "HOLD",
        action: "HOLD",
        reason: `Score ${score.composite_score.toFixed(3)} in [${cfg.hold_threshold}, ${cfg.limited_threshold}) — requires 888-APEX judgment`,
        requires_888_judgment: true,
      };
    
    case "DENY":
      return {
        mcp_id: score.mcp_id,
        score: score.composite_score,
        band: "DENY",
        action: "DENY",
        reason: `Score ${score.composite_score.toFixed(3)} < ${cfg.hold_threshold} — untrusted, blocked`,
        requires_888_judgment: false,
      };
  }
}

/**
 * Prepare a judgment request payload for 888-APEX.
 * Used when trust gate returns HOLD.
 */
export function prepareJudgmentRequest(
  gateResult: TrustGateResult,
  score: TrustScore
): {
  candidate: string;
  evidence: string[];
  action_tier: string;
  reversible: boolean;
} {
  const dimensionSummary = score.dimensions
    .map(d => `${d.dimension}=${d.raw_score.toFixed(2)} (${d.evidence})`)
    .join("; ");
  
  return {
    candidate: `Trust score for ${gateResult.mcp_id}: ${gateResult.score.toFixed(3)} (band: ${gateResult.band}). ${gateResult.reason}`,
    evidence: [
      `Composite score: ${gateResult.score.toFixed(3)}`,
      `Band: ${gateResult.band}`,
      `CI: ${score.confidence_interval.toFixed(3)}`,
      `Dimensions: ${dimensionSummary}`,
      `Evaluations: ${score.evaluation_count}`,
    ],
    action_tier: "TRUST_GATE_HOLD",
    reversible: true, // Trust decisions are always reversible
  };
}
