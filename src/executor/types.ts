/**
 * A-FORGE Executor — TypeScript Execution Types
 *
 * A-FORGE is the executor (hands), not the judge (kernel).
 * It receives sealed receipts from the Python kernel and maps
 * them to forge_* tool calls.
 *
 * Geometry:
 *   Python kernel → issues receipt → TS A-FORGE executes →
 *   returns result receipt → Python kernel judges
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

// ── Receipts from Python Kernel ──────────────

export interface ExecutorReceipt {
  /** Verdict from 888 collapse */
  verdict: "SEAL" | "SABAR" | "HOLD" | "VOID";
  /** Constitutional chain ID for audit */
  ccId: string;
  /** Allowed tools/actions */
  allowedActions: string[];
  /** Execution bounds */
  bounds: {
    reversible: boolean;
    blastRadius: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    maxTools: number;
    timeoutMs?: number;
  };
  /** Authority context */
  authority: {
    actorId: string;
    sessionId: string;
    validUntil: string;
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
  status: "SUCCESS" | "FAILURE" | "PARTIAL";
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
    verdict: "SUCCESS" | "PARTIAL" | "FAILURE";
  };
  timestamp: string;
}
