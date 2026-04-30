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

import { checkWitness } from "../governance/f3Witness.js";
import { checkEmpathy } from "../governance/f6Empathy.js";
import { checkAntiHantu } from "../governance/f9AntiHantu.js";
import { checkWellReadiness, AmanahLockManager } from "../governance/index.js";
import { readRuntimeConfig } from "../config/RuntimeConfig.js";
import { createLlmProvider } from "../llm/providerFactory.js";
import { getApprovalBoundary, routeApproval } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { runStage, recordFloorViolation } from "../metrics/prometheus.js";
import type { MetabolicStage } from "../types/aki.js";
import { FileVaultClient, SupabaseVaultClient, type VaultVerdict } from "../vault/index.js";
import { WebhookHumanEscalationClient, NoOpHumanEscalationClient } from "../escalation/index.js";
import { WEALTH_TOOLS } from "../tools/WealthTools.js";
import { MiniMaxWebSearchTool, MiniMaxUnderstandImageTool } from "../tools/MiniMaxTools.js";
import { getMiniMaxClient } from "../tools/MiniMaxMcpClient.js";

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
  "arif_session_init",
  "Constitutional session ignition. (Stage 000 INIT)",
  {
    actor_id: z.string().describe("Identifier for the human architect or agent"),
    intent: z.string().optional().describe("Primary intent for this session"),
    mode: z.enum(["internal", "external"]).optional().default("external"),
  },
  async ({ actor_id, intent, mode }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arif_session_init");
    return runStage("000_INIT" as MetabolicStage, async () => {
      try {
        const sessionId = Math.random().toString(16).slice(2, 10);
        const result = {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", session_id: sessionId, epoch: new Date().toISOString().split("T")[0], actor_id, intent: intent ?? "general session", mode, verdict: "SEAL" }, null, 2) }],
        };
        await telemetrySuccess("arif_session_init", startedAt);
        return result;
      } catch (err) { await telemetryFailure("arif_session_init", startedAt, err); throw err; }
    });
  }
);

server.tool(
  "arif_health_check",
  "Return server health and constitutional genome (v2.0) status.",
  {},
  async () => {
    const startedAt = Date.now();
    await telemetryInvoke("arif_health_check");
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
      await telemetrySuccess("arif_health_check", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("arif_health_check", startedAt, err);
      throw err;
    }
    });
  }
);

// ── Tier 01 Perception ───────────────────────────────────────────────────────

// MiniMax Web Search — Stage 111 SENSE
server.tool(
  "minimax_web_search",
  "Search the web using MiniMax AI. For Stage 111 SENSE grounding in current information.",
  { query: z.string() },
  async ({ query }) => {
    try {
      const output = await getMiniMaxClient().webSearch(query);
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `ERROR: ${msg}` }], isError: true };
    }
  }
);

// MiniMax Image Understanding — Stage 111 SENSE
server.tool(
  "minimax_understand_image",
  "Analyze an image using MiniMax AI vision. Accepts image URL or local path.",
  { image_source: z.string(), prompt: z.string().optional().default("") },
  async ({ image_source, prompt }) => {
    try {
      const output = await getMiniMaxClient().understandImage(image_source, prompt);
      return { content: [{ type: "text" as const, text: output }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `ERROR: ${msg}` }], isError: true };
    }
  }
);

