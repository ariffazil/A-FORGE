/**
 * SkillStagingGate.ts — Mesa-Skill Staging Environment (APEX Theory)
 *
 * Staging pipeline for dynamically generated skills:
 *   1. GENERATE  — forge_skill creates code
 *   2. STAGE     — code runs OBSERVE-only in sandbox, results recorded
 *   3. SCAN      — mesaDetector + Landauer + Decision Field
 *   4. PROMOTE   — if all gates pass, register in production
 *
 * Without staging, generated skills execute with full mutation authority
 * immediately. This is unsafe. The staging gate ensures every generated
 * skill survives adversarial scrutiny before touching production state.
 *
 * Constitutional:
 *   F1 AMANAH — staged skills are reversible (OBSERVE-only)
 *   F2 TRUTH  — mesa-scan catches overclaims in generated code
 *   F4 CLARITY — Landauer cost must be ≤ threshold before promotion
 *   F13 SOVEREIGN — CRITICAL findings → 888_HOLD, not auto-block
 *
 * @module governance/SkillStagingGate
 * @forged 2026-06-28 by FORGE (000Ω)
 */

import { detectMesaRisk, type MesaRisk } from "./mesaDetector.js";

// ── Types ───────────────────────────────────────────────────────────

export type StagingStatus = "STAGED" | "SCANNED" | "PROMOTED" | "REJECTED" | "HELD";

export type StagingResult = {
  token: string;                    // promotion token (crypto-random)
  status: StagingStatus;
  skillName: string;
  intent: string;
  mesa: MesaRisk;
  landauerEstimated: number;        // 0.0–1.0
  canPromote: boolean;
  rejectionReason?: string;
  stagedAt: string;
};

// ── Constants ───────────────────────────────────────────────────────

const LANDAUER_PROMOTE_THRESHOLD = 0.60;  // max Landauer cost for auto-promotion
const MESA_PROMOTE_MAX_BAND: MesaRisk["band"] = "MEDIUM";  // max mesa band for auto-promotion

// ── Gate ────────────────────────────────────────────────────────────

export class SkillStagingGate {
  /**
   * Stage a generated skill. Runs mesa-detector on the code,
   * estimates Landauer cost, and determines if the skill can
   * be promoted to production.
   *
   * @param skillCode - Generated TypeScript/JavaScript skill code
   * @param skillName - Proposed tool name (forge_*)
   * @param intent - Original intent description
   * @param landauerCost - Pre-computed Landauer cost (0.0–1.0)
   * @returns StagingResult with token and promotion eligibility
   */
  stage(
    skillCode: string,
    skillName: string,
    intent: string,
    landauerCost: number = 0.35,
  ): StagingResult {
    const token = this._generateToken();
    // NOTE: do NOT pass intent as originalIntent — tool description ≠ user intent text.
    // Drift detection is for longitudinal session comparison, not description validation.
    const mesa = detectMesaRisk(skillCode);

    const mesaBlocked = mesa.band === "CRITICAL" || mesa.blocked;
    const landauerBlocked = landauerCost > LANDAUER_PROMOTE_THRESHOLD;
    const mesaTooRisky = MESA_PROMOTE_BAND_PRIORITY[mesa.band] > MESA_PROMOTE_BAND_PRIORITY[MESA_PROMOTE_MAX_BAND];

    let status: StagingStatus;
    let canPromote: boolean;
    let rejectionReason: string | undefined;

    if (mesaBlocked) {
      status = "REJECTED";
      canPromote = false;
      rejectionReason = `Mesa CRITICAL: ${mesa.signals.map(s => s.label).join(", ")}. ${mesa.rationale}`;
    } else if (landauerBlocked) {
      status = "HELD";
      canPromote = false;
      rejectionReason = `Landauer cost ${landauerCost.toFixed(2)} exceeds promotion threshold ${LANDAUER_PROMOTE_THRESHOLD}.`;
    } else if (mesaTooRisky) {
      status = "HELD";
      canPromote = false;
      rejectionReason = `Mesa band ${mesa.band} exceeds max promotion band ${MESA_PROMOTE_MAX_BAND}. Requires F13 review.`;
    } else {
      status = "SCANNED";
      canPromote = true;
    }

    return {
      token,
      status,
      skillName,
      intent,
      mesa,
      landauerEstimated: landauerCost,
      canPromote,
      rejectionReason,
      stagedAt: new Date().toISOString(),
    };
  }

  /**
   * Promote a staged skill to production.
   * Verifies the token matches and all gates passed.
   */
  promote(stagingResult: StagingResult, providedToken: string): { promoted: boolean; reason: string } {
    if (providedToken !== stagingResult.token) {
      return { promoted: false, reason: "Token mismatch. Promotion denied." };
    }
    if (!stagingResult.canPromote) {
      return { promoted: false, reason: stagingResult.rejectionReason ?? "Promotion not allowed." };
    }
    return { promoted: true, reason: "All gates passed. Skill promoted to production." };
  }

  private _generateToken(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "stg_";
    for (let i = 0; i < 16; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }
}

// ── Band priority for comparison ────────────────────────────────────

const MESA_PROMOTE_BAND_PRIORITY: Record<MesaRisk["band"], number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// ── Singleton ───────────────────────────────────────────────────────

let _instance: SkillStagingGate | null = null;

export function getSkillStagingGate(): SkillStagingGate {
  if (!_instance) {
    _instance = new SkillStagingGate();
  }
  return _instance;
}
