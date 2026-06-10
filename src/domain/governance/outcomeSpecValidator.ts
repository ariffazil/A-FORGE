/**
 * OutcomeSpec Validator — pure code, no LLM, no side effects.
 *
 * Validates a parsed Mission (OutcomeSpec + RunConfig) against
 * constitutional and policy rules. Returns a ValidationReceipt with
 * verdict (SEAL | HOLD | VOID) and the SHA-256 of the spec.
 *
 * Sits between mission intake and DAG planner. No LLM, no agent, no
 * orchestrator can bypass this gate.
 *
 * Plan: PLAN-2026-06-06-P5-GoalPlane
 *
 * @constitutional F1 Amanah — the spec hash is the trust anchor
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type Mission,
  materialize,
  triggersHold,
  sensitivityRequiresHuman,
  type SensitivityLevel,
} from "../types/outcome-spec.js";

// ─── Verdict and receipt types ────────────────────────────────────────

export type Verdict = "SEAL" | "HOLD" | "VOID";

export interface ValidationReceipt {
  verdict: Verdict;
  reasons: string[];
  epoch_id: string;
  spec_hash: string;
  spec_summary: {
    objective_first_line: string;
    sensitivity: string;
    success_criteria_count: number;
    evidence_required_count: number;
  };
  warnings: string[];
  validated_at: string;
}

// ─── Hash function ────────────────────────────────────────────────────

/**
 * Canonical JSON for hashing (sorted keys, no whitespace).
 * Ensures the same spec always produces the same hash.
 */
function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k]))
      .join(",") +
    "}"
  );
}

export function specHash(mission: Mission): string {
  // Hash the materialized form so default-applied values are stable
  const m = materialize(mission);
  const payload = {
    outcome: m.outcome,
    run: m.run,
    name: mission.name,
    parent_plan_id: mission.parent_plan_id,
  };
  const canonical = canonicalJSON(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

// ─── Objective line extraction ────────────────────────────────────────

function firstLine(s: string): string {
  const idx = s.indexOf("\n");
  return (idx === -1 ? s : s.slice(0, idx)).trim().slice(0, 200);
}

// ─── Main validator ────────────────────────────────────────────────────

/**
 * Validate a mission contract. Returns a ValidationReceipt.
 * Does NOT mutate input. Does NOT call any external service.
 * Pure function — same input always produces same output.
 */
export function validateMission(mission: Mission): ValidationReceipt {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const epoch_id = randomUUID();
  const validated_at = new Date().toISOString();

  const mat = materialize(mission);
  const outcome = mat.outcome;
  const run = mat.run;

  // ── 1. Objective sanity ──
  if (outcome.objective.length < 10) {
    reasons.push("OBJECTIVE_TOO_SHORT: must be at least 10 characters to be falsifiable");
  }
  if (outcome.objective.length > 2000) {
    reasons.push("OBJECTIVE_TOO_LONG: max 2000 characters");
  }

  // ── 2. Success criteria non-empty and distinct ──
  if (outcome.success_criteria.length === 0) {
    reasons.push("NO_SUCCESS_CRITERIA: mission has no way to be proven complete");
  }
  const seenCriteria = new Set<string>();
  for (const c of outcome.success_criteria) {
    const norm = c.trim().toLowerCase();
    if (seenCriteria.has(norm)) {
      warnings.push(`DUPLICATE_SUCCESS_CRITERIA: "${c.slice(0, 60)}"`);
    }
    seenCriteria.add(norm);
  }

  // ── 3. Reversibility coherence ──
  if (outcome.reversibility_required && outcome.sensitivity === "SOVEREIGN") {
    warnings.push(
      "SOVEREIGN_TIER_WITH_REVERSIBILITY: sovereign actions are typically irreversible"
    );
  }

  // ── 4. Tool scope vs allowed_tools ──
  const toolScope = outcome.constraints.tool_scope;
  if (toolScope && toolScope.length > 0 && run.allowed_tools.length > 0) {
    const outcomeTools = new Set(toolScope);
    const runTools = new Set(run.allowed_tools);
    const conflict: string[] = [];
    for (const t of outcomeTools) {
      if (!runTools.has(t)) {
        conflict.push(t);
      }
    }
    if (conflict.length > 0) {
      warnings.push(
        `TOOL_SCOPE_PARTIAL_OVERLAP: outcome.constraints.tool_scope has ${conflict.length} tools not in run.allowed_tools`
      );
    }
  }

  // ── 5. Budget coherence ──
  const constraintCost = outcome.constraints.cost_budget_usd;
  if (constraintCost !== undefined) {
    const runCost = run.budget_limit.cost_usd;
    if (runCost !== undefined && runCost > constraintCost) {
      reasons.push(
        `BUDGET_OVERRIDE: run.budget_limit.cost_usd (${runCost}) exceeds outcome.constraints.cost_budget_usd (${constraintCost})`
      );
    }
  }

  // ── 6. Wall-clock coherence ──
  const constraintTime = outcome.constraints.time_budget_seconds;
  if (constraintTime !== undefined && run.max_wall_clock_seconds > constraintTime) {
    warnings.push(
      `WALL_CLOCK_OVER_BUDGET: run.max_wall_clock_seconds (${run.max_wall_clock_seconds}) exceeds outcome.constraints.time_budget_seconds (${constraintTime})`
    );
  }

  // ── 7. SOVEREIGN tier always requires human ──
  if (sensitivityRequiresHuman(outcome.sensitivity)) {
    warnings.push(
      "SOVEREIGN_TIER: all consequential actions of this mission require explicit F13 ratification before execution"
    );
  }

  // ── 8. Approval policy coherence ──
  if (run.approval_policy.auto_approve_below > run.approval_policy.hold_above) {
    reasons.push(
      `APPROVAL_POLICY_INVERTED: auto_approve_below (${run.approval_policy.auto_approve_below}) > hold_above (${run.approval_policy.hold_above})`
    );
  }

  // ── Verdict ──
  let verdict: Verdict;
  if (reasons.length > 0) {
    verdict = "VOID";
  } else if (
    sensitivityRequiresHuman(outcome.sensitivity) ||
    warnings.some((w) => w.startsWith("SOVEREIGN_TIER"))
  ) {
    verdict = "HOLD";
  } else {
    verdict = "SEAL";
  }

  return {
    verdict,
    reasons,
    epoch_id,
    spec_hash: specHash(mission),
    spec_summary: {
      objective_first_line: firstLine(outcome.objective),
      sensitivity: outcome.sensitivity,
      success_criteria_count: outcome.success_criteria.length,
      evidence_required_count: outcome.evidence_required.length,
    },
    warnings,
    validated_at,
  };
}

/**
 * Convenience: validate and return just the verdict.
 */
export function quickVerdict(mission: Mission): Verdict {
  return validateMission(mission).verdict;
}

/**
 * Convenience: check if a specific action class needs 888_HOLD for this mission.
 */
export function missionActionRequiresHold(
  mission: Mission,
  actionClass: string
): boolean {
  const sensitivity: SensitivityLevel = mission.outcome.sensitivity ?? "MEDIUM";
  return triggersHold(actionClass, sensitivity);
}
