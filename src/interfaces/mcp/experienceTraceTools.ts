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
import { appendFile, mkdir, readFile, stat, open, unlink, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

// ── Paths ───────────────────────────────────────────────────────────────────

const EXPERIENCE_TRACE_LOG = "/root/.local/share/arifos/world-model/experience_traces.jsonl";
const SKILL_SELECTION_LOG = "/root/.local/share/arifos/skill-selection/selections.jsonl";
// Lock file for multi-process serialization. Path option A (per-write re-read + locking).
// Node v22 lacks FileHandle.flock / fs.flock — fallback to lockfile pattern with wx exclusive create.
const EXPERIENCE_TRACE_LOCK = "/root/.local/share/arifos/world-model/experience_traces.lock";
const LOCK_RETRY_DELAY_MS = 25;
const LOCK_MAX_RETRIES = 800; // 20s budget at 25ms intervals

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

// Initialize on import — STORE the promise so callers can await.
// Fixes scar_p0_race_init_chain: fresh Node process + immediate
// recordExperienceTrace call previously raced the fire-and-forget init.
const initPromise: Promise<void> = initTraceChain().catch((err) => {
  console.error("[experienceTraceTools] Init failed:", err.message);
});

/**
 * Ensure the trace chain has been initialized from disk.
 * Idempotent — safe to call repeatedly. Returns immediately if init
 * already completed. Fixes scar_p0_race_init_chain by guaranteeing
 * chain state is loaded before any recordExperienceTrace read.
 */
export function ensureInit(): Promise<void> {
  return initPromise;
}

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
      try {
        // JSONL is a system boundary: hand-rolled writers (e.g. hermes emitter
        // test 2026-09-09) can omit sub-objects — normalize before downstream reads.
        const t = JSON.parse(line) as Partial<ExperienceTrace>;
        return {
          ...t,
          action: t.action ?? { tool: "unknown", input_hash: "" },
          observation: t.observation ?? { output_hash: "", success: false },
          feedback: t.feedback ?? {},
          experience_delta: t.experience_delta ?? {},
        } as ExperienceTrace;
      }
      catch { return null; }
    })
    .filter((t): t is ExperienceTrace => t !== null);
}

// ── Registration ────────────────────────────────────────────────────────────

/**
 * Record an experience trace — shared helper for both the MCP handler
 * (forge_experience_trace tool) and internal auto-fire hooks
 * (e.g., forgeExecute post-execution wire-up, P0 ratified 2026-09-08).
 *
 * Single source of truth for chain state. Both call sites update the same
 * tracePrevHash / traceSeq, so the JSONL ledger stays hash-chained end-to-end.
 *
 * Returns the sealed trace entry. Failures are caught and logged —
 * trace recording MUST NOT block upstream execution (constitutional: F1 AMANAH
 * preserves the executing path, trace is observational).
 */
