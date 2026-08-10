/**
 * forge_explore — SYNTHESIZE Node + GraphRAG Engine (MODULE 6 — part 2)
 * ======================================================================
 * forge_id: FE-{2026.08.10}-001
 * module:   SYNTHESIZE (evidence-grounded synthesis)
 *
 * Reads the exploration_graph (not raw page order) to produce a structured
 * synthesis output:
 *   - summary
 *   - findings[]
 *   - open_questions[]
 *   - contradictions[]
 *   - sources[]
 *   - exploration_receipt
 *
 * contradictions[] MUST be populated from edges of type "contradicts" —
 * do not silently drop conflicting evidence (F2).
 *
 * FLOORS:
 *   F2  — every finding carries epistemic_label; contradictions surfaced
 *   F3  — every finding traces to ≥1 source citation
 *   F6  — maruah-first: no synthesis that misrepresents source intent
 *   F9  — no hallucinated findings; all derived from actual evidence
 *   F13 — >2 unresolved contradictions → fresh 888 prompt
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — structural synthesis from in-memory graph.
 *         Phase 2: LLM-powered synthesis with structured prompt template.
 */

import type {
  ExplorationState,
  StateDelta,
  EvidenceEntry,
  ExplorationEdge,
  EpistemicLabel,
} from './state.ts';
import {
  getNodesByType,
  getContradictions,
  getGraphStats,
} from './evidence_graph.ts';

// ===========================================================================
// Synthesis Output Types
// ===========================================================================

export interface SynthesisFinding {
  finding: string;
  epistemicLabel: EpistemicLabel;
  supportingCitations: string[];
  confidence: number;
}

export interface SynthesisContradiction {
  claimA: string;
  claimB: string;
  sourceA: string;
  sourceB: string;
  resolution: 'UNRESOLVED' | 'RESOLVED_A' | 'RESOLVED_B' | 'RESOLVED_BOTH_FALSE';
}

export interface SynthesisOutput {
  summary: string;
  findings: SynthesisFinding[];
  openQuestions: string[];
  contradictions: SynthesisContradiction[];
  sources: string[];
  explorationReceipt: {
    totalPagesFetched: number;
    totalEvidence: number;
    totalHypotheses: number;
    depthReached: number;
    terminationReason: string;
    graphStats: ReturnType<typeof getGraphStats>;
    forgeId: string;
    timestamp: string;
  };
}

// ===========================================================================
// Build Sources List
// ===========================================================================

function buildSourcesList(state: ExplorationState): string[] {
  const sources = getNodesByType(state, 'source');
  return sources.map((s) => s.url ?? s.id).filter(Boolean);
}

// ===========================================================================
// Build Contradictions List
// ===========================================================================

function buildContradictionsList(state: ExplorationState): SynthesisContradiction[] {
  const contradictEdges = getContradictions(state);
  const contradictions: SynthesisContradiction[] = [];

  for (const edge of contradictEdges) {
    const fromNode = state.explorationGraph.nodes.find((n) => n.id === edge.from);
    const toNode = state.explorationGraph.nodes.find((n) => n.id === edge.to);

    contradictions.push({
      claimA: (fromNode?.metadata as Record<string, unknown>)?.fullClaim as string ?? fromNode?.label ?? edge.from,
      claimB: (toNode?.metadata as Record<string, unknown>)?.fullClaim as string ?? toNode?.label ?? edge.to,
      sourceA: fromNode?.url ?? edge.from,
      sourceB: toNode?.url ?? edge.to,
      resolution: 'UNRESOLVED',
    });
  }

  return contradictions;
}

// ===========================================================================
// Build Findings
// ===========================================================================

function buildFindings(state: ExplorationState): SynthesisFinding[] {
  const claims = getNodesByType(state, 'claim');
  return claims.map((c) => ({
    finding:
      ((c.metadata as Record<string, unknown>)?.fullClaim as string) ??
      c.label ??
      c.id,
    epistemicLabel:
      (((c.metadata as Record<string, unknown>)?.epistemicLabel as EpistemicLabel)) ??
      'UNKNOWN',
    supportingCitations: [c.id],
    confidence:
      ((c.metadata as Record<string, unknown>)?.confidence as number) ?? 0.5,
  }));
}

