import type { AgentProfile, AgentRunResult, EngineRunOptions } from "../types/agent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import type { FeatureFlags } from "../flags/featureFlags.js";
import type { ToolPolicyConfig } from "../config/RuntimeConfig.js";
import { ForgeScoreboard } from "../scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../scoreboard/RunMetricsLogger.js";
export type AgentEngineDependencies = {
    llmProvider: LlmProvider;
    toolRegistry: ToolRegistry;
    longTermMemory: LongTermMemory;
    featureFlags?: FeatureFlags;
    toolPolicy?: ToolPolicyConfig;
    scoreboard?: ForgeScoreboard;
    runMetricsLogger?: RunMetricsLogger;
    apiPricing?: {
        inputCostPerMillionTokens: number;
        outputCostPerMillionTokens: number;
    };
};
export declare class AgentEngine {
    private readonly profile;
    private readonly dependencies;
    constructor(profile: AgentProfile, dependencies: AgentEngineDependencies);
    run(options: EngineRunOptions): Promise<AgentRunResult>;
    private executeToolCalls;
    private estimateApiCost;
}
