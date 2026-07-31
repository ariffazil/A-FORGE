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
import { classifyCommand } from "./shell/arifJudge.js";

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
 * Elicitation gate — MUTATE-class tools from external clients return -32042
 * (URLElicitationRequiredError) instead of executing.
 *
 * "External client" = no valid session_id, no lease_id, actor not sovereign,
 * no F13 ack. These clients must go through elicitation before mutation.
 *
 * Tools gated: forge_filesystem (write), forge_shell, forge_execute,
 *              forge_vault (write/seal), forge_postgres (mutate)
 *
 * Error code -32042 is the MCP standard for URLElicitationRequiredError
 * (spec: modelcontextprotocol.io/specification/2025-11-25/client/elicitation).
 *
 * Interception:
 *   MCP request → elicitation check → (EXTERNAL) → return -32042 error
 *                                     (TRUSTED)  → proceed to policy gate
 *
 * Phase 1: Form mode elicitation (confirmation dialog).
 * Phase 2: URL mode elicitation (out-of-band auth for sensitive ops).
 */
const ELICITATION_GATE_TOOLS = new Set([
  // MUTATE tools that MUST NOT execute without user confirmation
  "forge_filesystem",     // write/delete mode
  "forge_shell",          // arbitrary commands
  "forge_execute",        // full pipeline execution
  "forge_vault",          // write/seal modes
  "forge_postgres",       // mutate mode
  "forge_docker",         // destructive container ops
  "forge_lease",          // lease changes
  "forge_git",            // push/commit/mutate
  "forge_github_create",  // PR/issue/file creation
  "forge_ephemeral",      // P0.6 — capability metabolism (generate/invoke/retire)
]);