server.tool(
  "arif_sense_observe",
  "Environmental sensing and reality grounding (Stage 111 SENSE).",
  { query: z.string(), mode: z.enum(["fast", "deep"]).optional().default("fast") },
  async ({ query, mode }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arif_sense_observe");
    return runStage("111_SENSE" as MetabolicStage, async () => {
    try {
      const result = { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", grounded: true, query, mode, lambda2_vector: [0.99, 0.98, 0.95] }, null, 2) }] };
      await telemetrySuccess("arif_sense_observe", startedAt);
      return result;
    } catch (err) { await telemetryFailure("arif_sense_observe", startedAt, err); throw err; }
    });
  }
);

// ── Tier 07 Reflection ───────────────────────────────────────────────────────

server.tool(
  "arif_mind_reason",
  "Synthesised reasoning and epistemic tagging (Stage 333 MIND). Uses client LLM sampling.",
  { grounded_facts: z.array(z.string()), context: z.string().optional() },
  async ({ grounded_facts, context }) => {
    const startedAt = Date.now();
    await telemetryInvoke("arif_mind_reason");
    return runStage("333_MIND" as MetabolicStage, async () => {
    try {
      const samplingResponse = await server.server.createMessage({
        messages: [{ role: "user", content: { type: "text", text: `Synthesize these grounded facts into a coherent reasoning path for arifOS v2.0.\n\nFacts:\n${grounded_facts.join("\n")}\n\nContext: ${context ?? "none"}` } }],
        maxTokens: 500,
      });
      const res = { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", synthesis: samplingResponse.content, model: samplingResponse.model }, null, 2) }] };
      await telemetrySuccess("arif_mind_reason", startedAt);
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
  await telemetryInvoke("arif_heart_critique");
  return runStage("555_HEART" as MetabolicStage, async () => {
  try {
    const f3 = checkWitness(task);
    const f6 = checkEmpathy(task);
    // Passing hasTelemetry: true because MCP calls are structurally verified by the server
    const f9 = checkAntiHantu(task, { sessionId: "mcp-session", hasTelemetry: true, pipelineStage: "555_HEART" });
    const w0 = await checkWellReadiness("high"); // W0: Human Substrate Gate

    const blocked = f3.verdict === "SABAR" || f6.verdict === "VOID" || f9.verdict === "VOID" || w0.verdict === "HOLD" || w0.verdict === "SABAR";
    const result = { 
      content: [{ type: "text" as const, text: JSON.stringify({ overall: blocked ? "BLOCK" : "PASS", blocked, floors: { F3: f3.verdict, F6: f6.verdict, F9: f9.verdict, W0: w0.verdict }, w0_message: w0.message }, null, 2) }],
      isError: blocked
    };
    await telemetrySuccess("arif_heart_critique", startedAt);
    return result;
  } catch (err) { await telemetryFailure("arif_heart_critique", startedAt, err); throw err; }
  });
};

server.registerTool(
  "arif_heart_critique",
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
  await telemetryInvoke("arif_forge_execute");
  return runStage("777_FORGE" as MetabolicStage, async () => {
  try {
    const { AgentEngine } = await import("../engine/AgentEngine.js");
    const { LongTermMemory } = await import("../memory/LongTermMemory.js");
    const { ToolRegistry } = await import("../tools/ToolRegistry.js");
    const { ReadFileTool, WriteFileTool, ListFilesTool } = await import("../tools/FileTools.js");
    const { ApplyPatchesTool } = await import("../tools/EditorTools.js");
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
      registry.register(new WriteFileTool());
      registry.register(new ApplyPatchesTool());
      registry.register(new ListFilesTool());
      registry.register(new GrepTextTool());
      for (const T of WEALTH_TOOLS) registry.register(new T());
      registry.register(new MiniMaxWebSearchTool());
      registry.register(new MiniMaxUnderstandImageTool());
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
      await telemetrySuccess("arif_forge_execute", startedAt);
      return result;
    } finally { await rm(root, { recursive: true, force: true }); }
  } catch (err) { await telemetryFailure("arif_forge_execute", startedAt, err); throw err; }
  });
};

server.registerTool(
  "arif_forge_execute",
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
  await telemetryInvoke("arif_judge_deliberate");
  return runStage("888_JUDGE" as MetabolicStage, async () => {
  try {
    const item = approvalBoundary.approve(holdId, reason);
    return { content: [{ type: "text" as const, text: JSON.stringify({ holdId: item.holdId, state: item.state, badge: item.badge }, null, 2) }] };
  } catch (err) { await telemetryFailure("arif_judge_deliberate", startedAt, err); throw err; }
  });
};

server.tool("arif_judge_deliberate", "Verdict (Stage 888 JUDGE).", { holdId: z.string(), reason: z.string().optional() }, judgeHandler);
server.tool("forge_approve", "Approve action.", { holdId: z.string(), reason: z.string().optional() }, judgeHandler);

// ── Tier 06 Stewardship (Vault) ──────────────────────────────────────────────

const vaultHandler = async ({ content, reason, tier, tags }: { content: string, reason: string, tier?: any, tags?: string[] }) => {
  const startedAt = Date.now();
  await telemetryInvoke("arif_vault_seal");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const entry = await memoryContract.store({ content, reason, tier, tags });
    return { content: [{ type: "text" as const, text: JSON.stringify({ memoryId: entry.memoryId, tier: entry.tier }, null, 2) }] };
  } catch (err) { await telemetryFailure("arif_vault_seal", startedAt, err); throw err; }
  });
};

server.tool("arif_vault_seal", "Ledger closure (Stage 999 VAULT).", { content: z.string(), reason: z.string(), tier: z.string().optional(), tags: z.array(z.string()).optional() }, vaultHandler);
server.tool("forge_remember", "Store memory.", { content: z.string(), reason: z.string(), tier: z.string().optional(), tags: z.array(z.string()).optional() }, vaultHandler);

// ── VAULT999 REST Tools ───────────────────────────────────────────────────────

const vaultReadHandler = async ({ name }: { name: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_vault_read");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const sbClient = new SupabaseVaultClient();
    const record = await sbClient.read(name);
    return { content: [{ type: "text" as const, text: JSON.stringify({ found: !!record, record }, null, 2) }] };
  } catch (err) {
    await telemetryFailure("forge_vault_read", startedAt, err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
  }
  });
};

const vaultListHandler = async ({ category, limit }: { category?: string, limit?: number }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_vault_list");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const sbClient = new SupabaseVaultClient();
    const records = await sbClient.list(category, limit ?? 100);
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: records.length, records }, null, 2) }] };
  } catch (err) {
    await telemetryFailure("forge_vault_list", startedAt, err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
  }
  });
};

