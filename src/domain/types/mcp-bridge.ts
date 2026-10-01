/**
 * MCP Bridge Types — Federation Memory Bridge
 *
 * Defines the protocol translation layer between A-FORGE TypeScript runtime
 * and arifOS / WEALTH / GEOX Python MCP kernels.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export type MCPNamespace = "arifos" | "wealth" | "geox" | "well";

export interface MCPBridgeConfig {
  arifos: string;
  wealth: string;
  geox: string;
  well?: string;
}

export interface MCPBridgeResponse {
  ok: boolean;
  result?: unknown;
  error?: {
    type: string;
    message: string;
    floor?: string;
    verdict?: string;
  };
}

/**
 * Tool name mapping: A-FORGE internal → canonical arifOS tool name.
 *
 * The live arifOS MCP surface was measured 2026-10-01 (tools/list on :8088) as
 * exactly eight canonical verbs:
 *   arif_init, arif_observe, arif_think, arif_route,
 *   arif_memory, arif_judge, arif_forge, arif_seal
 *
 * Only add an entry when BOTH the target is on that live surface AND the
 * argument shape is known to match (transformArgs below owns shape). A mapping
 * to a dead name is worse than no mapping: it looks repaired and still fails.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  apex_judge: "arif_judge",
  // Was "arif_claim_gate" — itself NOT on the live surface, so the one place
  // someone tried to fix drift pointed at the previous ABI generation.
  // Claim-class adjudication is a judge function.
  truth_gate: "arif_judge",
  arif_claim_gate: "arif_judge",
  // 666 HEART pipeline lives inside the canonical judge stage. Verified
  // shape-compatible: heartHandler (core.ts) consumes only `.verdict`, and
  // transformArgs below builds the {mode,candidate} envelope arif_judge takes.
  arif_heart_critique: "arif_judge",

  // ── Canonical arifOS 8-verb mappings (repaired 2026-10-01) ─────────────
  // 1. Session bootstrap: arif_session_init is the legacy alias for arif_init (stage 000)
  arif_session_init: "arif_init",

  // 2. Vault anchoring: arif_vault_seal maps to arif_seal (stage 999, mode="receipt")
  arif_vault_seal: "arif_seal",

  // 3. Cryptographic shell verification: arif_verify maps to arif_seal (stage 999, mode="verify")
  arif_verify: "arif_seal",

  // 4. Lease inspection: arif_lease_inspect maps to arif_judge (stage 666, mode="validate")
  arif_lease_inspect: "arif_judge",

  // 5. Lease issuance: arif_lease_issue maps to arif_judge (stage 666, mode="judge")
  arif_lease_issue: "arif_judge",

  // 6. Lease revocation: arif_lease_revoke maps to arif_judge (stage 666, mode="hold")
  arif_lease_revoke: "arif_judge",
};

/** Namespace routing map: which env var / default URL per namespace */
export const NAMESPACE_DEFAULTS: Record<MCPNamespace, { env: string; default: string }> = {
  arifos: { env: "ARIFOS_MCP_URL", default: "http://localhost:8088" },
  wealth: { env: "WEALTH_MCP_URL", default: "http://localhost:18082" },
  geox: { env: "GEOX_MCP_URL", default: "http://localhost:8081" },
  // S6 (2026-10-01): WELL was called as "well_mcp.well_assess_homeostasis"
  // (core.ts) and via callOrganAdapter's well_mcp branch (forgeTools.ts:2201),
  // but no namespace entry existed — parseToolName() threw "Unknown namespace"
  // before any request was sent, so the call could never succeed. WELL is live
  // on :18083 and exposes well_assess_homeostasis (verified: 40 tools).
  well: { env: "WELL_MCP_URL", default: "http://localhost:18083" },
};

/**
 * Special-case argument transformers for tools where A-FORGE's calling
 * convention differs from the kernel's expected parameters.
 */
