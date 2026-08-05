/**
 * check_verdict.ts — Pre-execution Verdict Precondition
 * ======================================================
 * A-FORGE must not execute MUTATE or ATOMIC actions without
 * a valid SEAL verdict for the action class.
 *
 * This module checks: "was a SEAL issued for this action_class
 * before I execute?"
 *
 * Gate chain (inclusive — cannot be bypassed):
 *   1. FQ Metabolic Gate (FQ < 0.5 → HOLD, Acemoglu-Negentropy)
 *   2. Verdict Gate (MUTATE requires SEAL, F2/F8)
 *   3. AC_Risk Gate (AC_Risk > threshold → HOLD, F12)
 *   4. Circuit Breaker Gate (paradox active → HOLD, F3)
 *   5. Simulation Gate (sim_index > 0.5 → verify, F9)
 *
 * APEX Unified Theory integration:
 * - ToAC: If AC_Risk >= 0.35, block MUTATE even with SEAL
 * - Paradox: If circuit breakers active, downgrade to advisory
 * - Simulative: If simulation_index > 0.5, require explicit check
 * - FQ Metabolic: If Flow Quotient < 0.50, system is closing —
 *   MUTATE blocked. Agents must verify to raise FQ.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export type ActionClass = 'OBSERVE' | 'DERIVE' | 'MUTATE' | 'ATOMIC';

export interface VerdictPrecondition {
  permitted: boolean;
  actionClass: ActionClass;
  requiredVerdict: 'SEAL' | 'SABAR' | 'HOLD' | 'NONE';
  currentVerdict: string | null;
  acRisk: number;
  simulationIndex: number;
  circuitBreakersActive: string[];
  reason: string;
}

export interface SessionVerdictState {
  actionClass: ActionClass;
  verdict: 'SEAL' | 'SABAR' | 'HOLD' | 'VOID' | null;
  confidence: number;
  acRisk: number;
  simulationIndex: number;
  circuitBreakers: string[];
  timestamp: number;
}

// ── Verdict requirements per action class ──────────────────────────

const VERDICT_REQUIREMENTS: Record<ActionClass, 'SEAL' | 'SABAR' | 'HOLD' | 'NONE'> = {
  OBSERVE: 'NONE',     // Reading requires no verdict
  DERIVE: 'NONE',      // Computation requires no verdict
  MUTATE: 'SEAL',      // Modification requires SEAL
  ATOMIC: 'SEAL',      // Irreversible action requires SEAL
};

const AC_RISK_THRESHOLDS: Record<ActionClass, number> = {
  OBSERVE: 0.60,       // Can observe even with high AC_Risk
  DERIVE: 0.35,        // Computation blocked at high AC_Risk
  MUTATE: 0.15,        // Modification blocked at moderate AC_Risk
  ATOMIC: 0.15,        // Irreversible blocked at moderate AC_Risk
};

// ── FQ Metabolic Gate (Acemoglu-Negentropy Principle) ──────────────

const FQ_GATE_THRESHOLD = 0.50;        // FQ below this → system closing → HOLD
const ARIFLOW_URL = process.env.ARIFLOW_URL || 'http://127.0.0.1:7073';
const FQ_CACHE_TTL_MS = 15_000;        // Cache arifFlow result for 15s to avoid thundering herd

interface FqState {
  quotient: number;
  verdict: string;
  executeCount: number;
  verifyCount: number;
  timestamp: number;
}

let _fqCache: FqState | null = null;

async function probeFq(): Promise<FqState> {
  // Return cached value if fresh
  if (_fqCache && (Date.now() - _fqCache.timestamp) < FQ_CACHE_TTL_MS) {
    return _fqCache;
  }

  try {
    const resp = await fetch(`${ARIFLOW_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const fq = data.fq || {};
    _fqCache = {
      // FAIL-CLOSED: if arifFlow returns null/non-numeric quotient (post-restart window,
      // unknown schema, or partial response), default to 0.0 so the gate HOLDs MUTATE/ATOMIC.
      // Previously defaulted to 0.5 which made null FQ pass the gate — constitutional gap.
      // The arifFlow-unreachable case (catch block below) already fails closed.
      quotient: typeof fq.quotient === 'number' ? fq.quotient : 0.0,
      verdict: fq.verdict || 'UNKNOWN',
      executeCount: fq.execute_count || 0,
      verifyCount: fq.verify_count || 0,
      timestamp: Date.now(),
    };
    return _fqCache;
  } catch {
    // arifFlow unreachable — fail closed: block MUTATE
    return {
      quotient: 0.0,
      verdict: 'UNREACHABLE',
      executeCount: 0,
      verifyCount: 0,
      timestamp: Date.now(),
    };
  }
}

export interface FqGateResult {
  permitted: boolean;
  fq: number;
  verdict: string;
  reason: string;
}

/**
 * FQ Metabolic Gate — the inclusive institution that prevents
 * the execute gradient from capturing the verify feedback loop.
 *
 * Acemoglu-Negentropy principle: FQ is the metabolic signal that
 * detects when the system is closing (execute outpacing verify).
 * FQ < 0.50 → HOLD. This is NOT advisory. This is constitutional.
 *
 * Bila FQ turun, semua HOLD. Bila FQ naik, semua forge.
 */
