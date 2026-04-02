import type { Tool } from "./base.js";
import type { ToolExecutionContext, ToolPermissionContext, ToolResult } from "../types/tool.js";
import type { ToolDefinitionForModel } from "../types/agent.js";
export declare class ToolRegistry {
    private readonly tools;
    register(tool: Tool): void;
    listForModel(permissionContext: ToolPermissionContext): ToolDefinitionForModel[];
    runTool(toolName: string, args: Record<string, unknown>, executionContext: ToolExecutionContext, permissionContext: ToolPermissionContext): Promise<ToolResult>;
}
