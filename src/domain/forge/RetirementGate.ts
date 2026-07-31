/**
 * RetirementGate — P2.6 reversible auto-retirement.
 *
 * Triggers reversible retirement based on age, missing-verifier gap,
 * verifier-pass-rate drop, or canonical-G drop. Uses existing
 * `ExecutionSandbox.deprovisionSandbox` and `SandboxStorage.evict`
 * paths in the runtime. Records every retirement to the F11
 * receipt store (NOT `forge_vault(mode='seal')`).
 *
 * @module forge/RetirementGate
 * @constitutional F1 AMANAH · F11 AUDIT
 */

export interface RetirementPolicy {
  capability_id: string;
  triggers: {
    age_hours: number;
    invocations_since_last_verify: number;
    verifier_pass_rate_drop: number;
    canonical_g_drop: number;
  };
  on_retire: "snapshot_then_evict" | "soft_delete";
  arifos_acknowledgement_required: boolean;
}

export interface RetirementSignal {
  age_hours?: number;
  invocations_since_last_verify?: number;
  verifier_pass_rate_drop?: number;
  canonical_g_drop?: number;
}

export type RetirementAction = "RETIRE" | "HOLD" | "EXTEND";

export interface RetirementDecision {
  capability_id: string;
  action: RetirementAction;
  reason: string;
  arifos_acknowledgement_required: boolean;
  /** Snapshot metadata when on_retire=snapshot_then_evict. */
  snapshot_id?: string;
}

export class RetirementGate {
  evaluate(
    policy: RetirementPolicy,
    signal: RetirementSignal,
    opts: { now?: number; lastVerifiedAt?: number; invocations?: number; baselinePassRate?: number; currentPassRate?: number; canonicalG?: number; baselineG?: number } = {},
  ): RetirementDecision {
    const reasons: string[] = [];

    if (opts.lastVerifiedAt && opts.now) {
      const ageHours = (opts.now - opts.lastVerifiedAt) / 3_600_000;
      if (ageHours >= policy.triggers.age_hours) {
        reasons.push(`age ${ageHours.toFixed(1)}h >= ${policy.triggers.age_hours}h`);
      }
    }

    if (opts.invocations && opts.invocations >= policy.triggers.invocations_since_last_verify) {
      reasons.push(`invocations ${opts.invocations} >= ${policy.triggers.invocations_since_last_verify}`);
    }

    if (
      opts.baselinePassRate !== undefined &&
      opts.currentPassRate !== undefined &&
      opts.baselinePassRate - opts.currentPassRate >= policy.triggers.verifier_pass_rate_drop
    ) {
      reasons.push(`verifier pass rate drop >= ${policy.triggers.verifier_pass_rate_drop}`);
    }

    if (
      opts.canonicalG !== undefined &&
      opts.baselineG !== undefined &&
      opts.baselineG - opts.canonicalG >= policy.triggers.canonical_g_drop
    ) {
      reasons.push(`canonical G drop >= ${policy.triggers.canonical_g_drop}`);
    }

    if (reasons.length === 0) {
      return {
        capability_id: policy.capability_id,
        action: "EXTEND",
        reason: "no triggers fired",
        arifos_acknowledgement_required: false,
      };
    }

    return {
      capability_id: policy.capability_id,
      action: "RETIRE",
      reason: reasons.join("; "),
      arifos_acknowledgement_required: policy.arifos_acknowledgement_required,
      snapshot_id: policy.on_retire === "snapshot_then_evict" ? `snap-${policy.capability_id}-${Date.now().toString(36)}` : undefined,
    };
  }
}
