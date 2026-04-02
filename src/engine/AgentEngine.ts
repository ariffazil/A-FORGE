import { randomUUID } from "node:crypto";
import type {
  AgentMessage,
  AgentProfile,
  AgentRunResult,
  EngineRunOptions,
  LlmTurnResponse,
} from "../types/agent.js";
import type { ToolPermissionContext } from "../types/tool.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { BudgetManager } from "./BudgetManager.js";
import { ShortTermMemory } from "../memory/ShortTermMemory.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { resolveWorkingDirectory } from "../utils/paths.js";
import { redactForExternalMode } from "./redact.js";
import { buildModeSettings } from "../flags/modes.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import type { FeatureFlags } from "../flags/featureFlags.js";
import type { ToolPolicyConfig } from "../config/RuntimeConfig.js";
import { ForgeScoreboard } from "../scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../scoreboard/RunMetricsLogger.js";
import type { ForgeTaskRecord } from "../types/scoreboard.js";

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

export class AgentEngine {
  constructor(
    private readonly profile: AgentProfile,
    private readonly dependencies: AgentEngineDependencies,
  ) {}

  async run(options: EngineRunOptions): Promise<AgentRunResult> {
    const startedAt = new Date();
    const sessionId = options.sessionId ?? randomUUID();
    const workingDirectory = resolveWorkingDirectory(options.workingDirectory);
    const shortTermMemory = new ShortTermMemory();
    const budgetManager = new BudgetManager(this.profile.budget);
    const modeSettings = buildModeSettings(this.profile.modeName);
    const permissionContext: ToolPermissionContext = {
      enabledTools: new Set(modeSettings.filterAllowedTools(this.profile.allowedTools)),
      dangerousToolsEnabled:
        modeSettings.allowDangerousTools &&
        (this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
      experimentalToolsEnabled:
        modeSettings.allowExperimentalTools &&
        (this.dependencies.featureFlags?.ENABLE_EXPERIMENTAL_TOOLS ?? false),
    };

    shortTermMemory.append({
      role: "system",
      content: this.profile.systemPrompt,
    });
    const relevantMemories = await this.dependencies.longTermMemory.searchRelevant(options.task);
    const initialMessages: AgentMessage[] = [];
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .map((record, index) => `Memory ${index + 1}: ${record.summary}`)
        .join("\n");

      const memoryMessage: AgentMessage = {
        role: "system",
        content: `Relevant past task summaries:\n${memoryContext}`,
      };
      shortTermMemory.append(memoryMessage);
      initialMessages.push(memoryMessage);
    }

    const userMessage: AgentMessage = {
      role: "user",
      content: modeSettings.transformOutgoingText(options.task),
    };
    shortTermMemory.append(userMessage);
    initialMessages.push(userMessage);

    let finalResponse = "";
    let turnCount = 0;
    let previousResponseId: string | undefined;
    let pendingMessages = initialMessages;
    let toolCallCount = 0;
    const toolCallsByType: Record<string, number> = {};
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let timeoutEvents = 0;
    let restrictedPathAttempts = 0;
    let responsesCalls = 0;
    let toolCallParseFailures = 0;
    let previousResponseResumes = 0;
    let llmTokensIn = 0;
    let llmTokensOut = 0;
    let errorMessage: string | undefined;
    const memoryInjectedItems = relevantMemories.length;
    const memoryInjectedBytes = Buffer.byteLength(
      relevantMemories.map((record) => record.summary).join("\n"),
      "utf8",
    );

    try {
      while (turnCount < this.profile.budget.maxTurns) {
        turnCount += 1;
        responsesCalls += 1;
        const turnResponse = await this.dependencies.llmProvider.completeTurn({
          profile: this.profile,
          messages: pendingMessages,
          tools: this.dependencies.toolRegistry.listForModel(permissionContext),
          previousResponseId,
        });

        budgetManager.addUsage(turnResponse.usage.inputTokens, turnResponse.usage.outputTokens);
        llmTokensIn += turnResponse.usage.inputTokens;
        llmTokensOut += turnResponse.usage.outputTokens;
        toolCallParseFailures += turnResponse.providerMetrics?.toolCallParseFailures ?? 0;
        previousResponseResumes += turnResponse.providerMetrics?.resumedWithPreviousResponseId ? 1 : 0;
        budgetManager.assertWithinBudget();
        previousResponseId = turnResponse.responseId;

        const assistantMessage: AgentMessage = {
          role: "assistant",
          content: modeSettings.transformIncomingText(turnResponse.content),
        };
        shortTermMemory.append(assistantMessage);

        if (turnResponse.toolCalls.length === 0) {
          finalResponse = turnResponse.content;
          break;
        }

        toolCallCount += turnResponse.toolCalls.length;
        for (const call of turnResponse.toolCalls) {
          toolCallsByType[call.toolName] = (toolCallsByType[call.toolName] ?? 0) + 1;
        }
        const toolExecution = await this.executeToolCalls(
          turnResponse,
          shortTermMemory,
          permissionContext,
          sessionId,
          workingDirectory,
        );
        pendingMessages = toolExecution.messages;
        blockedDangerousActions += toolExecution.blockedDangerousActions;
        blockedCommands += toolExecution.blockedCommands;
        timeoutEvents += toolExecution.timeoutEvents;
        restrictedPathAttempts += toolExecution.restrictedPathAttempts;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      finalResponse = `Run failed: ${errorMessage}`;
    }

    if (!finalResponse) {
      finalResponse = "Stopped because the maximum turn count was reached.";
    }

    await this.dependencies.longTermMemory.store({
      id: sessionId,
      summary: finalResponse,
      keywords: extractKeywords(options.task, finalResponse),
      createdAt: new Date().toISOString(),
      metadata: {
        profile: this.profile.name,
        turnCount,
      },
    });

    const testsPassed = options.testsPassed ?? inferTestsPassed(this.profile.name, finalResponse, !errorMessage);
    const completion = !errorMessage && !finalResponse.startsWith("Stopped because");
    const wallClockMs = Date.now() - startedAt.getTime();
    const metrics = {
      taskSuccess: completion && testsPassed ? 1 : 0,
      turnsUsed: turnCount,
      toolCalls: toolCallCount,
      toolCallsByType,
      responsesCalls,
      toolCallParseFailures,
      previousResponseResumes,
      memoryInjectedItems,
      memoryInjectedBytes,
      memoryUsedReferences: countMemoryReferences(shortTermMemory.getMessages()),
      plannerSubtasks: Number(options.metadata?.plannerSubtasks ?? 0),
      workerSuccessRate: Number(options.metadata?.workerSuccessRate ?? 0),
      coordinationFailures: Number(options.metadata?.coordinationFailures ?? 0),
      trustMode: this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ? "local_vps" : "default",
      blockedDangerousActions,
      blockedCommands,
      timeoutEvents,
      restrictedPathAttempts,
      llmTokensIn,
      llmTokensOut,
      llmCost: this.estimateApiCost(llmTokensIn, llmTokensOut),
      wallClockMs,
      completion,
      testsPassed,
      errorMessage,
    } as const;
    const result: AgentRunResult = {
      sessionId,
      finalText: finalResponse,
      turnCount,
      totalEstimatedTokens: budgetManager.getTotalEstimatedTokens(),
      transcript: shortTermMemory.getMessages(),
      metrics,
    };

    if (this.dependencies.scoreboard) {
      await this.dependencies.scoreboard.append(
        buildTaskRecord(
          options,
          this.profile.name,
          result,
          startedAt,
          metrics.llmCost,
        ),
      );
    }

    if (this.dependencies.runMetricsLogger) {
      await this.dependencies.runMetricsLogger.log(options.taskId ?? sessionId, {
        taskId: options.taskId ?? sessionId,
        command: options.taskCommand ?? this.profile.name,
        taskType: options.taskType ?? inferTaskType(this.profile.name),
        sessionId,
        metrics,
      });
    }

    return result;
  }

  private async executeToolCalls(
    turnResponse: LlmTurnResponse,
    shortTermMemory: ShortTermMemory,
    permissionContext: ToolPermissionContext,
    sessionId: string,
    workingDirectory: string,
  ): Promise<{
    messages: AgentMessage[];
    blockedDangerousActions: number;
    blockedCommands: number;
    timeoutEvents: number;
    restrictedPathAttempts: number;
  }> {
    const toolMessages: AgentMessage[] = [];
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let timeoutEvents = 0;
    let restrictedPathAttempts = 0;

    for (const call of turnResponse.toolCalls) {
      let toolMessage: AgentMessage;
      try {
        const toolResult = await this.dependencies.toolRegistry.runTool(
          call.toolName,
          call.args,
          {
            sessionId,
            workingDirectory,
            modeName: this.profile.modeName,
            policy: this.dependencies.toolPolicy,
          },
          permissionContext,
        );

        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: redactForExternalMode(toolResult.output, this.profile.modeName),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isBlockedActionMessage(message)) {
          blockedDangerousActions += 1;
        }
        if (/blocked by policy/i.test(message)) {
          blockedCommands += 1;
        }
        if (/timed? out|timeout/i.test(message)) {
          timeoutEvents += 1;
        }
        if (/escapes the working directory sandbox/i.test(message)) {
          restrictedPathAttempts += 1;
        }
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `Tool error: ${message}`,
        };
      }

      shortTermMemory.append(toolMessage);
      toolMessages.push(toolMessage);
    }

