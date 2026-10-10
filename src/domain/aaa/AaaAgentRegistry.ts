/**
 * AaaAgentRegistry.ts — AAA Agent Identity Registry
 *
 * Canonical registry of the 5 AAA agents. Every memory operation
 * must bind to exactly one AAA agent through this registry.
 *
 * LLM ingat corak. AGI ingat sejarah.
 * Registry ini adalah tulang belakang identity boundary agentic memory.
 *
 * AAA Agent Inventory (hard constraint):
 *   333-AGI   (THINK)    — reasoning, planning, analysis
 *   555-ASI   (MEMORY)   — memory storage, retrieval, federation
 *   888-APEX  (JUDGE)    — constitutional judgment, verdicts
 *   A-AUDIT   (WATCH)    — [DEPRECATED 2026-07-15] oversight → arifOS arif_judge/arif_seal
 *   A-ARCHIVE (VAULT)    — [DEPRECATED 2026-07-15] vault sealing → VAULT999 direct via arif_seal
 *
 * @module aaa/AaaAgentRegistry
 * @constitutional AAA Agent Registry — identity boundary (hard constraint)
 * @forged 2026-06-29 by AAA Memory Audit
 * @updated 2026-07-17 — A-AUDIT/A-ARCHIVE collapsed, functions absorbed into arifOS kernel
 */

// ── AAA Agent Types ────────────────────────────────────────────

export type AaaAgentId =
  | "333-AGI"
  | "555-ASI"
  | "888-APEX"
  | "A-AUDIT"    // DEPRECATED — retained for backward compat, routes to 888-APEX
  | "A-ARCHIVE"; // DEPRECATED — retained for backward compat, routes to 888-APEX

export type AaaAgentRole = "THINK" | "MEMORY" | "JUDGE" | "WATCH" | "VAULT";

export interface AaaAgent {
  id: AaaAgentId;
  role: AaaAgentRole;
  description: string;
  /** Which memory operations this agent governs */
  governs: "read" | "write" | "mutate" | "receipt" | "seal";
  /** Constitutional floor binding */
  floorBinding: string;
  /** Deprecated agents route to this replacement */
  deprecated?: boolean;
  migration?: string;
}

// ── Agent Registry ──────────────────────────────────────────────

const AAA_AGENTS: Readonly<Record<AaaAgentId, AaaAgent>> = {
  "333-AGI": {
    id: "333-AGI",
    role: "THINK",
    description: "Reasoning engine — plans, analyzes, reads memory",
    governs: "read",
    floorBinding: "F7 (HUMILITY), F8 (GENIUS)",
  },
  "555-ASI": {
    id: "555-ASI",
    role: "MEMORY",
    description: "Memory engine — stores, retrieves, federates memory",
    governs: "write",
    floorBinding: "F2 (TRUTH), F11 (AUDITABILITY)",
  },
  "888-APEX": {
    id: "888-APEX",
    role: "JUDGE",
    description: "Constitutional judge — SEAL/SABAR/HOLD/VOID verdicts",
    governs: "mutate",
    floorBinding: "F1-F13 (ALL FLOORS)",
  },
  "A-AUDIT": {
    id: "A-AUDIT",
    role: "WATCH",
    description: "[DEPRECATED 2026-07-15] Oversight — absorbed into arifOS arif_judge + arif_seal",
    governs: "receipt",
    floorBinding: "F11 (AUDITABILITY), F2 (TRUTH)",
    deprecated: true,
    migration: "Use arifOS arif_judge for oversight, arif_seal for receipt verification. Routes to 888-APEX.",
  },
  "A-ARCHIVE": {
    id: "A-ARCHIVE",
    role: "VAULT",
    description: "[DEPRECATED 2026-07-15] Vault sealing — absorbed into VAULT999 direct via arif_seal",
    governs: "seal",
    floorBinding: "F1 (AMANAH), F11 (AUDITABILITY)",
    deprecated: true,
    migration: "Use arifOS arif_seal for VAULT999 immutable append. No intermediate archivist needed.",
  },
};

// ── Actor Binding ────────────────────────────────────────────────

/**
 * Maps runtime actor_id strings to AAA agents.
 *
 * Pattern:
 *   "a-forge::<module>"        → module-level actor
 *   "session::<session_id>"    → session-bound actor
 *   "human::<name>"            → human operator
 *   "kernel::<component>"      → arifOS kernel component
 *
 * Raw "SEAL-<hex>" session identifiers are NOT actor identities and no longer
 * resolve here (WO-2 / R18, F13-ratified 2026-10-11): lexical resemblance must
 * not confer semantic authority. Kernel sessions bind through the
 * "session::<session_id>" namespace or the caller's authoritative session
 * record (AaaMemoryLinkage Gate 2, validateSession).
 */
