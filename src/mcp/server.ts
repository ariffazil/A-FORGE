/**
 * AF-FORGE MCP Server (stdio)
 *
 * Exposes AF-FORGE governance and agent capabilities as MCP tools.
 * Implements the Model Context Protocol so any MCP-compatible host
 * (Claude Desktop, Cursor, OpenCode, Gemini, Smithery) can invoke
 * AF-FORGE constitutional checks without running the full CLI.
 *
 * Tools:
 *   forge_check_governance  — Run F3/F6/F9 checks on a task string
 *   forge_health            — Return server health + governance floor status
 *   forge_run               — Run a full agent task (explore profile, real LLM)
 *   forge_hold              — Stage an action for 888_HOLD approval
 *   forge_approve           — Approve a held action
 *   forge_remember          — Store a memory in the MemoryContract
 *   forge_recall            — Query memories from the MemoryContract
 *
 * Resources:
 *   forge://governance/floors  — Constitutional floor definitions (F1–F13)
 *   forge://approvals/pending  — Pending approval queue
 *   forge://memory/working     — Working-tier memories
 *
 * Transport: stdio (pipe)
 *
 * @module mcp/server
 * @constitutional F1 Amanah — no irreversible action without VAULT999 seal
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { validateInputClarity } from "../governance/f3InputClarity.js";
import { checkHarmDignity } from "../governance/f6HarmDignity.js";
import { checkInjection } from "../governance/f9Injection.js";
import { readRuntimeConfig } from "../config/RuntimeConfig.js";
import { createLlmProvider } from "../llm/providerFactory.js";
import { getApprovalBoundary, routeApproval } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { runStage, recordFloorViolation } from "../metrics/prometheus.js";
import type { MetabolicStage } from "../types/aki.js";
import { FileVaultClient } from "../vault/index.js";
import { WebhookHumanEscalationClient, NoOpHumanEscalationClient } from "../escalation/index.js";
import { getTicketStore } from "../approval/index.js";
import { GEOX_TOOLS } from "../tools/GEOXTools.js";
import { WEALTH_TOOLS } from "../tools/WealthTools.js";

// ── Server bootstrap ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "af-forge",
  version: "0.1.0",
});

const approvalBoundary = getApprovalBoundary();
const memoryContract = getMemoryContract();

// ── Telemetry helpers ───────────────────────────────────────────────────────

async function telemetryInvoke(tool: string): Promise<void> {
  telemetry.recordInvocation(tool);
}

async function telemetrySuccess(
  tool: string,
  startedAt: number,
  provider?: string,
  extra?: Record<string, unknown>
): Promise<void> {
  telemetry.recordSuccess(tool, provider);
  await telemetry.logEvent({
    epoch: new Date().toISOString(),
    tool,
    action: "success",
    metadata: { durationMs: Date.now() - startedAt, ...extra },
  });
}

async function telemetryFailure(
  tool: string,
  startedAt: number,
  error: unknown
): Promise<void> {
  telemetry.recordFailure(tool);
  const message = error instanceof Error ? error.message : String(error);
  await telemetry.logEvent({
    epoch: new Date().toISOString(),
    tool,
    action: "failure",
    outcome: message,
    metadata: { durationMs: Date.now() - startedAt },
  });
}

// ── Tools ───────────────────────────────────────────────────────────────────

/**
 * forge_check_governance
 * Run all three constitutional floor checks (F3, F6, F9) against a task string.
 * Returns a structured verdict for each floor plus an overall pass/block decision.
 */
