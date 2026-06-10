import type { ForgeScoreboard } from "../scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../scoreboard/RunMetricsLogger.js";
import type { ForgeTaskRecord } from "../types/scoreboard.js";
import type { EngineRunOptions, AgentRunResult } from "../types/agent.js";

export class RunReporter {
  constructor(
    private readonly scoreboard?: ForgeScoreboard,
    private readonly runMetricsLogger?: RunMetricsLogger,
  ) {}

  async reportRun(
    options: EngineRunOptions,
    profileName: string,
    result: AgentRunResult,
    startedAt: Date,
    codexApiCost: number,
  ): Promise<void> {
    if (this.scoreboard) {
      await this.scoreboard.append(
        buildTaskRecord(options, profileName, result, startedAt, codexApiCost),
      );
    }

    if (this.runMetricsLogger) {
      await this.runMetricsLogger.log(options.taskId ?? result.sessionId, {
        taskId: options.taskId ?? result.sessionId,
        command: options.taskCommand ?? profileName,
        taskType: options.taskType ?? inferTaskType(profileName),
        sessionId: result.sessionId,
        metrics: result.metrics,
      });
    }
  }
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
