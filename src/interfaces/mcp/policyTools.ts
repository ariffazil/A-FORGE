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
// AUDIT FIX 2026-09-28: check mode must PREDICT the runtime, not an alternative
// reality. mode=check previously returned only the policy-layer ALLOW, so an
// unauthenticated simulation of a MUTATE-class call reported ALLOW while the
// real pipeline answers SESSION_REQUIRED/HOLD — a false green light at plan time.
// The composite now mirrors the serve.ts session gate for MUTATE-class tools.
import { classifyTool, requiresGovernance } from "../../domain/governance/actionClassifier.js";
import { sessionExists, verifyActToken } from "../../domain/session/sessionGate.js";

import {
  getMcpPolicyGate,
  EXAMPLE_POLICIES,
} from "../../domain/governance/McpPolicyGate.js";
import type { McpPolicy } from "../../domain/governance/McpPolicyGate.js";
import { validateSession } from "../../domain/session/sessionGate.js";

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
  // S1b (F13 SAH 2026-10-01): the fold was ASYMMETRIC — it lowercased the input
  // while the set stores "F13"/"888" uppercase, so "ARIF" matched and "f13" did
  // not. Authority that depends on capitalisation is itself a defect; fold both
  // sides so the match is total and predictable.
  const folded = actorId.toLowerCase();
  for (const s of SOVEREIGN_ACTORS) {
    if (s.toLowerCase() === folded) return true;
  }
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
        // AUDIT FIX 2026-09-28 — composite runtime projection: the policy layer's
        // ALLOW alone was a false green light for MUTATE-class tools, because the
        // serve.ts session gate answers SESSION_REQUIRED/HOLD at execution for
        // callers without a live session. check now predicts that too.
        // Conservative by design: may HOLD where runtime would exempt via
        // STATELESS_TOOLS — an agent retries with a session, never plans against
        // an unpredicted block.
        const composite: any = { ...verdict };
        if (composite.verdict === "ALLOW") {
          const modeHint = typeof (plannedArgs as any)?.mode === "string" ? (plannedArgs as any).mode : undefined;
          const actionClass = classifyTool(tool_name, modeHint);
          if (requiresGovernance(actionClass)) {
            const sid = typeof (plannedArgs as any)?.session_id === "string" ? (plannedArgs as any).session_id : undefined;
            const hasAct = !!(plannedArgs as any)?.session_token || !!(plannedArgs as any)?.sct || !!(plannedArgs as any)?.act;
            const sessionKnown = sid ? sessionExists(sid) : false;
            if (!sid || !sessionKnown) {
              composite.policy_verdict = "ALLOW";
              composite.verdict = "HOLD";
              composite.reasons = [...(composite.reasons ?? []),
                `RUNTIME_PROJECTION: ${actionClass} tool requires a live kernel session — execution would answer SESSION_REQUIRED`,
              ];
              composite.runtime_projection = {
                runtime_verdict: "HOLD",
                gate: "SESSION_REQUIRED",
                action_class: actionClass,
                session_supplied: !!sid,
                session_known_locally: sessionKnown,
                act_supplied: hasAct,
              };
            }
          }
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(composite, null, 2) }],
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
  "forge_lease",          // lease changes (mode-aware: status/list stay ungated)
  "forge_git",            // push/commit/mutate (mode-aware: status/diff/log stay ungated)
  "forge_ephemeral",      // P0.6 — capability metabolism (generate/invoke/retire)
  // 2026-10-01 ABI fix: was "forge_github_create" — a name that exists on no
  // live surface, so the Set lookup never matched and GitHub writes skipped
  // this gate entirely. The two real write tools are named explicitly;
  // forge_github_get_file stays ungated (OBSERVE).
  "forge_github_create_issue",
  "forge_github_create_or_update_file",
]);

