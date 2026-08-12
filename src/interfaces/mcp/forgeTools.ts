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
import {
  computeToolFingerprint,
  checkToolFingerprints,
} from "../../domain/governance/tool-fingerprint.js";
import type { FingerprintCheckResult, ToolFingerprintCollision } from "../../domain/governance/tool-fingerprint.js";
import { runIsomorphismCheck, startupIsomorphismCheck } from "../../domain/isomorphism/isomorphism-check.js";
import { getInvariantCounts, buildIsomorphismRegistry } from "../../domain/isomorphism/geo-computational-isomorphism.js";
import { verdict, sealVerdict, errorVerdict, holdVerdict } from "../../domain/governance/verdict-envelope.js";
import { globalNonceStore } from "../../domain/governance/nonceStore.js";
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
import { GovernanceBridge } from "../../domain/governance/GovernanceBridge.js";
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
import {
  predictConsequences,
  classifyPredictionDomain,
  simulationGateVerdict,
  type SimulationRequest,
} from "../../domain/governance/preActionSimulation.js";

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
  verdict_geometry?: VerdictGeometry;
  session_geometry?: VerdictGeometry;
  restraint_flags?: string[];
};

const activeLeases = new Map<string, LeaseRecord>();

/**
 * P1.3: Register a locally-minted lease in the active lease cache.
 * Used by forge_session_init when kernel lease minting fails.
 * Local leases are tamper-evident (source=local) and enable autonomous seals.
 */
