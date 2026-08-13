/**
 * Reality Loop — Types & Constants
 *
 * APEX v36Ω integrated: Gödel lock + Strange loop (champion/challenger) +
 * Anti-sink ecology. Three planes at once: Runtime / Judge / Archive.
 *
 * 7 stages: MEANING → OBSERVE → ENCODE → IMPROVE → VERIFY → SEAL → RETURN.
 * Each stage maps to one or more MCP prompts (as subskills); the agent
 * orchestrates. The loop does NOT decide — RETURN presents to human.
 *
 * Gödel Lock:   system may rewrite methods, never its constitution.
 * Strange Loop:  champion/challenger with empirical ΔU gate + W³ witness.
 * Anti-Sink:     friction ecology — reality quotas, role diversity, retirement.
 *
 * @module reality-loop/types
 * @constitutional F4 CLARITY — ΔS ≤ 0 per iteration
 * @constitutional F11 AUDIT — every iteration sealed to VAULT999
 * @apex F2 TRUTH — overclaim audit on every modification proposal
 */

// ── Gödel Lock ───────────────────────────────────────────────────────────────

/**
 * Paths the loop may NEVER self-modify, regardless of self_modify config.
 * These are constitutionally locked — rewriting them would break the
 * lock itself (Gödel incompleteness: a system cannot prove its own consistency).
 *
 * Derived from 999_SEAL AF-2026-06-28: Agentic Governed Intelligence spec.
 */
export const GODEL_LOCKED_PATHS = [
  // Constitutional kernel
  "arif_judge", "arif_seal", "ArifJudge", "ArifSeal",
  "arif_init", "arif_observe", "arif_act", "arif_think", "arif_route", "arif_critique",
  // Floor definitions
  "floor_definitions", "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  "F8", "F9", "F10", "F11", "F12", "F13",
  "CONSTITUTION", "000_CONSTITUTION",
  // Identity & auth
  "identity", "auth", "secret", "secrets", "password", "token",
  "vault999", "VAULT999", "ledger", "hash_chain",
  // Network & promotion
  "network_policy", "firewall", "caddy", "proxy",
  "promotion_rules", "lease", "witness",
  // arifOS organ boundary
  "arifOS", "AAA", "GEOX", "WEALTH", "WELL",
  // Tool registration
  "forge_register", "forge_evaluate", "forge_scar",
] as const;

export type GodelLockedPath = (typeof GODEL_LOCKED_PATHS)[number];

/**
 * Check if a modification target is Gödel-locked.
 * This is a physics constraint, not a policy flag — the loop
 * cannot bypass this through self_modify: true in config.
 */
export function isGodelLocked(target: string): boolean {
  const t = target.toLowerCase();
  return (GODEL_LOCKED_PATHS as readonly string[]).some(
    (locked) => t.includes(locked.toLowerCase()),
  );
}

/** Human-readable list for audit / 888_HOLD reporting */
export const GODEL_LOCKED_SUMMARY = GODEL_LOCKED_PATHS.join(", ");

// ── Reality Quota & Anti-Sink ────────────────────────────────────────────────

/**
 * Anti-sink configuration — prevents closed-loop self-grooming.
 *
 * Calhoun's "beautiful ones" lost function because they had no reproductive
 * pressure, no territory disputes, no resource scarcity. The loop must
 * be forced to touch real external tasks to survive.
 *
 * Each field is a hard constraint, not advisory.
 */
export interface AntiSinkConfig {
  /** Minimum external task contacts per iteration window (0.0–1.0) */
  reality_quota_ratio: number;

  /**
   * Consecutive iterations with zero external contact before forced scar + retirement.
   * Zero = disabled.
   */
  max_idle_streak: number;

  /**
   * Maximum ratio of self-reflective actions / total actions in a window.
   * Exceeding this triggers scope-reduction scar.
   */
  max_self_reflection_ratio: number;

  /** Enforce role separation: proposer ≠ critic ≠ verifier */
  enforce_role_separation: boolean;

  /** Minimum novelty score (HHI inverse, 0–1) — penalize repetition */
  min_novelty_score: number;

  /** Max scars per rolling window before forcing slowdown */
  scar_burst_limit: number;

  /** Rolling window for all anti-sink metrics (in iterations) */
  window_size: number;
}

