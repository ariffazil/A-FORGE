/**
 * check_verdict.ts — Pre-execution Verdict Precondition
 * ======================================================
 * A-FORGE must not execute MUTATE or ATOMIC actions without
 * a valid SEAL verdict for the action class.
 *
 * This module checks: "was a SEAL issued for this action_class
 * before I execute?"
 *
 * APEX Unified Theory integration:
 * - ToAC: If AC_Risk >= 0.35, block MUTATE even with SEAL
 * - Paradox: If circuit breakers active, downgrade to advisory
 * - Simulative: If simulation_index > 0.5, require explicit check
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

/**
 * Check whether an action class is preconditied on a verdict.
 */
export function getRequiredVerdict(actionClass: ActionClass): 'SEAL' | 'SABAR' | 'HOLD' | 'NONE' {
  return VERDICT_REQUIREMENTS[actionClass];
}

/**
 * Check if a session has a valid verdict for the given action class.
 * This is the core precondition gate for A-FORGE execution.
 */
export function checkVerdictPrecondition(
  actionClass: ActionClass,
  sessionState: SessionVerdictState | null,
): VerdictPrecondition {
  const requiredVerdict = VERDICT_REQUIREMENTS[actionClass];
  const acThreshold = AC_RISK_THRESHOLDS[actionClass];
  const activeBreakers = sessionState?.circuitBreakers ?? [];
  const acRisk = sessionState?.acRisk ?? 0.50;
  const simIndex = sessionState?.simulationIndex ?? 0.0;

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
  };
}

/**
 * Check whether the simulation index requires a verdict check.
 * simulation_index > 0.5 means the agent is performing, not describing.
 */
export function requiresVerdictCheck(simulationIndex: number): boolean {
  return simulationIndex > 0.5;
}
