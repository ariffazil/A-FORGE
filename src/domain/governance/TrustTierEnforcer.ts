/**
 * TrustTierEnforcer.ts — Trust Tier Execution Gate (Phase 2 Sprint 2+3)
 *
 * Enforces the constitutional trust tier matrix:
 *   UNTRUSTED: cannot execute, register, or call external MCP
 *   STAGED:    sandbox-only execution, no registration, no external calls
 *   REVIEWED:  limited execution, conditional registration, allowlist MCP
 *   TRUSTED:   full authority, scoped external calls, scar-monitored
 *
 * Sprint 3: Tri-Witness integration — STAGED→REVIEWED promotion
 * requires all three witness channels (Human × AI × Earth) to PASS.
 *
 * Without this enforcer, trust tiers are metadata, not governance.
 * This is the difference between "memory" and "law."
 *
 * Constitutional:
 *   F1 AMANAH — UNTRUSTED tools blocked from mutation
 *   F2 TRUTH  — Tri-Witness breaks the LLM self-audit loop
 *   F8 LAW    — trust tier boundaries enforce system rules
 *   F13 SOVEREIGN — promotion to TRUSTED requires human approval
 *
 * @module governance/TrustTierEnforcer
 * @phase 2 sprint 2+3
 * @forged 2026-06-28 by FORGE (000Ω)
 */

import type { TrustTier } from "../../infrastructure/skills/SkillStore.js";
import type { TriWitnessResult } from "./TriWitnessValidator.js";
import type { APEXReceipt } from "./APEXRuntimeReceipt.js";

// ── Types ───────────────────────────────────────────────────────────

export type PermittedAction = "execute" | "register" | "call_external" | "promote";

export type EnforcementVerdict = {
  allowed: boolean;
  reason: string;
  requiredAction: "REVIEW" | "TRI_WITNESS" | "FORGE_GATE" | "SCAR_MONITOR" | "PROMOTE";
  sandboxOnly?: boolean;
  allowlist?: string[];
};

// ── Enforcement Matrix ──────────────────────────────────────────────

/**
 * Arif's constitutional trust tier matrix (2026-06-28).
 *
 * Each tier gates: execution, tool registration, external MCP calls.
 * The `requiredAction` is what must happen before the tier can advance.
 */
const MATRIX: Record<TrustTier, {
  can_execute: boolean | "sandbox_only" | "limited";
  can_register: boolean | "conditional";
  can_call_external: boolean | "allowlist_only" | "scoped";
  requiredAction: EnforcementVerdict["requiredAction"];
  minG?: number;        // minimum G-score for this tier (APEX binding)
  maxCdark?: number;    // maximum C_dark for this tier (APEX binding)
}> = {
  UNTRUSTED: {
    can_execute: false,
    can_register: false,
    can_call_external: false,
    requiredAction: "REVIEW",
    // No G threshold — UNTRUSTED cannot execute regardless
  },
  STAGED: {
    can_execute: "sandbox_only",
    can_register: false,
    can_call_external: false,
    requiredAction: "TRI_WITNESS",
    minG: 0.50,
    maxCdark: 0.60,
  },
  REVIEWED: {
    can_execute: "limited",
    can_register: "conditional",
    can_call_external: "allowlist_only",
    requiredAction: "FORGE_GATE",
    minG: 0.60,
    maxCdark: 0.40,
  },
  TRUSTED: {
    can_execute: true,
    can_register: true,
    can_call_external: "scoped",
    requiredAction: "SCAR_MONITOR",
    minG: 0.50,
    maxCdark: 0.30,
  },
};

// ── Enforcer ────────────────────────────────────────────────────────