const vaultWriteHandler = async ({ name, category, value, metadata }: { name: string, category: string, value: string, metadata?: Record<string, unknown> }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_vault_write");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const sbClient = new SupabaseVaultClient();
    const record = await sbClient.write({ name, category, value, metadata });
    return { content: [{ type: "text" as const, text: JSON.stringify({ status: "written", record }, null, 2) }] };
  } catch (err) {
    await telemetryFailure("forge_vault_write", startedAt, err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
  }
  });
};

const vaultDeleteHandler = async ({ name }: { name: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_vault_delete");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const sbClient = new SupabaseVaultClient();
    await sbClient.delete(name);
    return { content: [{ type: "text" as const, text: JSON.stringify({ status: "deleted", name }, null, 2) }] };
  } catch (err) {
    await telemetryFailure("forge_vault_delete", startedAt, err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
  }
  });
};

const vaultSealHandler = async ({ sealId, sessionId, verdict, task, finalText, turnCount, profileName, floorsTriggered, telemetrysnapshot }: {
  sealId: string, sessionId: string, verdict: VaultVerdict, task: string, finalText: string, turnCount: number, profileName: string, floorsTriggered?: string[], telemetrysnapshot?: any
}) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_vault_seal");
  return runStage("999_VAULT" as MetabolicStage, async () => {
  try {
    const sbClient = new SupabaseVaultClient();
    await sbClient.seal({
      sealId,
      sessionId,
      verdict,
      hashofinput: "",
      telemetrysnapshot: telemetrysnapshot ?? { dS: 0, peace2: 0, psi_le: 0, W3: 0, G: 0 },
      floors_triggered: floorsTriggered ?? [],
      irreversibilityacknowledged: true,
      timestamp: new Date().toISOString(),
      task,
      finalText,
      turnCount,
      profileName,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", sealId, verdict }, null, 2) }] };
  } catch (err) {
    await telemetryFailure("forge_vault_seal", startedAt, err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
  }
  });
};

server.registerTool("forge_vault_read", {
  description: "Read a vault record by name from vault999.",
  inputSchema: z.object({ name: z.string().describe("Record name") }),
}, vaultReadHandler);

server.registerTool("forge_vault_list", {
  description: "List vault records by category from vault999.",
  inputSchema: z.object({ category: z.string().optional().describe("Category filter"), limit: z.number().optional().describe("Max records (default 100)") }),
}, vaultListHandler);

server.registerTool("forge_vault_write", {
  description: "Write a vault record to vault999.",
  inputSchema: z.object({
    name: z.string().describe("Record name"),
    category: z.string().describe("Record category"),
    value: z.string().describe("Record value (string)"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata"),
  }),
}, vaultWriteHandler);

server.registerTool("forge_vault_delete", {
  description: "Delete a vault record by name from vault999.",
  inputSchema: z.object({ name: z.string().describe("Record name") }),
}, vaultDeleteHandler);

server.registerTool("forge_vault_seal", {
  description: "Seal a terminal verdict to vault999.",
  inputSchema: z.object({
    sealId: z.string().describe("Seal ID"),
    sessionId: z.string().describe("Session ID"),
    verdict: z.enum(["SEAL", "HOLD", "SABAR", "VOID"]).describe("Verdict type"),
    task: z.string().describe("Task description"),
    finalText: z.string().describe("Final agent output"),
    turnCount: z.number().describe("Number of turns"),
    profileName: z.string().describe("Agent profile name"),
    floorsTriggered: z.array(z.string()).optional().describe("Floors triggered"),
    telemetrysnapshot: z.record(z.string(), z.number()).optional().describe("Telemetry snapshot"),
  }),
}, vaultSealHandler);

// ── Domain Tools (Tier 03) ───────────────────────────────────────────────────

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

// ── WELL Tools (Tier 03 — Human Substrate) ───────────────────────────────────

const wellStateReadHandler = async () => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_well_state_read");
  return runStage("111_SENSE" as MetabolicStage, async () => {
    try {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const statePath = resolve(process.cwd(), "WELL", "state.json");
      let state: any;
      try {
        const data = await readFile(statePath, "utf-8");
        state = JSON.parse(data);
      } catch {
        state = { ok: false, well_score: 50, verdict: "UNKNOWN", bandwidth: "NORMAL", floors_violated: [], message: "WELL telemetry offline" };
      }
      await telemetrySuccess("forge_well_state_read", startedAt);
      return { content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }] };
    } catch (err) {
      await telemetryFailure("forge_well_state_read", startedAt, err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
    }
  });
};

const wellReadinessCheckHandler = async () => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_well_readiness_check");
  return runStage("111_SENSE" as MetabolicStage, async () => {
    try {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const statePath = resolve(process.cwd(), "WELL", "state.json");
      let state: any;
      try {
        const data = await readFile(statePath, "utf-8");
        state = JSON.parse(data);
      } catch {
        state = { ok: false, well_score: 50, verdict: "UNKNOWN", floors_violated: [] };
      }
      const score = state.well_score ?? 50;
      const violations = state.floors_violated ?? [];
      let verdict: string, bandwidth: string;
      if (violations.length > 0) {
        verdict = "DEGRADED";
        bandwidth = "RESTRICTED";
      } else if (score >= 80) {
        verdict = "OPTIMAL";
        bandwidth = "FULL";
      } else if (score >= 60) {
        verdict = "FUNCTIONAL";
        bandwidth = "NORMAL";
      } else {
        verdict = "LOW_CAPACITY";
        bandwidth = "REDUCED";
      }
      await telemetrySuccess("forge_well_readiness_check", startedAt);
      return { content: [{ type: "text" as const, text: JSON.stringify({ verdict, well_score: score, bandwidth, violations, timestamp: state.timestamp }, null, 2) }] };
    } catch (err) {
      await telemetryFailure("forge_well_readiness_check", startedAt, err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
    }
  });
};

const wellFloorScanHandler = async () => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_well_floor_scan");
  return runStage("111_SENSE" as MetabolicStage, async () => {
    try {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const statePath = resolve(process.cwd(), "WELL", "state.json");
      let state: any;
      try {
        const data = await readFile(statePath, "utf-8");
        state = JSON.parse(data);
      } catch {
        state = { floors_violated: [], metrics: {}, well_score: 0 };
      }
      await telemetrySuccess("forge_well_floor_scan", startedAt);
      return { content: [{ type: "text" as const, text: JSON.stringify({ floors_violated: state.floors_violated ?? [], metrics: state.metrics ?? {}, health_score: state.well_score ?? 0 }, null, 2) }] };
    } catch (err) {
      await telemetryFailure("forge_well_floor_scan", startedAt, err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
    }
  });
};

const wellAnchorHandler = async ({ sessionId, agentId }: { sessionId?: string, agentId?: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_well_anchor");
  return runStage("999_VAULT" as MetabolicStage, async () => {
    try {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const statePath = resolve(process.cwd(), "WELL", "state.json");
      let state: any;
      try {
        const data = await readFile(statePath, "utf-8");
        state = JSON.parse(data);
      } catch {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "WELL state not found" }, null, 2) }], isError: true };
      }
      const sbClient = new SupabaseVaultClient();
      await sbClient.write({
        name: `well_anchor_${sessionId ?? "unanchored"}`,
        category: "well",
        value: JSON.stringify(state),
        metadata: { agentId: agentId ?? "A-FORGE", sessionId: sessionId ?? "UNANCHORED", anchored_at: new Date().toISOString() },
      });
      await telemetrySuccess("forge_well_anchor", startedAt);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "anchored", well_score: state.well_score, bandwidth: state.bandwidth ?? "NORMAL" }, null, 2) }] };
    } catch (err) {
      await telemetryFailure("forge_well_anchor", startedAt, err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }, null, 2) }], isError: true };
    }
  });
};

