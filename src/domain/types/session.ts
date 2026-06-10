/**
 * Session state types for arifOS governance
 * Tracks claims, coherence, and evidence across the 000-999 pipeline
 */

export type UncertaintyBand = "low" | "medium" | "high" | "critical";

export type SenseMode = "lite" | "deep" | "auto";

export type SenseResult = {
  mode_used: SenseMode;
  escalation_reason?: string;
  evidence_count: number;
  evidence_quality?: number;
  uncertainty_band: UncertaintyBand;
  recommended_next_stage: "mind" | "hold" | "deep_audit";
  contradiction_flags: number;
  query_complexity_score: number;
  risk_indicators: string[];
  ambiguity_markers?: number; // From Lite heuristics
  metadata: {
    lite_tokens_used?: number;
    deep_tokens_used?: number;
    routing_decision: string;
  };
};

export type ConfidenceEstimate = {
  value: number;
  is_estimate: true;
  evidence_count: number;
  agreement_score: number;
  contradiction_penalty: number;
  uncertainty_hint: number;
  calculation_method: string;
};

export type JudgeVerdict = "SEAL" | "HOLD" | "VOID";

export type JudgeResult = {
  verdict: JudgeVerdict;
  reason: string;
  confidence: ConfidenceEstimate;
  floors_triggered: string[];
  human_review_required: boolean;
};

export type SessionClaim = {
  id: string;
  content: string;
  source_tool: string;
  timestamp: string;
  confidence?: number;
};

export type SessionState = {
  sessionId: string;
  claims: SessionClaim[];
  sense_result?: SenseResult;
  judge_result?: JudgeResult;
  trace_id: string;
  created_at: string;
  last_updated: string;
};

/**
 * F4 Entropy reduction tracker
 * Measures information gain/loss through the pipeline
 */
export type EntropyMetrics = {
  initial_entropy: number;
  post_sense_entropy: number;
  post_mind_entropy: number;
  final_entropy: number;
  delta_s: number; // ΔS - should be <= 0 for F4 compliance
};
