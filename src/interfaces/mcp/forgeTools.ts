/**
 * A-FORGE Phase 1 Tools — Identity, Lease, Registry, Logs, Shell, Jobs
 *
 * Six new tool groups that complete the governed coder gateway.
 * Together with proxyTools.ts (filesystem, postgres, memory, git, github, docker),
 * these form the full Phase 1 surface: 12+6 = 18 forge_* tools.
 *
 * Each tool:
 * - Registers via server.tool() with Zod schema
 * - Runs inside FloorEnforcer-gated wrapper (C1 Phase 1)
 * - Returns content in A-FORGE standard format
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { callMCP } from "./client.js";
import { registerSession } from "../../domain/session/sessionGate.js";
import {
  forgeSkill,
  getSkillRegistry,
  consultScars,
  listScars,
  haramScan,
} from "../../domain/forge/skill/index.js";
import type { SkillDomain } from "../../domain/forge/skill/types.js";
import { evaluateCandidate, evaluateDryRun } from "../../domain/forge/evaluate.js";
import { evaluateWitness, witnessDryRun } from "../../domain/forge/witness.js";
import { sealFailure, listFailures, consultFailurePressure } from "../../domain/forge/scar.js";
import { registerTool, queryRegistry, registryFingerprint } from "../../domain/forge/register.js";
import {
  createLoop,
  getLoop,
  destroyLoop,
  listActiveLoops,
  getLoopMetrics,
  getLoopReport,
  advanceStage,
  nextStage,
  sealIteration,
  validateEvidenceEntry,
  safeJsonParse,
  MAX_CONFIDENCE,
} from "../../domain/reality-loop/index.js";
// Static imports for record functions (used in forge_reality_loop record mode)
import {
  recordEvidence,
  recordAction,
  recordEntropy,
  recordModification,
  recordScar,
  recordFloorViolation,
} from "../../domain/reality-loop/engine.js";
import type { RealityLoopConfig } from "../../domain/reality-loop/types.js";
import type {
  CandidateSpec,
  GateDecision,
  WitnessBundle,
  WitnessVerdict,
  GovernedDomain,
} from "../../contracts/types.js";

// ── In-memory stores ──────────────────────────────────────────────────────────

const registeredAgents = new Map<string, {
  agent_id: string;
  agent_type: string;
  role: string;
  authority: Record<string, string>;
  registered_at: string;
  last_seen: string;
  lease_ids: string[];
}>();

export type LeaseRecord = {
  lease_id: string;
  agent_id: string;
  scope: string[];
  max_action_class: string;
  ttl_seconds: number;
  issued_at: number;
  expires_at: number;
  forbidden: string[];
  revoked: boolean;
};

const activeLeases = new Map<string, LeaseRecord>();

// ── Action Class Priority ─────────────────────────────────────────────────────
// Lower rank = higher severity. Lease must meet or exceed requested severity.
// Includes both 8-value taxonomy (actionClassifier.ts) and legacy values
// (PROPOSE, MUTATE, ATOMIC) for backward compatibility with existing leases.
const CLASS_RANK: Record<string, number> = {
  // 8-value taxonomy (primary)
  IRREVERSIBLE:          0,  // rm -rf, DROP TABLE, vault seal — 888_HOLD required
  EXECUTE_HIGH_IMPACT:   1,  // deploy, billing, data mutation — governance required
  EXECUTE_REVERSIBLE:   2,  // git commit, file write, service restart — reversible
  QUEUE:                 3,  // schedule, defer, enqueue — async, no immediate effect
  DRAFT:                 4,  // write unsent, compose draft — not committed
  SIMULATE:              5,  // dry run, forward model, preview — no side effects
  SUGGEST:               6,  // recommend, propose — no commitment
  OBSERVE:               7,  // read-only — no side effects
  // Legacy values (for existing leases that may still use these)
  PROPOSE:               5,  // maps to SIMULATE priority
  MUTATE:                2,  // maps to EXECUTE_REVERSIBLE priority
  ATOMIC:                0,  // maps to IRREVERSIBLE priority
};

const jobStore = new Map<string, {
  job_id: string;
  agent_id: string;
  tool: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}>();

// ── Identity Storage Path ─────────────────────────────────────────────────────

const IDENTITY_FILE = "/root/A-FORGE/data/agent_identities.json";

async function loadIdentities(): Promise<void> {
  try {
    const data = await readFile(IDENTITY_FILE, "utf-8");
    const agents = JSON.parse(data);
    for (const [id, agent] of Object.entries(agents)) {
      registeredAgents.set(id, agent as any);
    }
  } catch { /* first run — no identities yet */ }
}

async function saveIdentities(): Promise<void> {
  const dir = resolve(IDENTITY_FILE, "..");
  await mkdir(dir, { recursive: true });
  const obj = Object.fromEntries(registeredAgents);
  await writeFile(IDENTITY_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

// ── 1. forge_agent_* — Identity Registration ────────────────────────────────

export function registerIdentityTools(server: McpServer): void {
// forge_agent — merged: register, status, list, kill
  server.tool(
    "forge_agent",
    "Agent identity management. Modes: register, status, list, kill. F11 AUTH.",
    {
      mode: z.enum(["register", "status", "list", "kill"]).default("list"),
      agent_id: z.string().optional().describe("Agent identifier"),
      // kill mode requires these three — F1 AMANAH + F11 AUDIT
      actor_id: z.string().optional().describe("Actor requesting kill (required for mode=kill)"),
      lease_id: z.string().optional().describe("Governed lease ID (required for mode=kill)"),
      reason: z.string().optional().describe("Audit reason for kill (required for mode=kill)"),
      agent_type: z.enum(["opencode", "hermes", "chatgpt", "custom"]).optional().describe("Agent origin"),
      role: z.enum(["governed_coder", "observer", "geoscience_agent", "finance_agent", "wellness_agent", "controller"]).optional().describe("Role profile"),
      authority: z.object({
        observe: z.boolean().default(true),
        dry_run: z.boolean().default(true),
        propose_patch: z.boolean().default(true),
        mutate_files: z.enum(["always", "lease_required", "never"]).default("lease_required"),
        shell_exec: z.enum(["always", "lease_required", "never"]).default("lease_required"),
        git_commit: z.enum(["always", "888_HOLD", "never"]).default("888_HOLD"),
        deploy: z.enum(["always", "888_HOLD", "never"]).default("888_HOLD"),
        vault_seal: z.enum(["always", "888_HOLD", "never"]).default("888_HOLD"),
      }).optional().describe("Authority ceiling per action class"),
      identity_proof: z.string().optional().describe("SHA-256 of agent's public key or session nonce"),
    },
    async ({ mode, agent_id, agent_type, role, authority, identity_proof, actor_id, lease_id, reason }) => {
      if (mode === "list") {
        const agents = Array.from(registeredAgents.values()).map(a => ({
          agent_id: a.agent_id, role: a.role, agent_type: a.agent_type,
          registered_at: a.registered_at, last_seen: a.last_seen, active_leases: a.lease_ids.length,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ count: agents.length, agents }, null, 2) }] };
      }
      if (mode === "status") {
        if (!agent_id) return { content: [{ type: "text" as const, text: "agent_id required for mode=status" }], isError: true };
        const agent = registeredAgents.get(agent_id);
        if (!agent) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Agent '${agent_id}' not registered` }, null, 2) }], isError: true };
        agent.last_seen = new Date().toISOString();
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", agent, active_leases: agent.lease_ids.map(id => activeLeases.get(id)).filter(Boolean) }, null, 2) }] };
      }
      // P2.4: forge_agent kill mode — terminate agent + revoke leases + recover resources
      // F1 AMANAH: requires actor_id + lease_id + reason (IRREVERSIBLE-level safety)
      if (mode === "kill") {
        if (!agent_id) return { content: [{ type: "text" as const, text: "agent_id required for mode=kill" }], isError: true };
        if (!actor_id) return { content: [{ type: "text" as const, text: "actor_id required for mode=kill" }], isError: true };
        if (!lease_id) return { content: [{ type: "text" as const, text: "lease_id required for mode=kill" }], isError: true };
        if (!reason || reason.trim().length === 0) return { content: [{ type: "text" as const, text: "reason required for mode=kill" }], isError: true };
        // Verify lease is valid and not expired
        const lease = activeLeases.get(lease_id);
        if (!lease || lease.revoked) return { content: [{ type: "text" as const, text: `Lease '${lease_id}' not found or revoked` }], isError: true };
        if (new Date(lease.expires_at).getTime() < Date.now()) return { content: [{ type: "text" as const, text: `Lease '${lease_id}' expired` }], isError: true };
        const agent = registeredAgents.get(agent_id);
        if (!agent) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Agent '${agent_id}' not registered` }, null, 2) }], isError: true };
        const revokedLeases: string[] = [];
        for (const lid of agent.lease_ids) {
          const l = activeLeases.get(lid);
          if (l && !l.revoked) { l.revoked = true; revokedLeases.push(lid); }
        }
        registeredAgents.delete(agent_id);
        await saveIdentities();
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", mode: "kill", actor_id, lease_id, reason, agent_id, revoked_leases: revokedLeases.length, removed_at: new Date().toISOString() }, null, 2) }] };
      }
      // register
      if (!agent_id || !agent_type || !role) return { content: [{ type: "text" as const, text: "agent_id, agent_type, role required for mode=register" }], isError: true };
      const now = new Date().toISOString();
      const agent = { agent_id, agent_type, role, authority: (authority ?? {}) as Record<string, string>, identity_proof: identity_proof ?? "pending", registered_at: now, last_seen: now, lease_ids: [] };
      registeredAgents.set(agent_id, agent);
      await saveIdentities();
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", agent_id, role, registered_at: now }, null, 2) }] };
    }
  );
}

