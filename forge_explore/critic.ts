/**
 * forge_explore — CRITIC Loop for FALSIFY (MODULE 4)
 * ====================================================
 * forge_id: FE-{2026.08.10}-001
 * module:   CRITIC (falsification engine)
 *
 * Implements the scientific loop:
 *   1. Actor generates a hypothesis or claim
 *   2. Tool-interactive critique (fetch, cross-source check, or
 *      arithmetic/logic check as applicable)
 *   3. Revise hypothesis
 *   4. Repeat until stopping criterion met
 *
 * STOPPING CRITERION ties directly to state.termination.evidence_threshold.
 *
 * FLOORS:
 *   F2  — every FALSIFY attempt appends to evidence[] with honest
 *         epistemic_label (CLAIM/PLAUSIBLE/HYPOTHESIS/ESTIMATE/UNKNOWN)
 *   F3  — every hypothesis traces to ≥1 citation (tri-witness)
 *   F7  — confidence caps at 0.90, baseline Ω₀ ∈ [0.03, 0.05]
 *   F9  — no hallucinated counter-evidence; cross-source check required
 *
 * USAGE:
 *   const result = await falsify(hypothesis, evidence, state);
 *   // result = { revisedHypothesis, confidenceDelta, verified }
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — structural skeleton. Cross-source tool calls
 *         deferred to Phase 2 (forge_search / forge_fetch integration).
 */

import type {
  ExplorationState,
  Hypothesis,
  EvidenceEntry,
  EpistemicLabel,
} from './state.ts';

// ===========================================================================
// CRITIC Result
// ===========================================================================

export interface CriticResult {
  /** Revised hypothesis statement */
  revisedHypothesis: Hypothesis;
  /** Change in confidence after critique */
  confidenceDelta: number;
  /** Whether the hypothesis was verified (confidence increased) */
  verified: boolean;
  /** Number of critique cycles run */
  cycles: number;
  /** New evidence entries from this critique */
  newEvidence: EvidenceEntry[];
}

// ===========================================================================
// Falsification step — per-hypothesis critique
// ===========================================================================

/**
 * Critique a single hypothesis against evidence.
 *
 * The critique flow:
 *   1. Search for counter-evidence (via forge_search)
 *   2. Cross-source check supporting evidence
 *   3. Logic/internal consistency check
 *   4. Revise confidence based on findings
 *
 * Phase 1: Heuristic critique — structural skeleton only.
 * Phase 2: Full tool-interactive critique with forge_search + forge_fetch.
 */
async function critiqueHypothesis(
  hypothesis: Hypothesis,
  evidence: EvidenceEntry[],
): Promise<{
  revisedStatement: string;
  confidenceDelta: number;
  newEvidence: EvidenceEntry[];
}> {
  // Phase 1 stub — structural pass-through with minimal heuristic

  let delta = 0;
  const newEvidence: EvidenceEntry[] = [];

  // Heuristic: if contradictingEvidence exists, reduce confidence
  if (hypothesis.contradictingEvidence.length > 0) {
    delta -= 0.05 * hypothesis.contradictingEvidence.length;
  }

  // Heuristic: if supportingEvidence exists and no contradictions, slight boost
  if (
    hypothesis.supportingEvidence.length > 0 &&
    hypothesis.contradictingEvidence.length === 0
  ) {
    delta += 0.02 * Math.min(hypothesis.supportingEvidence.length, 3);
  }

  return {
    revisedStatement: hypothesis.statement,
    confidenceDelta: delta,
    newEvidence,
  };
}

// ===========================================================================
// Main: falsify()
// ===========================================================================

/**
 * Run the CRITIC loop on a hypothesis.
 *
 * @param hypothesis — The hypothesis to test
 * @param evidence — Current evidence pool (for cross-reference)
 * @param state — Full exploration state (for context / termination signals)
 * @param maxCycles — Maximum critique iterations (default 3)
 * @param confidenceFloor — Minimum confidence before stopping (F7: 0.03)
 * @param confidenceCeiling — Maximum confidence (F7: 0.90)
 * @returns CriticResult with revised hypothesis and confidence delta
 */
export async function falsify(
  hypothesis: Hypothesis,
  evidence: EvidenceEntry[],
  state?: ExplorationState,
  maxCycles: number = 3,
  confidenceFloor: number = 0.03,
  confidenceCeiling: number = 0.90,
): Promise<CriticResult> {
  let currentHypothesis: Hypothesis = { ...hypothesis };
  let cycles = 0;
  const allNewEvidence: EvidenceEntry[] = [];

  while (cycles < maxCycles) {
    const { revisedStatement, confidenceDelta, newEvidence } =
      await critiqueHypothesis(currentHypothesis, evidence);

    // Apply confidence delta with F7 caps
    let newConfidence = currentHypothesis.confidence + confidenceDelta;
    newConfidence = Math.max(confidenceFloor, Math.min(confidenceCeiling, newConfidence));

    currentHypothesis = {
      ...currentHypothesis,
      statement: revisedStatement,
      confidence: newConfidence,
    };

    allNewEvidence.push(...newEvidence);
    cycles++;

    // F3: ensure ≥1 citation
    if (
      currentHypothesis.supportingEvidence.length === 0 &&
      currentHypothesis.contradictingEvidence.length === 0
    ) {
      // No evidence at all — insufficient for falsification; break
      break;
    }

    // Convergence: if confidence delta is negligible, stop
    if (Math.abs(confidenceDelta) < 0.01) {
      break;
    }
  }

  const verified = currentHypothesis.confidence > hypothesis.confidence;

  return {
    revisedHypothesis: currentHypothesis,
    confidenceDelta: currentHypothesis.confidence - hypothesis.confidence,
    verified,
    cycles,
    newEvidence: allNewEvidence,
  };
}

// ===========================================================================
// Batch falsification — run CRITIC on all active hypotheses
// ===========================================================================

/**
 * Run CRITIC loop on ALL active hypotheses in state.
 *
 * @returns Updated hypotheses array + new evidence entries.
 */
export async function falsifyAll(
  state: ExplorationState,
  maxCycles: number = 3,
): Promise<{
  revisedHypotheses: Hypothesis[];
  newEvidence: EvidenceEntry[];
}> {
  const revisedHypotheses: Hypothesis[] = [];
  const allNewEvidence: EvidenceEntry[] = [];

  for (const hypothesis of state.hypotheses) {
    const result = await falsify(hypothesis, state.evidence, state, maxCycles);
    revisedHypotheses.push(result.revisedHypothesis);
    allNewEvidence.push(...result.newEvidence);
  }

  return { revisedHypotheses, newEvidence: allNewEvidence };
}
