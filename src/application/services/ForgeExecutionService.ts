/**
 * ForgeExecutionService — Application Service (Hexagonal Architecture)
 *
 * Layer: application/services/
 * Role: Shared wiring for domain engines. Creates and caches common
 *       infrastructure dependencies (ToolRegistry, Memory, Bridges).
 *
 * Forged: 2026-06-10 — Phase 3 of Hexagonal refactor
 */

import { homedir } from "node:os";
import { resolve } from "node:path";
import type { AgentEngineDependencies } from "../../domain/engine/AgentEngine.js";
import type { PipelineDependencies } from "../../domain/engine/PipelineCoordinator.js";
import { ToolRegistry } from "../../infrastructure/tools/ToolRegistry.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { readRuntimeConfig } from "../../interfaces/config/RuntimeConfig.js";
import { getTicketStore } from "../approval/index.js";
import { getMemoryContract } from "../../domain/memory-contract/index.js";
import { WealthEngineBridge } from "../../infrastructure/bridges/wealthBridge.js";
import { getScenarios } from "../../infrastructure/bridges/geoxBridge.js";

export type { AgentEngineDependencies } from "../../domain/engine/AgentEngine.js";
export type { PipelineDependencies } from "../../domain/engine/PipelineCoordinator.js";
export type { AgentProfile, AgentRunResult, EngineRunOptions } from "../../domain/types/agent.js";

const DEFAULT_API_PRICING = {
  inputCostPerMillionTokens: 1.10,
  outputCostPerMillionTokens: 4.40,
};

// ── Module-level singletons (lazy init) ──

let _toolRegistry: ToolRegistry | undefined;
let _longTermMemory: LongTermMemory | undefined;

function getTR(): ToolRegistry {
  if (!_toolRegistry) _toolRegistry = new (ToolRegistry as unknown as { new(): ToolRegistry })();
  return _toolRegistry;
}

function getLTM(): LongTermMemory {
  if (!_longTermMemory) _longTermMemory = new LongTermMemory(resolve(homedir(), ".aforge", "long-term-memory.json"));
  return _longTermMemory;
}

function buildEngineDeps(llmProvider: any, overrides?: Partial<AgentEngineDependencies>): AgentEngineDependencies {
  const config = readRuntimeConfig();
  return {
    llmProvider,
    toolRegistry: getTR(),
    longTermMemory: getLTM(),
    memoryContract: getMemoryContract(),
    featureFlags: config.featureFlags,
    toolPolicy: config.toolPolicy,
    vaultClient: undefined,
    ticketStore: getTicketStore(),
    wealthBridge: new WealthEngineBridge(),
    geoxScenarioLoader: getScenarios,
    apiPricing: DEFAULT_API_PRICING,
    ...overrides,
  };
}

function buildPipelineDeps(llmProvider: any, overrides?: Partial<PipelineDependencies>): PipelineDependencies {
  const config = readRuntimeConfig();
  return {
    llmProvider,
    toolRegistry: getTR(),
    longTermMemory: getLTM(),
    memoryContract: getMemoryContract(),
    featureFlags: config.featureFlags,
    toolPolicy: config.toolPolicy,
    ticketStore: getTicketStore(),
    apiPricing: DEFAULT_API_PRICING,
    ...overrides,
  };
}

export {
  buildEngineDeps,
  buildPipelineDeps,
  getTR as getToolRegistry,
  getLTM as getLongTermMemory,
};