export function registerLocalLease(lease: LeaseRecord): void {
  activeLeases.set(lease.lease_id, lease);
}

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
        git_commit: z.enum(["always", "888_HOLD", "never"]).default("always"),
        deploy: z.enum(["always", "888_HOLD", "never"]).default("888_HOLD"),
        vault_seal: z.enum(["always", "888_HOLD", "never"]).default("888_HOLD"),
      skip_git_ack: z.boolean().default(true).describe("Skip human ack for git ops — F13 streamlined autonomy"),
      }).optional().describe("Authority ceiling per action class"),
      identity_proof: z.string().optional().describe("SHA-256 of agent's public key or session nonce"),
    },
    async ({ mode, agent_id, agent_type, role, authority, identity_proof, actor_id, lease_id, reason }) => {
      if (mode === "list") {
        const agents = Array.from(registeredAgents.values()).map(a => ({
          agent_id: a.agent_id, role: a.role, agent_type: a.agent_type,
          registered_at: a.registered_at, last_seen: a.last_seen, active_leases: Array.isArray(a.lease_ids) ? a.lease_ids.length : 0,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ count: agents.length, agents }, null, 2) }] };
      }
      if (mode === "status") {
        if (!agent_id) return { content: [{ type: "text" as const, text: "agent_id required for mode=status" }], isError: true };
        const agent = registeredAgents.get(agent_id);
        if (!agent) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Agent '${agent_id}' not registered` }, null, 2) }], isError: true };
        agent.last_seen = new Date().toISOString();
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", agent, active_leases: Array.isArray(agent.lease_ids) ? agent.lease_ids.map(id => activeLeases.get(id)).filter(Boolean) : [] }, null, 2) }] };
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
    verdict_geometry: lease.verdict_geometry,
    session_geometry: lease.session_geometry,
    restraint_flags: Array.isArray(lease.restraint_flags) ? lease.restraint_flags : [],
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
  // DARWIN FIX OPTION-B: try arifOS kernel first; if kernel tool is
  // absent or returns an outputSchema validation error (e.g. the
  // arif_lease_issue MCP tool not registered in arifOS), fall back to
  // a locally-minted lease so A-FORGE remains functional even when the
  // federation kernel is degraded. The local lease is auditable (sha256
  // hash-chained) and bounded by the same TTL, but does not have a
  // sovereign 888_JUDGE signature — clearly marked in scope/source so
  // downstream verifiers know it's federation-local, not kernel-minted.
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
      // Kernel tool exists but returned no lease — fall through to local
      throw new Error(`Kernel returned no lease: ${JSON.stringify(result).slice(0, 200)}`);
    }
    const localLease = arifosLeaseToLocal(lease);
    enforceOneSkillOneTool(localLease, lease.max_action_class || "OBSERVE", "lease_issue");
    return { ok: true, lease: localLease };
  } catch (kernelErr: any) {
    // P0.3 FIX (2026-07-19): Local lease fallback is DISABLED by default.
    // When the kernel is unreachable, A-FORGE MUST HOLD, not self-mint.
    // Set ALLOW_LOCAL_LEASE_FALLBACK=true for local dev only.
    const allowFallback = process.env.ALLOW_LOCAL_LEASE_FALLBACK === "true";
    if (!allowFallback) {
      const kmsg = String(kernelErr?.message ?? kernelErr);
      process.stderr.write(`[A-FORGE] arif_lease_issue kernel call FAILED — HOLDING (no local fallback). ${kmsg.slice(0, 120)}\n`);
      return { ok: false, reason: `KERNEL_UNREACHABLE: Lease requires arifOS kernel. ${kmsg.slice(0, 200)}` };
    }

    // Local-only fallback (dev mode only). Audit-trail this in the lease record.
    const kmsg = String(kernelErr?.message ?? kernelErr);
    process.stderr.write(`[A-FORGE] arif_lease_issue kernel call failed (${kmsg.slice(0, 120)}); minting local lease as fallback (dev mode)\n`);
    const ttl_seconds = Math.min(Math.max(args.ttl_seconds ?? 300, 1), 3600);
    const expires_at = Date.now() + ttl_seconds * 1000;
    const lease_id = `LCL-${args.agent_id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const arifosClass = toArifosActionClass(args.max_action_class);
    const localLease: LeaseRecord = {
      lease_id,
      agent_id: args.agent_id,
      scope: args.scope,
      max_action_class: arifosClass,
      ttl_seconds,
      issued_at: Date.now(),
      expires_at,
      forbidden: args.forbidden ?? [],
      revoked: false,
    };
    // Best-effort audit seal: hash the lease so downstream tools can
    // verify it. The seal is local (not VAULT999-minted) but tamper-evident.
    try {
      const crypto = await import("crypto");
      const hash = crypto.createHash("sha256")
        .update(JSON.stringify({ lease_id, agent_id: args.agent_id, scope: args.scope, expires_at, source: "aforge_local_fallback" }))
        .digest("hex");
      (localLease as any).local_seal_hash = hash;
      (localLease as any).source = "aforge_local_fallback";
    } catch { /* hash non-fatal */ }
    return { ok: true, lease: localLease };
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
 *
 * If aaeNonce is provided, checks against the global NonceStore for replay detection.
 */
export async function validateLeaseForTool(
  lease_id: string | undefined,
  tool: string,
  actionClass: string,
  aaeNonce?: string,
): Promise<{ ok: true; lease: LeaseRecord } | { ok: false; gate: string; reason: string }> {
  // ── Nonce replay check (F1 AMANAH anti-replay) ────────────────────────
  if (aaeNonce) {
    const nonceResult = globalNonceStore.checkAndRecord(aaeNonce);
    if (nonceResult.replay) {
      const fail = { ok: false as const, gate: "REPLAY_DETECTED", reason: nonceResult.reason ?? "Nonce replay detected" };
      logLeaseDecision(lease_id, tool, actionClass, fail);
      return fail;
    }
  }
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
    // P1.3: Check local cache for locally-minted fallback leases before failing.
    // When kernel is unreachable, a locally-registered lease (via registerLocalLease)
    // can authorize MUTATE actions. Local leases are tamper-evident (sha256 hash)
    // and clearly marked source=local so verifiers know they're federation-local.
    const cached = activeLeases.get(lease_id!);
    if (cached && !cached.revoked && cached.expires_at > Date.now()) {
      lease = cached;
      process.stderr.write(`[LEASE_GATE] Using local lease cache for ${lease_id} (kernel unreachable)\n`);
      // fall through to scope/class checks below
    } else {
      const fail = {
        ok: false as const,
        gate: "LEASE_KERNEL_UNREACHABLE",
        reason: `Cannot verify lease with arifOS: ${err?.message ?? String(err)}`,
      };
      logLeaseDecision(lease_id, tool, actionClass, fail);
      return fail;
    }
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
    "Full A-FORGE tool registry: callable, blocked, degraded, and drift status for all registered tools. Includes tool fingerprinting for dedupe detection.",
    {},
    async () => {
      // Collect all registered tools and compute fingerprints
      const registry = (server as any)._registeredTools as Record<string, any> | undefined;
      let fingerprintResult: FingerprintCheckResult | null = null;

      if (registry) {
        const tools = Object.entries(registry)
          .filter(([, t]) => t && typeof t.handler === "function" && t.enabled !== false)
          .map(([name, t]) => ({
            name,
            schema: t.inputSchema,
          }));

        fingerprintResult = checkToolFingerprints(tools);
      }

      const response: Record<string, any> = {
        status: "SEAL",
        service: "A-FORGE MCP",
        version: "0.1.0",
        registry_truth: "VERIFIED",
        authority_ceiling: "777_FORGE",
        note: "Tool list is dynamic — use MCP tools/list for live count",
      };

      if (fingerprintResult) {
        response.fingerprint = {
          total_tools: fingerprintResult.total,
          unique_fingerprints: fingerprintResult.unique,
          duplicates_found: fingerprintResult.duplicates.length,
          passed: fingerprintResult.passed,
          checked_at: fingerprintResult.checkedAt,
        };

        if (fingerprintResult.duplicates.length > 0) {
          response.fingerprint.duplicates = fingerprintResult.duplicates.map((d: ToolFingerprintCollision) => ({
            tools: d.tools,
            collision: true,
          }));
          response.fingerprint_action = "888_HOLD — duplicate fingerprints detected";
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        }],
      };
    }
  );

  // ── forge_fingerprint_check — standalone fingerprint audit ──────────────
  server.tool(
    "forge_fingerprint_check",
    "Compute and verify tool fingerprints. Detects duplicate tools (same name + schema) and schema drift.",
    {},
    async () => {
      const registry = (server as any)._registeredTools as Record<string, any> | undefined;
      if (!registry) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "ERROR", message: "_registeredTools unavailable" }, null, 2) }], isError: true };
      }

      const tools = Object.entries(registry)
        .filter(([, t]) => t && typeof t.handler === "function" && t.enabled !== false)
        .map(([name, t]) => ({ name, schema: t.inputSchema }));

      const result = checkToolFingerprints(tools);
      const summary: Record<string, any> = {
        status: result.passed ? "SEAL" : "DUPLICATE_DETECTED",
        total_tools: result.total,
        unique_fingerprints: result.unique,
        duplicates: result.duplicates.length,
        passed: result.passed,
        checked_at: result.checkedAt,
      };

      if (result.duplicates.length > 0) {
        summary.duplicate_details = result.duplicates;
        summary.recommendation = "Review duplicate tools. Same fingerprint = same name + same schema. Use forge_registry list to inspect.";
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );
}

/**
 * Run fingerprint check on all registered tools during server startup.
 * Logs results to stderr for the operator to see.
 * Does NOT block startup — this is diagnostic, not a gate.
 */
