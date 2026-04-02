import { stat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BaseTool } from "./base.js";
import { resolveSandboxedPath } from "../utils/paths.js";
function resolveTargetPath(context, filePath) {
    return resolveSandboxedPath(context.workingDirectory, filePath);
}
export class ReadFileTool extends BaseTool {
    name = "read_file";
    description = "Read a UTF-8 text file from the working directory.";
    riskLevel = "safe";
    parameters = {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative path to the file to read.",
            },
        },
        required: ["path"],
        additionalProperties: false,
    };
    async run(args, context) {
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
    name = "write_file";
    description = "Write UTF-8 text to a file in the working directory.";
    riskLevel = "guarded";
    parameters = {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative path to the file to write.",
            },
            content: {
                type: "string",
                description: "UTF-8 content to write.",
            },
        },
        required: ["path", "content"],
        additionalProperties: false,
    };
    async run(args, context) {
        const targetPath = resolveTargetPath(context, String(args.path ?? ""));
        const content = String(args.content ?? "");
        if (Buffer.byteLength(content, "utf8") > (context.policy?.maxFileBytes ?? 262144)) {
            throw new Error(`Refusing to write file above size limit: ${targetPath}`);
        }
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, "utf8");
        return {
            ok: true,
            output: `Wrote file: ${targetPath}`,
            metadata: { path: targetPath },
        };
    }
}
export class ListFilesTool extends BaseTool {
    name = "list_files";
    description = "List files and folders for a relative directory.";
    riskLevel = "safe";
    parameters = {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Relative directory path to list. Defaults to the working directory root.",
            },
        },
        additionalProperties: false,
    };
    async run(args, context) {
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