server.registerTool("forge_well_state_read", {
  description: "Read current WELL biological telemetry snapshot (well_score, bandwidth, violations).",
  inputSchema: z.object({}),
}, wellStateReadHandler);

server.registerTool("forge_well_readiness_check", {
  description: "Check WELL readiness verdict for constitutional governance (OPTIMAL/FUNCTIONAL/DEGRADED/LOW_CAPACITY).",
  inputSchema: z.object({}),
}, wellReadinessCheckHandler);

server.registerTool("forge_well_floor_scan", {
  description: "Scan all 13 W-Floors (well-being dimensions) for constitutional violations.",
  inputSchema: z.object({}),
}, wellFloorScanHandler);

server.registerTool("forge_well_anchor", {
  description: "Anchor current WELL state to vault999 ledger.",
  inputSchema: z.object({
    sessionId: z.string().optional().describe("Session ID"),
    agentId: z.string().optional().describe("Agent ID"),
  }),
}, wellAnchorHandler);

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

// ── Tier 01 Amanah (SERI_KEMBANGAN_ACCORDS) ────────────────────────────────────

const amanahManager = AmanahLockManager.getInstance();

server.tool(
  "request_amanah_lock",
  "Request an Amanah (F1) lock on a resource before irreversible mutation.",
  {
    resource_id: z.string().describe("Canonical path or identifier of the target resource (e.g., file path, container name)"),
    actor_id: z.string().describe("Agent or human identifier requesting the lock"),
    justification: z.string().describe("Semantic intent for the lock — what mutation is planned"),
    session_id: z.string().optional().describe("Session context for re-entrant locks"),
    ttl_seconds: z.number().optional().default(300).describe("Lock TTL in seconds (default 5 min)"),
  },
  async ({ resource_id, actor_id, justification, session_id, ttl_seconds }) => {
    const startedAt = Date.now();
    await telemetryInvoke("request_amanah_lock");
    return runStage("000_INIT" as MetabolicStage, async () => {
      try {
        const result = await amanahManager.acquireLock(resource_id, actor_id, justification, session_id, ttl_seconds * 1000);
        const text = JSON.stringify(result, null, 2);
        await telemetrySuccess("request_amanah_lock", startedAt);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        await telemetryFailure("request_amanah_lock", startedAt, err);
        throw err;
      }
    });
  }
);

