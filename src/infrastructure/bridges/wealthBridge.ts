/**
 * Bridge to WEALTH MCP organ.
 * This file ROUTES, it does NOT compute.
 *
 * Per PHOENIX-99 INVARIANTS:
 *   LAW_001: WEALTH owns economics.
 *   LAW_004: courier delivers, organ thinks.
 */

/**
 * S6 (F13 order 2026-10-01): these three verbs — allocate, evaluate_plan,
 * should_continue — exist on NO live WEALTH surface. The organ was probed
 * directly: its 15 live tools are capital_* plus wealth_judge_handoff and
 * wealth_synthesize, and capital_primitive's own mode enum is
 * npv|irr|emv|evoi|mc|kelly|markowitz|robust|chance_constrained|two_stage|
 * reward_design. Nothing takes a scenario list and returns an allocation.
 *
 * They are NOT remapped by guesswork: markowitz is the nearest primitive but it
 * consumes returns/covariances/risk_aversion, not scenarios, so wiring it up
 * would silently answer a different question. Per Void Guard, "no data" must
 * not be dressed as "all clear" — so these fail loudly with a precise gap
 * instead of the previous "Unknown tool" error, which callers misread as a
 * WEALTH outage. Callers: PipelineCoordinator.ts:239, AgentEngine.ts:519.
 */
function capabilityGap(verb: string, nearest: string): never {
  const err = new Error(
    `CAPABILITY_GAP: WEALTH exposes no "${verb}" primitive. Live surface is ` +
    `capital_* + wealth_judge_handoff + wealth_synthesize; capital_primitive modes are ` +
    `npv|irr|emv|evoi|mc|kelly|markowitz|robust|chance_constrained|two_stage|reward_design. ` +
    `Nearest primitive is ${nearest}, but its argument shape differs — it must not be ` +
    `substituted silently. This is a missing capability, NOT a WEALTH outage.`,
  ) as Error & { error_code: string; source_layer: string };
  err.error_code = "CAPABILITY_GAP";
  err.source_layer = "A-FORGE::BRIDGE::WEALTH";
  throw err;
}

export class WealthEngineBridge {
  async allocate(scenarios: unknown[]): Promise<unknown[]> {
    void scenarios;
    capabilityGap("allocate", "capital_primitive(mode=markowitz)");
  }

  getBudgetStatus(): { remaining: number; utilization: number } {
    // Budget status is local telemetry; return safe defaults
    // until WEALTH MCP exposes budget telemetry endpoint.
    return { remaining: 1_000_000, utilization: 0 };
  }

  async evaluatePlan(plan: unknown[], remainingBudget: unknown): Promise<unknown> {
    void plan; void remainingBudget;
    capabilityGap("evaluate_plan", "capital_health(mode=runway)");
  }

  async shouldContinue(stressMetrics: unknown): Promise<unknown> {
    void stressMetrics;
    capabilityGap("should_continue", "capital_civx(mode=resilience)");
  }
}