/** UUID v4 generator for elicitation IDs */
function genElicitationId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// NOTE: ELICITATION_BYPASS_READ was removed 2026-10-01. It was declared but
// never read by any code path — a second, hand-maintained read/mode table
// duplicating what isMutateOperation() now takes from the single mode-aware
// source of truth, classifyTool(). A governance table with no consumer is
// entropy, not governance.

/**
 * Check if a tool call is coming from an "external client" that needs elicitation.
 *
 * S1 (F13 SAH 2026-10-01): trust now requires a VERIFIED credential, not an
 * asserted string. This function previously accepted any session_id longer than
 * 8 chars, any lease_id longer than 4 chars, and the caller-supplied booleans
 * ack_irreducible / ack_irreversible / _constitution_gate as proof of trust.
 * A length test verifies nothing, nothing in the codebase ever mints the three
 * booleans, and a fabricated lease_id was demonstrated to suppress the
 * confirmation gate on 2026-10-01. An acknowledgement a caller writes about
 * itself is not a witness.
 */
export function isExternalClient(args: any, extra?: any): { external: boolean; reason?: string } {
  const reasons: string[] = [];

  // ── Verified session (ACT-first) ────────────────────────────────────────
  // validateSession() is the federation's own verifier: kernel-born registry
  // lookup, forged SEAL-* rejection, TTL enforcement, and HMAC-SHA256
  // verification of an act_v1.* token whose sid claim matches. Synchronous and
  // local — no network dependency, so an arifOS outage cannot mass-gate callers.
  const sid = typeof args?.session_id === "string" && args.session_id ? args.session_id : undefined;
  const token =
    (typeof args?.session_token === "string" && args.session_token) ||
    (typeof args?.act === "string" && args.act) ||
    (typeof args?.sct === "string" && args.sct) ||
    undefined;
  if (sid) {
    const v = validateSession(sid, token);
    if (v.valid) return { external: false };
    reasons.push(`session_id failed verification (${v.reason})`);
  } else if (token) {
    reasons.push("ACT supplied without session_id — token cannot be bound to a session");
  }

  // ── lease_id is NOT an independent trust grant ──────────────────────────
  // Its issuer path (arifos.arif_lease_inspect) is one of the dead verbs
  // measured 2026-10-01, so a lease cannot be verified over MCP today. An
  // unverifiable credential must not grant trust; reinstate with real
  // verification once the lease ABI is restored (staged S6).
  if (typeof args?.lease_id === "string" && args.lease_id) {
    reasons.push("lease_id alone no longer grants trust — issuer unverifiable");
  }

  // ── Sovereign actor ─────────────────────────────────────────────────────
  // S1b (F13 SAH 2026-10-01): a sovereign NAME is not sovereign PROOF. Before
  // this, an anonymous caller asserting actor_id:"F13" (or "arif", "sovereign",
  // "ariffazil", …) was trusted with nothing else — the last remaining
  // name-based bypass of the elicitation gate. A sovereign claim must now carry
  // a parseable ACT whose auth claim is not OBSERVE_ONLY.
  // This CORROBORATES the claim; it is not full cryptographic binding. The
  // kernel already does that properly — arif_init binds the ACT to the transport
  // identity and rejects a mismatched actor_id with ERR_ACT_BINDING_INVALID
  // (observed live 2026-10-01). Full parity here needs an HMAC verifier exported
  // from sessionGate; staged as S1c.
  const actorId = args?.actor_id ?? args?.actorId ?? args?.actor ?? extra?.actor_id;
  if (actorId && isSovereign(actorId)) {
    if (token) {
      // S1c (F13 SAH 2026-10-01): HMAC-VERIFIED, not merely parsed. S1b used
      // parseActClaims(), which its own doc says decodes "WITHOUT verifying
      // HMAC" — so a caller could forge the payload of a well-formed-looking
      // token and be trusted. verifyActToken() checks the signature and expiry.
      const v = verifyActToken(token);
      if (!v.valid) {
        reasons.push(
          `sovereign actor_id "${actorId}" presented an ACT that failed verification (${v.reason})`,
        );
      } else if (v.auth === "OBSERVE_ONLY") {
        reasons.push(`sovereign actor_id "${actorId}" presented an OBSERVE_ONLY ACT`);
      } else if (v.actor && v.actor.toLowerCase() !== String(actorId).toLowerCase()) {
        // Bind the claim to the credential, exactly as the kernel does when it
        // raises ERR_ACT_BINDING_INVALID. A sovereign name must be the name the
        // token was actually minted for.
        reasons.push(
          `sovereign actor_id "${actorId}" does not match its ACT-bound actor "${v.actor}"`,
        );
      } else {
        return { external: false };
      }
    } else {
      reasons.push(`sovereign actor_id "${actorId}" asserted with no ACT — a name is not proof`);
    }
  }

  return {
    external: true,
    reason: reasons.length
      ? reasons.join("; ")
      : "No verified session, sovereign actor_id, or bound ACT found",
  };
}

