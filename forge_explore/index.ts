/**
 * forge_explore — Constitutional Exploration Runtime
 * ====================================================
 * forge_id: FE-{2026.08.10}-001
 * version:  v0.1.0-PHASE1-SCAFFOLD
 * repo:     ariffazil/A-FORGE
 * kernel:   arifOS (F1-F13 enforced)
 *
 * The missing nervous system connecting forge_browser_* (legs) to
 * AGI-explorer-intelligence (mind), governed by arifOS floors F1-F13.
 *
 * Modules:
 *   1. graph.ts              — StateGraph skeleton (LangGraph-style)
 *   2. telemetry.ts          — OTel span emitter (W3 audit trail)
 *   3. interoceptive_gate.ts — Pre-flight gate (F4 ΔS≤0 + F7 humility)
 *   4. critic.ts             — CRITIC loop for FALSIFY
 *   5. guardrails.ts         — Strands BeforeToolCallEvent hooks
 *   6. evidence_graph.ts     — GraphRAG evidence graph
 *   7. synthesize.ts         — SYNTHESIZE node + GraphRAG engine
 *   8. state.ts              — Canonical state schema
 *
 * PHASE 1: Scaffold only. All modules have stubs + docstrings.
 *          No production mutation. No irreversible seals.
 * PHASE 2: Full implementation — LangGraph runtime, OTel SDK,
 *          active inference G(a), forge_browser_* integration.
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold
 * @sealed false (reversible draft)
 */

// Re-export all public APIs
export { runGraph, NODES, NODE_SEQUENCE } from './graph.ts';
export { emitSpan, emitGateSpan, getSpanLog, clearSpanLog } from './telemetry.ts';
export type { Span, SpanContext, SpanKind } from './telemetry.ts';
export { interoceptiveGate, reduceEntropy } from './interoceptive_gate.ts';
export type { GateResult, GateDecision, GateConfig } from './interoceptive_gate.ts';
export { falsify, falsifyAll } from './critic.ts';
export type { CriticResult } from './critic.ts';
export { evaluateGuardrails, GUARD_RULES, registerGuardrailHooks } from './guardrails.ts';
export type { GuardRule, GuardResult, RuleSeverity } from './guardrails.ts';
export {
  addSourceNode,
  addClaimNode,
  addHypothesisNode,
  addEdge,
  getNodesByType,
  getEdgesByType,
  getContradictions,
  getNeighbors,
  getGraphStats,
} from './evidence_graph.ts';
export { synthesize, synthesizeNode } from './synthesize.ts';
export type { SynthesisOutput, SynthesisFinding, SynthesisContradiction } from './synthesize.ts';
export { createSeedState, DEFAULT_TELEMETRY } from './state.ts';
export type {
  ExplorationState,
  StateDelta,
  FrontierEntry,
  EvidenceEntry,
  Hypothesis,
  ExplorationNode,
  ExplorationEdge,
  Telemetry,
  EpistemicLabel,
  TerminationReason,
} from './state.ts';
