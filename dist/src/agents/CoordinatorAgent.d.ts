import type { AgentProfile } from "../types/agent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { WorkerAgent } from "./WorkerAgent.js";
export declare class CoordinatorAgent {
    private readonly profile;
    private readonly workerAgent;
    private readonly llmProvider;
    constructor(profile: AgentProfile, workerAgent: WorkerAgent, llmProvider: LlmProvider);
    coordinate(highLevelTask: string, workingDirectory?: string): Promise<{
        summary: string;
        metrics: {
            plannerSubtasks: number;
            workerSuccessRate: number;
            coordinationFailures: number;
            turnsUsed: number;
        };
    }>;
    private planWorkerTasks;
}
