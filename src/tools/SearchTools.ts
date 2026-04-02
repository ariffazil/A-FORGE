import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";
import { resolveSandboxedPath } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

export class GrepTextTool extends BaseTool {
  readonly name = "grep_text";
  readonly description = "Search the working directory for a text pattern using ripgrep.";
  readonly riskLevel = "safe" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string" as const,
        description: "Pattern to search for.",
      },
      path: {
        type: "string" as const,
        description: "Optional relative path to scope the search.",
      },
    },
    required: ["pattern"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const searchRoot = resolveSandboxedPath(context.workingDirectory, String(args.path ?? "."));
    const { stdout } = await execFileAsync(
      "rg",
      ["-n", "--no-heading", "--max-count", "200", String(args.pattern ?? ""), searchRoot],
      {
        cwd: context.workingDirectory,
        maxBuffer: 1024 * 1024,
        timeout: context.policy?.commandTimeoutMs ?? 30000,
      },
    );

    return {
      ok: true,
      output: stdout.trim() || "No matches found.",
    };
  }
}
