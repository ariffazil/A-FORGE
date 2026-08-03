/**
 * P0 Deterministic Pre-Execution Gates — Gate implementations.
 *
 * Four-gate suite mapped from arXiv:2607.07405 to arifOS federation:
 *   1. lease_validity      — actor must hold valid lease (cancellation_eligibility)
 *   2. reversibility_check  — action must be reversible or ack_irreversible (baggage_allowance)
 *   3. observe_before_mutate — must read before write (must_read_before_write)
 *   4. blast_radius_bound   — blast radius must be within lease limits (passenger_count)
 *
 * All gates are PURE FUNCTIONS: no LLM calls, no network, no writes.
 *
 * @module governance/p0-gates/gates
 * @forged 2026-08-03 by 333-AGI
 *
 * DITEMPA BUKAN DIBERI
 */

import type {
  DBSnapshot,
  GatePredicate,
  GateRegistration,
  GateResult,
  LeaseState,
} from "./types.js";

// ── Gate 1: lease_validity ───────────────────────────────────────────

/**
 * Block tool calls when the actor's lease is invalid or insufficient.
 *
 * Maps to: cancellation_eligibility (arXiv gate 1)
 * Floor: F1 AMANAH — no mutation without valid authority
 */
const leaseValidityGate: GatePredicate = (
  _toolName: string,
  _args: Record<string, unknown>,
  _dbState: DBSnapshot,
  lease: LeaseState,
): GateResult => {
  if (!lease.valid) {
    return {
      allow: false,
      gateId: "lease_validity",
      reason: "No valid lease — actor cannot mutate without an active lease.",
    };
  }
  if (lease.expired) {
    return {
      allow: false,
      gateId: "lease_validity",
      reason: `Lease expired. Session: ${lease.sessionId}. Re-init to obtain a new lease.`,
    };
  }
  if (lease.actorId !== _dbState.session.actorId) {
    return {
      allow: false,
      gateId: "lease_validity",
      reason: `Lease actor mismatch: ${lease.actorId} ≠ ${_dbState.session.actorId}. Lease is not for this actor.`,
    };
  }
  return { allow: true, gateId: "lease_validity" };
};

// ── Gate 2: reversibility_check ──────────────────────────────────────

/**
 * Block irreversible actions unless explicitly acknowledged.
 *
 * Maps to: baggage_allowance (arXiv gate 2)
 * Floor: F1 AMANAH — reversible-first
 */
const reversibilityGate: GatePredicate = (
  toolName: string,
  args: Record<string, unknown>,
  _dbState: DBSnapshot,
  _lease: LeaseState,
): GateResult => {
  const irreversibleTools = [
    "forge_shell", // can execute rm, DROP, etc.
    "forge_filesystem", // can delete files
    "forge_execute_sealed", // can deploy
    "forge_seal", // irreversible vault write
    "forge_vault", // vault mutation
  ];

  const isIrreversible = irreversibleTools.some((t) => toolName.includes(t));
  const hasAck = args.ack_irreversible === true || args.ack_irreversible === "true";

  if (isIrreversible && !hasAck) {
    return {
      allow: false,
      gateId: "reversibility_check",
      reason: `Tool '${toolName}' may be irreversible. Set ack_irreversible=true to proceed (F1 AMANAH).`,
    };
  }

  // Check for delete mode specifically
  if (args.mode === "delete" || args.delete_mode === "permanent") {
    if (!hasAck) {
      return {
        allow: false,
        gateId: "reversibility_check",
        reason: "Delete mode requires ack_irreversible=true (F1 AMANAH).",
      };
    }
  }

  return { allow: true, gateId: "reversibility_check" };
};

// ── Gate 3: observe_before_mutate ─────────────────────────────────────

/**
 * Block writes to resources the agent has not read.
 *
 * Maps to: must_read_before_write (arXiv gate 4)
 * Floor: F2 TRUTH — evidence before action
 */
