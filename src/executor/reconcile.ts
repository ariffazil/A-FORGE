/**
 * reconcile.ts — F13-RATIFIED 2026-09-25 (Spec: A-FORGE UNKNOWN_OUTCOME v1 §4.3).
 *
 * Reconcile-before-retry: resolution of an UNKNOWN_OUTCOME receipt requires
 * a same-action_hash probe of the external system's actual state against
 * `evidence_before_action`. The probe produces a Receipt that is then attached
 * to the promote/demote decision.
 *
 * Invariants (binding):
 *   1. UNKNOWN_OUTCOME never auto-retries. reconcile() is the ONLY path.
 *   2. Executor self-report CANNOT promote UNKNOWN_OUTCOME → SUCCESS/FAILURE
 *      without an external ProbeReceipt (Q9 anti-self-seal).
 *   3. Probe indeterminate → stays UNKNOWN_OUTCOME → escalates human/FRAME.
 *   4. reconcileStore is an in-memory map keyed by action_hash. Persistence
 *      to VAULT999 is the caller's job (kernel seals the chain).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import type { ActionResult, OutcomeClass, ExecutorReceipt } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────

/** Snapshot of evidence taken BEFORE the dispatched action (idempotency anchor). */
export interface EvidenceBeforeAction {
  /** Free-form description of what the executor witnessed before dispatch. */
  description: string;
  /** ISO timestamp of the snapshot. */
  capturedAt: string;
  /** Optional external state snapshot (e.g. POST /state). */
  externalState?: unknown;
}

/**
 * Result of the external probe. The probe MUST be performed by an actor
 * independent of the executor (FRAME / human / external API). Executor
 * self-attestation is rejected by verifyProbeIndependence().
 */
export interface ProbeReceipt {
  /** Hash of the action being probed. Must match the original actionHash. */
  actionHash: string;
  /** Outcome declared by the independent probe actor. */
  probeOutcome: "SUCCESS" | "FAILURE" | "INDETERMINATE";
  /** Identity of the probe actor (must not equal the original executor). */
  probedBy: string;
  /** ISO timestamp of the probe. */
  probedAt: string;
  /** Optional evidence payload (e.g. diff between before/after state). */
  evidence?: unknown;
}

/** Result of reconcile(). */
export interface ReconcileResult {
  actionHash: string;
  /** Original ActionResult (UNKNOWN_OUTCOME). */
  original: ActionResult;
  /** Promoted outcome (UNKNOWN_OUTCOME if probe indeterminate). */
  resolved: OutcomeClass;
  /** Attached probe receipt — undefined if caller supplied no probe. */
  probe?: ProbeReceipt;
  /** True if probe was rejected (e.g. self-probe). */
  probeRejected?: boolean;
  /** Human-readable reason for HOLD / rejection. */
  reason?: string;
  timestamp: string;
}

// ── In-memory store of UNKNOWN_OUTCOME receipts awaiting reconcile ──

const reconcileStore = new Map<string, ActionResult>();

/**
 * Record an UNKNOWN_OUTCOME receipt so reconcile() can find it by action_hash.
 * Called by executor when it produces an UNKNOWN_OUTCOME.
 */
export function recordUnknownOutcome(result: ActionResult): void {
  if (result.outcome_class !== "UNKNOWN_OUTCOME") {
    throw new Error(
      `recordUnknownOutcome: result.outcome_class must be UNKNOWN_OUTCOME, got ${result.outcome_class}`,
    );
  }
  if (!result.actionHash) {
    throw new Error(
      `recordUnknownOutcome: result.actionHash is required to reconcile later`,
    );
  }
  reconcileStore.set(result.actionHash, result);
}

/** Test/inspection helper — list all pending UNKNOWN_OUTCOME hashes. */
export function listUnknownOutcomes(): string[] {
  return Array.from(reconcileStore.keys());
}

/** Test helper — clear the store (no-op in production). */
export function clearUnknownOutcomes(): void {
  reconcileStore.clear();
}

/**
 * Verify that the probe was performed by an actor independent of the
 * executor that produced the original ActionResult. We compare against
 * the receipt.authority.actorId (if present on the original).
 *
 * Returns true if probe is acceptable, false if rejected (self-probe).
 */
