/**
 * AaaCapabilityGraph.ts — AAA Capability → Authority Matrix
 *
 * Defines what AAA agent authority is required for each memory operation.
 * No memory operation may proceed without the required AAA binding.
 *
 * LLM tidak ada capability graph — dia hanya baca input, keluar output.
 * AGI ada capability graph — setiap tindakan memori ada authority boundary.
 *
 * @module aaa/AaaCapabilityGraph
 * @constitutional AAA Capability Graph (hard constraint)
 * @forged 2026-06-29 by AAA Memory Audit
 */

import type { AaaAgentId } from "./AaaAgentRegistry.js";

// ── Memory Action Types ──────────────────────────────────────────

export type MemoryAction =
  | "memory:read"           // Read from any memory layer
  | "memory:write"          // Write to any memory layer
  | "memory:mutate"         // Update/correct existing memory
  | "memory:delete"         // Soft-delete (forget)
  | "memory:seal"           // Irreversible seal (VAULT999)
  | "memory:search"         // Search/query memory
  | "memory:evict"          // Evict from short-term memory
  | "memory:archive"        // Archive to long-term storage
  | "memory:federate"       // Cross-organ federation write
  | "memory:downgrade"      // Downgrade memory tier
  | "memory:verify"         // Verify quarantined memory
  | "memory:pin";           // Pin memory (prevent decay)

// ── Capability Entry ─────────────────────────────────────────────

export interface CapabilityEntry {
  action: MemoryAction;
  /** The AAA agent that MUST bind to this action */
  requiredAgent: AaaAgentId;
  /** Minimum constitutional verdict required */
  minVerdict: "SEAL" | "SABAR";
  /** Whether this action is reversible */
  reversible: boolean;
  /** Whether this action requires session validation */
  requiresSession: boolean;
  /** Whether this action requires WELL readiness check */
  requiresReadiness: boolean;
  /** F1 risk: does this need Amanah lock? */
  requiresAmanahLock: boolean;
  /** F13: does this require sovereign approval? */
  requiresSovereignApproval: boolean;
  /** Whether a receipt MUST be generated */
  requiresReceipt: boolean;
}

// ── THE CAPABILITY GRAPH ─────────────────────────────────────────

/**
 * Canonical capability graph. Every memory operation maps to exactly
 * one entry in this graph. No operation proceeds without satisfying
 * ALL requirements in its capability entry.
 *
 * Design principle:
 *   Reads   → 333-AGI (THINK)   — ringan, tiada receipt
 *   Writes  → 555-ASI (MEMORY)  — perlukan receipt
 *   Mutates → 888-APEX (JUDGE)   — perlukan readiness + lock
 *   Seals   → 888-APEX (JUDGE)   — perlukan F13 + irreversibility gate (was A-ARCHIVE, collapsed 2026-07-15)
 *   Verify  → 888-APEX (JUDGE)   — oversight via arif_judge (was A-AUDIT, collapsed 2026-07-15)
 */
export const AAA_CAPABILITY_GRAPH: Readonly<Record<MemoryAction, CapabilityEntry>> = {
  "memory:read": {
    action: "memory:read",
    requiredAgent: "333-AGI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: false,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: false,
  },
  "memory:write": {
    action: "memory:write",
    requiredAgent: "555-ASI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:mutate": {
    action: "memory:mutate",
    requiredAgent: "888-APEX",
    minVerdict: "SABAR",
    reversible: false,
    requiresSession: true,
    requiresReadiness: true,
    requiresAmanahLock: true,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:delete": {
    action: "memory:delete",
    requiredAgent: "888-APEX",
    minVerdict: "SABAR",
    reversible: false,
    requiresSession: true,
    requiresReadiness: true,
    requiresAmanahLock: true,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:seal": {
    action: "memory:seal",
    requiredAgent: "888-APEX",  // was A-ARCHIVE, collapsed 2026-07-15
    minVerdict: "SABAR",
    reversible: false,
    requiresSession: true,
    requiresReadiness: true,
    requiresAmanahLock: true,
    requiresSovereignApproval: true,
    requiresReceipt: true,
  },
  "memory:search": {
    action: "memory:search",
    requiredAgent: "333-AGI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: false,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: false,
  },
  "memory:evict": {
    action: "memory:evict",
    requiredAgent: "555-ASI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:archive": {
    action: "memory:archive",
    requiredAgent: "555-ASI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:federate": {
    action: "memory:federate",
    requiredAgent: "555-ASI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:downgrade": {
    action: "memory:downgrade",
    requiredAgent: "888-APEX",
    minVerdict: "SABAR",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:verify": {
    action: "memory:verify",
    requiredAgent: "888-APEX",  // was A-AUDIT, collapsed 2026-07-15
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
  "memory:pin": {
    action: "memory:pin",
    requiredAgent: "555-ASI",
    minVerdict: "SEAL",
    reversible: true,
    requiresSession: true,
    requiresReadiness: false,
    requiresAmanahLock: false,
    requiresSovereignApproval: false,
    requiresReceipt: true,
  },
};

/**
 * Look up the capability entry for a given memory action.
 * Returns null for unknown actions (caller must HOLD).
 */
export function getCapability(action: MemoryAction): CapabilityEntry | null {
  return AAA_CAPABILITY_GRAPH[action] ?? null;
}

/**
 * Verify that an actor has the required AAA agent authority for an action.
 *
 * Veto law (non-compensatory): even one missing required agent = blocked.
 */
export function verifyCapability(
  action: MemoryAction,
  actorBinding: { primaryAgent: AaaAgentId; delegateAgents: AaaAgentId[] },
): { allowed: boolean; reason: string } {
  const cap = getCapability(action);
  if (!cap) return { allowed: false, reason: `Unknown memory action: ${action}` };

  const { primaryAgent, delegateAgents } = actorBinding;
  const allAgents = [primaryAgent, ...delegateAgents];

  if (!allAgents.includes(cap.requiredAgent)) {
    return {
      allowed: false,
      reason: `Actor lacks ${cap.requiredAgent} authority for ${action}. Has: ${allAgents.join(", ")}.`,
    };
  }

  return { allowed: true, reason: `${cap.requiredAgent} authority verified for ${action}.` };
}
