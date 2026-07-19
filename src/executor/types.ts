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

// ── Action Results ───────────────────────────

export interface ActionResult {
  actionId: string;
  status: "SUCCESS" | "FAILURE" | "PARTIAL" | "REFUSED";
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
  };
  /** Hard-fail reasons when receipt validation fails */
  refusalReasons?: string[];
  timestamp: string;
}