export async function checkFqGate(actionClass: ActionClass): Promise<FqGateResult> {
  // FQ gate applies only to MUTATE and ATOMIC — OBSERVE/DERIVE always pass
  if (actionClass !== 'MUTATE' && actionClass !== 'ATOMIC') {
    return { permitted: true, fq: -1, verdict: 'EXEMPT', reason: `${actionClass} exempt from FQ gate` };
  }

  const state = await probeFq();

  if (state.verdict === 'UNREACHABLE') {
    return {
      permitted: false,
      fq: 0,
      verdict: 'UNREACHABLE',
      reason: 'arifFlow unreachable — cannot verify metabolic health. MUTATE blocked (fail-closed).',
    };
  }

  if (state.quotient < FQ_GATE_THRESHOLD) {
    return {
      permitted: false,
      fq: state.quotient,
      verdict: state.verdict,
      reason: `FQ=${state.quotient.toFixed(3)} < 0.50 — metabolic STUCK. Execute=${state.executeCount} Verify=${state.verifyCount}. Agents must verify to raise FQ before MUTATE is permitted.`,
    };
  }

  return {
    permitted: true,
    fq: state.quotient,
    verdict: state.verdict,
    reason: `FQ=${state.quotient.toFixed(3)} — metabolic gate passed.`,
  };
}

/**
 * Check whether an action class is preconditied on a verdict.
 */
export function getRequiredVerdict(actionClass: ActionClass): 'SEAL' | 'SABAR' | 'HOLD' | 'NONE' {
  return VERDICT_REQUIREMENTS[actionClass];
}

/**
 * Extended verdict precondition result — includes FQ metabolic state.
 */
export interface FullVerdictPrecondition extends VerdictPrecondition {
  fqGate?: FqGateResult;
  fqChecked: boolean;
}

/**
 * Check if a session has a valid verdict for the given action class.
 * This is the core precondition gate for A-FORGE execution.
 *
 * Gate chain (in order — any HOLD blocks execution):
 *   1. FQ Metabolic Gate — system must not be closing
 *   2. Session Gate — must have valid session state
 *   3. Circuit Breaker Gate — no active paradox breakers
 *   4. AC_Risk Gate — anomalous contrast within threshold
 *   5. Verdict Gate — session must carry required verdict
 *
 * This is the Acemoglu-Negentropy architecture: each gate is an
 * inclusive institution. None prevents failure — each prevents the
 * gradient from capturing the feedback mechanism that detects failure.
 */
