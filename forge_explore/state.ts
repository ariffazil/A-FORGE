/**
 * forge_explore — Canonical State Schema
 * ======================================
 * forge_id: FE-{2026.08.10}-001
 * module: STATE (substrate)
 * constitutional: F1–F13 enforced via arifOS kernel
 *
 * This file defines the immutable state shape for the forge_explore
 * constitutional exploration runtime. Every node in the StateGraph
 * returns a partial state delta; the graph merges deltas.
 *
 * DO NOT MUTATE state in place. Return { ...state, changedField: newValue }.
 *
 * Floors touched:
 *   F2  — every EvidenceEntry carries epistemic_label
 *   F4  — dS tracked live, gate enforced in interoceptive_gate
 *   F7  — confidence bands 0.03–0.15, capped at 0.90
 *   F9  — no hallucinated URLs; frontier entries MUST originate from SEARCH/EXTRACT_LINKS
 *   F11 — telemetry audit trail via OTel spans
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @sealed false (Phase 1 scaffold — reversible draft)
 */

// ---------------------------------------------------------------------------
// Epichemic Labels (F2 TRUTH)
// ---------------------------------------------------------------------------

/** Epistemic label per F2 TRUTH — every claim MUST carry one. */
export type EpistemicLabel =
  | 'CLAIM'       // ≥ 0.85 confidence, multi-source verified
  | 'PLAUSIBLE'   // 0.50–0.85, one strong source
  | 'HYPOTHESIS'  // 0.20–0.50, speculative but grounded
  | 'ESTIMATE'    // 0.10–0.20, rough heuristic
  | 'UNKNOWN';    // < 0.10, explicitly unknown

// ---------------------------------------------------------------------------
// Core State Types
// ---------------------------------------------------------------------------

export type TerminationReason =
  | 'FRONTIER_EMPTY'
  | 'CONVERGENCE'
  | 'DEPTH_LIMIT'
  | 'EVIDENCE_THRESHOLD';

export type NodeType = 'source' | 'claim' | 'hypothesis';
export type EdgeType = 'supports' | 'contradicts' | 'references';

// ---------------------------------------------------------------------------
// State Sub-Objects
// ---------------------------------------------------------------------------

export interface FrontierEntry {
  /** Absolute URL (from SEARCH or EXTRACT_LINKS — never hallucinated) */
  url: string;
  /** Priority score [0, 1] — higher = explore first */
  priorityScore: number;
  /** Source node id in exploration_graph that generated this frontier entry */
  sourceNodeId?: string;
}

export interface EvidenceEntry {
  /** The factual finding */
  finding: string;
  /** Source URL or reference identifier */
  citation: string;
  /** Epistemic label per F2 — NEVER unlabeled */
  epistemicLabel: EpistemicLabel;
  /** ISO timestamp of evidence capture */
  capturedAt?: string;
}

export interface Hypothesis {
  /** The hypothesis statement */
  statement: string;
  /** Confidence [0, 1] — F7 bands: Ω₀ ∈ [0.03, 0.05], cap 0.90 */
  confidence: number;
  /** References to evidence[] entries that support this hypothesis */
  supportingEvidence: string[];
  /** References to evidence[] entries that contradict this hypothesis */
  contradictingEvidence: string[];
}

export interface ExplorationNode {
  id: string;
  type: NodeType;
  label?: string;
  url?: string; // for 'source' nodes
  metadata?: Record<string, unknown>;
}

export interface ExplorationEdge {
  from: string;
  to: string;
  type: EdgeType;
  weight?: number;
}

export interface Telemetry {
  /** Monotonic step counter */
  epoch: number;
  /** Entropy delta — F4: must be ≤ 0 */
  dS: number;
  /** Peace² metric — F5 */
  peace2: number;
  /** Resilience index — F12 */
  kappaR: number;
  /** Shadow score — F9 anti-hantu */
  shadow: number;
  /** Aggregate confidence */
  confidence: number;
  /** Psychological safety / LE index */
  psiLe: number;
  /** Constitutional verdict from kernel */
  verdict: string;
  /** Tri-witness: human, AI, earth */
  witness: { human: number; ai: number; earth: number };
  /** Quality-diversity fitness */
  qdf: number;
}

// ---------------------------------------------------------------------------
// Master State
// ---------------------------------------------------------------------------

export interface ExplorationState {
  /** Initial query that seeded exploration */
  seedQuery: string;
  /** Priority-ranked frontier of URLs to explore */
  frontier: FrontierEntry[];
  /** Set of already-visited URLs (no cycles — Module 5 enforces) */
  visited: Set<string>;
  /** Current and maximum exploration depth */
  depth: { current: number; max: number };
  /** Accumulated evidence entries */
  evidence: EvidenceEntry[];
  /** Active hypotheses under test */
  hypotheses: Hypothesis[];
  /** Accumulating evidence graph for SYNTHESIZE (Module 6) */
  explorationGraph: {
    nodes: ExplorationNode[];
    edges: ExplorationEdge[];
  };
  /** Termination state — checked by check_stop node */
  termination: {
    reason: TerminationReason | null;
    converged: boolean;
  };
  /** Live telemetry snapshot (updated by interoceptive gate) */
  telemetry: Telemetry;
}

// ---------------------------------------------------------------------------
// Default / Seed State
// ---------------------------------------------------------------------------

export const DEFAULT_TELEMETRY: Telemetry = {
  epoch: 0,
  dS: 0,
  peace2: 1.0,
  kappaR: 1.0,
  shadow: 0,
  confidence: 0.15, // F7 humility band lower bound
  psiLe: 1.0,
  verdict: 'PASS',
  witness: { human: 0.42, ai: 0.99, earth: 0.99 },
  qdf: 0.5,
};

export function createSeedState(query: string, maxDepth: number = 4): ExplorationState {
  return {
    seedQuery: query,
    frontier: [],
    visited: new Set(),
    depth: { current: 0, max: maxDepth },
    evidence: [],
    hypotheses: [],
    explorationGraph: { nodes: [], edges: [] },
    termination: { reason: null, converged: false },
    telemetry: { ...DEFAULT_TELEMETRY },
  };
}

// ---------------------------------------------------------------------------
// State Delta (returned by each node)
// ---------------------------------------------------------------------------

/** Partial state — each node function returns ONLY what it changed. */
export type StateDelta = Partial<ExplorationState>;
