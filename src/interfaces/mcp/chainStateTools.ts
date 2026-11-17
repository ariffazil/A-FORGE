/**
 * chainStateTools.ts — forge_chain_state: THE read surface for chain liveness.
 *
 * REPAIR R5 (ghost heartbeat). Before this tool, every consumer computed its
 * own silence number from whatever file was nearest — producing 94.8h, 147.6h
 * and 189.2h for ONE canonical chain, plus a phantom "head seq 72" no chain
 * row carries. There is now exactly one computer (src/domain/governance/
 * chain-state.ts) and exactly one tool exposing it.
 *
 * The tool READS ONLY. It never writes any chain, never "fixes" a head file,
 * and never merges declared with observed — it reports their divergence as a
 * finding so the disagreement itself stays visible (reality-grounding law:
 * do not average conflicting instruments).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { computeChainHeartbeat } from "../../domain/governance/chain-state.js";

export function registerChainStateTool(server: McpServer): void {
  server.tool(
    "forge_chain_state",
    "Canonical VAULT999 chain heartbeat — computed from chain bytes at read time. Returns ONE silence number (hours since newest record), phantom-seq detection (declared head seq vs seq fields actually present in rows), and declared-vs-observed divergence findings. Supersedes every ad-hoc heartbeat computation; do not compute silence from seal_chain_head.json or tasks.json — read this. Read-only (OBSERVE class).",
    {
      stale_threshold_h: z.number().default(72).describe("Hours without a new record before status=STALE (default 72)"),
      silent_threshold_h: z.number().default(168).describe("Hours without a new record before status=SILENT (default 168 = 1 week)"),
    },
    async ({ stale_threshold_h: staleH, silent_threshold_h: silentH }) => {
      const hb = computeChainHeartbeat({
        stale_threshold_h: staleH,
        silent_threshold_h: silentH,
      });

      const body = {
        tool: "forge_chain_state",
        schema: "arifos.aforge.chain_state.v1",
        // THE canonical number — consumers branch on heartbeat.status and quote
        // heartbeat.hours_since_newest. Nothing else in the federation may
        // compute a chain-silence figure.
        heartbeat: hb,
        _epistemic: {
          output_class: "DOMAIN_COMPUTATION",
          ai_involvement: "NONE",
          authority_claim: "ADVISORY",
          evidence_source: hb.source ? `OBS:${hb.source}` : "UNMEASURED",
          note: "hours_since_newest is measured from canonical chain bytes (OBS timestamp, DER arithmetic). Declared head-file values are reported under heartbeat.declared for divergence auditing only — never the math.",
        },
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(body, null, 2),
        }],
        isError: false,
      };
    },
  );
}
