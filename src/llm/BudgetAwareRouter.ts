// [Q2] Budget-aware LLM provider router — downshifts or refuses based on
// real-time token consumption. Implements LlmProvider transparently.
// 2026-05-05

import type { LlmProvider } from "./LlmProvider.js";
import type { LlmTurnRequest, LlmTurnResponse } from "../types/agent.js";
import type { BudgetManager } from "../engine/BudgetManager.js";

export interface BudgetAwareRouterOptions {
  primary: LlmProvider;
  budgetManager: BudgetManager;
  fallback?: LlmProvider;
}

export class BudgetAwareRouter implements LlmProvider {
  readonly name = "budget-aware-router";

  constructor(private readonly options: BudgetAwareRouterOptions) {}

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
    const percent = this.options.budgetManager.usagePercent();

    if (percent >= 0.95) {
      console.error(
        `[BUDGET] Router refused LLM call: ${(percent * 100).toFixed(1)}% budget consumed`,
      );
      return {
        content:
          "[BUDGET] Session terminated: token budget exhausted (≥95%). No further LLM calls permitted.",
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: "completed",
        providerMetrics: {
          toolCallParseFailures: 0,
          resumedWithPreviousResponseId: false,
        },
      };
    }

    if (percent >= 0.8 && this.options.fallback) {
      console.warn(
        `[BUDGET] Router downshifted to fallback provider "${this.options.fallback.name}" at ${(percent * 100).toFixed(1)}% budget`,
      );
      return this.options.fallback.completeTurn(request);
    }

    if (percent >= 0.8) {
      console.warn(
        `[BUDGET] Router continued with primary at ${(percent * 100).toFixed(1)}% budget — no fallback configured`,
      );
    }

    return this.options.primary.completeTurn(request);
  }
}
