/**
 * Mission Contract — The expected-outcome contract between arifOS, A-FORGE,
 * and the calling agent. Every ephemeral tool invocation is paired with a
 * MissionContract that declares what success looks like, what side effects
 * are allowed, what budget applies, and what verifier attests to the result.
 *
 * ═══ P1.4 RATIFIED (2026-07-31) — MISSION CONTRACT FIRST ═════════════════
 *
 * A capability without a mission is a tool without purpose. Every
 * ephemeral or permanent tool lease MUST cite a MissionContract. The
 * contract is sealed into the verifier receipt — its terms are what
 * arif_judge reads when evaluating promotion or scar.
 *
 * @module forge/missionContract
 * @constitutional F1 AMANAH — every mission declares its allowed side effects
 * @constitutional F2 TRUTH — every mission names its expected outcome
 * @constitutional F5 PEACE² — every mission declares its non-destructive power
 * @constitutional F11 AUDIT — every mission contract is hash-bound to the receipt
 */

import { z } from "zod";
import type { CapabilityAbi } from "./capabilityAbi.js";

// ── Acceptance criterion ────────────────────────────────────────────────────

export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  /** Schema path to evaluate against the tool output. */
  output_path: z.string().optional(),
  /** Expected value or JSON-pointer reference. */
  expected: z.unknown().optional(),
  /** Numeric tolerance for float comparisons. */
  tolerance: z.number().optional(),
  /** Boolean predicate string (e.g. "length > 0"). Evaluated by external witness. */
  predicate: z.string().optional(),
  /** Hard-fail the mission if this criterion fails. */
  hard: z.boolean().default(true),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

// ── Allowed side effects ───────────────────────────────────────────────────

export const AllowedSideEffectSchema = z.object({
  kind: z.enum([
    "fs_write",
    "fs_delete",
    "network_request",
    "process_spawn",
    "db_mutation",
    "external_api_call",
    "credential_use",
    "state_seal",
  ]),
  /** Optional path/domain constraint. Empty = unbounded within authority class. */
  scope: z.string().optional(),
  /** Whether this side effect requires human pre-approval. */
  requires_approval: z.boolean().default(false),
});

// ── Verifier contract ──────────────────────────────────────────────────────

export const MissionVerifierSchema = z.object({
  /** Verifier method (must be external — never SELF_CERTIFIED). */
  method: z.enum([
    "known_answer",
    "schema_invariant",
    "independent_recompute",
    "differential_testing",
    "domain_witness",
    "metamorphic_testing",
    "external_ground_truth",
  ]),
  /** Witness organ or actor id that runs the verifier. */
  witness_actor_id: z.string().min(1),
  /** Acceptance criteria this verifier checks. */
  criteria_ids: z.array(z.string()).min(1),
});

// ── Rollback plan ──────────────────────────────────────────────────────────

export const RollbackPlanSchema = z.object({
  /** Strategy declared in the capability ABI. */
  strategy: z.enum([
    "none",
    "transactional",
    "compensating_action",
    "human_undo_required",
  ]),
  /** Concrete steps the runtime can replay to undo the mission. */
  steps: z.array(z.string()).default([]),
  /** Estimated total wall-clock for full rollback. */
  estimated_ms: z.number().int().min(0).default(0),
  /** If true, rollback MUST complete before the mission is signed off. */
  must_complete_before_signoff: z.boolean().default(false),
});

// ── Full MissionContract ──────────────────────────────────────────────────