export const DEFAULT_ANTISINK: AntiSinkConfig = {
  reality_quota_ratio: 0.2,       // 1 in 5 iterations must touch external reality
  max_idle_streak: 3,             // 3 consecutive no-contact iterations → retirement scar
  max_self_reflection_ratio: 0.6, // >60% self-reflection → scope-reduction scar
  enforce_role_separation: true,   // proposer != critic != verifier
  min_novelty_score: 0.4,         // HHI-based; > 0.4 = sufficiently diverse
  scar_burst_limit: 3,            // 3+ scars in window → forced slowdown
  window_size: 10,                // 10-iteration rolling window
};

/** Reality contact type — what counts as "touching external reality" */
export type ExternalContactType =
  | "web_search"       // real web evidence gathered
  | "file_change"       // real file mutated
  | "shell_exec"       // real shell command executed
  | "organ_query"      // cross-organ probe (not self-reflection)
  | "vault_read"       // VAULT999 read (external sealed trace)
  | "user_task";       // explicit user task received

export interface RealityContact {
  iteration: number;
  type: ExternalContactType;
  description: string;
  at: string; // ISO timestamp
}

// ── Role Separation ─────────────────────────────────────────────────────────

/**
 * Role separation — prevents a branch from self-proposing,
 * self-grading, and self-promoting in one authority loop.
 * APEX Theory: no layer can replace the layer above it.
 */
export interface RoleSeparation {
  /** Agent ID of the current proposer */
  proposer_id: string | null;
  /** Agent ID of the current critic/evaluator */
  critic_id: string | null;
  /** Agent ID of the current verifier */
  verifier_id: string | null;
  /**
   * Role assignment history — prevents same agent cycling through roles.
   * Format: iteration → role → agent_id
   */
  role_history: Array<{ iteration: number; role: "proposer" | "critic" | "verifier"; agent_id: string }>;
}

/** Check if role separation is violated */
export function isRoleViolation(
  roles: RoleSeparation,
  current_agent: string,
  proposed_role: "proposer" | "critic" | "verifier",
): boolean {
  // Same agent taking the same role twice in a row
  const currentRoleAgent =
    proposed_role === "proposer" ? roles.proposer_id :
    proposed_role === "critic" ? roles.critic_id :
    roles.verifier_id;
  if (currentRoleAgent === current_agent) return true;
  // Same agent cannot be both proposer and critic in same iteration
  if (
    proposed_role === "critic" &&
    roles.proposer_id === current_agent
  ) return true;
  if (
    proposed_role === "proposer" &&
    roles.critic_id === current_agent
  ) return true;
  return false;
}

// ── Champion / Challenger (Strange Loop) ───────────────────────────────────

/**
 * ChampionChallengerEval — empirical validation of a self-modification.
 *
 * The loop proposes a challenger modification. The challenger is validated
 * against a fixed eval pack before any promotion decision. This is the
 * DGM-style empirical gate: measure, don't introspect.
 *
 * APEX Theory: intelligence must have external validation, not just
 * internal self-reporting.
 */
export interface ChampionChallengerEval {
  /** Unique ID for this eval */
  eval_id: string;

  /** The current live policy/module being challenged */
  champion_id: string;

  /** The proposed modification being evaluated */
  challenger_id: string;

  /** Fixed benchmark / task pack used for evaluation */
  eval_task_pack: string[];

  /** Champion score on eval pack (0.0–1.0) */
  champion_score: number;

  /** Challenger score on eval pack (0.0–1.0) */
  challenger_score: number;

  /** ΔU = challenger_score − champion_score */
  delta_U: number;

  /** Risk delta (floor violations introduced by challenger) */
  delta_R: number;

  /** Change in F1-F13 floor violations (must be 0 for promotion) */
  delta_F: number;

  /** Whether challenger touches any Gödel-locked path */
  godel_locked: boolean;

  /** Reality quota at time of eval */
  reality_quota: number;

  /** Tri-witness evidence for this eval */
  witness: WitnessEvidence;

  /** APEX W³ computed geometric mean */
  W3: number;

  /** Overall promotion gate result */
  promoted: boolean;

  /** Human approval token (required for promotion beyond sandbox) */
  human_approval_token: string | null;

  /** VAULT999 seal ID for this eval */
  seal_id: string | null;

  /** Timestamp */
  evaluated_at: string;
}

/** Tri-witness evidence for promotion decision */
export interface WitnessEvidence {
  /** Human witness confidence [0.0–1.0] */
  h_confidence: number;
  h_source: string;

