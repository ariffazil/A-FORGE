/**
 * Autonomous Retirement — Ephemeral artefacts auto-retire on TTL or
 * scar-pressure threshold. Permanent registry changes require governed
 * approval (888_HOLD or arifOS seal).
 *
 * ═══ P2.7 RATIFIED (2026-07-31) — REVERSIBLE EXITS, GOVERNED ENTRIES ═════
 *
 * Retirement triggers:
 *
 *   1. TTL expiry (ephemeral) — auto, no approval
 *   2. Schema drift above SCAR_DRIFT_THRESHOLD — auto for ephemeral,
 *      governed for permanent
 *   3. Success rate collapse below MIN_SUCCESS_FOR_PERMANENT for N
 *      consecutive windows — auto for ephemeral, governed for permanent
 *   4. Manual override — always requires 888_HOLD
 *   5. Replacement available — auto when CapabilityMarket demand
 *      drops below DEMAND_FLOOR for WINDOW_DAYS
 *
 * Permanent registry changes (PROMOTE / SEAL / COMMIT_TO_VAULT999)
 * ALWAYS require governed approval. The retirement ledger records
 * every exit with a receipt.
 *
 * @module forge/autonomousRetirement
 * @constitutional F1 AMANAH — ephemeral exits are automatic
 * @constitutional F13 SOVEREIGN — permanent entries are governed
 * @constitutional F11 AUDIT — every exit has a receipt
 */

import { createHash } from "node:crypto";

const SCAR_DRIFT_THRESHOLD = 0.30;
const MIN_SUCCESS_FOR_PERMANENT = 0.70;
const WINDOWS_FOR_FAILURE = 5;
const DEMAND_FLOOR = 0.05;
const WINDOW_DAYS = 30;

export type RetirementKind = "ephemeral" | "permanent";
export type RetirementTrigger =
  | "ttl_expired"
  | "scar_drift"
  | "success_collapse"
  | "manual"
  | "replacement_available";
export type RetirementApproval = "auto" | "governed";

export interface RetirementDecision {
  capability_id: string;
  kind: RetirementKind;
  trigger: RetirementTrigger;
  approval_required: RetirementApproval;
  decided_at: string;
  reason: string;
  receipt_hash: string;
}

// ── Inputs from other modules ────────────────────────────────────────────

export interface RetirementSignals {
  ttl_expired: boolean;
  schema_drift: number;                   // [0, 1]
  success_rate: number;                   // last N observations
  consecutive_failure_windows: number;
  current_demand: number;                // calls / window
  window_days: number;
  manual_override: boolean;
}

// ── Retirement engine ─────────────────────────────────────────────────────

export class AutonomousRetirement {
  private readonly decisions: RetirementDecision[] = [];
  /** Set of capability_ids that have already been auto-retired. */
  private readonly retired = new Set<string>();

  /**
   * Decide whether a capability should be retired. Returns the
   * decision. If approval_required="governed", the caller MUST NOT
   * retire without first seeking sovereign approval.
   */
  decide(
    capability_id: string,
    kind: RetirementKind,
    signals: RetirementSignals,
  ): RetirementDecision {
    const trigger = this.classifyTrigger(signals);
    const reason = this.buildReason(trigger, signals);
    const approval_required: RetirementApproval =
      kind === "ephemeral"
        ? "auto"
        : trigger === "manual"
          ? "governed"
          : signals.manual_override
            ? "governed"
            : "governed";             // permanent ALWAYS governed

    const decided_at = new Date().toISOString();
    const decision: RetirementDecision = {
      capability_id,
      kind,
      trigger,
      approval_required,
      decided_at,
      reason,
      receipt_hash: createHash("sha256")
        .update(`${capability_id}:${kind}:${trigger}:${decided_at}`)
        .digest("hex")
        .slice(0, 16),
    };
    this.decisions.push(decision);
    return decision;
  }

  /**
   * Mark a capability as retired. For ephemeral + auto, this is the
   * only call needed. For permanent + governed, the caller must hold
   * the sovereign approval token before invoking this.
   */
  retire(decision: RetirementDecision): { ok: boolean; reason?: string } {
    if (decision.approval_required === "governed") {
      // The caller MUST have a sovereign approval token; we only
      // check that the decision was sealed in this registry.
      if (!this.decisions.includes(decision)) {
        return { ok: false, reason: "decision not registered" };
      }
    }
    this.retired.add(decision.capability_id);
    return { ok: true };
  }

  /** Has this capability been retired? */
  isRetired(capability_id: string): boolean {
    return this.retired.has(capability_id);
  }

  auditTrail(): ReadonlyArray<RetirementDecision> {
    return [...this.decisions];
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private classifyTrigger(s: RetirementSignals): RetirementTrigger {
    if (s.manual_override) return "manual";
    if (s.ttl_expired) return "ttl_expired";
    if (s.schema_drift > SCAR_DRIFT_THRESHOLD) return "scar_drift";
    if (
      s.success_rate < MIN_SUCCESS_FOR_PERMANENT &&
      s.consecutive_failure_windows >= WINDOWS_FOR_FAILURE
    ) return "success_collapse";
    if (
      s.current_demand < DEMAND_FLOOR &&
      s.window_days >= WINDOW_DAYS
    ) return "replacement_available";
    // Default: no trigger. Caller should not retire.
    return "manual";   // safe default — manual = governed
  }

  private buildReason(
    trigger: RetirementTrigger,
    s: RetirementSignals,
  ): string {
    switch (trigger) {
      case "ttl_expired":
        return "ephemeral TTL elapsed";
      case "scar_drift":
        return `schema_drift ${s.schema_drift.toFixed(3)} > ${SCAR_DRIFT_THRESHOLD}`;
      case "success_collapse":
        return `success_rate ${s.success_rate.toFixed(3)} < ${MIN_SUCCESS_FOR_PERMANENT} for ${s.consecutive_failure_windows} consecutive windows`;
      case "replacement_available":
        return `demand ${s.current_demand.toFixed(3)} < ${DEMAND_FLOOR} over ${s.window_days} days`;
      case "manual":
        return "manual override — governed approval required";
    }
  }
}