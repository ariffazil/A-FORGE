/**
 * forgeComposeTools.ts — MCP registration for Composition Bus
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 4: COMPOSITION (WIRED)
 * Registers forge_compose against A-FORGE MCP core.
 *
 * Modes:
 *   execute — Execute a composition definition (DAG-resolved)
 *   status  — Get composition state
 *   cancel  — Cancel a running composition
 *   analyze — Analyze DAG without executing (dry-run)
 *
 * Constitutional:
 *   F1 AMANAH  — reversible-first, checkpoint before each step
 *   F2 TRUTH   — each step produces a receipt
 *   F4 CLARITY — DAG is deterministic, no hidden state
 *   F11 AUDIT  — composition receipt sealed to VAULT999
 *
 * @module mcp/forgeComposeTools
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { forgeCompose } from "../../domain/composition/forge_compose.js";

/**
 * Register forge_compose as an MCP tool.
 */
export function registerComposeTools(server: McpServer): void {
  // Wrap schema as z.object so the SDK AnySchema overload matches.
  const inputSchema = z.object({
    mode: z.enum(["execute", "status", "cancel", "analyze"])
      .describe("Operation mode"),
    task: z.string().optional()
      .describe("Human-readable task description"),
    pattern: z.enum(["sequential", "parallel", "conditional", "loop", "mixed"]).optional()
      .describe("Execution pattern (DAG inferred if mixed)"),
    steps: z.array(z.object({
      id: z.string().describe("Step identifier (unique within composition)"),
      tool: z.string().describe("Tool to invoke (e.g. forge_shell, forge_postgres)"),
      args: z.record(z.string(), z.any()).optional()
        .describe("Arguments passed to the tool"),
      depends_on: z.array(z.string()).optional()
        .describe("Step IDs this step depends on"),
      when: z.string().optional()
        .describe("Conditional expression (e.g. 'previous.status == OK')"),
      max_retries: z.number().int().min(0).optional()
        .describe("Max retry attempts"),
      on_fail: z.enum(["skip", "abort"]).optional()
        .describe("What to do if step fails"),
      timeout_ms: z.number().int().min(100).optional()
        .describe("Per-step timeout"),
      organ: z.string().optional()
        .describe("Target organ (aforge, geox, wealth, well, arifos)"),
    })).optional()
      .describe("Composition steps (required for execute/analyze)"),
    merge: z.enum(["aggregate_results", "first_success", "all_required"]).optional()
      .describe("Merge strategy for parallel groups"),
    timeout_ms: z.number().int().min(100).optional()
      .describe("Total composition timeout in ms"),
    hold_id: z.string().optional()
      .describe("F13 hold_id for irreversible compositions"),
    composition_id: z.string().optional()
      .describe("Composition ID (required for status/cancel)"),
  });

  (server as any).tool(
    "forge_compose",
    "Composition Bus — orchestrate multi-tool execution across MCP servers. 4 patterns: sequential, parallel, conditional, loop. Each step produces a receipt. DAG-based resolution with cycle detection. Modes: execute, status, cancel, analyze. Constitutional: F1 AMANAH, F2 TRUTH, F4 CLARITY, F11 AUDIT.",
    inputSchema.shape,
    async (args: any) => {
      try {
        const coerced = {
          ...args,
          steps: args.steps?.map((s: any) => ({ ...s, args: s.args ?? {} })),
        };
        return await forgeCompose(coerced);
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ERROR",
              tool: "forge_compose",
              error: err?.message ?? String(err),
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}