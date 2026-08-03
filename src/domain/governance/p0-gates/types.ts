/**
 * P0 Deterministic Pre-Execution Gates — Type definitions.
 *
 * Based on Reddy, Challaram & Basu (2026) arXiv:2607.07405:
 * "Reason Less, Verify More: Deterministic Gates Recover a Silent
 *  Policy-Violation Failure Mode in Tool-Using LLM Agents"
 *
 * A gate is a pure deterministic predicate:
 *   (toolName, args, dbState, lease) → { allow: boolean, reason?: string }
 *
 * Gates run BEFORE any mutating tool call. If any gate rejects, the tool
 * call is short-circuited and the agent receives a structured rejection.
 *
 * @module governance/p0-gates/types
 * @forged 2026-08-03 by 333-AGI
 * @see /root/forge_work/2026-08-03/P0-DETERMINISTIC-GATES-SPEC.md
 *
 * DITEMPA BUKAN DIBERI
 */

/** Snapshot of relevant state at gate evaluation time. */
export interface DBSnapshot {
  /** Current session data (leases, tokens, actor state). */
  session: {
    actorId: string;
    sessionId: string;
    leaseExpiry: number | null; // Unix timestamp ms
    maxActionClass: string;
  };
  /** Filesystem state relevant to the tool call. */
  filesystem: {
    targetPath: string;
    exists: boolean;
    isDirectory: boolean;
    size: number | null;
  };
  /** Whether pre-read has been performed on the target (must_read_before_write). */
  preReadPerformed: boolean;
}

/** Lease state at gate evaluation time. */
export interface LeaseState {
  valid: boolean;
  expired: boolean;
  maxActionClass: string;
  actorId: string;
  sessionId: string;
}

/** Result of a single gate evaluation. */
export interface GateResult {
  /** Whether the tool call is allowed to proceed. */
  allow: boolean;
  /** Structured reason for rejection (only when allow=false). */
  reason?: string;
  /** Gate ID for audit trail. */
  gateId: string;
}

/** A deterministic pre-execution gate predicate. */
export type GatePredicate = (
  toolName: string,
  args: Record<string, unknown>,
  dbState: DBSnapshot,
  lease: LeaseState
) => GateResult;

/** Registration entry for a gate in the gate suite. */
export interface GateRegistration {
  /** Unique gate identifier. */
  id: string;
  /** The predicate function. Pure, deterministic, no LLM calls. */
  predicate: GatePredicate;
  /** Execution priority (lower = runs earlier). First rejecting gate wins. */
  priority: number;
  /** Which tools this gate targets. Empty array = all mutating tools. */
  targeting: {
    tools?: string[];
    /** Action classes this gate applies to. Empty = all. */
    actionClasses?: string[];
  };
  /** Which floor this gate enforces (F1-F13). Used for audit. */
  floor: string;
}

/** Result of running the full gate suite against a proposed tool call. */
export interface GateSuiteResult {
  /** Whether all gates passed. */
  passed: boolean;
  /** The first rejecting gate, if any. Null if all passed. */
  blockingGate: GateResult | null;
  /** All gate evaluations (for audit). */
  evaluations: GateResult[];
  /** Total evaluation time in ms. */
  latencyMs: number;
}
