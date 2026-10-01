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
    // S6 (F13 order 2026-10-01): was geox_mcp.geox_subsurface_generate_candidates,
    // a name that exists on no live GEOX surface (GEOX was probed: 26 live tools).
    // The header comment claimed alignment to a "canonical 37-tool surface" — that
    // generation has since been consolidated into union tools, so the alignment
    // rotted. Canonical target is geox_petrophysics, which declares exactly the
    // two params this bridge already passes (target_class, evidence_refs).
    // GEOX enforces Federation Contract §7 lane rules — JUDGMENT-lane tools
    // reject direct agent calls with LANE_ENFORCEMENT verdict=HOLD — so the call
    // goes through the kernel bridge, verified live (status=routed, port 8081).
    const petroArgs = {
      target_class: args.target_class ?? "petrophysics",
      evidence_refs: args.evidence_refs ?? [],
      ...args,
    };
    const result = await callMCP("arifos.arif_route", {
      mode: "bridge",
      organ: "geox",
      organ_tool: "geox_petrophysics",
      arguments: petroArgs,
      actor_id: "A-FORGE",
    });
    return { ok: true, output: JSON.stringify(result) };
  }
}

/**
 * S6 (F13 order 2026-10-01): was geox_mcp.geox_prospect_evaluate — not a live
 * verb. Deliberately NOT remapped: this returns GEOXScenarioContract[] for the
 * AgentEngine/PipelineCoordinator scenario loader, and no live GEOX tool was
 * verified to produce scenario contracts. geox_prospect(mode=screen|evaluate)
 * evaluates a *prospect*, which is a different object; substituting it would
 * feed the engine plausible-looking wrong data instead of an honest gap.
 * Callers: PipelineCoordinator.ts:243,252 · AgentEngine.ts:522,531 ·
 * port declared at domain/types/ports.ts:112.
 */
export async function getScenarios(mode: "primary" | "secondary"): Promise<unknown[]> {
  const err = new Error(
    `CAPABILITY_GAP: GEOX exposes no scenario-contract primitive for mode="${mode}". ` +
    `The previously called verb (geox_prospect_evaluate) is not on the live 26-tool GEOX ` +
    `surface. Nearest live tool is geox_prospect(mode=screen|evaluate), which evaluates a ` +
    `prospect rather than emitting scenario contracts, so it must not be substituted ` +
    `silently. This is a missing capability, NOT a GEOX outage.`,
  ) as Error & { error_code: string; source_layer: string };
  err.error_code = "CAPABILITY_GAP";
  err.source_layer = "A-FORGE::BRIDGE::GEOX";
  throw err;
}
