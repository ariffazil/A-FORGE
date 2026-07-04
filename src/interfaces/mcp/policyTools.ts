/**
 * policyTools.ts — MCP Policy Gate tools + handler interceptor.
 *
 * Registers 1 merged tool:
 *   forge_policy (mode: check|set|remove|list|save) — MCP policy engine
 *
 * Legacy separate tools (forge_policy_check/set/remove/list/save) were
 * collapsed into forge_policy with mode parameter 2026-07-03. The 5 old
 * names are REMOVED — they were phantom entries in affordances.yaml only.
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
 * @refactored 2026-07-03 by FORGE (000) — Q³ collapse: 5 phantom → 1 merged
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

  // forge_policy — merged check, set, remove, list, save
  server.tool(
    "forge_policy",
    "Governed MCP Policy Engine. Modes: check (simulate call), set (add/update policy, sovereign-only), remove (delete policy, sovereign-only), list (show loaded policies), save (persist policies to disk, sovereign-only). F1 AMANAH + F8 LAW + F11 AUDIT + F13 SOVEREIGN.",
    {
      mode: z.enum(["check", "set", "remove", "list", "save"]).default("list").describe("Policy operation mode"),
      actor_id: z.string().optional().describe("Actor performing the operation"),
      // For check mode
      tool_name: z.string().optional().describe("Tool to check, e.g. 'postgres_query'"),
      arguments: z.record(z.any()).optional().describe("Planned tool arguments"),
      // For set / remove modes
      policy_id: z.string().optional().describe("Policy ID to set or remove"),
      // For set mode
      role: z.string().optional().describe("Role label"),
      description: z.string().optional().describe("Policy description"),
      allow_by_default: z.boolean().optional().describe("Allow by default flag"),
      allowed_mcp_servers: z.record(z.any()).optional().describe("Allowed servers map"),
      denied_mcp_servers: z.array(z.string()).optional().describe("Denied servers array"),
    },
    async ({ mode, actor_id, tool_name, arguments: plannedArgs, policy_id, role, description, allow_by_default, allowed_mcp_servers, denied_mcp_servers }) => {
      if (mode === "check") {
        if (!tool_name) {
          return { content: [{ type: "text" as const, text: "tool_name is required for mode=check" }], isError: true };
        }
        const verdict = gate.evaluate({
          actor_id,
          tool_name,
          arguments: plannedArgs ?? {},
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(verdict, null, 2) }],
        };
      }

      if (mode === "list") {
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
      }

      // set, remove, save require sovereign actor
      if (!isSovereign(actor_id)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "REJECTED",
              reason: "SOVEREIGN_ONLY: policy mutation requires actor_id ∈ {arif, sovereign, 888, F13}",
              actor_id: actor_id ?? "anonymous",
            }, null, 2),
          }],
        };
      }

      if (mode === "set") {
        if (!policy_id) {
          return { content: [{ type: "text" as const, text: "policy_id is required for mode=set" }], isError: true };
        }
        const policy: McpPolicy = {
          policy_id,
          actor_id: policy_id.replace(/^agent:/, ""),
          role: role ?? "custom",
          description,
          allow_by_default: allow_by_default ?? false,
          allowed_mcp_servers: (allowed_mcp_servers ?? {}) as any,
          denied_mcp_servers,
        };
        gate.addPolicy(policy);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "INSTALLED",
              policy_id: policy.policy_id,
              note: "Policy active in memory. Run forge_policy mode=save to persist across restarts.",
            }, null, 2),
          }],
        };
      }

      if (mode === "remove") {
        if (!policy_id) {
          return { content: [{ type: "text" as const, text: "policy_id is required for mode=remove" }], isError: true };
        }
        if (policy_id === "default:sovereign") {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ status: "REJECTED", reason: "Cannot remove sovereign default policy" }, null, 2),
            }],
          };
        }
        gate.removePolicy(policy_id);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "REMOVED", policy_id }, null, 2),
          }],
        };
      }

      if (mode === "save") {
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
      }

      return { content: [{ type: "text" as const, text: `Unknown mode: ${mode}` }], isError: true };
    }
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
 * forge_policy itself is exempt from interception to prevent
 * a chicken-and-egg loop (you can't call forge_policy if the policy
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
    "forge_policy",
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
          args?.actor_id ?? args?.actorId ?? args?.actor ?? extra?.actor_id;
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
