/**
 * vertical-agent/index.ts — VerticalAgentFactory
 *
 * The canonical factory for governed vertical agents.
 * Creates an agent instance that follows the 000-999 lifecycle with
 * budget enforcement, audit trails, and envelope construction.
 *
 * Returns a plain object (not a class) with methods for lifecycle management.
 * This is the public API surface for the vertical-agent module.
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 9
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — every agent has a WorkContract before action
 * @constitutional F7 HUMILITY — reasoning budget prevents over-confident spiraling
 * @constitutional F11 AUDITABILITY — every state change produces an audit record
 */

import type { GovernedDomain } from "../../../contracts/types.js";
import type {
  AgenticEventEnvelope,
  TruthClass,
  WorkContract,
  TaskOutcome,
  ReasoningBudget,
  ReasoningBudgetStatus,
} from "../../types/memory-lifecycle.js";
import type {
  LifecycleStage,
  VerticalAgentState,
  Observation,
  Proposal,
  VerificationResult,
  Receipt,
} from "./types.js";
import {
  validateTransition,
  advanceStage,
  resetToInit,
  validTargets,
  forwardTargets,
  correctionTargets,
  isTerminal,
  isAhead,
  stageName,
  stageOrgan,
  validateLifecycleTrace,
} from "./state-machine.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — CONFIGURATION (What the agent needs to start)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for creating a new vertical agent.
 * All fields are required except lease_id and work_contract,
 * which can be provided later.
 */
