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

    // 1. Strict Permission Check
    if (!tool.isPermitted(permissionContext)) {
      throw new Error(`Tool is not permitted in this profile or mode: ${toolName}`);
    }

    // 2. Policy Policy Enforcement (if provided)
    if (executionContext.policy) {
      const { allowedTools, blockedTools } = executionContext.policy;
      
      if (blockedTools && blockedTools.includes(toolName)) {
        throw new Error(`Tool '${toolName}' is explicitly blocked by runtime ToolPolicyConfig.`);
      }

      if (allowedTools && allowedTools.length > 0 && !allowedTools.includes(toolName)) {
         throw new Error(`Tool '${toolName}' is not in the allowlist of runtime ToolPolicyConfig.`);
      }
    }

    // 3. Mode Isolation (Internal Mode protection)
    if (executionContext.modeName !== "internal_mode" && tool.riskLevel === "dangerous") {
       throw new Error(`Critical: Dangerous tool '${toolName}' attempted outside internal_mode.`);
    }

    // === F13 Sovereign + F1 Amanah: 888_HOLD gate for dangerous tools ===
    const f13ForceHold =
      !permissionContext.humanOverride &&
      (permissionContext.riskLevel === "high" || permissionContext.riskLevel === "critical");
    if (tool.riskLevel === "dangerous") {
      if ((!permissionContext.holdEnabled && !permissionContext.humanOverride) || f13ForceHold) {
        return {
          ok: false,
          output: f13ForceHold
            ? `[888_HOLD] Tool '${toolName}' blocked by F13 Sovereign: high/critical risk level mandates human approval.`
            : `[888_HOLD] Tool '${toolName}' requires explicit human approval (F13 Sovereign). Enable AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 for local trusted mode.`,
          metadata: { hold: true, floor: "F13", toolName, riskLevel: permissionContext.riskLevel },
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
