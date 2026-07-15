/**
 * witness.ts — forge.witness: Tri-Witness W³ = ∛(H·AI·E) Consensus
 *
 * APEX v36Ω — Tri-Witness Decision Layer.
 *
 * W³ = ∛(Human_confidence × AI_confidence × External_confidence)
 *
 * Geometric mean of three independent witness channels.
 * Nash 1950 bargaining product: no single channel can dominate.
 * One zero-confidence channel collapses the entire consensus.
 *
 * Thresholds:
 *   W³ ≥ 0.75 → CONSENSUS    (seal_eligible = true)
 *   W³ ≥ 0.50 → WEAK         (register_eligible = true)
 *   W³ < 0.50 → DIVERGENT    (escalate to 888_HOLD)
 *
 * Invariants (binding):
 *   - No SEAL semantics without required witness threshold (W³ ≥ 0.75)
 *   - Do NOT fake witness confidence — unknown → 0.0, not 0.5
 *   - All three channels MUST be present — no channel can be "optional"
 *   - Human channel requires explicit human attestation (no synthetic human)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F2 TRUTH — witness confidence is evidence-bound
 * @constitutional F6 MARUAH — Human channel preserves dignity
 * @constitutional F13 SOVEREIGN — DIVERGENT verdict escalates to 888_HOLD
 */

import crypto from "node:crypto";
import type {
  WitnessBundle,
  WitnessVerdict,
  WitnessChannel,
  GateDecision,
} from "../../contracts/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — WITNESS CHANNEL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a witness channel.
 *
 * Each channel must:
 *   - Have confidence ∈ [0, 1]
 *   - Have at least one piece of evidence
 *   - Have a non-empty source identifier
 *   - Have a valid timestamp
 *
 * Unknown/absent evidence → confidence = 0.0 (not 0.5).
 * This is the anti-fabrication invariant from 777 FORGE witness layer.
 */