  /** AI ensemble witness confidence [0.0–1.0] */
  ai_confidence: number;
  ai_source: string;

  /** External / Earth witness confidence [0.0–1.0] */
  ext_confidence: number;
  ext_source: string;
}

/**
 * PromotionGate — the multi-gate for champion → challenger promotion.
 *
 * ALL gates must pass for promotion:
 *   ΔU > τ_u        — measurable utility gain
 *   ΔR ≤ 0          — no risk increase
 *   ΔF = 0          — no floor violations
 *   Q_r ≥ τ_r       — reality quota satisfied
 *   ¬GödelLocked    — challenger does not touch locked paths
 *   W³ ≥ 0.95       — tri-witness consensus
 *
 * If any gate fails: challenger is archived as scar, champion survives.
 */
export interface PromotionGate {
  passed: boolean;
  gates: {
    delta_U: { passed: boolean; value: number; threshold: number };
    delta_R: { passed: boolean; value: number; threshold: number };
    delta_F: { passed: boolean; value: number; threshold: number };
    reality_quota: { passed: boolean; value: number; threshold: number };
    godel_lock: { passed: boolean; locked_path: string | null };
    W3: { passed: boolean; value: number; threshold: number };
  };
  /** iteration at which this gate was evaluated */
  iteration: number;
  /** If rejected, the reason for the scar */
  rejection_reason: string;
}

export const PROMOTION_THRESHOLDS = {
  TAU_U: 0.05,       // minimum useful improvement (5%)
  TAU_R: 0.2,        // minimum reality quota (20%)
  W3_MIN: 0.95,      // tri-witness consensus floor
} as const;

// ── Reality Loop State ───────────────────────────────────────────────────────

/**
 * Canonical 7 stages matching the skill's operator interface.
 *
 * Skill mapping:
 *   MEANING → pre-loop framing (no tools — what does human want?)
 *   OBSERVE → reality probe, evidence gathering
 *   ENCODE  → quantum-frame + apex-reason + godel-metabolize (sub-skill composite)
 *   IMPROVE → reality-engineer, refactor, deploy
 *   VERIFY  → godel-metabolize + thermodynamic-zen (re-check + entropy)
 *   SEAL    → vault append
 *   RETURN  → terminal — present to human, await decision
 *
 * Previously 8 internal stages (OBSERVE→QUANTUM→APEX→GODEL→REALITY→THERMO→RECURSE→SEAL)
 * collapsed to 7 per skill alignment 2026-07-05. RECURSE still accessible via
 * STAGE_PROMPT_MAP if needed, but is no longer a mandatory stage in the loop.
 */
export const REALITY_STAGES = [
  "MEANING",
  "OBSERVE",
  "ENCODE",
  "IMPROVE",
  "VERIFY",
  "SEAL",
  "RETURN",
] as const;

export type RealityStage = (typeof REALITY_STAGES)[number];

/** Which prompt(s) to invoke at each stage */
export const STAGE_PROMPT_MAP: Record<RealityStage, string[]> = {
  MEANING: [],             // pre-loop framing — no tools, human intent capture
  OBSERVE: [
    "cross-organ-query",   // route intent to correct organ
    "research-topic",      // deep observation / evidence gathering
    "audit-code",          // scan existing state
    "fix-bug",             // reactive observation (bug reports)
  ],
  ENCODE: [
    "quantum-frame",       // generate N mutually-exclusive hypotheses
    "apex-reason",         // physics-grounded evaluation (G = A · P · E · X · Φ)
    "godel-metabolize",    // self-consistency check before action
  ],
  IMPROVE: [
    "reality-engineer",    // execute the chosen action (TEXT IS REALITY)
    "refactor-module",     // structural reality mutation
    "deploy-service",      // reality deployment
  ],
  VERIFY: [
    "godel-metabolize",    // re-check consistency after action
    "thermodynamic-zen",   // measure ΔS, verify entropy reduction
    "recursive-self-improve", // meta-cognition: find bottleneck, fix it
  ],
  SEAL: [],                // seal to VAULT999 (internal, no prompt needed)
  RETURN: [],              // terminal — present to human, await decision
};

/** The loop state — carried forward between iterations */
export interface RealityLoopState {
  iteration: number;
  current_stage: RealityStage;
  session_id: string;
  started_at: string;

  /** Accumulated evidence from all prior iterations */
  evidence_base: EvidenceEntry[];

