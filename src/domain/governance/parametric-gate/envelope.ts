/**
 * Parametric Capability Envelope — Zod schema for governed skill synthesis.
 *
 * ═══ A-FORGE::PARAMETRIC_GATE ═══════════════════════════════════════════
 * Phase 1: Schema validation. Non-executable type definitions.
 *
 * Every synthesized capability (prefix cache, LoRA, adapter, prompt policy,
 * tool router) MUST carry this envelope before any deployment gate.
 *
 * Source doctrine: AAA/docs/PARAMETRIC_GATE.md §2.1
 * Source paper: SkillSmith (Dery, Tjandra et al., 2026) arXiv:2607.27497v1
 *
 * Constitutional:
 *   F1 AMANAH   — reversibility fields mandatory, irreversible must be false
 *   F2 TRUTH     — four-baseline ablation required, epistemic tags mandatory
 *   F9 ANTI-HANTU — delta_satisfied must be true (no decorative synthesis)
 *   F11 AUDIT    — provenance chain must be complete
 *   F13 SOVEREIGN — arif_authorized must be explicit (no default-true)
 *
 * @module governance/parametric-gate/envelope
 * @forged 2026-08-03 by 333-AGI under F13 SOVEREIGN directive (Arif)
 * @see /root/AAA/docs/PARAMETRIC_GATE.md
 *
 * DITEMPA BUKAN DIBERI
 */

import { z } from "zod";

// ── Domain enums ─────────────────────────────────────────────────────

/** The type of parametric artifact being synthesized. */
export const CapabilityType = z.enum([
  "prefix_cache",
  "lora",
  "adapter",
  "prompt_policy",
  "tool_router",
  "checkpoint_fragment",
]);
export type CapabilityType = z.infer<typeof CapabilityType>;

/** Federation domain the capability targets. */
export const Domain = z.enum([
  "geox",
  "wealth",
  "well",
  "aaa",
  "hermes",
  "arifos",
]);
export type Domain = z.infer<typeof Domain>;

/** Relationship of a source artifact to the target task. */
export const TaskRelationship = z.enum([
  "parent",
  "sibling",
  "analogous",
  "retrieved",
]);
export type TaskRelationship = z.infer<typeof TaskRelationship>;

/** Type of source artifact being composed. */
export const ArtifactType = z.enum([
  "text_metadata",
  "prefix_cache",
  "lora",
  "adapter",
]);
export type ArtifactType = z.infer<typeof ArtifactType>;

/** Rollback mechanism for the synthesized capability. */
export const RollbackMethod = z.enum([
  "detach",
  "delete",
  "disable",
  "restore_previous",
  "revert_base",
]);
export type RollbackMethod = z.infer<typeof RollbackMethod>;

/** Epistemic label — F2 TRUTH. */
export const EpistemicLabel = z.enum(["OBS", "DER", "INT", "SPEC"]);
export type EpistemicLabel = z.infer<typeof EpistemicLabel>;

/** Constitutional floor verdict. */
export const FloorVerdict = z.enum(["PASS", "HOLD", "VOID"]);
export type FloorVerdict = z.infer<typeof FloorVerdict>;

/** F13 authorization channel — must be authenticated. */
export const AuthChannel = z.enum([
  "telegram",
  "act",
  "local_terminal",
]);
export type AuthChannel = z.infer<typeof AuthChannel>;

/** Capability lifecycle verdict. */
export const CapabilityVerdict = z.enum([
  "UNKNOWN",
  "SABAR",
  "HOLD",
  "SEAL",
  "VOID",
]);
export type CapabilityVerdict = z.infer<typeof CapabilityVerdict>;

/** Risk assessment levels. */
export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** Sandbox lifecycle stage. */
export const SandboxStage = z.enum([
  "PROPOSED",
  "STAGED",
  "SANDBOXED",
  "EVALUATED",
  "RECEIPTED",
  "F13_SEALED",
  "DEPLOYED",
  "REJECTED",
  "ROLLED_BACK",
]);
export type SandboxStage = z.infer<typeof SandboxStage>;

/** Ablation baseline identifier. */
export const BaselineId = z.enum([
  "NO_INPUT",
  "TEXT_ONLY",
  "WEIGHT_ONLY",
  "TEXT_WEIGHT",
]);
export type BaselineId = z.infer<typeof BaselineId>;

// ── Sub-schemas ──────────────────────────────────────────────────────

/** A single source artifact that was composed into the new capability. */
export const SourceArtifactSchema = z.object({
  artifact_id: z.string().min(1, "artifact_id is required"),
  artifact_type: ArtifactType,
  provenance_receipt: z
    .string()
    .min(1, "provenance_receipt is required — F11 AUDIT"),
  task_relationship: TaskRelationship,
});
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

