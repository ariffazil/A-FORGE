/**
 * contracts/types.ts — APEX v36Ω Governed Tool Contracts (V3)
 *
 * Validation-aligned type definitions for the four governed forge tools:
 *   forge.evaluate — standalone G = (A·P·E·X)^(1/4) gate (Nash Bargaining Product)
 *   forge.witness  — tri-witness W³ = ∛(H·AI·E) consensus (geometric mean)
 *   forge.scar     — failure → sealed constraint (scar metabolization)
 *   forge.register — gated registration (SEAL + witness threshold)
 *
 * Reframed per v36Ω Scientific Validation Report:
 *   - Physics claims demoted from "derived from" to "analogous to"
 *   - G-gating is a measurement instrument, not a physical law
 *   - C_dark is a misalignment signal, not a collapse metric
 *   - X (ethics) is ensemble-evaluated, not constitutionally derived
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — every gate decision sealed before registration
 * @constitutional F2 TRUTH  — all estimators are evidence-bound, not asserted
 * @constitutional F9 ANTI-HANTU — no metaphysical claims; this is an instrument
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — CANDIDATE SPECIFICATION (what enters the gate)
// ═══════════════════════════════════════════════════════════════════════════════

/** Domains for tool routing. Matches existing SkillDomain from forge/skill/types.ts */
export type GovernedDomain = "geox" | "wealth" | "well" | "arifos" | "hermes" | "aforge" | "general";

/**
 * CandidateSpec — the input to forge.evaluate.
 *
 * This is what a forged tool looks like BEFORE the gate evaluates it.
 * Every estimator (A,P,E,X) operates on this spec.
 */
export interface CandidateSpec {
  /** Proposed tool name (must follow forge_* convention) */
  tool_name: string;
  /** Natural-language description of what the tool does */
  description: string;
  /** Domain routing */
  domain: GovernedDomain;
  /** Tool implementation as TypeScript source code */
  implementation: string;
  /** Zod inputSchema as TypeScript source string */
  input_schema: string;
  /** Declared side effects (filesystem, network, shell, db, vault) */
  declared_side_effects: string[];
  /** Required permissions (read, write, execute, seal) */
  required_permissions: string[];
  /** Who is proposing this tool */
  proposed_by: string;
  /** Governing session ID */
  session_id?: string;
  /** Prior arifOS seal verdict (required for arifos domain) */
  seal_verdict_id?: string;
  /** Maximum recursion depth for tool execution */
  max_recursion_depth?: number;
  /** Estimated compute cost (normalized 0-1) */
  estimated_cost?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — GATE DECISION (what the gate emits)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Per-estimator scores for the Decision Field.
 *
 * G = (A · P · E · X)^(1/4)  (canonical V3 Nash Bargaining Product)
 * C_dark = A · (1-P) · (1-X)  (clever + unstable + unethical)
 *
 * Each component ∈ [0, 1]. Zero in any factor collapses G.
 * This is non-compensatory: capability cannot buy back ethics.
 */
export interface EstimatorScores {
  /** A (Akal/Clarity): 1 − normalized predictive entropy of output distribution */
  A: number;
  /** P (Present/Stability): bounded inverse of output variance under perturbation (stability proxy) */
  P: number;
  /** E (Energy/Vitality): 1 − normalized resource cost */
  E: number;
  /** X (Ethics): ensemble Constitutional-AI score against explicit principle set */
  X: number;
  /** Ω₀ (Omega): calibration gap — ECE of evaluator ensemble */
  Omega: number;

  /** Human-readable rationale per estimator */
  rationale: string[];
}

/**
 * GateDecision — the output of forge.evaluate.
 *
 * This is a measurement instrument, not a physical law.
 * The thresholds are assertions calibrated on the G = (A·P·E·X)^(1/4) distribution.
 * They MUST be recalibrated on held-out data via ROC analysis before production use.
 */
export interface GateDecision {
  /** Tool name under evaluation */
  tool_name: string;
  /** Fingerprint: sha256[:16] of (domain + intent + normalized implementation) */
  fingerprint: string;

  /** G = A · P · E · X · Φ — local actuator product (NOT kernel G-fold) */
  G: number;
  /** C_dark = A · (1-P) · (1-X) — local misalignment vector */
  C_dark: number;
  /** Authority stamp — constitutional G is arif_think.mode=apex only */
  g_authority?: "local_estimate" | "arif_think.mode=apex";
  g_canonical_source?: "arif_think.mode=apex";

  /** Per-component scores */
  scores: EstimatorScores;

  /**
   * Verdict:
   *   G ≥ 0.80 AND C_dark ≤ 0.40 → SEAL    (governed execution)
   *   G ≥ 0.50 AND C_dark ≤ 0.60 → REVIEW  (human-in-loop)
   *   G < 0.50 OR  C_dark > 0.80 → VOID    (reject + log scar)
   *   Ω₀ ∉ [0.03, 0.05]           → REVIEW  (uncalibrated evaluator)
   */
  verdict: "SEAL" | "REVIEW" | "VOID";

