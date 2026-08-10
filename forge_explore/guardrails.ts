/**
 * forge_explore — Guardrail Hooks (MODULE 5)
 * ============================================
 * forge_id: FE-{2026.08.10}-001
 * module:   GUARDRAILS (Strands BeforeToolCallEvent pattern)
 *
 * Attaches a HookProvider that intercepts EVERY tool call BEFORE execution.
 * Validates symbolic rules mapped to:
 *   F11 — auth for critical commands
 *   F12 — block overrides
 *   F13 — sovereign veto
 *
 * On any rule failure: cancel_tool — decoupled from the tool implementation
 * itself. Logs tool name + params + reason for audit.
 *
 * EXPLICITLY GATED:
 *   1. Any FETCH beyond depth.max
 *   2. Any FOLLOW that would revisit a visited URL (cycle prevention)
 *   3. Any SYNTHESIZE output that lacks citations
 *   4. Any state transition attempting to bypass the interoceptive gate
 *
 * FLOORS:
 *   F1  — reversible-first: gates block BEFORE mutation
 *   F9  — no hallucinated dispatches
 *   F11 — every interception logged for audit
 *   F12 — non-bypassable by agent itself
 *   F13 — sovereign veto hooks
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — rule definitions + hook registration stubs.
 *         Binding to actual tool execution pipeline deferred to Phase 2.
 */

import type { ExplorationState, FrontierEntry } from './state.ts';

// ===========================================================================
// Rule Types
// ===========================================================================

export type RuleSeverity = 'BLOCK' | 'WARN' | 'LOG';

export interface GuardRule {
  id: string;
  name: string;
  description: string;
  floor: string; // F1-F13
  severity: RuleSeverity;
  /** Evaluates the rule. Returns { passed, reason }. */
  evaluate: (
    toolName: string,
    toolParams: Record<string, unknown>,
    state: ExplorationState,
  ) => { passed: boolean; reason: string };
}

export interface GuardResult {
  passed: boolean;
  failures: Array<{
    ruleId: string;
    ruleName: string;
    reason: string;
    floor: string;
  }>;
}

// ===========================================================================
// RULE 1: Depth Gate (F13)
// ===========================================================================

const depthGateRule: GuardRule = {
  id: 'R1_DEPTH_GATE',
  name: 'Depth Gate',
  description: 'Blocks any FETCH/FOLLOW beyond depth.max.',
  floor: 'F13',
  severity: 'BLOCK',
  evaluate(_toolName, _toolParams, state) {
    if (state.depth.current >= state.depth.max) {
      return {
        passed: false,
        reason: `DEPTH_EXCEEDED: depth.current=${state.depth.current} >= depth.max=${state.depth.max}. F13 depth gate.`,
      };
    }
    return { passed: true, reason: '' };
  },
};

// ===========================================================================
// RULE 2: Cycle Prevention (F9)
// ===========================================================================

const cyclePreventionRule: GuardRule = {
  id: 'R2_CYCLE_PREVENTION',
  name: 'Cycle Prevention',
  description: 'Blocks FOLLOW to already-visited URLs.',
  floor: 'F9',
  severity: 'BLOCK',
  evaluate(toolName, toolParams, state) {
    const url = toolParams?.url as string | undefined;
    if (toolName === 'forge_browser_navigate' && url && state.visited.has(url)) {
      return {
        passed: false,
        reason: `CYCLE_DETECTED: url=${url} already in visited set. F9 anti-hantu gate.`,
      };
    }
    return { passed: true, reason: '' };
  },
};

// ===========================================================================
// RULE 3: Citation Gate (F2 + F6)
// ===========================================================================

const citationGateRule: GuardRule = {
  id: 'R3_CITATION_GATE',
  name: 'Citation Gate',
  description: 'Blocks SYNTHESIZE output that lacks citations.',
  floor: 'F2',
  severity: 'BLOCK',
  evaluate(toolName, _toolParams, state) {
    if (toolName === 'SYNTHESIZE' && state.evidence.length === 0) {
      return {
        passed: false,
        reason: 'NO_EVIDENCE: SYNTHESIZE requires at least one citation. F2 truth gate.',
      };
    }
    return { passed: true, reason: '' };
  },
};

// ===========================================================================
// RULE 4: Interoceptive Gate Bypass Detection (F4 + F11)
// ===========================================================================

