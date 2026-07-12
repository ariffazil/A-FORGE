/**
 * memory-lifecycle.ts — Canonical Memory Lifecycle Types
 *
 * The Four Planes (A/B/C/D) for governed agentic memory.
 * Memory = governed past: provenance, time, scope, truth class, lifecycle, correction.
 *
 * Storage holds state. The invariant substrate determines what that state means.
 *
 * Additions:
 *   §8A — L4→L5 Promotion Formula (governed multi-dimensional promotion scoring)
 *   §8B — Reasoning Budget (metabolic control for thinking, complementary to 17x rule)
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Sections 1, 3, 4, 5, 5A
 * @see /root/A-FORGE/schemas/agentic-event-envelope.schema.json — D2
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F2 TRUTH  — epistemic classes are evidence-bound
 * @constitutional F7 HUMILITY — confidence reflects genuine uncertainty
 * @constitutional F11 AUDITABILITY — every memory has lineage
 */

import type { GovernedDomain } from "../../contracts/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — MEMORY TIER (Plane A: Cognitive Memory Lifecycle)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Memory tiers from M0 (immediate) to M6 (constitutional).
 * Higher tiers require stricter governance gates for promotion.
 */
export type MemoryTier =
  | "M0" // Immediate model context — one reasoning call
  | "M1" // Working scratch — seconds to minutes
  | "M2" // Session continuity — minutes to hours
  | "M3" // Candidate memory — days until evaluated
  | "M4" // Durable governed memory — months or policy-defined
  | "M5" // Relationship/contradiction projection — derived, rebuildable
  | "M6"; // Constitutional receipt/scar — permanent, minimised

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — STORAGE BACKEND (Plane B: Physical Storage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Physical storage backends mapped to memory tiers.
 * Each backend owns specific tiers; cross-tier access follows ownership rules.
 */
export type StorageBackend =
  | "redis"         // M1, M2 — ephemeral working memory
  | "postgresql"    // M3, M4 — canonical identity, structured facts
  | "qdrant"        // Semantic index over M3/M4
  | "pgvector"      // Semantic index (alternative to Qdrant)
  | "falkordb"      // M5 — relationship projection
  | "vault999"      // M6 — constitutional receipts, append-only
  | "sqlite"        // Domain-local ephemeral state
  | "filesystem";   // Artifacts — not governed memory

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — TRANSPORT LAYER (Plane C: Transport / Observation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Transport and observation layers for inter-component communication.
 */
export type TransportLayer =
  | "nats"            // Event transport, JetStream durability
  | "langfuse"        // AI trace observability
  | "logs"            // Diagnosis, debugging
  | "opentelemetry"   // Distributed tracing
  | "eventemitter";   // In-process fallback

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — INTERFACE ADAPTER (Plane D: Interfaces / Adapters)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interface adapters for human and programmatic access.
 */
export type InterfaceAdapter =
  | "hermes"      // IDE plugin integration
  | "ide_profile" // Per-IDE configuration
  | "markdown"    // Human-readable documentation
  | "mcp_tool"    // Programmatic MCP interface
  | "aaa_cockpit" // Visual dashboard, A2A authority
  | "cli";        // Command-line interface

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — TRUTH CLASS (Epistemic Classification)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Epistemic classification for every claim. B3: Facts, beliefs, hypotheses are separate.
 * A hypothesis treated as a fact is a lie (F2 TRUTH).
 */
export type TruthClass =
  | "FACT"       // Verified, evidence-backed, reproducible
  | "BELIEF"     // Held with confidence but not independently verified
  | "HYPOTHESIS" // Proposed explanation, awaiting evidence
  | "ESTIMATE"   // Computed approximation with known bounds
  | "UNKNOWN";   // Insufficient information to classify

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — MEMORY STATUS (Lifecycle State)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle status of a memory candidate.
 */
export type MemoryStatus =
  | "RAW"              // Just observed, not yet classified
  | "CLASSIFIED"       // Epistemic class assigned
  | "EVALUATING"       // Under promotion review
  | "PROMOTED"         // Passed promotion gate
  | "SUPERCeded"       // Replaced by a newer, more accurate memory (B10: correctable)
  | "CONTRADICTED"     // Conflicts with another memory (resolution pending)
  | "RESOLVED"         // Contradiction resolved
  | "SEALED"           // M6: constitutional receipt, immutable
  | "COOLING"          // In cooling period after promotion
  | "METABOLISED";     // Absorbed into higher-order pattern

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — MEMORY CANDIDATE (What Enters Promotion)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A memory candidate — an observation with provenance awaiting promotion evaluation.
 */
export interface MemoryCandidate {
  /** Unique memory ID */
  id: string;
  /** Current memory tier */
  tier: MemoryTier;
  /** Lifecycle status */
  status: MemoryStatus;
  /** Epistemic classification (B3) */
  truth_class: TruthClass;
  /** Confidence level (F7 HUMILITY: must reflect genuine uncertainty) */
  confidence: number;
  /** Memory content — the actual observation or fact */
  content: Record<string, unknown> | string;
  /** Domain scope */
  domain: GovernedDomain;
  /** Physical storage backend */
  storage: StorageBackend;
  /** How this memory was observed */
  source_type: "direct_observation" | "tool_output" | "human_input" | "database_query" | "web_fetch" | "inference" | "prior_memory";
  /** Who/what observed this memory */
  source_id: string;
  /** Independent evidence sources (for promotion evaluation) */
  independent_sources: number;
  /** Quality score of the evidence (0-1) */
  evidence_quality: number;
  /** Contradiction status */
  contradiction_status: "NONE" | "RESOLVED" | "UNRESOLVED";
  /** IDs of contradicting memories */
  contradicts: string[];
  /** ID of the memory this supersedes (B10: correctable) */
  supersedes?: string;
  /** Parent event ID for lineage (B9) */
  parent_event_id?: string;
  /** Causal chain of events leading to this memory */
  causal_chain: string[];
  /** Creation timestamp */
  created_at: string;
  /** Last evaluation timestamp */
  last_evaluated_at?: string;
  /** Promotion timestamp (if promoted) */
  promoted_at?: string;
  /** Cooling state */
  cooling_state: CoolingState;
  /** Domain-specific tags */
  tags: string[];
  /** Metadata — arbitrary structured data */
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — PROMOTION CRITERIA (Corrected: Not "3+ Occurrences")
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Promotion criteria for memory tier advancement.
 * Naive "3+ occurrences" is UNSAFE. Requires multi-dimensional validation.
 *
 * promotable = (
 *   minimum_occurrences >= threshold
 *   AND independent_sources >= 2
 *   AND evidence_quality >= quality_floor
 *   AND contradiction_status != UNRESOLVED
 *   AND scope_consistency = true
 * )
 */
export interface PromotionCriteria {
  /** Minimum independent observations required */
  minimum_occurrences: number;
  /** Minimum distinct sources (guards against single-source spam) */
  independent_sources: number;
  /** Quality floor — below this, observation is ignored regardless of count */
  evidence_quality: number;
  /** Must be resolved before promotion (no unresolved contradictions) */
  contradiction_status: "NONE" | "RESOLVED" | "UNRESOLVED";
  /** Observation must be consistent with its declared scope */
  scope_consistency: boolean;
  /** Optional: domain-specific override for stricter criteria */
  domain_override?: GovernedDomain;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8A — L4→L5 PROMOTION FORMULA (Governed Multi-Dimensional Scoring)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Weights for the multi-dimensional promotion formula.
 * Each weight controls the contribution of one dimension.
 */
export interface PromotionWeights {
  /** Weight for access frequency (logarithmic) */
  frequency_weight: number;
  /** Weight for source independence */
  independence_weight: number;
  /** Weight for evidence quality */
  evidence_weight: number;
  /** Weight for contradiction penalty */
  contradiction_penalty: number;
  /** Weight for scope specificity */
  scope_weight: number;
  /** Weight for human consequence penalty */
  consequence_weight: number;
}

/** Default weights — balanced across dimensions, independence and evidence dominate */
export const DEFAULT_PROMOTION_WEIGHTS: PromotionWeights = {
  frequency_weight: 0.20,
  independence_weight: 0.25,
  evidence_weight: 0.25,
  contradiction_penalty: 0.15,
  scope_weight: 0.10,
  consequence_weight: 0.05,
};

/**
 * Promotion formula configuration.
 * Defines weights, thresholds, and hard gates for L4→L5 promotion.
 */
export interface PromotionFormula {
  /** Dimension weights */
  weights: PromotionWeights;
  /** Minimum composite score to pass promotion (default: 0.65) */
  threshold: number;
  /** Maximum number of sources for normalization (default: 10) */
  max_sources: number;
  /** Minimum distinct independent sources required (default: 2) */
  min_independent_sources: number;
}

/** Default promotion formula */
export const DEFAULT_PROMOTION_FORMULA: PromotionFormula = {
  weights: DEFAULT_PROMOTION_WEIGHTS,
  threshold: 0.65,
  max_sources: 10,
  min_independent_sources: 2,
};

/**
 * Input to the promotion scoring function.
 * Raw metrics computed from the memory candidate and its observations.
 */
export interface PromotionInput {
  /** Number of times this memory was accessed */
  access_count: number;
  /** Number of unique sources that contributed to this memory */
  unique_sources: number;
  /** Maximum possible sources (for normalization) */
  max_sources: number;
  /** Mean confidence across all evidence */
  mean_evidence_confidence: number;
  /** Ratio of contested observations (0 = none, 1 = fully contested) */
  contested_ratio: number;
  /** Scope specificity (0 = generic, 1 = highly specific) */
  scope_specificity: number;
  /** Human consequence factor (0 = none, 1 = high consequence) */
  human_consequence: number;
  /** Whether unresolved disputes exist */
  contested: boolean;
}

/**
 * Result of the promotion scoring function.
 */
export interface PromotionResult {
  /** Composite promotion score (0-1) */
  score: number;
  /** Whether the memory passes all hard gates */
  passed: boolean;
  /** Individual dimension scores for auditability */
  dimensions: {
    frequency: number;
    independence: number;
    evidence: number;
    contradiction: number;
    scope: number;
    consequence: number;
  };
  /** Hard gate results */
  gates: {
    score_threshold: boolean;
    not_contested: boolean;
    min_independent_sources: boolean;
  };
  /** Human-readable reason if promotion failed */
  reason?: string;
}

/**
 * Compute the multi-dimensional promotion score.
 *
 * Formula:
 *   score = frequency * independence * evidence * contradiction * scope * consequence
 *
 * Hard gates (non-negotiable):
 *   1. contested == false
 *   2. unique_sources >= min_independent_sources
 *   3. score >= threshold
 *
 * @param input — raw metrics from the memory candidate
 * @param formula — formula configuration (weights, thresholds)
 * @returns PromotionResult with score, pass/fail, and auditability breakdown
 */
export function computePromotionScore(
  input: PromotionInput,
  formula: PromotionFormula = DEFAULT_PROMOTION_FORMULA,
): PromotionResult {
  const w = formula.weights;

  // Logarithmic frequency (prevents spam gaming)
  const frequency = Math.log2(input.access_count + 1) / Math.log2(20);

  // Normalized independence
  const independence = Math.min(input.unique_sources / formula.max_sources, 1);

  // Evidence quality (already 0-1)
  const evidence = input.mean_evidence_confidence;

  // Contradiction penalty (1 = no contradiction, 0 = fully contested)
  const contradiction = 1 - input.contested_ratio;

  // Scope specificity (already 0-1)
  const scope = input.scope_specificity;

  // Consequence penalty (1 = no consequence, 0 = maximum consequence)
  const consequence = 1 - input.human_consequence;

  // Weighted composite
  const score =
    w.frequency_weight * frequency +
    w.independence_weight * independence +
    w.evidence_weight * evidence +
    w.contradiction_penalty * contradiction +
    w.scope_weight * scope +
    w.consequence_weight * consequence;

  // Hard gates
  const gates = {
    score_threshold: score >= formula.threshold,
    not_contested: !input.contested,
    min_independent_sources: input.unique_sources >= formula.min_independent_sources,
  };

  const passed = gates.score_threshold && gates.not_contested && gates.min_independent_sources;

  let reason: string | undefined;
  if (!passed) {
    if (!gates.not_contested) reason = "Unresolved disputes block promotion";
    else if (!gates.min_independent_sources) reason = `Need ${formula.min_independent_sources} independent sources, have ${input.unique_sources}`;
    else if (!gates.score_threshold) reason = `Score ${score.toFixed(3)} below threshold ${formula.threshold}`;
  }

  return {
    score,
    passed,
    dimensions: {
      frequency: w.frequency_weight * frequency,
      independence: w.independence_weight * independence,
      evidence: w.evidence_weight * evidence,
      contradiction: w.contradiction_penalty * contradiction,
      scope: w.scope_weight * scope,
      consequence: w.consequence_weight * consequence,
    },
    gates,
    reason,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8B — REASONING BUDGET (Metabolic Control for Thinking)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reasoning budget — caps THINKING expenditure.
 * Complementary to the 17x rule which caps DECISION expenditure.
 *
 * | Control         | Caps               | Trigger                           |
 * |-----------------|--------------------|-----------------------------------|
 * | 17x Rule        | DECISION spend     | Cost > 17x expected value         |
 * | Reasoning Budget| THINKING spend     | Steps/tokens/cost exceed limits   |
 */
export interface ReasoningBudget {
  /** Maximum reasoning steps (iterations of the think loop) */
  max_steps: number;
  /** Maximum tool calls during reasoning */
  max_tool_calls: number;
  /** Maximum cost in USD */
  max_cost_usd: number;
  /** Maximum tokens consumed */
  max_tokens: number;
  /** Condition that triggers escalation (natural language predicate) */
  escalation_condition: string;
  /** Condition that triggers halt (natural language predicate) */
  halt_condition: string;
}

/** Default reasoning budget — conservative, forces convergence */
export const DEFAULT_REASONING_BUDGET: ReasoningBudget = {
  max_steps: 12,
  max_tool_calls: 20,
  max_cost_usd: 0.50,
  max_tokens: 100_000,
  escalation_condition: "confidence < 0.60 after 3 attempts",
  halt_condition: "repeated_failure >= 3 OR contradiction_unresolved",
};

/**
 * Current status of the reasoning budget — tracked per lifecycle stage.
 */
export interface ReasoningBudgetStatus {
  /** Steps taken so far */
  steps_taken: number;
  /** Tool calls made so far */
  tool_calls_made: number;
  /** Cost incurred so far (USD) */
  cost_incurred: number;
  /** Tokens consumed so far */
  tokens_consumed: number;
  /** Number of repeated failures */
  repeated_failures: number;
  /** Whether contradictions remain unresolved */
  contradiction_unresolved: boolean;
  /** Current confidence level */
  current_confidence: number;
  /** Number of attempts at the current reasoning approach */
  current_attempts: number;
}

/**
 * Result of a reasoning budget check.
 */
export interface ReasoningBudgetCheckResult {
  /** Whether the agent should halt reasoning entirely */
  should_halt: boolean;
  /** Whether the agent should escalate to higher authority (e.g. 888_JUDGE) */
  should_escalate: boolean;
  /** Which budget dimension was exceeded (if any) */
  exceeded_dimension?: "steps" | "tool_calls" | "cost" | "tokens" | "escalation" | "halt_condition";
  /** Human-readable explanation */
  reason: string;
}

/**
 * Check whether the reasoning budget has been exceeded.
 *
 * Call this before each lifecycle stage transition. If should_halt or should_escalate
 * is true, do not proceed to the next stage.
 *
 * @param status — current budget consumption
 * @param budget — budget limits
 * @returns ReasoningBudgetCheckResult
 */
export function checkReasoningBudget(
  status: ReasoningBudgetStatus,
  budget: ReasoningBudget = DEFAULT_REASONING_BUDGET,
): ReasoningBudgetCheckResult {
  // Check hard limits
  if (status.steps_taken >= budget.max_steps) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "steps",
      reason: `Reasoning steps (${status.steps_taken}) >= max (${budget.max_steps})`,
    };
  }

  if (status.tool_calls_made >= budget.max_tool_calls) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "tool_calls",
      reason: `Tool calls (${status.tool_calls_made}) >= max (${budget.max_tool_calls})`,
    };
  }

  if (status.cost_incurred >= budget.max_cost_usd) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "cost",
      reason: `Cost ($${status.cost_incurred.toFixed(2)}) >= max ($${budget.max_cost_usd.toFixed(2)})`,
    };
  }

  if (status.tokens_consumed >= budget.max_tokens) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "tokens",
      reason: `Tokens (${status.tokens_consumed}) >= max (${budget.max_tokens})`,
    };
  }

  // Check escalation: confidence < 0.60 after 3+ attempts
  if (status.current_attempts >= 3 && status.current_confidence < 0.60) {
    return {
      should_halt: false,
      should_escalate: true,
      exceeded_dimension: "escalation",
      reason: `Confidence ${status.current_confidence.toFixed(2)} < 0.60 after ${status.current_attempts} attempts — escalate to 888_JUDGE`,
    };
  }

  // Check halt conditions
  if (status.repeated_failures >= 3) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "halt_condition",
      reason: `Repeated failures (${status.repeated_failures}) >= 3 — halt`,
    };
  }

  if (status.contradiction_unresolved) {
    return {
      should_halt: true,
      should_escalate: false,
      exceeded_dimension: "halt_condition",
      reason: "Unresolved contradictions — cannot proceed",
    };
  }

  return {
    should_halt: false,
    should_escalate: false,
    reason: "Budget within limits",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — MEMORY PROJECTION (Plane B: Derived State)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A derived projection from canonical memory — relationship graph, similarity cluster,
 * contradiction map. Projections are rebuildable; they do not own truth.
 */
export interface MemoryProjection {
  /** Unique projection ID */
  id: string;
  /** Projection type */
  type: "relationship" | "similarity_cluster" | "contradiction_map" | "temporal_chain" | "domain_summary";
  /** Source memory IDs this projection derives from */
  source_memory_ids: string[];
  /** Physical backend storing this projection */
  backend: "falkordb" | "qdrant" | "pgvector";
  /** Projection-specific data structure */
  data: Record<string, unknown>;
  /** When this projection was computed */
  computed_at: string;
  /** Whether this projection is stale (source memories have changed) */
  stale: boolean;
  /** Domain scope */
  domain: GovernedDomain;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — COOLING STATE (Thermal Metaphor for Memory Stability)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Memory cooling states — how recently a memory was accessed or modified.
 * FROZEN memories are stable, well-integrated. FRESH memories are volatile.
 */
export type CoolingState =
  | "FRESH"  // Just created or accessed — highest volatility
  | "WARM"   // Recently accessed — moderate stability
  | "COOL"   // Not recently accessed — high stability
  | "FROZEN"; // Long-stable, deeply integrated — lowest volatility

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — METABOLIC STATE (Scar / Learning Lifecycle)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metabolic states for the scar/learning lifecycle.
 * The system learns from irreversible mistakes through pain (B11).
 */
export type MetabolicState =
  | "IDLE"      // No active metabolism
  | "COOLING"   // Cooling after a scar event
  | "LEARNING"  // Actively integrating scar patterns
  | "SCARRED";  // Scar sealed, wisdom updated

/**
 * Metabolic record — tracks the system's learning from failures.
 */
export interface MetabolicRecord {
  /** Unique record ID */
  id: string;
  /** Current metabolic state */
  state: MetabolicState;
  /** Scars produced in this metabolic cycle */
  scars_produced: number;
  /** Scars consulted before action */
  scars_consulted: number;
  /** Wisdom delta — change in Phi */
  wisdom_delta: number;
  /** When this metabolic cycle started */
  started_at: string;
  /** When this metabolic cycle completed */
  completed_at?: string;
  /** Scar IDs produced */
  scar_ids: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 — AGENTIC EVENT ENVELOPE (Section 7: Canonical Envelope)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Identity section — who is acting.
 * B1: Every action has actor. B6: Authority is action-specific + time-bounded.
 */
export interface EnvelopeIdentity {
  actor_id: string;
  session_id: string;
  lease_id?: string;
  correlation_id?: string;
  emitted_by: "arifos" | "aforge" | "geox" | "wealth" | "well" | "aaa" | "human";
  authority_scope?: string[];
}

/**
 * Intent section — why this action exists.
 * B2: Every action has explicit intent.
 */
export interface EnvelopeIntent {
  purpose: string;
  goal_id?: string;
  expected_outcome?: string;
  failure_outcome?: string;
  reversible: boolean;
}

/**
 * Epistemic section — what class of knowledge.
 * B3: Facts, beliefs, hypotheses are separate.
 */
export interface EnvelopeEpistemic {
  truth_class: TruthClass;
  confidence: number;
  evidence_sources: Array<{
    source_id: string;
    source_type: string;
    reliability: number;
    observed_at: string;
  }>;
  contradiction_status: "NONE" | "RESOLVED" | "UNRESOLVED";
}

/**
 * Action section — what is being done.
 * B5: Every mutation classified before execution.
 */
export interface EnvelopeAction {
  action_type: "observe" | "reason" | "plan" | "execute" | "verify" | "seal" | "correct" | "metabolize";
  classification: "OBSERVE" | "SUGGEST" | "SIMULATE" | "DRAFT" | "QUEUE" | "EXECUTE_REVERSIBLE" | "EXECUTE_HIGH_IMPACT" | "IRREVERSIBLE";
  tool_name?: string;
  parameters?: Record<string, unknown>;
  side_effects_declared?: Array<"filesystem" | "network" | "shell" | "database" | "vault" | "none">;
  dry_run: boolean;
}

/**
 * Governance section — what gates were checked.
 * B7: Execution and judgment are separate.
 */
export interface EnvelopeGovernance {
  floors_checked: string[];
  floors_triggered: string[];
  verdict: "SEAL" | "HOLD" | "SABAR" | "VOID" | "PENDING";
  lease_valid: boolean;
  authority_chain: string[];
  benda_wajib_result: {
    passed: number[];
    violated: number[];
    warnings: string[];
  };
}

/**
 * Lineage section — where this action came from.
 * B9: Every state transition has lineage.
 */
export interface EnvelopeLineage {
  parent_event_id?: string;
  trigger?: string;
  causal_chain: string[];
  created_at: string;
  previous_envelope_hash?: string;
}

/**
 * Metabolic section — what changed in the system's learning.
 * Conditional: only present when scars are produced or consulted.
 */
export interface EnvelopeMetabolic {
  metabolic_state: MetabolicState;
  scars_produced: number;
  scars_consulted: number;
  cooling_state: CoolingState;
  wisdom_delta?: number;
}

/**
 * AgenticEventEnvelope — the canonical envelope for every governed action.
 * Seven sections. No exceptions.
 *
 * @see /root/A-FORGE/schemas/agentic-event-envelope.schema.json — D2
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 7
 */
export interface AgenticEventEnvelope {
  identity: EnvelopeIdentity;
  intent: EnvelopeIntent;
  epistemic: EnvelopeEpistemic;
  action: EnvelopeAction;
  governance: EnvelopeGovernance;
  lineage: EnvelopeLineage;
  metabolic?: EnvelopeMetabolic;
  envelope_version: "1.0.0";
  emitted_at: string;
}

/** Task-level work contract shared with the governed runtime. */
export interface WorkContract {
  task_id: string;
  objective: string;
  success_criteria: string[];
  budget: {
    reasoning: { max_cycles: number; max_input_tokens: number; max_output_tokens: number };
    tools: { max_calls_total: number };
    coordination: { max_delegations: number };
    cost: { max_usd: number };
    termination: { confidence_target: number };
  };
}

/** Verified outcome and resource receipt for one governed task. */
export interface TaskOutcome {
  task_id: string;
  objective_met?: boolean;
  outcome_verified: boolean;
  V_r?: number;
  budgets?: {
    reasoning_cycles: [number, number];
    tool_calls: [number, number];
    delegations: [number, number];
    cost_usd: [number, number];
  };
  context?: {
    selected_documents: number;
    rejected_documents: number;
    context_tokens: [number, number];
    stale_sources_excluded: number;
  };
  verification?: { proposals: number; tested: number; verified: number; falsified: number };
  coordination?: { overhead_tokens: number; specialist_gain: number };
  value?: { decision_value: number; cost_per_verified_outcome_usd: number };
  termination_reason?: string;
}

/**
 * BudgetConsumed — actual resource consumption during a run.
 * Pairs with WorkContract.budget limits: [used, allocated].
 * The measurement spine's per-run accounting record.
 *
 * @see /root/A-FORGE/schemas/agentic-event-envelope.schema.json#budget_consumed — D2
 */
export interface BudgetConsumed {
  reasoning_cycles?: [number, number];
  tool_calls_total?: [number, number] | number;
  memory_retrievals?: number;
  cost_usd?: [number, number] | number;
  elapsed_seconds?: [number, number];
  delegations?: [number, number];
}

/**
 * AgenticEventEnvelope — the canonical envelope for every governed action.
 * Seven sections + work-ledger reference (D2↔D4 sync, forged 2026-07-12).
 *
 * The three optional work-ledger fields close the BW14 invariant gap:
 * every run must reference a WorkContract, a TaskOutcome, or BudgetConsumed.
 *
 * @see /root/A-FORGE/schemas/agentic-event-envelope.schema.json — D2
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 7
 */
export interface AgenticEventEnvelope {
  identity: EnvelopeIdentity;
  intent: EnvelopeIntent;
  epistemic: EnvelopeEpistemic;
  action: EnvelopeAction;
  governance: EnvelopeGovernance;
  lineage: EnvelopeLineage;
  metabolic?: EnvelopeMetabolic;
  envelope_version: "1.0.0";
  emitted_at: string;

  // ──────────────────────────────────────────────────────────────────────────
  // Work-ledger references (D2↔D4 sync — D6 closure)
  // At least one of work_contract_id / task_outcome / budget_consumed
  // MUST be present for BW14 (every run has a governed work ledger).
  // ──────────────────────────────────────────────────────────────────────────

  /** Reference to the WorkContract minted at 000 INIT. */
  work_contract_id?: string;

  /** Verified TaskOutcome produced at 999 SEAL. */
  task_outcome?: TaskOutcome;

  /** Actual budget consumption for this run ([used, allocated] tuples). */
  budget_consumed?: BudgetConsumed;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Note: the original AgenticEventEnvelope ended at emitted_at. The three
 * optional work-ledger fields above are added by D7 to close the D2↔D4 type
 * sync gap. Behavior unchanged for envelopes that omit all three (BW14 will
 * still flag them). Behavior unchanged for envelopes that include any of the
 * three (BW14 already accepted them via cast; now they are typed).
 * ──────────────────────────────────────────────────────────────────────────── */
