/**
 * contracts/rsi.ts — A-FORGE RSI State Vector & Controller Contracts
 *
 * Formalizes the control-theoretic model for governed recursive system
 * improvement. Maps Oppenheim/Willsky signals-systems vocabulary onto
 * A-FORGE execution traces as the first plant (bind order: A-FORGE → GEOX → ARIF Cell).
 *
 * This file defines the canonical s_t state vector, the Imp controller,
 * and the impulse-response measurement infrastructure.
 *
 * Constitutional:
 *   F1 AMANAH — controller state is read-only to execution path
 *   F2 TRUTH — all fields sourced from verifiable traces, not asserted
 *   R ∉ S — Imp lives in META layer, not in the plant it improves
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md
 * @see A-FORGE docs/RSI_BOOT_PROMPT.md
 * @see A-FORGE docs/CONSTITUTION.md
 *
 * @authority ARIF / F13 SOVEREIGN
 * @date 2026-09-15
 * @forged FI-003 (Qwen Code)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1A — IDENTITY + AUTHORITY (does not decay)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Identity and authority fields for an RSI episode.
 * These bind the agent to a lawful execution context and do not decay.
 * Missing any hard-fail field → no meta-loop write permitted.
 */
export interface RSIIdentityState {
  /** Episode key — A-FORGE session or MCP session */
  session_id: string;
  /** Declared actor — unverified → no meta-loop write */
  actor_id: string;
  /** arifOS lease / SCT — no lease → no execute */
  lease_id: string | null;
  /** Plan identifier from planner / AREP */
  plan_id: string | null;
  /** Constitutional verdict from arifOS only */
  verdict: "SEAL" | "PARTIAL" | "HOLD" | "SABAR" | "VOID" | null;
  /** F1–F13 hit-map for this run */
  floor_scope: string[];
  /** F13 ratification status */
  ratification_status: "pending" | "HOLD" | "ratified";
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1B — PLANT STATE (the work being done)
// ═══════════════════════════════════════════════════════════════════════════════

/** Epistemic label for evidence items (F2 TRUTH). */
export type EpistemicLabel = "OBS" | "DER" | "INT" | "SPEC";

/** Hypothesis lifecycle state. */
export type HypothesisState = "open" | "confirmed" | "abandoned";

/** A single evidence item with provenance. */
export interface EvidenceItem {
  /** Unique evidence ID */
  evidence_id: string;
  /** Source tool or organ */
  source: string;
  /** Epistemic classification */
  label: EpistemicLabel;
  /** Content hash for tamper detection */
  content_hash: string;
  /** ISO 8601 timestamp */
  collected_at: string;
}

/** A hypothesis under evaluation. */
export interface HypothesisItem {
  /** Unique hypothesis ID */
  hypothesis_id: string;
  /** Natural-language claim */
  claim: string;
  /** Current lifecycle state */
  state: HypothesisState;
  /** Supporting evidence IDs */
  supporting_evidence: string[];
  /** Contradicting evidence IDs */
  contradicting_evidence: string[];
  /** Who proposed it */
  proposed_by: string;
  /** ISO 8601 timestamp */
  proposed_at: string;
}

/** Canonical stage in the arifOS session arc. */
export type CanonicalStage =
  | "000_INIT"
  | "111_OBSERVE"
  | "222_EVIDENCE"
  | "333_THINK"
  | "555_ROUTE"
  | "666_CRITIQUE"
  | "777_MEASURE"
  | "888_JUDGE"
  | "010_FORGE"
  | "999_SEAL";

/**
 * Plant state — the work being done in this RSI episode.
 * Decays per-task or per-step (session-scoped).
 */
export interface RSIPlantState {
  /** Current intent from IntentRouter */
  intent: string;
  /** Current canonical stage */
  canonical_stage: CanonicalStage;
  /** Evidence collected this episode */
  evidence: EvidenceItem[];
  /** Hypotheses under evaluation */
  hypotheses: HypothesisItem[];
  /** Tools invoked this episode (ordered) */
  tools_invoked: string[];
  /** Reversibility score from PlanValidator [0, 1] */
  reversibility_score: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1C — MEMORY STATE (impulse response h)
// ═══════════════════════════════════════════════════════════════════════════════

/** Memory store classification. */
export type MemoryStoreKind =
  | "working_window"
  | "long_term_archive"
  | "tool_call_receipts"
  | "session_traces"
  | "experience_traces"
  | "cooling_receipts"
  | "escalation_records"
  | "federation_telemetry";

/** Write loop speed classification. */
export type WriteLoopSpeed = "FAST" | "MEDIUM" | "SLOW";

/** A reference to a memory store with its write characteristics. */
export interface MemoryStoreRef {
  /** Store classification */
  kind: MemoryStoreKind;
  /** Module that owns this store */
  module: string;
  /** Persistence level */
  persistence: "session" | "file-backed" | "durable" | "immutable";
  /** Write loop speed */
  write_loop: WriteLoopSpeed;
  /** Number of items in this store (snapshot) */
  item_count: number | null;
}

/**
 * Memory state — the impulse response h(t) of the system.
 *
 * Records which memory stores are active and their causal influence.
 * The impulse-response question: how many sessions does one event
 * (HOLD, scar, fix) remain causally active in routing/tool choice/budget?
 *
 * @see §4 impulse-response measurement
 */
export interface RSIMemoryState {
  /** Active memory stores */
  stores: MemoryStoreRef[];
  /** Whether impulse response h is characterized */
  h_characterized: boolean;
  /** Measured causal duration in sessions (null = unmeasured) */
  h_sessions: number | null;
  /** Measurement provenance */
  h_measurement_id: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1D — CONTROLLER STATE (Imp) — SLOW/META only
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Exactly one diagnosed constraint limiting system improvement.
 * Proposed by 333-AGI, sealed by arifOS.
 */
export interface Bottleneck {
  /** Natural-language constraint description */
  description: string;
  /** Which subsystem is constrained */
  subsystem: string;
  /** Evidence supporting this diagnosis */
  evidence_ids: string[];
  /** Who proposed this bottleneck */
  proposed_by: string;
  /** When diagnosed */
  diagnosed_at: string;
  /** Whether arifOS has sealed this diagnosis */
  sealed: boolean;
  /** Seal verdict ID (if sealed) */
  seal_verdict_id: string | null;
}

/**
 * An installed improvement with reversibility tracking.
 * Installed by A-FORGE after SEAL verdict.
 */
export interface InstalledFix {
  /** Natural-language description of the fix */
  description: string;
  /** Which bottleneck this addresses */
  addresses_bottleneck: string;
  /** Whether the fix is reversible */
  reversible: boolean;
  /** Git commit SHA or VAULT receipt proving the change */
  proof_ref: string;
  /** Which bottleneck this fix targets */
  target_subsystem: string;
  /** When installed */
  installed_at: string;
  /** Whether verified (tests pass, lint clean) */
  verified: boolean;
}

/**
 * Entropy delta — what changed and what did not after a cooling cycle.
 * Emitted by RSI stage 9 (COOL).
 */
export interface EntropyDelta {
  /** Normalized entropy change [-1, 1]: negative = improvement, positive = degradation */
  delta_scalar: number;
  /** What changed (human-readable) */
  what_changed: string[];
  /** What was preserved (human-readable) */
  what_preserved: string[];
  /** What was attempted but held */
  hold_items: string[];
  /** Cooling receipt ID in VAULT999 */
  cooling_receipt_id: string | null;
  /** ISO 8601 timestamp */
  measured_at: string;
}

/**
 * Evaluator binding — what scores "better" for this improvement cycle.
 * Set by META + F13 only. Defines the fitness function.
 */
export interface EvaluatorBinding {
  /** Unique evaluator ID */
  evaluator_id: string;
  /** Human-readable evaluator description */
  description: string;
  /** What metrics this evaluator uses */
  metrics: string[];
  /** Threshold for "improved" */
  improvement_threshold: number;
  /** Whether this evaluator has been calibrated */
  calibrated: boolean;
  /** F13 ratification reference */
  ratification_ref: string | null;
}

/**
 * ImpState — the improvement controller.
 *
 * R ∉ S: This state lives in the META layer. It is NOT part of the
 * plant (A-FORGE execution) it improves. Only 333-AGI may propose
 * changes; only arifOS may seal them. A-FORGE executes directed
 * mutations after constitutional approval.
 *
 * This is SLOW state — it changes at the rate of F13 ratification,
 * not at the rate of tool calls.
 */
export interface ImpState {
  /** Exactly one diagnosed constraint */
  bottleneck: Bottleneck | null;
  /** Currently installed fix */
  fix: InstalledFix | null;
  /** Most recent entropy delta from cooling cycle */
  entropy_delta: EntropyDelta | null;
  /** Versioned improvement policy pointer */
  imp_version: string;
  /** Evaluator that scores "better" */
  evaluator: EvaluatorBinding | null;
  /** When this controller state was last updated */
  updated_at: string;
  /** Who last modified this controller state */
  updated_by: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — STATE VECTOR CONTAINER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RSIStateVector — canonical s_t for A-FORGE RSI.
 *
 * Minimal compression of history sufficient for the next lawful action.
 * If a field cannot be written, the run is a transcript, not an agent.
 *
 * @authority ARIF / F13 SOVEREIGN
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md §1
 */
export interface RSIStateVector {
  /** Schema version for migration */
  schema_version: "rsi.sv.v1";
  /** ISO 8601 timestamp of this snapshot */
  snapshot_at: string;

