/**
 * A-FORGE Public API Exports
 * 
 * Constitutional Agent Runtime - Planner/Executor/Verifier Triad
 * arifOS 000-999 Pipeline: INIT → SENSE → MIND → HEART → ASI → JUDGE → FORGE → VAULT
 */

// Core Engine
export { AgentEngine } from "./engine/AgentEngine.js";
export { BudgetManager } from "./engine/BudgetManager.js";
export { RunReporter } from "./engine/RunReporter.js";

// Tools
export { BaseTool, type Tool } from "./tools/base.js";
export { ToolRegistry } from "./tools/ToolRegistry.js";
export { ReadFileTool, WriteFileTool, ListFilesTool } from "./tools/FileTools.js";
export { GrepTextTool } from "./tools/SearchTools.js";
export { RunCommandTool, RunTestsTool } from "./tools/ShellTools.js";
// Policy - Sense (111) Lite/Deep
export {
  runSense,
  senseLite,
  senseDeep,
  senseAuto,
} from "./policy/sense.js";

// Agents
export { CoordinatorAgent } from "./agents/CoordinatorAgent.js";
export { WorkerAgent } from "./agents/WorkerAgent.js";
export { buildExploreProfile, buildFixProfile, buildTestProfile, buildCoordinatorProfile, buildWorkerProfile } from "./agents/profiles.js";

// Memory
export { LongTermMemory } from "./memory/LongTermMemory.js";
export { ShortTermMemory } from "./memory/ShortTermMemory.js";

// LLM Providers
export { type LlmProvider } from "./llm/LlmProvider.js";
export { MockLlmProvider } from "./llm/MockLlmProvider.js";
export { OpenAIResponsesProvider } from "./llm/OpenAIResponsesProvider.js";
export { createLlmProvider } from "./llm/providerFactory.js";

// Scoreboard
export { ForgeScoreboard } from "./scoreboard/ForgeScoreboard.js";
export { RunMetricsLogger } from "./scoreboard/RunMetricsLogger.js";

// Policy - F7 (Humility)
export {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  detectOverconfidenceMismatch,
  classifyUncertaintyBand,
  formatConfidenceDisplay,
  CONFIDENCE_THRESHOLDS,
  UNCERTAINTY_THRESHOLDS,
} from "./policy/confidence.js";

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
} from "./types/agent.js";

export type {
  ToolRiskLevel,
  ToolSchema,
  ToolSchemaProperty,
  ToolPermissionContext,
  ToolExecutionContext,
  ToolResult,
} from "./types/tool.js";

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
} from "./types/session.js";

export type { TaskMemoryRecord } from "./types/memory.js";
export type { ForgeTaskType, ForgeWeeklySummary } from "./types/scoreboard.js";
export type { BackgroundJobDefinition, BackgroundJobRegistrationResult } from "./types/jobs.js";

// Approval Boundary + Router
export { routeApproval } from "./approval/ApprovalRouter.js";
export type { RouteApprovalOptions } from "./approval/ApprovalRouter.js";

// Config
export { readRuntimeConfig } from "./config/RuntimeConfig.js";
export { createA2ARouter } from "./a2a/index.js";
export type { A2ATask, A2AMessage, JsonRpcRequest } from "./a2a/index.js";

// Flags
export type { FeatureFlags } from "./flags/featureFlags.js";
export { readFeatureFlags } from "./flags/featureFlags.js";
export type { ModeSettings } from "./flags/modes.js";
export { buildModeSettings } from "./flags/modes.js";


