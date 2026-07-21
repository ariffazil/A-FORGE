/**
 * Shell Tools — forge_shell, run_tests, run_command
 *
 * Executes shell commands and instruments every call with world model
 * metadata per the AGENTIC-WORLD-MODEL-EUREKA architecture:
 *   - action_hash (sha256 of tool+args)
 *   - observation_hash (sha256 of output)
 *   - surprise_score (gap between expected vs actual)
 *   - wm_eligible flag (L3 + L4 gates)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../../domain/types/tool.js";
import {
  actionHash,
  observationHash,
  computeSurpriseScore,
  computeWMEligibility,
  TOOL_WM_PRIORITY,
} from "./WorldModelTypes.js";
import { appendTrajectory } from "./WorldModelTrajectoryLogger.js";

const execAsync = promisify(exec);

// ── WM Instrumentation Wrapper ────────────────

async function withWorldModel(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  execute: () => Promise<Omit<ToolResult, "wm">>,
): Promise<ToolResult> {
  const startTime = Date.now();
  const priority = TOOL_WM_PRIORITY[toolName] ?? 2; // default P2 for unknown
  const aHash = actionHash(toolName, args);

  // Agent confidence: 0.7 if expected output provided, else -1 (no prediction)
  const agentConfidence = context.expectedOutput ? 0.7 : -1;

  let result: Omit<ToolResult, "wm">;
  try {
    result = await execute();
  } catch (err) {
    const errorOutput = err instanceof Error ? err.message : String(err);
    const obsHash = observationHash(errorOutput);
    const surprise = computeSurpriseScore(context.expectedOutput, errorOutput);
    // Failed commands: always eligible (teaches what breaks)
    const failedResult: ToolResult = {
      ok: false,
      output: errorOutput,
      wm: {
        tool_priority: priority,
        action_hash: aHash,
        observation_hash: obsHash,
        agent_confidence: agentConfidence,
        observation_entropy: surprise,
        surprise_score: surprise,
        wm_eligible: true, // failures are always informative
      },
    };
    await logTrajectory(failedResult, toolName, args, context);
    return failedResult;
  }

  const obsHash = observationHash(result.output);
  const surprise = computeSurpriseScore(context.expectedOutput, result.output);
  const eligible = computeWMEligibility(priority, surprise, agentConfidence);

  const wmResult: ToolResult = {
    ...result,
    wm: {
      tool_priority: priority,
      action_hash: aHash,
      observation_hash: obsHash,
      agent_confidence: agentConfidence,
      observation_entropy: surprise,
      surprise_score: surprise,
      wm_eligible: eligible,
    },
  };

  // Fire-and-forget trajectory log (don't block the tool return)
  logTrajectory(wmResult, toolName, args, context).catch(() => {});

  return wmResult;
}

async function logTrajectory(
  result: ToolResult,
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<void> {
  if (!result.wm) return;
  try {
    await appendTrajectory({
      timestamp: new Date().toISOString(),
      session_id: context.sessionId,
      tool_name: toolName,
      args: JSON.stringify(args),
      wm: {
        action_hash: result.wm.action_hash,
        observation_hash: result.wm.observation_hash,
        tool_priority: result.wm.tool_priority,
        agent_confidence: result.wm.agent_confidence,
        observation_entropy: result.wm.observation_entropy,
        surprise_score: result.wm.surprise_score,
        wm_eligible: result.wm.wm_eligible,
      },
      observation: result.output.slice(0, 10_000), // cap observation length
      ok: result.ok,
      duration_ms: 0, // approximate
    });
  } catch {
    // Silent — trajectory logging should never crash the tool
  }
}

// ── Shell Execution ───────────────────────────

async function runShell(command: string, context: ToolExecutionContext): Promise<ToolResult> {
  // Policy enforcement
  const normalized = command.trim().toLowerCase();
  const blockedPatterns = context.policy?.blockedCommandPatterns ?? [];
  const matchedBlockedPattern = blockedPatterns.find((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );
  if (matchedBlockedPattern) {
    throw new Error(`Command blocked by policy: ${matchedBlockedPattern}`);
  }

  const { stdout, stderr } = await execAsync(command, {
    cwd: context.workingDirectory,
    maxBuffer: 1024 * 1024,
    signal: context.abortSignal,
    timeout: context.policy?.commandTimeoutMs ?? 30000,
  });

  return {
    ok: true,
    output: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n"),
    metadata: { command },
  };
}

// ── Tools ─────────────────────────────────────

export class RunTestsTool extends BaseTool {
  readonly name = "run_tests";
  readonly description =
    "Run the project test command. Supports world model prediction — " +
    "provide expectedOutput in context for surprise scoring.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      command: {
        type: "string" as const,
        description: "Optional test command. Defaults to npm test.",
      },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const command = String(args.command ?? "npm test");
    const allowedPrefixes = context.policy?.allowedCommandPrefixes ?? [];
    const isAllowed =
      allowedPrefixes.includes("*") ||
      allowedPrefixes.some((prefix) => command.startsWith(prefix));
    if (!isAllowed) {
      throw new Error(`Test command is not allowed by policy: ${command}`);
    }
    return withWorldModel(this.name, { command }, context, () =>
      runShell(command, context),
    );
  }
}

export class RunCommandTool extends BaseTool {
  readonly name = "run_command";
  readonly description =
    "Run an arbitrary shell command in the working directory. " +
    "World model: prediction gap between expected and actual output is logged.";
  readonly riskLevel = "dangerous" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      command: {
        type: "string" as const,
        description: "Shell command to execute.",
      },
    },
    required: ["command"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const command = String(args.command);
    return withWorldModel(this.name, { command }, context, () =>
      runShell(command, context),
    );
  }
}

/**
 * forge_shell — the canonical terminal tool with full WM instrumentation.
 * This is the primary surface for P0 world model data collection.
 */
export class ForgeShellTool extends BaseTool {
  readonly name = "forge_shell";
  readonly description =
    "Execute a shell command with full world model instrumentation. " +
    "Action→observation pairs are hash-chained and logged for future ECHO/PaW training. " +
    "Set expectedOutput in context to measure prediction-vs-reality gap (L3).";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      command: {
        type: "string" as const,
        description: "Shell command to execute.",
      },
      expected_output: {
        type: "string" as const,
        description:
          "OPTIONAL: what the agent expects this command to produce. " +
          "Used for world model surprise scoring. The gap between this and actual output " +
          "is the richest training signal per AGENTIC-WORLD-MODEL-EUREKA L3.",
      },
    },
    required: ["command"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const command = String(args.command);

    // If expected_output is provided as an arg, override context
    const expectedOutput = args.expected_output
      ? String(args.expected_output)
      : context.expectedOutput;

    const ctx: ToolExecutionContext = {
      ...context,
      expectedOutput,
    };

    return withWorldModel(this.name, { command }, ctx, () =>
      runShell(command, ctx),
    );
  }
}