/** Target task definition. */
export const TargetTaskSchema = z.object({
  task_id: z.string().min(1, "task_id is required"),
  domain: Domain,
  description: z.string().min(1, "description is required"),
  heldout_instances: z.number().int().min(30, "minimum 30 heldout instances for statistical power"),
});
export type TargetTask = z.infer<typeof TargetTaskSchema>;

/** How the capability was synthesized. */
export const SynthesisSchema = z.object({
  method: z.string().min(1, "synthesis method is required"),
  model: z.string().min(1, "base model identity is required"),
  output_type: CapabilityType,
  output_length: z.number().int().positive(),
  combination_text: z
    .string()
    .min(1, "combination_text (rationale) is required — F2 TRUTH"),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

/** Reversibility declaration — F1 AMANAH. */
export const ReversibilitySchema = z.object({
  rollback_method: RollbackMethod,
  irreversible: z
    .boolean()
    .refine((v) => v === false, {
      message: "irreversible must be false at proposal stage — F1 AMANAH",
    }),
  rollback_tested: z.boolean(),
});
export type Reversibility = z.infer<typeof ReversibilitySchema>;

/**
 * Single baseline metric.
 *
 * Per SkillSmith Table 1 (Dery et al., 2026):
 *   NO_INPUT=1209, WEIGHT_ONLY=1455, TEXT_ONLY=1622, TEXT_WEIGHT=1714
 */
export const BaselineMetricSchema = z.object({
  baseline: BaselineId,
  metric: z.number().finite(),
  metric_name: z.string().min(1),
});
export type BaselineMetric = z.infer<typeof BaselineMetricSchema>;

/**
 * Four-baseline ablation evaluation.
 *
 * Acceptance criteria (F9 ANTI-HANTU):
 *   TEXT_WEIGHT.metric > TEXT_ONLY.metric AND
 *   TEXT_WEIGHT.metric > WEIGHT_ONLY.metric
 *
 * If TEXT_WEIGHT does not beat the simpler baselines,
 * the parametric synthesis is decorative → VOID.
 */
export const EvaluationSchema = z
  .object({
    baselines: z
      .array(BaselineMetricSchema)
      .length(4, "exactly 4 baselines required: NO_INPUT, TEXT_ONLY, WEIGHT_ONLY, TEXT_WEIGHT"),
    delta_satisfied: z
      .boolean()
      .refine((v) => v === true, {
        message:
          "delta_satisfied must be true — candidate must outperform text-only AND weight-only baselines (F9 ANTI-HANTU)",
      }),
    statistical_test: z.enum(["bootstrap", "ttest", "wilcoxon"]),
    confidence_interval_95: z
      .string()
      .optional()
      .describe("e.g., '[0.28, 0.36]'"),
  })
  .refine(
    (data) => {
      // Validate that all four baseline IDs are present
      const ids = data.baselines.map((b) => b.baseline);
      return (
        ids.includes("NO_INPUT") &&
        ids.includes("TEXT_ONLY") &&
        ids.includes("WEIGHT_ONLY") &&
        ids.includes("TEXT_WEIGHT")
      );
    },
    {
      message:
        "baselines must include all four: NO_INPUT, TEXT_ONLY, WEIGHT_ONLY, TEXT_WEIGHT",
    }
  );
export type Evaluation = z.infer<typeof EvaluationSchema>;

/** Sandbox execution record. */
export const SandboxSchema = z.object({
  sandbox_id: z.string().min(1),
  stage: SandboxStage,
  passed: z.boolean(),
  absolute_timeout_ms: z.number().int().positive().max(60000),
  resource_limits: z.object({
    max_memory_mb: z.number().int().positive(),
    max_cpu_seconds: z.number().int().positive(),
  }),
  failure_modes_observed: z.array(z.string()),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;

/** Distillation receipt — the evidence bundle for F13 review. */
export const ReceiptSchema = z.object({
  receipt_id: z.string().min(1),
  receipt_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "receipt_hash must be SHA-256 hex"),
  sealed_at: z.string().datetime(),
  sealed_by: z.string().min(1),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/**
 * Per-floor constitutional gate.
 *
 * Each floor must be explicitly checked. No default-true.
 */
export const FloorGateSchema = z.object({
  F1_amanah: z.object({
    reversible: z.boolean(),
    rollback_path_verified: z.boolean(),
    verdict: FloorVerdict,
  }),
  F2_truth: z.object({
    evidence_cited: z.boolean(),
    epistemic_tags: z.array(EpistemicLabel).min(1),
    verdict: FloorVerdict,
  }),
  F9_anti_hantu: z.object({
    no_hallucinated_claims: z.boolean(),
    synthesis_not_decorative: z
      .boolean()
      .refine((v) => v === true, {
        message: "synthesis_not_decorative must be true — delta must be real (F9)",
      }),
    verdict: FloorVerdict,
  }),
  F11_audit: z.object({
    provenance_chain_complete: z.boolean(),
    receipt_linked: z.boolean(),
    verdict: FloorVerdict,
  }),
  F13_sovereign: z.object({
    arif_authorized: z
      .boolean()
      .refine((v) => v === true, {
        message:
          "arif_authorized must be true BEFORE deployment — F13 SOVEREIGN",
      }),
    auth_channel: AuthChannel,
    auth_token: z.string().min(1, "F13 auth token is required"),
    verdict: FloorVerdict,
  }),
});
export type FloorGate = z.infer<typeof FloorGateSchema>;

/** Evidence bundle with epistemic tagging — F2 TRUTH. */
export const EvidenceSchema = z.object({
  OBS: z.array(z.string()).describe("Directly observed facts"),
  DER: z.array(z.string()).describe("Computed or derived findings"),
  INT: z.array(z.string()).describe("Interpretations"),
  SPEC: z.array(z.string()).describe("Untested or speculative claims"),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ── Full Capability Envelope ─────────────────────────────────────────

/**
 * The complete Parametric Capability Envelope.
 *
 * Every synthesized capability MUST pass this schema validation
 * before it can proceed to sandbox, evaluation, or deployment.
 *
 * Mandatory fields (non-negotiable):
 *   - source_artifacts[].provenance_receipt (F11)
 *   - synthesis.combination_text (F2)
 *   - reversibility.irreversible === false (F1)
 *   - evaluation.baselines (all 4) (F2/F9)
 *   - evaluation.delta_satisfied === true (F9)
 *   - constitutional_gates.F13_sovereign.arif_authorized === true (F13)
 */
export const CapabilityEnvelopeSchema = z.object({
  capability_id: z.string().min(1, "capability_id is required"),
  capability_type: CapabilityType,
  target_task: TargetTaskSchema,
  source_artifacts: z
    .array(SourceArtifactSchema)
    .min(1, "at least one source artifact is required"),
  synthesis: SynthesisSchema,
  reversibility: ReversibilitySchema,
  evaluation: EvaluationSchema,
  sandbox: SandboxSchema.optional().describe(
    "Populated after forge_sandbox_run completes"
  ),
  receipt: ReceiptSchema.optional().describe(
    "Populated after PARAMETRIC_DISTILLATION receipt is written"
  ),
  constitutional_gates: FloorGateSchema,
  evidence: EvidenceSchema,
  seal: z.object({
    verdict: CapabilityVerdict,
    seal_id: z.string().optional(),
    sealed: z.boolean(),
  }),
  // Metadata
  proposed_by: z.string().min(1),
  proposed_at: z.string().datetime(),
  source_doctrine_ref: z
    .string()
    .default("AAA/docs/PARAMETRIC_GATE.md"),
  source_paper_ref: z
    .string()
    .default("arXiv:2607.27497v1 (Dery, Tjandra et al., 2026)"),
});

export type CapabilityEnvelope = z.infer<typeof CapabilityEnvelopeSchema>;

// ── Validation helpers ───────────────────────────────────────────────

/**
 * Validate a capability envelope against the full schema.
 * Returns parsed result or throws ZodError with context.
 */
export function validateEnvelope(
  candidate: unknown
): { success: true; data: CapabilityEnvelope } | { success: false; errors: string[] } {
  const result = CapabilityEnvelopeSchema.safeParse(candidate);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    ),
  };
}

/**
 * Check if an envelope is ready for sandbox stage.
 * Requires: valid schema, reversibility declared, baselines present.
 */
export function isSandboxReady(envelope: CapabilityEnvelope): boolean {
  return (
    envelope.reversibility.irreversible === false &&
    envelope.evaluation.baselines.length === 4 &&
    envelope.constitutional_gates.F2_truth.evidence_cited
  );
}

/**
 * Check if an envelope is ready for F13 review.
 * Requires: sandbox passed, delta satisfied, all floor gates at least PENDING.
 */
export function isF13Ready(envelope: CapabilityEnvelope): boolean {
  if (!envelope.sandbox?.passed) return false;
  if (!envelope.evaluation.delta_satisfied) return false;
  if (!envelope.receipt) return false;

  const gates = envelope.constitutional_gates;
  const allChecked =
    gates.F1_amanah.verdict !== "VOID" &&
    gates.F2_truth.verdict !== "VOID" &&
    gates.F9_anti_hantu.verdict !== "VOID" &&
    gates.F11_audit.verdict !== "VOID";

  return allChecked;
}

/**
 * Check if an envelope is deployable.
 * Requires: F13 authorized, SEAL verdict, receipt present.
 */
export function isDeployable(envelope: CapabilityEnvelope): boolean {
  return (
    envelope.constitutional_gates.F13_sovereign.arif_authorized &&
    envelope.seal.verdict === "SEAL" &&
    envelope.seal.sealed &&
    envelope.receipt !== undefined
  );
}