export async function recordExperienceTrace(params: {
  session_id: string;
  agent_id: string;
  tool: string;
  input_summary: string;
  output_summary: string;
  success: boolean;
  feedback_self?: string;
  feedback_environmental?: string;
  feedback_constitutional?: string;
  capability_change?: number;
  confidence_change?: number;
  new_scar?: string;
  new_skill?: string;
}): Promise<ExperienceTrace | { error: string }> {
  // Fix scar_p0_race_init_chain: wait for chain state to load from disk
  // before reading traceSeq / tracePrevHash. Idempotent; safe even if init
  // already completed (returns immediately).
  await ensureInit();

  // Option A (Sovereign 2026-09-08): per-write re-read + lockfile serialization.
  // Node v22 lacks fs.flock — use wx exclusive create on a sidecar lockfile.
  // Scoped lock = prevents multi-process stale-state races.
  let lockHandle: FileHandle | null = null;
  let fileHandle: FileHandle | null = null;
  try {
    // 1. Acquire lock (lockfile pattern)
    lockHandle = await acquireTraceLock();

    // 2. Open data file for append + re-read
    fileHandle = await open(EXPERIENCE_TRACE_LOG, "a+");
    const fileStat = await fileHandle.stat();
    if (fileStat.size > 0) {
      // Re-read tail to handle multi-process stale state
      const readSize = Math.min(Number(fileStat.size), 16384); // 16KB tail
      const buf = Buffer.alloc(readSize);
      await fileHandle.read(buf, 0, readSize, Number(fileStat.size) - readSize);
      const tail = buf.toString("utf-8");
      const lines = tail.trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        try {
          const last = JSON.parse(lines[lines.length - 1]) as ExperienceTrace;
          if (last.seq !== undefined && last.hash) {
            traceSeq = last.seq;
            tracePrevHash = last.hash;
          }
        } catch {
          // Last line unparseable — keep current in-memory state
        }
      }
    }

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

    // Append to JSONL ledger (under lock — atomic at OS append level)
    await fileHandle.appendFile(JSON.stringify(entry) + "\n", "utf-8");

    // Update chain head in-memory
    tracePrevHash = hash;

    // Forward to arifLOW telemetry — fire-and-forget (do NOT hold lock during network I/O)
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
    }).catch(() => { });

    // ── P2: Experience → Skill Writeback trigger ──
    // Fire AFTER release of any in-flight telemetry. fail-soft — never block.
    void maybeProposeSkillWriteback(entry).then((res) => {
      if (res.proposed) {
        console.log(
          `[recordExperienceTrace] P2 proposal ${res.proposal_id} for tool=${entry.action.tool}`,
        );
      }
    }).catch(() => {});

    return entry;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[recordExperienceTrace] failed:", msg);
    return { error: msg };
  } finally {
    // 3. Release lock + close handles (always, even on error)
    if (fileHandle) {
      try { await fileHandle.close(); } catch {}
    }
    if (lockHandle) {
      try { await lockHandle.close(); } catch {}
      try { await unlink(EXPERIENCE_TRACE_LOCK); } catch {}
    }
  }
}

/**
 * Acquire the trace-write lock via lockfile pattern.
 * Node v22 lacks fs.flock — fall back to wx exclusive create on sidecar file.
 * Retries with backoff if held by another writer.
 */
async function acquireTraceLock(): Promise<FileHandle> {
  // Ensure directory exists
  await mkdir(dirname(EXPERIENCE_TRACE_LOCK), { recursive: true });
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      // wx = create exclusively — fails with EEXIST if file exists
      const handle = await open(EXPERIENCE_TRACE_LOCK, "wx");
      return handle;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      // Lock held by another writer — wait + retry
      await new Promise((r) => setTimeout(r, LOCK_RETRY_DELAY_MS));
    }
  }
  throw new Error(
    `[acquireTraceLock] failed after ${LOCK_MAX_RETRIES} retries (${LOCK_MAX_RETRIES * LOCK_RETRY_DELAY_MS}ms)`,
  );
}

// ── P2: Experience → Skill Writeback (F13-ratified 2026-09-08) ──────────────

const SKILL_PROPOSALS_DIR = "/root/.local/share/arifos/skill-proposals";
const P2_WINDOW = 10;        // Look at last N traces for pattern
const P2_THRESHOLD = 3;      // Trigger when same tool appears >= N times
const P2_PROPOSAL_COOLDOWN_MS = 60_000; // Avoid re-proposing same tool within 60s

/**
 * P2 helper — detect patterns across recent traces; if a tool appears
 * P2_THRESHOLD+ times in P2_WINDOW recent traces, write a structured
 * proposal to SKILL_PROPOSALS_DIR. F13 ratifies via external signal —
 * NEVER auto-applies. Constitutional: feedback-f13-sovereignty-visibility-
 * prerequisite mandates visibility before any skill modification.
 *
 * Fail-soft: proposal write failures must never break recordExperienceTrace.
 */
