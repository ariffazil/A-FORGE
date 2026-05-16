/**
 * DeepnShadow Protocol — TypeScript mirror of arifOS internal protocol.
 * DS-111..DS-999: encode → decode → metabolize
 *
 * INTERNAL ONLY. No external MCP surface.
 * This file defines types; logic lives in HumanInteractionGuard.
 */

export type EvidenceClass = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
export type DignityStatus = "safe" | "guarded" | "hold";
export type InferenceMode = "mirror" | "other" | "team";
export type EmotionalCharge =
  | "anger"
  | "shame"
  | "suspicion"
  | "confusion"
  | "hurt"
  | "fear"
  | "grief"
  | "low"
  | "neutral";

export interface BehaviourObservation {
  observation_id: string;
  session_id: string;
  actor_id?: string | null;
  description: string;
  context?: string | null;
  source: string;
  evidence_class: EvidenceClass;
}

export interface PatternRecurrence {
  pattern_id: string;
  observation_ids: string[];
  recurrence_count: number;
  time_window_days: number;
  trigger_contexts: string[];
  confidence: number;
}

export interface AlternativeExplanation {
  explanation_id: string;
  hypothesis_id: string;
  explanation_text: string;
  likelihood: string;
}

export interface ShadowHypothesis {
  hypothesis_id: string;
  pattern_id: string;
  hypothesis_text: string;
  trigger_vector?: string | null;
  confidence: number;
  uncertainty_band: string;
  is_dignity_safe: boolean;
  dignity_status: DignityStatus;
  alternative_explanations: AlternativeExplanation[];
}

export interface ProjectionMirror {
  mirror_id: string;
  hypothesis_id: string;
  arif_trigger_match?: string | null;
  resonance_score: number;
  reflection_text: string;
  safe_self_action?: string | null;
}

export interface ScarVector {
  vector_id: string;
  hypothesis_id: string;
  protected_zone: string;
  confidence: number;
  boundary_type: string;
  safe_action_hint?: string | null;
}

export interface SafeAction {
  action_text: string;
  avoids_trigger?: string | null;
  preserves_dignity: boolean;
  escalation_path?: string | null;
}

export interface MetabolizedAction {
  metabolize_id: string;
  action: SafeAction;
  raw_charge: EmotionalCharge;
  metabolized_charge: string;
  arif_scar_link?: string | null;
}

export interface TeamShadowPattern {
  team_pattern_id: string;
  team_name?: string | null;
  observed_behaviours: string[];
  systemic_shadow?: string | null;
  alternative_systemic_cause?: string | null;
  safe_org_action?: string | null;
}

export interface DeepnShadowReport {
  report_id: string;
  session_id: string;
  mode: InferenceMode;
  observations: BehaviourObservation[];
  patterns: PatternRecurrence[];
  hypotheses: ShadowHypothesis[];
  alternative_explanations: AlternativeExplanation[];
  projection_mirrors: ProjectionMirror[];
  scar_vectors: ScarVector[];
  safe_actions: SafeAction[];
  metabolized_actions: MetabolizedAction[];
  team_patterns: TeamShadowPattern[];
  overall_dignity_status: DignityStatus;
  overall_confidence: number;
  verdict: string;
  constitutional_notes: string[];
}

export interface RedactedVaultEntry {
  entry_id: string;
  session_id: string;
  mode: InferenceMode;
  role_tag?: string | null;
  pattern_summary: string;
  safe_response?: string | null;
  outcome?: string | null;
  dignity_status: DignityStatus;
}
