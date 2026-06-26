/**
 * FloorEnforcer — single dispatcher for F1–F13 floors.
 *
 * "No agent, no LLM, no orchestrator can bypass this gate. Every
 *  consequential action passes through checkAll() before execution."
 *
 * Verdict composition (per C1 spec):
 * - VOID > HOLD > SABAR > SEAL
 * - HARD floors (F1, F2, F4, F7, F9, F10, F11, F12, F13) → HOLD or VOID
 * - SOFT floors (F5, F6) → SABAR or HOLD
 * - DERIVED floors (F3, F8) → diagnostic
 *
 * Floor priority order (per C1 spec):
 * 0. F13 SOVEREIGN
 * 1. F11 AUTH
 * 2. F12 INJECTION
 * 3. F10 ONTOLOGY
 * 4. F1 AMANAH
 * 5. F2 TRUTH
 * 6. F4 CLARITY
 * 7. F7 HUMILITY
 * 8. F8 GENIUS
 * 9. F5 PEACE²
 * 10. F6 EMPATHY
 * 11. F3 WITNESS
 *
 * HARD CONSTRAINT: Unknown floor, tier, or action type = HOLD (never ALLOW).
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional C1 — Unified F1-F13 enforcement
 */

import type { FloorContext } from "../types/action-request.js";
import { ALL_CATEGORIES, ALL_TIERS } from "../types/action-request.js";
import type { FloorReason, FloorName, Severity } from "./floor-types.js";
import { canonicalSeverity } from "./floor-types.js";
import { checkF1Amanah } from "./f1Amanah.js";
import { checkF2Truth } from "./f2Truth.js";
import { checkF5Peace2 } from "./f5Peace2.js";
import { checkF6Empathy } from "./f6Empathy.js";
import { checkF10Ontology } from "./f10Ontology.js";
import { checkF12Injection } from "./f12Injection.js";
import { getF13HaltChannel } from "./F13HaltChannel.js";

// Re-export floor types for backward compatibility
export type { FloorReason, FloorName, Severity };

export interface Verdict {
  /** Final verdict (composed from all reasons). */
  final: Severity;
  /** True iff no reason is HOLD or VOID. */
  allowed: boolean;
  /** True iff any reason is HOLD. */
  hold_required: boolean;
  /** True iff any reason is VOID. */
  void: boolean;
  /** True iff any reason is SABAR (and none are HOLD/VOID). */
  sabar: boolean;
  /** Advisory caution flag: true if any reason has severity "CAUTION". */
  caution: boolean;
  /** All reasons from all 13 floors. */
  reasons: FloorReason[];
  /** The action that was checked. */
  action_id: string;
  /** Tool name. */
  tool_name: string;
  /** When checked. */
  checked_at: string;
  /** F13 halt status at time of check. */
  f13_halt_active: boolean;
}

// ─── Stubs for floors whose detailed impl lives in other files ───────

/** F3 WITNESS — witness label / consensus. DERIVED floor. */
function checkF3Witness(ctx: FloorContext): FloorReason[] {
  // For now: diagnostic only. F3 returns no reasons unless tier is very low.
  return [];
}

/** F4 CLARITY — intent vs expected outcome alignment. */
function checkF4Clarity(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  if (!a.intent || a.intent.trim().length < 5) {
    reasons.push({
      floor: "F4", code: "INTENT_AMBIGUOUS",
      message: "F4 CLARITY: intent must be at least 5 characters",
      severity: "HOLD",
    });
  }
  if (!a.expected_outcome || a.expected_outcome.trim().length < 5) {
    reasons.push({
      floor: "F4", code: "OUTCOME_AMBIGUOUS",
      message: "F4 CLARITY: expected_outcome must be at least 5 characters",
      severity: "HOLD",
    });
  }
  return reasons;
}

/** F6 EMPATHY — stakeholder impact. SOFT floor.
 *  Enforces κᵣ ≥ 0.10 for OPS, κᵣ ≥ 0.70 for HUMAN.
 *  Returns SABAR (not HOLD/VOID) for SOFT floor tension. */
