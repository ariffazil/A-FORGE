import type { ToolSchema } from "./tool.js";

export type AgentModeName = "internal_mode" | "external_safe_mode";

export type AgentBudget = {
  tokenCeiling: number;
  maxTurns: number;
};

export type AgentProfile = {
  name: string;
  systemPrompt: string;
  allowedTools: string[];
  budget: AgentBudget;
  modeName: AgentModeName;
};

export type AgentMessageRole = "system" | "user" | "assistant" | "tool";

export type ToolCallRequest = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type AgentMessage = {
  role: AgentMessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
};

export type ToolDefinitionForModel = {
  name: string;
  description: string;
  parameters: ToolSchema;
};

export type LlmTurnRequest = {
  profile: AgentProfile;
  messages: AgentMessage[];
  tools: ToolDefinitionForModel[];
  previousResponseId?: string;
};

export type LlmTurnResponse = {
  content: string;
  toolCalls: ToolCallRequest[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: "completed" | "tool_call" | "max_tokens";
  responseId?: string;
  providerMetrics?: {
    toolCallParseFailures: number;
    resumedWithPreviousResponseId: boolean;
  };
};

export type EngineRunOptions = {
  task: string;
  sessionId?: string;
  workingDirectory?: string;
  taskId?: string;
  taskType?: import("./scoreboard.js").ForgeTaskType;
  taskCommand?: string;
  humanMinutes?: number;
  lintIssuesDelta?: number;
  attemptNumber?: number;
  maxAttempts?: number;
  testsPassed?: boolean;
  metadata?: Record<string, unknown>;
};

export type AgentRunResult = {
  sessionId: string;
  finalText: string;
  turnCount: number;
  totalEstimatedTokens: number;
  transcript: AgentMessage[];
  metrics: RunMetrics;
};

export type WorkerTask = {
  name: string;
  task: string;
  profile: AgentProfile;
};

export type WorkerReport = {
  workerName: string;
  summary: string;
  transcript: AgentMessage[];
  success: boolean;
  turnsUsed: number;
};

export type RunMetrics = {
  taskSuccess: 0 | 1;
  turnsUsed: number;
  toolCalls: number;
  toolCallsByType: Record<string, number>;
  responsesCalls: number;
  toolCallParseFailures: number;
  previousResponseResumes: number;
  memoryInjectedItems: number;
  memoryInjectedBytes: number;
  memoryUsedReferences: number;
  plannerSubtasks: number;
  workerSuccessRate: number;
  coordinationFailures: number;
  trustMode: "local_vps" | "default";
  blockedDangerousActions: number;
  blockedCommands: number;
  timeoutEvents: number;
  restrictedPathAttempts: number;
  llmTokensIn: number;
  llmTokensOut: number;
  llmCost: number;
  wallClockMs: number;
  completion: boolean;
  testsPassed: boolean;
  errorMessage?: string;
};
