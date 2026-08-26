/**
 * Experience Trace Tools — Chain-of-Experience (arxiv 2608.18027) MCP surface.
 *
 * Records experience traces after every non-trivial action:
 *   forge_experience_trace — record action→observation→feedback→delta
 *
 * Each trace captures the CoE triplet (self + environmental + constitutional feedback)
 * plus an experience_delta measuring capability change.
 *
 * Constitutional:
 *   F1 AMANAH — append-only, never delete
 *   F2 TRUTH — hash-verified, epistemic labels on every trace
 *   F4 CLARITY — structured feedback, never raw
 *   F11 AUDIT — every trace leaves an immutable chain link
 *
 * @module interfaces/mcp/experienceTraceTools
 * @forged 2026-08-26
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

// ── Paths ───────────────────────────────────────────────────────────────────

const EXPERIENCE_TRACE_LOG = "/root/.local/share/arifos/world-model/experience_traces.jsonl";
const SKILL_SELECTION_LOG = "/root/.local/share/arifos/skill-selection/selections.jsonl";

// ── Types ───────────────────────────────────────────────────────────────────

interface ExperienceTrace {
  trace_id: string;
  seq: number;
  ts: string;
  session_id: string;
  agent_id: string;
  action: {
    tool: string;
    input_hash: string;
  };
  observation: {
    output_hash: string;
    success: boolean;
  };
  feedback: {
    self?: string;
    environmental?: string;
    constitutional?: string;
  };
  experience_delta: {
    capability_change?: number;
    confidence_change?: number;
    new_scar?: string | null;
    new_skill?: string | null;
  };
  prev_hash: string;
  hash: string;
}

// ── Chain State ─────────────────────────────────────────────────────────────

let tracePrevHash = "0000000000000000000000000000000000000000000000000000000000000000";
let traceSeq = 0;

async function initTraceChain(): Promise<void> {
  const dir = dirname(EXPERIENCE_TRACE_LOG);
  await mkdir(dir, { recursive: true });

  try {
    const s = await stat(EXPERIENCE_TRACE_LOG);
    if (s.size === 0) return;
    const content = await readFile(EXPERIENCE_TRACE_LOG, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return;
    const last = JSON.parse(lines[lines.length - 1]);
    tracePrevHash = last.hash || "0000000000000000000000000000000000000000000000000000000000000000";
    traceSeq = last.seq || lines.length;
  } catch {
    // File doesn't exist yet — genesis state
  }
}

// Initialize on import
initTraceChain().catch((err) => {
  console.error("[experienceTraceTools] Init failed:", err.message);
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function loadTraces(): Promise<ExperienceTrace[]> {
  if (!existsSync(EXPERIENCE_TRACE_LOG)) return [];
  const content = await readFile(EXPERIENCE_TRACE_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as ExperienceTrace; }
      catch { return null; }
    })
    .filter((t): t is ExperienceTrace => t !== null);
}

// ── Registration ────────────────────────────────────────────────────────────

export function registerExperienceTraceTools(server: McpServer): void {
  // ── forge_experience_trace ──
  server.tool(
    "forge_experience_trace",
    "Record an experience trace (Chain-of-Experience). Captures action→observation→feedback→delta " +
    "after every non-trivial forge tool execution. Three feedback channels: self (model critique), " +
    "environmental (test/lint/build), constitutional (floor check). Append-only hash-chained ledger. " +
    "Returns the sealed trace with hash chain link.",
    {
      session_id: z.string().describe("Session ID (SCT) from arif_init"),
      agent_id: z.string().describe("Agent identity (e.g., 'fi-003', 'hermes')"),
      tool: z.string().describe("Tool name that was executed (e.g., 'forge_shell')"),
      input_summary: z.string().describe("Brief summary of the tool input (not raw args)"),
      output_summary: z.string().describe("Brief summary of the tool output (not raw output)"),
      success: z.boolean().describe("Did the action succeed?"),
      feedback_self: z.string().optional().describe("Model self-critique — agent's post-hoc assessment"),
      feedback_environmental: z.string().optional().describe("Environmental signal — test pass/fail, lint, build status"),
      feedback_constitutional: z.string().optional().describe("Constitutional check — floor compliance result (PASS/FAIL/UNKNOWN)"),
      capability_change: z.number().optional().describe("Estimated capability delta [-1, 1] — positive = improved"),
      confidence_change: z.number().optional().describe("Confidence delta [-1, 1] — positive = more confident"),
      new_scar: z.string().optional().describe("If this trace produced a new scar, its identifier"),
      new_skill: z.string().optional().describe("If this trace produced a new skill, its identifier"),
    },
    async (params) => {
      const seq = ++traceSeq;
      const traceId = `exp-${Date.now()}-${seq}`;
      const ts = new Date().toISOString();

      const inputHash = hashContent(params.input_summary);
      const outputHash = hashContent(params.output_summary);

      const record: Omit<ExperienceTrace, "hash"> = {
        trace_id: traceId,
        seq,
        ts,
        session_id: params.session_id,
        agent_id: params.agent_id,
        action: {
          tool: params.tool,
          input_hash: inputHash,
        },
        observation: {
          output_hash: outputHash,
          success: params.success,
        },
        feedback: {
          self: params.feedback_self,
          environmental: params.feedback_environmental,
          constitutional: params.feedback_constitutional,
        },
        experience_delta: {
          capability_change: params.capability_change,
          confidence_change: params.confidence_change,
          new_scar: params.new_scar ?? null,
          new_skill: params.new_skill ?? null,
        },
        prev_hash: tracePrevHash,
      };

      const hash = createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");

      const entry: ExperienceTrace = { ...record, hash };

      // Append to JSONL ledger
      await appendFile(EXPERIENCE_TRACE_LOG, JSON.stringify(entry) + "\n", "utf-8");

      // Update chain head
      tracePrevHash = hash;

      // Forward to arifLOW telemetry — fire-and-forget
      fetch("http://127.0.0.1:7073/telemetry/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          band: "OPERATIONAL",
          organ: "A-FORGE",
          tool_name: `experience_trace:${params.tool}`,
          success: params.success,
          metadata: {
            trace_id: traceId,
            agent_id: params.agent_id,
            capability_change: params.capability_change,
            confidence_change: params.confidence_change,
            has_self_feedback: !!params.feedback_self,
            has_env_feedback: !!params.feedback_environmental,
            has_const_feedback: !!params.feedback_constitutional,
          },
        }),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            trace_id: traceId,
            seq,
            ts,
            tool: params.tool,
            agent_id: params.agent_id,
            success: params.success,
            feedback_channels: {
              self: !!params.feedback_self,
              environmental: !!params.feedback_environmental,
              constitutional: !!params.feedback_constitutional,
            },
            experience_delta: entry.experience_delta,
            chain: {
              prev_hash: tracePrevHash.slice(0, 16) + "...",
              hash: hash.slice(0, 16) + "...",
            },
            _epistemic: {
              evidence_layer: "OBS",
              confidence: 0.90,
              source: "forge_experience_trace",
              note: "Experience trace = Chain-of-Experience triplet. Append-only. Hash-chained.",
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_experience_query ──
  server.tool(
    "forge_experience_query",
    "Query experience traces. Returns traces filtered by agent, tool, or feedback type. " +
    "Read-only. Use to analyze experience patterns and identify improvement opportunities.",
    {
      agent_id: z.string().optional().describe("Filter by agent ID"),
      tool: z.string().optional().describe("Filter by tool name"),
      has_feedback: z.enum(["self", "environmental", "constitutional", "any"]).optional()
        .describe("Filter traces that have a specific feedback channel"),
      limit: z.number().default(20).describe("Max traces to return"),
    },
    async (params) => {
      let traces = await loadTraces();

      if (params.agent_id) {
        traces = traces.filter((t) => t.agent_id === params.agent_id);
      }
      if (params.tool) {
        traces = traces.filter((t) => t.action.tool === params.tool);
      }
      if (params.has_feedback) {
        const key = params.has_feedback;
        if (key === "any") {
          traces = traces.filter((t) => t.feedback.self || t.feedback.environmental || t.feedback.constitutional);
        } else {
          traces = traces.filter((t) => t.feedback[key as keyof typeof t.feedback]);
        }
      }

      traces = traces.slice(-Math.min(params.limit, 100));

      // Compute aggregates
      const successRate = traces.length > 0
        ? traces.filter((t) => t.observation.success).length / traces.length
        : 0;
      const avgCapabilityDelta = traces.length > 0
        ? traces.reduce((sum, t) => sum + (t.experience_delta.capability_change ?? 0), 0) / traces.length
        : 0;
      const feedbackCoverage = traces.length > 0
        ? traces.filter((t) => t.feedback.self || t.feedback.environmental || t.feedback.constitutional).length / traces.length
        : 0;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            total_traces: traces.length,
            filters: {
              agent_id: params.agent_id ?? "all",
              tool: params.tool ?? "all",
              has_feedback: params.has_feedback ?? "any",
            },
            aggregates: {
              success_rate: Math.round(successRate * 1000) / 1000,
              avg_capability_delta: Math.round(avgCapabilityDelta * 1000) / 1000,
              feedback_coverage: Math.round(feedbackCoverage * 1000) / 1000,
            },
            traces: traces.map((t) => ({
              trace_id: t.trace_id,
              ts: t.ts,
              agent_id: t.agent_id,
              tool: t.action.tool,
              success: t.observation.success,
              feedback: t.feedback,
              delta: t.experience_delta,
            })),
            _epistemic: {
              evidence_layer: "OBS",
              confidence: 0.90,
              source: "forge_experience_query",
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_skill_select_query ──
  server.tool(
    "forge_skill_select_query",
    "Query skill selection events (SkillGate preparation). Returns which skills were selected, " +
    "by what method (keyword/learned/manual/routed/fallback), and outcomes. Read-only. " +
    "Prepares for Phase 2 SkillGate credit separation (selection credit vs execution credit).",
    {
      skill_name: z.string().optional().describe("Filter by skill name"),
      agent_id: z.string().optional().describe("Filter by agent ID"),
      method: z.string().optional().describe("Filter by selection method (keyword/learned/manual/routed/fallback)"),
      limit: z.number().default(20).describe("Max events to return"),
    },
    async (params) => {
      if (!existsSync(SKILL_SELECTION_LOG)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "SEAL",
              total_events: 0,
              message: "No skill selection events recorded yet. Tracker initialized — events will appear as skills are used.",
              _epistemic: {
                evidence_layer: "OBS",
                confidence: 0.90,
                source: "forge_skill_select_query",
              },
            }, null, 2),
          }],
        };
      }

      const content = await readFile(SKILL_SELECTION_LOG, "utf-8");
      let events: Record<string, unknown>[] = content
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try { return JSON.parse(line) as Record<string, unknown>; }
          catch { return null; }
        })
        .filter((e): e is Record<string, unknown> => e !== null);

      if (params.skill_name) {
        events = events.filter((e) => e["skill_name"] === params.skill_name);
      }
      if (params.agent_id) {
        events = events.filter((e) => e["agent_id"] === params.agent_id);
      }
      if (params.method) {
        events = events.filter((e) => e["selection_method"] === params.method);
      }

      events = events.slice(-Math.min(params.limit, 100));

      // Aggregates
      const bySkill = new Map<string, number>();
      const byMethod = new Map<string, number>();
      let successes = 0;
      let knownOutcomes = 0;

      for (const e of events) {
        const skill = String(e["skill_name"] ?? "unknown");
        const method = String(e["selection_method"] ?? "unknown");
        bySkill.set(skill, (bySkill.get(skill) ?? 0) + 1);
        byMethod.set(method, (byMethod.get(method) ?? 0) + 1);
        if (e["outcome_success"] !== null && e["outcome_success"] !== undefined) {
          knownOutcomes++;
          if (e["outcome_success"]) successes++;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            total_events: events.length,
            filters: {
              skill_name: params.skill_name ?? "all",
              agent_id: params.agent_id ?? "all",
              method: params.method ?? "all",
            },
            aggregates: {
              by_skill: Object.fromEntries(bySkill),
              by_method: Object.fromEntries(byMethod),
              success_rate: knownOutcomes > 0 ? Math.round((successes / knownOutcomes) * 1000) / 1000 : null,
              known_outcomes: knownOutcomes,
            },
            events: events.map((e) => ({
              ts: e["ts"],
              skill_name: e["skill_name"],
              selection_method: e["selection_method"],
              agent_id: e["agent_id"],
              outcome_success: e["outcome_success"],
              outcome_summary: e["outcome_summary"],
              alternative_skills: e["alternative_skills"],
            })),
            _epistemic: {
              evidence_layer: "OBS",
              confidence: 0.90,
              source: "forge_skill_select_query",
              note: "Skill selection tracking = SkillGate Phase 1 observation. Credit separation in Phase 2.",
            },
          }, null, 2),
        }],
      };
    }
  );
}
