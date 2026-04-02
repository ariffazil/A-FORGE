import { AgentEngine } from "../engine/AgentEngine.js";
import type { AgentProfile } from "../types/agent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import type { RuntimeConfig } from "../config/RuntimeConfig.js";
export declare function runCliCommand(command: string, options: Record<string, string | boolean>, engineFactory: (profile: AgentProfile) => AgentEngine, llmProviderFactory: () => LlmProvider, runtimeConfig: RuntimeConfig): Promise<string>;
