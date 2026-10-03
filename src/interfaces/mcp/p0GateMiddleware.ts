/**
 * P0 Gate Middleware — Stub (module pending full implementation).
 * Forged 2026-08-05 to unblock A-FORGE build for FQ gate deployment.
 *
 * ⚠ UNWIRED since 2026-10-03 (F13 order: REMOVE). Nothing imports this module.
 * The call site in serve.ts was deleted because this stub returned passed:true
 * unconditionally, so the live path implied a constitutional gate that never
 * gated anything. Do not re-wire it until it evaluates something real.
 * Actual pre-execution enforcement: arifJudge (shell/forgeShell.ts Step 1,
 * classifyCommand at :883/:1128) + the session gate.
 * Evidence: forge_work/2026-10-03-adk-geox/ADK-DOSSIER-20261003.md §4.1.
 *
 * Real implementation: pre-execution P0 gate that validates tool calls
 * against constitutional invariants before A-FORGE executes.
 */
export interface GateRejection {
  blocked: boolean;
  reason: string;
  gate: string;
  recoverability: 'FULL' | 'PARTIAL' | 'NONE';
  evaluations: any[];
}

export interface P0GateInput {
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
  actorId?: string;
  leaseId?: string;
  act?: string;
}

export interface P0GateResult {
  passed: boolean;
  gate: string;
  recoverability: 'FULL' | 'PARTIAL' | 'NONE';
  evaluations: any[];
  rejections: GateRejection[];
}

export function runP0GateMiddleware(input: P0GateInput): P0GateResult {
  // Stub — always passes. Real implementation gated by operatorAuth module completion.
  return {
    passed: true,
    gate: 'P0',
    recoverability: 'FULL',
    evaluations: [],
    rejections: [],
  };
}

export function formatGateRejection(reason: string | P0GateResult): GateRejection {
  if (typeof reason !== 'string') {
    return { blocked: !reason.passed, reason: 'P0 gate result', gate: 'P0', recoverability: reason.recoverability, evaluations: reason.evaluations };
  }
  return { blocked: true, reason, gate: 'P0', recoverability: 'PARTIAL', evaluations: [] };
}