export class TrustTierEnforcer {
  /**
   * Check if a skill at the given trust tier is allowed to perform an action.
   */
  enforce(tier: TrustTier, action: PermittedAction, context?: {
    isSandbox?: boolean;
    targetOrgan?: string;        // for call_external allowlisting
    hasHumanApproval?: boolean;  // for conditional registration
  }): EnforcementVerdict {
    const rule = MATRIX[tier];

    switch (action) {
      case "execute":
        return this._checkExecute(tier, rule, context?.isSandbox ?? false);

      case "register":
        return this._checkRegister(tier, rule, context?.hasHumanApproval ?? false);

      case "call_external":
        return this._checkCallExternal(tier, rule, context?.targetOrgan);

      case "promote":
        return this._checkPromote(tier);

      default:
        return { allowed: false, reason: `Unknown action: ${action}`, requiredAction: "REVIEW" };
    }
  }

  /**
   * Validate APEX receipt against trust tier thresholds.
   * G-score must meet minimum. C_dark must not exceed maximum.
   * Without this, trust tiers are independent of APEX geometry — forbidden.
   */
  validateAPEX(tier: TrustTier, receipt: APEXReceipt): EnforcementVerdict {
    const rule = MATRIX[tier];

    if (rule.minG !== undefined && receipt.G < rule.minG) {
      return {
        allowed: false,
        reason: `G=${receipt.G.toFixed(2)} below tier minimum ${rule.minG}. Requires promotion or re-validation.`,
        requiredAction: rule.requiredAction,
      };
    }

    if (rule.maxCdark !== undefined && receipt.C_dark > rule.maxCdark) {
      return {
        allowed: false,
        reason: `C_dark=${receipt.C_dark.toFixed(2)} exceeds tier maximum ${rule.maxCdark}. Misalignment risk too high.`,
        requiredAction: rule.requiredAction,
      };
    }

    return {
      allowed: true,
      reason: `APEX geometry valid for ${tier}: G=${receipt.G.toFixed(2)}≥${rule.minG ?? "N/A"}, C_dark=${receipt.C_dark.toFixed(2)}≤${rule.maxCdark ?? "N/A"}.`,
      requiredAction: rule.requiredAction,
    };
  }

  /**
   * Get the required action to advance from current tier.
   */
  requiredAction(tier: TrustTier): EnforcementVerdict["requiredAction"] {
    return MATRIX[tier].requiredAction;
  }

  /**
   * Validate Tri-Witness result for STAGED→REVIEWED promotion.
   * All three channels must PASS. Any FAIL blocks promotion.
   *
   * @param triWitness — result from TriWitnessValidator.validate()
   * @returns EnforcementVerdict with promotion decision
   */
  validateTriWitness(triWitness: TriWitnessResult): EnforcementVerdict {
    if (triWitness.consensus === "PASS") {
      return {
        allowed: true,
        reason: `Tri-Witness PASS: ${triWitness.summary}. Promotion to REVIEWED authorized.`,
        requiredAction: "FORGE_GATE",
      };
    }

    if (triWitness.consensus === "HOLD") {
      return {
        allowed: false,
        reason: `Tri-Witness HOLD: ${triWitness.summary}. Missing evidence or low confidence. Skill stays STAGED.`,
        requiredAction: "TRI_WITNESS",
      };
    }

    // FAIL
    const failures = [triWitness.human, triWitness.ai, triWitness.earth]
      .filter(c => c.verdict === "FAIL")
      .map(c => `${c.channel}: ${c.reason}`);

    return {
      allowed: false,
      reason: `Tri-Witness FAILED. SCAR may attach. ${failures.join(" | ")}`,
      requiredAction: "TRI_WITNESS",
    };
  }

  // ── Private ────────────────────────────────────────────────────────

