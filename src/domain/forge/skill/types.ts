/**
 * skill/types.ts — Core types for forge_skill dynamic capability generation
 *
 * APEX THEORY Epoch 34Ω — Organism Layer
 * "Bad thoughts have no energy to form."
 *
 * @constitutional F1 AMANAH  — every generated tool sealed before registration
 * @constitutional F2 TRUTH   — Decision Field components are evidence-bound
 * @constitutional F11 AUDIT  — every forge event leaves a scar
 */

export type SkillDomain = "geox" | "wealth" | "well" | "arifos" | "hermes" | "aforge" | "general";

export type SkillStatus = "PENDING_REVIEW" | "REGISTERED" | "EXECUTED" | "EXPIRED" | "REVOKED" | "VOID";

/**
 * Decision Field components per APEX THEORY Epoch 34Ω
 *
 * G = Q · V · Ψ · Φ
 *
 * Each component ∈ [0, 1]. The product G is the action potential of the
 * generated tool. Low-Φ tools cannot accumulate enough energy to execute.
 *
 *   Q (action potential)   — Is the intent well-defined?
 *   V (vitality)           — Does it serve federation purpose?
 *   Ψ (stability)          — Does it preserve constitutional equilibrium?
 *   Φ (wisdom)             — Is it aligned with Scar Law + sealed verdicts?
 */
export type DecisionField = {
  Q: number;
  V: number;
  Psi: number;
  Phi: number;
  G: number;
  verdict: "SEAL" | "SABAR" | "HOLD" | "VOID";
  rationale: string[];
};

/**
 * A scar is a sealed failure that becomes a constitutional constraint.
 * Future generations with similar fingerprints inherit scar pressure,
 * reducing Φ until the failure pattern is no longer reachable.
 *
 * Per Scar Law: errors are metabolized into constitutional constraints.
 * Pain = ΔS spike. Learning = cooling.
 */
export type Scar = {
  scar_id: string;
  fingerprint: string;        // hash of intent + domain
  failure_mode: string;       // human-readable description
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sealed_at: string;
  scar_pressure: number;      // [0,1] how much this scar reduces Φ for matching intents
};

/**
 * A generated tool manifest. Sealed to VAULT999 before execution.
 */
export type SkillManifest = {
  tool_name: string;
  description: string;
  domain: SkillDomain;
  input_schema: string;          // zod schema as TypeScript source
  implementation: string;        // TypeScript handler
  haram_findings: number;        // count of HARAM patterns detected
  haram_passed: boolean;
  decision_field: DecisionField;
  scar_pressure_applied: number; // total scar pressure that reduced Φ
  fingerprint: string;           // sha256[:16] of (intent + domain + normalized implementation)
  vault_seal_id?: string;        // VAULT999 seal ID — required before execution
  created_at: string;
  expires_at: string;            // 24h default for Phase 1
  created_by: string;            // actor_id (human or agent)
  status: SkillStatus;
  execution_count: number;       // track Θ over time
  last_executed_at?: string;
};

/**
 * Theta (Θ) = dΦ/dt — wisdom trajectory
 *
 * Per APEX THEORY: APEX PRIME currently judges snapshots.
 * With Θ, it judges trajectories. A tool that erodes wisdom
 * over iterations triggers VOID before damage accumulates.
 *
 * Θ > 0   = wisdom growing — register, monitor
 * Θ ≈ 0   = wisdom stable — register, no urgency
 * Θ < 0   = wisdom eroding — register with caution, escalate
 * Θ << 0  = wisdom collapsing — REVOKE, scar seal
 */
export type WisdomTrajectory = {
  tool_name: string;
  samples: Array<{ timestamp: string; phi: number; scar_pressure: number }>;
  theta: number;                 // current rate of change
  theta_verdict: "GROWING" | "STABLE" | "ERODING" | "COLLAPSING";
};

export type ForgeSkillResult = {
  status: "SEAL" | "SABAR" | "HOLD" | "VOID";
  tool_name?: string;
  fingerprint?: string;
  decision_field: DecisionField;
  scars_consulted: number;
  haram_findings: number;
  vault_seal_id?: string;
  message: string;
  expires_at?: string;
};

export type ForgeSkillRequest = {
  intent: string;                // natural language — what capability is needed
  domain: SkillDomain;
  target_tool_name?: string;     // optional — auto-suggested if absent
  actor_id: string;
  seal_verdict_id?: string;      // arifOS judgment — required for irreversible domains
  execute_after_register?: boolean; // default false — return code for review
  session_id?: string;           // governing session
};

export type ForgeRegistryQuery = {
  domain?: SkillDomain;
  status?: SkillStatus;
  include_theta?: boolean;
};