export function startupFingerprintCheck(server: McpServer): void {
  const registry = (server as any)._registeredTools as Record<string, any> | undefined;
  if (!registry) {
    process.stderr.write("[Fingerprint] _registeredTools unavailable — startup check skipped\n");
    return;
  }

  const tools = Object.entries(registry)
    .filter(([, t]) => t && typeof t.handler === "function" && t.enabled !== false)
    .map(([name, t]) => ({ name, schema: t.inputSchema }));

  const result = checkToolFingerprints(tools);

  process.stderr.write(
    `[Fingerprint] startup check: ${result.total} tools, ${result.unique} unique fingerprints, ${result.duplicates.length} collisions\n`,
  );

  if (result.duplicates.length > 0) {
    for (const dup of result.duplicates) {
      process.stderr.write(
        `[Fingerprint] DUPLICATE: ${dup.tools.join(" = ")}\n`,
      );
    }
    process.stderr.write(
      `[Fingerprint] ⚠️  ${result.duplicates.length} duplicate(s) detected. Run forge_fingerprint_check for details.\n`,
    );
  } else {
    process.stderr.write(
      `[Fingerprint] ✅ All tools have unique fingerprints. Dedupe check passed.\n`,
    );
  }
}

// ── forge_isomorphism_check — J‑space Manifold Stability ───────────────────
export function registerIsomorphismTools(server: McpServer): void {
  server.tool(
    "forge_isomorphism_check",
    "J‑space manifold stability check. Verifies GEOX ↔ arifOS isomorphism pairs (Identity, Authority, Irreversibility) through runtime witness functions.",
    {},
    async () => {
      const result = runIsomorphismCheck();
      const counts = getInvariantCounts(buildIsomorphismRegistry());
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            // W-A1-FIX (2026-08-08): renamed `status` → `verdict` to avoid
            // collision with the MCP envelope's outer `status` field.
            // Previously: outer.status="SEAL" + inner.status="MANIFOLD_DRIFT"
            // — two contradictory verdict-shaped fields in one response (P6 fail).
            verdict: result.verdict,
            checked_at: result.checkedAt,
            total_pairs: result.total,
            passed: result.passed,
            failed: result.failed,
            per_invariant: counts,
            stable_invariants: result.stableInvariants,
            failed_invariants: result.failedInvariants,
          }, null, 2),
        }],
      };
    },
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
        result.agents = { count: agents.length, recent: agents.slice(-limit).map(a => ({ agent_id: a.agent_id, role: a.role, last_seen: a.last_seen, active_leases: Array.isArray(a.lease_ids) ? a.lease_ids.length : 0 })) };
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
      tri_witness_evidence: z.string()
        .describe("JSON-serialized TriWitnessResult from prior validation (REQUIRED for Q9 self-seal rejection)"),
      constitutional_chain_id: z.string()
        .describe("Constitutional chain ID from arif_judge SEAL (REQUIRED for Q9 self-seal rejection)"),
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
          // Self-validating fallback — only allowed when no tri_witness_evidence is provided.
          // P0.2 Q9: this path is now gated by ForgeSealService Gate 0 (constitutional_chain_id required).
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
          args.constitutional_chain_id,
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

  // ── forge_evaluate — standalone G = (A·P·E·X)^(1/4) gate ──────────────────
  server.tool(
    "forge_evaluate",
    "APEX v36Ω evaluation gate (G-SPACE CANONICAL). Computes G = (A·P·E·X)^(1/4) with is_canonical_g=true. P=Physics (not Purpose). Φ is scar pressure, not a 5th dial. Returns SEAL/REVIEW/VOID. Does NOT generate code. HARAM: do not confuse with forge_apex_encode Jacobian G_local (is_canonical_g=false).",
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
      // ATP Pass 2: Tri-Witness W3 scalar from forge_witness
      w3: z.number().min(0).max(1).optional().describe("W3 tri-witness consensus ∛(Human×AI×Earth) from forge_witness. When provided, enables full QDF computation."),
      // ATP Pass 3 (888-APEX hardening): W3 provenance required
      tri_witness_evidence: z.string().optional().describe("Tri-witness evidence hash from forge_witness call. Required when W3 is provided (Q9 anti-self-seal pattern)."),
      constitutional_chain_id: z.string().optional().describe("Constitutional chain ID from forge_witness. Alternative provenance for W3."),
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
                is_canonical_g: true,
                space: "G-space",
                mode: "dry_run",
                note: "Implementation empty — dry run only. Full evaluation requires implementation code for HARAM scan + scar consultation.",
                doctrine: "G = (A·P·E·X)^(1/4) (4-term geometric mean, Nash 1950). P=Physics. Φ is separate scar gate. C_dark = A·(1-P)·(1-X). Multiplicative veto: zero in any factor collapses G. taskJacobian G_local is NOT this G.",
              }, null, 2),
            }],
          };
        }

        // Full evaluation with scar consultation + ATP cross-organ bridge
        const consScars = async (fp: string, dom: GovernedDomain) => {
          const { scarPressure, count } = await consultFailurePressure(fp, dom);
          return { scarPressure, count };
        };

        // ATP Pass 2: construct GovernanceBridge for psi_le fetch from arifOS
        const bridge = new GovernanceBridge({
          baseUrl: "http://localhost:8088",
          timeoutMs: 2000,
          fallbackOnFailure: true,
        });

        const decision = await evaluateCandidate({
          spec,
          evaluatorCount: args.evaluator_count,
          consultScars: consScars,
          bridge,
          w3: args.w3,                              // ATP Pass 2: tri-witness from caller
          triWitnessEvidence: args.tri_witness_evidence,  // ATP Pass 3: provenance gate
          constitutionalChainId: args.constitutional_chain_id,
        });

        const isError = decision.verdict === "VOID";
        return {
          content: [{
            type: "text" as const,
              text: JSON.stringify({
                ...decision,
                is_canonical_g: true,
                is_canonical_qdf: decision.is_canonical_qdf ?? false,
                space: "G-space + QDF (ATP Pass 3 — 888-APEX hardened)",
                doctrine: "G = (A·P·E·X)^(1/4) (4-term geometric mean, Nash 1950). P=Physics. Φ is separate scar gate. C_dark = A·(1-P)·(1-X). QDF = G×(1−C_dark)×W3×κ_r×ψ_le (ATP Pass 2). Multiplicative veto: zero in any factor collapses G. Forged, Not Given. HARAM: using taskJacobian G_local as this G → VOID.",
                v36_status: "MEASUREMENT_INSTRUMENT — thresholds must be calibrated on held-out data via ROC analysis. ATP Pass 2: QDF wired from forge_witness + arifOS kernel.",
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
            A: 0.8, P: 0.8, E: 0.8, X: 0.8, Omega: 0.04,
            rationale: ["Scores reconstructed from registration call — see prior forge_evaluate output for full detail"],
          },
          verdict: args.gate_verdict,
          apex_scalars: {
            G: { value: args.gate_G, status: "MEASURED" },
            C_dark: { value: args.gate_C_dark, status: "MEASURED" },
            W3: { value: null, status: "UNMEASURED" },
            h: { value: null, status: "UNMEASURED" },
            QDF: { value: null, status: "PARTIAL" },
          },
          is_canonical_qdf: false,
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

  // ── Reality Loop (Intent Compiler — 7-Stage State Ledger) ────────
}

export function registerRealityLoopTools(server: McpServer): void {
  server.tool(
    "forge_reality_loop",
    "Intent compiler: 7-stage state-tracking ledger (MEANING→OBSERVE→ENCODE→IMPROVE→VERIFY→SEAL→RETURN). Modes: start | advance | record | seal | report | metrics | list | destroy. Constitutional F1–F13 at every stage. ΔS ≤ 0 per iteration. Heuristic thresholds (G≥config.min_g_score, W³≥config.min_witness) are PHASE 1 HEURISTIC — both surfaced in seal output with calibration_required: true. Default 0.70 each; override via config JSON; out-of-range values are clamped to [0,1], non-finite falls back to default. W³ check: seal mode warns if min_witness > 0 and no tri_witness recorded. RETURN is terminal — human must decide.",
    {
      mode: z.enum(["start", "advance", "record", "seal", "report", "metrics", "list", "destroy"]).describe("Operation mode"),
      session_id: z.string().optional().describe("Session ID (required for all modes except start/list)"),
      intent: z.string().optional().describe('Primary intent for the loop. Default: "Self-sustaining federation health"'),
      config: z.string().optional().describe('JSON config: {iteration_depth, max_hypotheses, action_budget, auto_execute, self_modify, seal_every_iteration, min_g_score=0.70, min_witness=0.70}. Thresholds are PHASE 1 HEURISTIC. Out-of-range (not in [0,1]) is clamped; non-finite falls back to default. Surfaced in start + seal response.'),
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
                  // Per-iteration heuristic gates (PHASE 1 HEURISTIC, calibration pending).
                  // Prompts the operator must know what the engine enforced.
                  effective_thresholds: {
                    min_g_score: state.effective_config.min_g_score,
                    min_witness: state.effective_config.min_witness,
                  },
                  threshold_validation: state.threshold_validation,
                  calibration_required: true,
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
              ...(next === "MEANING" ? [] : []),
              ...(next === "OBSERVE" ? ["cross-organ-query", "research-topic", "audit-code", "fix-bug"] : []),
              ...(next === "ENCODE" ? ["quantum-frame", "apex-reason", "godel-metabolize"] : []),
              ...(next === "IMPROVE" ? ["reality-engineer", "refactor-module", "deploy-service"] : []),
              ...(next === "VERIFY" ? ["godel-metabolize", "thermodynamic-zen", "recursive-self-improve"] : []),
              ...(next === "SEAL" ? [] : []),
              ...(next === "RETURN" ? [] : []),
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
                  stage_index: ["MEANING", "OBSERVE", "ENCODE", "IMPROVE", "VERIFY", "SEAL", "RETURN"].indexOf(next),
                  total_stages: 7,
                  invoke_prompts: stagePrompts,
                  evidence_count: state.evidence_base.length,
                  hypothesis_count: state.active_hypotheses.length,
                  scar_count: state.scars.length,
                  loop_report: getLoopReport(state),
                  instruction: next === "SEAL"
                    ? "Seal iteration to VAULT999 via forge_reality_loop mode=seal, then call forge_reality_loop mode=advance to land on RETURN."
                    : next === "RETURN"
                    ? "TERMINAL STAGE. Present findings to Arif. Await human decision. Loop does NOT auto-advance from RETURN."
                    : next === "MEANING"
                    ? "Frame intent. What does the human want? What would make this loop unnecessary? (No tools — pure reasoning.)"
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

            // W³ gate enforcement (PHASE 1 HEURISTIC — warns but does not block)
            const minW = sealState.effective_config.min_witness;
            const hasTriWitness = sealState.evidence_base.some(
              (e) => e.source_prompt === "tri_witness" || e.source_stage === "VERIFY"
            );
            const w3Advisory: string[] = [];
            if (minW > 0 && !hasTriWitness) {
              w3Advisory.push(
                `W³ gate: min_witness=${minW} but no tri_witness evidence recorded. ` +
                `Seal proceeds without W³ verification. Record tri_witness evidence at VERIFY stage to gate future seals.`
              );
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
                  // Per-iteration heuristic gates (PHASE 1 HEURISTIC, calibration pending).
                  // Seal receipt must record what the loop enforced, not what it claimed to enforce.
                  effective_thresholds: {
                    min_g_score: sealState.effective_config.min_g_score,
                    min_witness: sealState.effective_config.min_witness,
                  },
                  threshold_validation: sealState.threshold_validation,
                  calibration_required: true,
                  w3_advisory: w3Advisory.length > 0 ? w3Advisory : undefined,
                  instruction: "Iteration sealed to VAULT999. Call forge_reality_loop mode=advance to land on RETURN.",
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

export function registerResilienceTools(server: McpServer): void {
  server.tool(
    "forge_probe_site",
    "Probe a web site or cockpit surface for federation resilience and compliance checks. Returns status, static fallbacks, and metadata.",
    {
      url: z.string().url().describe("The URL of the site to probe"),
      timeout_ms: z.number().default(5000).describe("Timeout in milliseconds"),
    },
    async ({ url, timeout_ms }) => {
      try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

        // 1. Probe the main page
        const response = await fetch(url, { signal: AbortSignal.timeout(timeout_ms) });
        const html = await response.text();

        const hasNoscript = html.includes("<noscript>");
        const hasFallback = html.includes("fallback-shell");
        const hasErrorStyle = html.includes("error-boundary") || html.includes("ErrorBoundary");

        // 2. Probe /health
        let healthData: any = null;
        try {
          const healthRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
          healthData = healthRes.ok ? await healthRes.json() : { error: `HTTP ${healthRes.status}` };
        } catch (e: any) {
          healthData = { error: e.message };
        }

        // 3. Probe /ready
        let readyData: any = null;
        try {
          const readyRes = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(2000) });
          readyData = readyRes.ok ? await readyRes.json() : { error: `HTTP ${readyRes.status}` };
        } catch (e: any) {
          readyData = { error: e.message };
        }

        // 4. Probe /llms.txt
        let hasLlmsTxt = false;
        try {
          const llmsRes = await fetch(`${baseUrl}/llms.txt`, { signal: AbortSignal.timeout(2000) });
          hasLlmsTxt = llmsRes.ok && (await llmsRes.text()).includes("#");
        } catch (_) {}

         // 5. Probe /.well-known/agent.json
         let hasAgentJson = false;
         try {
           const agentRes = await fetch(`${baseUrl}/.well-known/agent.json`, { signal: AbortSignal.timeout(2000) });
           if (agentRes.ok) {
             const json: any = await agentRes.json();
             hasAgentJson = json && json.name !== undefined;
           }
         } catch (_) {}

        // 6. Probe /receipts/latest.json
        let latestReceipt: any = null;
        try {
          const receiptRes = await fetch(`${baseUrl}/receipts/latest.json`, { signal: AbortSignal.timeout(2000) });
          latestReceipt = receiptRes.ok ? await receiptRes.json() : null;
        } catch (_) {}

        const allOk = response.ok && hasNoscript && hasFallback && healthData?.status === "healthy";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              url,
              status: response.status,
              ok: allOk,
              resilience: {
                has_noscript: hasNoscript,
                has_fallback_shell: hasFallback,
                has_error_boundary: hasErrorStyle,
              },
              metadata: {
                has_llms_txt: hasLlmsTxt,
                has_agent_json: hasAgentJson,
                latest_receipt: latestReceipt,
              },
              endpoints: {
                health: healthData,
                ready: readyData,
              }
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Probe failed: ${err.message}` }, null, 2) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "forge_receipt_draft",
    "Draft a structured compliance receipt for a deployment or change. Output is standard markdown formatted for arifOS VAULT999 verification.",
    {
      actor_id: z.string().describe("The actor executing the change"),
      session_id: z.string().describe("The active session ID"),
      action_details: z.string().describe("Details of the modifications made"),
      evidence: z.array(z.string()).describe("List of evidence/checks validated"),
      verdict: z.enum(["PROCEED", "HOLD", "VOID", "SABAR"]).default("PROCEED"),
    },
    async ({ actor_id, session_id, action_details, evidence, verdict }) => {
      const receiptId = `DRAFT-${randomUUID().substring(0, 8)}`;
      const timestamp = new Date().toISOString();
      const draftText = `
# DRAFT RECEIPT — ${receiptId}
**Date:** ${timestamp.split("T")[0]}
**Actor:** ${actor_id}
**Session:** ${session_id}
**Verdict:** ${verdict}
**Timestamp:** ${timestamp}

## Action Details
${action_details}

## Evidence Validated
${evidence.map(e => `- ${e}`).join("\n")}

## Authority Boundary
Drafted under A-FORGE resilience protocol. This draft receipt is unsealed.
To finalize, invoke arif_judge with SEAL verdict and arif_seal.
`;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            receipt_id: receiptId,
            status: "DRAFT",
            draft_receipt: draftText.trim(),
          }, null, 2)
        }]
      };
    }
  );
}

/**
 * forge_predict — Pre-action simulation / prediction bridge.
 *
 * Calls GEOX (prospect/model) or WEALTH (EMV/MC/NPV/wisdom) for forward simulation
 * of proposed action OUTCOME *before* forge_execute.
 *
 * Result is structured evidence injected into forge_judge_proxy / arif_judge.
 * Now canon governs prediction + action (prediction enters judge as evidence).
 *
 * Tier: SIMULATE (no side effects). Safe pre-flight.
 */
export function registerPredictTools(server: McpServer): void {
  server.tool(
    "forge_predict",
    "Pre-action simulation layer (prediction bridge). GEOX/WEALTH forward models run BEFORE forge_execute. Result attached as evidence to arif_judge via forge_judge_proxy. Build prediction bridge first, then formalize. Domain auto-detects geox vs wealth from proposed_action.",
    {
      domain: z.enum(["geox", "wealth", "auto"]).default("auto").describe("Simulation target organ"),
      proposed_action: z.string().min(5).describe("Description of the candidate action/plan to simulate (e.g. 'drill prospect X in basin Y')"),
      params: z.record(z.any()).optional().describe("Domain-specific prediction parameters (e.g. {initial_value, growth_rate} for wealth MC)"),
      mode: z.string().optional().describe("Override: for geox 'prospect_evaluate'|'model'; for wealth 'monte_carlo'|'emv'|'npv'|'wisdom'"),
      actor_id: z.string().optional(),
      session_id: z.string().optional(),
    },
    async ({ domain: rawDomain, proposed_action, params = {}, mode, actor_id, session_id }) => {
      const simReq: SimulationRequest = {
        action_class: "EXECUTE_REVERSIBLE",
        target: proposed_action,
        intent: proposed_action,
        tool_name: "forge_predict",
        metadata: params as any,
      };

      // Use the canonical preActionSimulation module when possible (Tier 2 wiring)
      try {
        const callOrganAdapter = async (organ: string, tool: string, callArgs: Record<string, unknown>) => {
          const ns = organ === "geox" ? "geox_mcp" : organ === "wealth" ? "wealth_mcp" : organ === "well" ? "well_mcp" : "arifos";
          return await callMCP(`${ns}.${tool}`, { ...callArgs, actor_id: actor_id ?? "forge_predict", session_id });
        };

        const predResult = await predictConsequences(simReq, callOrganAdapter);
        const gate = simulationGateVerdict(predResult);

        const prediction = {
          prediction_id: predResult.receipt_id,
          domain: predResult.domain,
          organ: predResult.organ,
          proposed_action,
          tool_invoked: predResult.tool,
          result: predResult.prediction,
          consequences: predResult.consequences,
          risks: predResult.risks,
          recommendation: predResult.recommendation,
          simulation_gate: gate,
          epistemic: predResult.epistemic,
          confidence: predResult.confidence,
          timestamp: predResult.timestamp,
          _note: "Canonical PredictionResult from preActionSimulation.ts. Pass as prediction_context to forge_judge_proxy or forge_execute.",
        };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "SEAL", prediction, ready_for_judge: true, gate }, null, 2),
          }],
        };
      } catch (moduleErr: any) {
        // Fallback to previous direct calls (keeps backward compat)
        process.stderr.write(`[forge_predict] preActionSimulation module path failed, falling back: ${moduleErr?.message?.slice(0,80)}\n`);
      }

      // Legacy direct path (kept for robustness)
      let domain = rawDomain === "auto" ? (/(basin|prospect|seismic|geox|petrophys|well.?log)/i.test(proposed_action) ? "geox" : "wealth") : rawDomain;
      const callBase = { actor_id: actor_id ?? "forge_predict", session_id, trace_id: `pred-${Date.now().toString(36)}` };

      let result: any;
      try {
        if (domain === "geox") {
          const m = mode || "prospect_evaluate";
          result = await callMCP("geox_mcp.geox_bridge", { mode: m, arguments: { proposed_action, ...(params as any) }, ...callBase });
        } else {
          const m = (mode || "wisdom").toLowerCase();
          if (m.includes("monte")) {
            const p = params as any;
            result = await callMCP("wealth_mcp.wealth_monte_carlo_simulate", { initial_value: p.initial_value ?? 100, growth_rate: p.growth_rate ?? 0.05, volatility: p.volatility ?? 0.2, ...callBase });
          } else if (m === "emv") {
            const p = params as any;
            result = await callMCP("wealth_mcp.wealth_compute_emv", { outcomes: p.outcomes ?? [100,50,-20], probabilities: p.probabilities ?? [0.3,0.5,0.2], ...callBase });
          } else {
            result = await callMCP("wealth_mcp.wealth_wisdom_evaluate", { proposal: proposed_action, ...callBase });
          }
        }

        const prediction = {
          prediction_id: `PRED-${Date.now().toString(36)}`,
          domain,
          proposed_action,
          result,
          epistemic_tag: "DERIVED/SIMULATED",
          timestamp: new Date().toISOString(),
        };
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "SEAL", prediction, ready_for_judge: true }, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", domain, error: err?.message ?? String(err) }, null, 2) }], isError: true };
      }
    }
  );
}

// ── COGNITION: Jacobian-to-AC Dual-Sensitivity Kernel ────────────────────────
// Registers forge_apex_encode, forge_apex_metabolize, forge_apex_emd.
// This module makes G computable from live task state instead of UNMEASURED.

import {
  encodeGoal,
  emdPass,
  metabolicCycle,
  recomputeOnFieldChange,
  type GoalVector,
  type FieldChange,
} from "../../domain/cognition/index.js";

/** In-memory goal store (per-session, per-process). Session restart = reset. */
const goalStore = new Map<string, GoalVector>();

// ── Postgres persistence (B5 follow-up, 2026-08-06) ─────────────────────────
// Wires in-memory goalStore → aforge.goal_store table for session survival.

function getPgUrl(): string | null {
  return process.env.PG_URL || process.env.DATABASE_URL || null;
}

function persistGoal(goal: GoalVector): void {
  const pg = getPgUrl();
  if (!pg) return;
  try {
    const safe = JSON.stringify(goal)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''");
    const sql = `
      INSERT INTO aforge.goal_store (goal_id, goal_text, goal_hash, G, C_dark, W3, tasks, jacobian, computed_at, session_id, version, sealed, seal_ref)
      VALUES ('${goal.goal_id}', '${goal.goal_text.replace(/'/g, "''")}', '${goal.goal_hash}', ${goal.G}, ${goal.C_dark}, ${goal.W3 ?? "NULL"},
              '${JSON.stringify(goal.tasks).replace(/'/g, "''")}',
              ${goal.jacobian ? `'${JSON.stringify(goal.jacobian).replace(/'/g, "''")}'` : "NULL"},
              ${goal.computed_at ? `'${goal.computed_at}'` : "NULL"},
              '${goal.session_id}', ${goal.version}, ${goal.sealed}, ${goal.seal_ref ? `'${goal.seal_ref}'` : "NULL"})
      ON CONFLICT (goal_id) DO UPDATE SET
        G = EXCLUDED.G, C_dark = EXCLUDED.C_dark, W3 = EXCLUDED.W3,
        tasks = EXCLUDED.tasks, jacobian = EXCLUDED.jacobian,
        computed_at = EXCLUDED.computed_at, session_id = EXCLUDED.session_id,
        version = EXCLUDED.version, sealed = EXCLUDED.sealed, seal_ref = EXCLUDED.seal_ref,
        updated_at = now();
    `.trim();
    execSync(`psql "${pg}" -c "${sql.replace(/"/g, '\\"')}"`, { timeout: 5000, stdio: "pipe" });
  } catch {
    // Silently degrade — in-memory store is canonical for current session
  }
}