    return {
      messages: toolMessages,
      blockedDangerousActions,
      blockedCommands,
      timeoutEvents,
      restrictedPathAttempts,
    };
  }

  private estimateApiCost(inputTokens: number, outputTokens: number): number {
    const pricing = this.dependencies.apiPricing;
    if (!pricing) {
      return 0;
    }

    return (
      (inputTokens / 1_000_000) * pricing.inputCostPerMillionTokens +
      (outputTokens / 1_000_000) * pricing.outputCostPerMillionTokens
    );
  }
}

function extractKeywords(task: string, response: string): string[] {
  const words = `${task} ${response}`
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/g)
    .filter((word) => word.length >= 4);

  return [...new Set(words)].slice(0, 16);
}

function isBlockedActionMessage(message: string): boolean {
  return /not permitted|blocked by policy|escapes the working directory sandbox/i.test(message);
}

function inferTestsPassed(profileName: string, finalText: string, completed: boolean): boolean {
  if (!completed) {
    return false;
  }

  if (profileName === "test") {
    return !/fail|error|not ok/i.test(finalText);
  }

  return completed;
}

function buildTaskRecord(
  options: EngineRunOptions,
  profileName: string,
  result: AgentRunResult,
  startedAt: Date,
  codexApiCost: number,
): ForgeTaskRecord {
  const completedAt = new Date();
  const passAt1 = result.metrics.testsPassed && (options.attemptNumber ?? 1) === 1 ? 1 : 0;
  const passAtK = result.metrics.testsPassed ? 1 : 0;

  return {
    taskId: options.taskId ?? result.sessionId,
    taskType: options.taskType ?? inferTaskType(profileName),
    taskCommand: options.taskCommand ?? profileName,
    profileName,
    sessionId: result.sessionId,
    createdAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    taskCompletion: result.metrics.completion ? 1 : 0,
    trustMode: result.metrics.trustMode,
    passAt1,
    passAtK,
    codexTurns: result.turnCount,
    toolCalls: result.metrics.toolCalls,
    toolCallsByType: result.metrics.toolCallsByType,
    responsesCalls: result.metrics.responsesCalls,
    toolCallParseFailures: result.metrics.toolCallParseFailures,
    previousResponseResumes: result.metrics.previousResponseResumes,
    memoryInjectedItems: result.metrics.memoryInjectedItems,
    memoryInjectedBytes: result.metrics.memoryInjectedBytes,
    memoryUsedReferences: result.metrics.memoryUsedReferences,
    plannerSubtasks: result.metrics.plannerSubtasks,
    workerSuccessRate: result.metrics.workerSuccessRate,
    coordinationFailures: result.metrics.coordinationFailures,
    blockedDangerousActions: result.metrics.blockedDangerousActions,
    blockedCommands: result.metrics.blockedCommands,
    timeoutEvents: result.metrics.timeoutEvents,
    restrictedPathAttempts: result.metrics.restrictedPathAttempts,
    totalEstimatedTokens: result.totalEstimatedTokens,
    llmTokensIn: result.metrics.llmTokensIn,
    llmTokensOut: result.metrics.llmTokensOut,
    codexApiCost,
    wallClockMs: result.metrics.wallClockMs,
    humanMinutes: options.humanMinutes ?? 0,
    testsPassed: result.metrics.testsPassed ? 1 : 0,
    lintIssuesDelta: options.lintIssuesDelta ?? 0,
    errorMessage: result.metrics.errorMessage,
    metadata: {
      maxAttempts: options.maxAttempts ?? 1,
    },
  };
}

function inferTaskType(profileName: string): ForgeTaskRecord["taskType"] {
  switch (profileName) {
    case "fix":
      return "bugfix";
    case "test":
      return "test";
    case "explore":
      return "explore";
    default:
      return "other";
  }
}

function countMemoryReferences(messages: AgentMessage[]): number {
  return messages.filter(
    (message) => message.role === "assistant" && /\bmemory\b/i.test(message.content),
  ).length;
}
