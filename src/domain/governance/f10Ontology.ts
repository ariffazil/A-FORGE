/**
 * F10 ONTOLOGY — Category and schema integrity floor.
 *
 * "Every action must declare its shape completely. Schema invalid = VOID.
 *  Semantically incomplete = HOLD."
 *
 * Required fields per ActionRequest:
 *   action_id, tool_name, action_type, target, tier, actor,
 *   session_id, intent, expected_outcome
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F10 ONTOLOGY — schema and category integrity
 */

import { ALL_CATEGORIES } from "../types/action-request.js";
import type { FloorContext } from "../types/action-request.js";
import type { FloorReason } from "./floor-types.js";

const REQUIRED_FIELDS = [
  "action_id", "tool_name", "action_type", "target", "tier",
  "actor", "session_id", "intent", "expected_outcome",
] as const;

const MUTATING_CATEGORIES = new Set([
  "WRITE", "DELETE", "EXECUTE", "NETWORK_OUT", "FORM_SUBMIT",
  "EMAIL_SEND", "DATABASE_WRITE", "VAULT_SEAL", "PRODUCTION_DEPLOY",
  "FINANCIAL_TRANSACTION", "SECRET_ROTATION",
  "CONSTITUTIONAL_FLOOR_CHANGE", "AGENT_SPAWN", "AGENT_HALT",
  "MEMORY_WRITE", "INFRASTRUCTURE_RESTART",
]);

/**
 * F10 verdict on a single action.
 */
export function checkF10Ontology(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;

  // Rule 1: Required fields present
  for (const field of REQUIRED_FIELDS) {
    const v = (a as any)[field];
    if (v === undefined || v === null || (typeof v === "string" && v.trim().length === 0)) {
      reasons.push({
        floor: "F10",
        code: `FIELD_MISSING:${field}`,
        message: `F10 ONTOLOGY: required field '${field}' is missing or empty`,
        severity: "VOID",
      });
    }
  }

  // Rule 2: action_type must be in ALL_CATEGORIES
  if (!ALL_CATEGORIES.includes(a.action_type)) {
    reasons.push({
      floor: "F10",
      code: "ACTION_TYPE_INVALID",
      message: `F10 ONTOLOGY: action_type='${a.action_type}' not in canonical category list`,
      severity: "VOID",
    });
  }

  // Rule 3: target must be declared for mutating actions
  if (MUTATING_CATEGORIES.has(a.action_type)) {
    if (!a.target || a.target.trim().length === 0) {
      reasons.push({
        floor: "F10",
        code: "MUTATION_TARGET_MISSING",
        message: `F10 ONTOLOGY: mutating action_type=${a.action_type} requires target`,
        severity: "VOID",
      });
    }
  }

  // Rule 4: tier must be 0-5
  if (a.tier < 0 || a.tier > 5 || !Number.isInteger(a.tier)) {
    reasons.push({
      floor: "F10",
      code: "TIER_INVALID",
      message: `F10 ONTOLOGY: tier must be integer 0-5, got ${a.tier}`,
      severity: "VOID",
    });
  }

  // Rule 5: malformed OutcomeSpec (if present) — schema check
  if (a.mission) {
    const o = a.mission.outcome;
    if (!o || typeof o.objective !== "string" || o.objective.length < 10) {
      reasons.push({
        floor: "F10",
        code: "OUTCOME_SPEC_MALFORMED",
        message: "F10 ONTOLOGY: attached Mission has malformed outcome.objective",
        severity: "VOID",
      });
    }
    if (!Array.isArray(o?.success_criteria) || o.success_criteria.length === 0) {
      reasons.push({
        floor: "F10",
        code: "OUTCOME_SPEC_NO_CRITERIA",
        message: "F10 ONTOLOGY: attached Mission has no success_criteria",
        severity: "HOLD",
      });
    }
  }

  return reasons;
}
