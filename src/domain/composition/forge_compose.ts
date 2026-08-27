/**
 * forge_compose.ts — A-FORGE tool wrapper for Composition Bus
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 4: COMPOSITION (KEYSTONE)
 * MCP tool: forge_compose
 *
 * Modes:
 *   execute  — Execute a composition definition
 *   status   — Get composition state
 *   cancel   — Cancel a running composition
 *   analyze  — Analyze DAG without executing (dry-run)
 *
 * Constitutional:
 *   F1 AMANAH  — reversible-first, checkpoint before each step
 *   F2 TRUTH   — each step produces a receipt
 *   F4 CLARITY — DAG is deterministic, no hidden state
 *   F11 AUDIT  — composition receipt sealed to VAULT999
 *
 * @module domain/composition/forge_compose
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { randomUUID } from "node:crypto";
import { CompositionEngine } from "./CompositionEngine.js";
import { resolveDag } from "./DagResolver.js";
import type { CompositionDefinition } from "./CompositionTypes.js";

// ── Singleton Engine ────────────────────────────────────────────────

let engine: CompositionEngine | null = null;

function getEngine(): CompositionEngine {
  if (!engine) {
    engine = new CompositionEngine({ maxConcurrency: 8 });
  }
  return engine;
}

// ── Tool Input Schema ───────────────────────────────────────────────

export interface ForgeComposeInput {
  mode: "execute" | "status" | "cancel" | "analyze";
  /** Composition definition (required for execute/analyze) */
  task?: string;
  pattern?: "sequential" | "parallel" | "conditional" | "loop" | "mixed";
  steps?: Array<{
    id: string;
    tool: string;
    args?: Record<string, any>;
    depends_on?: string[];
    when?: string;
    max_retries?: number;
    on_fail?: "skip" | "abort";
    timeout_ms?: number;
    organ?: string;
  }>;
  merge?: "aggregate_results" | "first_success" | "all_required";
  timeout_ms?: number;
  hold_id?: string;
  /** Composition ID (for status/cancel) */
  composition_id?: string;
}

// ── Tool Handler ────────────────────────────────────────────────────

export async function forgeCompose(
  input: ForgeComposeInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const eng = getEngine();

  switch (input.mode) {
    case "analyze": {
      if (!input.steps || input.steps.length === 0) {
        return {
          content: [{ type: "text", text: "Error: steps required for analyze mode" }],
        };
      }

      const definition: CompositionDefinition = {
        task: input.task ?? "unnamed",
        pattern: input.pattern ?? "sequential",
        steps: input.steps.map(s => ({
          ...s,
          args: s.args ?? {},
        })),
        merge: input.merge,
        timeout_ms: input.timeout_ms,
      };

      const dag = resolveDag(definition.steps);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            task: definition.task,
            pattern: definition.pattern,
            step_count: definition.steps.length,
            has_cycles: dag.hasCycles,
            cycle_path: dag.cyclePath,
            execution_order: dag.executionOrder,
            parallel_groups: dag.parallelGroups,
            group_count: dag.parallelGroups.length,
          }, null, 2),
        }],
      };
    }

    case "execute": {
      if (!input.steps || input.steps.length === 0) {
        return {
          content: [{ type: "text", text: "Error: steps required for execute mode" }],
        };
      }

      const definition: CompositionDefinition = {
        id: randomUUID(),
        task: input.task ?? "unnamed",
        pattern: input.pattern ?? "sequential",
        steps: input.steps.map(s => ({
          ...s,
          args: s.args ?? {},
        })),
        merge: input.merge,
        timeout_ms: input.timeout_ms,
        hold_id: input.hold_id,
      };

      // Execute via a stub executor (real integration would route to A-FORGE tools)
      const receipt = await eng.execute(definition, async (tool, args, stepId) => {
        // Stub: in production, this would call the actual MCP tool
        return {
          tool,
          stepId,
          status: "executed_stub",
          timestamp: new Date().toISOString(),
        };
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            composition_id: receipt.composition_id,
            task: receipt.task,
            pattern: receipt.pattern,
            aggregate: receipt.aggregate,
            steps: receipt.steps.map(s => ({
              step_id: s.step_id,
              tool: s.tool,
              status: s.status,
              duration_ms: s.duration_ms,
            })),
          }, null, 2),
        }],
      };
    }

    case "status": {
      if (!input.composition_id) {
        return {
          content: [{ type: "text", text: "Error: composition_id required for status mode" }],
        };
      }

      const state = eng.getState(input.composition_id);
      if (!state) {
        return {
          content: [{ type: "text", text: `Error: composition ${input.composition_id} not found` }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            composition_id: state.composition_id,
            status: state.status,
            task: state.definition.task,
            started_at: state.started_at,
            completed_at: state.completed_at,
            current_step: state.current_step,
            steps_completed: state.step_results.size,
          }, null, 2),
        }],
      };
    }

    case "cancel": {
      if (!input.composition_id) {
        return {
          content: [{ type: "text", text: "Error: composition_id required for cancel mode" }],
        };
      }

      const cancelled = eng.cancel(input.composition_id);
      return {
        content: [{
          type: "text",
          text: cancelled
            ? `Composition ${input.composition_id} cancelled`
            : `Composition ${input.composition_id} not found or not running`,
        }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Error: unknown mode ${input.mode}. Use: execute, status, cancel, analyze` }],
      };
  }
}

// ── Tool Definition (for MCP registration) ──────────────────────────

export const FORGE_COMPOSE_DEFINITION = {
  name: "forge_compose",
  description: "Composition Bus — orchestrate multi-tool execution across MCP servers. 4 patterns: sequential, parallel, conditional, loop. Each step produces a receipt. DAG-based resolution with cycle detection. Constitutional: F1 AMANAH, F2 TRUTH, F4 CLARITY, F11 AUDIT.",
  inputSchema: {
    type: "object" as const,
    properties: {
      mode: {
        type: "string" as const,
        enum: ["execute", "status", "cancel", "analyze"],
        description: "Operation mode",
      },
      task: { type: "string" as const, description: "Task description" },
      pattern: { type: "string" as const, enum: ["sequential", "parallel", "conditional", "loop", "mixed"] },
      steps: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const },
            tool: { type: "string" as const },
            args: { type: "object" as const },
            depends_on: { type: "array" as const, items: { type: "string" as const } },
            when: { type: "string" as const },
            max_retries: { type: "number" as const },
            on_fail: { type: "string" as const, enum: ["skip", "abort"] },
            timeout_ms: { type: "number" as const },
            organ: { type: "string" as const },
          },
          required: ["id", "tool"],
        },
      },
      merge: { type: "string" as const, enum: ["aggregate_results", "first_success", "all_required"] },
      timeout_ms: { type: "number" as const },
      hold_id: { type: "string" as const },
      composition_id: { type: "string" as const },
    },
    required: ["mode"],
  },
};
