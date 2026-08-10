/**
 * forge_explore — StateGraph Skeleton (MODULE 1)
 * ===============================================
 * forge_id: FE-{2026.08.10}-001
 * module:   GRAPH (substrate)
 *
 * Implements a LangGraph-style directed state graph for the constitutional
 * exploration loop. Each node is a pure function f(state) → partial_state.
 * Edges are conditional routes. The graph merges deltas.
 *
 * NODE SEQUENCE:
 *   SEED → SEARCH → FETCH → EXTRACT_LINKS → SCORE → SELECT →
 *     ┌─ FOLLOW → SYNTHESIZE ─┐
 *     │                        ↓
 *     └──────────←────── check_stop
 *                              ↓ (if terminated)
 *                            [END]
 *
 * The RECURSIVE loop (OBSERVE→HYPOTHESIZE→FALSIFY→VERIFY→PRIORITIZE_NEXT_PATH)
 * is embedded within SCORE→SELECT→FOLLOW. See critic.ts for FALSIFY (Module 4).
 *
 * Constitutional gates:
 *   F1  — all mutations are reversible; graph is pure-functional
 *   F4  — dS tracked in telemetry; gate in interoceptive_gate.ts
 *   F7  — confidence caps applied in select node
 *   F11 — every transition emits OTel span (telemetry.ts Module 2)
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — StateGraph not yet connected to LangGraph runtime.
 *         Current stub uses manual dispatch. Full LangGraph integration
 *         (langgraph-js or custom evented graph) deferred to Phase 2.
 */

import type {
  ExplorationState,
  StateDelta,
  FrontierEntry,
  EvidenceEntry,
  Hypothesis,
  EpistemicLabel,
} from './state.ts';
import { DEFAULT_TELEMETRY } from './state.ts';
import { getAdapters, type SearchResult, type FetchedPage } from './adapters.ts';
import { evaluateGuardrails } from './guardrails.ts';

// ===========================================================================
// Type: Node Function
// ===========================================================================

/** Signature of every node function in the graph. */
export type GraphNode = (state: ExplorationState) => Promise<StateDelta>;

// ===========================================================================
// Type: Conditional Edge
// ===========================================================================

/** Decision function for conditional routing. Returns next node name. */
export type ConditionalEdge = (state: ExplorationState) => string;

// ===========================================================================
// NODE 1: SEED — Initialize state from query
// ===========================================================================

/**
 * SEED node. Bootstraps the exploration state from a user query.
 * Resets telemetry, clears frontier, sets seedQuery.
 *
 * NOTE: In MVP this is called once at graph start. For re-seeding
 * mid-exploration, create a new state via createSeedState().
 */
export async function seedNode(state: ExplorationState): Promise<StateDelta> {
  // Phase 1 stub — pass-through with epoch bump
  return {
    telemetry: {
      ...state.telemetry,
      epoch: state.telemetry.epoch + 1,
    },
  };
}

// ===========================================================================
// NODE 2: SEARCH — Query web via forge_search / forge_research
// ===========================================================================

/**
 * SEARCH node. Dispatches a governed search (forge_search / forge_research)
 * and populates frontier with ranked results.
 *
 * TOOL: forge_search(query=state.seedQuery, count=10, synthesize=true)
 * OR:    forge_research(query=state.seedQuery, depth=3)
 *
 * F9: Every frontier URL MUST originate from search results — never fabricate.
 */
export async function searchNode(state: ExplorationState): Promise<StateDelta> {
  const adapters = getAdapters();
  const searchAdapter = adapters.search;

  if (!searchAdapter) {
    console.warn('[forge_explore:SEARCH] No search adapter configured. Returning empty frontier.');
    return { frontier: [] };
  }

  console.log(`[forge_explore:SEARCH] Dispatching query via ${searchAdapter.name}: "${state.seedQuery}"`);
  const results: SearchResult[] = await searchAdapter.search(state.seedQuery, 10);

  const frontier: FrontierEntry[] = results.map((r) => ({
    url: r.url,
    priorityScore: r.priorityScore,
    sourceNodeId: undefined, // source node created in FETCH
  }));

  console.log(`[forge_explore:SEARCH] ${frontier.length} results on frontier.`);
  return { frontier };
}

