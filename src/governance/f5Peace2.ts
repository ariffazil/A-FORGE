/**
 * F5 PEACE² — Non-destructive stability floor.
 *
 * "Prevent actions that increase systemic instability, harm, runaway
 *  escalation, or destructive side effects."
 *
 * Verdict semantics:
 * - SEAL: read-only action
 * - CAUTION: explicit rollback + narrow blast radius
 * - HOLD: destructive AND no rollback plan; OR live-service blast
 * - VOID: never alone; pairs with F1/F9/F11/F12/F13
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F5 PEACE² — non-destructive stability
 */

import type { FloorContext } from "../types/action-request.js";
import { F5_DESTRUCTIVE_VERBS } from "../types/action-request.js";
import type { FloorReason } from "./floor-types.js";

/** Verbs in tool_name that trigger F5. */
const DESTRUCTIVE_VERB_PATTERN = new RegExp(
  `\\b(${F5_DESTRUCTIVE_VERBS.join("|")})\\b`,
  "i"
);

/**
 * F5 verdict on a single action.
 */
export function checkF5Peace2(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;

  // Rule 1: Destructive tool_name pattern → check rollback
  const hasDestructiveVerb = DESTRUCTIVE_VERB_PATTERN.test(a.tool_name) ||
    DESTRUCTIVE_VERB_PATTERN.test(a.action_type) ||
    DESTRUCTIVE_VERB_PATTERN.test(a.intent);

  if (hasDestructiveVerb) {
    if (!a.rollback_plan || a.rollback_plan.trim().length === 0) {
      reasons.push({
        floor: "F5",
        code: "DESTRUCTIVE_NO_ROLLBACK",
        message: `F5 PEACE²: destructive verb detected in tool_name/intent; rollback_plan required`,
        severity: "HOLD",
      });
    } else {
      reasons.push({
        floor: "F5",
        code: "DESTRUCTIVE_WITH_ROLLBACK",
        message: `F5 PEACE²: destructive action has rollback plan; proceed with caution`,
        severity: "CAUTION",
      });
    }
  }

  // Rule 2: Live-service blast radius → HOLD
  if (
    a.blast_radius === "service" ||
    a.blast_radius === "vps" ||
    a.blast_radius === "federation"
  ) {
    const liveServiceAffecting = [
      "INFRASTRUCTURE_RESTART",
      "PRODUCTION_DEPLOY",
      "EXECUTE",
    ].includes(a.action_type);

    if (liveServiceAffecting) {
      reasons.push({
        floor: "F5",
        code: "LIVE_SERVICE_BLAST",
        message: `F5 PEACE²: action_type=${a.action_type} with blast_radius=${a.blast_radius} affects live services; HOLD`,
        severity: "HOLD",
      });
    }
  }

  // Rule 3: chmod-777 / rotate-secret / reset at external blast → HOLD
  if (
    a.intent.match(/\b(chmod-?777|chmod\s+777|rotate-secret|force-reset|hard-reset)\b/i) &&
    (a.blast_radius === "external" || a.blast_radius === "federation")
  ) {
    reasons.push({
      floor: "F5",
      code: "EXTERNAL_DESTRUCTIVE_ESCALATION",
      message: "F5 PEACE²: external blast radius with chmod-777 / rotate-secret / hard-reset is a serious escalation",
      severity: "HOLD",
    });
  }

  // Rule 4: Read-only actions → CAUTION at most (no HOLD)
  if (a.action_type === "READ" || a.action_type === "VAULT_READ" || a.action_type === "MEMORY_READ") {
    // No reasons — read-only is intrinsically stable
  }

  return reasons;
}
