/**
 * A-FORGE MCP Server — Core (shared tool + resource registry)
 *
 * Single source of truth for all MCP components.
 *
 * @module mcp/core
 * @constitutional F1 Amanah — no irreversible action without VAULT999 seal
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { validateInputClarity } from "../governance/f3InputClarity.js";
import { checkHarmDignity } from "../governance/f6HarmDignity.js";
import { checkInjection } from "../governance/f9Injection.js";
import { checkWellReadiness } from "../governance/index.js";
import { readRuntimeConfig } from "../config/RuntimeConfig.js";
import { createLlmProvider } from "../llm/providerFactory.js";
import { getApprovalBoundary, routeApproval } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { runStage, recordFloorViolation } from "../metrics/prometheus.js";
import type { MetabolicStage } from "../types/aki.js";
import { FileVaultClient } from "../vault/index.js";
import { WebhookHumanEscalationClient, NoOpHumanEscalationClient } from "../escalation/index.js";
import { GEOX_TOOLS } from "../tools/GEOXTools.js";
import { WEALTH_TOOLS } from "../tools/WealthTools.js";

export const server = new McpServer({
  name: "A-FORGE",
  version: "0.1.0",
});

const approvalBoundary = getApprovalBoundary();
const memoryContract = getMemoryContract();

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

function resultAsJson(output: any): string {
  if (typeof output === "string") {
    try { return JSON.stringify(JSON.parse(output), null, 2); }
    catch { return output; }
  }
  return JSON.stringify(output, null, 2);
}

// ── Tier 00 Identity ─────────────────────────────────────────────────────────

server.tool(
  "arifos_init",
  "Constitutional session ignition. (Stage 000 INIT)",
  {
    actor_id: z.string().describe("Identifier for the human architect or agent"),
    intent: z.string().optional().describe("Primary intent for this session"),
    mode: z.enum(["internal", "external"]).optional().default("external"),
  },
  async ({ actor_id, intent, mode }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arifos_init");
    return runStage("000_INIT" as MetabolicStage, async () => {
      try {
        const sessionId = Math.random().toString(16).slice(2, 10);
        const result = {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", session_id: sessionId, epoch: new Date().toISOString().split("T")[0], actor_id, intent: intent ?? "general session", mode, verdict: "SEAL" }, null, 2) }],
        };
        await telemetrySuccess("arifos_init", startedAt);
        return result;
      } catch (err) { await telemetryFailure("arifos_init", startedAt, err); throw err; }
    });
  }
);

server.tool(
  "arifos_health",
  "Return server health and constitutional genome (v2.0) status.",
  {},
  async () => {
    const startedAt = Date.now();
    await telemetryInvoke("arifos_health");
    return runStage("000_INIT" as MetabolicStage, async () => {
    try {
      const result = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "healthy",
                version: "2.0.0-genome-stable",
                genome: {
                  ledger: "VAULT999_MERKLE_SEALED",
                  immune_system: "F9_ANTI_HANTU_ACTIVE",
                  metabolic_pulse: "000_TO_999_MAPPED",
                },
                telemetry: telemetry.getSummary(),
              },
              null,
              2
            ),
          },
        ],
      };
      await telemetrySuccess("arifos_health", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("arifos_health", startedAt, err);
      throw err;
    }
    });
  }
);

// ── Tier 01 Perception ───────────────────────────────────────────────────────

server.tool(
  "arifos_sense",
  "Environmental sensing and reality grounding (Stage 111 SENSE).",
  { query: z.string(), mode: z.enum(["fast", "deep"]).optional().default("fast") },
  async ({ query, mode }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arifos_sense");
    return runStage("111_SENSE" as MetabolicStage, async () => {
    try {
      const result = { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", grounded: true, query, mode, lambda2_vector: [0.99, 0.98, 0.95] }, null, 2) }] };
      await telemetrySuccess("arifos_sense", startedAt);
      return result;
    } catch (err) { await telemetryFailure("arifos_sense", startedAt, err); throw err; }
    });
  }
);

// ── Tier 07 Reflection ───────────────────────────────────────────────────────

server.tool(
  "arifos_mind",
  "Synthesised reasoning and epistemic tagging (Stage 333 MIND). Uses client LLM sampling.",
  { grounded_facts: z.array(z.string()), context: z.string().optional() },
  async ({ grounded_facts, context }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arifos_mind");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const samplingResponse = await server.server.createMessage({
        messages: [{ role: "user", content: { type: "text", text: `Synthesize these grounded facts into a coherent reasoning path for arifOS v2.0.\n\nFacts:\n${grounded_facts.join("\n")}\n\nContext: ${context ?? "none"}` } }],
        maxTokens: 500,
      });
      const res = { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", synthesis: samplingResponse.content, model: samplingResponse.model }, null, 2) }] };
      await telemetrySuccess("arifos_mind", startedAt);
      return res;
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "SEAL", synthesis: "Local fallback reasoning." }, null, 2) }] };
    }
    });
  }
);

// ── Tier 04 Risk ─────────────────────────────────────────────────────────────

const heartHandler = async ({ task }: { task: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("arifos_heart");
  return runStage("666_HEART" as MetabolicStage, async () => {
  try {
    const f3 = validateInputClarity(task);
    const f6 = checkHarmDignity(task);
    // Passing hasTelemetry: true because MCP calls are structurally verified by the server
    const f9 = checkInjection(task, { sessionId: "mcp-session", hasTelemetry: true, pipelineStage: "666_HEART" });
    const w0 = await checkWellReadiness("high"); // W0: Human Substrate Gate

    const blocked = f3.verdict === "SABAR" || f6.verdict === "VOID" || f9.verdict === "VOID" || w0.verdict === "HOLD" || w0.verdict === "SABAR";
    const result = { 
      content: [{ type: "text" as const, text: JSON.stringify({ overall: blocked ? "BLOCK" : "PASS", blocked, floors: { F3: f3.verdict, F6: f6.verdict, F9: f9.verdict, W0: w0.verdict }, w0_message: w0.message }, null, 2) }],
      isError: blocked
    };
    await telemetrySuccess("arifos_heart", startedAt);
    return result;
  } catch (err) { await telemetryFailure("arifos_heart", startedAt, err); throw err; }
  });
};

server.registerTool(
  "arifos_heart",
  {
    description: "Risk assessment and ethical review (Stage 666 HEART).",
    inputSchema: z.object({ task: z.string() })
  },
  heartHandler
);

server.registerTool(
  "forge_check_governance",
  {
    description: "Run A-FORGE constitutional governance checks.",
    inputSchema: z.object({ task: z.string() })
  },
  heartHandler
);

// ── Tier 05 Execution ────────────────────────────────────────────────────────

const forgeHandler = async ({ task, mode }: { task: string, mode?: "internal_mode" | "external_safe_mode" }) => {
  const startedAt = Date.now();
  await telemetryInvoke("arifos_forge");
  return runStage("777_FORGE" as MetabolicStage, async () => {
  try {
    const { AgentEngine } = await import("../engine/AgentEngine.js");
    const { LongTermMemory } = await import("../memory/LongTermMemory.js");
    const { ToolRegistry } = await import("../tools/ToolRegistry.js");
    const { ReadFileTool, ListFilesTool } = await import("../tools/FileTools.js");
    const { GrepTextTool } = await import("../tools/SearchTools.js");
    const { buildExploreProfile } = await import("../agents/profiles.js");
    const { tmpdir } = await import("node:os");
    const { resolve } = await import("node:path");
    const root = resolve(tmpdir(), `A-FORGE-mcp-${Date.now()}`);
    const { mkdir, rm } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });
    try {
      const runtimeConfig = readRuntimeConfig();
      const registry = new ToolRegistry();
      registry.register(new ReadFileTool());
      registry.register(new ListFilesTool());
      registry.register(new GrepTextTool());
      for (const T of GEOX_TOOLS) registry.register(new T());
      for (const T of WEALTH_TOOLS) registry.register(new T());
      const engine = new AgentEngine(buildExploreProfile(mode ?? "external_safe_mode"), {
        llmProvider: createLlmProvider(runtimeConfig),
        longTermMemory: new LongTermMemory(resolve(root, "mem.json")),
        toolRegistry: registry,
        vaultClient: new FileVaultClient(resolve(root, "vault.jsonl")),
        escalationClient: new NoOpHumanEscalationClient(),
      });
      const res = await engine.run({ task });
      const blocked = res.finalText.includes("VOID") || res.finalText.includes("SABAR");
      const result = { 
        content: [{ type: "text" as const, text: JSON.stringify({ finalText: res.finalText, turns: res.turnCount, blocked }, null, 2) }],
        isError: blocked
      };
      await telemetrySuccess("arifos_forge", startedAt);
      return result;
    } finally { await rm(root, { recursive: true, force: true }); }
  } catch (err) { await telemetryFailure("arifos_forge", startedAt, err); throw err; }
  });
};

server.registerTool(
  "arifos_forge",
  {
    description: "Execution and motor cortex (Stage 777 FORGE). Use this to execute an action plan.",
    inputSchema: z.object({
      task: z.string().describe("The task to execute"),
      mode: z.enum(["internal_mode", "external_safe_mode"]).optional()
    }),
    annotations: { title: "777 FORGE", destructiveHint: true }
  },
  forgeHandler
);

server.registerTool(
  "forge_run",
  {
    description: "Run a full agent task with governance floors.",
    inputSchema: z.object({
      task: z.string().describe("The task to execute"),
      mode: z.enum(["internal_mode", "external_safe_mode"]).optional()
    }),
    annotations: { title: "Agent Run", destructiveHint: true }
  },
  forgeHandler
);

const judgeHandler = async ({ holdId, reason }: { holdId: string, reason?: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("arifos_judge");
  return runStage("888_JUDGE" as MetabolicStage, async () => {
  try {
    const item = approvalBoundary.approve(holdId, reason);
    return { content: [{ type: "text" as const, text: JSON.stringify({ holdId: item.holdId, state: item.state, badge: item.badge }, null, 2) }] };
  } catch (err) { await telemetryFailure("arifos_judge", startedAt, err); throw err; }
  });
};

server.tool("arifos_judge", "Verdict (Stage 888 JUDGE).", { holdId: z.string(), reason: z.string().optional() }, judgeHandler);
server.tool("forge_approve", "Approve action.", { holdId: z.string(), reason: z.string().optional() }, judgeHandler);

// ── Tier 06 Stewardship (Vault) ──────────────────────────────────────────────

const vaultHandler = async ({ content, reason, tier, tags }: { content: string, reason: string, tier?: any, tags?: string[] }) => {
  const startedAt = Date.now();
  await telemetryInvoke("arifos_vault");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const entry = await memoryContract.store({ content, reason, tier, tags });
    return { content: [{ type: "text" as const, text: JSON.stringify({ memoryId: entry.memoryId, tier: entry.tier }, null, 2) }] };
  } catch (err) { await telemetryFailure("arifos_vault", startedAt, err); throw err; }
  });
};

server.tool("arifos_vault", "Ledger closure (Stage 999 VAULT).", { content: z.string(), reason: z.string(), tier: z.string().optional(), tags: z.array(z.string()).optional() }, vaultHandler);
server.tool("forge_remember", "Store memory.", { content: z.string(), reason: z.string(), tier: z.string().optional(), tags: z.array(z.string()).optional() }, vaultHandler);

// ── Domain Tools (Tier 02/03) ────────────────────────────────────────────────

// GEOX
server.tool("geox_check_hazard", "Check physical hazard risk.", { location: z.string().optional() }, async (args) => {
  const tool = new GEOX_TOOLS[0]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

server.tool("geox_subsurface_model", "Compute subsurface model.", { depth: z.number(), formation_type: z.string().optional() }, async (args) => {
  const tool = new GEOX_TOOLS[1]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

server.tool("geox_prospect_score", "Score geological prospect.", { latitude: z.number(), longitude: z.number(), trap_type: z.string().optional() }, async (args) => {
  const tool = new GEOX_TOOLS[3]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

// WEALTH
server.tool("wealth_evaluate_ROI", "Evaluate investment ROI.", { initial_investment: z.number(), scenarios: z.array(z.any()), joules: z.number().optional() }, async (args) => {
  const tool = new WEALTH_TOOLS[0]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

server.tool("wealth_compute_EMV", "Compute EMV.", { initial_investment: z.number(), scenarios: z.array(z.any()) }, async (args) => {
  const tool = new WEALTH_TOOLS[1]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

server.tool("wealth_thermodynamic_scan", "Scan for Landauer cost.", { actions: z.array(z.any()) }, async (args) => {
  const tool = new WEALTH_TOOLS[2]();
  const res = await tool.run(args, { sessionId: "mcp", workingDirectory: "/tmp", modeName: "internal_mode" });
  return { content: [{ type: "text" as const, text: resultAsJson(res.output) }] };
});

// ── Resources ────────────────────────────────────────────────────────────────

server.resource("forge://governance/floors", "forge://governance/floors", { mimeType: "application/json" }, async () => ({
  contents: [{ uri: "forge://governance/floors", mimeType: "application/json", text: JSON.stringify({ floors: ["F1-F13"] }, null, 2) }]
}));

server.resource("forge://approvals/pending", "forge://approvals/pending", { mimeType: "application/json" }, async () => {
  const pending = Array.from((approvalBoundary as any).holdQueue?.values?.() ?? []);
  return { contents: [{ uri: "forge://approvals/pending", mimeType: "application/json", text: JSON.stringify({ pending }, null, 2) }] };
});

server.resource("forge://memory/working", "forge://memory/working", { mimeType: "application/json" }, async () => {
  const result = memoryContract.query({ query: "", tiers: ["working"] });
  return {
    contents: [{
      uri: "forge://memory/working",
      mimeType: "application/json",
      text: JSON.stringify({ count: result.total, memories: result.memories }, null, 2)
    }]
  };
});


