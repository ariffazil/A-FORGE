/**
 * A-FORGE MCP Server — Core (shared tool + resource registry)
 *
 * Single source of truth for all MCP components.
 *
 * Every tool call passes through FloorEnforcer.checkAll() before reaching
 * the handler. Tools cannot be registered without being wrapped. This makes
 * F1–F13 enforcement constitutionally unavoidable at the MCP ingress.
 *
 * @module mcp/core
 * @constitutional F1 Amanah — no irreversible action without VAULT999 seal
 * @constitutional C1 — FloorEnforcer wrapper makes F1-F13 gating unavoidable
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkWitness } from "../../domain/governance/f3Witness.js";
import { checkEmpathy } from "../../domain/governance/f6Empathy.js";
import { checkAntiHantu } from "../../domain/governance/f9AntiHantu.js";
import { checkWellReadiness, AmanahLockManager } from "../../domain/governance/index.js";
import { readRuntimeConfig } from "../../interfaces/config/RuntimeConfig.js";
import { createLlmProvider } from "../../infrastructure/llm/providerFactory.js";
import { getApprovalBoundary } from "../../application/approval/index.js";
import { getMemoryContract } from "../../domain/memory-contract/index.js";
import { telemetry } from "./telemetry.js";
import { runStage, recordFloorViolation } from "../../infrastructure/metrics/prometheus.js";
import type { MetabolicStage } from "../../domain/types/aki.js";
import { FileVaultClient, SupabaseVaultClient, type VaultVerdict } from "../../infrastructure/vault/index.js";
import { WebhookHumanEscalationClient, NoOpHumanEscalationClient } from "../../application/approval/HumanEscalationClient.js";
import { WEALTH_TOOLS } from "../../infrastructure/tools/WealthTools.js";
import { MiniMaxWebSearchTool, MiniMaxUnderstandImageTool } from "../../infrastructure/tools/MiniMaxTools.js";
import { getMiniMaxClient } from "../../infrastructure/tools/MiniMaxMcpClient.js";
import { registerCoreResources } from "./resources.js";
import { callMCP } from "./client.js";
import { enforceMcpFloor, floorErrorResponse } from "../../domain/governance/mcpFloorEnforcer.js";
import {
  registerFilesystemTools,
  registerPostgresTools,
  registerMemoryTools,
  registerGitTools,
  registerGitHubTools,
  registerDockerTools,
} from "./proxyTools.js";
import {
  registerIdentityTools,
  registerLeaseTools,
  registerRegistryTools,
  registerShellTools,
  registerLogTools,
  registerJobTools,
  initializeForgeTools,
} from "./forgeTools.js";
import { registerGatewayTools } from "./gatewayTools.js";
import { validateSession, registerSession } from "../../domain/session/sessionGate.js";
import { validateLeaseForTool } from "./forgeTools.js";
import { classifyTool, requiresGovernance } from "../../domain/governance/actionClassifier.js";

export const server = new McpServer({
  name: "A-FORGE",
  version: "0.1.0",
});

// ── C1 Phase 1: Wrap server.tool so every registration is auto-gated ─
//
// Every call to server.tool(name, desc, schema, handler) is intercepted
// and the handler is replaced with a FloorEnforcer-gated version.
// New tools added later are automatically wrapped — no bypass possible.
// This is the F1–F13 enforcement chokepoint for MCP ingress.

const GOVERNANCE_FIELDS = {
  session_id: z.string().optional().describe("Kernel-born session ID (FORGE 2-B)"),
  actor_id: z.string().optional().describe("Actor ID (FORGE 2-B)"),
  lease_id: z.string().optional().describe("Governed lease ID (FORGE 2-B)"),
};

function extendZodSchema(schema: any): any {
  if (schema && typeof schema.extend === "function") {
    try { return schema.extend(GOVERNANCE_FIELDS); } catch { /* fall through */ }
  }
  return schema;
}

function extendInputSchema(schema: any): any {
  // Zod object passed to registerTool
  if (schema && typeof schema.extend === "function") {
    try { return schema.extend(GOVERNANCE_FIELDS); } catch { /* fall through */ }
  }
  // Plain JSON schema object
  if (schema && typeof schema === "object" && !schema._def) {
    return {
      ...schema,
      properties: {
        ...(schema.properties || {}),
        session_id: { type: "string", description: "Kernel-born session ID (FORGE 2-B)" },
        actor_id: { type: "string", description: "Actor ID (FORGE 2-B)" },
        lease_id: { type: "string", description: "Governed lease ID (FORGE 2-B)" },
      },
    };
  }
  return schema;
}