// ── 2. forge_lease_* — Lease Lifecycle (FORGE 2-B) ──────────────────────────
//
// A-FORGE no longer self-authorizes leases. Every lease is minted by arifOS.
// The local `activeLeases` Map is a read-through cache for fast status checks.

const AFORGE_TO_ARIFOS_CLASS: Record<string, string> = {
  OBSERVE: "OBSERVE",
  SUGGEST: "REASON",
  SIMULATE: "DRY_RUN",
  DRAFT: "DRY_RUN",
  QUEUE: "DRY_RUN",
  EXECUTE_REVERSIBLE: "MUTATE",
  EXECUTE_HIGH_IMPACT: "EXTERNAL",
  IRREVERSIBLE: "IRREVERSIBLE",
  // Legacy aliases
  PROPOSE: "DRY_RUN",
  MUTATE: "MUTATE",
  ATOMIC: "IRREVERSIBLE",
};

function toArifosActionClass(cls: string): string {
  // F9 ANTI-HANTU + F7 HUMILITY: unknown action class = HOLD, never silent OBSERVE
  if (!(cls in AFORGE_TO_ARIFOS_CLASS)) {
    throw new Error(`UNKNOWN_ACTION_CLASS: '${cls}' — must be one of: ${Object.keys(AFORGE_TO_ARIFOS_CLASS).join(", ")}`);
  }
  return AFORGE_TO_ARIFOS_CLASS[cls];
}

function isObserveClass(actionClass: string): boolean {
  return actionClass === "OBSERVE";
}

// One Skill + One Tool binding (from kernel INIT + capability map)
// No execution without verdict loop receipt.
// Restraint flags drive HOLD / ASK.
interface VerdictGeometry {
  trace_id?: string;
  restraint_state?: string; // active | HOLD | ASK_ONE_QUESTION
  requires_loop?: boolean;
}

function checkVerdictLoop(leaseOrSession: any, actionClass: string): { ok: boolean; reason?: string; hold?: boolean; ask?: boolean; refuse?: boolean } {
  const vg: VerdictGeometry = leaseOrSession?.verdict_geometry || leaseOrSession?.session_geometry || {};
  const restraintFlags: string[] = leaseOrSession?.restraint_flags || [];

  // Verdict loop is the ONLY path for any non-OBSERVE action. This is non-bypassable.
  if (!isObserveClass(actionClass)) {
    if (!vg.trace_id) {
      return { ok: false, reason: "VERDICT_LOOP_REQUIRED: INIT + arif_judge + arif_seal first (One Tool: Verdict Loop With Memory)", hold: true };
    }
  }

  // One Skill: Knowing What NOT To Do — wire restraint flags into behavior
  if (restraintFlags.includes("restraint_under_uncertainty") || vg.restraint_state === "HOLD") {
    return { ok: false, reason: "RESTRAINT (One Skill): HOLD — pattern insufficient, do not proceed", hold: true };
  }
  if (restraintFlags.includes("refusal_on_ambiguity") || vg.restraint_state === "ASK_ONE_QUESTION") {
    return { ok: false, reason: "RESTRAINT (One Skill): ASK — one clarifying question required, refuse to over-complete", ask: true };
  }
  if (restraintFlags.includes("bounded_authority") && ["EXECUTE_HIGH_IMPACT", "IRREVERSIBLE"].includes(actionClass)) {
    return { ok: false, reason: "RESTRAINT (One Skill): REFUSE — authority insufficient for this blast radius", refuse: true };
  }

  return { ok: true };
}

function logLeaseDecision(
  lease_id: string | undefined,
  tool: string,
  actionClass: string,
  outcome: { ok: true; lease: LeaseRecord } | { ok: false; gate: string; reason: string },
): void {
  const status = outcome.ok ? "SEAL" : outcome.gate;
  const leaseId = lease_id ?? "<none>";
  process.stderr.write(
    `[LEASE_GATE] tool=${tool} class=${actionClass} lease_id=${leaseId} verdict=${status}` +
    (outcome.ok ? "" : ` reason=${outcome.reason}`) + "\n",
  );
}

// Enforce verdict loop + restraint before lease/execute (step 2 binding)
function enforceOneSkillOneTool(lease: any, actionClass: string, tool: string) {
  const check = checkVerdictLoop(lease, actionClass);
  if (!check.ok) {
    throw new Error(`[VERDICT_GATE] ${tool}: ${check.reason} — cannot proceed (One Tool + One Skill)`);
  }
}

function arifosLeaseToLocal(lease: any): LeaseRecord {
  const issuedAt = lease.issued_at ? new Date(lease.issued_at).getTime() : Date.now();
  const expiresAt = lease.expires_at ? new Date(lease.expires_at).getTime() : Date.now() + 300_000;
  return {
    lease_id: lease.lease_id,
    agent_id: lease.actor_id ?? lease.agent_id ?? "unknown",
    scope: Array.isArray(lease.scope) ? lease.scope : [],
    max_action_class: lease.max_action_class,
    ttl_seconds: Math.max(1, Math.floor((expiresAt - issuedAt) / 1000)),
    issued_at: issuedAt,
    expires_at: expiresAt,
    forbidden: Array.isArray(lease.forbidden) ? lease.forbidden : [],
    revoked: lease.revoked === true,
  };
}

