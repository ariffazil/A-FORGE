/**
 * forge_explore — Interoceptive Pre-Flight Gate (MODULE 3)
 * =========================================================
 * forge_id: FE-{2026.08.10}-001
 * module:   INTEROCEPTIVE GATE
 *
 * THE SHARPEST DIFFERENTIATOR. Insert BEFORE every SELECT → FOLLOW
 * transition (i.e. before any FETCH is dispatched to forge_browser_*).
 *
 * PROCEDURE (in order):
 *   1. Read arifOS kernel telemetry: confidence, dS, kappaR
 *      (NOT web content — internal state, not external sensing).
 *   2. IF confidence < threshold (default 0.15, F7 humility band
 *      0.03-0.15) → set termination.reason candidate, HOLD, do not follow.
 *   3. IF dS > 0 (entropy rising, violates F4 clarity) → HOLD,
 *      trigger reduce-entropy sub-step (re-summarize evidence) before
 *      allowing another FETCH.
 *   4. Compute G(a) per candidate frontier path using expected-free-energy
 *      style score:
 *        G(a) = KL[q(s)||p(s)] - E_q(s)[log p(o|s)]
 *      Phase 1: APPROXIMATE with confidence-consistency proxy.
 *      Phase 2: Full active inference FEP implementation.
 *   5. ONLY THEN dispatch FETCH to forge_browser_*.
 *
 * THIS NODE MUST EMIT A SPAN (Module 2) recording which branch fired
 * (pass / hold / reduce).
 *
 * FLOORS:
 *   F4  — dS ≤ 0 enforced here
 *   F7  — confidence threshold inside [0.03, 0.15]
 *   F11 — gate decision logged via emitGateSpan
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — confidence proxy, not full FEP G(a).
 */

import type { ExplorationState, StateDelta, FrontierEntry } from './state.ts';
import { emitGateSpan } from './telemetry.ts';

// ===========================================================================
// Configuration
// ===========================================================================

export interface GateConfig {
  /** Confidence threshold — MUST sit in [0.03, 0.15] per F7 */
  confidenceThreshold: number;
  /** Entropy ceiling — if dS > 0, HOLD per F4 */
  entropyCeiling: number;
  /** Enable G(a) approximation (Phase 1: simple consistency check) */
  enableGA: boolean;
  /** Max frontier candidates to evaluate per cycle */
  maxCandidates: number;
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  confidenceThreshold: 0.15,
  entropyCeiling: 0,
  enableGA: true,
  maxCandidates: 5,
};

// ===========================================================================
// Gate Result
// ===========================================================================

export type GateDecision = 'PASS' | 'HOLD' | 'REDUCE' | 'F13_HOLD';

export interface GateResult {
  decision: GateDecision;
  reason: string;
  /** Which frontier entry passed the gate (if PASS) */
  approvedEntry?: FrontierEntry;
  /** G(a) score for approved entry (Phase 1: approximated) */
  gaScore?: number;
  /** Span emitted by this gate decision */
  spanEmitted: boolean;
}

// ===========================================================================
// Step 1: Read kernel telemetry
// ===========================================================================

/**
 * Reads current telemetry snapshot from state.
 * Phase 1: Reads from ExplorationState.telemetry (in-process).
 * Phase 2: Probe arifOS kernel via arif_observe for live telemetry.
 */
function readKernelTelemetry(state: ExplorationState): {
  confidence: number;
  dS: number;
  kappaR: number;
} {
  // Phase 1: in-process read from state
  // Phase 2: curl -sf http://127.0.0.1:8088/health → .thermodynamic
  return {
    confidence: state.telemetry.confidence,
    dS: state.telemetry.dS,
    kappaR: state.telemetry.kappaR,
  };
}

// ===========================================================================
// Step 2: Confidence gate (F7)
// ===========================================================================

/**
 * Checks if confidence is above threshold.
 * F7: threshold MUST be inside [0.03, 0.15].
 */
function checkConfidence(
  confidence: number,
  threshold: number,
): { passed: boolean; reason: string } {
  if (confidence < threshold) {
    return {
      passed: false,
      reason: `CONFIDENCE_BELOW_THRESHOLD: confidence=${confidence} < threshold=${threshold}. F7 humility gate triggered.`,
    };
  }
  return { passed: true, reason: '' };
}

// ===========================================================================
// Step 3: Entropy gate (F4)
// ===========================================================================

/**
 * Checks if entropy is rising (dS > 0).
 * F4: dS ≤ 0 on every output. If rising → HOLD, reduce-entropy.
 */
function checkEntropy(dS: number): {
  passed: boolean;
  reason: string;
} {
  if (dS > 0) {
    return {
      passed: false,
      reason: `ENTROPY_RISING: dS=${dS} > 0. F4 clarity gate triggered. Trigger reduce-entropy sub-step (re-summarize evidence).`,
    };
  }
  return { passed: true, reason: '' };
}

// ===========================================================================
// Step 4: Approximate G(a) — Expected Free Energy proxy
// ===========================================================================