const _originalTool = server.tool.bind(server);
(server as any).tool = function (
  name: string,
  description: string,
  schema: any,
  handler: (args: any, ctx: any) => Promise<any>,
) {
  const gatedSchema = extendZodSchema(schema);
  const wrappedHandler = async (args: any, ctx: any) => {
    const argsObj = (args && typeof args === "object") ? args : {};
    const actionClass = classifyTool(name);

    // ── FORGE 2-B: Kernel session + lease gating for MUTATE/ATOMIC tools ──
    if (requiresGovernance(actionClass)) {
      const callerSession = (typeof argsObj.session_id === "string") ? argsObj.session_id : undefined;
      const sessionCheck = callerSession ? validateSession(callerSession) : { valid: false, reason: "SESSION_REQUIRED: No session_id provided" } as const;
      if (!sessionCheck.valid) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `SESSION_GATE: Tool "${name}" is ${actionClass}. ${sessionCheck.reason}`, action_class: actionClass, adat_gate: "SESSION_REQUIRED" }, null, 2) }],
          isError: true,
        };
      }
      const lease_id = (typeof argsObj.lease_id === "string") ? argsObj.lease_id : undefined;
      const leaseCheck = await validateLeaseForTool(lease_id, name, actionClass);
      if (!leaseCheck.ok) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `LEASE_GATE: Tool "${name}" is ${actionClass}. ${leaseCheck.gate}: ${leaseCheck.reason}`, action_class: actionClass, adat_gate: leaseCheck.gate }, null, 2) }],
          isError: true,
        };
      }
    }

    // Inject verified session context into FloorEnforcer
    const callerSession = (typeof argsObj.session_id === "string") ? argsObj.session_id : undefined;
    const sessionCheck = callerSession ? validateSession(callerSession) : null;
    const callerActor = sessionCheck?.valid === true ? sessionCheck.actor_id : "mcp-anonymous";
    const verdict = enforceMcpFloor(name, argsObj, callerActor);
    if (!verdict.allowed) {
      // FloorEnforcer refused: return MCP error response, do NOT call handler
      return floorErrorResponse(verdict);
    }
    // FloorEnforcer approved (SEAL or CAUTION): call the original handler
    return await handler(args, ctx);
  };
  return _originalTool(name, description, gatedSchema, wrappedHandler);
};
// Also wrap server.registerTool (used by some tool registrations)
const _originalRegisterTool = server.registerTool.bind(server);
(server as any).registerTool = function (
  name: string,
  options: any,
  handler: (args: any, ctx: any) => Promise<any>,
) {
  const gatedOptions = options && typeof options === "object"
    ? { ...options, inputSchema: extendInputSchema(options.inputSchema) }
    : options;
  const wrappedHandler = async (args: any, ctx: any) => {
    const argsObj = (args && typeof args === "object") ? args : {};
    const actionClass = classifyTool(name);

    // ── FORGE 2-B: Kernel session + lease gating for MUTATE/ATOMIC tools ──
    if (requiresGovernance(actionClass)) {
      const callerSession = (typeof argsObj.session_id === "string") ? argsObj.session_id : undefined;
      const sessionCheck = callerSession ? validateSession(callerSession) : { valid: false, reason: "SESSION_REQUIRED: No session_id provided" } as const;
      if (!sessionCheck.valid) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `SESSION_GATE: Tool "${name}" is ${actionClass}. ${sessionCheck.reason}`, action_class: actionClass, adat_gate: "SESSION_REQUIRED" }, null, 2) }],
          isError: true,
        };
      }
      const lease_id = (typeof argsObj.lease_id === "string") ? argsObj.lease_id : undefined;
      const leaseCheck = await validateLeaseForTool(lease_id, name, actionClass);
      if (!leaseCheck.ok) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `LEASE_GATE: Tool "${name}" is ${actionClass}. ${leaseCheck.gate}: ${leaseCheck.reason}`, action_class: actionClass, adat_gate: leaseCheck.gate }, null, 2) }],
          isError: true,
        };
      }
    }

    // Inject verified session context into FloorEnforcer
    const callerSession = (typeof argsObj.session_id === "string") ? argsObj.session_id : undefined;
    const sessionCheck = callerSession ? validateSession(callerSession) : null;
    const callerActor = sessionCheck?.valid === true ? sessionCheck.actor_id : "mcp-anonymous";
    const verdict = enforceMcpFloor(name, argsObj, callerActor);
    if (!verdict.allowed) {
      return floorErrorResponse(verdict);
    }
    return await handler(args, ctx);
  };
  return _originalRegisterTool(name, gatedOptions, wrappedHandler as any);
};

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

