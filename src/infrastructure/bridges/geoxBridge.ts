/**
 * Bridge to GEOX MCP organ.
 * This file ROUTES, it does NOT compute.
 *
 * Per PHOENIX-99 INVARIANTS:
 *   LAW_001: GEOX owns geoscience computation.
 *   LAW_004: courier delivers, organ thinks.
 *
 * v2026.06.14 — All tool names aligned to canonical 37-tool surface.
 *   well_compute_petrophysics → geox_subsurface_generate_candidates(target_class="petrophysics")
 *   prospect_evaluate kept as-is (canonical).
 */

import { BaseTool } from "../../infrastructure/tools/base.js";
import type { ToolResult, ToolExecutionContext } from "../../domain/types/tool.js";
import { callMCP } from "../../interfaces/mcp/client.js";

export class GEOXLogInterpreterBridge extends BaseTool {
  readonly name = "GEOX_log_interpreter";
  readonly description = "Bridge to GEOX MCP organ for log interpretation. Routes to geox_subsurface_generate_candidates with target_class='petrophysics'.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      target_class: {
        type: "string" as const,
        description: "Subsurface interpretation target. Default: 'petrophysics'",
        default: "petrophysics",
      },
      evidence_refs: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Well log artifact references (LAS file IDs after ingest+QC). Required for appraise mode.",
      },
    },
    additionalProperties: true,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    // Route to canonical petrophysics tool: geox_subsurface_generate_candidates
    const petroArgs = {
      target_class: args.target_class ?? "petrophysics",
      evidence_refs: args.evidence_refs ?? [],
      ...args,
    };
    const result = await callMCP("geox_mcp.geox_subsurface_generate_candidates", petroArgs);
    return { ok: true, output: JSON.stringify(result) };
  }
}

export async function getScenarios(mode: "primary" | "secondary"): Promise<unknown[]> {
  return (await callMCP("geox_mcp.geox_prospect_evaluate", { mode })) as unknown[];
}
