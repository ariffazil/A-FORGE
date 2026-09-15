/**
 * interfaces/mcp/rsiTools.ts — RSI State Vector & Measurement MCP Tools
 *
 * Registers three MCP tools for A-FORGE RSI measurement:
 *   forge_rsi_impulse_response — P0 impulse-response measurement (HOLD → routing influence)
 *   forge_rsi_dual_rate_fq — dual-rate FQ signal (7-day governance + daily cockpit)
 *   forge_rsi_state_vector — current state vector snapshot (read-only)
 *
 * Constitutional:
 *   F1 AMANAH — all tools are OBSERVE-class, never mutate state
 *   F2 TRUTH — measurements labeled OBS/DER as appropriate
 *   R ∉ S — measurement tools are not in the decision path they measure
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md
 * @authority ARIF / F13 SOVEREIGN
 * @date 2026-09-15
 * @forged FI-003 (Qwen Code)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { computeImpulseResponseReport } from "../../domain/rsi/impulse-response.js";
import { computeDualRateFQ } from "../../domain/rsi/dual-rate-fq.js";

export function registerRSITools(server: McpServer): void {
  // ── forge_rsi_impulse_response ──────────────────────────────────────────

  server.tool(
    "forge_rsi_impulse_response",
    "RSI P0 measurement — impulse response h(t). Measures how long 888_HOLD, scar seal, " +
    "and tool failure events remain causally active in subsequent routing, tool selection, " +
    "and budget allocation. Returns causal half-life in sessions. OBS-class. " +
    "Use when: 'impulse response', 'HOLD influence', 'how long does a HOLD last', " +
    "'causal half-life', 'h(t)', 'RSI measurement'.",
    {
      window_days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Lookback window in days (default: 30)"),
    },
    async ({ window_days }) => {
      try {
        const report = await computeImpulseResponseReport(window_days);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ...report,
                  epistemic_label: "OBS",
                  note:
                    report.h_characterized
                      ? "h(t) characterized — causal half-life measured from ≥5 samples"
                      : "h(t) NOT characterized — insufficient samples for reliable measurement",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "IMPULSE_RESPONSE_COMPUTATION_FAILED",
                  message: err instanceof Error ? err.message : String(err),
                  epistemic_label: "OBS",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── forge_rsi_dual_rate_fq ──────────────────────────────────────────────

  server.tool(
    "forge_rsi_dual_rate_fq",
    "RSI dual-rate FQ signal. Returns both daily FQ (cockpit telemetry, observational) " +
    "and 7-day rolling FQ (governance decisions, constitutional). Daily FQ is aliased " +
    "for weekly governance cycles — use governance_fq for constitutional decisions. OBS-class. " +
    "Use when: 'FQ governance', 'dual rate', 'aliased FQ', '7-day FQ', 'governance signal'.",
    {
      min_governance_samples: z
        .number()
        .min(1)
        .default(10)
        .describe("Minimum receipts in 7-day window for reliable signal (default: 10)"),
    },
    async ({ min_governance_samples }) => {
      try {
        const fq = await computeDualRateFQ(min_governance_samples);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ...fq,
                  epistemic_labels: {
                    daily_fq: "OBS",
                    governance_fq: "DER",
                  },
                  aliasing_warning:
                    "Daily FQ aliases weekly governance cycle. Use governance_fq for constitutional decisions.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "DUAL_RATE_FQ_COMPUTATION_FAILED",
                  message: err instanceof Error ? err.message : String(err),
                  epistemic_label: "OBS",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── forge_rsi_state_vector ──────────────────────────────────────────────

  server.tool(
    "forge_rsi_state_vector",
    "RSI state vector snapshot. Returns current s_t = (identity, plant, memory, controller) " +
    "for the active session. Read-only — state vector is computed from live traces, not stored. " +
    "OBS-class. Use when: 'state vector', 'RSI snapshot', 's_t', 'controller state', 'Imp state'.",
    {
      include_controller: z
        .boolean()
        .default(true)
        .describe("Include Imp controller state (default: true)"),
    },
    async ({ include_controller }) => {
      try {
        // Compute current state from live data
        const fq = await computeDualRateFQ();
        const now = new Date().toISOString();

        // Imp controller is currently unstructured — report the gap honestly
        const controller = include_controller
          ? {
              bottleneck: null,
              fix: null,
              entropy_delta: null,
              imp_version: "unstructured-v0",
              evaluator: null,
              updated_at: now,
              updated_by: "measurement-engine",
              _note:
                "Controller state is unstructured. ImpState type exists (contracts/rsi.ts) " +
                "but no runtime data populates it yet. First engineering target after F13 ratification.",
            }
          : null;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  schema_version: "rsi.sv.v1",
                  snapshot_at: now,
                  identity: {
                    _note: "Identity fields require active session binding — not available from measurement tool",
                    session_id: null,
                    actor_id: null,
                    lease_id: null,
                    plan_id: null,
                    verdict: null,
                    floor_scope: [],
                    ratification_status: "pending",
                  },
                  plant: {
                    _note: "Plant state requires active session context — not available from measurement tool",
                    intent: null,
                    canonical_stage: null,
                    evidence: [],
                    hypotheses: [],
                    tools_invoked: [],
                    reversibility_score: 0,
                  },
                  memory: {
                    _note: "Memory stores enumerated from known paths",
                    stores: [
                      { kind: "experience_traces", module: "experienceTraceTools", persistence: "file-backed", write_loop: "FAST" },
                      { kind: "tool_call_receipts", module: "Supabase", persistence: "durable", write_loop: "FAST" },
                      { kind: "cooling_receipts", module: "coolingVerbs", persistence: "immutable", write_loop: "MEDIUM" },
                      { kind: "escalation_records", module: "VAULT999", persistence: "immutable", write_loop: "MEDIUM" },
                      { kind: "federation_telemetry", module: "Prometheus", persistence: "durable", write_loop: "FAST" },
                    ],
                    h_characterized: false,
                    h_sessions: null,
                    h_measurement_id: null,
                  },
                  controller,
                  fq_snapshot: fq,
                  epistemic_label: "OBS",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "STATE_VECTOR_COMPUTATION_FAILED",
                  message: err instanceof Error ? err.message : String(err),
                  epistemic_label: "OBS",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