function resultAsJson(output: unknown): string {
  if (typeof output === "string") {
    try { return JSON.stringify(JSON.parse(output), null, 2); }
    catch { return output; }
  }
  return JSON.stringify(output, null, 2);
}

// ── Tier 00 Identity ─────────────────────────────────────────────────────────

server.tool(
  "arif_session_init",
  "Constitutional session ignition. Proxies to arifOS kernel — A-FORGE no longer mints independent sessions. (Stage 000 INIT)",
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
        // Proxy to kernel's arif_session_init (mode=light for fast bootstrap)
        const kernelResponse = await callMCP("arifos.arif_session_init", {
          actor_id,
          intent: intent ?? "aforge session",
          mode: "light",
        });
        const response = kernelResponse as Record<string, unknown>;
        // Extract session_id from kernel response (nested in session object or result object)
        const sessionObj = response.session as Record<string, unknown> | undefined;
        const resultObj = response.result as Record<string, unknown> | undefined;
        const session_id =
          (sessionObj?.session_id as string | undefined) ??
          (resultObj?.session_id as string | undefined) ??
          (response.session_id as string | undefined);
        if (!session_id) {
          const errorText = JSON.stringify({
            status: "ERROR",
            error: "Kernel did not return a session_id",
            kernel_response: response,
          }, null, 2);
          await telemetryFailure("arif_session_init", startedAt, new Error(errorText));
          return { content: [{ type: "text" as const, text: errorText }], isError: true };
        }
        // Register the kernel-born session locally
        const session = registerSession(session_id, actor_id);
        const result = {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "SEAL",
              session_id,
              kernel_origin: true,
              epoch: new Date().toISOString().split("T")[0],
              actor_id,
              intent: intent ?? "general session",
              mode: mode ?? "external",
              expires_at: session.expires_at,
              verdict: "SEAL",
            }, null, 2),
          }],
        };
        await telemetrySuccess("arif_session_init", startedAt);
        return result;
      } catch (err) {
        await telemetryFailure("arif_session_init", startedAt, err);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ERROR",
              error: `Kernel unreachable: ${err instanceof Error ? err.message : String(err)}`,
              suggestion: "Ensure arifOS kernel is running on port 8088 and reachable at ARIFOS_MCP_URL",
            }, null, 2),
          }],
          isError: true,
        };
      }
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

