/**
 * Bridge to GEOX MCP organ.
 * This file ROUTES, it does NOT compute.
 *
 * Per PHOENIX-99 INVARIANTS:
 *   LAW_001: GEOX owns geoscience computation.
 *   LAW_004: courier delivers, organ thinks.
 */

import { BaseTool } from "../tools/base.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";
import { callMCP } from "../mcp/client.js";

export class GEOXLogInterpreterBridge extends BaseTool {
  readonly name = "GEOX_log_interpreter";
  readonly description = "Bridge to GEOX MCP organ for log interpretation.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {},
    additionalProperties: true,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const result = await callMCP("geox_mcp.well_compute_petrophysics", args);
    return { ok: true, output: JSON.stringify(result) };
  }
}

export async function getScenarios(mode: "primary" | "secondary"): Promise<unknown[]> {
  return (await callMCP("geox_mcp.prospect_evaluate", { mode })) as unknown[];
}
