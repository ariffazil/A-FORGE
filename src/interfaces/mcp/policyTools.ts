/**
 * policyTools.ts — MCP Policy Gate tools + handler interceptor.
 *
 * Registers 4 tools:
 *   forge_policy_check  (OBSERVE)  — pre-flight policy evaluation
 *   forge_policy_set    (MUTATE)   — add/update policy (sovereign-only)
 *   forge_policy_remove (MUTATE)   — remove policy (sovereign-only)
 *   forge_policy_list   (OBSERVE)  — list loaded policies
 *   forge_policy_save   (MUTATE)   — persist policies to disk (sovereign-only)
 *
 * Also exports installPolicyInterceptor() which wraps EVERY registered tool
 * handler with a Layer 1-5 policy pre-check. This is the architectural
 * enforcement gap that Arif identified as "the missing control plane
 * between AI agents and MCP tools".
 *
 * Constitutional:
 *   F1 AMANAH  — deny-by-default for non-sovereign actors
 *   F8 LAW     — policy is floor, cannot be bypassed by tool logic
 *   F11 AUDIT  — every DENY is logged to /root/A-FORGE/logs/mcp_policy_gate.log
 *   F13 SOVEREIGN — policy mutation is sovereign-only
 *
 * @module mcp/policyTools
 * @forged 2026-06-30 by FORGE (000)
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getMcpPolicyGate,
  EXAMPLE_POLICIES,
} from "../../domain/governance/McpPolicyGate.js";
import type { McpPolicy } from "../../domain/governance/McpPolicyGate.js";

// Sovereign actors permitted to mutate policies
const SOVEREIGN_ACTORS = new Set([
  "arif",
  "sovereign",
  "arif-fazil",
  "ariffazil",
  "F13",
  "888",
]);

function isSovereign(actorId?: string): boolean {
  if (!actorId) return false;
  if (SOVEREIGN_ACTORS.has(actorId)) return true;
  if (SOVEREIGN_ACTORS.has(actorId.toLowerCase())) return true;
  return false;
}

// Idempotent marker — prevents re-wrapping if installPolicyInterceptor() is called twice
const WRAPPED = Symbol.for("aforge.policy.intercepted");

/**
 * Register the 5 forge_policy_* MCP tools.
 */
export function registerPolicyTools(server: McpServer): void {
  const gate = getMcpPolicyGate();

  // forge_policy_check — OBSERVE only, safe for any actor
  server.tool(
    "forge_policy_check",
    "OBSERVE-class. Pre-flight check: would this MCP tool call pass the 5-layer policy gate (identity → server → tool → args → verdict)? " +
    "Use before any high-blast tool call to verify authorization. Returns verdict + reason chain + violated constraints.",
    {
      tool_name: z.string().min(1).describe("Tool to check, e.g. 'postgres_query'"),
      arguments: z.record(z.any()).default({}).describe("Planned tool arguments"),
      actor_id: z.string().optional().describe("Actor id (defaults to current session actor)"),
    },
    async (args) => {
      const verdict = gate.evaluate({
        actor_id: args.actor_id,
        tool_name: args.tool_name,
        arguments: args.arguments ?? {},
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(verdict, null, 2) }],
      };
    },
  );

  // forge_policy_set — sovereign-only MUTATE
  server.tool(
    "forge_policy_set",
    "MUTATE (sovereign-only). Add or update an MCP policy. " +
    "Policy is the architectural gate — changes here alter what agents CANNOT do.",
    {
      policy_id: z.string().min(1).describe("Unique policy id, e.g. 'agent:my-agent'"),
      actor_id: z.string().optional().describe("Sovereign actor performing the change"),
      role: z.string().default("custom").describe("Human-readable role label"),
      description: z.string().optional().describe("What this policy is for"),
      allow_by_default: z.boolean().default(false)
        .describe("true = permit by default. false = deny-by-default (recommended)"),
      allowed_mcp_servers: z.record(z.any()).optional()
        .describe("Map of server name → { allow, tools }"),
      denied_mcp_servers: z.array(z.string()).optional()
        .describe("Server names to hard-deny"),
    },
    async (args) => {
      if (!isSovereign(args.actor_id)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "REJECTED",
              reason: "SOVEREIGN_ONLY: policy mutation requires actor_id ∈ {arif, sovereign, 888, F13}",
              actor_id: args.actor_id ?? "anonymous",
            }, null, 2),
          }],
        };
      }
      const policy: McpPolicy = {
        policy_id: args.policy_id,
        actor_id: args.policy_id.replace(/^agent:/, ""),
        role: args.role,
        description: args.description,
        allow_by_default: args.allow_by_default,
        allowed_mcp_servers: (args.allowed_mcp_servers ?? {}) as any,
        denied_mcp_servers: args.denied_mcp_servers,
      };
      gate.addPolicy(policy);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "INSTALLED",
            policy_id: policy.policy_id,
            note: "Policy active in memory. Run forge_policy_save to persist across restarts.",
          }, null, 2),
        }],
      };
    },
  );

  // forge_policy_remove — sovereign-only MUTATE
  server.tool(
    "forge_policy_remove",
    "MUTATE (sovereign-only). Remove a non-sovereign policy by id.",
    {
      policy_id: z.string().min(1).describe("Policy id to remove"),
      actor_id: z.string().optional().describe("Sovereign actor performing the change"),
    },
    async (args) => {
      if (!isSovereign(args.actor_id)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "REJECTED", reason: "SOVEREIGN_ONLY" }, null, 2),
          }],
        };
      }
      if (args.policy_id === "default:sovereign") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "REJECTED", reason: "Cannot remove sovereign default policy" }, null, 2),
          }],
        };
      }
      gate.removePolicy(args.policy_id);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ status: "REMOVED", policy_id: args.policy_id }, null, 2),
        }],
      };
    },
  );

  // forge_policy_list — OBSERVE only
  server.tool(
    "forge_policy_list",
    "OBSERVE-class. List all loaded MCP policies.",
    {},
    async () => {
      const policies = gate.list().map((p) => ({
        policy_id: p.policy_id,
        actor_id: p.actor_id,
        role: p.role,
        description: p.description,
        allow_by_default: p.allow_by_default,
        server_count: Object.keys(p.allowed_mcp_servers ?? {}).length,
        denied_servers: p.denied_mcp_servers ?? [],
      }));
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            count: policies.length,
            policies,
            example_policies: EXAMPLE_POLICIES.map((p) => p.policy_id),
          }, null, 2),
        }],
      };
    },
  );

  // forge_policy_save — sovereign-only MUTATE (persist to disk)
  server.tool(
    "forge_policy_save",
    "MUTATE (sovereign-only). Persist current policies to /root/A-FORGE/config/mcp_policies.json so they survive restart.",
    {
      actor_id: z.string().optional().describe("Sovereign actor performing the save"),
    },
    async (args) => {
      if (!isSovereign(args.actor_id)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "REJECTED", reason: "SOVEREIGN_ONLY" }, null, 2),
          }],
        };
      }
      try {
        gate.saveToDisk();
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "SAVED",
              path: "/root/A-FORGE/config/mcp_policies.json",
              count: gate.list().length,
            }, null, 2),
          }],
        };
      } catch (e: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "SAVE_FAILED", error: e.message }, null, 2),
          }],
        };
      }
    },
  );
}