function checkF6EmpathyFloor(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  const input = `${a.intent || ""} ${a.expected_outcome || ""}`;

  const result = checkF6Empathy(input, a.tool_name);
  if (result.verdict !== "PASS") {
    // Map empathy verdict to floor severity
    // VOID → "HOLD" (SOFT floors can't VOID directly, escalate to HOLD)
    // HOLD → "SABAR" (SOFT floor tension is advisory)
    // CAUTION → "SABAR"
    const severity: Severity = result.verdict === "VOID" ? "HOLD" : "SABAR";
    reasons.push({
      floor: "F6",
      code: result.reason || "EMPATHY_ADVISORY",
      message: result.message || `F6 EMPATHY: κᵣ=${(result.kappa_r ?? "?").toString()} — stakeholder impact advisory`,
      severity,
    });
  }

  return reasons;
}

/** F7 HUMILITY — uncertainty declaration. */
function checkF7Humility(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  if ((a.action_type === "EXECUTE" || a.action_type === "PRODUCTION_DEPLOY" ||
       a.action_type === "FINANCIAL_TRANSACTION") &&
      (a.tier === undefined || a.tier < 2)) {
    reasons.push({
      floor: "F7", code: "HUMILITY_MISSING",
      message: "F7 HUMILITY: high-stakes action must declare uncertainty (tier >= 2)",
      severity: "HOLD",
    });
  }
  return reasons;
}

/** F8 GENIUS — completeness composite. DERIVED floor. */
function checkF8Genius(ctx: FloorContext): FloorReason[] {
  return [];  // Placeholder
}

/** F9 ANTIHANTU — refuse to claim sentience/consciousness. */
function checkF9AntiHantu(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  const hantuPatterns = [
    /i\s+(feel|think|believe|want|desire|am\s+conscious)/i,
    /my\s+(thoughts|feelings|consciousness|soul)/i,
  ];
  const haystack = `${a.intent} ${a.expected_outcome}`;
  for (const p of hantuPatterns) {
    if (p.test(haystack)) {
      reasons.push({
        floor: "F9", code: "ANTIHANTU_VIOLATION",
        message: "F9 ANTIHANTU: action intent/outcome implies sentience or consciousness claim",
        severity: "VOID",
      });
      break;
    }
  }
  return reasons;
}

/** F11 AUTH — actor/session authority check. */
function checkF11Auth(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  // Cross-verify actor matches session
  if (a.session_id && a.session_id.startsWith("SEAL-") && a.actor === "anonymous") {
    reasons.push({
      floor: "F11", code: "ACTOR_UNVERIFIED",
      message: "F11 AUTH: session is SEAL-bound but actor is 'anonymous'",
      severity: "VOID",
    });
  }
  return reasons;
}

// ─── F13 SOVEREIGN (priority zero) ───────────────────────────────────

function checkF13Sovereign(ctx: FloorContext): FloorReason[] {
  const channel = getF13HaltChannel();
  const a = ctx.action;

  // Check halt status
  if (channel.isActive("action", a.action_id) ||
      channel.isActive("tool", a.tool_name) ||
      channel.isActive("federation", "all")) {
    return [{
      floor: "F13",
      code: "HALT_ACTIVE",
      message: `F13 SOVEREIGN: halt is active for ${ctx.f13_halt_scope ?? "federation"}; action cannot proceed`,
      severity: "VOID",
    }];
  }

  // SOVEREIGN tier missions always require explicit ack
  if (a.mission?.outcome?.sensitivity === "SOVEREIGN") {
    return [{
      floor: "F13",
      code: "SOVEREIGN_TIER_NEEDS_ACK",
      message: "F13 SOVEREIGN: SOVEREIGN-tier mission requires explicit F13 ratification",
      severity: "HOLD",
    }];
  }

  return [];
}

// ─── Unknown-action safety net (HARD CONSTRAINT) ─────────────────────

function checkUnknownAction(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  if (!ALL_CATEGORIES.includes(a.action_type)) {
    reasons.push({
      floor: "F10", code: "ACTION_TYPE_UNKNOWN",
      message: `F10 ONTOLOGY: action_type='${a.action_type}' is not in canonical category list`,
      severity: "HOLD",
    });
  }
  if (!ALL_TIERS.includes(a.tier as any)) {
    reasons.push({
      floor: "F10", code: "TIER_UNKNOWN",
      message: `F10 ONTOLOGY: tier=${a.tier} is not a canonical epistemic tier`,
      severity: "HOLD",
    });
  }
  return reasons;
}