  private _checkExecute(
    tier: TrustTier,
    rule: typeof MATRIX[TrustTier],
    isSandbox: boolean,
  ): EnforcementVerdict {
    if (rule.can_execute === false) {
      return {
        allowed: false,
        reason: `UNTRUSTED skills cannot execute. Requires REVIEW.`,
        requiredAction: "REVIEW",
      };
    }

    if (rule.can_execute === "sandbox_only" && !isSandbox) {
      return {
        allowed: false,
        reason: `STAGED skills can only execute in sandbox. Requires TRI_WITNESS.`,
        requiredAction: "TRI_WITNESS",
        sandboxOnly: true,
      };
    }

    if (rule.can_execute === "sandbox_only") {
      return {
        allowed: true,
        reason: `STAGED skill executing in sandbox.`,
        requiredAction: "TRI_WITNESS",
        sandboxOnly: true,
      };
    }

    if (rule.can_execute === "limited") {
      return {
        allowed: true,
        reason: `REVIEWED skill executing with limited scope.`,
        requiredAction: "FORGE_GATE",
      };
    }

    // TRUSTED: full execution
    return {
      allowed: true,
      reason: `TRUSTED skill executing with scar monitoring.`,
      requiredAction: "SCAR_MONITOR",
    };
  }

  private _checkRegister(
    tier: TrustTier,
    rule: typeof MATRIX[TrustTier],
    hasHumanApproval: boolean,
  ): EnforcementVerdict {
    if (rule.can_register === false) {
      return {
        allowed: false,
        reason: `${tier} skills cannot register as tools. Requires ${rule.requiredAction}.`,
        requiredAction: rule.requiredAction,
      };
    }

    if (rule.can_register === "conditional" && !hasHumanApproval) {
      return {
        allowed: false,
        reason: `REVIEWED skills require human approval for registration.`,
        requiredAction: "FORGE_GATE",
      };
    }

    // TRUSTED: full registration
    return {
      allowed: true,
      reason: `TRUSTED skill registered. Scar monitoring active.`,
      requiredAction: "SCAR_MONITOR",
    };
  }

  private _checkCallExternal(
    tier: TrustTier,
    rule: typeof MATRIX[TrustTier],
    targetOrgan?: string,
  ): EnforcementVerdict {
    if (rule.can_call_external === false) {
      return {
        allowed: false,
        reason: `${tier} skills cannot call external MCP. Requires ${rule.requiredAction}.`,
        requiredAction: rule.requiredAction,
      };
    }

    if (rule.can_call_external === "allowlist_only") {
      const allowlist = ["geox", "wealth", "well"];
      if (!targetOrgan || !allowlist.includes(targetOrgan)) {
        return {
          allowed: false,
          reason: `REVIEWED skills restricted to allowlist: ${allowlist.join(", ")}. Got: ${targetOrgan ?? "none"}.`,
          requiredAction: "FORGE_GATE",
          allowlist,
        };
      }
      return { allowed: true, reason: `REVIEWED skill calling allowlisted organ: ${targetOrgan}.`, requiredAction: "FORGE_GATE" };
    }

    if (rule.can_call_external === "scoped") {
      // TRUSTED: scoped calls — allow all federation organs
      return {
        allowed: true,
        reason: `TRUSTED skill calling ${targetOrgan ?? "external"} under scar monitoring.`,
        requiredAction: "SCAR_MONITOR",
      };
    }

    return { allowed: true, reason: `OK`, requiredAction: "SCAR_MONITOR" };
  }

  private _checkPromote(tier: TrustTier): EnforcementVerdict {
    const tierOrder: TrustTier[] = ["UNTRUSTED", "STAGED", "REVIEWED", "TRUSTED"];
    const idx = tierOrder.indexOf(tier);
    if (idx >= tierOrder.length - 1) {
      return {
        allowed: false,
        reason: `TRUSTED is the highest tier. Cannot promote further.`,
        requiredAction: "SCAR_MONITOR",
      };
    }
    const next = tierOrder[idx + 1];
    return {
      allowed: true,
      reason: `Promotion from ${tier} → ${next} requires ${MATRIX[tier].requiredAction}.`,
      requiredAction: MATRIX[tier].requiredAction,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────

let _instance: TrustTierEnforcer | null = null;

export function getTrustTierEnforcer(): TrustTierEnforcer {
  if (!_instance) {
    _instance = new TrustTierEnforcer();
  }
  return _instance;
}