const interoceptiveBypassRule: GuardRule = {
  id: 'R4_GATE_BYPASS',
  name: 'Interoceptive Gate Bypass Detection',
  description: 'Blocks FOLLOW if it was not preceded by interoceptive gate PASS.',
  floor: 'F4',
  severity: 'BLOCK',
  evaluate(toolName, _toolParams, _state) {
    // Phase 1 stub — gate bypass detection requires stateful tracking
    // Phase 2: track last gate decision per state; if FOLLOW called without
    // prior PASS from interoceptiveGate() → BLOCK
    if (toolName === 'forge_browser_navigate') {
      // Placeholder: always pass in Phase 1 scaffold
      return { passed: true, reason: '' };
    }
    return { passed: true, reason: '' };
  },
};

// ===========================================================================
// RULE 5: Sovereign Veto Hook (F13)
// ===========================================================================

const sovereignVetoRule: GuardRule = {
  id: 'R5_SOVEREIGN_VETO',
  name: 'Sovereign Veto',
  description: 'F13 sovereign human veto — always checkable.',
  floor: 'F13',
  severity: 'BLOCK',
  evaluate(_toolName, _toolParams, state) {
    // F13: FOLLOW past depth 3 → requires fresh 888 prompt
    if (state.depth.current >= 3) {
      return {
        passed: false,
        reason: `F13_HOLD: depth=${state.depth.current} >= 3. Requires fresh 888 prompt from sovereign before FOLLOW.`,
      };
    }
    // F13: SYNTHESIZE with >2 unresolved contradictions → fresh 888
    const unresolved = state.hypotheses.filter(
      (h) => h.contradictingEvidence.length > 0 && h.supportingEvidence.length === 0,
    );
    if (unresolved.length > 2) {
      return {
        passed: false,
        reason: `F13_HOLD: ${unresolved.length} hypotheses have unresolved contradictions (>2). Requires fresh 888 prompt before SYNTHESIZE.`,
      };
    }
    return { passed: true, reason: '' };
  },
};

// ===========================================================================
// Rule Registry
// ===========================================================================

/** All guard rules, in evaluation order. */
export const GUARD_RULES: GuardRule[] = [
  depthGateRule,
  cyclePreventionRule,
  citationGateRule,
  interoceptiveBypassRule,
  sovereignVetoRule,
];

// ===========================================================================
// Core: evaluateGuardrails()
// ===========================================================================

/**
 * Evaluates all guardrails against a pending tool call.
 *
 * Called BEFORE every tool call execution.
 * On ANY BLOCK failure: cancel the tool, log reason.
 *
 * @param toolName — The tool being called (e.g., 'forge_browser_navigate')
 * @param toolParams — Parameters being passed to the tool
 * @param state — Current exploration state
 * @returns GuardResult — { passed, failures[] }
 */
export function evaluateGuardrails(
  toolName: string,
  toolParams: Record<string, unknown>,
  state: ExplorationState,
): GuardResult {
  const failures: GuardResult['failures'] = [];

  for (const rule of GUARD_RULES) {
    const result = rule.evaluate(toolName, toolParams, state);
    if (!result.passed) {
      failures.push({
        ruleId: rule.id,
        ruleName: rule.name,
        reason: result.reason,
        floor: rule.floor,
      });

      // BLOCK severity → hard stop
      if (rule.severity === 'BLOCK') {
        // Log for audit
        console.log(
          `[forge_explore:guardrail] BLOCKED ${toolName}: ${result.reason} (${rule.id}, ${rule.floor})`,
        );
      }
    }
  }

  return {
    passed: failures.filter((f) => {
      const rule = GUARD_RULES.find((r) => r.id === f.ruleId);
      return rule?.severity === 'BLOCK';
    }).length === 0,
    failures,
  };
}

// ===========================================================================
// Hook Registration (Phase 2)
// ===========================================================================

/**
 * Registers guardrail hooks into the tool execution pipeline.
 *
 * Phase 1: This is a stub. Guardrails are callable manually via evaluateGuardrails().
 * Phase 2: Integrate with A-FORGE's BeforeToolCallEvent hook system
 *          (see /root/A-FORGE/hooks/ for the hook provider interface).
 */
export function registerGuardrailHooks(): void {
  // Phase 1 stub — manual evaluation only
  console.log('[forge_explore:guardrails] Guardrail hooks registered (Phase 1: manual mode).');
}