/**
 * Install the 5-layer policy pre-check on EVERY registered MCP tool.
 *
 * Idempotent: calling twice will not double-wrap.
 * Should be invoked ONCE during server startup, after all other tool registrations.
 *
 * Interception:
 *   MCP request → policy pre-check → (ALLOW) → original handler → response
 *                                     (DENY) → PolicyGateError (JSON-RPC -32010)
 *
 * The forge_policy_* tools themselves are exempt from interception to prevent
 * a chicken-and-egg loop (you can't call forge_policy_list if the policy
 * check blocks it).
 */
export function installPolicyInterceptor(srv: any): void {
  const gate = getMcpPolicyGate();

  if (!srv) {
    process.stderr.write("[PolicyInterceptor] server not provided — interceptor not installed\n");
    return;
  }

  const registry = (srv as any)._registeredTools as Record<string, any> | undefined;
  if (!registry) {
    process.stderr.write("[PolicyInterceptor] _registeredTools unavailable — interceptor not installed\n");
    return;
  }

  const BYPASS = new Set([
    "forge_policy_check",
    "forge_policy_set",
    "forge_policy_remove",
    "forge_policy_list",
    "forge_policy_save",
  ]);

  let wrapped = 0;
  for (const [toolName, tool] of Object.entries(registry)) {
    if (BYPASS.has(toolName)) continue;
    if (!tool || typeof tool.handler !== "function") continue;
    if ((tool.handler as any)[WRAPPED]) continue;

    const original = tool.handler.bind(tool);
    const wrappedHandler = async (args: any, extra?: any): Promise<any> => {
      try {
        const actorId =
          args?.actor_id ?? args?.actorId ?? args?.actor ?? extra?.actor_id ?? undefined;
        const verdict = gate.evaluate({
          actor_id: typeof actorId === "string" ? actorId : undefined,
          tool_name: toolName,
          arguments: args ?? {},
        });

        if (verdict.verdict === "DENY") {
          process.stderr.write(
            `[PolicyInterceptor] DENY tool=${toolName} actor=${verdict.actor_id} reasons=${verdict.reasons.join(",")}\n`,
          );
          const err: any = new Error(
            `MCP Policy Gate denied this call: ${verdict.reasons.join("; ")}`,
          );
          err.code = -32010;
          err.name = "PolicyGateError";
          err.verdict = verdict;
          throw err;
        }

        return await original(args, extra);
      } catch (e) {
        // Re-throw PolicyGateError as-is (preserves code = -32010)
        if ((e as any)?.name === "PolicyGateError") throw e;
        // Engine failure must be a DENY, not an allow-through crash
        process.stderr.write(
          `[PolicyInterceptor] engine error on ${toolName}: ${(e as Error).message}\n`,
        );
        const err: any = new Error(
          `MCP Policy Gate engine error during pre-check of ${toolName}: ${(e as Error).message}`,
        );
        err.code = -32010;
        err.name = "PolicyGateError";
        throw err;
      }
    };

    Object.defineProperty(wrappedHandler, WRAPPED, { value: true });
    tool.handler = wrappedHandler;
    wrapped++;
  }

  process.stderr.write(
    `[PolicyInterceptor] installed — ${wrapped} tools wrapped with 5-layer policy pre-check\n`,
  );
}