  /** Active quantum hypotheses (from quantum-frame stage) */
  active_hypotheses: Hypothesis[];

  /** The last executed action (from reality-engineer stage) */
  last_action: ActionRecord | null;

  /** Entropy measurements (from thermodynamic-zen stage) */
  entropy_history: EntropyEntry[];

  /** Self-improvement modifications applied (from recursive-self-improve) */
  self_modifications: ModificationRecord[];

  /** Failed iterations stored as scars */
  scars: ScarRecord[];

  /** Constitutional floor violations encountered */
  floor_violations: FloorViolation[];

  /** System health at last measurement */
  system_health: Record<string, boolean>;

  // ── APEX Anti-Sink Fields ──────────────────────────────────────────────

  /**
   * Reality contacts — each entry is one contact with external reality.
   * This is what separates the loop from Calhoun's beautiful ones.
   * A loop that only reflects on its own traces without external contact
   * is a closed loop and will eventually enter governance drift.
   */
  reality_contacts: RealityContact[];

  /**
   * Consecutive iterations with zero external reality contact.
   * Resets to 0 on any external contact.
   * Triggers forced retirement scar when it exceeds AntiSinkConfig.max_idle_streak.
   */
  idle_streak: number;

  /**
   * ISO timestamp of last external reality contact.
   * Used for reality quota calculation.
   */
  last_external_contact_at: string | null;

  /**
   * Role separation state — enforces proposer != critic != verifier.
   * Prevents self-propose, self-grade, self-promote in one authority loop.
   */
  roles: RoleSeparation;

  /**
   * ID of the current champion (live policy/runtime).
   * Null until first promotion cycle completes.
   */
  champion_id: string | null;

  /**
   * ID of the current challenger (sandbox candidate).
   * Null when no challenger is under evaluation.
   */
  challenger_id: string | null;

  /**
   * The most recent promotion evaluation result.
   * null until first eval completes.
   */
  last_promotion_eval: ChampionChallengerEval | null;

  /**
   * Whether this loop branch has been retired due to anti-sink failure.
   * A retired loop cannot advance stages or apply modifications.
   */
  retired: boolean;
  retirement_reason: string | null;

  // ── Threshold gate config (PHASE 1 HEURISTIC, calibration pending) ──

  /**
   * Snapshot of the effective RealityLoopConfig at create time,
   * including threshold overrides. Surfaced in seal output so the
   * reader knows exactly what the engine enforced during the loop.
   */
  effective_config: RealityLoopConfig;

  /**
   * Per-threshold validation report for min_g_score and min_witness.
   * Captured at create time so seal can show which thresholds were
   * exact, clamped (out of [0,1]), or fell back to default (non-finite).
   */
  threshold_validation: {
    min_g_score: ThresholdValidation;
    min_witness: ThresholdValidation;
  };
}

export interface EvidenceEntry {
  iteration: number;
  source_stage: RealityStage;
  source_prompt: string;
  claim: string;
  epistemic_label: "OBS" | "DER" | "INT" | "SPEC";
  confidence: number; // 0.0-1.0
  evidence_path?: string; // file or vault reference
  captured_at: string;
}

export interface Hypothesis {
  id: string;
  statement: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  collapse_measurement: string;
  probability_amplitude: number; // equal prior = 1/N
  collapsed: boolean;
  collapsed_to?: boolean;
  collapsed_at?: string;
}

export interface ActionRecord {
  prompt_used: string;
  target: string;
  nature: "create" | "transform" | "repair" | "dissolve";
  description: string;
  executed_at: string;
  success: boolean;
  reversible: boolean;
  vault_seal_id?: string;
  /** Whether this action involved external reality contact */
  external_contact: boolean;
}

export interface EntropyEntry {
  iteration: number;
  stage: RealityStage;
  entropy_before: number;
  entropy_after: number;
  delta_S: number;
  actions_used: number;
  action_budget: number;
}

export interface ModificationRecord {
  iteration: number;
  bottleneck: string;
  proposed_fix: string;
  implementation_path: string;
  /** Whether Gödel lock blocked this modification */
  godel_locked: boolean;
  locked_path?: string;
  applied: boolean;
  verification_metric: string;
  delta_S_estimate: number;
  /** ChampionChallengerEval ID if evaluated, null if blocked before eval */
  eval_id: string | null;
}