export interface VerticalAgentConfig {
  /** Unique agent instance identifier */
  agent_id: string;
  /** Domain this agent operates in */
  domain: GovernedDomain;
  /** Session binding this agent to a conversation */
  session_id: string;
  /** Who spawned this agent (actor identity) */
  actor_id: string;
  /** Lease authorizing the agent's operations (optional at creation) */
  lease_id?: string;
  /** Work contract governing the run (optional at creation, but required before 333_THINK) */
  work_contract?: WorkContract;
  /** Custom reasoning budget (defaults to conservative DEFAULT_REASONING_BUDGET) */
  reasoning_budget?: ReasoningBudget;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — RESULT (What the agent produces)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The complete result of a vertical agent run.
 * Produced when the agent completes its lifecycle or encounters an unrecoverable error.
 */
export interface VerticalAgentResult {
  /** Whether the agent completed successfully */
  success: boolean;
  /** The final agent state (read-only snapshot) */
  state: VerticalAgentState;
  /** The built event envelope (if lifecycle reached JUDGE or SEAL) */
  envelope?: AgenticEventEnvelope;
  /** The sealed receipt (if lifecycle reached SEAL) */
  receipt?: Receipt;
  /** The task outcome measurement record */
  task_outcome?: TaskOutcome;
  /** Error information (if the agent failed) */
  error?: {
    code: string;
    message: string;
    at_stage: LifecycleStage;
    occurred_at: string;
  };
  /** Full lifecycle trace for audit */
  lifecycle_trace: LifecycleStage[];
  /** Budget consumption summary */
  budget_consumed: VerticalAgentState["budget_consumed"];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — FACTORY (Creates the agent object)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new vertical agent with lifecycle management methods.
 *
 * The agent starts at 000_INIT. Use advance() to progress through stages,
 * addObservation/addProposal/addVerification to feed data, and buildEnvelope()
 * to construct the event envelope.
 *
 * @param config — Agent configuration
 * @returns An object with methods for lifecycle management
 *
 * @example
 * ```typescript
 * const agent = createVerticalAgent({
 *   agent_id: "geo-prospect-001",
 *   domain: "geox",
 *   session_id: "sess-001",
 *   actor_id: "arif_forge",
 * });
 *
 * // Add observations at OBSERVE stage
 * agent.addObservation({ id: "obs-1", content: "...", ... });
 * agent.advance(); // -> 111_OBSERVE
 *
 * // ... continue through lifecycle
 * const result = agent.complete();
 * ```
 */
export function createVerticalAgent(config: VerticalAgentConfig) {
  // ── Internal State ──────────────────────────────────────────────────────

  const now = new Date().toISOString();

  let state: VerticalAgentState = {
    agent_id: config.agent_id,
    stage: "000_INIT",
    domain: config.domain,
    session_id: config.session_id,
    actor_id: config.actor_id,
    lease_id: config.lease_id,
    work_contract: config.work_contract,
    budget_consumed: {
      reasoning_cycles: 0,
      tool_calls: 0,
      delegations: 0,
      cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
    },
    observations: [],
    proposals: [],
    verifications: [],
    confidence: 0.0,
    memory_tier: "M0",
    cooling_state: "FRESH",
    history: [{ stage: "000_INIT", entered_at: now }],
    created_at: now,
    updated_at: now,
  };

  let envelope: Partial<AgenticEventEnvelope> = {};
  let reasoningBudgetStatus: ReasoningBudgetStatus = {
    steps_taken: 0,
    tool_calls_made: 0,
    cost_incurred: 0,
    tokens_consumed: 0,
    current_confidence: 0.0,
    current_attempts: 0,
    repeated_failures: 0,
    contradiction_unresolved: false,
  };

  // ── Accessor Methods ────────────────────────────────────────────────────

  /**
   * Get the current agent state (read-only snapshot).
   */
  function getState(): Readonly<VerticalAgentState> {
    return { ...state };
  }

  /**
   * Get the current lifecycle stage.
   */
  function getStage(): LifecycleStage {
    return state.stage;
  }

  // ── Data Collection Methods ──────────────────────────────────────────────

  /**
   * Add an observation during the OBSERVE stage.
   * Updates confidence based on observation quality.
   *
   * @param observation — The observation to record
   */
  function addObservation(observation: Observation): void {
    state.observations.push(observation);
    state.updated_at = new Date().toISOString();

    // Update running confidence average
    const total = state.observations.length;
    const sum = state.observations.reduce((acc, o) => acc + o.confidence, 0);
    state.confidence = sum / total;

    // Update budget: each observation is a "reasoning step"
    reasoningBudgetStatus.steps_taken += 1;
    reasoningBudgetStatus.current_confidence = state.confidence;
  }

  /**
   * Add a proposal during the THINK stage.
   * Proposals represent planned actions or hypotheses.
   *
   * @param proposal — The proposal to record
   */
  function addProposal(proposal: Proposal): void {
    state.proposals.push(proposal);
    state.updated_at = new Date().toISOString();

    // Update budget: each proposal is a reasoning step
    reasoningBudgetStatus.steps_taken += 1;
    if (proposal.tool_name) {
      reasoningBudgetStatus.tool_calls_made += 1;
    }
    reasoningBudgetStatus.current_confidence = state.confidence;
  }

  /**
   * Add a verification result during the VERIFY/CHECK phase.
   * Verification records validate proposals against outcomes.
   *
   * @param verification — The verification result to record
   */
  function addVerification(verification: VerificationResult): void {
    state.verifications.push(verification);
    state.updated_at = new Date().toISOString();

    // Update budget: verification is a step
    reasoningBudgetStatus.steps_taken += 1;
    reasoningBudgetStatus.tool_calls_made += 1;

    // Track consecutive failures
    if (!verification.passed) {
      reasoningBudgetStatus.repeated_failures += 1;
    } else {
      reasoningBudgetStatus.repeated_failures = 0;
    }

    // Track unresolved contradictions
    if (verification.contradictions.length > 0 && verification.match_quality < 0.5) {
      reasoningBudgetStatus.contradiction_unresolved = true;
    }

    reasoningBudgetStatus.current_confidence = state.confidence;
  }

  // ── Transition Methods ───────────────────────────────────────────────────

  /**
   * Check if the agent can transition to a specific stage.
   *
   * @param target — The stage to check
   * @returns true if the transition is valid
   */
  function canTransitionTo(target: LifecycleStage): boolean {
    const result = validateTransition(state.stage, target);
    return result.allowed;
  }

  /**
   * Advance the agent to the next stage in the canonical lifecycle.
   *
   * This is the primary progression method. It:
   *   1. Checks the reasoning budget (blocks if exceeded)
   *   2. Validates the transition is allowed
   *   3. Updates the agent state and history
   *
   * @returns StageAdvanceResult with success flag and budget info
   */
  function advance(): import("./state-machine.js").StageAdvanceResult {
    const result = advanceStage(state.stage, config.reasoning_budget, reasoningBudgetStatus);

    if (result.success) {
      // Close current history entry
      const currentEntry = state.history[state.history.length - 1];
      if (currentEntry && !currentEntry.exited_at) {
        currentEntry.exited_at = new Date().toISOString();
      }

      // Enter new stage
      const ts = new Date().toISOString();
      state.stage = result.transition.to;
      state.history.push({ stage: result.transition.to, entered_at: ts });
      state.updated_at = ts;

      // Stage-specific state updates
      updateStateForStage(result.transition.to);
    }

    return result;
  }

  /**
   * Reset the agent to 000_INIT for a new lifecycle run.
   * Only valid from 999_SEAL terminal stage.
   *
   * @returns TransitionResult indicating success or failure
   */
  function reset(): import("./state-machine.js").TransitionResult {
    const result = resetToInit(state.stage);

    if (result.allowed) {
      const ts = new Date().toISOString();

      // Close current history entry
      const currentEntry = state.history[state.history.length - 1];
      if (currentEntry && !currentEntry.exited_at) {
        currentEntry.exited_at = ts;
      }

      // Reset to INIT
      state.stage = "000_INIT";
      state.history.push({ stage: "000_INIT", entered_at: ts });
      state.updated_at = ts;

      // Reset runtime state (keep agent_id, domain, session, actor)
      state.observations = [];
      state.proposals = [];
      state.verifications = [];
      state.confidence = 0.0;
      state.memory_tier = "M0";
      state.cooling_state = "FRESH";
      state.error = undefined;
      state.receipt = undefined;
      state.task_outcome = undefined;
      state.budget_consumed = {
        reasoning_cycles: 0,
        tool_calls: 0,
        delegations: 0,
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
      };

      // Reset reasoning budget
      reasoningBudgetStatus = {
        steps_taken: 0,
        tool_calls_made: 0,
        cost_incurred: 0,
        tokens_consumed: 0,
        current_confidence: 0.0,
        current_attempts: 0,
        repeated_failures: 0,
        contradiction_unresolved: false,
      };

      // Reset envelope
      envelope = {};
    }

    return result;
  }

  /**
   * Set an error on the agent, marking it as failed.
   *
   * @param code — Error code (e.g., "BUDGET_EXCEEDED", "INVALID_TRANSITION")
   * @param message — Human-readable error message
   */
  function setError(code: string, message: string): void {
    state.error = {
      code,
      message,
      at_stage: state.stage,
      occurred_at: new Date().toISOString(),
    };
    state.updated_at = new Date().toISOString();
  }

  // ── Envelope Methods ─────────────────────────────────────────────────────

  /**
   * Build the AgenticEventEnvelope from accumulated state.
   * Constructs all seven sections: identity, intent, epistemic, action,
   * governance, lineage, and (optionally) metabolic.
   *
   * @returns The built event envelope
   */
  function buildEnvelope(): AgenticEventEnvelope {
    const ts = new Date().toISOString();

    // §1 Identity
    envelope.identity = {
      actor_id: state.actor_id,
      session_id: state.session_id,
      lease_id: state.lease_id,
      emitted_by: "aforge",
    };

    // §2 Intent — from first proposal
    if (state.proposals.length > 0) {
      const primary = state.proposals[0];
      envelope.intent = {
        purpose: primary.description,
        expected_outcome: primary.expected_outcome,
        failure_outcome: primary.failure_evidence,
        reversible: primary.reversible,
      };
    } else {
      envelope.intent = {
        purpose: "Vertical agent lifecycle run",
        reversible: true,
      };
    }

    // §3 Epistemic — from observations
    if (state.observations.length > 0) {
      const dominantTruthClass = getDominantTruthClass(state.observations);
      envelope.epistemic = {
        truth_class: dominantTruthClass,
        confidence: state.confidence,
        evidence_sources: state.observations.map((o) => ({
          source_id: o.source,
          source_type: o.source_type,
          reliability: o.source_reliability,
          observed_at: o.observed_at,
        })),
        contradiction_status: hasContradictions(state.observations) ? "UNRESOLVED" : "NONE",
      };
    } else {
      envelope.epistemic = {
        truth_class: "UNKNOWN",
        confidence: 0,
        evidence_sources: [],
        contradiction_status: "NONE",
      };
    }

    // §4 Action — from first proposal
    if (state.proposals.length > 0) {
      const primary = state.proposals[0];
      envelope.action = {
        action_type: "execute",
        classification: primary.classification,
        tool_name: primary.tool_name,
        parameters: primary.parameters,
        side_effects_declared: [],
        dry_run: false,
      };
    } else {
      envelope.action = {
        action_type: "observe",
        classification: "OBSERVE",
        side_effects_declared: ["none"],
        dry_run: true,
      };
    }

    // §5 Governance — placeholder (filled by judge)
    envelope.governance = {
      floors_checked: [],
      floors_triggered: [],
      verdict: "PENDING",
      lease_valid: state.lease_id !== undefined,
      authority_chain: [state.actor_id, "arifOS"],
      benda_wajib_result: { passed: [], violated: [], warnings: [] },
    };

    // §6 Lineage
    envelope.lineage = {
      causal_chain: state.history.map((h) => h.stage),
      created_at: ts,
    };

    // §7 Metabolic (conditional)
    if (state.error || state.verifications.length > 0) {
      envelope.metabolic = {
        metabolic_state: state.error ? "IDLE" : "LEARNING",
        scars_produced: state.error ? 1 : 0,
        scars_consulted: 0,
        cooling_state: state.cooling_state,
        wisdom_delta: 0,
      };
    }

    // Metadata
    envelope.envelope_version = "1.0.0";
    envelope.emitted_at = ts;

    return envelope as AgenticEventEnvelope;
  }

  // ── Completion ───────────────────────────────────────────────────────────

  /**
   * Complete the agent run and produce the final result.
   * Builds the envelope, produces the task outcome, and returns a snapshot.
   *
   * @returns The complete agent result
   */
  function complete(): VerticalAgentResult {
    // Build envelope if not already built
    const finalEnvelope = envelope.identity ? (envelope as AgenticEventEnvelope) : buildEnvelope();

    // Produce task outcome
    const taskOutcome = produceTaskOutcome();

    return {
      success: !state.error,
      state: { ...state },
      envelope: finalEnvelope,
      receipt: state.receipt,
      task_outcome: taskOutcome,
      error: state.error,
      lifecycle_trace: state.history.map((h) => h.stage),
      budget_consumed: { ...state.budget_consumed },
    };
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Update state fields based on the stage being entered.
   */
  function updateStateForStage(stage: LifecycleStage): void {
    switch (stage) {
      case "222_ENCODE":
        state.memory_tier = "M1";
        break;
      case "333_THINK":
        state.memory_tier = "M2";
        break;
      case "777_FORGE":
        state.memory_tier = "M3";
        break;
      case "999_SEAL":
        state.memory_tier = "M6";
        break;
    }
  }

  /**
   * Get the dominant truth class from observations.
   */
  function getDominantTruthClass(observations: Observation[]): TruthClass {
    const priority: TruthClass[] = ["FACT", "BELIEF", "HYPOTHESIS", "ESTIMATE", "UNKNOWN"];
    for (const tc of priority) {
      if (observations.some((o) => o.truth_class === tc)) return tc;
    }
    return "UNKNOWN";
  }

  /**
   * Check if observations contain contradictions.
   */
  function hasContradictions(observations: Observation[]): boolean {
    if (observations.length < 2) return false;
    const classes = new Set(observations.map((o) => o.truth_class));
    return classes.size > 2;
  }

  /**
   * Produce the TaskOutcome receipt.
   */
  function produceTaskOutcome(): TaskOutcome {
    const contract = state.work_contract;
    const consumed = state.budget_consumed;
    const budget = contract?.budget;
    const tested = state.verifications.length;
    const verified = state.verifications.filter((v) => v.passed).length;

    return {
      task_id: contract?.task_id ?? state.agent_id,
      objective_met: state.confidence >= (contract?.budget.termination.confidence_target ?? 0.8),
      outcome_verified: tested > 0 && verified === tested,
      budgets: {
        reasoning_cycles: [consumed.reasoning_cycles, budget?.reasoning.max_cycles ?? 0],
        tool_calls: [consumed.tool_calls, budget?.tools.max_calls_total ?? 0],
        delegations: [consumed.delegations, budget?.coordination.max_delegations ?? 0],
        cost_usd: [consumed.cost_usd, budget?.cost.max_usd ?? 0],
      },
      context: {
        selected_documents: state.observations.length,
        rejected_documents: 0,
        context_tokens: [consumed.input_tokens, budget?.reasoning.max_input_tokens ?? 0],
        stale_sources_excluded: 0,
      },
      verification: {
        proposals: state.proposals.length,
        tested,
        verified,
        falsified: tested - verified,
      },
      coordination: {
        overhead_tokens: 0,
        specialist_gain: 0,
      },
      value: {
        decision_value: state.confidence,
        cost_per_verified_outcome_usd: tested > 0 ? consumed.cost_usd / tested : consumed.cost_usd,
      },
      termination_reason: state.error
        ? `ERROR: ${state.error.code}`
        : "LIFECYCLE_COMPLETE",
    };
  }

  // ── Initialize: move from implicit 000_INIT ─────────────────────────────
  // The agent starts at 000_INIT. Record the initial history entry (already done in state init).
  // Populate the identity section of the envelope immediately.
  envelope.identity = {
    actor_id: state.actor_id,
    session_id: state.session_id,
    lease_id: state.lease_id,
    emitted_by: "aforge",
  };
  envelope.envelope_version = "1.0.0";
  envelope.emitted_at = now;

  // ── Return the public API ────────────────────────────────────────────────

  return {
    getState,
    getStage,
    addObservation,
    addProposal,
    addVerification,
    canTransitionTo,
    advance,
    reset,
    setError,
    buildEnvelope,
    complete,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  LifecycleStage,
  VerticalAgentState,
  Observation,
  Proposal,
  VerificationResult,
  Receipt,
} from "./types.js";

export type {
  TransitionResult,
  StageAdvanceResult,
} from "./state-machine.js";

export {
  validateTransition,
  advanceStage,
  resetToInit,
  validTargets,
  forwardTargets,
  correctionTargets,
  isTerminal,
  isAhead,
  stageName,
  stageOrgan,
  validateLifecycleTrace,
} from "./state-machine.js";
