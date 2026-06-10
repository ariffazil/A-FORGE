import { resolve } from "node:path";
import { AgentEngine } from "../../domain/engine/AgentEngine.js";
import {
  buildCoordinatorProfile,
  buildExploreProfile,
  buildFixProfile,
  buildTestProfile,
} from "../../domain/agents/profiles.js";
import type { AgentModeName, AgentProfile, WorkerTask } from "../../domain/types/agent.js";
import { CoordinatorAgent } from "../../domain/agents/CoordinatorAgent.js";
import { WorkerAgent } from "../../domain/agents/WorkerAgent.js";
import type { LlmProvider } from "../../infrastructure/llm/LlmProvider.js";
import type { RuntimeConfig } from "../../interfaces/config/RuntimeConfig.js";
import { ForgeScoreboard } from "../../domain/scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../../domain/scoreboard/RunMetricsLogger.js";
import type { ForgeTaskRecord } from "../../domain/types/scoreboard.js";
import { getTicketStore } from "../../application/approval/index.js";
import { FileVaultClient } from "../../infrastructure/vault/index.js";
import {
  parseRiskLevel,
  parseTicketStatus,
  parseVaultVerdict,
} from "../../application/approval/filterParsing.js";

function getMode(
  options: Record<string, string | boolean>,
  runtimeConfig: RuntimeConfig,
): AgentModeName {
  if (options.mode === "internal") {
    return "internal_mode";
  }

  if (options.mode === "external") {
    return "external_safe_mode";
  }

  return runtimeConfig.defaultMode;
}

function applyTrustLocalVps(profile: AgentProfile, runtimeConfig: RuntimeConfig): AgentProfile {
  if (!runtimeConfig.trustLocalVps) {
    return profile;
  }

  return {
    ...profile,
    modeName: "internal_mode",
    allowedTools: [
      ...new Set([
        ...profile.allowedTools,
        "write_file",
        "run_tests",
        "run_command",
      ]),
    ],
  };
}