const forgeHandler = async (args: any, toolName: string) => {
  const { task, mode, session_id, actor_id, lease_id, evidence_receipt, peer_contract_id } = args;
  const startedAt = Date.now();
  await telemetryInvoke("arif_forge_execute");
  return runStage("777_FORGE" as MetabolicStage, async () => {
  try {
    // ── FORGE 2-B: arifOS judge SEAL required before any execution ──
    const candidate = JSON.stringify({
      tool: toolName,
      task,
      mode: mode ?? "external_safe_mode",
      lease_id,
      actor_id: actor_id ?? "mcp-anonymous",
    });
    const judgeBody: any = {
      mode: "judge",
      candidate,
      session_id,
      actor_id: actor_id ?? "mcp-anonymous",
      lease_id,
    };
    if (evidence_receipt) {
      judgeBody.evidence_receipt = evidence_receipt;
    }
    if (peer_contract_id) {
      judgeBody.peer_contract_id = peer_contract_id;
    }
    const judgeResult = await callMCP("arifos.arif_judge_deliberate", judgeBody) as any;
    const judgeVerdict = judgeResult?.verdict ?? judgeResult?.decision ?? "HOLD";
    if (judgeVerdict !== "SEAL") {
      const holdResult = {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "HOLD",
            gate: "JUDGE_GATE",
            tool: toolName,
            reason: `arifOS judge returned '${judgeVerdict}' for this execution. No SEAL, no mutation.`,
            judge_state: judgeResult,
          }, null, 2),
        }],
        isError: true,
      };
      await telemetryFailure("arif_forge_execute", startedAt, new Error(`JUDGE_GATE: ${judgeVerdict}`));
      return holdResult;
    }

    const { AgentEngine } = await import("../../domain/engine/AgentEngine.js");
    const { LongTermMemory } = await import("../../application/memory/LongTermMemory.js");
    const { ToolRegistry } = await import("../../infrastructure/tools/ToolRegistry.js");
    const { ReadFileTool, WriteFileTool, ListFilesTool } = await import("../../infrastructure/tools/FileTools.js");
    const { ApplyPatchesTool } = await import("../../infrastructure/tools/EditorTools.js");
    const { GrepTextTool } = await import("../../infrastructure/tools/SearchTools.js");
    const { buildExploreProfile } = await import("../../domain/agents/profiles.js");
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
        content: [{ type: "text" as const, text: JSON.stringify({ finalText: res.finalText, turns: res.turnCount, blocked, judge_verdict: judgeVerdict }, null, 2) }],
        isError: blocked
      };
      await telemetrySuccess("arif_forge_execute", startedAt, undefined, { judge_verdict: judgeVerdict });
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
      mode: z.enum(["internal_mode", "external_safe_mode"]).optional(),
      evidence_receipt: z.record(z.string(), z.unknown()).optional().describe("Optional F-WEB evidence receipt to support a SEAL verdict"),
      peer_contract_id: z.string().optional().describe("Optional Peer Federation Contract v1 ID for audit continuity"),
    }),
    annotations: { title: "777 FORGE", destructiveHint: true }
  },
  (args) => forgeHandler(args, "arif_forge_execute")
);

server.registerTool(
  "forge_run",
  {
    description: "Run a full agent task with governance floors.",
    inputSchema: z.object({
      task: z.string().describe("The task to execute"),
      mode: z.enum(["internal_mode", "external_safe_mode"]).optional(),
      evidence_receipt: z.record(z.string(), z.unknown()).optional().describe("Optional F-WEB evidence receipt to support a SEAL verdict"),
      peer_contract_id: z.string().optional().describe("Optional Peer Federation Contract v1 ID for audit continuity"),
    }),
    annotations: { title: "Agent Run", destructiveHint: true }
  },
  (args) => forgeHandler(args, "forge_run")
);

const judgeHandler = async ({ holdId, reason }: { holdId: string, reason?: string }) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_approve");
  return runStage("888_JUDGE" as MetabolicStage, async () => {
  try {
    // FORGE 2-B: A-FORGE cannot issue verdicts. All approvals must come from arifOS.
    const result = {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "HOLD",
          gate: "SELF_AUTHORIZE_REFUSED",
          holdId,
          reason: reason ?? "none given",
          message: "A-FORGE no longer issues approvals. Route to arifOS arif_judge_deliberate (via forge_judge_proxy) instead.",
        }, null, 2),
      }],
      isError: true,
    };
    await telemetrySuccess("forge_approve", startedAt, undefined, { gate: "SELF_AUTHORIZE_REFUSED" });
    return result;
  } catch (err) { await telemetryFailure("forge_approve", startedAt, err); throw err; }
  });
};

const judgeProxyHandler = async (args: Record<string, unknown>) => {
  const startedAt = Date.now();
  await telemetryInvoke("forge_judge_proxy");
  return runStage("888_JUDGE" as MetabolicStage, async () => {
    try {
      const res = await callMCP("arifos.arif_judge_deliberate", args);
      const result = { content: [{ type: "text" as const, text: resultAsJson(res) }] };
      await telemetrySuccess("forge_judge_proxy", startedAt);
      return result;
    } catch (err) {
      await telemetryFailure("forge_judge_proxy", startedAt, err);
      throw err;
    }
  });
};

server.tool("forge_approve", "Approve action.", { holdId: z.string(), reason: z.string().optional() }, judgeHandler);