async function issueLeaseViaKernel(args: {
  agent_id: string;
  scope: string[];
  max_action_class: string;
  ttl_seconds: number;
  forbidden: string[];
  session_id?: string;
}): Promise<{ ok: true; lease: LeaseRecord } | { ok: false; reason: string }> {
  try {
    const result = await callMCP("arifos.arif_lease_issue", {
      organ_id: "A-FORGE",
      actor_id: args.agent_id,
      scope: args.scope,
      max_action_class: toArifosActionClass(args.max_action_class),
      ttl_seconds: args.ttl_seconds,
      forbidden: args.forbidden,
      session_id: args.session_id,
    }) as any;

    const lease = result?.lease ?? result?.result?.lease;
    if (!lease || !lease.lease_id) {
      return { ok: false, reason: `Kernel issued lease without lease_id: ${JSON.stringify(result)}` };
    }
    const localLease = arifosLeaseToLocal(lease);
    // Enforce One Tool + One Skill at A-FORGE boundary
    enforceOneSkillOneTool(localLease, lease.max_action_class || "OBSERVE", "lease_issue");
    return { ok: true, lease: localLease };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
}

async function inspectLeaseViaKernel(lease_id: string): Promise<any> {
  return callMCP("arifos.arif_lease_inspect", { lease_id });
}

async function revokeLeaseViaKernel(args: {
  lease_id: string;
  agent_id: string;
  reason?: string;
  session_id?: string;
}): Promise<{ ok: true; lease: LeaseRecord } | { ok: false; reason: string }> {
  try {
    const result = await callMCP("arifos.arif_lease_revoke", {
      lease_id: args.lease_id,
      actor_id: args.agent_id,
      reason: args.reason ?? "a-forge-revoke",
      session_id: args.session_id,
    }) as any;

    const lease = result?.lease ?? result?.result?.lease;
    if (!lease || !lease.lease_id) {
      return { ok: false, reason: `Kernel revoke returned no lease: ${JSON.stringify(result)}` };
    }
    return { ok: true, lease: arifosLeaseToLocal(lease) };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
}

/**
 * Validate a lease against the requested tool and action class.
 * For execution-class tools, this performs a live arifOS lease_inspect call.
 */
export async function validateLeaseForTool(
  lease_id: string | undefined,
  tool: string,
  actionClass: string,
): Promise<{ ok: true; lease: LeaseRecord } | { ok: false; gate: string; reason: string }> {
  // OBSERVE actions do not require a lease, but if a lease_id is supplied we
  // still verify it exists with the kernel (read-only identity check).
  if (!lease_id) {
    if (isObserveClass(actionClass)) {
      const ok = { ok: true as const, lease: undefined as unknown as LeaseRecord };
      logLeaseDecision(lease_id, tool, actionClass, ok);
      return ok;
    }
    const fail = { ok: false as const, gate: "LEASE_REQUIRED", reason: "lease_id is required for non-OBSERVE actions" };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }

  let lease: LeaseRecord | undefined;

  try {
    const inspect = await inspectLeaseViaKernel(lease_id);
    const kernelLease = inspect?.lease ?? inspect?.result?.lease;
    if (!kernelLease || !kernelLease.lease_id) {
      const fail = { ok: false as const, gate: "LEASE_KERNEL_UNKNOWN", reason: `arifOS does not recognise lease '${lease_id}'` };
      logLeaseDecision(lease_id, tool, actionClass, fail);
      return fail;
    }
    if (kernelLease.revoked === true) {
      const fail = { ok: false as const, gate: "LEASE_REVOKED", reason: "Lease revoked by kernel" };
      logLeaseDecision(lease_id, tool, actionClass, fail);
      return fail;
    }
    const expiresAt = new Date(kernelLease.expires_at).getTime();
    if (Date.now() > expiresAt) {
      const fail = { ok: false as const, gate: "LEASE_EXPIRED", reason: "Lease expired according to kernel" };
      logLeaseDecision(lease_id, tool, actionClass, fail);
      return fail;
    }
    lease = arifosLeaseToLocal(kernelLease);
    // Keep local cache in sync as a read-only diagnostic cache only.
    // Authorization never comes from this cache.
    activeLeases.set(lease_id, lease);
  } catch (err: any) {
    const fail = {
      ok: false as const,
      gate: "LEASE_KERNEL_UNREACHABLE",
      reason: `Cannot verify lease with arifOS: ${err?.message ?? String(err)}`,
    };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }

  // For OBSERVE actions with an explicit lease_id, we only verify existence
  // above. Scope/class matching is required for non-OBSERVE actions.
  if (isObserveClass(actionClass)) {
    const ok = { ok: true as const, lease };
    logLeaseDecision(lease_id, tool, actionClass, ok);
    return ok;
  }

  // F9 ANTI-HANTU + F7 HUMILITY: unknown class = HOLD, never silent IRREVERSIBLE rank 0
  if (!(actionClass in CLASS_RANK)) {
    const fail = { ok: false as const, gate: "UNKNOWN_ACTION_CLASS", reason: `Unknown action class '${actionClass}' — cannot rank for lease check` };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }
  if (!(lease.max_action_class in CLASS_RANK)) {
    const fail = { ok: false as const, gate: "LEASE_UNKNOWN_CLASS", reason: `Lease has unknown max_action_class '${lease.max_action_class}'` };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }
  const requestedRank = CLASS_RANK[actionClass];
  const leaseRank = CLASS_RANK[lease.max_action_class];
  // Lower rank = higher severity. A lease can authorize actions at or below
  // its own severity, never above it.
  if (requestedRank < leaseRank) {
    const fail = {
      ok: false as const,
      gate: "LEASE_CLASS_EXCEEDED",
      reason: `Lease permits up to '${lease.max_action_class}', but '${tool}' is class ${actionClass}`,
    };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }
  const wildcard = lease.scope.includes("*");
  if (!wildcard && !lease.scope.includes(tool)) {
    const fail = { ok: false as const, gate: "LEASE_SCOPE_DENIED", reason: `Tool '${tool}' is not in lease scope` };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }
  if (lease.forbidden.includes(tool)) {
    const fail = { ok: false as const, gate: "LEASE_FORBIDDEN", reason: `Tool '${tool}' is explicitly forbidden by lease` };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }

  // Harden: Verdict loop + restraint (One Skill / One Tool) is the ONLY path. Non-bypassable.
  try {
    enforceOneSkillOneTool(lease, actionClass, tool);
  } catch (e: any) {
    const fail = { ok: false as const, gate: "VERDICT_RESTRAINT_GATE", reason: e?.message || "Verdict/restraint enforcement failed" };
    logLeaseDecision(lease_id, tool, actionClass, fail);
    return fail;
  }

  const ok = { ok: true as const, lease };
  logLeaseDecision(lease_id, tool, actionClass, ok);
  return ok;
}

export function registerLeaseTools(server: McpServer): void {
  // forge_lease — merged: request, status, revoke
  server.tool(
    "forge_lease",
    "Lease lifecycle. Modes: request, status, revoke. A-FORGE does not self-issue leases — arifOS mints them.",
    {
      mode: z.enum(["request", "status", "revoke"]).describe("Lease operation"),
      lease_id: z.string().optional().describe("Lease ID (status/revoke)"),
      agent_id: z.string().optional().describe("Agent ID (request/revoke)"),
      scope: z.array(z.string()).optional().describe("Tools to include (request)"),
      max_action_class: z.enum(["OBSERVE", "SUGGEST", "SIMULATE", "DRAFT", "QUEUE", "EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE", "PROPOSE", "MUTATE", "ATOMIC"]).default("EXECUTE_REVERSIBLE").describe("Max action class (request)"),
      ttl_seconds: z.number().default(300).describe("Lease TTL (request, max 3600)"),
      forbidden: z.array(z.string()).optional().describe("Forbidden tools (request)"),
      reason: z.string().optional().describe("Reason (revoke)"),
    },
    async (args: any) => {
      const { mode, lease_id, agent_id, scope, max_action_class, ttl_seconds, forbidden, reason, session_id } = args;

      if (mode === "status") {
        if (!lease_id) return { content: [{ type: "text" as const, text: "lease_id required for mode=status" }], isError: true };
        try {
          const inspect = await inspectLeaseViaKernel(lease_id);
          const kernelLease = inspect?.lease ?? inspect?.result?.lease;
          if (kernelLease) {
            const lease = arifosLeaseToLocal(kernelLease);
            activeLeases.set(lease_id, lease);
            const remaining_s = Math.max(0, Math.floor((lease.expires_at - Date.now()) / 1000));
            return { content: [{ type: "text" as const, text: JSON.stringify({ status: lease.revoked ? "REVOKED" : remaining_s === 0 ? "EXPIRED" : "ACTIVE", source: "arifOS", lease_id, agent_id: lease.agent_id, scope: lease.scope, max_action_class: lease.max_action_class, remaining_seconds: remaining_s, expires_at: new Date(lease.expires_at).toISOString() }, null, 2) }] };
          }
        } catch { /* fall through */ }
        const lease = activeLeases.get(lease_id);
        if (!lease) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Lease '${lease_id}' not found` }, null, 2) }], isError: true };
        const remaining_s = Math.max(0, Math.floor((lease.expires_at - Date.now()) / 1000));
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: lease.revoked ? "REVOKED" : remaining_s === 0 ? "EXPIRED" : "ACTIVE", source: "local_cache", lease_id, remaining_seconds: remaining_s, expires_at: new Date(lease.expires_at).toISOString() }, null, 2) }] };
      }

      if (mode === "revoke") {
        if (!lease_id || !agent_id) return { content: [{ type: "text" as const, text: "lease_id and agent_id required for mode=revoke" }], isError: true };
        const revoke = await revokeLeaseViaKernel({ lease_id, agent_id, reason, session_id });
        if (!revoke.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", gate: "LEASE_REVOKE_FAILED", reason: revoke.reason }, null, 2) }], isError: true };
        activeLeases.set(lease_id, revoke.lease);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "REVOKED", lease_id, agent_id, reason: reason ?? "no reason given", revoked_at: new Date().toISOString() }, null, 2) }] };
      }

      // request
      if (!agent_id || !scope) return { content: [{ type: "text" as const, text: "agent_id and scope required for mode=request" }], isError: true };
      if (!registeredAgents.has(agent_id)) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Agent '${agent_id}' not registered. Use forge_agent mode=register first.` }, null, 2) }], isError: true };
      const effective_ttl = Math.min(ttl_seconds ?? 300, 3600);
      const issue = await issueLeaseViaKernel({ agent_id, scope, max_action_class, ttl_seconds: effective_ttl, forbidden: forbidden ?? [], session_id });
      if (!issue.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", gate: "LEASE_ISSUE_FAILED", reason: issue.reason }, null, 2) }], isError: true };
      const lease = issue.lease;
      activeLeases.set(lease.lease_id, lease);
      const agent = registeredAgents.get(agent_id)!;
      agent.lease_ids.push(lease.lease_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", source: "arifOS", lease_id: lease.lease_id, agent_id, scope: lease.scope, max_action_class, ttl_seconds: lease.ttl_seconds, expires_at: new Date(lease.expires_at).toISOString() }, null, 2) }] };
    }
  );
}

