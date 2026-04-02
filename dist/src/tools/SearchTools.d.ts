import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";
export declare class GrepTextTool extends BaseTool {
    readonly name = "grep_text";
    readonly description = "Search the working directory for a text pattern using ripgrep.";
    readonly riskLevel: "safe";
    readonly parameters: {
        type: "object";
        properties: {
            pattern: {
                type: "string";
                description: string;
            };
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
