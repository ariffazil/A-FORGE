import type {
  ToolExecutionContext,
  ToolPermissionContext,
  ToolResult,
  ToolRiskLevel,
  ToolSchema,
} from "../types/tool.js";

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolSchema;
  readonly riskLevel: ToolRiskLevel;
  readonly experimental?: boolean;
  run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
  isPermitted(permissionContext: ToolPermissionContext): boolean;
}

export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolSchema;
  abstract readonly riskLevel: ToolRiskLevel;
  readonly experimental = false;

  isPermitted(permissionContext: ToolPermissionContext): boolean {
    if (!permissionContext.enabledTools.has(this.name)) {
      return false;
    }

    if (this.experimental && !permissionContext.experimentalToolsEnabled) {
      return false;
    }

    if (this.riskLevel === "dangerous" && !permissionContext.dangerousToolsEnabled) {
      return false;
    }

    return true;
  }

  abstract run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
}
