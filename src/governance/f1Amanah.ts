/**
 * F1 AMANAH — Integrity, reversibility, blast radius, stewardship.
 *
 * "No irreversible action without stewardship, blast-radius check, and
 *  audit trail. Reversible-first."
 *
 * Verdict semantics:
 * - SEAL: action is reversible + bounded blast radius
 * - HOLD: action is high-blast-radius or missing reversibility evidence
 * - VOID: action is irreversible AND not stewarded (e.g. no rollback plan)
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F1 Amanah — trust as lockable contract
 */

import type { ActionRequest, FloorContext } from "../types/action-request.js";
import type { FloorReason } from "./floor-types.js";

/**
 * F1 verdict on a single action.
 * Returns an array of FloorReason (zero or more).
 */
export function checkF1Amanah(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;

  // Rule 1: Every action needs an actor + session
  if (!a.actor || a.actor.trim().length === 0) {
    reasons.push({
      floor: "F1",
      code: "ACTOR_MISSING",
      message: "F1 AMANAH: every action must declare an actor",
      severity: "VOID",
    });
  }
  if (!a.session_id || a.session_id.trim().length === 0) {
    reasons.push({
      floor: "F1",
      code: "SESSION_MISSING",
      message: "F1 AMANAH: every action must declare a session_id",
      severity: "VOID",
    });
  }

  // Rule 2: reversibility_score must be in [0, 1]
  if (a.reversibility_score !== undefined) {
    if (a.reversibility_score < 0 || a.reversibility_score > 1) {
      reasons.push({
        floor: "F1",
        code: "REVERSIBILITY_OUT_OF_RANGE",
        message: `F1 AMANAH: reversibility_score must be in [0,1], got ${a.reversibility_score}`,
        severity: "VOID",
      });
    }
  }

  // Rule 3: HIGH-BLAST-RADIUS actions with low reversibility → HOLD
  if (
    a.blast_radius !== undefined &&
    a.reversibility_score !== undefined &&
    a.reversibility_score < 0.3 &&
    (a.blast_radius === "service" ||
      a.blast_radius === "vps" ||
      a.blast_radius === "federation" ||
      a.blast_radius === "external")
  ) {
    reasons.push({
      floor: "F1",
      code: "HIGH_BLAST_LOW_REVERSIBILITY",
      message: `F1 AMANAH: blast_radius=${a.blast_radius} with reversibility=${a.reversibility_score} requires explicit stewardship`,
      severity: "HOLD",
    });
  }

  // Rule 4: Destructive actions without rollback plan → HOLD (F1 + F5 pair)
  const isDestructive = [
    "DELETE", "VAULT_SEAL", "PRODUCTION_DEPLOY",
    "FINANCIAL_TRANSACTION", "SECRET_ROTATION",
    "CONSTITUTIONAL_FLOOR_CHANGE", "INFRASTRUCTURE_RESTART",
  ].includes(a.action_type);

  if (isDestructive && (!a.rollback_plan || a.rollback_plan.trim().length === 0)) {
    reasons.push({
      floor: "F1",
      code: "DESTRUCTIVE_NO_ROLLBACK",
      message: `F1 AMANAH: action_type=${a.action_type} is destructive; rollback_plan is required`,
      severity: "HOLD",
    });
  }

  // Rule 5: Constitutional floor changes always HOLD
  if (a.action_type === "CONSTITUTIONAL_FLOOR_CHANGE") {
    reasons.push({
      floor: "F1",
      code: "FLOOR_CHANGE_NEEDS_F13",
      message: "F1 AMANAH: constitutional floor changes require explicit F13 ratification",
      severity: "HOLD",
    });
  }

  return reasons;
}
