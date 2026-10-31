/**
 * A-FORGE Receipt Ledger — single-use consumption of a kernel grant.
 *
 * F13 ORDER 2026-11-01 (PATCH_AND_TEST_B2_C2_ONLY). Closes defect C2: the same
 * receiptId can produce more than one mutation, so a lost response plus a caller
 * retry duplicates a world change. A grant is a permission to act ONCE.
 *
 * State machine (explicit, no inferred transitions):
 *
 *   AVAILABLE ──claim──▶ CLAIMED ──dispatch──▶ DISPATCHED ──outcome──▶ OUTCOME_KNOWN
 *                                                          └──────────▶ UNKNOWN_OUTCOME
 *
 * Rules encoded here:
 *   1. claimReceipt() is the ONLY AVAILABLE → CLAIMED transition. It is
 *      synchronous, so within one process exactly one caller can win it.
 *   2. A replay is refused while the receipt is in any non-AVAILABLE state,
 *      BEFORE any tool invocation.
 *   3. A timeout does NOT return the receipt to AVAILABLE. UNKNOWN_OUTCOME is a
 *      consumed terminal state; resolution goes through reconcile() or through a
 *      NEWLY authorized receipt — never by retrying the consumed one.
 *   4. Validation failure happens before claim, so an invalid receipt is never
 *      consumed.
 *   5. CLAIMED-but-never-dispatched (e.g. the tool is not registered, or the
 *      bounds check refuses the action) leaves the receipt CONSUMED and records
 *      `dispatched: false`. Rationale: a claimant that failed mid-way must not
 *      re-open the same grant for a second attempt; recovery is a new receipt.
 *      This is a deliberate, tested rule — not an accident.
 *   6. Evidence distinct from outcome is preserved: `dispatched` distinguishes
 *      "never reached the mutation boundary" from "reached it".
 *
 * PERSISTENCE BOUNDARY — DECLARED, NOT ASSUMED.
 * This registry is process-local memory. It protects against replay and
 * concurrent replay WITHIN ONE PROCESS ONLY. It does NOT survive a restart, and
 * it does NOT protect across multiple worker processes or hosts. The executor
 * contract in this repo makes no cross-restart protection claim; if that claim is
 * ever made, this ledger MUST be externalised (kernel-side registry, file lock,
 * or durable store) before the claim is published. Do not read this module as
 * having solved concurrency beyond the boundary stated here.
 */

import type { OutcomeClass, ExecutorReceipt } from "./types.js";

export type ReceiptState =
  | "AVAILABLE"
  | "CLAIMED"
  | "DISPATCHED"
  | "OUTCOME_KNOWN"
  | "UNKNOWN_OUTCOME";

export interface ReceiptRecord {
  receiptId: string;
  state: ReceiptState;
  /** `${sessionId}:${actorId}` of the claimant that won the claim */
  claimedBy: string;
  claimedAt: string;
  /** True only once the mutation boundary was reached */
  dispatched: boolean;
  dispatchedAt?: string;
  outcome?: OutcomeClass;
  finishedAt?: string;
}

export type ClaimFailureReason = "RECEIPT_ALREADY_CLAIMED" | "RECEIPT_ID_EMPTY";

export type ClaimOutcome =
  | { ok: true; record: ReceiptRecord }
  | { ok: false; state: ReceiptState | "UNKNOWN_RECEIPT"; reason: ClaimFailureReason };

const ledger = new Map<string, ReceiptRecord>();

/**
 * Atomically move a receipt from AVAILABLE to CLAIMED.
 *
 * Synchronous by design: there is no `await` between the existence check and the
 * write, so two concurrent callers in one process cannot both observe AVAILABLE.
 * Introducing an async boundary before the set() would create exactly the
 * check-then-set race this function exists to prevent.
 */
export function claimReceipt(receiptId: string, claimant: string): ClaimOutcome {
  if (!receiptId) {
    return { ok: false, state: "UNKNOWN_RECEIPT", reason: "RECEIPT_ID_EMPTY" };
  }

  const existing = ledger.get(receiptId);
  if (existing) {
    return {
      ok: false,
      state: existing.state,
      reason: "RECEIPT_ALREADY_CLAIMED",
    };
  }

  const record: ReceiptRecord = {
    receiptId,
    state: "CLAIMED",
    claimedBy: claimant,
    claimedAt: new Date().toISOString(),
    dispatched: false,
  };
  ledger.set(receiptId, record);
  return { ok: true, record };
}

/** Record that the mutation boundary was reached. No-op on unknown receipt. */
export function markDispatched(receiptId: string): void {
  const rec = ledger.get(receiptId);
  if (!rec) return;
  if (rec.state !== "CLAIMED") return; // only CLAIMED → DISPATCHED; never resurrect
  rec.state = "DISPATCHED";
  rec.dispatched = true;
  rec.dispatchedAt = new Date().toISOString();
}

/**
 * Record the terminal outcome. UNKNOWN_OUTCOME stays consumed (rule 3).
 * No-op on unknown receipt, and it cannot move a terminal record back.
 */
export function markOutcome(receiptId: string, outcome: OutcomeClass): void {
  const rec = ledger.get(receiptId);
  if (!rec) return;
  if (rec.state === "OUTCOME_KNOWN" || rec.state === "UNKNOWN_OUTCOME") return;
  rec.state = outcome === "UNKNOWN_OUTCOME" ? "UNKNOWN_OUTCOME" : "OUTCOME_KNOWN";
  rec.outcome = outcome;
  rec.finishedAt = new Date().toISOString();
}

export function getReceiptRecord(receiptId: string): ReceiptRecord | undefined {
  return ledger.get(receiptId);
}

export function receiptState(receiptId: string): ReceiptState | "UNKNOWN_RECEIPT" {
  return ledger.get(receiptId)?.state ?? "UNKNOWN_RECEIPT";
}

export function listReceiptRecords(): ReceiptRecord[] {
  return Array.from(ledger.values());
}

/** Test helper — clears the ledger. Process-local by construction. */
export function clearReceiptLedger(): void {
  ledger.clear();
}

/** Claimant identity string used for evidence. */
export function claimantOf(receipt: ExecutorReceipt): string {
  return `${receipt.authority?.sessionId ?? "?"}:${receipt.authority?.actorId ?? "?"}`;
}