/**
 * Check if a tool+args combination is a MUTATE operation (not read-only).
 * Some tools have both read and write modes (forge_filesystem, forge_postgres).
 */
function isMutateOperation(toolName: string, args: any): boolean {
  const mode = typeof args?.mode === "string" ? args.mode : undefined;

  // ── Arg-level exceptions the mode-aware classifier cannot see ──────────
  // forge_postgres: mode=query classifies OBSERVE, but mutate=true escalates.
  if (toolName === "forge_postgres" && args?.mutate === true) return true;

  // forge_shell: risk lives in the command string, not in a mode.
  if (toolName === "forge_shell" && args?.command) {
    // ALLOW = read-only safe command (echo, cat, ps, free, df, …)
    // GATE or DENY = risky command, needs elicitation
    return classifyCommand(args.command).decision !== "allow";
  }

  // ── Single source of truth ──────────────────────────────────────────────
  // classifyTool() is already mode-aware and already owns this decision:
  //   forge_lease    status/list=OBSERVE   request/revoke=EXECUTE_REVERSIBLE
  //   forge_git      status/diff/log=OBSERVE  commit=EXECUTE_REVERSIBLE
  //   forge_docker   ps/logs/images=OBSERVE   exec=EXECUTE_REVERSIBLE
  //   forge_vault    read/list=OBSERVE        write/seal=EXECUTE_REVERSIBLE
  //   forge_compose  status/analyze=OBSERVE   execute/cancel=EXECUTE_REVERSIBLE
  //   forge_ephemeral inspect_gap/list_*=OBSERVE  generate/invoke/retire=EXEC
  // It also fails CLOSED: an unclassified tool returns IRREVERSIBLE, so an
  // unknown gated tool still demands confirmation.
  //
  // This replaces a second, hand-maintained name allowlist that had to be
  // extended every time a union tool was added to ELICITATION_GATE_TOOLS.
  // That list lagged the live surface, so read-only modes of forge_lease and
  // forge_git were gated on human confirmation while the writes they guard
  // were classified correctly elsewhere. One table, not two.
  return requiresGovernance(classifyTool(toolName, mode));
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
        const sessionId =
          typeof args?.session_id === "string" ? args.session_id : undefined;
        const sessionToken =
          typeof args?.session_token === "string" ? args.session_token
          : typeof args?.sct === "string" ? args.sct
          : typeof args?.act === "string" ? args.act : undefined;

        // Pre-validate session via local HMAC if not already verified.
        // This is the critical fix for HTTP clients (OpenCode, Qwen Code)
        // whose sessions are kernel-born but never registered locally.
        if (sessionId && sessionToken && !gate.hasVerifiedSession(sessionId)) {
          const preValidated = validateSession(sessionId, sessionToken);
          if (preValidated.valid) {
            gate.registerKernelVerifiedSession(sessionId, preValidated.actor_id);
          }
        }

        const verdict = gate.evaluate({
          actor_id: typeof actorId === "string" ? actorId : undefined,
          session_id: sessionId,
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