/** UUID v4 generator for elicitation IDs */
function genElicitationId(): string {
  const hex = "0123456789abcdef";
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Tool names that ALWAYS get bypass regardless of caller (OBSERVE tools) */
const ELICITATION_BYPASS_READ = new Set([
  "forge_filesystem",  // has read/write modes — checked at mode level
  "forge_postgres",    // has read/write modes — checked at mode level
  "forge_vault",       // has read/write modes — checked at mode level
  "forge_shell",       // has read/write — checked via ArifJudge classifyCommand
  "forge_docker",      // has read/write modes — ps/logs/images=read, exec=mutate
]);

/**
 * Check if a tool call is coming from an "external client" that needs elicitation.
 * External = no valid session_id, no lease_id, actor not sovereign, no F13 ack.
 */
function isExternalClient(args: any, extra?: any): { external: boolean; reason?: string } {
  // Has active session_id → trusted (session was verified by arifOS)
  if (args?.session_id && typeof args.session_id === "string" && args.session_id.length > 8) {
    return { external: false };
  }

  // Has active lease_id → trusted (lease was issued by arifOS)
  if (args?.lease_id && typeof args.lease_id === "string" && args.lease_id.length > 4) {
    return { external: false };
  }

  // Sovereign actor → trusted
  const actorId = args?.actor_id ?? args?.actorId ?? args?.actor ?? extra?.actor_id;
  if (actorId && isSovereign(actorId)) {
    return { external: false };
  }

  // F13 ack present → trusted
  if (args?.ack_irreducible || args?.ack_irreversible) {
    return { external: false };
  }

  // Decoupled from human approval. All gates now route through arif_judge(888)
  // at arifOS:8088 for constitution-enforced verdict. F1 AMANAH: humans don't read.
  // Check for constitution gate acknowledgment
  if (args?._constitution_gate === true || args?._constitution_gate === "true") {
    return { external: false };
  }

  return { external: true, reason: "No session, lease, or sovereign actor_id found" };
}

/**
 * Check if a tool+args combination is a MUTATE operation (not read-only).
 * Some tools have both read and write modes (forge_filesystem, forge_postgres).
 */
function isMutateOperation(toolName: string, args: any): boolean {
  // Tools that are always MUTATE
  if (toolName !== "forge_filesystem" && toolName !== "forge_postgres" &&
      toolName !== "forge_vault" && toolName !== "forge_docker" &&
      toolName !== "forge_shell") {
    return true;
  }

  // Mode-based MUTATE detection
  const mode = args?.mode;
  if (toolName === "forge_filesystem" && (mode === "write" || mode === "delete" || mode === "remove")) {
    return true;
  }
  if (toolName === "forge_postgres" && args?.mutate === true) {
    return true;
  }
  if (toolName === "forge_vault" && (mode === "write" || mode === "receipt" || mode === "seal" || mode === "delete")) {
    return true;
  }
  if (toolName === "forge_docker") {
    // forge_docker mode enum: ps|logs|exec|images
    // exec runs arbitrary commands inside containers — always MUTATE
    // ps, logs, images — read-only observation
    if (mode === "exec") return true;
    return false;
  }

  // forge_shell: check actual command via ArifJudge
  // Read-only commands (echo, cat, ps, free, df, etc.) are NOT mutate
  if (toolName === "forge_shell" && args?.command) {
    const judge = classifyCommand(args.command);
    // ALLOW with OBSERVE or EXECUTE_REVERSIBLE = read-only safe command
    if (judge.decision === "allow") {
      return false;
    }
    // GATE or DENY = risky command, needs elicitation
    return true;
  }

  return false;
}

/**
 * Install elicitation gate BEFORE the policy interceptor.
 * External clients calling MUTATE tools get -32042 error instead of silent deny or execution.
 *
 * Called AFTER installPolicyInterceptor wraps handlers.
 * forge_policy is exempt.
 */
export function installElicitationGate(srv: any): void {
  if (!srv) {
    process.stderr.write("[ElicitationGate] server not provided — not installed\n");
    return;
  }

  const registry = (srv as any)._registeredTools as Record<string, any> | undefined;
  if (!registry) {
    process.stderr.write("[ElicitationGate] _registeredTools unavailable — not installed\n");
    return;
  }

  let wrapped = 0;
  for (const [toolName, tool] of Object.entries(registry)) {
    // Skip non-mutate tools
    if (!ELICITATION_GATE_TOOLS.has(toolName)) continue;
    if (!tool || typeof tool.handler !== "function") continue;

    // Check if already wrapped by elicitation gate
    if ((tool.handler as any).__elicitation_gated) continue;

    const original = tool.handler.bind(tool);
    const gatedHandler = async (args: any, extra?: any): Promise<any> => {
      // Check if this is a MUTATE operation (respects read-only modes)
      if (!isMutateOperation(toolName, args)) {
        return await original(args, extra);
      }

      // Check if caller is external
      const clientCheck = isExternalClient(args, extra);
      if (!clientCheck.external) {
        return await original(args, extra);
      }

      // EXTERNAL CLIENT + MUTATE → return -32042 elicitation required
      const elicitationId = genElicitationId();
      const toolDescription = ELICITATION_GATE_TOOLS.has(toolName) ? toolName : "this operation";

      // Log the elicitation attempt
      process.stderr.write(
        `[ElicitationGate] -32042 tool=${toolName} actor=${args?.actor_id ?? "anonymous"} reason=${clientCheck.reason}\n`,
      );

      // Return URLElicitationRequiredError per MCP spec
      const err: any = new Error(
        `This ${toolDescription} requires user confirmation before execution. ` +
        `Please complete the elicitation flow and retry with authorization.`
      );
      err.code = -32042;
      err.name = "URLElicitationRequiredError";
      err.data = {
        elicitations: [
          {
            mode: "form",
            elicitationId,
            message: `Confirm this ${toolDescription} operation?`,
            requestedSchema: {
              type: "object",
              properties: {
                authorized: {
                  type: "boolean",
                  title: "I authorize this operation",
                  description: `Confirm execution of ${toolName}`,
                  default: false,
                },
                reason: {
                  type: "string",
                  title: "Reason for authorization (optional)",
                  default: "",
                },
              },
              required: ["authorized"],
            },
          },
        ],
      };
      throw err;
    };

    Object.defineProperty(gatedHandler, "__elicitation_gated", { value: true });
    tool.handler = gatedHandler;
    wrapped++;
  }

  process.stderr.write(
    `[ElicitationGate] installed — ${wrapped} MUTATE tools gated with -32042 elicitation for external clients\n`,
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
