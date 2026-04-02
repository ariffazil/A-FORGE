import type { AgentBudget } from "../types/agent.js";
export declare class BudgetManager {
    private readonly budget;
    private totalEstimatedTokens;
    constructor(budget: AgentBudget);
    addUsage(inputTokens: number, outputTokens: number): void;
    getTotalEstimatedTokens(): number;
    assertWithinBudget(): void;
}