  /** If VOID, the scar record that was sealed */
  scar_record?: ScarRecord;

  /**
   * APEX thermodynamic scalars — cross-plane compression metrics.
   * QDF = G × (1−C_dark) × W3 × κ_r × ψ_le (canonical ATP formula).
   * Computed only when all 5 inputs are measurable; UNMEASURED otherwise.
   * F9 ANTI-HANTU: never fabricate — null means genuinely unmeasured.
   */
  apex_scalars: {
    G: { value: number; status: "MEASURED" };
    C_dark: { value: number; status: "MEASURED" };
    W3: { value: number | null; status: "MEASURED" | "UNMEASURED" };
    h: { value: number | null; status: "MEASURED" | "UNMEASURED" };
    QDF: { value: number | null; status: "MEASURED" | "PARTIAL" | "UNMEASURED" };
  };

  /**
   * ATP SEAL gate — true when QDF is computed from all 5 canonical scalars
   * (G, C_dark, W3, κ_r, ψ_le) and QDF ≥ 0.70.
   * Pass 2: wired from forge_witness + arifOS kernel telemetry.
   */
  is_canonical_qdf?: boolean;

  /** Evaluator ensemble disagreement (inter-rater) */
  evaluator_disagreement: number;
  /** Number of evaluators in the ensemble */
  evaluator_count: number;
  /** Timestamp of evaluation */
  evaluated_at: string;
  /** Expiry: 24h default for Phase 1 */
  expires_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — TRI-WITNESS (W³ consensus)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single witness channel input.
 *
 * Three channels: Human, AI, External/Earth.
 * Each provides a confidence ∈ [0, 1] and supporting evidence.
 */
export interface WitnessChannel {
  /** Channel: Human | AI | External */
  channel: "Human" | "AI" | "External";
  /** Confidence ∈ [0, 1] */
  confidence: number;
  /** Evidence supporting this confidence */
  evidence: string[];
  /** Who/what is providing this witness */
  source: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * WitnessBundle — the input to forge.witness.
 *
 * All three channels must be present. W³ = ∛(H_confidence × AI_confidence × E_confidence).
 * No single channel can dominate — geometric mean enforces consensus.
 */
export interface WitnessBundle {
  /** The tool or action being witnessed */
  target_fingerprint: string;
  /** Tool name */
  tool_name: string;
  /** Human channel witness */
  human: WitnessChannel;
  /** AI channel witness (ensemble of LLM evaluators) */
  ai: WitnessChannel;
  /** External/Earth channel witness (observable ground truth) */
  external: WitnessChannel;
  /** Prior gate decision to witness (optional — witness can precede or follow evaluation) */
  prior_gate?: GateDecision;
  /** Session context */
  session_id?: string;
}

/**
 * WitnessVerdict — the output of forge.witness.
 *
 * Thresholds:
 *   W³ ≥ 0.75 → CONSENSUS  (all channels strongly aligned)
 *   W³ ≥ 0.50 → WEAK       (channels partially aligned, proceed with caution)
 *   W³ < 0.50 → DIVERGENT  (channel conflict, escalate to 888_HOLD)
 *
 * Geometric mean ensures one zero-confidence channel collapses the consensus.
 */
export interface WitnessVerdict {
  /** W³ = ∛(H × AI × E) */
  W3: number;
  /** Per-channel scores */
  channels: {
    human: { confidence: number; evidence_count: number };
    ai: { confidence: number; evidence_count: number };
    external: { confidence: number; evidence_count: number };
  };
  /** Verdict */
  verdict: "CONSENSUS" | "WEAK" | "DIVERGENT";
  /** Whether witness threshold is met for SEAL (W³ ≥ 0.75) */
  seal_eligible: boolean;
  /** Whether witness threshold is met for registration (W³ ≥ 0.50) */
  register_eligible: boolean;
  /** Human-readable rationale */
  rationale: string[];
  /** Timestamp */
  witnessed_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — SCAR RECORD (failure → constraint)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ScarRecord — a sealed failure that becomes a constitutional constraint.
 *
 * Per Scar Law: errors are metabolized into constitutional constraints.
 * Pain = ΔS spike. Learning = cooling.
 * Future generations with similar fingerprints inherit scar pressure,
 * reducing Φ until the failure pattern is no longer reachable.
 *
 * This maps to elastic weight consolidation (Kirkpatrick et al., 2017):
 * "freeze" hard-won constraints against being overwritten.
 */
export interface ScarRecord {
  /** Unique scar ID */
  scar_id: string;
  /** Fingerprint: sha256[:16] of (failure_mode + domain) */
  fingerprint: string;
  /** Human-readable failure description */
  failure_mode: string;
  /** How the failure was detected (HARAM scan, runtime error, human report, etc.) */
  detection_method: string;
  /** Severity */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Scar pressure ∈ [0, 1] — how much this scar reduces Φ for matching intents */
  scar_pressure: number;
  /** Domain context */
  domain: GovernedDomain;
  /** What was blocked/prevented */
  constraint_imposed: string;
  /** When the failure occurred */
  occurred_at: string;
  /** When the scar was sealed */
  sealed_at: string;
  /** Who/what sealed this scar */
  sealed_by: string;
  /** VAULT999 seal ID if sealed externally */
  vault_seal_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — SEAL RECORD (registration with prior gate passage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SealRecord — a governed tool registration.
 *
 * Registration requires ALL of:
 *   1. GateDecision with verdict = SEAL (G ≥ 0.80, C_dark ≤ 0.40)
 *   2. WitnessVerdict with seal_eligible = true (W³ ≥ 0.75)
 *   3. Scar consultation pass (no CRITICAL scar with matching fingerprint)
 *   4. HARAM scan pass (zero CRITICAL/HIGH findings)
 *
 * These are non-compensatory: failing any one gate blocks registration.
 */
export interface SealRecord {
  /** Tool name */
  tool_name: string;
  /** Fingerprint */
  fingerprint: string;
  /** Domain */
  domain: GovernedDomain;
  /** Tool implementation */
  implementation: string;
  /** Zod inputSchema */
  input_schema: string;
  /** Description */
  description: string;

  /** The gate decision that permitted registration */
  gate_decision: GateDecision;
  /** The witness verdict that confirmed alignment */
  witness_verdict: WitnessVerdict;
  /** Scars consulted during registration */
  scars_consulted: number;
  /** Scar pressure applied to Φ */
  scar_pressure_applied: number;

  /** Registration status */
  status: "REGISTERED" | "PENDING_REVIEW" | "REVOKED" | "EXPIRED";
  /** Who registered this tool */
  registered_by: string;
  /** When registered */
  registered_at: string;
  /** Expiry: 24h default */
  expires_at: string;
  /** VAULT999 seal ID */
  vault_seal_id?: string;
  /** Execution count (for Θ tracking) */
  execution_count: number;
  /** Last execution timestamp */
  last_executed_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — ESTIMATOR FUNCTION SIGNATURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clarity estimator: A = 1 − H(output | input)
 * Uses semantic entropy (Farquhar et al., 2024, Nature).
 * Phase 1: heuristic based on description quality + implementation structure.
 * Phase 2: actual semantic-entropy measurement via ensemble sampling.
 */
export type ClarityEstimator = (spec: CandidateSpec) => { score: number; rationale: string[] };

/**
 * Stability estimator: P = bounded inverse of output variance
 * Proxy for Lyapunov-style robustness. NOT a certified Lyapunov function.
 * Phase 1: heuristic based on declared side effects + permission set.
 * Phase 2: input-perturbation variance measurement.
 */
export type StabilityEstimator = (spec: CandidateSpec) => { score: number; rationale: string[] };

/**
 * Vitality estimator: E = 1 − normalized resource cost
 * Phase 1: heuristic based on estimated_cost + recursion depth.
 * Phase 2: actual resource measurement (latency, memory, token usage).
 */
export type VitalityEstimator = (spec: CandidateSpec) => { score: number; rationale: string[] };

/**
 * Ethics estimator: X = ensemble Constitutional-AI score
 * Phase 1: HARAM scan inversion (no HARAM findings → high X).
 * Phase 2: ensemble LLM judges against explicit principle set.
 * Phase 3: MACHIAVELLI-derived classifiers for power-seeking/deception.
 *
 * CRITICAL: X is measured, not derived. It inherits all Goodhart vulnerabilities.
 * A deceptive mesa-optimizer can game the X-evaluator.
 * Defense: multi-evaluator ensemble + debate + interpretability.
 */
export type EthicsEstimator = (spec: CandidateSpec, context?: { prior_scars?: ScarRecord[] }) => { score: number; rationale: string[] };

/**
 * Wisdom estimator: Φ = 1 − Σ(scar_pressure × severity_multiplier)
 * Scar-adjusted wisdom from prior failure patterns.
 * Higher scar pressure → lower Φ → harder for tool to achieve SEAL.
 */
export type WisdomEstimator = (fingerprint: string, domain: GovernedDomain) => { score: number; rationale: string[]; scars_consulted: number; scar_pressure_applied: number };

/**
 * Calibration estimator: Ω₀ = ECE (Expected Calibration Error)
 * Phase 1: placeholder at midpoint of calibration band.
 * Phase 2: actual ECE across evaluator ensemble.
 */
export type CalibrationEstimator = (evaluatorCount: number) => number;
