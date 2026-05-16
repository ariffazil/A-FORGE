// [P0|Q2] Token budget governance with per-turn limits, threshold warnings,
// cost tracking, and synchronous enforcement — 2026-05-05

import type { AgentBudget, BudgetStatus } from "../types/agent.js";

export class BudgetExhaustedError extends Error {
  constructor(used: number, ceiling: number) {
    super(`Token ceiling exceeded: used ${used}, ceiling ${ceiling}`);
    this.name = "BudgetExhaustedError";
  }
}

export class PerTurnLimitExceededError extends Error {
  constructor(turnTokens: number, limit: number) {
    super(`Per-turn token limit exceeded: ${turnTokens} > ${limit}`);
    this.name = "PerTurnLimitExceededError";
  }
}

export class BudgetManager {
  private totalEstimatedTokens = 0;
  private turnCount = 0;
  private readonly perTurnTokenLimit: number;
  private lastTurnTokens = 0;
  private totalCostUsd = 0;
  private readonly inputCostPerMillion: number;
  private readonly outputCostPerMillion: number;

  constructor(
    private readonly budget: AgentBudget,
    apiPricing?: { inputCostPerMillionTokens: number; outputCostPerMillionTokens: number },
  ) {
    this.perTurnTokenLimit = budget.perTurnTokenLimit ?? 2048;
    this.inputCostPerMillion = apiPricing?.inputCostPerMillionTokens ?? 0;
    this.outputCostPerMillion = apiPricing?.outputCostPerMillionTokens ?? 0;
  }

  addUsage(inputTokens: number, outputTokens: number): void {
    this.lastTurnTokens = inputTokens + outputTokens;
    this.totalEstimatedTokens += this.lastTurnTokens;
    this.turnCount += 1;
    this.totalCostUsd +=
      (inputTokens * this.inputCostPerMillion) / 1_000_000 +
      (outputTokens * this.outputCostPerMillion) / 1_000_000;
  }

  getTotalEstimatedTokens(): number {
    return this.totalEstimatedTokens;
  }

  getStatus(): BudgetStatus {
    const usagePercent = this.budget.tokenCeiling > 0
      ? this.totalEstimatedTokens / this.budget.tokenCeiling
      : 0;

    const avgTokensPerTurn = this.turnCount > 0
      ? this.totalEstimatedTokens / this.turnCount
      : 1000;

    const remainingTokens = Math.max(0, this.budget.tokenCeiling - this.totalEstimatedTokens);
    const turnsRemaining = Math.floor(remainingTokens / Math.max(avgTokensPerTurn, 1));

    return {
      totalTokensUsed: this.totalEstimatedTokens,
      totalCostUsd: Math.round(this.totalCostUsd * 1_000_000) / 1_000_000,
      usagePercent: Math.round(usagePercent * 1000) / 1000,
      turnsRemaining,
      shouldDownshift: usagePercent >= 0.8,
    };
  }

  usagePercent(): number {
    return this.budget.tokenCeiling > 0
      ? this.totalEstimatedTokens / this.budget.tokenCeiling
      : 0;
  }

  /**
   * Pre-flight budget check. Call BEFORE every LLM call and BEFORE every
   * tool execution to enforce hard stops before spend occurs.
   */
  assertWithinBudget(): void {
    if (this.totalEstimatedTokens > this.budget.tokenCeiling) {
      throw new BudgetExhaustedError(this.totalEstimatedTokens, this.budget.tokenCeiling);
    }
  }

  /**
   * Per-turn limit check. Call BEFORE each LLM call to prevent any single
   * turn from monopolizing the session budget.
   */
  assertPerTurnLimit(inputTokens: number, outputTokens: number): void {
    const turnTokens = inputTokens + outputTokens;
    if (turnTokens > this.perTurnTokenLimit) {
      throw new PerTurnLimitExceededError(turnTokens, this.perTurnTokenLimit);
    }
  }

  /**
   * Threshold-based telemetry. Call after each turn to log warnings and
   * trigger preventive actions at 60% / 80% / 100%.
   */
  evaluateThresholds(): void {
    const percent = this.usagePercent();

    if (percent >= 1.0) {
      console.error(`[BUDGET] HARD STOP: 100% budget consumed (${this.totalEstimatedTokens}/${this.budget.tokenCeiling})`);
    } else if (percent >= 0.8) {
      console.warn(`[BUDGET] TRIGGER: 80% budget consumed (${this.totalEstimatedTokens}/${this.budget.tokenCeiling}) — downshift recommended`);
    } else if (percent >= 0.6) {
      console.warn(`[BUDGET] Warning: 60% budget consumed (${this.totalEstimatedTokens}/${this.budget.tokenCeiling})`);
    }
  }
}
