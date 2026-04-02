import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";
export declare class ReadFileTool extends BaseTool {
    readonly name = "read_file";
    readonly description = "Read a UTF-8 text file from the working directory.";
    readonly riskLevel: "safe";
    readonly parameters: {
        type: "object";
        properties: {
            path: {
                type: "string";
                description: string;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
export declare class WriteFileTool extends BaseTool {
    readonly name = "write_file";
    readonly description = "Write UTF-8 text to a file in the working directory.";
    readonly riskLevel: "guarded";
    readonly parameters: {
        type: "object";
        properties: {
            path: {
                type: "string";
                description: string;
            };
            content: {
                type: "string";
                description: string;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
export declare class ListFilesTool extends BaseTool {
    readonly name = "list_files";
    readonly description = "List files and folders for a relative directory.";
    readonly riskLevel: "safe";
    readonly parameters: {
        type: "object";
        properties: {
            path: {
                type: "string";
                description: string;
            };
        };
        additionalProperties: boolean;
    };
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