export const MissionContractSchema = z.object({
  mission_id: z.string().min(1),
  /** The capability this mission binds. */
  capability_id: z.string().min(1),
  /** Reference to the capability ABI (so the verifier can re-check declared bounds). */
  capability_abi_ref: z.string().min(1),
  /** Mission intent — one sentence, what the human wanted. */
  expected_outcome: z.string().min(10).max(2000),
  /** What acceptance looks like. */
  acceptance_criteria: z.array(AcceptanceCriterionSchema).min(1),
  /** Side effects this mission may trigger (intersected with capability ABI scope). */
  allowed_side_effects: z.array(AllowedSideEffectSchema),
  /** Budget for the entire mission (separate from per-invocation capability budget). */
  budget: z.object({
    max_invocations: z.number().int().min(1).default(10),
    max_total_runtime_ms: z.number().int().min(1000).max(86_400_000).default(300_000),
    max_cost_units: z.number().min(0).default(1000),
  }),
  /** Deadline (ISO-8601) — past-deadline missions fail closed. */
  deadline: z.string().optional(),
  /** Verifier contract. */
  verifier: MissionVerifierSchema,
  /** Rollback plan (referenced from capability ABI). */
  rollback: RollbackPlanSchema,
  /** Provenance. */
  forged_by: z.string().min(1),
  forged_at: z.string(),
  /** Versioning. */
  contract_version: z.literal("v1").default("v1"),
});

export type MissionContract = z.infer<typeof MissionContractSchema>;

// ── Compatibility check — Mission vs Capability ABI ───────────────────────

export interface MissionCompatibility {
  ok: boolean;
  issues: string[];
}

/**
 * Verify that a MissionContract is compatible with the CapabilityABI it
 * binds to. Fails closed — any conflict surfaces as an issue.
 */
export function checkMissionCompatibility(
  mission: MissionContract,
  abi: CapabilityAbi,
): MissionCompatibility {
  const issues: string[] = [];

  // 1. Capability IDs must match
  if (mission.capability_id !== abi.capability_id) {
    issues.push(`capability_id mismatch: mission=${mission.capability_id} abi=${abi.capability_id}`);
  }

  // 2. Authority class — mission may not exceed ABI authority
  const authorityOrder = [
    "OBSERVE", "SUGGEST", "SIMULATE", "DRAFT", "QUEUE",
    "EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE",
  ] as const;
  const missionAuthIdx = authorityOrder.indexOf(abi.authority_class);
  // (Mission itself does not declare authority — it inherits the ABI's)

  // 3. Side effects must be within ABI's declared side effects
  for (const eff of mission.allowed_side_effects) {
    if (!abi.side_effects.includes(eff.kind)) {
      issues.push(`mission declares side_effect '${eff.kind}' not in ABI.side_effects`);
    }
    // IRREVERSIBLE side effects must have approval required
    if (eff.kind === "fs_delete" || eff.kind === "db_mutation") {
      if (!eff.requires_approval && abi.authority_class === "IRREVERSIBLE") {
        issues.push(`destructive side_effect '${eff.kind}' on IRREVERSIBLE class requires approval`);
      }
    }
  }

  // 4. Mission budget must fit within ABI resource_budget
  if (mission.budget.max_total_runtime_ms > abi.resource_budget.timeout_ms) {
    issues.push(`mission budget (${mission.budget.max_total_runtime_ms}ms) exceeds ABI timeout (${abi.resource_budget.timeout_ms}ms)`);
  }

  // 5. Mission verifier must reference an external witness — never SELF
  if ((mission.verifier.method as string) === "SELF_CERTIFIED") {
    issues.push("mission verifier method SELF_CERTIFIED is inadmissible");
  }

  // 6. Rollback consistency — if ABI says rollback=none, mission can't claim rollback
  if (abi.rollback.strategy === "none" && mission.rollback.strategy !== "none") {
    issues.push(`ABI rollback=none but mission rollback=${mission.rollback.strategy}`);
  }
  if (abi.rollback.strategy === "human_undo_required" && mission.rollback.must_complete_before_signoff) {
    issues.push("ABI rollback=human_undo_required cannot auto-complete before signoff");
  }

  // 7. Acceptance criteria must have at least one hard criterion
  const hardCount = mission.acceptance_criteria.filter(c => c.hard).length;
  if (hardCount === 0) {
    issues.push("mission has no hard acceptance criteria — failing to verify means passing");
  }

  // 8. Acceptance criteria must all be witnessed by the verifier
  const witnessedIds = new Set(mission.verifier.criteria_ids);
  for (const c of mission.acceptance_criteria) {
    if (c.hard && !witnessedIds.has(c.id)) {
      issues.push(`hard criterion '${c.id}' not in verifier.criteria_ids`);
    }
  }

  return { ok: issues.length === 0, issues };
}