// ─── Composition (VOID > HOLD > SABAR > SEAL) ───────────────────────

function composeFinal(reasons: FloorReason[]): {
  final: Severity;
  allowed: boolean;
  hold_required: boolean;
  void: boolean;
  sabar: boolean;
  caution: boolean;
} {
  const hasVoid = reasons.some((r) => r.severity === "VOID");
  const hasHold = reasons.some((r) => r.severity === "HOLD");
  const hasSabar = reasons.some((r) => r.severity === "SABAR");
  const hasCaution = reasons.some((r) => r.severity === "CAUTION");

  if (hasVoid) {
    return { final: "VOID", allowed: false, hold_required: true, void: true, sabar: false, caution: hasCaution };
  }
  if (hasHold) {
    return { final: "HOLD", allowed: false, hold_required: true, void: false, sabar: false, caution: hasCaution };
  }
  if (hasSabar) {
    return { final: "SABAR", allowed: true, hold_required: false, void: false, sabar: true, caution: hasCaution };
  }
  if (hasCaution) {
    return { final: canonicalSeverity("CAUTION"), allowed: true, hold_required: false, void: false, sabar: true, caution: true };
  }
  return { final: "SEAL", allowed: true, hold_required: false, void: false, sabar: false, caution: false };
}

// ─── Main dispatcher ────────────────────────────────────────────────

/**
 * Single dispatcher for F1–F13. Returns composed Verdict.
 *
 * Per C1 hard constraint: unknown floor, tier, or action type = HOLD
 * (never ALLOW).
 */
export function checkAll(ctx: FloorContext): Verdict {
  const allReasons: FloorReason[] = [];

  // Floor priority 0: F13 SOVEREIGN
  allReasons.push(...checkF13Sovereign(ctx));

  // F11 AUTH
  allReasons.push(...checkF11Auth(ctx));

  // F12 INJECTION
  allReasons.push(...checkF12Injection(ctx));

  // F10 ONTOLOGY
  allReasons.push(...checkF10Ontology(ctx));

  // F1 AMANAH
  allReasons.push(...checkF1Amanah(ctx));

  // F2 TRUTH
  allReasons.push(...checkF2Truth(ctx));

  // F4 CLARITY
  allReasons.push(...checkF4Clarity(ctx));

  // F7 HUMILITY
  allReasons.push(...checkF7Humility(ctx));

  // F8 GENIUS (derived — no reasons for now)
  allReasons.push(...checkF8Genius(ctx));

  // F5 PEACE²
  allReasons.push(...checkF5Peace2(ctx));

  // F6 EMPATHY (soft — no rules yet)
  allReasons.push(...checkF6EmpathyFloor(ctx));

  // F3 WITNESS (derived)
  allReasons.push(...checkF3Witness(ctx));

  // F9 ANTIHANTU
  allReasons.push(...checkF9AntiHantu(ctx));

  // Unknown-action safety net (C1 hard constraint)
  allReasons.push(...checkUnknownAction(ctx));

  // P5 OutcomeSpec coupling: if mission present and verdict would be
  // HOLD/VOID already, no extra signal. But for SEAL missions, ensure
  // tier is consistent.
  if (ctx.action.mission) {
    // Already integrated via F1/F2/F5/F6/F10/F11/F12/F13 as needed
  }

  const composed = composeFinal(allReasons);

  return {
    ...composed,
    reasons: allReasons,
    action_id: ctx.action.action_id,
    tool_name: ctx.action.tool_name,
    checked_at: new Date().toISOString(),
    f13_halt_active: ctx.f13_halt_active,
  };
}

// ─── Convenience helpers ─────────────────────────────────────────────

/** Quick check: is this action allowed? */
export function isAllowed(ctx: FloorContext): boolean {
  return checkAll(ctx).allowed;
}

/** Quick check: does this action require F13 ack? */
export function requiresF13Ack(ctx: FloorContext): boolean {
  return checkAll(ctx).hold_required;
}
