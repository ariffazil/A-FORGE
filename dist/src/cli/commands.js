import { resolve } from "node:path";
import { buildCoordinatorProfile, buildExploreProfile, buildFixProfile, buildTestProfile, } from "../agents/profiles.js";
import { CoordinatorAgent } from "../agents/CoordinatorAgent.js";
import { WorkerAgent } from "../agents/WorkerAgent.js";
import { ForgeScoreboard } from "../scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../scoreboard/RunMetricsLogger.js";
function getMode(options, runtimeConfig) {
    if (options.mode === "internal") {
        return "internal_mode";
    }
    if (options.mode === "external") {
        return "external_safe_mode";
    }
    return runtimeConfig.defaultMode;
}
function applyTrustLocalVps(profile, runtimeConfig) {
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
export async function runCliCommand(command, options, engineFactory, llmProviderFactory, runtimeConfig) {
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
        return (await engineFactory(profile).run({
            task: `${issue}\nTarget file: ${file}`,
            workingDirectory: cwd,
            taskCommand: "fix",
            taskType: "bugfix",
            testsPassed: toBooleanOption(options["tests-passed"]),
            ...baseTaskOptions,
        })).finalText;
    }
    if (command === "explore") {
        const goal = String(options.goal ?? "Explain this repository.");
        const profile = applyTrustLocalVps(buildExploreProfile(modeName), runtimeConfig);
        return (await engineFactory(profile).run({
            task: goal,
            workingDirectory: cwd,
            taskCommand: "explore",
            taskType: "explore",
            ...baseTaskOptions,
        })).finalText;
    }
    if (command === "test") {
        const task = String(options.goal ?? "Run the test suite and summarize the result.");
        const profile = applyTrustLocalVps(buildTestProfile(modeName), runtimeConfig);
        return (await engineFactory(profile).run({
            task,
            workingDirectory: cwd,
            taskCommand: "test",
            taskType: "test",
            testsPassed: toBooleanOption(options["tests-passed"]),
            ...baseTaskOptions,
        })).finalText;
    }
    if (command === "coordinate") {
        const startedAt = new Date();
        const goal = String(options.goal ?? "Coordinate the requested engineering task.");
        const coordinatorProfile = applyTrustLocalVps(buildCoordinatorProfile(modeName), runtimeConfig);
        const workerAgent = new WorkerAgent((task) => engineFactory(applyTrustLocalVps(task.profile, runtimeConfig)));
        const coordinator = new CoordinatorAgent(coordinatorProfile, workerAgent, llmProviderFactory());
        const coordinated = await coordinator.coordinate(goal, cwd);
        const completedAt = new Date();
        const taskId = (typeof options["task-id"] === "string" ? options["task-id"] : undefined) ??
            `coordinate-${startedAt.getTime()}`;
        const successful = coordinated.metrics.coordinationFailures === 0 ? 1 : 0;
        const trustMode = runtimeConfig.trustLocalVps
            ? "local_vps"
            : "default";
        const record = {
            taskId,
            taskType: "feature",
            taskCommand: "coordinate",
            profileName: coordinatorProfile.name,
            sessionId: taskId,
            createdAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            taskCompletion: successful,
            trustMode,
            passAt1: successful,
            passAtK: successful,
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
            testsPassed: successful,
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
    if (command === "scoreboard") {
        const period = String(options.period ?? "weekly");
        if (period !== "weekly") {
            throw new Error(`Unsupported scoreboard period: ${period}`);
        }
        const taskCommand = typeof options.command === "string" ? options.command : undefined;
        const trustMode = options["trust-mode"] === "local_vps" || options["trust-mode"] === "default"
            ? options["trust-mode"]
            : undefined;
        return JSON.stringify(await scoreboard.summarizeCurrentWeek(new Date(), {
            taskCommand,
            trustMode,
        }), null, 2);
    }
    return [
        "Usage:",
        "  agent explore --goal \"explain this repo\" [--mode internal|external] [--cwd path]",
        "  agent fix --file src/file.ts [--issue \"what to fix\"] [--mode internal|external] [--cwd path]",
        "  agent test [--goal \"what to validate\"] [--mode internal|external] [--cwd path]",
        "  agent coordinate --goal \"ship this feature\" [--mode internal|external] [--cwd path]",
        "  agent scoreboard [--period weekly] [--command explore|fix|test|coordinate] [--trust-mode local_vps|default]",
        "Environment:",
        "  AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 enables internal mode, dangerous tools, and broad command policy defaults for your own VPS.",
    ].join("\n");
}
function toNumberOption(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function toBooleanOption(value) {
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
