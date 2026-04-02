import type { ToolExecutionContext, ToolPermissionContext, ToolResult, ToolRiskLevel, ToolSchema } from "../types/tool.js";
export interface Tool {
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolSchema;
    readonly riskLevel: ToolRiskLevel;
    readonly experimental?: boolean;
    run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
    isPermitted(permissionContext: ToolPermissionContext): boolean;
}
export declare abstract class BaseTool implements Tool {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: ToolSchema;
    abstract readonly riskLevel: ToolRiskLevel;
    readonly experimental = false;
    isPermitted(permissionContext: ToolPermissionContext): boolean;
    abstract run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
