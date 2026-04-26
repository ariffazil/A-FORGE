import { stat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";
import { resolveSandboxedPath } from "../utils/paths.js";
import { AmanahLockManager } from "../governance/index.js";

function resolveTargetPath(context: ToolExecutionContext, filePath: string): string {
  return resolveSandboxedPath(context.workingDirectory, filePath);
}

export class ReadFileTool extends BaseTool {
  readonly name = "read_file";
  readonly description = "Read a UTF-8 text file from the working directory.";
  readonly riskLevel = "safe" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      path: {
        type: "string" as const,
        description: "Relative path to the file to read.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolveTargetPath(context, String(args.path ?? ""));
    const fileStat = await stat(targetPath);
    if (fileStat.size > (context.policy?.maxFileBytes ?? 262144)) {
      throw new Error(`File exceeds max readable size: ${targetPath}`);
    }
    const output = await readFile(targetPath, "utf8");
    return {
      ok: true,
      output,
      metadata: { path: targetPath },
    };
  }
}

export class WriteFileTool extends BaseTool {
  readonly name = "write_file";
  readonly description = "Write UTF-8 text to a file in the working directory.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      path: {
        type: "string" as const,
        description: "Relative path to the file to write.",
      },
      content: {
        type: "string" as const,
        description: "UTF-8 content to write.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolveTargetPath(context, String(args.path ?? ""));

    // F1 Amanah Lock check
    const amanah = AmanahLockManager.getInstance();
    const activeLock = await amanah.getActiveLock(targetPath);
    if (!activeLock) {
      return {
        ok: false,
        output: `F1 AMANAH 888-HOLD: No lock held for ${targetPath}. Call request_amanah_lock first.`,
        metadata: { path: targetPath, verdict: "888-HOLD", floor: "F1" },
      };
    }
    if (activeLock.session_id !== context.sessionId) {
      return {
        ok: false,
        output: `F1 AMANAH 888-HOLD: Resource locked by ${activeLock.actor_id} (${activeLock.lock_id}).`,
        metadata: { path: targetPath, verdict: "888-HOLD", holder: activeLock, floor: "F1" },
      };
    }

    const content = String(args.content ?? "");
    if (Buffer.byteLength(content, "utf8") > (context.policy?.maxFileBytes ?? 262144)) {
      throw new Error(`Refusing to write file above size limit: ${targetPath}`);
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
    return {
      ok: true,
      output: `Wrote file: ${targetPath}`,
      metadata: { path: targetPath, lock_id: activeLock.lock_id },
    };
  }
}

export class ListFilesTool extends BaseTool {
  readonly name = "list_files";
  readonly description = "List files and folders for a relative directory.";
  readonly riskLevel = "safe" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      path: {
        type: "string" as const,
        description: "Relative directory path to list. Defaults to the working directory root.",
      },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const targetPath = resolveTargetPath(context, String(args.path ?? "."));
    const entries = await readdir(targetPath, { withFileTypes: true });
    const output = entries
      .map((entry) => `${entry.isDirectory() ? "dir" : "file"}\t${entry.name}`)
      .join("\n");

    return {
      ok: true,
      output,
      metadata: { path: targetPath, count: entries.length },
    };
  }
}
