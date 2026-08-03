/**
 * P0 Deterministic Pre-Execution Gates — Gate Runner.
 *
 * Evaluates all registered gates against a proposed tool call. Gates run
 * in priority order (lowest first). The first rejecting gate wins and
 * returns its reason. If all gates pass, the tool call proceeds.
 *
 * Based on arXiv:2607.07405 §3.2: "A gate suite is evaluated in order.
 * The first rejecting gate wins and returns its reason."
 *
 * @module governance/p0-gates/runner
 * @forged 2026-08-03 by 333-AGI
 *
 * DITEMPA BUKAN DIBERI
 */

import type {
  DBSnapshot,
  GateRegistration,
  GateResult,
  GateSuiteResult,
  LeaseState,
} from "./types.js";

/**
 * Run the full P0 gate suite against a proposed tool call.
 *
 * @param gates - Ordered gate registrations (will be sorted by priority).
 * @param toolName - The tool being called.
 * @param args - The tool call arguments.
 * @param dbState - Current snapshot of relevant state.
 * @param lease - Current lease state.
 * @returns GateSuiteResult with passed/blocked status and evaluations.
 */
export function runP0Gates(
  gates: GateRegistration[],
  toolName: string,
  args: Record<string, unknown>,
  dbState: DBSnapshot,
  lease: LeaseState,
): GateSuiteResult {
  const t0 = performance.now();

  // Sort by priority (lower = earlier)
  const sorted = [...gates].sort((a, b) => a.priority - b.priority);

  const evaluations: GateResult[] = [];
  let blockingGate: GateResult | null = null;

  for (const gate of sorted) {
    // Check if gate targets this tool
    const { targeting } = gate;
    if (targeting.tools && targeting.tools.length > 0) {
      const matches = targeting.tools.some((t) => toolName.includes(t));
      if (!matches) continue; // gate doesn't target this tool — skip
    }

    const result = gate.predicate(toolName, args, dbState, lease);
    evaluations.push(result);

    if (!result.allow) {
      blockingGate = result;
      break; // first rejecting gate wins
    }
  }

  const latencyMs = performance.now() - t0;

  return {
    passed: blockingGate === null,
    blockingGate,
    evaluations,
    latencyMs,
  };
}

/**
 * Shortcut: run the canonical P0 gate suite from gates.ts.
 * Import P0_GATES from gates.ts and pass to runP0Gates.
 */
export { P0_GATES } from "./gates.js";
