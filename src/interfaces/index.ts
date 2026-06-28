/**
 * A-FORGE Public API Exports
 * 
 * Constitutional Agent Runtime - Planner/Executor/Verifier Triad
 * arifOS 000-999 Pipeline: INIT → SENSE → MIND → HEART → ASI → JUDGE → FORGE → VAULT
 */

// Core Engine
export { AgentEngine } from "../domain/engine/AgentEngine.js";
export { BudgetManager } from "../domain/engine/BudgetManager.js";
export { RunReporter } from "../domain/engine/RunReporter.js";

// Tools
export { BaseTool, type Tool } from "../infrastructure/tools/base.js";
export { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
export { ReadFileTool, WriteFileTool, ListFilesTool } from "../infrastructure/tools/FileTools.js";
export { GrepTextTool } from "../infrastructure/tools/SearchTools.js";
export { RunCommandTool, RunTestsTool } from "../infrastructure/tools/ShellTools.js";
// Policy - Sense (111) Lite/Deep
export {
  runSense,
  senseLite,
  senseDeep,
  senseAuto,
} from "../domain/policy/sense.js";

// Agents
export { WorkerAgent } from "../domain/agents/WorkerAgent.js";
export { buildExploreProfile, buildFixProfile, buildTestProfile, buildCoordinatorProfile, buildWorkerProfile } from "../domain/agents/profiles.js";

// Memory
export { LongTermMemory } from "../application/memory/LongTermMemory.js";
export { ShortTermMemory } from "../application/memory/ShortTermMemory.js";

// LLM Providers
export { type LlmProvider } from "../infrastructure/llm/LlmProvider.js";
export { MockLlmProvider } from "../infrastructure/llm/MockLlmProvider.js";
export { OpenAIResponsesProvider } from "../infrastructure/llm/OpenAIResponsesProvider.js";
export { createLlmProvider } from "../infrastructure/llm/providerFactory.js";

// Scoreboard
export { ForgeScoreboard } from "../domain/scoreboard/ForgeScoreboard.js";
export { RunMetricsLogger } from "../domain/scoreboard/RunMetricsLogger.js";

// Policy - F7 (Humility)
export {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  detectOverconfidenceMismatch,
  classifyUncertaintyBand,
  formatConfidenceDisplay,
  CONFIDENCE_THRESHOLDS,
  UNCERTAINTY_THRESHOLDS,
} from "../domain/policy/confidence.js";

// Types
export type {
  AgentProfile,
  AgentBudget,
  AgentModeName,
  AgentMessage,
  AgentMessageRole,
  ToolCallRequest,
  ToolDefinitionForModel,
  LlmTurnRequest,
  LlmTurnResponse,
  EngineRunOptions,
  AgentRunResult,
  WorkerTask,
  WorkerReport,
  RunMetrics,
} from "../domain/types/agent.js";

export type {
  ToolRiskLevel,
  ToolSchema,
  ToolSchemaProperty,
  ToolPermissionContext,
  ToolExecutionContext,
  ToolResult,
} from "../domain/types/tool.js";

export type {
  SenseResult,
  SenseMode,
  ConfidenceEstimate,
  JudgeResult,
  JudgeVerdict,
  SessionState,
  SessionClaim,
  EntropyMetrics,
  UncertaintyBand,
} from "../domain/types/session.js";

export type { TaskMemoryRecord } from "../domain/types/memory.js";
export type { ForgeTaskType, ForgeWeeklySummary } from "../domain/types/scoreboard.js";
export type { BackgroundJobDefinition, BackgroundJobRegistrationResult } from "../domain/types/jobs.js";

// Approval Boundary + Router
export { routeApproval } from "../application/approval/ApprovalRouter.js";
export type { RouteApprovalOptions } from "../application/approval/ApprovalRouter.js";

// Config
export { readRuntimeConfig } from "../interfaces/config/RuntimeConfig.js";
export { createA2ARouter } from "../application/a2a/index.js";
export type { A2ATask, A2AMessage, JsonRpcRequest } from "../application/a2a/index.js";

// Flags
export type { FeatureFlags } from "../interfaces/config/featureFlags.js";
export { readFeatureFlags } from "../interfaces/config/featureFlags.js";
export type { ModeSettings } from "../interfaces/config/modes.js";
export { buildModeSettings } from "../interfaces/config/modes.js";