// ===========================================================================
// NODE 3: FETCH — Read highest-priority unvisited URL
// ===========================================================================

/**
 * FETCH node. Reads the highest-priority unvisited URL via forge_fetch
 * (or forge_browser_navigate for JS-heavy pages).
 *
 * Gate: interoceptive_gate.ts fires BEFORE this node (see Module 3).
 * F13: Any FETCH beyond depth 3 triggers a fresh 888 prompt.
 */
export async function fetchNode(state: ExplorationState): Promise<StateDelta> {
  const adapters = getAdapters();
  const fetchAdapter = adapters.fetch;
  const extractAdapter = adapters.extract;

  // Pick highest-priority unvisited URL from frontier
  const nextUrl = state.frontier
    .filter((f) => !state.visited.has(f.url))
    .sort((a, b) => b.priorityScore - a.priorityScore)[0];

  if (!nextUrl) {
    console.log('[forge_explore:FETCH] No unvisited URLs in frontier.');
    return {};
  }

  // Guardrails: check before fetching
  const guardResult = evaluateGuardrails('forge_fetch', { url: nextUrl.url }, state);
  if (!guardResult.passed) {
    console.warn(`[forge_explore:FETCH] GUARDRAIL BLOCKED: ${guardResult.failures.map((f) => f.reason).join('; ')}`);
    // Remove blocked URL from frontier
    return {
      frontier: state.frontier.filter((f) => f.url !== nextUrl.url),
    };
  }

  if (!fetchAdapter) {
    console.warn('[forge_explore:FETCH] No fetch adapter configured. Skipping.');
    return {};
  }

  console.log(`[forge_explore:FETCH] Fetching via ${fetchAdapter.name}: ${nextUrl.url}`);
  let page: FetchedPage;
  try {
    page = await fetchAdapter.fetch(nextUrl.url, 50000);
  } catch (err) {
    console.error(`[forge_explore:FETCH] Fetch failed for ${nextUrl.url}: ${err}`);
    // Remove failed URL from frontier, mark visited so we don't retry
    const newVisited = new Set(state.visited);
    newVisited.add(nextUrl.url);
    return {
      frontier: state.frontier.filter((f) => f.url !== nextUrl.url),
      visited: newVisited,
    };
  }

  // Extract links from fetched content
  let links: string[] = page.links ?? [];
  if (links.length === 0 && extractAdapter) {
    links = extractAdapter.extractLinks(page.content, page.url);
  }

  // Create new frontier entries from extracted links
  const newFrontierEntries: FrontierEntry[] = links
    .filter((link) => !state.visited.has(link))
    .map((link) => ({
      url: link,
      priorityScore: 0.5, // initial score; SCORE node will re-rank
      sourceNodeId: nextUrl.url,
    }));

  // Add fetched URL to visited
  const newVisited = new Set(state.visited);
  newVisited.add(nextUrl.url);

  // Remove fetched URL from frontier
  const remainingFrontier = state.frontier.filter((f) => f.url !== nextUrl.url);

  return {
    frontier: [...remainingFrontier, ...newFrontierEntries],
    visited: newVisited,
  };
}

// ===========================================================================
// NODE 4: EXTRACT_LINKS — Parse outbound links from fetched content
// ===========================================================================

/**
 * EXTRACT_LINKS node. Parses fetched HTML/markdown for outbound links,
 * deduplicates against visited set, and adds to frontier.
 *
 * F9: Extracted links MUST come from actual page content. Never hallucinate URLs.
 */
export async function extractLinksNode(state: ExplorationState): Promise<StateDelta> {
  // Phase 1 stub
  return {};
}