export interface ScarRecord {
  iteration: number;
  stage: RealityStage;
  failure: string;
  constraint_imposed: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface FloorViolation {
  iteration: number;
  floor: string;
  description: string;
  resolution: "PATCHED" | "ESCALATED" | "OVERRIDDEN";
}

/** Configuration for the loop */
export interface RealityLoopConfig {
  /** Prometheus-like: shorter = faster cycle, longer = deeper per cycle */
  iteration_depth: "quick" | "standard" | "deep";

  /** Max hypotheses in quantum superposition */
  max_hypotheses: number;

  /** Action budget per thermodynamic-zen stage */
  action_budget: number;

  /** Whether to auto-execute REALITY stage or require 888_HOLD */
  auto_execute: boolean;

  /** VAULT999 seal on every iteration */
  seal_every_iteration: boolean;

  /** Max iterations before human check-in (0 = unlimited) */
  max_iterations_before_checkin: number;

  // ── APEX Anti-Sink ────────────────────────────────────────────────────

  /**
   * Anti-sink configuration — hard constraints against governance drift.
   * These are NOT advisory. They are physics constraints on the loop.
   */
  antisink: AntiSinkConfig;

  /**
   * Promotion thresholds — tune for speed vs. safety.
   * τ_u: minimum benchmark improvement for promotion (0.05 = 5%)
   * τ_r: minimum reality quota for promotion (0.2 = 20%)
   * W3_min: minimum tri-witness confidence (0.95)
   */
  promotion_thresholds: {
    tau_u: number;
    tau_r: number;
    W3_min: number;
  };

  // ── Per-iteration heuristic gates (PHASE 1 HEURISTIC) ────────────────
  // These wire the prompt's reasoning-frame thresholds into the
  // engine so config overrides actually do something. Both are tagged
  // PHASE 1 HEURISTIC pending ROC calibration on held-out SEAL/REJECT
  // labels. Do not ship as law without that pass. See normalizeThreshold
  // (engine.ts) for validation rules.

  /**
   * Per-iteration APEX score gate (layer 1 of 3 APEX gates, prompt side).
   * The multiplicative product G = Q·V·Ψ·Φ computed by the agent at
   * STAGE 2 (ENCODE) must exceed this to pass. Default 0.70.
   * PHASE 1 HEURISTIC — calibration required.
   */
  min_g_score: number;

  /**
   * Per-iteration tri-witness gate (layer 1 of 3 APEX gates, prompt side).
   * W³ = ∛(h × ai × ext) computed at STAGE 4 (VERIFY) must exceed this
   * to pass. Default 0.70. Distinct from promotion_thresholds.W3_min
   * (which gates champion→challenger promotion at 0.95).
   * PHASE 1 HEURISTIC — calibration required.
   */
  min_witness: number;
}

/**
 * Result of validating one threshold value against the engine's
 * acceptance rules. Surfaced in start + seal responses so the caller
 * can see exactly what threshold is in effect, not what they typed.
 */
export type ThresholdValidation = {
  /** ok = exact value used; clamped = out-of-range pinned to [0,1];
   *  invalid_default_used = non-finite or non-number, fell back to default */
  status: "ok" | "clamped" | "invalid_default_used";
  /** The value the engine will actually use. */
  effective_value: number;
  /** What the caller passed (truncated to undefined for ok case). */
  requested_value: number | null | undefined;
  /** Free-text reason for non-ok statuses; null for ok. */
  reason: string | null;
};

/** Default gates for PHASE 1 HEURISTIC per-iteration thresholds. */
export const DEFAULT_HEURISTIC_GATES = {
  min_g_score: 0.70,
  min_witness: 0.70,
} as const;

export const DEFAULT_CONFIG: RealityLoopConfig = {
  iteration_depth: "standard",
  max_hypotheses: 4,
  action_budget: 3,
  auto_execute: true,
  seal_every_iteration: true,
  max_iterations_before_checkin: 10,
  antisink: { ...DEFAULT_ANTISINK },
  promotion_thresholds: {
    tau_u: PROMOTION_THRESHOLDS.TAU_U,
    tau_r: PROMOTION_THRESHOLDS.TAU_R,
    W3_min: PROMOTION_THRESHOLDS.W3_MIN,
  },
  min_g_score: DEFAULT_HEURISTIC_GATES.min_g_score,
  min_witness: DEFAULT_HEURISTIC_GATES.min_witness,
};