export type ActorBinding = {
  actorId: string;
  primaryAgent: AaaAgentId;
  /** Additional agents this actor can invoke */
  delegateAgents: AaaAgentId[];
  /** Human override available? */
  humanOverride: boolean;
};

/**
 * Resolve an actor_id to its AAA binding.
 *
 * Resolution order:
 *   1. Exact match in registry
 *   2. Prefix match on the documented namespaces (session::, a-forge::, human::)
 *   3. Unknown → null (caller must HOLD — never default to privileged)
 *
 * REMOVED 2026-10-11 (WO-2 / R18): the former `/^SEAL-[a-f0-9]{16}$/` shortcut
 * granted an 888-APEX-oriented binding to any SEAL-shaped string — privilege
 * from string shape. Measured caller chain: AaaMemoryLinkage.ts Gate 3→4;
 * the null path below is fail-closed (caller returns HOLD).
 */
export function resolveActor(actorId: string): ActorBinding | null {
  // Exact matches
  const exact: Record<string, ActorBinding> = {
    "arif-fazil": {
      actorId: "arif-fazil",
      primaryAgent: "888-APEX",
      delegateAgents: ["333-AGI", "555-ASI"],
      // A-AUDIT + A-ARCHIVE removed 2026-07-17
      humanOverride: true,
    },
    // P1.3: arif (sovereign shorthand) for autonomous seal path
    "arif": {
      actorId: "arif",
      primaryAgent: "888-APEX",
      delegateAgents: ["333-AGI", "555-ASI"],
      humanOverride: true,
    },
    "a-forge::seal-service": {
      actorId: "a-forge::seal-service",
      primaryAgent: "888-APEX",
      delegateAgents: [],  // was A-ARCHIVE, collapsed 2026-07-15 — sealing now via arif_seal → VAULT999
      humanOverride: false,
    },
    "a-forge::short-term-memory": {
      actorId: "a-forge::short-term-memory",
      primaryAgent: "555-ASI",
      delegateAgents: ["333-AGI"],
      humanOverride: false,
    },
    "a-forge::long-term-memory": {
      actorId: "a-forge::long-term-memory",
      primaryAgent: "555-ASI",
      delegateAgents: ["333-AGI", "888-APEX"],  // was A-AUDIT, collapsed 2026-07-15
      humanOverride: false,
    },
    "a-forge::memory-contract": {
      actorId: "a-forge::memory-contract",
      primaryAgent: "555-ASI",
      delegateAgents: ["333-AGI", "888-APEX"],
      humanOverride: false,
    },
    "a-forge::memory-client": {
      actorId: "a-forge::memory-client",
      primaryAgent: "555-ASI",
      delegateAgents: ["333-AGI"],
      humanOverride: false,
    },
    "a-forge::cooling-gate": {
      actorId: "a-forge::cooling-gate",
      primaryAgent: "888-APEX",
      delegateAgents: ["555-ASI"],  // was A-ARCHIVE + A-AUDIT, collapsed 2026-07-15
      humanOverride: false,
    },
    "kimi": {
      actorId: "kimi",
      primaryAgent: "555-ASI",
      delegateAgents: ["333-AGI"],
      humanOverride: false,
    },
    "kernel-sealed": {
      actorId: "kernel-sealed",
      primaryAgent: "888-APEX",
      delegateAgents: [],  // was A-ARCHIVE + A-AUDIT, collapsed 2026-07-15
      humanOverride: false,
    },
  };

  if (exact[actorId]) return exact[actorId];

  // Prefix matches
  if (actorId.startsWith("session::"))
    return { actorId, primaryAgent: "333-AGI", delegateAgents: ["555-ASI"], humanOverride: false };
  if (actorId.startsWith("a-forge::"))
    return { actorId, primaryAgent: "555-ASI", delegateAgents: ["333-AGI"], humanOverride: false };
  if (actorId.startsWith("human::"))
    return { actorId, primaryAgent: "888-APEX", delegateAgents: ["333-AGI", "555-ASI"], humanOverride: true };  // was A-AUDIT, collapsed 2026-07-15

  // Unknown → null (caller must HOLD — never default to privileged)
  return null;
}

/**
 * Get the AAA agent that governs a specific memory action.
 */
export function getGoverningAgent(action: "read" | "write" | "mutate" | "receipt" | "seal"): AaaAgent {
  const agent = Object.values(AAA_AGENTS).find(a => a.governs === action);
  if (!agent) throw new Error(`No AAA agent governs action: ${action}`);
  return agent;
}

/**
 * Get a full AAA agent by ID.
 */
export function getAgent(id: AaaAgentId): AaaAgent {
  return AAA_AGENTS[id];
}

/**
 * List all AAA agents.
 */
export function listAgents(): readonly AaaAgent[] {
  return Object.values(AAA_AGENTS);
}