export async function runCliCommand(
  command: string,
  options: Record<string, string | boolean>,
  engineFactory: (profile: AgentProfile) => AgentEngine,
  llmProviderFactory: () => LlmProvider,
  runtimeConfig: RuntimeConfig,
): Promise<string> {
  const modeName = getMode(options, runtimeConfig);
  const cwd = typeof options.cwd === "string" ? resolve(options.cwd) : process.cwd();
  const scoreboard = new ForgeScoreboard(runtimeConfig.scoreboardPath);
  const runMetricsLogger = new RunMetricsLogger(runtimeConfig.runMetricsDir);
  const baseTaskOptions = {
    taskId: typeof options["task-id"] === "string" ? options["task-id"] : undefined,
    humanMinutes: toNumberOption(options["human-minutes"]),
    lintIssuesDelta: toNumberOption(options["lint-issues-delta"]) ?? 0,
    attemptNumber: toNumberOption(options.attempt) ?? 1,
    maxAttempts: toNumberOption(options["max-attempts"]) ?? 1,
  };

  if (command === "fix") {
    const file = String(options.file ?? "");
    const issue = String(options.issue ?? `Fix issues in ${file}.`);
    const profile = applyTrustLocalVps(buildFixProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task: `${issue}\nTarget file: ${file}`,
        workingDirectory: cwd,
        taskCommand: "fix",
        taskType: "bugfix",
        testsPassed: toBooleanOption(options["tests-passed"]),
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "explore") {
    const goal = String(options.goal ?? "Explain this repository.");
    const profile = applyTrustLocalVps(buildExploreProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task: goal,
        workingDirectory: cwd,
        taskCommand: "explore",
        taskType: "explore",
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "test") {
    const task = String(options.goal ?? "Run the test suite and summarize the result.");
    const profile = applyTrustLocalVps(buildTestProfile(modeName), runtimeConfig);
    return (
      await engineFactory(profile).run({
        task,
        workingDirectory: cwd,
        taskCommand: "test",
        taskType: "test",
        testsPassed: toBooleanOption(options["tests-passed"]),
        ...baseTaskOptions,
      })
    ).finalText;
  }

  if (command === "coordinate") {
    const startedAt = new Date();
    const goal = String(options.goal ?? "Coordinate the requested engineering task.");
    const coordinatorProfile = applyTrustLocalVps(buildCoordinatorProfile(modeName), runtimeConfig);
    const workerAgent = new WorkerAgent((task: WorkerTask) =>
      engineFactory(applyTrustLocalVps(task.profile, runtimeConfig)),
    );
    const coordinator = new CoordinatorAgent(
      coordinatorProfile,
      workerAgent,
      llmProviderFactory(),
    );

    const coordinated = await coordinator.coordinate(goal, cwd);
    const completedAt = new Date();
    const taskId =
      (typeof options["task-id"] === "string" ? options["task-id"] : undefined) ??
      `coordinate-${startedAt.getTime()}`;
    const successful = coordinated.metrics.coordinationFailures === 0 ? 1 : 0;
    const trustMode: ForgeTaskRecord["trustMode"] = runtimeConfig.trustLocalVps
      ? "local_vps"
      : "default";
    const record: ForgeTaskRecord = {
      taskId,
      taskType: "feature" as const,
      taskCommand: "coordinate",
      profileName: coordinatorProfile.name,
      sessionId: taskId,
      createdAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      taskCompletion: successful as 0 | 1,
      trustMode,
      passAt1: successful as 0 | 1,
      passAtK: successful as 0 | 1,
      codexTurns: coordinated.metrics.turnsUsed,
      toolCalls: 0,
      toolCallsByType: {},
      responsesCalls: 1,
      toolCallParseFailures: 0,
      previousResponseResumes: 0,
      memoryInjectedItems: 0,
      memoryInjectedBytes: 0,
      memoryUsedReferences: 0,
      plannerSubtasks: coordinated.metrics.plannerSubtasks,
      workerSuccessRate: coordinated.metrics.workerSuccessRate,
      coordinationFailures: coordinated.metrics.coordinationFailures,
      blockedDangerousActions: 0,
      blockedCommands: 0,
      timeoutEvents: 0,
      restrictedPathAttempts: 0,
      totalEstimatedTokens: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      codexApiCost: 0,
      wallClockMs: completedAt.getTime() - startedAt.getTime(),
      humanMinutes: baseTaskOptions.humanMinutes ?? 0,
      testsPassed: successful as 0 | 1,
      lintIssuesDelta: baseTaskOptions.lintIssuesDelta ?? 0,
      metadata: {
        maxAttempts: baseTaskOptions.maxAttempts ?? 1,
      },
    };
    await scoreboard.append(record);
    await runMetricsLogger.log(taskId, {
      taskId,
      command: "coordinate",
      taskType: "feature",
      sessionId: taskId,
      metrics: {
        taskSuccess: record.taskCompletion,
        turnsUsed: record.codexTurns,
        toolCalls: record.toolCalls,
        toolCallsByType: record.toolCallsByType,
        responsesCalls: record.responsesCalls,
        toolCallParseFailures: record.toolCallParseFailures,
        previousResponseResumes: record.previousResponseResumes,
        memoryInjectedItems: record.memoryInjectedItems,
        memoryInjectedBytes: record.memoryInjectedBytes,
        memoryUsedReferences: record.memoryUsedReferences,
        plannerSubtasks: record.plannerSubtasks,
        workerSuccessRate: record.workerSuccessRate,
        coordinationFailures: record.coordinationFailures,
        trustMode: trustMode,
        blockedDangerousActions: record.blockedDangerousActions,
        blockedCommands: record.blockedCommands,
        timeoutEvents: record.timeoutEvents,
        restrictedPathAttempts: record.restrictedPathAttempts,
        llmTokensIn: record.llmTokensIn,
        llmTokensOut: record.llmTokensOut,
        llmCost: record.codexApiCost,
        wallClockMs: record.wallClockMs,
        completion: record.taskCompletion === 1,
        testsPassed: record.testsPassed === 1,
      },
    });

    return coordinated.summary;
  }

  if (command === "operator") {
    const subcommand = String(options.cmd ?? "");
    if (subcommand === "approvals") {
      const store = getTicketStore();
      try {
        await store.initialize();
      } catch (err) {
        // Postgres unreachable — fall back to file-based store
        process.stderr.write(
          `[WARN] Ticket store initialize failed (${err instanceof Error ? err.message : String(err)}), ` +
          `falling back to FileTicketStore\n`
        );
        const { FileTicketStore } = await import("../../application/approval/TicketStore.js");
        const fileStore = new FileTicketStore();
        await fileStore.initialize();
        const status = parseTicketStatus(typeof options.status === "string" ? options.status : undefined);
        const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
        const riskLevel = parseRiskLevel(typeof options.riskLevel === "string" ? options.riskLevel : undefined);
        const tickets = await fileStore.query({ status, sessionId, riskLevel });
        return JSON.stringify({ ok: true, count: tickets.length, tickets }, null, 2);
      }
      const status = parseTicketStatus(typeof options.status === "string" ? options.status : undefined);
      const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
      const riskLevel = parseRiskLevel(typeof options.riskLevel === "string" ? options.riskLevel : undefined);
      const tickets = await store.query({
        status,
        sessionId,
        riskLevel,
      });
      return JSON.stringify({ ok: true, count: tickets.length, tickets }, null, 2);
    }
    if (subcommand === "vault") {
      const vaultClient = new FileVaultClient();
      const sessionId = typeof options.sessionId === "string" ? options.sessionId : undefined;
      const verdict = parseVaultVerdict(
        typeof options.verdict === "string" ? options.verdict : undefined,
      );
      const since = typeof options.since === "string" ? options.since : undefined;
      const until = typeof options.until === "string" ? options.until : undefined;
      const limit = toNumberOption(options.limit);
      const records = await vaultClient.query({
        sessionId,
        verdict,
        since,
        until,
        limit,
      });
      return JSON.stringify({ ok: true, count: records.length, records }, null, 2);
    }
    return [
      "Usage:",
      '  agent operator approvals [--status PENDING|DISPATCHED|APPROVED|REJECTED|MODIFY_REQUIRED|ACKED|EXPIRED|REPLAYED] [--sessionId <id>] [--riskLevel low|medium|high|critical]',
      '  agent operator vault [--verdict SEAL|HOLD|SABAR|VOID] [--sessionId <id>] [--since <iso>] [--until <iso>] [--limit <n>]',
    ].join("\n");
  }

  if (command === "scoreboard") {
    const period = String(options.period ?? "weekly");
    if (period !== "weekly") {
      throw new Error(`Unsupported scoreboard period: ${period}`);
    }

    const taskCommand =
      typeof options.command === "string" ? options.command : undefined;
    const trustMode =
      options["trust-mode"] === "local_vps" || options["trust-mode"] === "default"
        ? (options["trust-mode"] as "local_vps" | "default")
        : undefined;

    return JSON.stringify(
      await scoreboard.summarizeCurrentWeek(new Date(), {
        taskCommand,
        trustMode,
      }),
      null,
      2,
    );
  }

  return [
    "Usage:",
    "  agent explore --goal \"explain this repo\" [--mode internal|external] [--cwd path]",
    "  agent fix --file src/file.ts [--issue \"what to fix\"] [--mode internal|external] [--cwd path]",
    "  agent test [--goal \"what to validate\"] [--mode internal|external] [--cwd path]",
    "  agent coordinate --goal \"ship this feature\" [--mode internal|external] [--cwd path]",
    "  agent scoreboard [--period weekly] [--command explore|fix|test|coordinate] [--trust-mode local_vps|default]",
    "  agent operator approvals [--status <status>] [--sessionId <id>] [--riskLevel <level>]",
    "  agent operator vault [--verdict <verdict>] [--sessionId <id>] [--since <iso>] [--until <iso>] [--limit <n>]",
    "Environment:",
    "  AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 enables internal mode, dangerous tools, and broad command policy defaults for your own VPS.",
  ].join("\n");
}

function toNumberOption(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBooleanOption(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") {
      return true;
    }
    if (value === "0" || value.toLowerCase() === "false") {
      return false;
    }
  }

  return undefined;
}
