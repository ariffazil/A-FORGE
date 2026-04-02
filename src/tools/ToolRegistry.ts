import type { Tool } from "./base.js";
import type {
  ToolExecutionContext,
  ToolPermissionContext,
  ToolResult,
} from "../types/tool.js";
import type { ToolDefinitionForModel } from "../types/agent.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  listForModel(permissionContext: ToolPermissionContext): ToolDefinitionForModel[] {
    return [...this.tools.values()]
      .filter((tool) => tool.isPermitted(permissionContext))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
  }

  async runTool(
    toolName: string,
    args: Record<string, unknown>,
    executionContext: ToolExecutionContext,
    permissionContext: ToolPermissionContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (!tool.isPermitted(permissionContext)) {
      throw new Error(`Tool is not permitted in this profile or mode: ${toolName}`);
    }

    return tool.run(args, executionContext);
  }
}
