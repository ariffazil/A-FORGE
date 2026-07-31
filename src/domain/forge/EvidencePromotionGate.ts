/**
 * EvidencePromotionGate — Promotion by verified mission outcomes.
 *
 * ═══ P0.4 (2026-07-31) ═══════════════════════════════════════════════════
 * Replaces the legacy "promotion by instantiation count" gate. A
 * capability becomes eligible for promotion only when:
 *   - it has been instantiated at least N times (default 5),
 *   - its success rate ≥ 0.95,
 *   - it has at least 3 independent verifier passes that exclude
 *     SELF_CERTIFIED,
 *   - at least one pass is `domain_witness` OR
 *     `independent_recompute` (not just `known_answer`),
 *   - empirical capability score (from CapabilityMarket) ≥ 0.80.
 *
 * A-FORGE only PROPOSES. The final lease promotion is sealed by
 * arif_judge (F13 SOVEREIGN). A-FORGE never self-promotes.
 *
 * @module forge/EvidencePromotionGate
 * @constitutional F1 AMANAH · F2 TRUTH · F9 ANTIHANTU · F13 SOVEREIGN
 */
import type { VerifierMethod, VerifierReceipt } from "../governance/verifier/VerifierRegistry.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface EvidencePromotionThresholds {
  minInstances: number;
  minSuccessRate: number;
  minIndependentVerifierPasses: number;
  minEmpiricalCapabilityScore: number;
}

export interface EvidencePromotionEvidence {
  /** Total instantiations of this template in the active window. */
  instantiation_count: number;
  /** ok invocations / total invocations. */
  success_rate: number;
  /** Passes that exclude SELF_CERTIFIED. */
  independent_verifier_passes: number;
  /** Histogram of verifier methods observed. */
  verifier_methods: Partial<Record<VerifierMethod, number>>;
  /** Populated by CapabilityMarket in P2; defaults to 0.0 until then. */
  empirical_capability_score: number;
  /** Last N verifier receipts the caller wishes to surface. */
  recent_receipts: VerifierReceipt[];
}

export interface PromotionProposal {
  template_id: string;
  ok_to_propose: boolean;
  evidence: EvidencePromotionEvidence;
  thresholds: EvidencePromotionThresholds;
  /** Which threshold failed (empty if ok_to_propose=true). */
  failing_gates: ReadonlyArray<keyof EvidencePromotionThresholds>;
  /** Operator-facing next step. */
  next_step: "POST to arif_judge(mode='judge', candidate=promotion_request, evidence=…)";
}

// ── Defaults ──────────────────────────────────────────────────────────

const DEFAULTS: EvidencePromotionThresholds = {
  minInstances: 5,
  minSuccessRate: 0.95,
  minIndependentVerifierPasses: 3,
  minEmpiricalCapabilityScore: 0.8,
};

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number.parseInt(raw, 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function readEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

export function loadDefaultThresholds(): EvidencePromotionThresholds {
  return {
    minInstances: readEnvInt("AFORGE_PROMOTION_MIN_INSTANCES", DEFAULTS.minInstances),
    minSuccessRate: readEnvFloat("AFORGE_PROMOTION_MIN_SUCCESS", DEFAULTS.minSuccessRate),
    minIndependentVerifierPasses: readEnvInt(
      "AFORGE_PROMOTION_MIN_VERIFIERS",
      DEFAULTS.minIndependentVerifierPasses,
    ),
    minEmpiricalCapabilityScore: readEnvFloat(
      "AFORGE_PROMOTION_MIN_SCORE",
      DEFAULTS.minEmpiricalCapabilityScore,
    ),
  };
}

// ── Gate ──────────────────────────────────────────────────────────────

export class EvidencePromotionGate {
  private readonly thresholds: EvidencePromotionThresholds;

  constructor(thresholds: EvidencePromotionThresholds = loadDefaultThresholds()) {
    this.thresholds = thresholds;
  }

  getThresholds(): EvidencePromotionThresholds {
    return { ...this.thresholds };
  }

  /**
   * Evaluate the evidence and return a PromotionProposal. A-FORGE
   * never sets `ok_to_propose=true` without the empirical score
   * crossing the threshold. The proposal is then routed to arif_judge.
   */
  evaluate(templateId: string, evidence: EvidencePromotionEvidence): PromotionProposal {
    const failing: Array<keyof EvidencePromotionThresholds> = [];
    if (evidence.instantiation_count < this.thresholds.minInstances) failing.push("minInstances");
    if (evidence.success_rate < this.thresholds.minSuccessRate) failing.push("minSuccessRate");
    if (evidence.independent_verifier_passes < this.thresholds.minIndependentVerifierPasses) {
      failing.push("minIndependentVerifierPasses");
    }
    if (evidence.empirical_capability_score < this.thresholds.minEmpiricalCapabilityScore) {
      failing.push("minEmpiricalCapabilityScore");
    }

    // Diversity gate: at least one of {domain_witness, independent_recompute}
    const dom = evidence.verifier_methods.domain_witness ?? 0;
    const indep = evidence.verifier_methods.independent_recompute ?? 0;
    const diversity_ok = dom + indep > 0;
    if (!diversity_ok) {
      // We surface as failing the verifier-passes gate so the operator
      // sees the root cause. The proposal still emits a structured
      // "next_step" so the caller routes to arif_judge for SEAL.
      failing.push("minIndependentVerifierPasses");
    }

    return {
      template_id: templateId,
      ok_to_propose: failing.length === 0,
      evidence,
      thresholds: this.getThresholds(),
      failing_gates: failing,
      next_step:
        "POST to arif_judge(mode='judge', candidate=promotion_request, evidence=…)",
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let _gate: EvidencePromotionGate | null = null;

export function getEvidencePromotionGate(): EvidencePromotionGate {
  if (!_gate) _gate = new EvidencePromotionGate();
  return _gate;
}
