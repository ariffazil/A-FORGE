import type { AgentBudget } from "../types/agent.js";

export class BudgetManager {
  private totalEstimatedTokens = 0;

  constructor(private readonly budget: AgentBudget) {}

  addUsage(inputTokens: number, outputTokens: number): void {
    this.totalEstimatedTokens += inputTokens + outputTokens;
  }

  getTotalEstimatedTokens(): number {
    return this.totalEstimatedTokens;
  }

  assertWithinBudget(): void {
    if (this.totalEstimatedTokens > this.budget.tokenCeiling) {
      throw new Error(
        `Token ceiling exceeded: used ${this.totalEstimatedTokens}, ceiling ${this.budget.tokenCeiling}`,
      );
    }
  }
}
