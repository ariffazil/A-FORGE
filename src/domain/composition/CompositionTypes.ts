/**
 * CompositionTypes.ts — Type definitions for the Composition Bus
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 4: COMPOSITION (KEYSTONE)
 * 4 composition patterns: Sequential, Parallel, Conditional, Loop
 *
 * @module domain/composition/CompositionTypes
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

export type CompositionPattern = "sequential" | "parallel" | "conditional" | "loop" | "mixed";

export interface CompositionStep {
  id: string;
  tool: string;
  args: Record<string, any>;
  depends_on?: string[];
  when?: string;
  max_retries?: number;
  on_fail?: "skip" | "abort" | string;
  timeout_ms?: number;
  organ?: string;
}

export interface CompositionDefinition {
  id?: string;
  task: string;
  pattern: CompositionPattern;
  steps: CompositionStep[];
  merge?: "aggregate_results" | "first_success" | "all_required";
  timeout_ms?: number;
  hold_id?: string;
}

export type StepStatus = "pending" | "running" | "PASS" | "FAIL" | "SKIPPED" | "TIMEOUT";

export interface StepResult {
  step_id: string;
  tool: string;
  status: StepStatus;
  output?: any;
  receipt_hash?: string;
  duration_ms: number;
  error?: string;
  retries_used?: number;
}

export interface CompositionReceipt {
  composition_id: string;
  task: string;
  pattern: CompositionPattern;
  steps: StepResult[];
  aggregate: {
    total_steps: number;
    passed: number;
    failed: number;
    skipped: number;
    total_duration_ms: number;
    delta_s: number;
    w3: number;
    g: number;
  };
  vault_entry_id?: string;
  arifflow_receipts?: string[];
}

export type CompositionStatus = "planning" | "running" | "completed" | "failed" | "rolled_back" | "cancelled";

export interface CompositionState {
  composition_id: string;
  status: CompositionStatus;
  definition: CompositionDefinition;
  step_results: Map<string, StepResult>;
  started_at?: string;
  completed_at?: string;
  current_step?: string;
  rollback_stack?: string[];
}