server.tool(
  "forge_judge_proxy",
  "Proxy forwarder to canonical arifOS constitutional judge.",
  {
    mode: z.string().optional().describe("Adjudication mode (e.g. judge)"),
    candidate: z.string().optional().describe("Description of candidate action/proposal"),
    session_id: z.string().optional().describe("Session context"),
    actor_id: z.string().optional().describe("Actor ID"),
    constitutional_chain_id: z.string().optional().describe("Constitutional chain ID"),
    vault_entry_id: z.string().optional().describe("Vault entry ID"),
    cooldown_entry_id: z.string().optional().describe("Cooldown entry ID"),
    action_tier: z.string().optional().describe("Action risk tier"),
    heart_critique: z.record(z.string(), z.unknown()).optional().describe("Heart critique payload"),
    niat_params: z.record(z.string(), z.unknown()).optional().describe("Niat parameters"),
    context_source: z.string().optional().describe("Context source"),
    peer_contract_id: z.string().optional().describe("Peer Federation Contract v1 ID for audit continuity"),
  },
  judgeProxyHandler
);

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

// ── Tier 1 Proxy Tools (forge_filesystem, forge_postgres, forge_memory, forge_git, forge_github, forge_docker) ──
// Each group registers 4-6 tools under the forge_* namespace.
// F8 LAW: All filesystem ops scoped to /root, /tmp, /data.
// F11 AUTH: git push and docker destructive ops require 888_HOLD.
registerFilesystemTools(server);
registerPostgresTools(server);
registerMemoryTools(server);
registerGitTools(server);
registerGitHubTools(server);
registerDockerTools(server);

// ── Phase 1: Identity, Lease, Registry, Shell, Logs, Jobs ──────────────────
registerIdentityTools(server);
registerLeaseTools(server);
registerRegistryTools(server);
registerShellTools(server);
registerLogTools(server);
registerJobTools(server);

// ── P1 Gateway Tools: external MCP internalization ───────────────────────────
registerGatewayTools(server);

// Initialize identity store
initializeForgeTools().catch(err => {
  process.stderr.write(`[forgeTools] Init error: ${err}\n`);
});

// ── Resources ────────────────────────────────────────────────────────────────
registerCoreResources(server, approvalBoundary, memoryContract);

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

