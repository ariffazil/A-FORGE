/**
 * RealityLedgerClient.ts — Minimal A-FORGE bridge to the Reality Ledger.
 *
 * Writes A-FORGE execution events directly to the shared JSONL file.
 * Both TypeScript (A-FORGE) and Python (GEOX, WEALTH, WELL, core) append
 * to the same file for unified audit trail.
 *
 * DITEMPA BUKAN DIBERI — Every forge action is tracked.
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Default path — matches Python bridge default
// ---------------------------------------------------------------------------
const LEDGER_PATH = process.env.REALITY_LEDGER_PATH ?? "/root/reality_ledger/reality_ledger.jsonl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealityLedgerEvent {
  id: string;
  organ_id: string;
  timestamp: string;
  actor: string;
  intent: string;
  action_class: string;
  organs_consulted: string[];
  evidence_refs: string[];
  prediction: { expected_outcome: string; confidence: number };
  arifos_verdict: { verdict: string; floors_triggered: string[] };
  execution: Record<string, unknown>;
  observed_outcome: unknown;
  lesson: string | null;
  prev_hash: string;
  hash: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class RealityLedgerClient {
  private readonly ledgerPath: string;

  constructor(ledgerPath?: string) {
    this.ledgerPath = ledgerPath ?? LEDGER_PATH;
  }

  /**
   * Record an A-FORGE execution event to the Reality Ledger.
   */
  recordAforgeExecution(params: {
    task: string;
    files: string[];
    verdict: { verdict: string; floors_triggered: string[] };
    actor?: string;
  }): string {
    const { task, files, verdict, actor = "A-FORGE" } = params;

    const eventId = `A-FORGE-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}-${randomUUID().slice(0, 8)}`;

    // Read previous hash from end of ledger
    let prevHash = "0".repeat(64);
    try {
      if (existsSync(this.ledgerPath)) {
        const content = readFileSync(this.ledgerPath, "utf-8").trim();
        if (content) {
          const lines = content.split("\n").filter(Boolean);
          if (lines.length > 0) {
            const last = JSON.parse(lines[lines.length - 1]);
            prevHash = last.hash ?? prevHash;
          }
        }
      }
    } catch {
      // Genesis block — no previous event
    }

    const event: RealityLedgerEvent = {
      id: eventId,
      organ_id: "A-FORGE",
      timestamp: new Date().toISOString(),
      actor,
      intent: `Execute: ${task.slice(0, 200)}`,
      action_class: "mutate",
      organs_consulted: [],
      evidence_refs: [],
      prediction: {
        expected_outcome: `Task ${task.slice(0, 100)} completed`,
        confidence: 0.8,
      },
      arifos_verdict: verdict,
      execution: {
        files_touched: files,
        task: task.slice(0, 500),
      },
      observed_outcome: null,
      lesson: null,
      prev_hash: prevHash,
      hash: "", // computed below
    };

    // Compute hash
    const { hash: _omit, ...hashable } = event;
    const canonical = JSON.stringify(hashable, Object.keys(hashable).sort());
    event.hash = createHash("sha256").update(canonical).digest("hex");

    // Append
    try {
      mkdirSync(dirname(this.ledgerPath), { recursive: true });
    } catch {
      // already exists
    }
    appendFileSync(this.ledgerPath, JSON.stringify(event) + "\n", "utf-8");

    return eventId;
  }
}

// Singleton
let _defaultClient: RealityLedgerClient | null = null;

export function getRealityLedgerClient(): RealityLedgerClient {
  if (!_defaultClient) {
    _defaultClient = new RealityLedgerClient();
  }
  return _defaultClient;
}
