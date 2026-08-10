/**
 * forge_explore — GraphRAG Evidence Graph (MODULE 6 — part 1)
 * =============================================================
 * forge_id: FE-{2026.08.10}-001
 * module:   EVIDENCE GRAPH (knowledge graph substrate for SYNTHESIZE)
 *
 * Builds exploration_graph incrementally as evidence accumulates.
 *
 * GRAPH SCHEMA:
 *   Nodes:
 *     - source:     a fetched web page (url, title, domain)
 *     - claim:      a factual claim extracted from a source
 *     - hypothesis: a generated hypothesis under test
 *
 *   Edges:
 *     - supports:     evidence supports the claim/hypothesis
 *     - contradicts:  evidence contradicts the claim/hypothesis
 *     - references:   source→claim or source→hypothesis link
 *
 * FLOORS:
 *   F2  — every node type is explicit; no untyped nodes
 *   F3  — tri-witness: hypothesis must trace to ≥1 source
 *   F9  — no hallucinated nodes; all must originate from actual evidence
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — in-memory graph. Phase 2: persist to FalkorDB
 *         (L5 Graphiti memory tier) for cross-session recall.
 */

import type {
  ExplorationState,
  ExplorationNode,
  ExplorationEdge,
  EvidenceEntry,
  Hypothesis,
  NodeType,
  EdgeType,
  StateDelta,
} from './state.ts';

// ===========================================================================
// Node ID Generation
// ===========================================================================

let _nodeCounter = 0;

function nextNodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_nodeCounter}`;
}

// ===========================================================================
// Add Source Node
// ===========================================================================

/**
 * Adds a 'source' node for a fetched URL.
 * Call from FETCH node after successful page read.
 */
export function addSourceNode(
  state: ExplorationState,
  url: string,
  label?: string,
): ExplorationNode {
  const node: ExplorationNode = {
    id: nextNodeId('src'),
    type: 'source',
    label: label ?? url,
    url,
  };

  state.explorationGraph.nodes.push(node);
  return node;
}

// ===========================================================================
// Add Claim Node
// ===========================================================================

/**
 * Adds a 'claim' node for a factual extraction from a source.
 * Call from EXTRACT_LINKS / FETCH when extracting claims.
 */
export function addClaimNode(
  state: ExplorationState,
  claim: string,
  sourceNodeId: string,
  epistemicLabel: string,
): ExplorationNode {
  const node: ExplorationNode = {
    id: nextNodeId('claim'),
    type: 'claim',
    label: claim.slice(0, 80),
    metadata: {
      fullClaim: claim,
      epistemicLabel,
      sourceNodeId,
    },
  };

  state.explorationGraph.nodes.push(node);

  // Auto-create 'references' edge from source to claim
  addEdge(state, sourceNodeId, node.id, 'references');

  return node;
}

// ===========================================================================
// Add Hypothesis Node
// ===========================================================================

/**
 * Adds a 'hypothesis' node.
 * Call from CRITIC / SYNTHESIZE when generating hypotheses.
 */
export function addHypothesisNode(
  state: ExplorationState,
  hypothesis: Hypothesis,
): ExplorationNode {
  const node: ExplorationNode = {
    id: nextNodeId('hyp'),
    type: 'hypothesis',
    label: hypothesis.statement.slice(0, 80),
    metadata: {
      fullStatement: hypothesis.statement,
      confidence: hypothesis.confidence,
    },
  };

  state.explorationGraph.nodes.push(node);

  // Create 'supports' edges for supporting evidence
  for (const evidenceRef of hypothesis.supportingEvidence) {
    addEdge(state, evidenceRef, node.id, 'supports');
  }

  // Create 'contradicts' edges for contradicting evidence
  for (const evidenceRef of hypothesis.contradictingEvidence) {
    addEdge(state, evidenceRef, node.id, 'contradicts');
  }

  return node;
}

// ===========================================================================
// Add Edge
// ===========================================================================

/**
 * Adds an edge between two nodes.
 * Deduplicates: if edge already exists, updates weight.
 */
export function addEdge(
  state: ExplorationState,
  from: string,
  to: string,
  type: EdgeType,
  weight: number = 1.0,
): ExplorationEdge {
  // Deduplicate
  const existing = state.explorationGraph.edges.find(
    (e) => e.from === from && e.to === to && e.type === type,
  );
  if (existing) {
    existing.weight = (existing.weight ?? 1.0) + weight;
    return existing;
  }

  const edge: ExplorationEdge = { from, to, type, weight };
  state.explorationGraph.edges.push(edge);
  return edge;
}

// ===========================================================================
// Graph Queries (for SYNTHESIZE)
// ===========================================================================

/**
 * Returns all nodes of a given type.
 */
export function getNodesByType(
  state: ExplorationState,
  type: NodeType,
): ExplorationNode[] {
  return state.explorationGraph.nodes.filter((n) => n.type === type);
}

/**
 * Returns all edges of a given type.
 */
export function getEdgesByType(
  state: ExplorationState,
  type: EdgeType,
): ExplorationEdge[] {
  return state.explorationGraph.edges.filter((e) => e.type === type);
}

/**
 * Returns all contradiction edges — MUST be surfaced in SYNTHESIZE output.
 * Do not silently drop conflicting evidence (F2).
 */
export function getContradictions(state: ExplorationState): ExplorationEdge[] {
  return getEdgesByType(state, 'contradicts');
}

/**
 * Returns neighbor nodes for a given node (traverses edges in both directions).
 */
export function getNeighbors(
  state: ExplorationState,
  nodeId: string,
): ExplorationNode[] {
  const neighborIds = new Set<string>();
  for (const edge of state.explorationGraph.edges) {
    if (edge.from === nodeId) neighborIds.add(edge.to);
    if (edge.to === nodeId) neighborIds.add(edge.from);
  }
  return state.explorationGraph.nodes.filter((n) => neighborIds.has(n.id));
}

// ===========================================================================
// Graph Statistics
// ===========================================================================

export interface GraphStats {
  totalNodes: number;
  sourceCount: number;
  claimCount: number;
  hypothesisCount: number;
  supportEdgeCount: number;
  contradictEdgeCount: number;
  referenceEdgeCount: number;
  orphanNodeCount: number;
}

/**
 * Computes summary statistics for the evidence graph.
 */
export function getGraphStats(state: ExplorationState): GraphStats {
  const nodes = state.explorationGraph.nodes;
  const edges = state.explorationGraph.edges;

  const nodesWithEdges = new Set<string>();
  for (const edge of edges) {
    nodesWithEdges.add(edge.from);
    nodesWithEdges.add(edge.to);
  }

  return {
    totalNodes: nodes.length,
    sourceCount: nodes.filter((n) => n.type === 'source').length,
    claimCount: nodes.filter((n) => n.type === 'claim').length,
    hypothesisCount: nodes.filter((n) => n.type === 'hypothesis').length,
    supportEdgeCount: edges.filter((e) => e.type === 'supports').length,
    contradictEdgeCount: edges.filter((e) => e.type === 'contradicts').length,
    referenceEdgeCount: edges.filter((e) => e.type === 'references').length,
    orphanNodeCount: nodes.filter((n) => !nodesWithEdges.has(n.id)).length,
  };
}
