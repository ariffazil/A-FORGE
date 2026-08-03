/**
 * A-FORGE::PARAMETRIC_GATE — Governed Capability Synthesis
 *
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Phase 1: Schema validation (Zod types + validation helpers).
 * Phase 2-7: Not yet implemented (see PARAMETRIC_GATE.md §7).
 *
 * This module defines the constitutional substrate for parametric skill
 * synthesis in the arifOS federation. Before any agent synthesizes new
 * capabilities from prior text + weights, the resulting artifact must
 * pass through envelope validation, ablation testing, sandbox containment,
 * receipt writing, and F13 sovereign authorization.
 *
 * Source doctrine:    /root/AAA/docs/PARAMETRIC_GATE.md
 * Source paper:       SkillSmith (Dery, Tjandra et al., 2026)
 *                     arXiv:2607.27497v1
 *
 * Constitutional:
 *   F1 AMANAH   — every capability must be reversible
 *   F2 TRUTH     — four-baseline ablation required
 *   F9 ANTI-HANTU — no decorative synthesis
 *   F11 AUDIT    — provenance + receipt hash chain
 *   F13 SOVEREIGN — explicit authorization required
 *
 * @module governance/parametric-gate
 * @forged 2026-08-03 by 333-AGI under F13 SOVEREIGN directive (Arif)
 *
 * DITEMPA BUKAN DIBERI
 */

export {
  // ── Enums ──
  CapabilityType,
  Domain,
  TaskRelationship,
  ArtifactType,
  RollbackMethod,
  EpistemicLabel,
  FloorVerdict,
  AuthChannel,
  CapabilityVerdict,
  RiskLevel,
  SandboxStage,
  BaselineId,
} from "./envelope.js";

export {
  // ── Sub-schemas ──
  SourceArtifactSchema,
  TargetTaskSchema,
  SynthesisSchema,
  ReversibilitySchema,
  BaselineMetricSchema,
  EvaluationSchema,
  SandboxSchema,
  ReceiptSchema,
  FloorGateSchema,
  EvidenceSchema,
  // ── Full envelope ──
  CapabilityEnvelopeSchema,
  // ── Helpers ──
  validateEnvelope,
  isSandboxReady,
  isF13Ready,
  isDeployable,
} from "./envelope.js";

export type {
  // ── Domain types ──
  SourceArtifact,
  TargetTask,
  Synthesis,
  Reversibility,
  BaselineMetric,
  Evaluation,
  Sandbox,
  Receipt,
  FloorGate,
  Evidence,
  CapabilityEnvelope,
} from "./envelope.js";
