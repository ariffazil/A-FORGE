/**
 * F2 TRUTH — Uncertainty band, source citation, epistemic tier.
 *
 * "Every model output must declare its epistemic tier and evidence basis
 *  before any downstream action."
 *
 * Verdict semantics:
 * - SEAL: tier >= 3 AND evidence_count >= 1
 * - HOLD: tier 1-2 (PLAUSIBLE/ESTIMATE) — needs human context
 * - VOID: tier 0 (UNKNOWN) — refuse to act on unassessed claim
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F2 Truth — cite the uncertainty or say UNKNOWN
 */

import type { FloorContext } from "../types/action-request.js";
import type { FloorReason } from "./floor-types.js";

/**
 * F2 verdict on a single action.
 * Returns an array of FloorReason.
 */
export function checkF2Truth(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;

  // Rule 1: Model inference actions must declare tier + evidence
  const requiresEpistemic = [
    "EXECUTE", "WRITE", "DELETE", "DATABASE_WRITE", "VAULT_SEAL",
    "PRODUCTION_DEPLOY", "FINANCIAL_TRANSACTION",
    "CONSTITUTIONAL_FLOOR_CHANGE",
  ].includes(a.action_type);

  if (requiresEpistemic) {
    // Tier 0 (UNKNOWN) → VOID
    if (a.tier === 0) {
      reasons.push({
        floor: "F2",
        code: "TIER_UNKNOWN",
        message: "F2 TRUTH: cannot act on UNKNOWN tier (0); must assess first",
        severity: "VOID",
      });
    }
    // Tier 1-2 (HYPOTHESIS/ESTIMATE) → HOLD
    else if (a.tier === 1 || a.tier === 2) {
      reasons.push({
        floor: "F2",
        code: "TIER_LOW",
        message: `F2 TRUTH: tier=${a.tier} (HYPOTHESIS/ESTIMATE) requires human context before action`,
        severity: "HOLD",
      });
    }
    // Tier 3+ (PLAUSIBLE+) is OK; we still check evidence below

    // Evidence count check (only for tier 3+)
    if (a.tier >= 3 && (a.evidence_count === undefined || a.evidence_count < 1)) {
      reasons.push({
        floor: "F2",
        code: "EVIDENCE_MISSING",
        message: "F2 TRUTH: tier >= 3 requires at least 1 evidence reference",
        severity: "HOLD",
      });
    }
  }

  return reasons;
}