async function maybeProposeSkillWriteback(
  recordedTrace: ExperienceTrace,
): Promise<{ proposed: boolean; proposal_id?: string; error?: string }> {
  try {
    const tool = recordedTrace.action.tool;
    if (!tool || tool === "forge_experience_trace") {
      return { proposed: false }; // Don't propose about the trace tool itself
    }

    // Cooldown: don't re-propose same tool within 60s
    const cooldownPath = `${SKILL_PROPOSALS_DIR}/.cooldown-${tool}.txt`;
    try {
      const cooldownStat = await stat(cooldownPath);
      if (Date.now() - cooldownStat.mtimeMs < P2_PROPOSAL_COOLDOWN_MS) {
        return { proposed: false };
      }
    } catch {
      // No cooldown file — proceed
    }

    // Read last N traces (already locked by caller via recordExperienceTrace)
    const recentTraces = await loadTraces();
    const window = recentTraces.slice(-P2_WINDOW);
    const sameToolTraces = window.filter(
      (t) => t.action.tool === tool && t.trace_id !== recordedTrace.trace_id,
    );

    if (sameToolTraces.length + 1 < P2_THRESHOLD) {
      return { proposed: false };
    }

    // Detect pattern
    const allTraces = [...sameToolTraces, recordedTrace];
    const successCount = allTraces.filter((t) => t.observation.success).length;
    const successRate = Number((successCount / allTraces.length).toFixed(2));
    const diffSignatures = allTraces
      .map((t) => t.feedback.environmental?.match(/diffs=\[(.*?)\]/)?.[1] ?? "")
      .filter(Boolean);

    let patternKind: "high_failure_rate" | "diff_volatility" | "ok_repetitive" = "ok_repetitive";
    if (successRate < 0.5) {
      patternKind = "high_failure_rate";
    } else if (diffSignatures.length >= 2 && new Set(diffSignatures).size > 1) {
      patternKind = "diff_volatility";
    }

    const proposalId = `prop-${Date.now()}-${tool}`;
    const proposal = {
      proposal_id: proposalId,
      created_at: new Date().toISOString(),
      tool,
      pattern: {
        kind: patternKind,
        occurrences: allTraces.length,
        window: P2_WINDOW,
        success_rate: successRate,
        diff_signature_count: new Set(diffSignatures).size,
      },
      suggested_skill: {
        name: `${tool}-${patternKind}-guard`,
        description:
          patternKind === "high_failure_rate"
            ? `Auto-suggested: frequent failures for ${tool}. Consider adding pre-flight check or guard skill.`
            : patternKind === "diff_volatility"
              ? `Auto-suggested: high diff volatility for ${tool}. Consider adding expected_output scaffolding or calibration skill.`
              : `Auto-suggested: repetitive ${tool} usage. Consider caching or specializing.`,
        content_hint: "Patch via skill_manage after F13 ratification.",
      },
      evidence_trace_ids: allTraces.map((t) => t.trace_id),
      f13_status: "PENDING_RATIFICATION",
      ratification_path: 'awaiting F13 signal "ratify" or "reject"',
    };

    // Ensure dir + write proposal (fail-soft)
    await mkdir(SKILL_PROPOSALS_DIR, { recursive: true });
    const proposalPath = `${SKILL_PROPOSALS_DIR}/${proposalId}.json`;
    await writeFile(proposalPath, JSON.stringify(proposal, null, 2), "utf-8");
    // Update cooldown
    await writeFile(cooldownPath, new Date().toISOString(), "utf-8");

    return { proposed: true, proposal_id: proposalId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[maybeProposeSkillWriteback] failed:", msg);
    return { proposed: false, error: msg };
  }
}

export function registerExperienceTraceTools(server: McpServer): void {
  // ── forge_experience_trace ──
  server.tool(
    "forge_experience_trace",
    "Record an experience trace (Chain-of-Experience). Captures action→observation→feedback→delta " +
    "after every non-trivial forge tool execution. Three feedback channels: self (model critique), " +
    "environmental (test/lint/build), constitutional (floor check). Append-only hash-chained ledger. " +
    "Returns the sealed trace with hash chain link.",
    {
      session_id: z.string().describe("Session ID from arif_init"),
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
      // Delegate to shared helper (single source of truth for chain state).
      // Refactored 2026-09-08 to enable P0 auto-fire from forgeExecute.
      const entry = await recordExperienceTrace(params);

      if ("error" in entry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "HOLD",
              error: entry.error,
            }),
          }],
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            trace_id: entry.trace_id,
            seq: entry.seq,
            ts: entry.ts,
            tool: entry.action.tool,
            agent_id: entry.agent_id,
            success: entry.observation.success,
            feedback_channels: {
              self: !!entry.feedback.self,
              environmental: !!entry.feedback.environmental,
              constitutional: !!entry.feedback.constitutional,
            },
            experience_delta: entry.experience_delta,
            chain: {
              prev_hash: entry.prev_hash.slice(0, 16) + "...",
              hash: entry.hash.slice(0, 16) + "...",
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
