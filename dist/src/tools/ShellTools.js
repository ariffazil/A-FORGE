import { exec } from "node:child_process";
import { promisify } from "node:util";
import { BaseTool } from "./base.js";
const execAsync = promisify(exec);
async function runShell(command, context) {
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
function enforceCommandPolicy(command, context) {
    const normalized = command.trim().toLowerCase();
    const blockedPatterns = context.policy?.blockedCommandPatterns ?? [];
    const matchedBlockedPattern = blockedPatterns.find((pattern) => normalized.includes(pattern.toLowerCase()));
    if (matchedBlockedPattern) {
        throw new Error(`Command blocked by policy: ${matchedBlockedPattern}`);
    }
}
export class RunTestsTool extends BaseTool {
    name = "run_tests";
    description = "Run the project test command.";
    riskLevel = "guarded";
    parameters = {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "Optional test command. Defaults to npm test.",
            },
        },
        additionalProperties: false,
    };
    async run(args, context) {
        const command = String(args.command ?? "npm test");
        const allowedPrefixes = context.policy?.allowedCommandPrefixes ?? [];
        const isAllowed = allowedPrefixes.includes("*") ||
            allowedPrefixes.some((prefix) => command.startsWith(prefix));
        if (!isAllowed) {
            throw new Error(`Test command is not allowed by policy: ${command}`);
        }
        return runShell(command, context);
    }
}
export class RunCommandTool extends BaseTool {
    name = "run_command";
    description = "Run an arbitrary shell command in the working directory.";
    riskLevel = "dangerous";
    parameters = {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "Shell command to execute.",
            },
        },
        required: ["command"],
        additionalProperties: false,
    };
    async run(args, context) {
        return runShell(String(args.command ?? ""), context);
    }
}
