/**
 * A-FORGE Executor — TypeScript Execution Types
 *
 * A-FORGE is the executor (hands), not the constitutional judgment engine.
 * It receives sealed receipts from the Python kernel and maps them to
 * forge_* tool calls. Final sovereignty remains Arif / F13 — always.
 *
 * Geometry:
 *   Python kernel (judgment engine) → ExecutorReceipt →
 *   TS A-FORGE executes → ExecutionReport → Python kernel → SealChain
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

// ── Receipts from Python Kernel ──────────────

/**
 * Mandatory receipt for forgeExecute.
 * Missing any hard-fail field → refuse execution (command-runner ban).
 */
export interface ExecutorReceipt {
  /** Unique receipt id from kernel issuance */
  receiptId: string;
  /** Kernel signature / state hash binding this receipt to 888 collapse */
  kernelSignature: string;
  /** Verdict from 888 collapse — only SEAL|SABAR may execute */
  verdict: "SEAL" | "SABAR" | "HOLD" | "VOID";
  /** Constitutional chain ID for audit */
  ccId: string;
  /** Verdict ID from the judgment that authorized this execution — proves provenance */
  judgment_reference: string;
  /** Allowed tools/actions (non-empty) */
  allowedActions: string[];
  /** Primary tool intended (must appear in allowedActions) */
  toolName: string;
  /** Hash of approved inputs (tamper detection) */
  inputHash: string;
  /** Execution bounds */
  bounds: {
    reversible: boolean;
    blastRadius: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    maxTools: number;
    timeoutMs?: number;
  };
  /** Authority / lease context */
  authority: {
    actorId: string;
    sessionId: string;
    /** ISO expiry — lease window */
    validUntil: string;
    /** Optional explicit lease id */
    leaseId?: string;
    /** Authority band string from kernel */
    scope?: string;
  };
  /** Lineage for audit */
  lineage: {
    evidenceIds: string[];
    collapseTimestamp: string;
  };
}


/**
 * OutcomeClass — F13-RATIFIED 2026-09-25 (Spec: A-FORGE UNKNOWN_OUTCOME v1).
 *
 * First-class enum on every actuator receipt. Absence of `outcome_class`
 * on a dispatched action = receipt invalid (F2).
 *
 * Semantics:
 *   SUCCESS         — execute completed, result verified at boundary
 *   FAILURE         — execute completed with known failure cause
 *   UNKNOWN_OUTCOME — execute dispatched, result UNVERIFIED (timeout,
 *                     response truncation, transport drop). NEVER auto-retry;
 *                     requires reconcile() probe with same action_hash.
 *   RECOVERY        — execute failed, system self-recovered
 *   DENIED          — auth/policy deny BEFORE dispatch (no side effect)
 */
export type OutcomeClass =
  | "SUCCESS"
  | "FAILURE"
  | "UNKNOWN_OUTCOME"
  | "RECOVERY"
  | "DENIED";

export const ALL_OUTCOME_CLASSES: ReadonlyArray<OutcomeClass> = [
  "SUCCESS",
  "FAILURE",
  "UNKNOWN_OUTCOME",
  "RECOVERY",
  "DENIED",
];

/**
 * Map ActionResult.status (legacy 4-state) to OutcomeClass (5-state).
 * Centralised so the legacy FAILURE bucket does NOT silently capture
 * UNKNOWN_OUTCOME — the spec calls timeout/transport-drop UNKNOWN.
 */
export function outcomeClassFromStatus(
  status: ActionResult["status"],
): OutcomeClass {
  switch (status) {
    case "SUCCESS": return "SUCCESS";
    case "FAILURE": return "FAILURE";
    case "PARTIAL": return "RECOVERY";   // partial execution = system recovered partially
    case "REFUSED": return "DENIED";     // refused before dispatch = no side effect
  }
}


// ── Action Results ───────────────────────────

export interface ActionResult {
  actionId: string;
  /** Stable hash of the dispatched action. Used by reconcile() to probe. */
  actionHash?: string;
  status: "SUCCESS" | "FAILURE" | "PARTIAL" | "REFUSED";
  /** F13-ratified 2026-09-25 — every receipt carries its outcome class. */
  outcome_class: OutcomeClass;
  tool: string;
  output: unknown;
  error?: string;
  timestamp: string;
  durationMs: number;
}




// ── Forge Command (internal) ─────────────────

export interface ForgeCommand {
  tool: string;
  params: Record<string, unknown>;
  bounds: ExecutorReceipt["bounds"];
  authority: ExecutorReceipt["authority"];
}

// ── Execution Report (sent back to kernel) ───

export interface ExecutionReport {
  receipt: ExecutorReceipt;
  results: ActionResult[];
  summary: {
    totalActions: number;
    succeeded: number;
    failed: number;
    totalDurationMs: number;
    verdict: "SUCCESS" | "PARTIAL" | "FAILURE" | "REFUSED";
    /**
     * F13-ratified 2026-09-25 — aggregate outcome class across actions.
     * Rules:
     *   - any UNKNOWN_OUTCOME in results → UNKNOWN_OUTCOME
     *   - any FAILURE and no UNKNOWN  → FAILURE
     *   - any RECOVERY and no UNKNOWN/FAILURE → RECOVERY
     *   - all SUCCESS                       → SUCCESS
     *   - any DENIED (with no others)       → DENIED
     * Executor self-report CANNOT downgrade UNKNOWN_OUTCOME (Q9 anti-self-seal).
     */
    outcome_class: OutcomeClass;
  };
  /** Hard-fail reasons when receipt validation fails */
  refusalReasons?: string[];
  timestamp: string;
}
