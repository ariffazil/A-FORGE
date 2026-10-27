/**
 * refusalGateBridge.ts — Bridge to the canonical arifOS human refusal gate.
 *
 * Implements Gate 0: REFUSAL.
 * A human consequence-bearer can issue a scoped NO.
 * Before execution, A-FORGE consults the refusal store.
 * If a valid refusal covers the scope, execution is BLOCKED.
 * If the store is unverified or tampered, execution is HELD (fail closed).
 * Absence of refusal is NOT approval.
 *
 * Invariants:
 *   - Store path locked to /var/lib/arifos/refusals.jsonl in production
 *   - Fail-closed on any error (store unverified -> HOLD)
 *   - Blocks execution before any child process is spawned
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { execFile } from "node:child_process";

export interface RefusalRecord {
  refusal_id: string;
  bearer_id: string;
  scope: string;
  reason: string;
  status: string;
  issued_at: string;
  survives_until?: string | null;
}

export interface RefusalCheckResult {
  allow: boolean;
  block: boolean;
  hold: boolean;
  target: string;
  blocking: RefusalRecord[];
  reason?: string;
  error?: string;
  note?: string;
}

const GATE_SCRIPT = "/root/forge_work/patches/refusal-gate-20261028/gate.py";
const CANONICAL_STORE = "/var/lib/arifos/refusals.jsonl";

/**
 * Check whether a target scope is blocked by an active human refusal.
 * Fail-closed: returns { allow: false, block: false, hold: true } on any failure.
 */
export function checkRefusalGate(scope: string, bearerId?: string): Promise<RefusalCheckResult> {
  const args = ["check", "--scope", scope, "--json"];
  if (bearerId) {
    args.push("--bearer", bearerId);
  }

  // Force canonical store in production; do not inherit caller override
  const cleanEnv = { ...process.env };
  delete cleanEnv.ARIFOS_REFUSAL_STORE;

  return new Promise<RefusalCheckResult>((resolve) => {
    execFile(
      "python3",
      [GATE_SCRIPT, ...args],
      {
        env: cleanEnv,
        timeout: 5000,
        maxBuffer: 65536,
      },
      (err, stdout, stderr) => {
        // Exit code 0 = ALLOW, 3 = BLOCK, 4 = HOLD
        const exitCode = err ? (err as any).code ?? -1 : 0;

        if (stdout && stdout.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(stdout) as RefusalCheckResult;
            resolve(parsed);
            return;
          } catch (parseErr: any) {
            resolve({
              allow: false,
              block: false,
              hold: true,
              target: scope,
              blocking: [],
              reason: "REFUSAL_GATE_PARSE_ERROR",
              error: `Failed to parse gate output: ${parseErr.message}`,
            });
            return;
          }
        }

        if (exitCode === 3) {
          resolve({
            allow: false,
            block: true,
            hold: false,
            target: scope,
            blocking: [],
            reason: "REFUSAL_BLOCKED",
            error: stderr || "Execution blocked by human refusal",
          });
          return;
        }

        // Any unexpected error or exit code 4 -> fail-closed HOLD
        resolve({
          allow: false,
          block: false,
          hold: true,
          target: scope,
          blocking: [],
          reason: "REFUSAL_GATE_UNAVAILABLE",
          error: stderr || (err ? err.message : "Unknown gate error"),
        });
      }
    );
  });
}