// ===========================================================================
// NODE 5: SCORE — Rank frontier by expected information gain
// ===========================================================================

/**
 * SCORE node. Re-ranks frontier entries by priority score.
 *
 * Scoring heuristics (Phase 1 simplification):
 *   1. Domain relevance match
 *   2. Source authority signal
 *   3. Semantic distance from seed query
 *   4. Novelty bonus (not in visited set)
 *
 * Phase 2: Replace with G(a) = KL[q(s)||p(s)] - E_q(s)[log p(o|s)]
 *          (active inference, FEP-derived).
 */
export async function scoreNode(state: ExplorationState): Promise<StateDelta> {
  // Phase 1 stub — sort frontier by priorityScore descending
  const sorted = [...state.frontier].sort(
    (a, b) => b.priorityScore - a.priorityScore
  );
  return { frontier: sorted };
}

// ===========================================================================
// NODE 6: SELECT — Choose next URL to explore
// ===========================================================================

/**
 * SELECT node. Picks the highest-priority unvisited URL from frontier.
 *
 * BEFORE selecting, the interoceptive gate (Module 3) fires:
 *   1. Read telemetry: confidence, dS, kappaR
 *   2. If confidence < 0.15 → HOLD, set termination
 *   3. If dS > 0 → HOLD, reduce-entropy sub-step
 *   4. Approximate G(a) per candidate
 *   5. Dispatch FETCH (only if gates pass)
 *
 * F7: Confidence threshold MUST sit in [0.03, 0.15].
 * F13: FOLLOW past depth 3 → fresh 888 prompt.
 */
export async function selectNode(state: ExplorationState): Promise<StateDelta> {
  // Phase 1 stub — delegate to interoceptive gate
  // Actual logic: call interoceptiveGate(state) before proceeding
  return {};
}

// ===========================================================================
// NODE 7: FOLLOW — Navigate to selected URL
// ===========================================================================

/**
 * FOLLOW node. Navigates browser to selected URL via forge_browser_navigate.
 *
 * Gate: Module 5 (guardrails) intercepts BEFORE execution.
 *        - Block any FOLLOW to already-visited URL
 *        - Block any FETCH beyond depth.max
 *        - Block any SELECT that bypassed interoceptive gate
 *
 * Increments depth.current.
 * Adds URL to visited set.
 */
export async function followNode(state: ExplorationState): Promise<StateDelta> {
  const adapters = getAdapters();

  // Pick the highest-priority unvisited URL from frontier
  const nextUrl = state.frontier
    .filter((f) => !state.visited.has(f.url))
    .sort((a, b) => b.priorityScore - a.priorityScore)[0];

  if (!nextUrl) {
    console.log('[forge_explore:FOLLOW] No unvisited URLs to follow.');
    return {};
  }

  // Guardrails
  const guardResult = evaluateGuardrails('forge_browser_navigate', { url: nextUrl.url }, state);
  if (!guardResult.passed) {
    console.warn(`[forge_explore:FOLLOW] GUARDRAIL BLOCKED: ${guardResult.failures.map((f) => f.reason).join('; ')}`);
    return {
      frontier: state.frontier.filter((f) => f.url !== nextUrl.url),
    };
  }

  const nextDepth = state.depth.current + 1;
  const newVisited = new Set(state.visited);
  newVisited.add(nextUrl.url);

  console.log(`[forge_explore:FOLLOW] Following ${nextUrl.url} at depth ${nextDepth}`);

  return {
    depth: { ...state.depth, current: nextDepth },
    visited: newVisited,
    frontier: state.frontier.filter((f) => f.url !== nextUrl.url),
  };
}

// ===========================================================================
// NODE 8: SYNTHESIZE — Produce evidence-grounded summary
// ===========================================================================