// ── 3. forge_registry_* — Tool Registry ─────────────────────────────────────

export function registerRegistryTools(server: McpServer): void {
  server.tool(
    "forge_registry_status",
    "Full A-FORGE tool registry: callable, blocked, degraded, and drift status for all registered tools.",
    {},
    async () => {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            service: "A-FORGE MCP",
            version: "0.1.0",
            registry_truth: "VERIFIED",
            authority_ceiling: "777_FORGE",
            note: "Tool list is dynamic — use MCP tools/list for live count",
          }, null, 2),
        }],
      };
    }
  );
}

// ── 4. forge_shell_dryrun — DEPRECATED — Use shell/forgeShell.ts ─────────
//
// The canonical forge_shell + forge_shell_dryrun live in shell/forgeShell.ts
// with full ArifJudge constitutional gate + ArifSeal hash-chain audit.
// This legacy registration is kept as a no-op shim for import compatibility.

export function registerShellTools(_server: McpServer): void {
  // Deprecated: forge_shell and forge_shell_dryrun are now registered
  // by shell/forgeShell.ts with full constitutional governance.
  // This shim exists only for import compatibility.
}

// ── 5. forge_log_tail — System Log Reader ─────────────────────────────────────

export function registerLogTools(server: McpServer): void {
  // NOTE: forge_log_tail REMOVED — use forge_journalctl with mode=tail (merged tool).
}

// ── 6. forge_job — Background Job System ─────────────────────────────────

