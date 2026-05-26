/**
 * Bridge to WEALTH MCP organ.
 * This file ROUTES, it does NOT compute.
 *
 * Per PHOENIX-99 INVARIANTS:
 *   LAW_001: WEALTH owns economics.
 *   LAW_004: courier delivers, organ thinks.
 */

import { callMCP } from "../mcp/client.js";

export class WealthEngineBridge {
  async allocate(scenarios: unknown[]): Promise<unknown[]> {
    return (await callMCP("wealth_mcp.allocate", { scenarios })) as unknown[];
  }

  getBudgetStatus(): { remaining: number; utilization: number } {
    // Budget status is local telemetry; return safe defaults
    // until WEALTH MCP exposes budget telemetry endpoint.
    return { remaining: 1_000_000, utilization: 0 };
  }

  async evaluatePlan(plan: unknown[], remainingBudget: unknown): Promise<unknown> {
    return await callMCP("wealth_mcp.evaluate_plan", { plan, remainingBudget });
  }

  async shouldContinue(stressMetrics: unknown): Promise<unknown> {
    return await callMCP("wealth_mcp.should_continue", { stressMetrics });
  }
}
