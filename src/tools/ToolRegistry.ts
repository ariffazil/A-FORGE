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

    // === F13 Sovereign + F1 Amanah: 888_HOLD gate for dangerous tools ===
    if (tool.riskLevel === "dangerous") {
      if (!permissionContext.holdEnabled) {
        return {
          ok: false,
          output: `[888_HOLD] Tool '${toolName}' requires explicit human approval (F13 Sovereign). Enable AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 for local trusted mode.`,
          metadata: { hold: true, floor: "F13", toolName },
        };
      }
      // F1 Amanah: audit every dangerous execution regardless of outcome
      process.stderr.write(
        `[F1_AMANAH|888_HOLD] DANGEROUS TOOL EXECUTED` +
        ` | tool=${toolName}` +
        ` | session=${executionContext.sessionId}` +
        ` | mode=${executionContext.modeName}` +
        ` | args=${JSON.stringify(args)}\n`,
      );
    }

    return tool.run(args, executionContext);
  }
}