  /** §1A — Identity + authority (does not decay) */
  identity: RSIIdentityState;
  /** §1B — Plant state (the work being done, per-task decay) */
  plant: RSIPlantState;
  /** §1C — Memory state (impulse response h) */
  memory: RSIMemoryState;
  /** §1D — Controller state (Imp, SLOW/META only) */
  controller: ImpState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — LOOP STEP OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

/** RSI loop stages (9-stage from RSI_BOOT_PROMPT). */
export type RSIStage =
  | "SENSE"
  | "CONTRAST"
  | "PROPOSE"
  | "JUDGE"
  | "FLOW"
  | "EXECUTE"
  | "VERIFY"
  | "WITNESS"
  | "COOL";

/**
 * Output of a single RSI loop step.
 * Each step reads the current state vector and produces a delta.
 */
export interface RSILoopStepOutput {
  /** Which stage produced this output */
  stage: RSIStage;
  /** Stage sequence number in this loop iteration */
  step_number: number;
  /** State vector snapshot at step entry */
  state_at_entry: RSIStateVector;
  /** What changed (delta over entry state) */
  delta: Partial<RSIStateVector>;
  /** Evidence produced by this step */
  evidence_ids: string[];
  /** Whether this step was blocked (HOLD/VOID) */
  blocked: boolean;
  /** Block reason (if blocked) */
  block_reason: string | null;
  /** ISO 8601 timestamp */
  completed_at: string;
  /** Duration in milliseconds */
  duration_ms: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — DUAL-RATE FQ (Q2: 7-day governance, daily cockpit)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dual-rate FQ signal.
 *
 * FQ sampled at arifFlow's cron rate (~daily) aliases the weekly
 * governance cycle. This struct holds both rates so downstream
 * consumers pick the right one for their decision class.
 *
 * Daily signal = cockpit telemetry (observational).
 * 7-day signal = governance decisions (constitutional).
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md §3
 */
export interface DualRateFQ {
  /** Daily FQ snapshot (cockpit telemetry, observational only) */
  daily_fq: number;
  /** 7-day rolling FQ (governance signal, constitutional) */
  governance_fq: number;
  /** Number of receipts in the 7-day window */
  governance_window_count: number;
  /** Whether the governance window has enough samples for a reliable signal */
  governance_window_sufficient: boolean;
  /** Minimum samples required for reliable governance FQ */
  governance_window_min_samples: number;
  /** ISO 8601 timestamp */
  computed_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — IMPULSE-RESPONSE MEASUREMENT (P0: HOLD → routing influence)
// ═══════════════════════════════════════════════════════════════════════════════

/** Event types that can have impulse response. */
export type ImpulseEventType =
  | "888_HOLD"
  | "scar_seal"
  | "cooling_receipt"
  | "tool_failure"
  | "f1_amanah_trigger"
  | "fix_deployment";

/**
 * A single impulse-response measurement.
 *
 * Tracks how long a single event remains causally active
 * in subsequent routing, tool selection, or budget allocation.
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md §4
 */
export interface ImpulseResponseSample {
  /** Unique measurement ID */
  measurement_id: string;
  /** The event type that created the impulse */
  event_type: ImpulseEventType;
  /** Reference to the source event (receipt ID, scar ID, etc.) */
  event_ref: string;
  /** Session ID where the impulse was created */
  origin_session_id: string;
  /** ISO 8601 timestamp of the impulse event */
  impulse_at: string;