export async function checkVerdictPrecondition(
  actionClass: ActionClass,
  sessionState: SessionVerdictState | null,
): Promise<FullVerdictPrecondition> {
  const requiredVerdict = VERDICT_REQUIREMENTS[actionClass];
  const acThreshold = AC_RISK_THRESHOLDS[actionClass];
  const activeBreakers = sessionState?.circuitBreakers ?? [];
  const acRisk = sessionState?.acRisk ?? 0.50;
  const simIndex = sessionState?.simulationIndex ?? 0.0;

  // ── GATE 1: FQ Metabolic Gate (inclusive — cannot be bypassed) ──
  const fqGate = await checkFqGate(actionClass);
  if (!fqGate.permitted) {
    return {
      permitted: false,
      actionClass,
      requiredVerdict,
      currentVerdict: sessionState?.verdict ?? null,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `FQ Metabolic Gate HOLD: ${fqGate.reason}`,
      fqGate,
      fqChecked: true,
    };
  }

  // OBSERVE and DERIVE don't require verdicts
  if (requiredVerdict === 'NONE') {
    return {
      permitted: true,
      actionClass,
      requiredVerdict,
      currentVerdict: sessionState?.verdict ?? null,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `${actionClass} actions do not require a precondition verdict. Proceed.`,
      fqGate,
      fqChecked: true,
    };
  }

  // No session state → can't verify → block MUTATE/ATOMIC
  if (!sessionState || !sessionState.verdict) {
    return {
      permitted: false,
      actionClass,
      requiredVerdict,
      currentVerdict: null,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `No verdict state for session. ${actionClass} requires ${requiredVerdict} before execution. Run deliberate() first.`,
      fqGate,
      fqChecked: true,
    };
  }

  // Circuit breakers active → downgrade even with SEAL
  if (activeBreakers.length > 0 && actionClass !== 'OBSERVE') {
    return {
      permitted: false,
      actionClass,
      requiredVerdict,
      currentVerdict: sessionState.verdict,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `Circuit breakers active: [${activeBreakers.join(', ')}]. ${actionClass} blocked — paradox state must clear before execution.`,
      fqGate,
      fqChecked: true,
    };
  }

  // AC_Risk exceeds threshold for this action class
  if (acRisk > acThreshold) {
    return {
      permitted: false,
      actionClass,
      requiredVerdict,
      currentVerdict: sessionState.verdict,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `AC_Risk ${acRisk.toFixed(2)} exceeds ${actionClass} threshold ${acThreshold}. Anomalous contrast too high for safe execution.`,
      fqGate,
      fqChecked: true,
    };
  }

  // Verdict mismatch
  if (sessionState.verdict !== requiredVerdict) {
    const actionName = requiredVerdict === 'SEAL' ? 'SEAL' : requiredVerdict;
    return {
      permitted: false,
      actionClass,
      requiredVerdict,
      currentVerdict: sessionState.verdict,
      acRisk,
      simulationIndex: simIndex,
      circuitBreakersActive: activeBreakers,
      reason: `Session verdict is "${sessionState.verdict}" but ${actionClass} requires "${requiredVerdict}". Obtain ${actionName} before execution.`,
      fqGate,
      fqChecked: true,
    };
  }

  // All checks passed
  return {
    permitted: true,
    actionClass,
    requiredVerdict,
    currentVerdict: sessionState.verdict,
    acRisk,
    simulationIndex: simIndex,
    circuitBreakersActive: activeBreakers,
    reason: `Verdict precondition satisfied. ${sessionState.verdict} permits ${actionClass} execution.`,
    fqGate,
    fqChecked: true,
  };
}

/**
 * Check whether the simulation index requires a verdict check.
 * simulation_index > 0.5 means the agent is performing, not describing.
 */
export function requiresVerdictCheck(simulationIndex: number): boolean {
  return simulationIndex > 0.5;
}
