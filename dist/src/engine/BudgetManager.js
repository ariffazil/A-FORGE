export class BudgetManager {
    budget;
    totalEstimatedTokens = 0;
    constructor(budget) {
        this.budget = budget;
    }
    addUsage(inputTokens, outputTokens) {
        this.totalEstimatedTokens += inputTokens + outputTokens;
    }
    getTotalEstimatedTokens() {
        return this.totalEstimatedTokens;
    }
    assertWithinBudget() {
        if (this.totalEstimatedTokens > this.budget.tokenCeiling) {
            throw new Error(`Token ceiling exceeded: used ${this.totalEstimatedTokens}, ceiling ${this.budget.tokenCeiling}`);
        }
    }
}
