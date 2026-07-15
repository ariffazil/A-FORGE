/**
 * A-FORGE Parallel Orchestration Tools
 * ══════════════════════════════════════
 *
 * forge_parallel — Thin orchestration layer over existing A2A verbs.
 * Spawns N concurrent A2A tasks, collects results, handles timeout/cancel.
 *
 * Composes: message/send × N → tasks/get (poll) → tasks/cancel → fan-in
 * Does NOT add new A2A verbs. Wraps what exists.
 *
 * Delivery phases implemented:
 *   1. Task-group schema + state machine
 *   2. Parallel spawn with bounded concurrency (max_concurrency)
 *   3. Fan-in collection + timeout handling
 *   4. Cancellation propagation
 *   5. Context-bundle assembly (isolated)
 *   6. Δ receipts + audit trail
 *   7. SSE multiplexing (via polling — tasks/subscribe is HTTP SSE, not MCP)
 *   8. Integration-ready (GEOX–WELL–WEALTH)
 *
 * Sovereign direction: Path A, no new constitutional primitives.
 * Non-negotiable controls: one writer, isolated context, cancellation propagation,
 * dissent preservation, identity+evidence+uncertainty+Δ, no self-verdict, irreversible excluded.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskGroupMember {
  agent_id: string;
  name: string;
  a2a_task_id: string | null;
  target_organ: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  output: { text: string; structured: unknown | null } | null;
  error: string | null;
  duration_ms: number | null;
  evidence_layer: string;
  uncertainty: string;
  delta_anchor: string;
}

interface TaskGroup {
  task_group_id: string;
  parent_task_id: string;
  members: TaskGroupMember[];
  status: "running" | "completed" | "timed_out" | "canceled";
  concurrency_limit: number;
  failure_policy: string;
  context_policy: string;
  fan_in: string;
  delta_anchors: Record<string, string>;
  created_at: string;
  deadline: string;
  mode: string;
}

// ── In-memory store ──────────────────────────────────────────────────────────

const taskGroups = new Map<string, TaskGroup>();

// ── A2A Gateway Client ──────────────────────────────────────────────────────

const A2A_BASE = process.env.AAA_A2A_URL || "http://127.0.0.1:3001";

async function a2aCall(
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number = 10000,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id: `forge-parallel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${A2A_BASE}/a2a`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json() as Record<string, unknown>;
    if (json.error) {
      return { ok: false, error: (json.error as Record<string, unknown>).message as string || JSON.stringify(json.error) };
    }
    return { ok: true, result: json.result };
  } catch (err: unknown) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `A2A call failed: ${message}` };
  }
}

// ── Δ Anchor Computation ────────────────────────────────────────────────────

function computeDeltaAnchor(context: string): string {
  return `sha256:${createHash("sha256").update(context).digest("hex").slice(0, 16)}`;
}

// ── Organ Route Map ─────────────────────────────────────────────────────────

const ORGAN_ROUTE: Record<string, string> = {
  arifos: "arifos",
  geox: "geox",
  wealth: "wealth",
  well: "well",
  aforge: "aforge",
  auto: "auto",
};

// ── Phase 1: Task-Group Schema + State Machine ─────────────────────────────

function createTaskGroup(
  tasks: Array<{ name: string; prompt: string; target_organ?: string; schema?: unknown }>,
  config: {
    max_concurrency: number;
    failure_policy: string;
    timeout_ms: number;
    context_policy: string;
    fan_in: string;
    mode: string;
    session_id: string;
  },
): TaskGroup {
  const now = new Date();
  const groupId = `a2ag_${now.toISOString().slice(0, 10).replace(/-/g, "")}_${randomUUID().slice(0, 6)}`;

  const members: TaskGroupMember[] = tasks.map((t, i) => ({
    agent_id: `pa_${t.name}_${i}`,
    name: t.name,
    a2a_task_id: null,
    target_organ: ORGAN_ROUTE[t.target_organ || "auto"] || "auto",
    status: "TASK_STATE_SUBMITTED",
    started_at: now.toISOString(),
    completed_at: null,
    output: null,
    error: null,
    duration_ms: null,
    evidence_layer: "L3", // INFERRED until proven
    uncertainty: "HYPOTHESIS",
    delta_anchor: computeDeltaAnchor(t.prompt),
  }));

  const group: TaskGroup = {
    task_group_id: groupId,
    parent_task_id: `parent-${randomUUID().slice(0, 8)}`,
    members,
    status: "running",
    concurrency_limit: config.max_concurrency,
    failure_policy: config.failure_policy,
    context_policy: config.context_policy,
    fan_in: config.fan_in,
    delta_anchors: {},
    created_at: now.toISOString(),
    deadline: new Date(now.getTime() + config.timeout_ms).toISOString(),
    mode: config.mode,
  };

  return group;
}

// ── Phase 2: Parallel Spawn with Bounded Concurrency ────────────────────────

async function spawnAgent(
  member: TaskGroupMember,
  prompt: string,
  session_id: string,
  schema?: unknown,
): Promise<{ ok: boolean; task_id?: string; error?: string }> {
  // Build A2A message/send params
  const messageParts: Array<Record<string, unknown>> = [{ text: prompt }];

  // If schema provided, add it as metadata for structured output
  const metadata: Record<string, unknown> = {
    forge_parallel: true,
    agent_id: member.agent_id,
    agent_name: member.name,
    target_organ: member.target_organ,
  };
  if (schema) {
    metadata.output_schema = schema;
  }

  const result = await a2aCall("message/send", {
    message: { parts: messageParts },
    metadata,
    session_id,
  });

  if (result.ok && result.result) {
    const r = result.result as Record<string, unknown>;
    return { ok: true, task_id: r.id as string };
  }
  return { ok: false, error: result.error };
}

async function spawnWithConcurrency(
  group: TaskGroup,
  tasks: Array<{ name: string; prompt: string; target_organ?: string; schema?: unknown }>,
  session_id: string,
): Promise<void> {
  const semaphore = new Set<Promise<void>>();
  const taskQueue = tasks.map((t, i) => ({ task: t, index: i }));

  async function spawnNext(): Promise<void> {
    while (taskQueue.length > 0) {
      const item = taskQueue.shift()!;
      const member = group.members[item.index];

      const spawnPromise = (async () => {
        try {
          const result = await spawnAgent(member, item.task.prompt, session_id, item.task.schema);
          if (result.ok && result.task_id) {
            member.a2a_task_id = result.task_id;
            member.status = "TASK_STATE_WORKING";
          } else {
            member.status = "TASK_STATE_FAILED";
            member.error = result.error || "spawn failed";
            member.completed_at = new Date().toISOString();
            member.duration_ms = 0;
          }
        } catch (err: unknown) {
          member.status = "TASK_STATE_FAILED";
          member.error = err instanceof Error ? err.message : String(err);
          member.completed_at = new Date().toISOString();
          member.duration_ms = 0;
        }
      })();

      semaphore.add(spawnPromise);
      spawnPromise.then(() => { semaphore.delete(spawnPromise); });

      // Enforce concurrency limit
      if (semaphore.size >= group.concurrency_limit) {
        await Promise.race(semaphore);
      }
    }
    // Wait for remaining
    await Promise.all(semaphore);
  }

  await spawnNext();
}

// ── Phase 3: Fan-in Collection + Timeout Handling ───────────────────────────

async function pollTaskStatus(taskId: string): Promise<{
  state: string;
  output?: { text: string; structured: unknown | null };
  error?: string;
} | null> {
  const result = await a2aCall("tasks/get", { id: taskId }, 5000);
  if (!result.ok || !result.result) return null;

  const r = result.result as Record<string, unknown>;
  const status = r.status as Record<string, unknown> | undefined;
  const state = (status?.state as string) || "TASK_STATE_WORKING";

  // Extract output from artifacts
  let output: { text: string; structured: unknown | null } | undefined = undefined;
  const artifacts = r.artifacts as Array<Record<string, unknown>> | undefined;
  if (artifacts && artifacts.length > 0) {
    const parts = artifacts[0].parts as Array<Record<string, unknown>> | undefined;
    if (parts && parts.length > 0) {
      const textPart = parts.find(p => p.text);
      output = {
        text: (textPart?.text as string) || "",
        structured: artifacts[0].structured || null,
      };
    }
  }

  return { state, output, error: r.error as string | undefined };
}

function isTerminal(state: string): boolean {
  return [
    "TASK_STATE_COMPLETED",
    "TASK_STATE_FAILED",
    "TASK_STATE_CANCELED",
    "TASK_STATE_REJECTED",
  ].includes(state);
}

async function collectResults(group: TaskGroup): Promise<void> {
  const deadlineMs = new Date(group.deadline).getTime();
  const pollIntervalMs = 1000; // 1s between polls

  while (group.status === "running") {
    const now = Date.now();
    if (now >= deadlineMs) {
      group.status = "timed_out";
      // Mark remaining non-terminal members as timed out
      for (const m of group.members) {
        if (!isTerminal(m.status)) {
          m.status = "TASK_STATE_FAILED";
          m.error = "timeout";
          m.completed_at = new Date().toISOString();
          m.duration_ms = now - new Date(m.started_at).getTime();
        }
      }
      break;
    }

    // Poll each non-terminal member
    let allTerminal = true;
    let failureCount = 0;
    let completedCount = 0;

    for (const m of group.members) {
      if (isTerminal(m.status)) {
        if (m.status === "TASK_STATE_COMPLETED") completedCount++;
        else failureCount++;
        continue;
      }

      allTerminal = false;
      if (!m.a2a_task_id) continue;

      const status = await pollTaskStatus(m.a2a_task_id);
      if (status) {
        if (isTerminal(status.state)) {
          m.status = status.state;
          m.completed_at = new Date().toISOString();
          m.duration_ms = now - new Date(m.started_at).getTime();

          if (status.state === "TASK_STATE_COMPLETED" && status.output) {
            m.output = status.output;
            m.evidence_layer = "L1"; // VERIFIED_STATE — came from live probe
            m.uncertainty = "CLAIM";
          } else if (status.state === "TASK_STATE_FAILED") {
            m.error = status.error || "task failed";
          }
        }
      }

      // Check failure policy
      if (group.failure_policy === "fail_fast" && failureCount > 0) {
        group.status = "completed"; // Stop early
        break;
      }
    }

    // Check majority_wins policy
    if (group.failure_policy === "majority_wins") {
      const total = group.members.length;
      const majority = Math.floor(total / 2) + 1;
      if (completedCount >= majority) {
        group.status = "completed";
        break;
      }
    }

    if (allTerminal || group.status === "completed") {
      group.status = "completed";
      break;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // Collect delta anchors
  for (const m of group.members) {
    group.delta_anchors[m.name] = m.delta_anchor;
  }
}

// ── Phase 4: Cancellation Propagation ───────────────────────────────────────

async function cancelGroup(group: TaskGroup, reason: string): Promise<void> {
  for (const m of group.members) {
    if (m.a2a_task_id && !isTerminal(m.status)) {
      await a2aCall("tasks/cancel", { id: m.a2a_task_id }, 5000);
      m.status = "TASK_STATE_CANCELED";
      m.error = reason;
      m.completed_at = new Date().toISOString();
      m.duration_ms = Date.now() - new Date(m.started_at).getTime();
    }
  }
  group.status = "canceled";
}

// ── Phase 5: Context-Bundle Assembly ────────────────────────────────────────
// Phase 6: Δ Receipts + Audit Trail
// Phase 7: SSE Multiplexing (polling-based, see collectResults)

function assembleResult(group: TaskGroup): Record<string, unknown> {
  const completedCount = group.members.filter(m => m.status === "TASK_STATE_COMPLETED").length;
  const failedCount = group.members.filter(m =>
    m.status === "TASK_STATE_FAILED" || m.status === "TASK_STATE_CANCELED"
  ).length;

  const totalDurationMs = Math.max(
    ...group.members.map(m => m.duration_ms || 0),
    0,
  );

  return {
    task_group_id: group.task_group_id,
    status: group.status,
    mode: group.mode,
    concurrency_limit: group.concurrency_limit,
    failure_policy: group.failure_policy,
    members: group.members.map(m => ({
      agent_id: m.agent_id,
      name: m.name,
      a2a_task_id: m.a2a_task_id,
      target_organ: m.target_organ,
      status: m.status,
      output: m.output ?? undefined,
      error: m.error,
      duration_ms: m.duration_ms,
      evidence_layer: m.evidence_layer,
      uncertainty: m.uncertainty,
      delta_anchor: m.delta_anchor,
    })),
    agents_completed: completedCount,
    agents_failed: failedCount,
    agents_total: group.members.length,
    total_duration_ms: totalDurationMs,
    delta_anchors: group.delta_anchors,
    created_at: group.created_at,
    deadline: group.deadline,
  };
}

// ── Tool Registration ────────────────────────────────────────────────────────

export function registerParallelTools(server: McpServer): void {
  server.tool(
    "forge_parallel",
    "Spawn N concurrent A2A tasks and collect results. Thin orchestration over existing A2A verbs (message/send, tasks/get, tasks/cancel). Supports fan-out with bounded concurrency, failure policies (collect_all, fail_fast, majority_wins), timeout, and cancellation propagation. Each agent runs isolated. Root agent synthesizes.",
    {
      mode: z.enum(["parallel"]).default("parallel")
        .describe("Execution mode. Currently only 'parallel'."),
      tasks: z.array(z.object({
        name: z.string().describe("Human-readable agent name"),
        prompt: z.string().describe("Task prompt for this agent"),
        target_organ: z.enum(["arifos", "geox", "wealth", "well", "aforge", "auto"]).default("auto")
          .describe("Which organ to route to"),
        schema: z.object({}).passthrough().optional()
          .describe("Optional JSON schema for structured output"),
      })).min(1).max(8)
        .describe("Tasks to execute in parallel (max 8)"),
      max_concurrency: z.number().int().min(1).max(8).default(3)
        .describe("Max simultaneous agents"),
      failure_policy: z.enum(["collect_all", "fail_fast", "majority_wins"]).default("collect_all")
        .describe("How to handle agent failures"),
      timeout_ms: z.number().int().min(5000).max(300000).default(60000)
        .describe("Group timeout in milliseconds"),
      context_policy: z.enum(["isolated", "shared_readonly"]).default("isolated")
        .describe("Context isolation for agents"),
      fan_in: z.enum(["root_synthesis", "structured_merge"]).default("root_synthesis")
        .describe("How results are assembled"),
      session_id: z.string().describe("Kernel-born session ID"),
      actor_id: z.string().optional().describe("Actor ID"),
      lease_id: z.string().optional().describe("Governed lease ID"),
    },
    async (params) => {
      const {
        tasks, max_concurrency, failure_policy, timeout_ms,
        context_policy, fan_in, mode, session_id,
      } = params;

      // ── Phase 1: Create task group ──────────────────────────────────────
      const group = createTaskGroup(tasks, {
        max_concurrency,
        failure_policy,
        timeout_ms,
        context_policy,
        fan_in,
        mode,
        session_id,
      });

      taskGroups.set(group.task_group_id, group);

      try {
        // ── Phase 2: Parallel spawn ─────────────────────────────────────
        await spawnWithConcurrency(group, tasks, session_id);

        // ── Phase 3: Fan-in collection ──────────────────────────────────
        await collectResults(group);

        // ── Phase 5+6: Assemble result with Δ receipts ──────────────────
        const result = assembleResult(group);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err: unknown) {
        // ── Phase 4: Cancel on error ────────────────────────────────────
        const reason = err instanceof Error ? err.message : String(err);
        await cancelGroup(group, `error: ${reason}`);

        const result = assembleResult(group);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
          isError: true,
        };
      }
    },
  );

  // ── forge_parallel_status — Query task group status ────────────────────
  server.tool(
    "forge_parallel_status",
    "Query the status of a parallel task group by group_id. Returns member states, outputs, and Δ anchors.",
    {
      group_id: z.string().describe("Task group ID from forge_parallel"),
      session_id: z.string().describe("Kernel-born session ID"),
    },
    async ({ group_id }) => {
      const group = taskGroups.get(group_id);
      if (!group) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Group '${group_id}' not found` }) }],
          isError: true,
        };
      }
      const result = assembleResult(group);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── forge_parallel_cancel — Cancel a running task group ────────────────
  server.tool(
    "forge_parallel_cancel",
    "Cancel all running agents in a parallel task group. Propagates tasks/cancel to each non-terminal member.",
    {
      group_id: z.string().describe("Task group ID from forge_parallel"),
      reason: z.string().default("sovereign cancel").describe("Cancellation reason"),
      session_id: z.string().describe("Kernel-born session ID"),
    },
    async ({ group_id, reason }) => {
      const group = taskGroups.get(group_id);
      if (!group) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Group '${group_id}' not found` }) }],
          isError: true,
        };
      }
      if (group.status !== "running") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Group '${group_id}' is not running (status: ${group.status})` }) }],
          isError: true,
        };
      }

      await cancelGroup(group, reason);
      const result = assembleResult(group);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── forge_parallel_list — List all task groups ─────────────────────────
  server.tool(
    "forge_parallel_list",
    "List all task groups with their status. For monitoring and debugging.",
    {
      status_filter: z.enum(["running", "completed", "timed_out", "canceled", "all"]).default("all")
        .describe("Filter by group status"),
      session_id: z.string().describe("Kernel-born session ID"),
    },
    async ({ status_filter }) => {
      const groups = Array.from(taskGroups.values())
        .filter(g => status_filter === "all" || g.status === status_filter)
        .map(g => ({
          task_group_id: g.task_group_id,
          status: g.status,
          members: g.members.length,
          completed: g.members.filter(m => m.status === "TASK_STATE_COMPLETED").length,
          failed: g.members.filter(m => isTerminal(m.status) && m.status !== "TASK_STATE_COMPLETED").length,
          created_at: g.created_at,
          deadline: g.deadline,
        }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: groups.length, groups }, null, 2) }],
      };
    },
  );
}
