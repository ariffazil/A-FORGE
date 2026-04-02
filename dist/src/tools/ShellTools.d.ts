import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../types/tool.js";
export declare class RunTestsTool extends BaseTool {
    readonly name = "run_tests";
    readonly description = "Run the project test command.";
    readonly riskLevel: "guarded";
    readonly parameters: {
        type: "object";
        properties: {
            command: {
                type: "string";
                description: string;
            };
        };
        additionalProperties: boolean;
    };
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
export declare class RunCommandTool extends BaseTool {
    readonly name = "run_command";
    readonly description = "Run an arbitrary shell command in the working directory.";
    readonly riskLevel: "dangerous";
    readonly parameters: {
        type: "object";
        properties: {
            command: {
                type: "string";
                description: string;
            };
        };
        required: string[];
        additionalProperties: boolean;
    };
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
