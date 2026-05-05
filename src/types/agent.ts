import type { ToolSchema } from "./tool.js";

export type AgentModeName = "internal_mode" | "external_safe_mode";

export type AgentBudget = {
  tokenCeiling: number;
  maxTurns: number;
  perTurnTokenLimit?: number;
};

export type BudgetStatus = {
  totalTokensUsed: number;
  totalCostUsd: number;
  usagePercent: number;
  turnsRemaining: number;
  shouldDownshift: boolean;
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
  intentModel?: "informational" | "advisory" | "execution" | "speculative";
  riskLevel?: "low" | "medium" | "high" | "critical";
  humanApprovedTicketId?: string;
  metadata?: Record<string, unknown>;
  planDAG?: import("./plan.js").PlanDAG;
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
  totalCostUsd: number;
  turnsRemaining: number;
  wallClockMs: number;
  completion: boolean;
  testsPassed: boolean;
  genius_G?: number;
  apex_Dials?: { A: number; P: number; X: number; E: number };
  errorMessage?: string;
};
