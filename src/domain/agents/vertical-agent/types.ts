/**
 * vertical-agent/types.ts — Vertical Agent Types
 *
 * Types for a governed vertical agent that follows the canonical lifecycle:
 * 000 INIT -> 111 OBSERVE -> 222 ENCODE -> 333 THINK -> 444 ROUTE
 * -> 555 CRITIQUE -> 666 HEART -> 777 FORGE -> 888 JUDGE -> 999 SEAL
 *
 * Each agent is a vertical slice through the 11 Layers.
 * State machine enforces valid transitions.
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 9
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import type { GovernedDomain } from "../../../contracts/types.js";
import type {
  TruthClass,
  MemoryTier,
  CoolingState,
  AgenticEventEnvelope,
  WorkContract,
  TaskOutcome,
} from "../../types/memory-lifecycle.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — LIFECYCLE STAGE (Canonical 000-999)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical lifecycle stages for a vertical agent.
 * Each stage maps to a federation organ and layer.
 */
export type LifecycleStage =
  | "000_INIT"       // Session birth, identity resolved
  | "111_OBSERVE"    // Evidence intake
  | "222_ENCODE"     // Observation -> structured memory
  | "333_THINK"      // Reasoning, planning, simulation
  | "444_ROUTE"      // Organ routing
  | "555_CRITIQUE"   // Heart critique, risk assessment
  | "666_HEART"      // Vitality check, human readiness
  | "777_FORGE"      // Engineering execution
  | "888_JUDGE"      // Constitutional judgment
  | "999_SEAL";      // VAULT999 recording

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — AGENT STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vertical agent state — persists across lifecycle transitions.
 */
export interface VerticalAgentState {
  /** Unique agent instance ID */
  agent_id: string;
  /** Current lifecycle stage */
  stage: LifecycleStage;
  /** Domain this agent operates in */
  domain: GovernedDomain;
  /** Session ID binding this agent to a session */
  session_id: string;
  /** Actor ID (who spawned this agent) */
  actor_id: string;
  /** Lease ID authorizing this agent's operations */
  lease_id?: string;

  /** Observations collected during OBSERVE stage */
  observations: Observation[];
  /** Proposals generated during THINK stage */
  proposals: Proposal[];
  /** Verification results from VERIFY stage */
  verifications: VerificationResult[];
  /** Receipt from SEAL stage */
  receipt?: Receipt;

  /** Current epistemic confidence of the agent's conclusion */
  confidence: number;
  /** Current memory tier of the agent's working state */
  memory_tier: MemoryTier;
  /** Cooling state */
  cooling_state: CoolingState;

  /** Transition history — ordered list of stages visited */
  history: Array<{
    stage: LifecycleStage;
    entered_at: string;
    exited_at?: string;
  }>;

  /** Error state — if the agent encountered an unrecoverable error */
  error?: {
    code: string;
    message: string;
    at_stage: LifecycleStage;
    occurred_at: string;
  };

  /** Creation timestamp */
  created_at: string;
  /** Last state update */
  updated_at: string;

  /** Work contract governing this run — created at 000 INIT */
  work_contract?: WorkContract;
  /** Budget consumed so far (updated at each lifecycle stage) */
  budget_consumed: {
    reasoning_cycles: number;
    tool_calls: number;
    delegations: number;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  };
  /** Task outcome receipt — produced at 999 SEAL */
  task_outcome?: TaskOutcome;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — OBSERVATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * An observation collected during the OBSERVE stage.
 */
export interface Observation {
  /** Unique observation ID */
  id: string;
  /** What was observed */
  content: Record<string, unknown> | string;
  /** Source of the observation */
  source: string;
  /** How the observation was obtained */
  source_type: "direct_observation" | "tool_output" | "human_input" | "database_query" | "web_fetch" | "inference" | "prior_memory";
  /** Epistemic classification (B3) */
  truth_class: TruthClass;
  /** Confidence level */
  confidence: number;
  /** When this observation was made */
  observed_at: string;
  /** Reliability of the source (0-1) */
  source_reliability: number;
  /** Domain scope */
  domain: GovernedDomain;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — PROPOSAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A proposal generated during the THINK stage.
 */
export interface Proposal {
  /** Unique proposal ID */
  id: string;
  /** Natural-language description of the proposed action */
  description: string;
  /** Action classification (B5) */
  classification: "OBSERVE" | "SUGGEST" | "SIMULATE" | "DRAFT" | "QUEUE" | "EXECUTE_REVERSIBLE" | "EXECUTE_HIGH_IMPACT" | "IRREVERSIBLE";
  /** Whether this action is reversible (F1 AMANAH) */
  reversible: boolean;
  /** Expected outcome if executed */
  expected_outcome: string;
  /** Expected evidence of success */
  success_evidence: string;
  /** Expected evidence of failure */
  failure_evidence: string;
  /** Estimated risk (0-1) */
  risk: number;
  /** Estimated resource cost (0-1) */
  cost: number;
  /** Source observations that led to this proposal */
  source_observation_ids: string[];
  /** Proposed tool name (if tool execution) */
  tool_name?: string;
  /** Proposed parameters */
  parameters?: Record<string, unknown>;
  /** Confidence in this proposal */
  confidence: number;
  /** When this proposal was generated */
  proposed_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — VERIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verification result from checking execution outcome against expected evidence.
 */
export interface VerificationResult {
  /** Unique verification ID */
  id: string;
  /** What was being verified */
  proposal_id: string;
  /** Whether the verification passed */
  passed: boolean;
  /** Observed outcome */
  observed_outcome: Record<string, unknown> | string;
  /** Expected outcome (from proposal) */
  expected_outcome: string;
  /** Match quality (0-1) — how closely observed matches expected */
  match_quality: number;
  /** Evidence that confirms success */
  success_evidence_matched: string[];
  /** Evidence that indicates failure */
  failure_evidence_matched: string[];
  /** Contradictions found during verification */
  contradictions: string[];
  /** Confidence in this verification */
  confidence: number;
  /** When this verification was performed */
  verified_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Receipt from the SEAL stage — immutable record of what happened.
 */
export interface Receipt {
  /** Unique receipt ID */
  id: string;
  /** The event envelope that was sealed */
  envelope: AgenticEventEnvelope;
  /** VAULT999 seal ID (if sealed) */
  vault_seal_id?: string;
  /** Hash-chain link to previous receipt */
  previous_hash?: string;
  /** This receipt's hash */
  hash: string;
  /** When this receipt was created */
  sealed_at: string;
  /** Whether this receipt is constitutional (M6) */
  constitutional: boolean;
  /** Scars produced during this lifecycle */
  scars_produced: string[];
  /** Wisdom delta (change in Phi) */
  wisdom_delta: number;
  /** Task outcome receipt — the measurement spine record */
  task_outcome?: TaskOutcome;
}
