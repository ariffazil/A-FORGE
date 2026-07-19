/**
 * authorizeMutationBridge.ts — Shared bridge to canonical arifOS Python boundary.
 *
 * Single source of truth for mutation authorization.
 * ALL 7 mutation sinks call this ONE function.
 * No TypeScript duplicate classifier.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { execFile } from "node:child_process";

export interface BridgeInput {
  executable: string;
  arguments: string[];
  targetEnvironment?: string;
  actorPrivilege?: string;
  actorId?: string;
  sessionId?: string;
  suppliedControls?: string[];
  judgmentReference?: string;
}

export interface BridgeResult {
  allowed: boolean;
  verdict: string;
  reasonCodes: string[];
  requiredControls: string[];
  missingControls: string[];
  rejectionReason: string;
  authorizedExecution: {
    profileHash: string;
    authorizationReceipt: string;
    normalizedCommand: string;
    issuedAt: string;
    expiresAt: string;
    actorId: string;
    sessionId: string;
    targetEnvironment: string;
  } | null;
}

/**
 * Calls canonical arifOS Python authorize_mutation() via stdin JSON bridge.
 * Single source of truth. Fail-closed: any error → HOLD_UNCLASSIFIED.
 */
export function callAuthorizeMutationBridge(input: BridgeInput): Promise<BridgeResult> {
  const payload = JSON.stringify({
    executable: input.executable,
    arguments: input.arguments,
    args_text: input.arguments?.join(" ") || "",
    actor_privilege: input.actorPrivilege || "unknown",
    actor_id: input.actorId || "aforge",
    session_id: input.sessionId || "unknown",
    target_environment: input.targetEnvironment || "unknown",
    supplied_controls: input.suppliedControls || [],
    judgment_reference: input.judgmentReference || "",
  });

  return new Promise<BridgeResult>((resolve, reject) => {
    const child = execFile(
      "python3",
      ["/root/arifOS/core/shared/authorize_mutation_cli.py"],
      {
        env: { ...process.env, PYTHONPATH: "/root/arifOS" },
        timeout: 5000,
        maxBuffer: 65536,
      },
      (err, stdout, stderr) => {
        if (err) {
          // Fail-closed: bridge unavailable = HOLD_UNCLASSIFIED
          resolve({
            allowed: false,
            verdict: "HOLD_UNCLASSIFIED",
            reasonCodes: ["BRIDGE_UNAVAILABLE"],
            requiredControls: [],
            missingControls: [],
            rejectionReason: stderr || err.message || "Bridge unavailable — fail-closed",
            authorizedExecution: null,
          });
          return;
        }
        try {
          resolve(JSON.parse(stdout) as BridgeResult);
        } catch (parseErr: any) {
          resolve({
            allowed: false,
            verdict: "HOLD_UNCLASSIFIED",
            reasonCodes: ["BRIDGE_PARSE_ERROR"],
            requiredControls: [],
            missingControls: [],
            rejectionReason: `Bridge output parse error: ${parseErr.message}`,
            authorizedExecution: null,
          });
        }
      }
    );
    child.stdin?.write(payload);
    child.stdin?.end();
  });
}

/**
 * Convenience wrapper: authorize and throw if denied.
 * Use in mutation handlers to fail-fast with clear rejection.
 */
export async function requireAuthorization(input: BridgeInput): Promise<BridgeResult> {
  const result = await callAuthorizeMutationBridge(input);
  if (!result.allowed) {
    const err: any = new Error(
      `MUTATION_GATE: ${result.verdict} — ${(result.reasonCodes || []).join(", ")}`
    );
    err.code = "MUTATION_GATE_DENIED";
    err.verdict = result.verdict;
    err.reasonCodes = result.reasonCodes;
    throw err;
  }
  return result;
}