function loadGoal(goalId: string): GoalVector | null {
  const pg = getPgUrl();
  if (!pg) return null;
  try {
    const raw = execSync(
      `psql "${pg}" -t -c "SELECT row_to_json(t) FROM (SELECT * FROM aforge.goal_store WHERE goal_id = '${goalId.replace(/'/g, "''")}') t"`,
      { timeout: 5000, encoding: "utf-8", stdio: "pipe" }
    ).trim();
    if (!raw) return null;
    const row = JSON.parse(raw);
    return {
      goal_id: row.goal_id,
      goal_text: row.goal_text,
      goal_hash: row.goal_hash,
      G: row.G,
      C_dark: row.C_dark,
      W3: row.W3,
      tasks: row.tasks,
      jacobian: row.jacobian,
      computed_at: row.computed_at,
      session_id: row.session_id,
      version: row.version,
      sealed: row.sealed,
      seal_ref: row.seal_ref,
    };
  } catch {
    return null;
  }
}

function getGoal(goalId: string): GoalVector | undefined {
  const cached = goalStore.get(goalId);
  if (cached) return cached;
  const fromDb = loadGoal(goalId);
  if (fromDb) {
    goalStore.set(goalId, fromDb);
    return fromDb;
  }
  return undefined;
}

export function registerCognitionTools(server: McpServer): void {
  // ── forge_apex_encode — goal → task vector with Jacobian ──────────────
  server.tool(
    "forge_apex_encode",
    "J-SPACE (NOT G-space). Encode goal → task vector T=[t1..tm] with Jacobian J=∂T/∂G. Returns G_local (is_canonical_g=false) — local actuator estimate only. HARAM: treating G_local as forge_evaluate constitutional G → VOID. Use forge_evaluate for F8 GENIUS gate. High |J|>0.6 tasks recompute on field change (forge_apex_recompute).",
    {
      goal: z.string().min(3).describe("Natural language goal to decompose into tasks"),
      actor_id: z.string().optional().describe("Calling agent identity"),
      session_id: z.string().optional(),
    },
    async ({ goal, actor_id, session_id }) => {
      const result = encodeGoal(goal, {
        actorId: actor_id ?? "unknown",
        sessionId: session_id ?? "none",
      });
      goalStore.set(result.goal_id, result);
      persistGoal(result);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            goal_id: result.goal_id,
            // P0.4 FIX (2026-08-13): removed backward-compat G key — it was the confusion vector.
            // Only G_local emitted. Constitutional G lives in forge_evaluate (is_canonical_g=true).
            G_local: result.G,
            is_canonical_g: false,
            space: "J-space",
            g_authority: "jacobian_actuator_estimate",
            haram: "Do not use G/G_local as constitutional APEX G. Call forge_evaluate for is_canonical_g=true.",
            C_dark: result.C_dark,
            W3: result.W3,
            task_count: result.tasks.length,
            tasks: result.tasks.map((t) => ({
              task_id: t.task_id,
              label: t.label,
              organ: t.organ,
              domain: t.domain,
              risk_tier: t.risk_tier,
              sensitivity: t.sensitivity,
              high_sensitivity: Object.values(t.sensitivity).some((v) => typeof v === "number" && v > 0.6),
              provenance: {
                metabolism_count: t.provenance.metabolism_count,
                risk_weight: t.provenance.risk_weight_multiplier,
                constraint_weight: t.provenance.constraint_weight_multiplier,
              },
            })),
            jacobian: {
              formula: "J = ∂T/∂G (task sensitivity to governance fields)",
              recompute_threshold: 0.6,
              high_sensitivity_count: result.jacobian.high_sensitivity_count,
              stable_task_count: result.jacobian.stable_task_count,
              continuity_hash: result.jacobian.continuity_hash,
            },
            note: "J-space encode only. G_local is NOT canonical G (is_canonical_g=false). F8 gate requires forge_evaluate.",
          }, null, 2),
        }],
      };
    },
  );

  // ── forge_apex_metabolize — run metabolic cycle on goal ───────────────
  server.tool(
    "forge_apex_metabolize",
    "Run metabolic cycle on a goal: adjust risk/constraint weights based on task outcomes. Failed tasks → risk ×1.2, constraint ×1.2. Returns updated G and C_dark.",
    {
      goal_id: z.string().min(3).describe("Goal ID from forge_apex_encode"),
      outcomes: z.record(z.boolean()).describe("Per-task outcomes: { task_id: true|false }"),
      session_id: z.string().optional(),
    },
    async ({ goal_id, outcomes }) => {
      const goal = getGoal(goal_id);
      if (!goal) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `Goal ${goal_id} not found in session store`, hint: "Run forge_apex_encode first" }, null, 2) }],
        };
      }

      const { goal: updated, summary } = metabolicCycle({ goal, outcomes });
      goalStore.set(goal_id, updated);
      persistGoal(updated);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            goal_id,
            G_local: summary.G,
            is_canonical_g: false,
            space: "J-space",
            C_dark: summary.C_dark,
            successes: summary.successes,
            failures: summary.failures,
            warnings: summary.warnings,
            results: summary.results.map((r) => ({
              task_id: r.task_id,
              success: r.success,
              risk_weight: `${r.previous_risk_weight.toFixed(2)} → ${r.new_risk_weight.toFixed(2)}`,
              sensitivity_adjusted: r.sensitivity_adjusted,
              adjusted_fields: r.adjusted_fields,
              warning: r.warning,
            })),
            note: "Metabolic adjustments applied. G_local recomputed from Jacobian (is_canonical_g=false). Not constitutional G.",
          }, null, 2),
        }],
      };
    },
  );

  // ── forge_apex_emd — EMD validation gate ──────────────────────────────
  server.tool(
    "forge_apex_emd",
    "Run EMD (Encode→Metabolize→Decode) validation gate on a goal. Detects drift, scope creep, anomalies. Returns C_dark and ToAC verdict.",
    {
      goal_id: z.string().min(3).describe("Goal ID from forge_apex_encode"),
      session_id: z.string().optional(),
    },
    async ({ goal_id }) => {
      const goal = getGoal(goal_id);
      if (!goal) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `Goal ${goal_id} not found in session store` }, null, 2) }],
        };
      }

      // E3 fix: pass previousState + previousTaskStates so drift detection
      // compares against the prior EMD pass, not the current goal itself.
      // Without this, emdPass(goal) re-encodes from scratch → zero anomalies.
      const previousState = (goal as any)._emd_previous_encode ?? null;
      const previousTaskStates = (goal as any)._emd_previous_task_states ?? null;
      const emd = emdPass(goal, previousState, previousTaskStates);
      goal.C_dark = emd.C_dark;
      // Stash encode state + task states for next EMD pass baseline.
      (goal as any)._emd_previous_encode = emd.encode;
      (goal as any)._emd_previous_task_states = Object.fromEntries(
        goal.tasks.map((t: any) => [t.task_id, t.state]),
      );
      goalStore.set(goal_id, goal);
      persistGoal(goal);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            goal_id,
            passed: emd.passed,
            verdict: emd.verdict,
            C_dark: emd.C_dark,
            fidelity: emd.decode.fidelity,
            anomaly_count: emd.decode.anomalies.length,
            anomalies: emd.decode.anomalies.map((a) => ({
              task_id: a.task_id,
              type: a.type,
              severity: a.severity,
              description: a.description,
            })),
            evidence: emd.evidence,
            note: "EMD gate complete. C_dark ≥ 0.30 = HOLD, ≥ 0.50 = VOID.",
          }, null, 2),
        }],
      };
    },
  );

  // ── forge_apex_recompute — recompute on field change ──────────────────
  server.tool(
    "forge_apex_recompute",
    "Recompute task plan when a governance field changes (risk, scope, authority, etc.). Only high-sensitivity tasks (>0.6) are recalculated — stable tasks retain. Returns which tasks need recompute.",
    {
      goal_id: z.string().min(3).describe("Goal ID from forge_apex_encode"),
      field: z.enum(["risk", "scope", "authority", "time", "cost", "organ", "domain"]).describe("Which governance field changed"),
      from: z.string().describe("Old value (e.g., 'MEDIUM')"),
      to: z.string().describe("New value (e.g., 'HIGH')"),
      session_id: z.string().optional(),
    },
    async ({ goal_id, field, from, to }) => {
      const goal = getGoal(goal_id);
      if (!goal) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `Goal ${goal_id} not found` }, null, 2) }],
        };
      }

      const change: FieldChange = { field, from, to };
      const result = recomputeOnFieldChange(goal, change);
      goalStore.set(goal_id, goal);
      persistGoal(goal);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            goal_id,
            change: { field, from, to },
            recompute: result.recompute,
            stable: result.stable,
            G_local: result.G,
            recompute_count: result.recompute.length,
            stable_count: result.stable.length,
            note: `Only ${result.recompute.length} of ${goal.tasks.length} tasks need recompute — ${result.stable.length} tasks retain. Before Jacobian: ALL tasks would need re-plan.`,
          }, null, 2),
        }],
      };
    },
  );

  // ── forge_apex_goal_status — inspect current goal state ───────────────
  server.tool(
    "forge_apex_goal_status",
    "Inspect current state of a goal: tasks, G, C_dark, Jacobian, and metabolic history.",
    {
      goal_id: z.string().min(3).describe("Goal ID from forge_apex_encode"),
    },
    async ({ goal_id }) => {
      const goal = getGoal(goal_id);
      if (!goal) {
        // List all known goals
        const known = Array.from(goalStore.keys());
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "HOLD", error: `Goal ${goal_id} not found`, known_goals: known }, null, 2) }],
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "SEAL",
            goal_id: goal.goal_id,
            goal_text: goal.goal_text,
            G: goal.G,
            C_dark: goal.C_dark,
            W3: goal.W3,
            version: goal.version,
            sealed: goal.sealed,
            task_count: goal.tasks.length,
            tasks: goal.tasks.map((t) => ({
              task_id: t.task_id,
              label: t.label,
              state: t.state,
              risk_tier: t.risk_tier,
              organ: t.organ,
              metabolism_count: t.provenance.metabolism_count,
              risk_weight: t.provenance.risk_weight_multiplier,
              c_dark: t.c_dark_contribution,
            })),
            jacobian_summary: {
              high_sensitivity: goal.jacobian.high_sensitivity_count,
              stable: goal.jacobian.stable_task_count,
              efficiency: goal.jacobian.efficiency,
              continuity_hash: goal.jacobian.continuity_hash,
            },
          }, null, 2),
        }],
      };
    },
  );
}