/**
 * Phase 1 approximation of G(a) = KL[q(s)||p(s)] - E_q(s)[log p(o|s)].
 *
 * Heuristic proxy:
 *   ga ≈ (priorityScore × sourceNovelty × confidence) / (1 + visitedPenalty)
 *
 * This is NOT the full FEP implementation. It is a cheap consistency check
 * that approximates the information-thermodynamic trade-off.
 *
 * @phase Phase 1 — heuristic proxy. Full FEP G(a) deferred to Phase 2.
 * @see  GENESIS/012 — active inference architecture requirement
 */
function approximateGA(
  entry: FrontierEntry,
  state: ExplorationState,
): number {
  // Phase 1 proxy:
  const priorityBonus = entry.priorityScore;
  const noveltyBonus = state.visited.has(entry.url) ? 0.1 : 1.0;
  const confidenceSignal = Math.max(state.telemetry.confidence, 0.03); // floor at Ω₀
  const visitedPenalty = state.visited.size * 0.05;

  return (priorityBonus * noveltyBonus * confidenceSignal) / (1 + visitedPenalty);
}

// ===========================================================================
// Step 5: Dispatch decision
// ===========================================================================

/**
 * Main interoceptive gate function.
 *
 * Called BEFORE every SELECT → FOLLOW transition.
 * Returns GateResult with decision (PASS/HOLD/REDUCE/F13_HOLD).
 *
 * @param state — Current exploration state
 * @param config — Gate configuration (defaults to F7-compliant thresholds)
 * @param candidates — Top N frontier entries to evaluate
 */
export async function interoceptiveGate(
  state: ExplorationState,
  config: GateConfig = DEFAULT_GATE_CONFIG,
  candidates?: FrontierEntry[],
): Promise<GateResult> {
  const tel = readKernelTelemetry(state);
  const entries = candidates ?? state.frontier.slice(0, config.maxCandidates);

  // STEP 2: Confidence gate
  const confCheck = checkConfidence(tel.confidence, config.confidenceThreshold);
  if (!confCheck.passed) {
    emitGateSpan('HOLD', confCheck.reason, state.telemetry);
    return {
      decision: 'HOLD',
      reason: confCheck.reason,
      spanEmitted: true,
    };
  }

  // STEP 3: Entropy gate
  const entCheck = checkEntropy(tel.dS);
  if (!entCheck.passed) {
    emitGateSpan('REDUCE', entCheck.reason, state.telemetry);
    return {
      decision: 'REDUCE',
      reason: entCheck.reason,
      spanEmitted: true,
    };
  }

  // STEP 4: G(a) scoring
  let bestEntry: FrontierEntry | undefined;
  let bestGA = -Infinity;

  if (config.enableGA && entries.length > 0) {
    for (const entry of entries) {
      const ga = approximateGA(entry, state);
      if (ga > bestGA) {
        bestGA = ga;
        bestEntry = entry;
      }
    }
  } else if (entries.length > 0) {
    bestEntry = entries[0];
  }

  // STEP 5 — F13 DEPTH GATE: FOLLOW past depth 3 → fresh 888 prompt
  if (state.depth.current >= 3) {
    const reason = `F13_DEPTH_GATE: depth.current=${state.depth.current} >= 3. Fresh 888 prompt required before further FOLLOW.`;
    emitGateSpan('F13_HOLD', reason, state.telemetry);
    return {
      decision: 'F13_HOLD',
      reason,
      spanEmitted: true,
    };
  }

  if (!bestEntry) {
    emitGateSpan('HOLD', 'FRONTIER_EMPTY: no candidates to evaluate', state.telemetry);
    return {
      decision: 'HOLD',
      reason: 'FRONTIER_EMPTY: no candidates to evaluate.',
      spanEmitted: true,
    };
  }

  // STEP 5: PASS — dispatch FETCH allowed
  emitGateSpan('PASS', `gate passed. bestEntry=${bestEntry.url} ga=${bestGA}`, state.telemetry);
  return {
    decision: 'PASS',
    reason: `Gate passed. Best entry: ${bestEntry.url} (ga=${bestGA?.toFixed(4)})`,
    approvedEntry: bestEntry,
    gaScore: bestGA,
    spanEmitted: true,
  };
}

// ===========================================================================
// Reduce-Entropy Sub-Step (called on REDUCE decision)
// ===========================================================================

/**
 * When dS > 0, this sub-step re-summarizes evidence to compress state
 * before allowing another FETCH.
 *
 * F4: reduce entropy → ΔS ≤ 0.
 *
 * Phase 1: Simple deduplication of evidence entries.
 * Phase 2: LLM-powered semantic compression of evidence[] + hypotheses[].
 */
export async function reduceEntropy(
  state: ExplorationState,
): Promise<StateDelta> {
  // Phase 1 stub: deduplicate evidence by citation
  const seen = new Set<string>();
  const deduped = state.evidence.filter((e) => {
    const key = `${e.citation}:${e.finding.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const removedCount = state.evidence.length - deduped.length;

  return {
    evidence: deduped,
    telemetry: {
      ...state.telemetry,
      dS: Math.max(state.telemetry.dS - removedCount * 0.01, -1), // simulate entropy reduction
    },
  };
}