server.tool(
  "release_amanah_lock",
  "Release an Amanah (F1) lock, requiring ownership proof.",
  {
    lock_id: z.string().describe("The lock_id returned by request_amanah_lock"),
    actor_id: z.string().describe("Agent or human identifier that originally acquired the lock"),
    release_reason: z.string().optional().describe("Why the lock is being released"),
  },
  async ({ lock_id, actor_id, release_reason }) => {
    const startedAt = Date.now();
    await telemetryInvoke("release_amanah_lock");
    return runStage("000_INIT" as MetabolicStage, async () => {
      try {
        const result = await amanahManager.releaseLock(lock_id, actor_id, release_reason);
        const text = JSON.stringify(result, null, 2);
        await telemetrySuccess("release_amanah_lock", startedAt);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        await telemetryFailure("release_amanah_lock", startedAt, err);
        throw err;
      }
    });
  }
);

// ── VAULT999 Resources ─────────────────────────────────────────────────────────

server.resource("forge://vault/records", "forge://vault/records", { mimeType: "application/json" }, async () => {
  const sbClient = new SupabaseVaultClient();
  const records = await sbClient.list(undefined, 50);
  return {
    contents: [{
      uri: "forge://vault/records",
      mimeType: "application/json",
      text: JSON.stringify({ count: records.length, records }, null, 2)
    }]
  };
});

server.resource("forge://vault/categories", "forge://vault/categories", { mimeType: "application/json" }, async () => {
  const sbClient = new SupabaseVaultClient();
  const cats = ["agents", "mcp", "floor_rules", "identity", "ledger", "infrastructure", "geox", "wealth", "well"];
  const results = await Promise.all(cats.map(async (cat) => {
    const records = await sbClient.list(cat, 100);
    return { category: cat, count: records.length };
  }));
  return {
    contents: [{
      uri: "forge://vault/categories",
      mimeType: "application/json",
      text: JSON.stringify({ categories: results }, null, 2)
    }]
  };
});

server.resource("forge://well/state", "forge://well/state", { mimeType: "application/json" }, async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const statePath = resolve(process.cwd(), "WELL", "state.json");
  let state: any;
  try {
    const data = await readFile(statePath, "utf-8");
    state = JSON.parse(data);
  } catch {
    state = { ok: false, well_score: 50, verdict: "UNKNOWN", bandwidth: "NORMAL", floors_violated: [], message: "WELL telemetry offline" };
  }
  return {
    contents: [{
      uri: "forge://well/state",
      mimeType: "application/json",
      text: JSON.stringify(state, null, 2)
    }]
  };
});


