/**
 * WM Query Tools — Phase 1.5 MCP surface
 * Read-only tools for querying world model state:
 *   forge_wm_stats    — dashboard (records, per-tool grades, trending)
 *   forge_wm_gaps     — gap alerts (high-confidence wrong predictions)
 *   forge_wm_quality  — trajectory quality report + Phase 2 readiness
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const TRAJECTORY_LOG = "/root/.local/share/arifos/world-model/trajectories.jsonl";
const ALERT_LOG = "/root/.local/share/arifos/world-model/gap_alerts.jsonl";
const CHAIN_HEAD = "/root/.local/share/arifos/world-model/chain_head.json";
const META_FILE = "/root/.local/share/arifos/world-model/metadata.json";
const EXPERIENCE_TRACE_LOG = "/root/.local/share/arifos/world-model/experience_traces.jsonl";

// ── Helpers ──────────────────────────────────

interface NormalizedRecord {
  tool: string;
  timestamp: string;
  priority: string;
  agent_confidence: number;
  surprise_score: number;
  observation_entropy: number;
  wm_eligible: boolean;
  prediction_gap: number | null;
  evidence_gap: string;
}

function normalizeRecord(r: Record<string, unknown>): NormalizedRecord {
  const wm = r["wm"] as Record<string, unknown> | undefined;
  if (wm) {
    return {
      tool: (r["tool_name"] as string) ?? "unknown",
      timestamp: (r["timestamp"] as string) ?? "",
      priority: `P${wm["tool_priority"] ?? 2}`,
      agent_confidence: (wm["agent_confidence"] as number) ?? -1,
      surprise_score: (wm["surprise_score"] as number) ?? 1.0,
      observation_entropy: (wm["observation_entropy"] as number) ?? 0,
      wm_eligible: (wm["wm_eligible"] as boolean) ?? false,
      prediction_gap: null,
      evidence_gap: String(wm["evidence_gap"] ?? "unknown"),
    };
  }
  return {
    tool: (r["tool"] as string) ?? "unknown",
    timestamp: (r["ts"] as string) ?? "",
    priority: (r["wm_priority"] as string) ?? "P2",
    agent_confidence: (r["agent_confidence"] as number) ?? -1,
    surprise_score: (r["surprise_score"] as number) ?? 1.0,
    observation_entropy: (r["observation_entropy"] as number) ?? 0,
    wm_eligible: (r["wm_eligible"] as boolean) ?? false,
    prediction_gap: (r["prediction_gap"] as number) ?? null,
    evidence_gap: String(r["evidence_gap"] ?? "unknown"),
  };
}

async function loadTrajectories(): Promise<NormalizedRecord[]> {
  if (!existsSync(TRAJECTORY_LOG)) return [];
  const content = await readFile(TRAJECTORY_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return normalizeRecord(JSON.parse(line)); }
      catch { return null; }
    })
    .filter((r): r is NormalizedRecord => r !== null);
}

async function loadAlerts(): Promise<Record<string, unknown>[]> {
  if (!existsSync(ALERT_LOG)) return [];
  const content = await readFile(ALERT_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch { return null; }
    })
    .filter((a): a is Record<string, unknown> => a !== null);
}

interface ExperienceTraceRecord {
  trace_id: string;
  ts: string;
  agent_id: string;
  action: { tool: string; input_hash: string };
  observation: { output_hash: string; success: boolean };
  feedback: { self?: string; environmental?: string; constitutional?: string };
  experience_delta: { capability_change?: number; confidence_change?: number; new_scar?: string | null; new_skill?: string | null };
}

async function loadExperienceTraces(): Promise<ExperienceTraceRecord[]> {
  if (!existsSync(EXPERIENCE_TRACE_LOG)) return [];
  const content = await readFile(EXPERIENCE_TRACE_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as ExperienceTraceRecord; }
      catch { return null; }
    })
    .filter((t): t is ExperienceTraceRecord => t !== null);
}

// ── Registration ─────────────────────────────

export function registerWMTools(server: McpServer): void {
  // ── forge_wm_stats ──
  server.tool(
    "forge_wm_stats",
    "World Model statistics dashboard. Returns record counts, per-tool surprise scores, " +
    "WM eligibility rates, and prediction trending. Read-only.",
    {
      tool_filter: z.string().optional().describe("Filter by tool name (e.g., 'forge_shell')"),
    },
    async ({ tool_filter }) => {
      const records = await loadTrajectories();
      const filtered = tool_filter
        ? records.filter((r) => r.tool === tool_filter)
        : records;

      // Per-tool aggregation
      const toolMap = new Map<string, {
        count: number; eligible: number; surprise_sum: number;
        entropy_sum: number; high_surprise: number; gaps: number[];
      }>();
      
      for (const r of filtered) {
        let t = toolMap.get(r.tool);
        if (!t) {
          t = { count: 0, eligible: 0, surprise_sum: 0, entropy_sum: 0, high_surprise: 0, gaps: [] };
          toolMap.set(r.tool, t);
        }
        t.count++;
        t.surprise_sum += r.surprise_score;
        t.entropy_sum += r.observation_entropy;
        if (r.wm_eligible) t.eligible++;
        if (r.surprise_score > 0.5) t.high_surprise++;
        if (r.prediction_gap !== null) t.gaps.push(r.prediction_gap);
      }

      const tools: Record<string, unknown> = {};
      for (const [name, t] of toolMap) {
        tools[name] = {
          count: t.count,
          eligible: t.eligible,
          eligible_rate: t.count > 0 ? t.eligible / t.count : 0,
          avg_surprise: t.count > 0 ? t.surprise_sum / t.count : 0,
          avg_entropy: t.count > 0 ? t.entropy_sum / t.count : 0,
          avg_gap: t.gaps.length > 0 ? t.gaps.reduce((a, b) => a + b, 0) / t.gaps.length : null,
        };
      }

      // Chain head
      let chainHead: Record<string, unknown> = {};
      try {
        chainHead = JSON.parse(await readFile(CHAIN_HEAD, "utf-8"));
      } catch { /* ok */ }

      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(await readFile(META_FILE, "utf-8"));
      } catch { /* ok */ }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            total_records: records.length,
            filtered_by: tool_filter ?? "all",
            chain: chainHead,
            metadata: meta,
            tools,
            _epistemic: {
              evidence_layer: "OBS",
              confidence: 0.90,
              source: "forge_wm_stats",
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_wm_gaps ──
  server.tool(
    "forge_wm_gaps",
    "World Model gap alerts with experience trace cross-reference. Returns high-confidence " +
    "wrong predictions where the agent was confident but the output diverged significantly. " +
    "Now also shows which gaps have experience feedback and which lack it — identifying the " +
    "highest-priority improvement targets. Severity: CRITICAL/HIGH/MEDIUM. Read-only.",
    {
      limit: z.number().default(20).describe("Max alerts to return"),
      severity: z.string().optional().describe("Filter: CRITICAL, HIGH, or MEDIUM"),
    },
    async ({ limit, severity }) => {
      const alerts = await loadAlerts();
      let filtered = alerts
        .filter((a) => !severity || a["severity"] === severity)
        .slice(-Math.min(limit, 100));

      // If no gap alerts logged yet, scan trajectories
      if (filtered.length === 0) {
        const records = await loadTrajectories();
        filtered = records
          .filter((r) => r.agent_confidence > 0.7 && r.surprise_score > 0.6)
          .map((r) => ({
            type: "wm_gap_alert",
            severity: r.surprise_score > 0.9 ? "CRITICAL" : r.surprise_score > 0.75 ? "HIGH" : "MEDIUM",
            tool: r.tool,
            timestamp: r.timestamp,
            agent_confidence: r.agent_confidence,
            surprise_score: r.surprise_score,
            prediction_gap: r.prediction_gap,
            source: "trajectory_scan",
          }))
          .slice(-limit);
      }

      // ── Experience trace cross-reference (CoE Phase 1) ──
      const traces = await loadExperienceTraces();

      // Build per-tool experience summary
      const toolExperience = new Map<string, {
        trace_count: number;
        with_feedback: number;
        success_rate: number;
        avg_capability_delta: number;
        has_self: number;
        has_env: number;
        has_const: number;
      }>();

      for (const t of traces) {
        const tool = t.action.tool;
        let exp = toolExperience.get(tool);
        if (!exp) {
          exp = { trace_count: 0, with_feedback: 0, success_rate: 0, avg_capability_delta: 0, has_self: 0, has_env: 0, has_const: 0 };
          toolExperience.set(tool, exp);
        }
        exp.trace_count++;
        if (t.feedback.self || t.feedback.environmental || t.feedback.constitutional) exp.with_feedback++;
        if (t.observation.success) exp.success_rate++;
        exp.avg_capability_delta += t.experience_delta.capability_change ?? 0;
        if (t.feedback.self) exp.has_self++;
        if (t.feedback.environmental) exp.has_env++;
        if (t.feedback.constitutional) exp.has_const++;
      }

      // Finalize rates
      for (const [, exp] of toolExperience) {
        if (exp.trace_count > 0) {
          exp.success_rate = Math.round((exp.success_rate / exp.trace_count) * 1000) / 1000;
          exp.avg_capability_delta = Math.round((exp.avg_capability_delta / exp.trace_count) * 1000) / 1000;
        }
      }

      // Cross-reference: which gap tools have experience traces?
      const gapTools = new Set(filtered.map((a) => a["tool"] as string).filter(Boolean));
      const gapsWithExperience: string[] = [];
      const gapsWithoutExperience: string[] = [];
      for (const tool of gapTools) {
        if (toolExperience.has(tool)) gapsWithExperience.push(tool);
        else gapsWithoutExperience.push(tool);
      }

      // Identify highest-priority improvement targets:
      // gaps with high surprise but low feedback coverage
      const improvementTargets = filtered
        .filter((a) => {
          const tool = a["tool"] as string;
          const exp = toolExperience.get(tool);
          return !exp || (exp.with_feedback / exp.trace_count) < 0.5;
        })
        .map((a) => ({
          tool: a["tool"],
          severity: a["severity"],
          surprise_score: a["surprise_score"],
          experience_traces: toolExperience.get(a["tool"] as string)?.trace_count ?? 0,
          feedback_coverage: toolExperience.get(a["tool"] as string)
            ? Math.round((toolExperience.get(a["tool"] as string)!.with_feedback / toolExperience.get(a["tool"] as string)!.trace_count) * 100)
            : 0,
          reason: "High surprise + low feedback coverage = priority improvement target",
        }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            total_alerts: filtered.length,
            severity_filter: severity ?? "all",
            alerts: filtered,
            experience_analysis: {
              total_traces: traces.length,
              tools_with_traces: toolExperience.size,
              gaps_with_experience: gapsWithExperience,
              gaps_without_experience: gapsWithoutExperience,
              improvement_targets: improvementTargets,
              per_tool: Object.fromEntries(
                [...toolExperience.entries()].map(([tool, exp]) => [tool, exp])
              ),
            },
            _epistemic: {
              evidence_layer: "DER",
              confidence: 0.85,
              source: "forge_wm_gaps",
              note: "Gap alerts cross-referenced with experience traces. Improvement targets = high surprise + low feedback coverage.",
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── forge_wm_quality ──
  server.tool(
    "forge_wm_quality",
    "World Model trajectory quality report + Phase 2 readiness. " +
    "Grades tools from A-D based on training data quality and assesses whether " +
    "ECHO/PaW RL training can begin. Read-only.",
    {},
    async () => {
      const records = await loadTrajectories();
      const total = records.length;
      const eligible = records.filter((r) => r.wm_eligible).length;
      const toolsN = new Set(records.map((r) => r.tool)).size;

      // Per-tool grades
      const toolGrades: Record<string, unknown> = {};
      const toolMap = new Map<string, { count: number; eligible: number; surprise_sum: number }>();
      for (const r of records) {
        let t = toolMap.get(r.tool);
        if (!t) { t = { count: 0, eligible: 0, surprise_sum: 0 }; toolMap.set(r.tool, t); }
        t.count++;
        if (r.wm_eligible) t.eligible++;
        t.surprise_sum += r.surprise_score;
      }
      for (const [name, t] of toolMap) {
        const rate = t.eligible / t.count;
        const avgSurprise = t.surprise_sum / t.count;
        let grade = "D";
        if (t.count >= 5) {
          if (rate > 0.6 && avgSurprise > 0.4) grade = "A";
          else if (rate > 0.4 && avgSurprise > 0.3) grade = "B";
          else if (rate > 0.2) grade = "C";
          else grade = "D";
        }
        toolGrades[name] = { count: t.count, eligible: t.eligible, eligible_rate: rate, avg_surprise: avgSurprise, grade };
      }

      // Phase 2 checks
      const checks = {
        total_trajectories: { value: total, threshold: 100, pass: total >= 100 },
        eligible_trajectories: { value: eligible, threshold: 50, pass: eligible >= 50 },
        tools_represented: { value: toolsN, threshold: 3, pass: toolsN >= 3 },
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            phase2_ready: Object.values(checks).every((c) => c.pass),
            progress: `${total}/100 total, ${eligible}/50 eligible`,
            checks,
            tool_grades: toolGrades,
            blockers: [
              "GRPO implementation needed",
              "Harbor-style agent harness for forge_* tools",
              "Docker sandboxes for safe rollout execution",
              "Task-completion verifier (reward model)",
            ],
            _epistemic: {
              evidence_layer: "DER",
              confidence: 0.90,
              source: "forge_wm_quality",
            },
          }, null, 2),
        }],
      };
    }
  );
}