// ===========================================================================
// Build Open Questions
// ===========================================================================

function buildOpenQuestions(state: ExplorationState): string[] {
  const questions: string[] = [];

  // Unresolved contradictions → questions
  const contradictions = getContradictions(state);
  if (contradictions.length > 0) {
    questions.push(
      `${contradictions.length} unresolved contradiction(s) found — further investigation needed.`,
    );
  }

  // Hypotheses with low confidence → questions
  const lowConfidenceHyps = state.hypotheses.filter((h) => h.confidence < 0.3);
  for (const h of lowConfidenceHyps) {
    questions.push(`Low confidence (${h.confidence.toFixed(2)}): ${h.statement}`);
  }

  // Frontier not fully explored → question
  if (state.frontier.length > 0) {
    questions.push(
      `${state.frontier.length} URLs remain unexplored in frontier.`,
    );
  }

  return questions;
}

// ===========================================================================
// Main: synthesize()
// ===========================================================================

/**
 * Synthesize exploration results from the evidence graph.
 *
 * Reads the exploration_graph (NOT raw page order) and produces a
 * structured SynthesisOutput with findings, contradictions,
 * open questions, sources, and an exploration receipt.
 *
 * F2: contradictions MUST be populated from "contradicts" edges.
 * F6: do not misrepresent source intent.
 * F13: if >2 unresolved contradictions, caller must issue 888 prompt.
 */
export function synthesize(state: ExplorationState): SynthesisOutput {
  const sources = buildSourcesList(state);
  const contradictions = buildContradictionsList(state);
  const findings = buildFindings(state);
  const openQuestions = buildOpenQuestions(state);
  const graphStats = getGraphStats(state);

  // Build summary from findings
  const summaryParts: string[] = [];
  if (findings.length > 0) {
    summaryParts.push(`Exploration yielded ${findings.length} findings.`);
  }
  if (contradictions.length > 0) {
    summaryParts.push(
      `${contradictions.length} contradiction(s) detected and surfaced.`,
    );
  }
  if (openQuestions.length > 0) {
    summaryParts.push(`${openQuestions.length} open question(s) remain.`);
  }
  summaryParts.push(
    `Total: ${sources.length} sources, ${state.evidence.length} evidence entries, ` +
    `${state.hypotheses.length} hypotheses, depth=${state.depth.current}.`,
  );

  const summary = summaryParts.join(' ');

  return {
    summary,
    findings,
    openQuestions,
    contradictions,
    sources,
    explorationReceipt: {
      totalPagesFetched: sources.length,
      totalEvidence: state.evidence.length,
      totalHypotheses: state.hypotheses.length,
      depthReached: state.depth.current,
      terminationReason: state.termination.reason ?? 'UNKNOWN',
      graphStats,
      forgeId: 'FE-{2026.08.10}-001',
      timestamp: new Date().toISOString(),
    },
  };
}

// ===========================================================================
// synthesizeNode() — callable from graph.ts
// ===========================================================================

/**
 * SYNTHESIZE node function for the StateGraph.
 * Calls synthesize() and updates state with synthesized output in telemetry.
 */
export async function synthesizeNode(
  state: ExplorationState,
): Promise<StateDelta> {
  const output = synthesize(state);

  // Store synthesis output in state for audit
  // Phase 2: append to evidence[] as a SYNTHESIS entry
  return {
    telemetry: {
      ...state.telemetry,
      // Record synthesis metadata
      epoch: state.telemetry.epoch + 1,
    },
    termination: {
      ...state.termination,
      // Auto-set termination if synthesis is complete and contradictions resolved
      converged:
        output.contradictions.length === 0 && output.findings.length > 0,
    },
  };
}