/**
 * SYNTHESIZE node. Reads the exploration_graph (Module 6), not raw page order.
 *
 * Output structure:
 *   summary, findings[], open_questions[], contradictions[], sources[],
 *   exploration_receipt
 *
 * contradictions[] MUST be populated from edges of type "contradicts" —
 * do not silently drop conflicting evidence (F2).
 *
 * F6: No synthesis output that misrepresents source intent (maruah-first).
 * F13: SYNTHESIZE with >2 unresolved contradictions → fresh 888 prompt.
 */
export async function synthesizeNode(state: ExplorationState): Promise<StateDelta> {
  // Phase 1 stub — delegates to synthesize.ts (Module 6)
  return {};
}

// ===========================================================================
// NODE 9: CHECK_STOP — Termination condition
// ===========================================================================

/**
 * CHECK_STOP node. Evaluates termination conditions:
 *   1. frontier_empty → FRONTIER_EMPTY
 *   2. Evidence confidence > threshold → EVIDENCE_THRESHOLD / converged
 *   3. depth.current >= depth.max → DEPTH_LIMIT
 *
 * If NOT terminated: route back to SELECT (loop).
 * If terminated: route to END.
 */
export async function checkStopNode(state: ExplorationState): Promise<StateDelta> {
  let reason: import('./state.ts').TerminationReason | null = null;
  let converged = false;

  if (state.frontier.length === 0) {
    reason = 'FRONTIER_EMPTY';
  } else if (state.depth.current >= state.depth.max) {
    reason = 'DEPTH_LIMIT';
  }

  return {
    termination: { reason, converged },
  };
}

// ===========================================================================
// CONDITIONAL EDGE: route after check_stop
// ===========================================================================

/**
 * Routes from check_stop back to SELECT (continue loop) or to END (terminate).
 */
export function checkStopRoute(state: ExplorationState): string {
  if (state.termination.reason) {
    return 'END';
  }
  return 'SELECT';
}

// ===========================================================================
// NODE REGISTRY
// ===========================================================================

/** All node functions, keyed by canonical name. */
export const NODES: Record<string, GraphNode> = {
  SEED: seedNode,
  SEARCH: searchNode,
  FETCH: fetchNode,
  EXTRACT_LINKS: extractLinksNode,
  SCORE: scoreNode,
  SELECT: selectNode,
  FOLLOW: followNode,
  SYNTHESIZE: synthesizeNode,
  CHECK_STOP: checkStopNode,
};

/** Canonical node sequence (for linear validation). */
export const NODE_SEQUENCE: string[] = [
  'SEED',
  'SEARCH',
  'FETCH',
  'EXTRACT_LINKS',
  'SCORE',
  'SELECT',
  'FOLLOW',
  'SYNTHESIZE',
  'CHECK_STOP',
];

// ===========================================================================
// GRAPH RUNNER (Phase 1: manual dispatch)
// ===========================================================================

/**
 * Executes the graph by dispatching node functions in sequence with
 * conditional routing at CHECK_STOP.
 *
 * Phase 1: Manual dispatch (this stub).
 * Phase 2: LangGraph-style StateGraph with compiled edges.
 *
 * @returns The final state after termination or max iterations.
 */
export async function runGraph(
  initialState: ExplorationState,
  maxIterations: number = 20,
): Promise<ExplorationState> {
  let state: ExplorationState = { ...initialState };
  let iteration = 0;

  while (iteration < maxIterations) {
    const currentNode = NODE_SEQUENCE[iteration % NODE_SEQUENCE.length];
    if (!currentNode) break;

    const nodeFn = NODES[currentNode];
    if (!nodeFn) break;

    const delta = await nodeFn(state);
    state = { ...state, ...delta };

    iteration++;

    // CHECK_STOP routing
    if (currentNode === 'CHECK_STOP') {
      const nextNode = checkStopRoute(state);
      if (nextNode === 'END') break;
      // Otherwise loop continues — SELECT is next in sequence
    }
  }

  return state;
}
