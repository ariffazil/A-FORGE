import { exec } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";

const execAsync = promisify(exec);

async function runShell(command: string, context: ToolExecutionContext): Promise<ToolResult> {
  enforceCommandPolicy(command, context);
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

function enforceCommandPolicy(command: string, context: ToolExecutionContext): void {
  const normalized = command.trim().toLowerCase();
  const blockedPatterns = context.policy?.blockedCommandPatterns ?? [];
  const matchedBlockedPattern = blockedPatterns.find((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );

  if (matchedBlockedPattern) {
    throw new Error(`Command blocked by policy: ${matchedBlockedPattern}`);
  }
}

export class RunTestsTool extends BaseTool {
  readonly name = "run_tests";
  readonly description = "Run the project test command.";
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
    return runShell(command, context);
  }
}

export class RunCommandTool extends BaseTool {
  readonly name = "run_command";
  readonly description = "Run an arbitrary shell command in the working directory.";
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
    return runShell(String(args.command ?? ""), context);
  }
}