export function verifyProbeIndependence(
  original: ActionResult,
  probe: ProbeReceipt,
  originalExecutorActorId?: string,
): { ok: boolean; reason?: string } {
  if (!probe.actionHash) {
    return { ok: false, reason: "Probe missing actionHash" };
  }
  if (probe.probedBy === originalExecutorActorId) {
    return {
      ok: false,
      reason: `Self-probe rejected (Q9 anti-self-seal): probedBy=${probe.probedBy} equals executor actorId`,
    };
  }
  if (probe.actionHash !== (original.actionHash ?? "")) {
    return { ok: false, reason: "Probe actionHash mismatch — must match original" };
  }
  return { ok: true };
}

/**
 * reconcile(action_hash) — promote/demote an UNKNOWN_OUTCOME receipt using
 * an external probe. Probe must be independent (Q9 anti-self-seal).
 *
 * Outcomes:
 *   - probe SUCCESS  → resolved SUCCESS (probe attached)
 *   - probe FAILURE  → resolved FAILURE (probe attached)
 *   - probe INDETERMINATE → resolved UNKNOWN_OUTCOME (escalate human/FRAME)
 *   - self-probe     → resolved stays UNKNOWN_OUTCOME, probeRejected=true
 *
 * @param actionHash   the same-action_hash from the original dispatch
 * @param probe        independent probe of external state (FRAMEquired)
 * @param originalExecutorActorId  actorId of the executor that produced
 *                                  the original UNKNOWN_OUTCOME; if probe
 *                                  matches, the probe is rejected.
 */
export function reconcile(
  actionHash: string,
  probe: ProbeReceipt,
  originalExecutorActorId?: string,
): ReconcileResult {
  const original = reconcileStore.get(actionHash);
  const nowIso = new Date().toISOString();

  if (!original) {
    return {
      actionHash,
      original: {
        actionId: "unknown",
        status: "FAILURE",
        outcome_class: "UNKNOWN_OUTCOME",
        tool: "unknown",
        output: null,
        timestamp: nowIso,
        durationMs: 0,
        actionHash,
        error: `No UNKNOWN_OUTCOME receipt found for action_hash=${actionHash}`,
      },
      resolved: "UNKNOWN_OUTCOME",
      reason: `No pending UNKNOWN_OUTCOME for action_hash=${actionHash}`,
      timestamp: nowIso,
    };
  }

  if (original.outcome_class !== "UNKNOWN_OUTCOME") {
    return {
      actionHash,
      original,
      resolved: original.outcome_class,
      reason: `Original outcome_class is ${original.outcome_class}, not UNKNOWN_OUTCOME — nothing to reconcile`,
      timestamp: nowIso,
    };
  }

  const indep = verifyProbeIndependence(original, probe, originalExecutorActorId);
  if (!indep.ok) {
    // Anti-self-seal — probe rejected, stays UNKNOWN_OUTCOME for FRAME/human.
    return {
      actionHash,
      original,
      resolved: "UNKNOWN_OUTCOME",
      probeRejected: true,
      reason: indep.reason,
      timestamp: nowIso,
    };
  }

  if (probe.probeOutcome === "INDETERMINATE") {
    // Spec §3 — indeterminate probe stays UNKNOWN_OUTCOME (escalate FRAME/human).
    return {
      actionHash,
      original,
      resolved: "UNKNOWN_OUTCOME",
      probe,
      timestamp: nowIso,
    };
  }

  // Promote / demote with probe attached. Remove from pending store.
  reconcileStore.delete(actionHash);
  return {
    actionHash,
    original,
    resolved: probe.probeOutcome,
    probe,
    timestamp: nowIso,
  };
}

/**
 * Convenience wrapper — reconcile a whole batch of action_hashes with one
 * probe each. Useful when an idempotency-key lookup yields multiple
 * candidates (e.g. retry storms).
 */
export function reconcileBatch(
  probes: Array<{
    actionHash: string;
    probe: ProbeReceipt;
    executorActorId?: string;
  }>,
): ReconcileResult[] {
  return probes.map((p) => reconcile(p.actionHash, p.probe, p.executorActorId));
}

// Type re-export for downstream consumers that only import from this module.
export type { ExecutorReceipt };