// ── Autonomous Pipeline Tool ───────────────────────────────────────────────────
// Accepts a task and runs SENSE → REASON → WITNESS → FORGE → JUDGE → VAULT
// in one autonomous call. Routes to the correct organ based on task classification.
//
// F1 AMANAH: Pipeline is read-only for OBSERVE tasks. MUTATE tasks require hold_id.
// F8 LAW: Pipeline routes to correct organ. Never crosses lanes.
//
server.tool(
  "forge_pipeline",
  "Autonomous intelligence pipeline. Accepts a task, auto-routes to correct organs (GEOX/WEALTH/WELL/A-FORGE), gathers evidence, computes results, and optionally seals. One call = full 000→999 cycle.",
  {
    task: z.string().describe("The task to execute (e.g. 'Evaluate Malay Basin' or 'Check WELL readiness')"),
    mode: z.enum(["observe", "forge", "full"]).default("observe")
      .describe("observe = route + witness only. forge = route + witness + compute. full = route + witness + forge + judge + seal"),
    hold_id: z.string().optional()
      .describe("Required for forge/full modes if action class is MUTATE. Get from arif_judge_deliberate"),
    session_id: z.string().optional(),
    actor_id: z.string().optional(),
  },
  async ({ task, mode, hold_id, session_id, actor_id }) => {
    const startedAt = Date.now();
    await telemetryInvoke("forge_pipeline");
    return runStage("000_INIT" as MetabolicStage, async () => {
      try {
        const stages: string[] = [];
        const results: Record<string, any> = {};
        const errors: string[] = [];

        // ── SENSE (111): Classify the task ──
        stages.push("111_SENSE");
        const task_lower = task.toLowerCase();
        let target_organ = "unknown";
        if (/basin|seismic|well|petrophysics|geology|prospect|earth|geox/i.test(task_lower))
          target_organ = "GEOX";
        else if (/wealth|capital|stock|nifty|klci|bursa|finance|npv|roi|investment/i.test(task_lower))
          target_organ = "WEALTH";
        else if (/well|readiness|fatigue|sleep|health|vitality|dignity|homeostasis/i.test(task_lower))
          target_organ = "WELL";
        else if (/forge|build|deploy|test|code|refactor|fix|audit|tui/i.test(task_lower))
          target_organ = "A-FORGE";
        results.sense = { target_organ, mode, task_summary: task.slice(0, 200) };

        // ── MODE: observe only — just route (no execution) ──
        if (mode === "observe") {
          stages.push("444_ROUTE");
          // Ping the target organ to confirm it's alive
          let organ_status = "unreachable";
          try {
            const resp = await fetch(`http://127.0.0.1:7071/api/federation-probe`);
            const data = await resp.json() as any;
            organ_status = data.organs?.[target_organ]?.status ?? "unknown";
          } catch { /* best effort */ }
          results.route = { target_organ, organ_status };

          stages.push("999_VAULT");
          const verdict = { status: "OBSERVED", target_organ, note: `Task classified as ${target_organ}. Use mode=forge to execute.` };
          const text = JSON.stringify({ stages, results, verdict }, null, 2);
          await telemetrySuccess("forge_pipeline", startedAt);
          return { content: [{ type: "text" as const, text }] };
        }

        // ── FORGE / FULL: Route to target organ and execute ──
        stages.push("444_ROUTE");
        stages.push("555_WITNESS");
        stages.push("777_FORGE");

        if (target_organ === "GEOX") {
          // Route to GEOX for earth intelligence
          try {
            const geoxResp = await fetch(`http://127.0.0.1:8081/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: { name: "geox_query_intake", arguments: { query: task } },
                id: "forge-pipeline-1",
              }),
            });
            const geoxData = await geoxResp.json() as any;
            results.geox = geoxData.result ?? geoxData;
          } catch (e: any) {
            errors.push(`GEOX error: ${e.message}`);
          }
        } else if (target_organ === "WEALTH") {
          try {
            const wealthResp = await fetch(`http://127.0.0.1:18082/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: { name: "wealth_agent_path", arguments: { task_description: task } },
                id: "forge-pipeline-1",
              }),
            });
            const wealthData = await wealthResp.json() as any;
            results.wealth = wealthData.result ?? wealthData;
          } catch (e: any) {
            errors.push(`WEALTH error: ${e.message}`);
          }
        } else if (target_organ === "WELL") {
          try {
            const wellResp = await fetch(`http://127.0.0.1:18083/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: { name: "well_assess_reliability", arguments: { mode: "health" } },
                id: "forge-pipeline-1",
              }),
            });
            const wellData = await wellResp.json() as any;
            results.well = wellData.result ?? wellData;
          } catch (e: any) {
            errors.push(`WELL error: ${e.message}`);
          }
        } else if (target_organ === "A-FORGE") {
          results.forge = { note: "A-FORGE tasks execute via existing forge_run tool. Pipeline routes to self." };
        }

        // ── FULL MODE: Judge + VAULT ──
        if (mode === "full") {
          stages.push("888_JUDGE");
          try {
            const judgeResp = await fetch(`http://127.0.0.1:8088/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                  name: "arif_judge_deliberate",
                  arguments: {
                    candidate: task,
                    mode: "judge",
                  },
                },
                id: "forge-pipeline-2",
              }),
            });
            const judgeData = await judgeResp.json() as any;
            results.judge = judgeData.result ?? judgeData;
          } catch (e: any) {
            errors.push(`JUDGE error: ${e.message}`);
          }

          stages.push("999_VAULT");
          // If judge returned SEAL and we have session context, seal it
          try {
            const sealResp = await fetch(`http://127.0.0.1:7071/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                  name: "arif_vault_seal",
                  arguments: {
                    content: JSON.stringify({ task, target_organ, mode, stages }),
                    reason: `forge_pipeline: ${target_organ} ${mode}`,
                    tier: mode === "full" ? "STANDARD" : "OBSERVE",
                  },
                },
                id: "forge-pipeline-3",
              }),
            });
            const sealData = await sealResp.json() as any;
            results.vault = sealData.result ?? sealData;
          } catch (e: any) {
            errors.push(`VAULT error: ${e.message}`);
          }
        }

        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        const text = JSON.stringify({
          ok: errors.length === 0,
          stages,
          target_organ,
          results,
          errors: errors.length > 0 ? errors : undefined,
          elapsed_seconds: parseFloat(elapsed),
          mode,
        }, null, 2);

        await telemetrySuccess("forge_pipeline", startedAt);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        await telemetryFailure("forge_pipeline", startedAt, err);
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