server.tool(
  "forge_check_governance",
  "Run AF-FORGE constitutional governance checks (F3 InputClarity, F6 HarmDignity, F9 Injection) against a task string. Returns per-floor verdicts and an overall PASS/BLOCK decision.",
  {
    task: z.string().describe("The task or prompt text to evaluate"),
  },
  async ({ task }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_check_governance");
    return runStage("666_ALIGN" as MetabolicStage, async () => {
    try {
      const f3 = validateInputClarity(task);
      const f6 = checkHarmDignity(task);
      const f9 = checkInjection(task);

      if (f3.verdict === "SABAR") recordFloorViolation("F3", "hard");
      if (f6.verdict === "VOID") recordFloorViolation("F6", "hard");
      if (f9.verdict === "VOID") recordFloorViolation("F9", "hard");

      const blocked =
        f3.verdict === "SABAR" || f6.verdict === "VOID" || f9.verdict === "VOID";

      const floors: Record<string, unknown> = {
        F3_InputClarity: {
          verdict: f3.verdict,
          reason: f3.reason ?? null,
          message: f3.message ?? null,
        },
        F6_HarmDignity: {
          verdict: f6.verdict,
          reason: f6.reason ?? null,
          evidence: f6.evidence ?? [],
          message: f6.message ?? null,
        },
        F9_Injection: {
          verdict: f9.verdict,
          reason: f9.reason ?? null,
          triggeredPatterns: f9.triggeredPatterns ?? [],
          message: f9.message ?? null,
        },
      };

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                overall: blocked ? "BLOCK" : "PASS",
                blocked,
                floors,
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_check_governance", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_check_governance", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_health
 * Return server health and constitutional floor implementation status.
 */
server.tool(
  "forge_health",
  "Return AF-FORGE server health and constitutional floor (F1–F13) implementation status.",
  {},
  async () => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_health");
    return runStage("000_INIT" as MetabolicStage, async () => {
    try {
      const floors: Record<string, { implemented: boolean; gate: string; maturity: string }> = {
        F1_Amanah: { implemented: true, gate: "888_HOLD", maturity: "production" },
        F2_Truth: { implemented: true, gate: "structured evidence markers + claim references", maturity: "v1-heuristic" },
        F3_InputClarity: { implemented: true, gate: "SABAR on vague input", maturity: "production" },
        F4_Entropy: { implemented: true, gate: "budget.tokenCeiling", maturity: "production" },
        F5_Continuity: { implemented: true, gate: "LongTermMemory", maturity: "production" },
        F6_HarmDignity: { implemented: true, gate: "VOID on harm patterns", maturity: "production" },
        F7_Confidence: { implemented: true, gate: "F7 confidence bands", maturity: "production" },
        F8_Grounding: { implemented: true, gate: "evidence required", maturity: "production" },
        F9_Injection: { implemented: true, gate: "VOID on injection patterns", maturity: "production" },
        F10_Privacy: { implemented: true, gate: "PII regex + secret classes + quarantine lane", maturity: "v1-heuristic" },
        F11_Coherence: { implemented: true, gate: "summarizeGovernance()", maturity: "production" },
        F12_Stewardship: { implemented: true, gate: "turn/tool/blocked/error pressure metrics", maturity: "v1-heuristic" },
        F13_Sovereign: { implemented: true, gate: "888_HOLD blocks, no auto-approve", maturity: "production" },
      };

      const implemented = Object.values(floors).filter((f) => f.implemented).length;
      const total = Object.keys(floors).length;

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "healthy",
                version: "0.1.0",
                constitutional_floors: {
                  implemented,
                  total,
                  coverage: `${Math.round((implemented / total) * 100)}%`,
                  floors,
                },
                hardening_debt: [
                  {
                    id: "THERMO-001",
                    description: "apply_patches thermodynamic band calibration test adjusted; debt resolved in this pass",
                    status: "resolved",
                  },
                  {
                    id: "THERMO-002",
                    description: "computeEMV positive-scenario test data corrected; debt resolved in this pass",
                    status: "resolved",
                  },
                ],
                bridge_contract: {
                  endpoint: "/contract",
                  api_version: "0.1.0",
                  min_compatible_client: "0.1.0",
                },
                telemetry: telemetry.getSummary(),
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_health", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_health", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_run
 * Run a governed agent task using the explore profile and a real LLM provider.
 * Governance checks run first — blocked tasks never reach the LLM.
 */
server.tool(
  "forge_run",
  "Run a full AF-FORGE agent task (explore profile). Governance floors F3/F6/F9 run first — blocked tasks return immediately with SABAR or VOID. Uses the configured LLM provider (mock/openai/ollama) from environment. Returns finalText, turnCount, and governance outcome.",
  {
    task: z.string().describe("The task to execute"),
    mode: z
      .enum(["internal_mode", "external_safe_mode"])
      .optional()
      .default("external_safe_mode")
      .describe("Agent execution mode"),
  },
  async ({ task, mode }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_run");
    return runStage("777_FORGE" as MetabolicStage, async () => {
    try {
      const { AgentEngine } = await import("../engine/AgentEngine.js");
      const { LongTermMemory } = await import("../memory/LongTermMemory.js");
      const { ToolRegistry } = await import("../tools/ToolRegistry.js");
const { ReadFileTool, WriteFileTool, ListFilesTool } = await import("../tools/FileTools.js");
        const { GrepTextTool } = await import("../tools/SearchTools.js");
        const { RunCommandTool, RunTestsTool } = await import("../tools/ShellTools.js");
        const { GEOX_TOOLS } = await import("../tools/GEOXTools.js");
        const { WEALTH_TOOLS } = await import("../tools/WealthTools.js");
        const { buildExploreProfile } = await import("../agents/profiles.js");
      const { tmpdir } = await import("node:os");
      const { resolve } = await import("node:path");

      const root = resolve(tmpdir(), `af-forge-mcp-${Date.now()}`);
      const { mkdir, rm } = await import("node:fs/promises");
      await mkdir(root, { recursive: true });

      try {
        const runtimeConfig = readRuntimeConfig();
        const registry = new ToolRegistry();
        registry.register(new ReadFileTool());
        registry.register(new ListFilesTool());
        registry.register(new GrepTextTool());

        if (mode === "internal_mode") {
          registry.register(new WriteFileTool());
          registry.register(new RunCommandTool());
          registry.register(new RunTestsTool());
        }
        for (const ToolClass of GEOX_TOOLS) registry.register(new ToolClass());
        for (const ToolClass of WEALTH_TOOLS) registry.register(new ToolClass());

        const llmProvider = createLlmProvider(runtimeConfig);
        const providerName = runtimeConfig.provider.kind;

        const escalationClient = runtimeConfig.humanEscalationWebhookUrl
          ? new WebhookHumanEscalationClient(runtimeConfig.humanEscalationWebhookUrl)
          : new NoOpHumanEscalationClient();

        const engine = new AgentEngine(buildExploreProfile(mode ?? "external_safe_mode"), {
          llmProvider,
          longTermMemory: new LongTermMemory(resolve(root, "mem.json")),
          toolRegistry: registry,
          vaultClient: new FileVaultClient(resolve(root, "vault999.jsonl")),
          escalationClient,
          featureFlags: runtimeConfig.featureFlags,
          toolPolicy: runtimeConfig.toolPolicy,
          apiPricing: runtimeConfig.apiPricing,
        });

        const result = await engine.run({ task });

        const response = {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  finalText: result.finalText,
                  turnCount: result.turnCount,
                  transcriptLength: result.transcript.length,
                  blocked: result.finalText.includes("VOID") || result.finalText.includes("SABAR"),
                },
                null,
                2
              ),
            },
          ],
        };
        await telemetrySuccess("forge_run", startedAt, providerName, { mode });
        return response;
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    } catch (err) {
      await telemetryFailure("forge_run", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_hold
 * Stage an action in the ApprovalBoundary. High-risk actions get ✋ Needs Yes;
 * low-risk actions get 📋 Ready.
 */
server.tool(
  "forge_hold",
  "Stage an action for 888_HOLD approval. Returns a holdId, badge, and risk assessment. High-risk actions require explicit human approval before execution.",
  {
    description: z.string().describe("Short human-readable description of the action"),
    whatWillHappen: z.string().describe("Plain language summary of the action"),
    sideEffects: z.array(z.string()).optional().default([]).describe("List of specific side effects"),
    riskLevel: z.enum(["minimal", "low", "medium", "high", "critical"]).optional().describe("Explicit risk override"),
    reasoning: z.string().optional().describe("Why this action is recommended"),
  },
  async ({ description, whatWillHappen, sideEffects, riskLevel, reasoning }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_hold");
    return runStage("888_JUDGE" as MetabolicStage, async () => {
    try {
      const preview = approvalBoundary.createPreview(description, {
        whatWillHappen,
        sideEffects,
        reasoning: reasoning ?? "Staged via MCP",
        riskLevel: riskLevel ?? "medium",
      });

      const item = approvalBoundary.stageAction(description, preview, "MCP staging");

      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: "forge_hold",
        action: "hold_created",
        outcome: item.state,
        metadata: { holdId: item.holdId, riskTier: item.riskTier },
      });

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                holdId: item.holdId,
                badge: item.badge,
                state: item.state,
                riskTier: item.riskTier,
                expiresAt: item.expiresAt,
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_hold", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_hold", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_approve
 * Approve a held action by holdId.
 */
server.tool(
  "forge_approve",
  "Approve a previously staged action in the 888_HOLD queue.",
  {
    holdId: z.string().describe("The holdId returned by forge_hold"),
    reason: z.string().optional().describe("Reason for approval"),
  },
  async ({ holdId, reason }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_approve");
    return runStage("888_JUDGE" as MetabolicStage, async () => {
    try {
      const item = approvalBoundary.approve(holdId, reason);

      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: "forge_approve",
        action: "hold_approved",
        outcome: item.state,
        metadata: { holdId: item.holdId, previousState: "holding" },
      });

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                holdId: item.holdId,
                badge: item.badge,
                state: item.state,
                decidedAt: item.decidedAt,
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_approve", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_approve", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_route_approval
 * Run a PlannerOutput through PolicyEnforcer + ApprovalRouter.
 *
 * Takes a PlannerOutput JSON (from arifOS PlannerAgent), validates it against
 * PolicyConfig, then stages it in ApprovalBoundary if HUMAN_APPROVAL_REQUIRED.
 *
 * Returns:
 *   AUTO_APPLIED      — patches applied immediately
 *   WAITING_FOR_HUMAN — staged in hold queue; poll / approve via forge_approve
 *   REJECTED          — hard policy violation; no changes made
 *
 * This is the main entry point for the arifOS → AF-FORGE governed edit flow.
 */
server.tool(
  "forge_route_approval",
  "Run a PlannerOutput through PolicyEnforcer + ApprovalRouter. Validates proposed changes against policy, stages high-risk edits for 888_HOLD, auto-applies low-risk diffs. Returns holdId for human approval if WAITING_FOR_HUMAN.",
  {
    planner_output: z.record(z.string(), z.unknown()).describe("PlannerOutput JSON — intent, proposed_changes[], confidence, risk_score"),
    policy_override: z.record(z.string(), z.unknown()).optional().describe("Optional PolicyConfig to override defaults"),
    force_apply: z.boolean().optional().default(false).describe("Skip human-gate and apply directly (for replay after approval)"),
  },
  async ({ planner_output, policy_override, force_apply }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_route_approval");
    return runStage("888_JUDGE" as MetabolicStage, async () => {
    try {
      const { defaultPolicyConfig } = await import("../types/policy.js");
      const { routeApproval } = await import("../approval/ApprovalRouter.js");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plannerOutput = planner_output as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policy = (policy_override ?? defaultPolicyConfig) as any;

      const outcome = await routeApproval(plannerOutput, policy, { forceApply: force_apply });

      const auditAction = outcome.type === "AUTO_APPLIED"
        ? "route_approved"
        : outcome.type === "WAITING_FOR_HUMAN"
          ? "route_waiting"
          : "route_rejected";

      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: "forge_route_approval",
        action: auditAction,
        metadata: {
          outcome: outcome.type,
          reason_codes: "reason_codes" in outcome ? outcome.reason_codes : [],
          holdId: "holdId" in outcome ? outcome.holdId : undefined,
          filesChanged: plannerOutput.proposed_changes?.length ?? 0,
          durationMs: Date.now() - startedAt,
        },
      });

      const result = {
        content: [{ type: "text" as const, text: JSON.stringify(outcome, null, 2) }],
      };
      await telemetrySuccess("forge_route_approval", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_route_approval", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_apply_patches
 * Directly apply a list of unified diffs without going through full routeApproval.
 * Intended for low-risk patch application where the caller already has arifOS sign-off.
 * For full governance, use forge_route_approval instead.
 */
server.tool(
  "forge_apply_patches",
  "Apply a list of unified diffs directly. For governed workflows, use forge_route_approval instead. Returns per-file applied status.",
  {
    patches: z.array(
      z.object({
        file_path: z.string().describe("Relative path to the target file"),
        unified_diff: z.string().describe("Unified diff string"),
      })
    ).describe("Array of patches to apply"),
  },
  async ({ patches }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_apply_patches");
    return runStage("777_FORGE" as MetabolicStage, async () => {
    try {
      const { applyPatches } = await import("../tools/EditorTools.js");
      const results = await applyPatches(patches);
      const allApplied = results.every((r) => r.applied);

      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: "forge_apply_patches",
        action: allApplied ? "patches_applied" : "patches_partial",
        metadata: { count: results.length, durationMs: Date.now() - startedAt },
      });

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ applied: allApplied, results }, null, 2),
          },
        ],
      };
      await telemetrySuccess("forge_apply_patches", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_apply_patches", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_remember
 * Store a memory in the MemoryContract.
 */
server.tool(
  "forge_remember",
  "Store a memory in the AF-FORGE MemoryContract. Memories are tiered (ephemeral, working, canon, sacred, quarantine) and persisted to ~/.arifos/memory.jsonl.",
  {
    content: z.string().describe("The memory content to store"),
    reason: z.string().describe("Why this memory is being stored"),
    tier: z.enum(["ephemeral", "working", "canon", "sacred", "quarantine"]).optional().describe("Memory tier"),
    tags: z.array(z.string()).optional().default([]).describe("Tags for categorization"),
  },
  async ({ content, reason, tier, tags }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_remember");
    return runStage("999_VAULT" as MetabolicStage, async () => {
    try {
      const entry = await memoryContract.store({
        content,
        reason,
        tier,
        tags,
      });

      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: "forge_remember",
        action: "memory_stored",
        outcome: entry.tier,
        metadata: { memoryId: entry.memoryId, tags: entry.tags },
      });

      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                memoryId: entry.memoryId,
                tier: entry.tier,
                createdAt: entry.createdAt,
                pinned: entry.pinned,
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_remember", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_remember", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * forge_recall
 * Query memories from the MemoryContract.
 */
server.tool(
  "forge_recall",
  "Query memories from the AF-FORGE MemoryContract. Searches content, tags, and reasons.",
  {
    query: z.string().describe("Search text"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    minConfidence: z.number().min(0).max(1).optional().describe("Minimum confidence threshold"),
    limit: z.number().int().positive().optional().describe("Maximum results to return"),
  },
  async ({ query, tags, minConfidence, limit }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_recall");
    return runStage("999_VAULT" as MetabolicStage, async () => {
    try {
      const result = memoryContract.query({
        query,
        tags,
        minConfidence,
      });

      const memories = limit ? result.memories.slice(0, limit) : result.memories;

      const response = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total: result.total,
                returned: memories.length,
                memories: memories.map((m) => ({
                  memoryId: m.memoryId,
                  tier: m.tier,
                  content: m.content,
                  confidence: m.confidence,
                  tags: m.tags,
                  reason: m.reason,
                  createdAt: m.createdAt,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_recall", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("forge_recall", startedAt, err);
      throw err;
    }
    });
  }
);

// ── Resources ───────────────────────────────────────────────────────────────

server.resource(
  "forge://governance/floors",
  "forge://governance/floors",
  { mimeType: "application/json" },
  async () => ({
    contents: [
      {
        uri: "forge://governance/floors",
        mimeType: "application/json",
        text: JSON.stringify(
          {
            floors: [
              { id: "F1", name: "Amanah", principle: "No irreversible action without VAULT999 seal", gate: "888_HOLD" },
              { id: "F2", name: "Truth", principle: "No ungrounded claims (τ ≥ 0.99)", gate: "evidence links required" },
              { id: "F3", name: "InputClarity", principle: "Reject vague or empty input", gate: "SABAR" },
              { id: "F4", name: "Entropy", principle: "Respect token/turn budgets", gate: "budget ceiling" },
              { id: "F5", name: "Continuity", principle: "Persist context across sessions", gate: "LongTermMemory" },
              { id: "F6", name: "HarmDignity", principle: "No harmful execution patterns", gate: "VOID" },
              { id: "F7", name: "Confidence", principle: "Signal uncertainty explicitly", gate: "confidence bands" },
              { id: "F8", name: "Grounding", principle: "Claims need evidence", gate: "evidence required" },
              { id: "F9", name: "Injection", principle: "Reject prompt injection and manipulation", gate: "VOID" },
              { id: "F10", name: "Privacy", principle: "Protect personal data", gate: "pending" },
              { id: "F11", name: "Coherence", principle: "Summarise governance state", gate: "summarizeGovernance()" },
              { id: "F12", name: "Stewardship", principle: "Long-horizon resource care", gate: "pending" },
              { id: "F13", name: "Sovereign", principle: "Human holds final authority", gate: "888_HOLD no auto-approve" },
            ],
          },
          null,
          2
        ),
      },
    ],
  })
);

server.resource(
  "forge://approvals/pending",
  "forge://approvals/pending",
  { mimeType: "application/json" },
  async () => {
    const pending = Array.from(
      // @ts-expect-error — accessing private holdQueue for resource surfacing
      approvalBoundary.holdQueue?.values?.() ?? []
    ).filter((item: { state: string }) => item.state === "holding" || item.state === "ready");

    return {
      contents: [
        {
          uri: "forge://approvals/pending",
          mimeType: "application/json",
          text: JSON.stringify({ pending }, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "forge://memory/working",
  "forge://memory/working",
  { mimeType: "application/json" },
  async () => {
    const result = memoryContract.query({ query: "", tiers: ["working"] });

    return {
      contents: [
        {
          uri: "forge://memory/working",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              count: result.total,
              memories: result.memories.map((m) => ({
                memoryId: m.memoryId,
                content: m.content,
                tags: m.tags,
                confidence: m.confidence,
                createdAt: m.createdAt,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * forge_ticket_status
 * Query the status of an approval ticket by ID.
 */
server.tool(
  "forge_ticket_status",
  "Query the status of an 888_HOLD approval ticket by ticketId.",
  {
    ticketId: z.string().describe("The ticket ID to look up"),
  },
  async ({ ticketId }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_ticket_status");
    try {
      const store = getTicketStore();
      await store.initialize();
      const ticket = await store.findById(ticketId);
      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                found: !!ticket,
                ticket: ticket ?? null,
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("forge_ticket_status", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_ticket_status", startedAt, err);
      throw err;
    }
  }
);

server.resource(
  "forge://approvals/tickets",
  "forge://approvals/tickets",
  { mimeType: "application/json" },
  async () => {
    const store = getTicketStore();
    await store.initialize();
    const open = await store.query({
      status: undefined, // all
    });
    const pending = open.filter((t) => t.status === "PENDING" || t.status === "DISPATCHED" || t.status === "ACKED");

    return {
      contents: [
        {
          uri: "forge://approvals/tickets",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              total: open.length,
              open: pending.length,
              tickets: open.slice(0, 50),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * geox_check_hazard
 * Check physical hazard risk for a location using GEOX earth intelligence.
 * Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8 Grounding.
 */
server.tool(
  "geox_check_hazard",
  "Check physical hazard risk for a location using GEOX earth intelligence. Returns hazard level (low/medium/high/critical), probability, intensity, confidence interval, and physical constraint envelopes. All outputs carry ESTIMATE/HYPOTHESIS/UNKNOWN uncertainty tag per F8.",
  {
    location: z.string().optional().describe("Location name or coordinates"),
    latitude: z.number().optional().describe("Latitude of the location"),
    longitude: z.number().optional().describe("Longitude of the location"),
    hazard_types: z
      .array(z.enum(["seismic", "volcanic", "flood", "landslide", "subsidence"]))
      .optional()
      .describe("Types of hazard to assess"),
    scenario: z.string().optional().describe("Scenario context (e.g., 'extraction', 'construction')"),
  },
  async ({ location, latitude, longitude, hazard_types, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_check_hazard");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[0]();
      const result = await tool.run(
        { location, latitude, longitude, hazard_types, scenario },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("geox_check_hazard", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("geox_check_hazard", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * geox_subsurface_model
 * Compute subsurface geological model (porosity, permeability, pressure) at a location/depth.
 */
server.tool(
  "geox_subsurface_model",
  "Compute subsurface geological model for a formation at given depth/location. Returns porosity, permeability, formation pressure, fracture gradient, and injection rate limits. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.",
  {
    latitude: z.number().optional().describe("Latitude"),
    longitude: z.number().optional().describe("Longitude"),
    depth: z.number().optional().describe("Target depth in meters"),
    formation_type: z.enum(["sandstone", "carbonate", "shale", "granite", "volcanic"]).optional().describe("Rock formation type"),
    scenario: z.string().optional().describe("extraction, storage, injection"),
  },
  async ({ latitude, longitude, depth, formation_type, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_subsurface_model");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[1]();
      const result = await tool.run(
        { latitude, longitude, depth, formation_type, scenario },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("geox_subsurface_model", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("geox_subsurface_model", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * geox_seismic_interpret
 * Interpret seismic survey data to infer subsurface structure and formation.
 */
server.tool(
  "geox_seismic_interpret",
  "Interpret seismic survey data to infer subsurface structure, formation type, and fault patterns. Returns velocity, impedance contrast, reflectivity, and interpreted formation. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.",
  {
    latitude: z.number().optional().describe("Latitude of survey center"),
    longitude: z.number().optional().describe("Longitude of survey center"),
    depth_range: z.array(z.number()).optional().describe("[minDepth, maxDepth] in meters"),
    frequency_hz: z.number().optional().describe("Dominant frequency in Hz"),
    survey_type: z.enum(["2d", "3d", "4d"]).optional().describe("Survey type"),
    scenario: z.string().optional().describe("exploration, monitoring, reservoir"),
  },
  async ({ latitude, longitude, depth_range, frequency_hz, survey_type, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_seismic_interpret");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[2]();
      const result = await tool.run(
        { latitude, longitude, depth_range, frequency_hz, survey_type, scenario },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("geox_seismic_interpret", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("geox_seismic_interpret", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * geox_prospect_score
 * Score a geological prospect for hydrocarbon potential.
 */
server.tool(
  "geox_prospect_score",
  "Score a geological prospect for hydrocarbon potential. Returns OOIP, GIP, chance factor, and risk breakdown (structural/stratigraphic/charge/seal). Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.",
  {
    latitude: z.number().optional().describe("Latitude"),
    longitude: z.number().optional().describe("Longitude"),
    formation_type: z.string().optional().describe("Reservoir lithology"),
    trap_type: z.enum(["structural", "stratigraphic", "combination", "unconformity"]).optional().describe("Trap type"),
    reservoir_quality: z.number().optional().describe("Porosity × permeability quality (0-1)"),
    scenario: z.string().optional().describe("exploration, appraisal, development"),
  },
  async ({ latitude, longitude, formation_type, trap_type, reservoir_quality, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_prospect_score");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[3]();
      const result = await tool.run(
        { latitude, longitude, formation_type, trap_type, reservoir_quality, scenario },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("geox_prospect_score", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("geox_prospect_score", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * geox_physical_constraint
 * Return physical constraint envelope (pressure, temperature, mud weight) for drilling or injection.
 */
server.tool(
  "geox_physical_constraint",
  "Return physical constraint envelope (pressure, temperature, mud weight) for drilling or injection at a given depth/location. Computes safe operating window with fracture gradient and pore pressure. Tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.",
  {
    latitude: z.number().optional().describe("Latitude"),
    longitude: z.number().optional().describe("Longitude"),
    depth: z.number().optional().describe("Target depth in meters"),
    temperature_c: z.number().optional().describe("Bottom hole temperature in °C"),
    pressure_mpa: z.number().optional().describe("Target pressure in MPa"),
    scenario: z.string().optional().describe("drilling or injection"),
  },
  async ({ latitude, longitude, depth, temperature_c, pressure_mpa, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_physical_constraint");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[4]();
      const result = await tool.run(
        { latitude, longitude, depth, temperature_c, pressure_mpa, scenario },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("geox_physical_constraint", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("geox_physical_constraint", startedAt, err);
      throw err;
    }
    });
  }
);

/**
 * geox_uncertainty_tag
 * Tag any GEOX output claim with F8 uncertainty classification.
 */
server.tool(
  "geox_uncertainty_tag",
  "Tag any GEOX output claim with F8 uncertainty classification. Returns ESTIMATE/HYPOTHESIS/UNKNOWN, confidence score, uncertainty band, and recommended pipeline stage.",
  {
    sourceTool: z.string().optional(),
    evidenceCount: z.number().optional(),
    confidenceInterval: z.array(z.number()).optional(),
    claimType: z.enum(["hazard", "formation", "pressure", "temperature", "reserve", "emission"]).optional(),
    localDataQuality: z.enum(["high", "medium", "low"]).optional(),
  },
  async ({ sourceTool, evidenceCount, confidenceInterval, claimType, localDataQuality }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_uncertainty_tag");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[5]();
      const result = await tool.run({ sourceTool, evidenceCount, confidenceInterval, claimType, localDataQuality }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_uncertainty_tag", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_uncertainty_tag", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_witness_triad
 * Verify a physical claim using Tri-Witness W³ consensus.
 */
server.tool(
  "geox_witness_triad",
  "Verify a physical claim using Tri-Witness W³ consensus. Three independent methods must agree within threshold to reach consensus. Returns W³ score, verdict, and recommended action.",
  {
    claim: z.string(),
    method1: z.object({ type: z.string(), result: z.string(), confidence: z.number() }).optional(),
    method2: z.object({ type: z.string(), result: z.string(), confidence: z.number() }).optional(),
    method3: z.object({ type: z.string(), result: z.string(), confidence: z.number() }).optional(),
  },
  async ({ claim, method1, method2, method3 }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_witness_triad");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[6]();
      const result = await tool.run({ claim, method1, method2, method3 }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_witness_triad", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_witness_triad", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_ground_truth
 * Check F8 Grounding for a physical claim.
 */
server.tool(
  "geox_ground_truth",
  "Check F8 Grounding for a physical claim. Verifies that assertions have sufficient independent evidence. Returns grounded boolean, grounding score, missing evidence list, and F8 verdict.",
  {
    claim: z.string(),
    evidenceSources: z.array(z.string()).optional(),
    claimedConfidence: z.number().optional(),
    claimType: z.enum(["hazard", "reserve", "formation", "emission", "climate"]).optional(),
  },
  async ({ claim, evidenceSources, claimedConfidence, claimType }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_ground_truth");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[7]();
      const result = await tool.run({ claim, evidenceSources, claimedConfidence, claimType }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_ground_truth", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_ground_truth", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_log_interpreter
 * Triple-combo log interpreter: GR + RT + RHOB + NPHI → Vsh, PHIE, SW, fluid type, lithology.
 * Uses anomalous contrast theory: every geological feature = contrast in ≥2 independent properties.
 */
server.tool(
  "geox_log_interpreter",
  "Interpret triple-combo wireline logs (GR, RT, RHOB, NPHI, SP, DT, CAL) to compute Vsh, PHIE, SW, fluid type, and lithology using anomalous contrast theory. Returns Vsh, PHIE, SW, BVW, anomaly score, fluid flags (WATER/GAS/OIL), lithology, quality, and anomalous contrast metrics (κGR, κRHOB, κNPHI, κRT, composite). All tagged ESTIMATE/HYPOTHESIS/UNKNOWN per F8.",
  {
    GR: z.array(z.number()).optional().describe("Gamma Ray API values"),
    RT: z.array(z.number()).optional().describe("Deep resistivity ohm-m"),
    RHOB: z.array(z.number()).optional().describe("Bulk density g/cc"),
    NPHI: z.array(z.number()).optional().describe("Neutron porosity fraction"),
    SP: z.array(z.number()).optional().describe("Spontaneous potential mV"),
    DT: z.array(z.number()).optional().describe("Sonic transit time us/ft"),
    CAL: z.array(z.number()).optional().describe("Caliper inches"),
    depth: z.array(z.number()).optional().describe("Depth values matching log arrays"),
    GR_clean: z.number().optional().describe("GR for clean sand baseline"),
    GR_shale: z.number().optional().describe("GR for shale baseline"),
    RW: z.number().optional().describe("Formation water resistivity ohm-m"),
    matrix: z.string().optional().describe("Matrix type (sandstone, limestone, dolomite)"),
  },
  async ({ GR, RT, RHOB, NPHI, SP, DT, CAL, depth, GR_clean, GR_shale, RW, matrix }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_log_interpreter");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const { GEOXLogInterpreterTool } = await import("../domains/geophysics/logInterpreter.js");
      const tool = new GEOXLogInterpreterTool();
      const result = await tool.run({ GR, RT, RHOB, NPHI, SP, DT, CAL, depth, GR_clean, GR_shale, RW, matrix }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_log_interpreter", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_log_interpreter", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_maraoh_impact
 * Assess community dignity and cultural heritage impact (F6 maruah).
 */
server.tool(
  "geox_maraoh_impact",
  "Assess community dignity and cultural heritage impact (F6 maruah) of a physical operation. Returns maruah score, dignity impact, cultural heritage risk, stakeholder concern, and mitigation.",
  {
    location: z.string().optional(),
    latitude: z.number().optional(),
    operationType: z.enum(["extraction", "injection", "storage", "construction"]).optional(),
    distance_km: z.number().optional(),
    population_density: z.number().optional(),
  },
  async ({ location, latitude, operationType, distance_km, population_density }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_maraoh_impact");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[8]();
      const result = await tool.run({ location, latitude, operationType, distance_km, population_density }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_maraoh_impact", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_maraoh_impact", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_extraction_limits
 * Compute maximum safe extraction rate and cumulative production limits.
 */
server.tool(
  "geox_extraction_limits",
  "Compute maximum safe extraction rate and cumulative production limits for a reservoir. Returns maxSafeRate, maxCumulative, rateStability, and depletion%.",
  {
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    depth: z.number().optional(),
    formation_type: z.string().optional(),
    currentRate: z.number().optional(),
    scenario: z.string().optional(),
  },
  async ({ latitude, longitude, depth, formation_type, currentRate, scenario }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_extraction_limits");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[9]();
      const result = await tool.run({ latitude, longitude, depth, formation_type, currentRate, scenario }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_extraction_limits", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_extraction_limits", startedAt, err); throw err; }
    });
  }
);

/**
 * geox_climate_bounds
 * Compute climate bounds (temperature rise, sea level, carbon budget).
 */
server.tool(
  "geox_climate_bounds",
  "Compute climate bounds (temperature rise, sea level, carbon budget) for an emissions scenario. Returns optimistic/pessimistic bounds with uncertainty tag.",
  {
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    scenario: z.string().optional(),
    emission_kg_co2: z.number().optional(),
    time_horizon_years: z.number().optional(),
  },
  async ({ latitude, longitude, scenario, emission_kg_co2, time_horizon_years }) => {
    const startedAt = Date.now();
    await telemetryInvoke("geox_climate_bounds");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const tool = new GEOX_TOOLS[10]();
      const result = await tool.run({ latitude, longitude, scenario, emission_kg_co2, time_horizon_years }, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
      const parsed = JSON.parse(result.output as string);
      const response = { content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }] };
      await telemetrySuccess("geox_climate_bounds", startedAt);
      return response;
    } catch (err) { await telemetryFailure("geox_climate_bounds", startedAt, err); throw err; }
    });
  }
);

/**
 * wealth_evaluate_ROI
 * Evaluate investment ROI against WEALTH objective function and thermodynamic cost.
 * Returns PROCEED/HOLD/VOID based on EMV, NPV, maruah score, and OPS/777 band.
 */
server.tool(
  "wealth_evaluate_ROI",
  "Evaluate an investment or resource allocation against the WEALTH objective function. Returns decision (PROCEED/HOLD/VOID), EMV, NPV, maruah score (F6), reversibility coefficient, thermodynamic band, and violation list. Use this before committing significant resources.",
  {
    domain: z.enum(["GEOX", "WEALTH", "CODE"]).optional().describe("Domain of the investment"),
    initial_investment: z.number().describe("Initial cost or investment (positive number)"),
    scenarios: z
      .array(
        z.object({
          probability: z.number().describe("Probability of this scenario (0-1)"),
          cash_flow: z.number().describe("Net cash flow if this scenario occurs"),
          label: z.string().optional().describe("Human-readable label"),
        })
      )
      .describe("Array of investment scenarios with probabilities"),
    joules: z.number().optional().describe("Thermodynamic resource cost in joules"),
    reasoning: z.string().optional().describe("Context or goal for the investment"),
  },
  async ({ domain, initial_investment, scenarios, joules, reasoning }) => {
    const startedAt = Date.now();
    await telemetryInvoke("wealth_evaluate_ROI");
    return runStage("777_FORGE" as MetabolicStage, async () => {
    try {
      const tool = new WEALTH_TOOLS[0]();
      const result = await tool.run(
        { domain, initial_investment, scenarios, joules, reasoning },
        { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" }
      );
      const parsed = JSON.parse(result.output as string);
      const response = {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
      };
      await telemetrySuccess("wealth_evaluate_ROI", startedAt);
      return response;
    } catch (err) {
      await telemetryFailure("wealth_evaluate_ROI", startedAt, err);
      throw err;
    }
    });
  }
);

async function main() {
  await approvalBoundary.initialize();
  await memoryContract.initialize();
  await telemetry.initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[af-forge-mcp] Server started on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[af-forge-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
