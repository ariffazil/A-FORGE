/**
 * Planner output types for the arifOS → A-FORGE governance pipeline.
 *
 * PlannerAgent (read-only LLM) emits ProposedChange[] which PolicyEnforcer
 * validates before ApprovalRouter decides AUTO_APPROVED / HUMAN_APPROVAL_REQUIRED / REJECTED.
 * Only then does ForgeExecutionManifest reach A-FORGE for diff-only application.
 */

import type { WorkerTask } from "./agent.js";

export type ChangeOperation = "patch_apply" | "append" | "create_new";

export interface ProposedChange {
  file_path: string;
  operation: ChangeOperation;
  unified_diff?: string;
  append_text?: string;
  new_file_initial_content?: string;
  rationale: string;
  retrieval_evidence: string[];
}

export interface PlannerOutput {
  intent: string;
  success_criteria?: string;
  non_goals?: string[];
  existing_targets: string[];
  proposed_changes: ProposedChange[];
  create_new_file_reason?: string;
  risk_score: number;
  confidence: number;
}

export type PlanJudgeVerdict = "SEAL" | "HOLD" | "SABAR";

export interface PlanningStrategy {
  strategyId: string;
  strategyName: string;
  systemPromptSuffix: string;
  riskBias: number;
}

export interface PlanCandidate {
  strategyId: string;
  strategyName: string;
  tasks: WorkerTask[];
  confidence: number;
  rationale: string;
  riskScore: number;
  generatedAt: string;
}

export interface PlanComparison {
  candidates: PlanCandidate[];
  divergenceScore: number;
  consensusReached: boolean;
  selectedStrategyId: string | null;
  selectedTasks: WorkerTask[];
  verdict: PlanJudgeVerdict;
  reason: string;
}


