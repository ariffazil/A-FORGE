/**
 * MissionContract — P1.2 binding between a mission and the capabilities
 * it requires. Wraps the existing arifOS `OutcomeSpec` + `RunConfig`
 * with capability-binding, success criteria, and lease requirements.
 *
 * A mission contract **never** authorises execution. It is a typed
 * plan that `forge_ephemeral` reads to choose templates, size leases,
 * and emit verifier evidence. Authorisation still flows through
 * `forge_judge_proxy → arif_judge`.
 *
 * @module forge/missionContract
 * @constitutional F1 AMANAH · F2 TRUTH · F8 GENIUS · F13 SOVEREIGN
 */
import { randomUUID } from "node:crypto";
import type { CapabilityABI, AuthorityBand } from "./capabilityAbi.js";

export interface RequiredCapability {
  capability_id: string;
  invocation_count: number;
  expected_outputs: number;
  failure_tolerance: number;
}

export interface MissionSuccessCriteria {
  min_capability_satisfaction_rate: number;
  min_independent_verifier_passes: number;
}

export interface MissionContract {
  contract_id: string;
  mission_intent: string;
  outcome_spec_id: string;
  run_config_id: string;
  required_capabilities: RequiredCapability[];
  success_criteria: MissionSuccessCriteria;
  lease_requirement: { authority_band: AuthorityBand; ttl_seconds: number };
  ratification_required: boolean;
  arifos_session_id?: string;
  signed_by: "arifos-arif_judge" | "aforge-mission-author";
  created_at: string;
}

export interface CreateMissionContractInput {
  mission_intent: string;
  outcome_spec_id: string;
  run_config_id: string;
  required_capabilities: RequiredCapability[];
  success_criteria?: Partial<MissionSuccessCriteria>;
  lease_requirement: MissionContract["lease_requirement"];
  ratification_required?: boolean;
  arifos_session_id?: string;
  signed_by?: MissionContract["signed_by"];
}

const DEFAULTS: MissionSuccessCriteria = {
  min_capability_satisfaction_rate: 0.95,
  min_independent_verifier_passes: 3,
};

export function createMissionContract(input: CreateMissionContractInput): MissionContract {
  const success = { ...DEFAULTS, ...(input.success_criteria ?? {}) };
  return {
    contract_id: `mc-${randomUUID()}`,
    mission_intent: input.mission_intent,
    outcome_spec_id: input.outcome_spec_id,
    run_config_id: input.run_config_id,
    required_capabilities: input.required_capabilities,
    success_criteria: success,
    lease_requirement: input.lease_requirement,
    ratification_required: input.ratification_required ?? true,
    arifos_session_id: input.arifos_session_id,
    signed_by: input.signed_by ?? "aforge-mission-author",
    created_at: new Date().toISOString(),
  };
}

/**
 * Validate that every `required_capabilities[].capability_id` resolves
 * in the registry. Returns the list of unresolved ids.
 */
export function findMissingCapabilities(
  contract: MissionContract,
  abiRegistry: { get(id: string): CapabilityABI | undefined },
): string[] {
  const missing: string[] = [];
  for (const req of contract.required_capabilities) {
    if (!abiRegistry.get(req.capability_id)) missing.push(req.capability_id);
  }
  return missing;
}