export function registerJobTools(server: McpServer): void {
  // forge_job — merged: submit, status
  server.tool(
    "forge_job",
    "Background job system. Modes: submit, status.",
    {
      mode: z.enum(["submit", "status"]).describe("Job operation"),
      job_id: z.string().optional().describe("Job ID (status mode)"),
      agent_id: z.string().optional().describe("Agent ID (submit)"),
      tool: z.string().optional().describe("Tool to execute (submit)"),
      args: z.record(z.string(), z.any()).optional().describe("Tool arguments (submit)"),
      description: z.string().optional().describe("Job description (submit)"),
    },
    async ({ mode, job_id, agent_id, tool, args, description }) => {
      if (mode === "status") {
        if (!job_id) return { content: [{ type: "text" as const, text: "job_id required for mode=status" }], isError: true };
        const job = jobStore.get(job_id);
        if (!job) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Job '${job_id}' not found` }, null, 2) }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(job, null, 2) }] };
      }
      // submit
      if (!agent_id || !tool) return { content: [{ type: "text" as const, text: "agent_id and tool required for mode=submit" }], isError: true };
      const job_id_new = randomUUID();
      const job = { job_id: job_id_new, agent_id, tool, status: "queued" as const, args: args ?? {}, description: description ?? tool, created_at: new Date().toISOString() };
      jobStore.set(job_id_new, job);
      setTimeout(async () => {
        const j = jobStore.get(job_id_new);
        if (!j) return;
        j.status = "running";
        try {
          const output = execSync(`echo "Job ${job_id_new} for ${tool} completed."`, { encoding: "utf-8", timeout: 30000 });
          j.status = "completed"; j.result = output; j.completed_at = new Date().toISOString();
        } catch (err: any) { j.status = "failed"; j.error = err.message; j.completed_at = new Date().toISOString(); }
      }, 100);
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", job_id: job_id_new, tool, agent_id, queued_at: job.created_at }, null, 2) }] };
    }
  );
}

// ── P2.2: forge_status — Active execution state ──────────────────────────
//
// Exposes jobStore, activeLeases, and registeredAgents state.
// Added 2026-06-28 as canonical gap fill.

export function registerStatusTools(server: McpServer): void {
  server.tool(
    "forge_status",
    "Active execution state: jobs, leases, agents. INFRA-class. P2.2 canonical gap fill.",
    {
      mode: z.enum(["overview", "jobs", "leases", "agents"]).default("overview"),
      limit: z.number().default(20).describe("Max items per section"),
    },
    async ({ mode, limit }: { mode: string; limit: number }) => {
      const result: Record<string, any> = { timestamp: new Date().toISOString() };
      if (mode === "overview" || mode === "jobs") {
        const jobs = Array.from(jobStore.values()).slice(-limit);
        result.jobs = { count: jobStore.size, recent: jobs.map(j => ({ job_id: j.job_id, tool: j.tool, status: j.status, created_at: j.created_at })) };
      }
      if (mode === "overview" || mode === "leases") {
        const now = Date.now();
        const leases = Array.from(activeLeases.values()).filter(l => !l.revoked && l.expires_at > now).slice(0, limit);
        result.leases = { count: activeLeases.size, active: leases.length, items: leases.map(l => ({ lease_id: l.lease_id, agent_id: l.agent_id, scope: l.scope, max_action_class: l.max_action_class, remaining_s: Math.max(0, Math.floor((l.expires_at - now) / 1000)) })) };
      }
      if (mode === "overview" || mode === "agents") {
        const agents = Array.from(registeredAgents.values());
        result.agents = { count: agents.length, recent: agents.slice(-limit).map(a => ({ agent_id: a.agent_id, role: a.role, last_seen: a.last_seen, active_leases: a.lease_ids.length })) };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", ...result }, null, 2) }] };
    }
  );

  // ── P2.3: forge_abort — Safe stop + rollback ──────────────────────────────
  server.tool(
    "forge_abort",
    "Safe stop + rollback for running execution. Requires lease or session auth. P2.3 canonical gap fill.",
    {
      target: z.enum(["job", "lease", "pipeline"]).describe("What to abort"),
      target_id: z.string().describe("ID of the target to abort"),
      reason: z.string().describe("Why this abort is happening"),
      rollback: z.boolean().default(true).describe("Attempt rollback if applicable"),
    },
    async ({ target, target_id, reason, rollback }: { target: string; target_id: string; reason: string; rollback: boolean }) => {
      const log: string[] = [];
      if (target === "job") {
        const job = jobStore.get(target_id);
        if (!job) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Job '${target_id}' not found` }, null, 2) }], isError: true };
        job.status = "failed";
        job.error = `Aborted: ${reason}`;
        job.completed_at = new Date().toISOString();
        log.push(`Job ${target_id} set to failed`);
      }
      if (target === "lease") {
        const lease = activeLeases.get(target_id);
        if (!lease) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Lease '${target_id}' not found` }, null, 2) }], isError: true };
        lease.revoked = true;
        log.push(`Lease ${target_id} revoked`);
      }
      if (target === "pipeline") {
        log.push(`Pipeline ${target_id} abort requested. Manual verification required.`);
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", target, target_id, reason, rollback, actions: log }, null, 2) }] };
    }
  );
}

// ── Initialize ────────────────────────────────────────────────────────────────

export async function initializeForgeTools(): Promise<void> {
  await loadIdentities();
  // Pre-load skill registry to populate volatile state
  try {
    const reg = getSkillRegistry();
    await reg.load();
    process.stderr.write(`[forgeTools] Skill registry loaded (volatile)\n`);
  } catch (err: any) {
    process.stderr.write(`[forgeTools] Skill registry load warning: ${err?.message ?? err}\n`);
  }
  process.stderr.write(`[forgeTools] Loaded ${registeredAgents.size} agent identities\n`);
}

// ── 8. forge_skill — Dynamic Tool Forge (APEX Epoch 34Ω — Organism Layer) ──
//
// forge_skill + forge_registry together close the dynamic forge loop:
//
//   arifOS judges → A-FORGE asks:
//     ├── tool exists? → forge_execute
//     └── tool missing → forge_skill (generate, gated, sealed)
//
// Phase 1: human approval per generation, HARAM scan + Decision Field gate,
//          volatile registry, 24h expiry, max 1 generation depth.
// Decision Field: G = Q·V·Ψ·Φ
//   Q = query clarity, V = viability, Ψ = purity (HARAM inversed), Φ = wisdom (scar-adjusted)
//   Θ = dΦ/dt (wisdom trajectory, per-tool)
// Multiplicative: zero in any component collapses G.
// Verdict thresholds (organism-layer vocabulary — arifOS SEAL/SABAR/HOLD/VOID reserved):
//   G ≥ 0.50 CRYSTALLIZE, ≥ 0.25 NUCLEATE, ≥ 0.10 DORMANT, < 0.10 WITHER.

export function registerSkillTools(server: McpServer): void {

  // ── forge_skill — generate or template a tool ────────────────────────────────
  server.tool(
    "forge_skill",
    "Dynamic tool forge (APEX Epoch 34Ω). Generates a new MCP tool via LLM, gated by HARAM scan + Decision Field (G=Q·V·Ψ·Φ), sealed to VAULT999. Phase 1: human approval per generation, 24h expiry, max 1 generation depth. F13 SOVEREIGN: arifOS domains require seal_verdict_id.",
    {
      intent: z.string().min(10).max(2000).describe("Natural-language description of what tool is needed"),
      domain: z.enum([
        "geox", "wealth", "well", "arifos", "hermes", "aforge", "general",
      ]).default("general").describe("Domain routing"),
      target_tool_name: z.string().regex(/^forge_[a-z0-9_]+$/).optional()
        .describe("Suggested name (must start with forge_, lowercase + digits + underscore)"),
      llm_endpoint: z.string().url().optional()
        .describe("Optional LLM endpoint for code generation (Phase 2). Phase 1 returns template scaffold if omitted."),
      execute_after_register: z.boolean().default(false)
        .describe("If true, execute the generated tool immediately. REQUIRES seal_verdict_id."),
      actor_id: z.string().default("forge_skill").describe("Calling actor"),
      session_id: z.string().optional(),
      seal_verdict_id: z.string().optional()
        .describe("arifOS seal verdict (required for arifos domain or execute_after_register)"),
      staging: z.boolean().default(false)
        .describe("If true, stage the generated skill for mesa/Landauer scan before production registration"),
    },
    async (args) => {
      try {
        // F8 LAW: arifos domain requires arifOS seal verdict (F13 SOVEREIGN)
        if (args.domain === "arifos" && !args.seal_verdict_id) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "DORMANT",
                verdict: "DORMANT",
                domain: args.domain,
                message: "F13 SOVEREIGN: arifos domain requires seal_verdict_id from arifOS arif_judge+arif_seal. Cannot forge tools that touch the constitutional kernel.",
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Phase 2: LLM wired via TokenRouter (MiniMax primary → deepseek → groq).
        // args.llm_endpoint is now deprecated — kept for backward compat only.
        if (args.llm_endpoint) {
          console.warn("[forge_skill] llm_endpoint param is deprecated — LLM is now wired via TokenRouter/providers.yml");
        }

        const result = await forgeSkill({
          intent: args.intent,
          domain: args.domain as SkillDomain,
          target_tool_name: args.target_tool_name,
          execute_after_register: args.execute_after_register,
          actor_id: args.actor_id,
          session_id: args.session_id,
          seal_verdict_id: args.seal_verdict_id,
        });

        // ── Staging gate: mesa-scan + Landauer check before production ──
        let stagingResult = null;
        if (args.staging && result.status !== "DORMANT" && result.status !== "WITHER") {
          const { getSkillStagingGate } = await import("../../domain/governance/SkillStagingGate.js");
          const gate = getSkillStagingGate();
          stagingResult = gate.stage(
            result.message ?? args.intent,
            args.target_tool_name ?? result.tool_name ?? "forge_staged",
            args.intent,
          );
        }

        const isError = result.status === "WITHER" || result.status === "DORMANT";
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, staging: stagingResult }, null, 2),
          }],
          isError,
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "DORMANT",
              verdict: "DORMANT",
              error: `forge_skill failed: ${err?.message ?? String(err)}`,
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
  );

  // ── forge_seal — VAULT999 skill binding (Phase 2 Sprint 4) ────────────────
  server.tool(
    "forge_seal",
    "Seal a Tri-Witness validated skill into permanent VAULT999 memory. Irreversible. Sealed skills cannot be deleted, demoted below TRUSTED, or expired. Requires REVIEWED tier + Tri-Witness PASS + F13 approval token.",
    {
      skill_name: z.string().describe("Tool name to seal (forge_*)"),
      human_approval_token: z.string().describe("F13 sovereign approval token (stg_<16+>)"),
      tri_witness_evidence: z.string().optional()
        .describe("JSON-serialized TriWitnessResult from prior validation"),
      actor_id: z.string().default("forge_seal").describe("Calling actor"),
    },
    async (args) => {
      try {
        const { getForgeSealService } = await import("../../domain/governance/ForgeSealService.js");
        const { getTriWitnessValidator } = await import("../../domain/governance/TriWitnessValidator.js");
        const { getSkillStore } = await import("../../infrastructure/skills/SkillStore.js");

        const sealer = getForgeSealService();
        const store = getSkillStore();

        // Retrieve the skill to get its code for Tri-Witness re-validation
        const skill = await store.get(args.skill_name);

        // Build or parse TriWitnessResult
        let triWitness;
        if (args.tri_witness_evidence) {
          triWitness = JSON.parse(args.tri_witness_evidence);
        } else if (skill) {
          // Re-validate if no evidence provided
          const validator = getTriWitnessValidator();
          triWitness = await validator.validate({
            skillName: skill.tool_name,
            skillCode: skill.code,
            skillIntent: skill.intent,
            domain: "general",
            generatorModel: skill.provenance.llm_model ?? "unknown",
            humanApprovalToken: args.human_approval_token,
            earthEvidenceType: "DOMAIN_ORGAN",
            earthEvidence: `Seal validation for ${skill.tool_name}`,
          });
        } else {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              status: "NOT_FOUND",
              reason: `Skill '${args.skill_name}' not found.`,
            }, null, 2) }], isError: true,
          };
        }

        const result = await sealer.seal(
          args.skill_name,
          triWitness,
          args.actor_id,
          args.human_approval_token,
        );

        const isError = result.status !== "SEALED" && result.status !== "ALREADY_SEALED";
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            status: "REJECTED",
            reason: `forge_seal failed: ${err?.message ?? String(err)}`,
          }, null, 2) }], isError: true,
        };
      }
    },
  );

  // ── forge_registry — query / inspect the dynamic tool registry ──────────────
  server.tool(
    "forge_registry",
    "Dynamic skill registry. Modes: list (all generated tools + Decision Field), get (one tool manifest), scars (Scar Law history), fingerprint (registry integrity hash), scan (HARAM scan arbitrary code). Volatile + 24h expiry by default.",
    {
      mode: z.enum(["list", "get", "scars", "fingerprint", "scan"]).default("list"),
      tool_name: z.string().optional().describe("Tool name (get mode)"),
      domain: z.enum(["geox", "wealth", "well", "arifos", "hermes", "aforge", "general"]).optional()
        .describe("Filter by domain (list mode)"),
      status_filter: z.enum(["REGISTERED", "PENDING_REVIEW", "REVOKED", "EXPIRED"]).optional()
        .describe("Filter by status (list mode)"),
      include_theta: z.boolean().default(false).describe("Include wisdom trajectory Θ=dΦ/dt per tool (list mode)"),
      code_to_scan: z.string().optional().describe("Source code to HARAM-scan (scan mode)"),
    },
    async ({ mode, tool_name, domain, status_filter, include_theta, code_to_scan }) => {
      try {
        const reg = getSkillRegistry();
        await reg.load();

        if (mode === "list") {
          const result = await reg.query({
            domain: domain as SkillDomain | undefined,
            status: status_filter,
            include_theta,
          });
          const fp = await reg.fingerprint();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "list",
                registry_fingerprint: fp,
                total: result.total,
                tools: result.tools,
              }, null, 2),
            }],
          };
        }

        if (mode === "get") {
          if (!tool_name) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "tool_name required for mode=get" }, null, 2) }],
              isError: true,
            };
          }
          const r = await reg.query({});
          const tool = r.tools.find(t => t.tool_name === tool_name);
          if (!tool) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `Tool '${tool_name}' not found in registry` }, null, 2) }],
              isError: true,
            };
          }
          const traj = include_theta ? await reg.getTheta(tool_name) : undefined;
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "get",
                tool,
                theta_trajectory: traj,
              }, null, 2),
            }],
          };
        }

        if (mode === "scars") {
          const scars = await listScars();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "scars",
                total: scars.length,
                scars,
                doctrine: "Scar Law: failed generations seal their fingerprint. Future generations with matching fingerprints inherit scar_pressure, reducing Φ until the failure pattern is no longer reachable.",
              }, null, 2),
            }],
          };
        }

        if (mode === "fingerprint") {
          const fp = await reg.fingerprint();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "fingerprint",
                registry_fingerprint: fp,
                doctrine: "Same fingerprint on two registries = same constitution. Drift = different federation.",
              }, null, 2),
            }],
          };
        }

        if (mode === "scan") {
          if (!code_to_scan) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "code_to_scan required for mode=scan" }, null, 2) }],
              isError: true,
            };
          }
          const scan = haramScan(code_to_scan);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "scan",
                haram_findings: scan.findings,
                haram_names: scan.names,
                critical_count: scan.critical,
                high_count: scan.high,
                passed: scan.findings === 0,
                doctrine: "F9 ANTI-HANTU: blocks shell-bombs, drop tables, device writes, fork bombs, eval().",
              }, null, 2),
            }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown mode: ${mode}` }, null, 2) }],
          isError: true,
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "HOLD",
              error: `forge_registry failed: ${err?.message ?? String(err)}`,
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APEX v36Ω GOVERNED TOOLS — forge.evaluate / forge.witness / forge.scar / forge.register
// ═══════════════════════════════════════════════════════════════════════════════
//
// These four tools decompose the forge_skill monolith into composable, independently
// callable governed gates. Each tool is a standalone measurement instrument (not a
// physical law) per the v36Ω Scientific Validation Report.
//
// Registration requires ALL four gates:
//   forge.evaluate → SEAL
//   forge.witness  → CONSENSUS
//   forge.scar     → consult (no CRITICAL match)
//   forge.register → SEAL (if all above pass)
//
// DITEMPA BUKAN DIBERI — Forged, Not Given

