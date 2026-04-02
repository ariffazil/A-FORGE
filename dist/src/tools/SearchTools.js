import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "./base.js";
import { resolveSandboxedPath } from "../utils/paths.js";
const execFileAsync = promisify(execFile);
export class GrepTextTool extends BaseTool {
    name = "grep_text";
    description = "Search the working directory for a text pattern using ripgrep.";
    riskLevel = "safe";
    parameters = {
        type: "object",
        properties: {
            pattern: {
                type: "string",
                description: "Pattern to search for.",
            },
            path: {
                type: "string",
                description: "Optional relative path to scope the search.",
            },
        },
        required: ["pattern"],
        additionalProperties: false,
    };
    async run(args, context) {
        const searchRoot = resolveSandboxedPath(context.workingDirectory, String(args.path ?? "."));
        const { stdout } = await execFileAsync("rg", ["-n", "--no-heading", "--max-count", "200", String(args.pattern ?? ""), searchRoot], {
            cwd: context.workingDirectory,
            maxBuffer: 1024 * 1024,
            timeout: context.policy?.commandTimeoutMs ?? 30000,
        });
        return {
            ok: true,
            output: stdout.trim() || "No matches found.",
        };
    }
}