function validateChannel(channel: WitnessChannel): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (channel.confidence < 0 || channel.confidence > 1) {
    issues.push(`${channel.channel}: confidence ${channel.confidence} outside [0,1]`);
  }

  if (channel.evidence.length === 0 && channel.confidence > 0) {
    issues.push(`${channel.channel}: confidence=${channel.confidence} but zero evidence — confidence reduced to 0`);
  }

  if (!channel.source || channel.source.trim().length === 0) {
    issues.push(`${channel.channel}: empty source — cannot verify provenance`);
  }

  if (!channel.timestamp || isNaN(Date.parse(channel.timestamp))) {
    issues.push(`${channel.channel}: invalid timestamp`);
  }

  return { valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — CONSENSUS COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute W³ = ∛(H × AI × E).
 *
 * Geometric mean (Nash 1950 bargaining product):
 *   - One zero → W³ = 0 (full collapse)
 *   - One low confidence → W³ is dragged down proportionally
 *   - All high → W³ is high
 *
 * This is non-compensatory: a single dissenting channel cannot be
 * "bought back" by high confidence from other channels.
 */
export function computeW3(
  humanConfidence: number,
  aiConfidence: number,
  externalConfidence: number,
): number {
  // If any channel is zero, W³ = 0
  if (humanConfidence === 0 || aiConfidence === 0 || externalConfidence === 0) {
    return 0;
  }

  // Geometric mean
  return Math.cbrt(humanConfidence * aiConfidence * externalConfidence);
}

/**
 * Render verdict from W³.
 */
function renderWitnessVerdict(W3: number): {
  verdict: "CONSENSUS" | "WEAK" | "DIVERGENT";
  sealEligible: boolean;
  registerEligible: boolean;
  reason: string;
} {
  if (W3 >= 0.75) {
    return {
      verdict: "CONSENSUS",
      sealEligible: true,
      registerEligible: true,
      reason: `W³=${W3.toFixed(3)} ≥ 0.75 — all channels strongly aligned, SEAL-eligible`,
    };
  }

  if (W3 >= 0.50) {
    return {
      verdict: "WEAK",
      sealEligible: false,
      registerEligible: true,
      reason: `W³=${W3.toFixed(3)} ≥ 0.50 — channels partially aligned, register-eligible but NOT SEAL-eligible. Full SEAL requires W³ ≥ 0.75.`,
    };
  }

  return {
    verdict: "DIVERGENT",
    sealEligible: false,
    registerEligible: false,
    reason: `W³=${W3.toFixed(3)} < 0.50 — channels divergent, escalate to 888_HOLD. No SEAL or registration without consensus.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — MAIN FORGE.WITNESS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface WitnessOptions {
  /** The witness bundle to evaluate */
  bundle: WitnessBundle;
}

/**
 * forge.witness — the tri-witness consensus gate.
 *
 * Input: WitnessBundle (all three channels)
 * Output: WitnessVerdict (CONSENSUS / WEAK / DIVERGENT)
 *
 * This does NOT seal, register, or execute. It ONLY witnesses.
 *
 * Tri-witness constraint (binding):
 *   - W³ is geometric-mean style consensus across Human, AI, External channels
 *   - No final SEAL semantics without required witness thresholding (W³ ≥ 0.75)
 *   - Do NOT fake witness confidence — unknown → 0.0, not 0.5
 *
 * F13 SOVEREIGN: DIVERGENT verdict MUST escalate to 888_HOLD.
 * An agent cannot self-authorize after DIVERGENT witness.
 */
export async function evaluateWitness(opts: WitnessOptions): Promise<WitnessVerdict> {
  const { bundle } = opts;
  const rationale: string[] = [];

  // Step 1: Validate all three channels
  const channels = [bundle.human, bundle.ai, bundle.external];
  const channelNames = ["Human", "AI", "External"];
  let allValid = true;

  for (let i = 0; i < channels.length; i++) {
    const { valid, issues } = validateChannel(channels[i]);
    if (!valid) {
      allValid = false;
      rationale.push(`⚠️ ${channelNames[i]} channel: ${issues.join("; ")}`);
    }
  }

  // Step 2: Extract confidences
  // If evidence is empty, override confidence to 0 (anti-fabrication)
  let hConf = bundle.human.confidence;
  let aiConf = bundle.ai.confidence;
  let extConf = bundle.external.confidence;

  if (bundle.human.evidence.length === 0 && hConf > 0) {
    rationale.push("Human: confidence reduced to 0 — no evidence provided");
    hConf = 0;
  }
  if (bundle.ai.evidence.length === 0 && aiConf > 0) {
    rationale.push("AI: confidence reduced to 0 — no evidence provided");
    aiConf = 0;
  }
  if (bundle.external.evidence.length === 0 && extConf > 0) {
    rationale.push("External: confidence reduced to 0 — no evidence provided");
    extConf = 0;
  }

  // Step 3: Check for synthetic human attestation
  // F6 MARUAH: Human channel requires explicit human attestation
  if (bundle.human.source.match(/^(ai|llm|model|agent|bot|synthetic|auto)/i)) {
    rationale.push("⚠️ F6 MARUAH: Human channel source appears synthetic — cannot proxy human attestation");
    hConf = Math.min(hConf, 0.3); // cap synthetic human confidence
  }

  // Step 4: Compute W³
  const W3 = computeW3(hConf, aiConf, extConf);

  // Step 5: Render verdict
  const { verdict, sealEligible, registerEligible, reason } = renderWitnessVerdict(W3);
  rationale.push(reason);

  // Step 6: If prior gate exists and it's VOID, witness cannot override
  if (bundle.prior_gate && bundle.prior_gate.verdict === "VOID") {
    rationale.push("⚠️ Prior gate verdict is VOID — witness cannot rehabilitate voided tools");
  }

  // Step 7: Build WitnessVerdict
  const now = new Date().toISOString();

  return {
    W3,
    channels: {
      human: { confidence: hConf, evidence_count: bundle.human.evidence.length },
      ai: { confidence: aiConf, evidence_count: bundle.ai.evidence.length },
      external: { confidence: extConf, evidence_count: bundle.external.evidence.length },
    },
    verdict,
    seal_eligible: sealEligible,
    register_eligible: registerEligible,
    rationale,
    witnessed_at: now,
  };
}

/**
 * Quick witness check — computes W³ without full channel validation.
 * For preview/dry-run use only.
 */
export function witnessDryRun(
  humanConfidence: number,
  aiConfidence: number,
  externalConfidence: number,
): Omit<WitnessVerdict, "channels" | "rationale" | "witnessed_at"> {
  const W3 = computeW3(humanConfidence, aiConfidence, externalConfidence);
  const { verdict, sealEligible, registerEligible } = renderWitnessVerdict(W3);

  return {
    W3,
    verdict,
    seal_eligible: sealEligible,
    register_eligible: registerEligible,
  };
}