  /** Sessions observed after the impulse */
  sessions_observed: number;
  /** Sessions where routing was influenced by this event */
  routing_influenced_count: number;
  /** Sessions where tool selection was influenced */
  tool_selection_influenced_count: number;
  /** Sessions where budget allocation was influenced */
  budget_influenced_count: number;

  /**
   * Causal half-life in sessions — how many sessions until the
   * event's influence drops below 50%. null = still active or unmeasured.
   */
  causal_half_life_sessions: number | null;

  /** Whether this impulse is still considered causally active */
  still_active: boolean;
  /** When the last influenced action was observed */
  last_influence_at: string | null;
  /** ISO 8601 timestamp */
  measured_at: string;
}

/**
 * P0 Measurement report — aggregate impulse response for all
 * 888_HOLD events over a time window.
 *
 * This is the first empirical characterization of h(t) for A-FORGE.
 */
export interface ImpulseResponseReport {
  /** Time window start */
  window_start: string;
  /** Time window end */
  window_end: string;
  /** Total 888_HOLD events in window */
  total_hold_events: number;
  /** Samples with at least one influenced session */
  samples_with_influence: number;
  /** Mean causal half-life across all samples (null = insufficient data) */
  mean_half_life_sessions: number | null;
  /** Median causal half-life */
  median_half_life_sessions: number | null;
  /** Per-event-type breakdown */
  by_event_type: Array<{
    event_type: ImpulseEventType;
    count: number;
    mean_half_life: number | null;
    still_active_count: number;
  }>;
  /** Whether h is characterized (enough samples + measurable decay) */
  h_characterized: boolean;
  /** ISO 8601 timestamp */
  computed_at: string;
}