export function transformArgs(tool: string, args: Record<string, unknown>): Record<string, unknown> {
  if (tool === "apex_judge" || tool === "arif_judge") {
    const { concern, findings, riskLevel, task, ...rest } = args;
    // arif_judge declares no `task` parameter. Its strict pydantic schema
    // rejects the ENTIRE call on one undeclared kwarg — measured 2026-10-01:
    // task='…' returned unexpected_keyword_argument, so the 666 HEART
    // delegation died at argument validation before any adjudication.
    // Fold the legacy key into `candidate`, which IS declared, and leave every
    // other key (including the sovereign-signature fields the bridge injects)
    // exactly as it was.
    return {
      ...rest,
      mode: (rest.mode as string) ?? "judge",
      candidate:
        typeof task === "string" && task.length > 0
          ? task
          : typeof concern === "string"
            ? JSON.stringify({ concern, findings, riskLevel })
            : JSON.stringify(args),
    };
  }

  if (tool === "arif_session_init") {
    return {
      ...args,
      mode: (args.mode as string) ?? "light",
      intent: (args.intent as string) ?? "aforge session",
    };
  }

  if (tool === "arif_vault_seal") {
    return {
      mode: (args.mode as string) ?? "receipt",
      payload: (args.content as string) ?? (args.payload as string) ?? JSON.stringify(args),
      session_id: (args.session_id as string) ?? undefined,
      actor_id: (args.actor_id as string) ?? undefined,
      blast_radius: args.tier === "CRITICAL" ? "L3_CRITICAL" : "L2_SYSTEM",
    };
  }

  if (tool === "arif_verify") {
    return {
      mode: "verify",
      session_token: (args.token as string) ?? (args.session_token as string) ?? (args.session_id as string) ?? undefined,
      payload: (args.command as string) ?? (args.payload as string) ?? "",
      actor_id: (args.actor_id as string) ?? "ARIF",
    };
  }

  if (tool === "arif_lease_inspect") {
    return {
      mode: "validate",
      constitutional_chain_id: (args.lease_id as string) ?? undefined,
      session_id: (args.session_id as string) ?? undefined,
      actor_id: (args.actor_id as string) ?? "aforge",
      candidate: JSON.stringify(args),
    };
  }

  if (tool === "arif_lease_issue") {
    return {
      mode: "judge",
      candidate: JSON.stringify({
        organ_id: args.organ_id ?? "A-FORGE",
        actor_id: args.actor_id ?? args.agent_id ?? "aforge",
        scope: args.scope ?? [],
        max_action_class: args.max_action_class ?? "EXECUTE_REVERSIBLE",
      }),
      actor_id: (args.actor_id as string) ?? (args.agent_id as string) ?? "aforge",
      session_id: (args.session_id as string) ?? undefined,
    };
  }

  if (tool === "arif_lease_revoke") {
    return {
      mode: "hold",
      constitutional_chain_id: (args.lease_id as string) ?? undefined,
      candidate: (args.reason as string) ?? "Revoke lease",
      actor_id: (args.actor_id as string) ?? (args.agent_id as string) ?? "aforge",
      session_id: (args.session_id as string) ?? undefined,
    };
  }

  return args;
}

/**
 * Special-case response transformers for tools where A-FORGE expects
 * a different shape than the kernel returns.
 */
export function transformResponse(tool: string, result: Record<string, unknown>): Record<string, unknown> {
  if (tool === "apex_judge" || tool === "arif_judge") {
    // AgentEngine expects .decision ("HOLD" | "VOID"), kernel returns .verdict
    const verdict = result.verdict ?? result.decision;
    return {
      ...result,
      decision: verdict,
      verdict,
    };
  }

  if (tool === "arif_verify") {
    const meta = (result.meta as Record<string, unknown>) ?? {};
    return {
      ...result,
      token_valid: meta.token_valid ?? (result.status === "PASS" || result.verdict === "SEAL"),
      scope_valid: meta.scope_valid ?? true,
      replay_safe: meta.replay_safe ?? true,
      violations: meta.violations ?? result.reasons ?? [],
    };
  }

  if (tool === "arif_lease_inspect") {
    const valid = result.verdict === "SEAL" || result.status === "PASS" || result.status === "OK";
    return {
      ...result,
      lease: {
        lease_id: result.constitutional_chain_id ?? result.entry_id ?? "LEASE-VERIFIED",
        active: valid,
        revoked: result.verdict === "VOID" || result.verdict === "HOLD",
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        max_action_class: "MUTATE",
      },
    };
  }

  if (tool === "arif_lease_issue") {
    const chainId = (result.constitutional_chain_id as string) ?? (result.entry_id as string) ?? `LCL-${Date.now().toString(36)}`;
    return {
      ...result,
      ok: true,
      lease: {
        lease_id: chainId,
        active: true,
        revoked: false,
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        max_action_class: "MUTATE",
      },
    };
  }

  if (tool === "arif_lease_revoke") {
    return {
      ...result,
      ok: true,
      lease: {
        revoked: true,
        active: false,
      },
    };
  }

  return result;
}