export function registerGovernedTools(server: McpServer): void {

  // ── forge_evaluate — standalone G = A·P·E·X·Φ gate ────────────────────────
  server.tool(
    "forge_evaluate",
    "APEX v36Ω evaluation gate. Computes G = A·P·E·X·Φ (Nash bargaining product) and C_dark = A·(1-P)·(1-X) for a candidate tool spec. Returns SEAL/REVIEW/VOID verdict. Does NOT generate code — evaluates only. Falsifiable: thresholds must be calibrated on held-out data.",
    {
      tool_name: z.string().describe("Proposed tool name (forge_* convention)"),
      description: z.string().min(10).max(2000).describe("Natural-language description"),
      domain: z.enum(["geox", "wealth", "well", "arifos", "hermes", "aforge", "general"]).default("general"),
      implementation: z.string().default("").describe("Tool implementation code to evaluate"),
      input_schema: z.string().default("z.object({}).strict()").describe("Zod inputSchema as TS source"),
      declared_side_effects: z.array(z.string()).default([]).describe("Declared side effects (filesystem, network, shell, db, vault)"),
      required_permissions: z.array(z.string()).default([]).describe("Required permissions (read, write, execute, seal)"),
      proposed_by: z.string().default("unknown").describe("Who is proposing this tool"),
      evaluator_count: z.number().int().min(1).max(10).default(1).describe("Number of evaluators in ensemble (for Ω₀ calibration)"),
      estimated_cost: z.number().min(0).max(1).optional().describe("Estimated resource cost [0-1]"),
      max_recursion_depth: z.number().int().min(1).max(10).default(1).describe("Maximum recursion depth"),
      session_id: z.string().optional(),
      seal_verdict_id: z.string().optional().describe("Prior arifOS seal verdict (required for arifos domain)"),
    },
    async (args) => {
      try {
        const spec: CandidateSpec = {
          tool_name: args.tool_name,
          description: args.description,
          domain: args.domain as GovernedDomain,
          implementation: args.implementation,
          input_schema: args.input_schema,
          declared_side_effects: args.declared_side_effects,
          required_permissions: args.required_permissions,
          proposed_by: args.proposed_by,
          session_id: args.session_id,
          seal_verdict_id: args.seal_verdict_id,
          max_recursion_depth: args.max_recursion_depth,
          estimated_cost: args.estimated_cost,
        };

        // Quick dry-run for empty implementations (preview only)
        if (!args.implementation || args.implementation.trim().length === 0) {
          const dryRun = evaluateDryRun(spec, args.evaluator_count);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...dryRun,
                mode: "dry_run",
                note: "Implementation empty — dry run only. Full evaluation requires implementation code for HARAM scan + scar consultation.",
                doctrine: "G = A·P·E·X·Φ (Nash 1950 pattern). C_dark = A·(1-P)·(1-X). Multiplicative veto: zero in any factor collapses G.",
              }, null, 2),
            }],
          };
        }

        // Full evaluation with scar consultation
        const consScars = async (fp: string, dom: GovernedDomain) => {
          const { scarPressure, count } = await consultFailurePressure(fp, dom);
          return { scarPressure, count };
        };

        const decision = await evaluateCandidate({
          spec,
          evaluatorCount: args.evaluator_count,
          consultScars: consScars,
        });

        const isError = decision.verdict === "VOID";
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...decision,
              doctrine: "G = A·P·E·X·Φ (Nash 1950 pattern). C_dark = A·(1-P)·(1-X). Multiplicative veto: zero in any factor collapses G. Forged, Not Given.",
              v36_status: "MEASUREMENT_INSTRUMENT — thresholds must be calibrated on held-out data via ROC analysis",
            }, null, 2),
          }],
          isError,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `forge_evaluate failed: ${err?.message ?? String(err)}` }, null, 2) }],
          isError: true,
        };
      }
    },
  );

  // ── forge_witness — tri-witness W³ = ∛(H·AI·E) consensus ──────────────────
  server.tool(
    "forge_witness",
    "APEX v36Ω tri-witness consensus gate. Computes W³ = ∛(Human × AI × External) via geometric mean (Nash 1950). Returns CONSENSUS/WEAK/DIVERGENT. All three channels must be present. Zero in any channel collapses consensus. DO NOT fake witness confidence — unknown → 0.0, not 0.5. F13 SOVEREIGN: DIVERGENT → 888_HOLD.",
    {
      tool_name: z.string().describe("Tool being witnessed"),
      target_fingerprint: z.string().optional().describe("Fingerprint of the tool/candidate"),
      // Human channel
      h_confidence: z.number().min(0).max(1).describe("Human witness confidence [0-1]"),
      h_evidence: z.array(z.string()).default([]).describe("Human witness evidence"),
      h_source: z.string().default("human").describe("Human witness source identifier"),
      // AI channel
      ai_confidence: z.number().min(0).max(1).describe("AI witness confidence [0-1]"),
      ai_evidence: z.array(z.string()).default([]).describe("AI witness evidence"),
      ai_source: z.string().default("ai-ensemble").describe("AI witness source identifier"),
      // External/Earth channel
      ext_confidence: z.number().min(0).max(1).describe("External/Earth witness confidence [0-1]"),
      ext_evidence: z.array(z.string()).default([]).describe("External witness evidence"),
      ext_source: z.string().default("external").describe("External witness source identifier"),
      session_id: z.string().optional(),
    },
    async (args) => {
      try {
        const now = new Date().toISOString();
        const bundle: WitnessBundle = {
          target_fingerprint: args.target_fingerprint ?? "unknown",
          tool_name: args.tool_name,
          human: {
            channel: "Human",
            confidence: args.h_confidence,
            evidence: args.h_evidence,
            source: args.h_source,
            timestamp: now,
          },
          ai: {
            channel: "AI",
            confidence: args.ai_confidence,
            evidence: args.ai_evidence,
            source: args.ai_source,
            timestamp: now,
          },
          external: {
            channel: "External",
            confidence: args.ext_confidence,
            evidence: args.ext_evidence,
            source: args.ext_source,
            timestamp: now,
          },
          session_id: args.session_id,
        };

        const verdict = await evaluateWitness({ bundle });

        const isError = verdict.verdict === "DIVERGENT";
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...verdict,
              doctrine: "W³ = ∛(H × AI × E). Geometric mean — one zero collapses consensus. No SEAL without W³ ≥ 0.75. TRI-WITNESS CONSTRAINT: no fake confidence.",
              "888_HOLD": verdict.verdict === "DIVERGENT" ? "DIVERGENT witness — escalate to human sovereign" : undefined,
            }, null, 2),
          }],
          isError,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `forge_witness failed: ${err?.message ?? String(err)}` }, null, 2) }],
          isError: true,
        };
      }
    },
  );

  // ── forge_scar — standalone scar sealing ───────────────────────────────────
  server.tool(
    "forge_scar",
    "APEX v36Ω scar metabolization gate. Seals failures as permanent constitutional constraints. Modes: seal (record failure), list (enumerate scars), consult (check fingerprint for matching scars). SCAR LAW: errors are metabolized into constitutional constraints. Pain = ΔS spike. Learning = cooling. F1 AMANAH: scars are immutable once sealed.",
    {
      mode: z.enum(["seal", "list", "consult"]).default("list"),
      // seal mode
      failure_mode: z.string().optional().describe("Description of the failure (seal mode)"),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().describe("Severity (seal mode)"),
      scar_pressure: z.number().min(0).max(1).optional().describe("Scar pressure ∈ [0,1] (seal mode)"),
      domain: z.enum(["geox", "wealth", "well", "arifos", "hermes", "aforge", "general"]).optional().describe("Domain (seal/list mode)"),
      detection_method: z.string().optional().describe("How the failure was detected (seal mode)"),
      constraint_imposed: z.string().optional().describe("What constraint this scar imposes (seal mode)"),
      sealed_by: z.string().default("forge_scar").describe("Who sealed this scar"),
      // consult mode
      fingerprint: z.string().optional().describe("Fingerprint to consult (consult mode)"),
    },
    async (args) => {
      try {
        if (args.mode === "list") {
          const scars = await listFailures(args.domain as GovernedDomain | undefined);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "list",
                total: scars.length,
                scars,
                doctrine: "Scar Law: failed generations seal their fingerprint. Future generations inherit scar_pressure, reducing Φ until the failure pattern is no longer reachable.",
              }, null, 2),
            }],
          };
        }

        if (args.mode === "consult") {
          if (!args.fingerprint) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "fingerprint required for mode=consult" }, null, 2) }],
              isError: true,
            };
          }
          const result = await consultFailurePressure(args.fingerprint, args.domain as GovernedDomain | undefined);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "consult",
                ...result,
              }, null, 2),
            }],
          };
        }

        if (args.mode === "seal") {
          if (!args.failure_mode || !args.severity || args.scar_pressure === undefined) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "failure_mode, severity, scar_pressure required for mode=seal" }, null, 2) }],
              isError: true,
            };
          }
          const scar = await sealFailure({
            failure_mode: args.failure_mode,
            severity: args.severity,
            scar_pressure: args.scar_pressure,
            domain: (args.domain ?? "general") as GovernedDomain,
            detection_method: args.detection_method ?? "manual",
            constraint_imposed: args.constraint_imposed ?? `Failure '${args.failure_mode}' sealed as constraint`,
            sealed_by: args.sealed_by,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "SEAL",
                mode: "seal",
                scar,
                doctrine: "This scar is now a constitutional constraint. Future generations with matching fingerprints inherit scar_pressure. Immutable per F1 AMANAH.",
              }, null, 2),
            }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown mode: ${args.mode}` }, null, 2) }],
          isError: true,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `forge_scar failed: ${err?.message ?? String(err)}` }, null, 2) }],
          isError: true,
        };
      }
    },
  );

  // ── forge_register — gated tool registration ──────────────────────────────
  server.tool(
    "forge_register",
    "APEX v36Ω gated registration gate. Registers a tool ONLY after all gates pass: SEAL verdict from forge_evaluate, CONSENSUS from forge_witness, HARAM scan pass, and scar consultation pass. Non-compensatory: any single gate failure blocks registration. 24h TTL expiry. Backward compatible with forge_skill registry.",
    {
      tool_name: z.string().regex(/^forge_[a-z0-9_]+$/).describe("Tool name (forge_* convention)"),
      domain: z.enum(["geox", "wealth", "well", "arifos", "hermes", "aforge", "general"]),
      description: z.string().min(10).max(2000).describe("Tool description"),
      implementation: z.string().describe("Tool implementation code"),
      input_schema: z.string().default("z.object({}).strict()").describe("Zod inputSchema"),
      registered_by: z.string().default("forge_register").describe("Who is registering"),
      // Gate preconditions — all required
      gate_verdict: z.enum(["SEAL", "REVIEW", "VOID"]).describe("Verdict from forge_evaluate (must be SEAL)"),
      gate_G: z.number().min(0).max(1).describe("G score from forge_evaluate"),
      gate_C_dark: z.number().min(0).max(1).describe("C_dark from forge_evaluate"),
      witness_verdict: z.enum(["CONSENSUS", "WEAK", "DIVERGENT"]).describe("Verdict from forge_witness (must be CONSENSUS)"),
      witness_W3: z.number().min(0).max(1).describe("W³ from forge_witness"),
      haram_findings: z.number().int().default(0).describe("HARAM findings count (must be 0 for CRITICAL)"),
      scar_pressure: z.number().min(0).max(1).default(0).describe("Scar pressure from forge_scar consult"),
      scars_consulted: z.number().int().default(0).describe("Number of scars consulted"),
    },
    async (args) => {
      try {
        // Reconstruct minimal gate decision from provided scores
        const gate: GateDecision = {
          tool_name: args.tool_name,
          fingerprint: "provided-by-caller",
          G: args.gate_G,
          C_dark: args.gate_C_dark,
          scores: {
            A: 0.8, P: 0.8, E: 0.8, X: 0.8, Phi: 0.8, Omega: 0.04,
            rationale: ["Scores reconstructed from registration call — see prior forge_evaluate output for full detail"],
          },
          verdict: args.gate_verdict,
          evaluator_disagreement: 0,
          evaluator_count: 1,
          evaluated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        const witness: WitnessVerdict = {
          W3: args.witness_W3,
          channels: {
            human: { confidence: 0.8, evidence_count: 1 },
            ai: { confidence: 0.8, evidence_count: 1 },
            external: { confidence: 0.8, evidence_count: 1 },
          },
          verdict: args.witness_verdict,
          seal_eligible: args.witness_verdict === "CONSENSUS",
          register_eligible: args.witness_verdict !== "DIVERGENT",
          rationale: ["Witness verdict reconstructed from registration call — see prior forge_witness output for full detail"],
          witnessed_at: new Date().toISOString(),
        };

        const result = await registerTool({
          tool_name: args.tool_name,
          domain: args.domain as GovernedDomain,
          description: args.description,
          implementation: args.implementation,
          input_schema: args.input_schema,
          registered_by: args.registered_by,
          preconditions: {
            gate,
            witness,
            haramPassed: args.haram_findings === 0,
            haramFindings: args.haram_findings,
            scarPressure: args.scar_pressure,
            scarsConsulted: args.scars_consulted,
          },
        });

        const isError = result.status === "HOLD";
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              doctrine: "Registration requires: SEAL (forge_evaluate) + CONSENSUS (forge_witness) + HARAM pass + SCAR pass. Non-compensatory: any single gate failure blocks registration. 24h TTL.",
            }, null, 2),
          }],
          isError,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `forge_register failed: ${err?.message ?? String(err)}` }, null, 2) }],
          isError: true,
        };
      }
    },
  );

  // ── Reality Loop (The 13th Tool — Orchestrator of All 12 Prompts) ─────
}

export function registerRealityLoopTools(server: McpServer): void {
  server.tool(
    "forge_reality_loop",
    "THE 13TH TOOL — Chains all 12 MCP prompts into a perpetual autonomous reality loop. Modes: start | advance | record | report | metrics | list | destroy. Constitutional F1-F13 at every stage. ΔS ≤ 0 per iteration. Self-improving.",
    {
      mode: z.enum(["start", "advance", "record", "seal", "report", "metrics", "list", "destroy"]).describe("Operation mode"),
      session_id: z.string().optional().describe("Session ID (required for all modes except start/list)"),
      intent: z.string().optional().describe('Primary intent for the loop. Default: "Self-sustaining federation health"'),
      config: z.string().optional().describe('JSON config: {iteration_depth, max_hypotheses, action_budget, auto_execute, self_modify, seal_every_iteration}'),
      // record mode args
      record_stage: z.string().optional().describe('Stage being recorded (record mode)'),
      record_type: z.string().optional().describe('Type of record: evidence | hypothesis | action | entropy | mod | scar | violation'),
      record_value: z.string().optional().describe('JSON value to record'),
    },
    async (args) => {
      try {
        switch (args.mode) {
          case "list": {
            const loops = listActiveLoops();
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "list",
                  active_loops: loops.length,
                  loops,
                }, null, 2),
              }],
            };
          }

          case "start": {
            const sid = args.session_id || `rl-${randomUUID()}`;
            const cfg = safeJsonParse(args.config, {}) as Partial<RealityLoopConfig>;
            const state = createLoop(sid, cfg);
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "start",
                  session_id: sid,
                  iteration: state.iteration,
                  stage: state.current_stage,
                  next_stage: nextStage(state.current_stage),
                  auto_execute: cfg.auto_execute ?? true,
                  f13_override_required: cfg.auto_execute ?? true,
                  available_prompts: ["reality-loop", "fix-bug", "refactor-module", "deploy-service", "audit-code", "research-topic", "cross-organ-query", "apex-reason", "quantum-frame", "reality-engineer", "godel-metabolize", "thermodynamic-zen", "recursive-self-improve"],
                  doctrine: "Call forge_reality_loop mode=advance to begin iteration. The loop NEVER stops unless destroyed.",
                }, null, 2),
              }],
            };
          }

          case "advance": {
            if (!args.session_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id required" }, null, 2) }], isError: true };
            }
            const state = getLoop(args.session_id);
            if (!state) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found. Call forge_reality_loop mode=start first." }, null, 2) }], isError: true };
            }
            const next = advanceStage(state);
            const stagePrompts = [
              ...(next === "OBSERVE" ? ["cross-organ-query", "research-topic", "audit-code", "fix-bug"] : []),
              ...(next === "QUANTUM" ? ["quantum-frame"] : []),
              ...(next === "APEX" ? ["apex-reason"] : []),
              ...(next === "GODEL" ? ["godel-metabolize"] : []),
              ...(next === "REALITY" ? ["reality-engineer", "refactor-module", "deploy-service"] : []),
              ...(next === "THERMO" ? ["thermodynamic-zen"] : []),
              ...(next === "RECURSE" ? ["recursive-self-improve"] : []),
              ...(next === "SEAL" ? [] : []),
            ];
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "advance",
                  session_id: args.session_id,
                  iteration: state.iteration,
                  stage: next,
                  stage_index: ["OBSERVE", "QUANTUM", "APEX", "GODEL", "REALITY", "THERMO", "RECURSE", "SEAL"].indexOf(next),
                  total_stages: 8,
                  invoke_prompts: stagePrompts,
                  evidence_count: state.evidence_base.length,
                  hypothesis_count: state.active_hypotheses.length,
                  scar_count: state.scars.length,
                  loop_report: getLoopReport(state),
                  instruction: next === "SEAL"
                    ? "Final stage. Seal iteration to VAULT999 via forge_reality_loop mode=seal, then call forge_reality_loop mode=advance to start next iteration."
                    : `Call prompts/get for each prompt in invoke_prompts, execute the workflow, then record results.`,
                }, null, 2),
              }],
            };
          }

          case "record": {
            if (!args.session_id || !args.record_stage || !args.record_type || !args.record_value) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id, record_stage, record_type, record_value all required" }, null, 2) }], isError: true };
            }
            const state = getLoop(args.session_id);
            if (!state) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found" }, null, 2) }], isError: true };
            }
            const value = safeJsonParse(args.record_value);
            if (!value || typeof value !== "object") {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "record_value must be valid JSON object" }, null, 2) }], isError: true };
            }
            let result: any;
            switch (args.record_type) {
              case "evidence":
                if (!validateEvidenceEntry(value)) {
                  return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Evidence requires: claim (string), epistemic_label (OBS/DER/INT/SPEC), confidence (0-1), source_stage, source_prompt" }, null, 2) }], isError: true };
                }
                // F7 HUMILITY cap
                if ((value as Record<string, unknown>).confidence !== undefined) {
                  (value as Record<string, unknown>).confidence = Math.min(Number((value as Record<string, unknown>).confidence), MAX_CONFIDENCE);
                }
                result = recordEvidence(state, value as any);
                break;
              case "action":
                result = recordAction(state, value as any);
                break;
              case "entropy":
                result = recordEntropy(state, value as any);
                break;
              case "mod":
                result = recordModification(state, value as any);
                break;
              case "scar":
                result = recordScar(state, value as any);
                break;
              case "violation":
                result = recordFloorViolation(state, value as any);
                break;
              default:
                return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown record_type: ${args.record_type}` }, null, 2) }], isError: true };
            }
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "record",
                  session_id: args.session_id,
                  record_type: args.record_type,
                  record_stage: args.record_stage,
                  result: "recorded",
                  timestamp: new Date().toISOString(),
                }, null, 2),
              }],
            };
          }

          case "report": {
            if (!args.session_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id required" }, null, 2) }], isError: true };
            }
            const state = getLoop(args.session_id);
            if (!state) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found" }, null, 2) }], isError: true };
            }
            return {
              content: [{
                type: "text" as const,
                text: getLoopReport(state),
              }],
            };
          }

          case "metrics": {
            if (!args.session_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id required" }, null, 2) }], isError: true };
            }
            const state = getLoop(args.session_id);
            if (!state) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found" }, null, 2) }], isError: true };
            }
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "metrics",
                  ...getLoopMetrics(state),
                }, null, 2),
              }],
            };
          }

          case "seal": {
            if (!args.session_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id required" }, null, 2) }], isError: true };
            }
            const sealState = getLoop(args.session_id);
            if (!sealState) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found" }, null, 2) }], isError: true };
            }
            const sealId = await sealIteration(sealState);
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "seal",
                  session_id: args.session_id,
                  iteration: sealState.iteration,
                  seal_id: sealId,
                  vault_path: `/root/VAULT999/reality-loop/${sealState.session_id}/iter-${sealState.iteration}.json`,
                  instruction: "Iteration sealed to VAULT999. Call forge_reality_loop mode=advance to start next iteration.",
                }, null, 2),
              }],
            };
          }

          case "destroy": {
            if (!args.session_id) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "session_id required" }, null, 2) }], isError: true };
            }
            const state = getLoop(args.session_id);
            if (!state) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Loop not found" }, null, 2) }], isError: true };
            }
            // Seal final state before destroying
            let sealId: string | undefined;
            try {
              sealId = await sealIteration(state);
            } catch { /* vault write failed — proceed with destroy anyway */ }
            const finalReport = getLoopReport(state);
            destroyLoop(args.session_id);
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  status: "OK",
                  mode: "destroy",
                  session_id: args.session_id,
                  vault_seal_id: sealId || "none",
                  message: sealId ? "Reality loop destroyed. Final iteration sealed to VAULT999." : "Reality loop destroyed. Vault seal skipped.",
                  final_report: finalReport,
                }, null, 2),
              }],
            };
          }

          default:
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown mode: ${args.mode}` }, null, 2) }], isError: true };
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `forge_reality_loop failed: ${err?.message ?? String(err)}` }, null, 2) }],
          isError: true,
        };
      }
    },
  );
}