const observeBeforeMutateGate: GatePredicate = (
  toolName: string,
  args: Record<string, unknown>,
  dbState: DBSnapshot,
  _lease: LeaseState,
): GateResult => {
  const writeTools = [
    "forge_filesystem",
    "forge_shell",
    "forge_git",
    "forge_execute",
  ];

  const isWrite = writeTools.some((t) => toolName.includes(t));
  const writeModes = ["write", "commit", "delete", "execute", "deploy"];
  const modeIsWrite = writeModes.includes(String(args.mode || ""));

  if (!isWrite && !modeIsWrite) {
    return { allow: true, gateId: "observe_before_mutate" };
  }

  if (!dbState.preReadPerformed && !dbState.filesystem.exists) {
    return {
      allow: false,
      gateId: "observe_before_mutate",
      reason: `Must read before write (F2 TRUTH). No evidence of prior observation for: ${dbState.filesystem.targetPath}. Call arif_observe or probe the resource first.`,
    };
  }

  return { allow: true, gateId: "observe_before_mutate" };
};

// ── Gate 4: blast_radius_bound ───────────────────────────────────────

/**
 * Block actions whose blast radius exceeds the lease's authority.
 *
 * Maps to: passenger_count (arXiv gate 3)
 * Floor: F1 AMANAH — bounded mutation
 */
const blastRadiusGate: GatePredicate = (
  toolName: string,
  args: Record<string, unknown>,
  _dbState: DBSnapshot,
  lease: LeaseState,
): GateResult => {
  // Estimate blast radius from tool + args
  let estimatedBR = 0;

  // Path-based blast radius
  const path = String(args.path || args.target || "");
  if (path.startsWith("/root/arifOS")) estimatedBR = 3;
  else if (path.startsWith("/root/VAULT999")) estimatedBR = 5;
  else if (path.startsWith("/opt/")) estimatedBR = 3;
  else if (path.startsWith("/etc/")) estimatedBR = 5;
  else if (path.startsWith("/root/")) estimatedBR = 2;
  else if (path.startsWith("/tmp/")) estimatedBR = 1;
  else if (path.startsWith("/")) estimatedBR = 2;

  // Command-based blast radius
  const command = String(args.command || "");
  if (command.includes("rm -rf")) estimatedBR = Math.max(estimatedBR, 5);
  if (command.includes("DROP")) estimatedBR = Math.max(estimatedBR, 5);
  if (command.includes("systemctl restart")) estimatedBR = Math.max(estimatedBR, 3);
  if (command.includes("docker rm")) estimatedBR = Math.max(estimatedBR, 4);
  if (command.includes("git push --force")) estimatedBR = Math.max(estimatedBR, 4);

  // Map action class to max blast radius
  const maxBR: Record<string, number> = {
    OBSERVE_ONLY: 0,
    OBSERVE: 1,
    ANALYZE: 2,
    EXECUTE: 3,
    SEAL: 4,
  };
  const allowedBR = maxBR[lease.maxActionClass] ?? 0;

  if (estimatedBR > allowedBR) {
    return {
      allow: false,
      gateId: "blast_radius_bound",
      reason: `Estimated blast radius ${estimatedBR} exceeds lease max ${allowedBR} (class: ${lease.maxActionClass}). Narrow scope or obtain higher lease.`,
    };
  }

  return { allow: true, gateId: "blast_radius_bound" };
};

// ── Gate Registry ─────────────────────────────────────────────────────

/** Canonical P0 gate suite, ordered by priority. */
export const P0_GATES: GateRegistration[] = [
  {
    id: "lease_validity",
    predicate: leaseValidityGate,
    priority: 1,
    targeting: { tools: [], actionClasses: [] }, // all mutating tools
    floor: "F1",
  },
  {
    id: "reversibility_check",
    predicate: reversibilityGate,
    priority: 2,
    targeting: { tools: [], actionClasses: [] },
    floor: "F1",
  },
  {
    id: "observe_before_mutate",
    predicate: observeBeforeMutateGate,
    priority: 3,
    targeting: {
      tools: ["forge_filesystem", "forge_shell", "forge_git", "forge_execute"],
    },
    floor: "F2",
  },
  {
    id: "blast_radius_bound",
    predicate: blastRadiusGate,
    priority: 4,
    targeting: { tools: [], actionClasses: [] },
    floor: "F1",
  },
];

export { leaseValidityGate, reversibilityGate, observeBeforeMutateGate, blastRadiusGate };
