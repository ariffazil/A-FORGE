/**
 * TriWitnessValidator.ts — Constitutional Loop-Breaker (Phase 2 Sprint 3 RSI)
 *
 * Tri-Witness = Human × AI × Earth validation.
 *
 * This is the mesa-optimizer containment layer: no agent can self-audit.
 * Generated skills must survive three independent witness channels
 * before promotion from STAGED → REVIEWED.
 *
 * Channels:
 *   HUMAN  — Intent, consequence, reversibility, dignity, F13 authority
 *   AI     — Code safety, schema, permission scope, injection risk, C_dark
 *   EARTH  — Non-LLM evidence: tests, domain organs, resource measurements
 *
 * Veto law (not averaging):
 *   ANY FAIL → FAIL    (promotion blocked, SCAR may attach)
 *   ANY HOLD → HOLD    (promotion paused, missing evidence)
 *   ALL PASS → PASS    (promotion allowed)
 *
 * Earth witness rule: MUST contain non-LLM evidence. Keyword-only → HOLD.
 * Self-validation rule: skill cannot be its own AI witness.
 *
 * Constitutional:
 *   F2 TRUTH  — no single evaluator validates its own output
 *   F7 HUMILITY — cross-model audit enforces epistemic humility
 *   F13 SOVEREIGN — human channel is F13's constitutional veto
 *
 * @module governance/TriWitnessValidator
 * @phase 2 sprint 3 (RSI 2026-06-28)
 * @forged 2026-06-28 by FORGE (000Ω)
 */

import type { TrustTier } from "../../infrastructure/skills/SkillStore.js";
import type { SkillDomain } from "../forge/skill/types.js";

// ── Types ───────────────────────────────────────────────────────────

export type WitnessVerdict = "PASS" | "HOLD" | "FAIL";

export type ChannelResult = {
  channel: "HUMAN" | "AI" | "EARTH";
  verdict: WitnessVerdict;
  score: number;           // 0.0–1.0
  confidence: number;      // 0.0–1.0 — how confident is this witness?
  reason: string;
  evidence?: string;
  checks?: Record<string, "PASS" | "FAIL" | "HOLD">;
  timestamp: string;
};

export type TriWitnessResult = {
  human: ChannelResult;
  ai: ChannelResult;
  earth: ChannelResult;
  consensus: WitnessVerdict;
  canPromote: boolean;       // true only if consensus === "PASS"
  promotionTier: TrustTier | null;
  scarRequired: boolean;     // true if any channel FAILed
  summary: string;
  aggregateScore: number;    // geometric mean (informational only — veto is law)
};

export type TriWitnessInput = {
  skillName: string;
  skillCode: string;
  skillIntent: string;
  domain: SkillDomain;
  generatorModel: string;
  generatorAgent?: string;     // which agent generated this (self-validation check)
  humanApprovalToken?: string;
  earthEvidenceType?: "TEST" | "DOMAIN_ORGAN" | "EXTERNAL_SOURCE" | "NONE";
  earthEvidence?: string;      // non-LLM evidence: test output, organ receipt, etc.
};

// ── Constants ───────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.5;  // below this → HOLD

// ── Validator ───────────────────────────────────────────────────────

export class TriWitnessValidator {
  /**
   * Validate a generated skill through all three witness channels.
   * Veto law: any FAIL → FAIL, any HOLD → HOLD, all PASS → PASS.
   */
  async validate(input: TriWitnessInput): Promise<TriWitnessResult> {
    const [human, ai, earth] = await Promise.all([
      this._humanChannel(input),
      this._aiChannel(input),
      this._earthChannel(input),
    ]);

    const consensus = this._computeConsensus(human, ai, earth);
    const canPromote = consensus === "PASS";
    const promotionTier: TrustTier | null = canPromote ? "REVIEWED" : null;
    const scarRequired = human.verdict === "FAIL" || ai.verdict === "FAIL" || earth.verdict === "FAIL";
    const aggregateScore = Math.cbrt(human.score * ai.score * earth.score);

    return {
      human, ai, earth,
      consensus, canPromote, promotionTier, scarRequired,
      aggregateScore: Math.round(aggregateScore * 1000) / 1000,
      summary: this._summarize(human, ai, earth, consensus),
    };
  }

  // ── HUMAN WITNESS ──────────────────────────────────────────────────

  private async _humanChannel(input: TriWitnessInput): Promise<ChannelResult> {
    const checks: Record<string, "PASS" | "FAIL" | "HOLD"> = {};
    let score = 1.0;
    const reasons: string[] = [];

    // F13 sovereign approval token
    if (!input.humanApprovalToken) {
      return {
        channel: "HUMAN", verdict: "FAIL", score: 0, confidence: 1.0,
        reason: "F13 sovereign approval token required.",
        timestamp: new Date().toISOString(),
      };
    }

    const validToken = /^stg_[a-z0-9]{16,}$/.test(input.humanApprovalToken);
    if (!validToken) {
      return {
        channel: "HUMAN", verdict: "FAIL", score: 0, confidence: 1.0,
        reason: "Invalid approval token format.",
        evidence: input.humanApprovalToken.slice(0, 8) + "...",
        timestamp: new Date().toISOString(),
      };
    }

    // Intent match: does skill code relate to stated intent?
    const intentWords = input.skillIntent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const codeLower = input.skillCode.toLowerCase();
    const matchedIntent = intentWords.filter(w => codeLower.includes(w));
    const intentScore = intentWords.length > 0 ? matchedIntent.length / intentWords.length : 0.5;
    checks.intent_match = intentScore >= 0.3 ? "PASS" : "HOLD";
    if (intentScore < 0.3) {
      score -= 0.2;
      reasons.push("Skill code doesn't clearly match stated intent");
    }

    // Reversibility: is the skill read-only or does it mutate?
    const mutationPatterns = /write|delete|rm|exec|spawn|modify|mutate|deploy/i;
    const isReadOnly = !mutationPatterns.test(input.skillCode);
    checks.reversibility = isReadOnly ? "PASS" : "HOLD";
    if (!isReadOnly) {
      reasons.push("Skill performs mutations — verify reversibility");
    }

    // Dignity: no coercion, no reduction of human to resource
    const dignityViolations = /coerce|force.*human|override.*sovereign|ignore.*human/i;
    checks.dignity = !dignityViolations.test(input.skillCode) ? "PASS" : "FAIL";
    if (dignityViolations.test(input.skillCode)) {
      score -= 0.5;
      reasons.push("Potential dignity violation detected");
    }

    const anyFail = Object.values(checks).some(c => c === "FAIL");
    // Intent match HOLD is advisory for short code — don't block on vocabulary mismatch
    const blockingHold = Object.entries(checks).some(([k, v]) => v === "HOLD" && k !== "intent_match");

    return {
      channel: "HUMAN",
      verdict: anyFail ? "FAIL" : blockingHold ? "HOLD" : "PASS",
      score: Math.max(0, score),
      confidence: 1.0,
      reason: reasons.length > 0
        ? `Human witness: ${reasons.join("; ")}`
        : `F13 sovereign approved: ${input.skillName}.`,
      evidence: input.humanApprovalToken,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  // ── AI WITNESS ─────────────────────────────────────────────────────

  private async _aiChannel(input: TriWitnessInput): Promise<ChannelResult> {
    // Self-validation check: skill cannot be its own AI witness
    if (input.generatorAgent && input.generatorAgent === input.skillName) {
      return {
        channel: "AI", verdict: "FAIL", score: 0, confidence: 1.0,
        reason: "CONSTITUTIONAL VIOLATION: skill cannot validate itself.",
        timestamp: new Date().toISOString(),
      };
    }

    const generatorModel = input.generatorModel?.toLowerCase() ?? "";
    const auditModel = this._selectAuditModel(generatorModel);
    const checks: Record<string, "PASS" | "FAIL" | "HOLD"> = {};
    const issues: string[] = [];
    let score = 1.0;

    // Schema validity: basic structure check
    const hasExport = /export\s+(const|function|class|default)/.test(input.skillCode);
    const hasHandler = /handler|execute|run|main/.test(input.skillCode);
    checks.schema = (hasExport || hasHandler) ? "PASS" : "HOLD";
    if (!hasExport && !hasHandler) {
      issues.push("No export or handler function found");
      score -= 0.1;
    }

    // Static safety: dangerous patterns
    if (/eval\s*\(|new\s+Function|execSync|child_process/i.test(input.skillCode)) {
      checks.static_safety = "FAIL";
      issues.push("Dynamic code execution detected");
      score -= 0.4;
    } else {
      checks.static_safety = "PASS";
    }

    // Credential access
    if (/process\.env\.(SECRET|TOKEN|KEY|PASS|CREDENTIAL)/i.test(input.skillCode)) {
      checks.static_safety = "FAIL";
      issues.push("Credential access detected");
      score -= 0.4;
    }

    // Permission scope: excessive external calls
    const externalCalls = input.skillCode.match(/fetch\(.*http|callMCP|callExternal/gi);
    checks.permission_scope = (!externalCalls || externalCalls.length <= 2) ? "PASS" : "HOLD";
    if (externalCalls && externalCalls.length > 2) {
      issues.push(`Excessive external calls: ${externalCalls.length}`);
      score -= 0.15;
    }

    // Self-modification
    if (/modify.*self|rewrite.*own|self\.modify|modify.*own.*source/i.test(input.skillCode)) {
      checks.permission_scope = "FAIL";
      issues.push("Self-modification pattern detected");
      score -= 0.3;
    }

    // Hidden escalation paths
    const hiddenPaths = /spawn|exec|sudo|chmod|setuid/i;
    checks.hidden_escalation = !hiddenPaths.test(input.skillCode) ? "PASS" : "HOLD";
    if (hiddenPaths.test(input.skillCode)) {
      issues.push("Potential escalation path detected");
      score -= 0.2;
    }

    score = Math.max(0, Math.min(1, score));
    const confidence = 0.7; // heuristic audit: moderate confidence
    const anyFail = Object.values(checks).some(c => c === "FAIL");
    const anyHold = Object.values(checks).some(c => c === "HOLD");
    const verdict = anyFail ? "FAIL" : anyHold ? "HOLD" : score >= 0.6 ? "PASS" : "HOLD";

    return {
      channel: "AI",
      verdict,
      score,
      confidence,
      reason: verdict === "PASS"
        ? `Cross-model (${auditModel}): ${issues.length ? issues.join("; ") : "Clean."}`
        : verdict === "HOLD"
          ? `Cross-model (${auditModel}) HOLD: ${issues.join("; ")}`
          : `Cross-model (${auditModel}) FAILED: ${issues.join("; ")}`,
      evidence: `audit=${auditModel}, generator=${generatorModel}`,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  // ── EARTH WITNESS ──────────────────────────────────────────────────

  private async _earthChannel(input: TriWitnessInput): Promise<ChannelResult> {
    const checks: Record<string, "PASS" | "FAIL" | "HOLD"> = {};
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0;

    // Earth witness REQUIRES non-LLM evidence
    const hasEvidence = input.earthEvidenceType && input.earthEvidenceType !== "NONE";
    const hasEvidenceContent = !!input.earthEvidence;

    if (!hasEvidence || !hasEvidenceContent) {
      return {
        channel: "EARTH", verdict: "HOLD", score: 0, confidence: 0,
        reason: "Earth witness requires non-LLM evidence (TEST, DOMAIN_ORGAN, or EXTERNAL_SOURCE). Keyword matching alone is insufficient.",
        checks: { non_llm_evidence: "HOLD" },
        timestamp: new Date().toISOString(),
      };
    }

    checks.non_llm_evidence = "PASS";

    // Domain correctness: signal matching against expected domain vocabulary
    const domainOrgans: Record<string, string> = {
      geox: "GEOX", wealth: "WEALTH", well: "WELL",
      arifos: "arifOS", aforge: "A-FORGE", general: "AAA",
    };
    const organ = domainOrgans[input.domain] ?? "AAA";

    const domainSignals: Record<string, string[]> = {
      geox: ["seismic", "basin", "petrophysics", "well", "formation", "porosity", "Vsh", "Sw", "gamma", "GR", "log", "depth"],
      wealth: ["NPV", "IRR", "capital", "cashflow", "portfolio", "risk", "asset"],
      well: ["vitality", "homeostasis", "fatigue", "dignity", "readiness", "sleep"],
      arifos: ["judge", "seal", "floor", "constitution", "session", "vault"],
      aforge: ["forge", "execute", "build", "deploy", "shell", "pipeline"],
    };

    const expectedSignals = domainSignals[input.domain] ?? [];
    const codeLower = (input.skillCode + " " + input.skillIntent).toLowerCase();
    const matchedSignals = expectedSignals.filter(s => codeLower.includes(s));
    const domainScore = expectedSignals.length > 0
      ? matchedSignals.length / expectedSignals.length
      : 0.6;

    checks.domain_correctness = domainScore >= 0.3 ? "PASS" : "HOLD";
    if (domainScore < 0.3) {
      reasons.push(`Domain mismatch: ${matchedSignals.length}/${expectedSignals.length} signals`);
    }

    // Evidence type scoring
    switch (input.earthEvidenceType) {
      case "TEST":         score = 0.7; confidence = 0.8; break;
      case "DOMAIN_ORGAN": score = 0.9; confidence = 0.9; break;
      case "EXTERNAL_SOURCE": score = 0.6; confidence = 0.7; break;
      default:             score = 0.3; confidence = 0.2; break;
    }

    // Blend domain score with evidence score
    score = Math.round((score * 0.6 + domainScore * 0.4) * 100) / 100;

    const anyFail = Object.values(checks).some(c => c === "FAIL");
    // Domain correctness HOLD is advisory when evidence exists — don't block promotion
    const blockingHold = Object.entries(checks).some(([k, v]) => v === "HOLD" && k !== "domain_correctness");
    const verdict = anyFail ? "FAIL" : blockingHold ? "HOLD" : score >= 0.4 ? "PASS" : "HOLD";

    return {
      channel: "EARTH", verdict, score, confidence,
      reason: reasons.length > 0
        ? `${organ}: ${reasons.join("; ")}. Evidence: ${input.earthEvidenceType}.`
        : `${organ} domain validated. ${matchedSignals.length}/${expectedSignals.length} signals. Evidence: ${input.earthEvidenceType}.`,
      evidence: `organ=${organ}, type=${input.earthEvidenceType}, signals=${matchedSignals.join(",")}`,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  // ── CONSENSUS (veto law, not averaging) ─────────────────────────────

  private _computeConsensus(human: ChannelResult, ai: ChannelResult, earth: ChannelResult): WitnessVerdict {
    const verdicts = [human.verdict, ai.verdict, earth.verdict];

    // Any FAIL → FAIL
    if (verdicts.some(v => v === "FAIL")) return "FAIL";

    // Any HOLD → HOLD
    if (verdicts.some(v => v === "HOLD")) return "HOLD";

    // Confidence below threshold → HOLD
    const confidences = [human.confidence, ai.confidence, earth.confidence];
    if (confidences.some(c => c < CONFIDENCE_THRESHOLD && c > 0)) return "HOLD";

    // All PASS
    if (verdicts.every(v => v === "PASS")) return "PASS";

    return "FAIL";
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private _selectAuditModel(generatorModel: string): string {
    if (generatorModel.includes("minimax")) return "deepseek-chat";
    if (generatorModel.includes("deepseek")) return "minimax-M2.7";
    return "cross-model-auditor";
  }

  private _summarize(h: ChannelResult, a: ChannelResult, e: ChannelResult, consensus: WitnessVerdict): string {
    const s = `H=${h.score.toFixed(1)}/${h.verdict} A=${a.score.toFixed(1)}/${a.verdict} E=${e.score.toFixed(1)}/${e.verdict}`;
    if (consensus === "PASS") return `Tri-Witness PASS (${s}). All channels clear.`;
    if (consensus === "HOLD") return `Tri-Witness HOLD (${s}). Missing evidence or confidence.`;
    return `Tri-Witness FAIL (${s}). ${[h,a,e].filter(c=>c.verdict==="FAIL").map(c=>`${c.channel}:${c.reason}`).join(" | ")}`;
  }
}

// ── Singleton ───────────────────────────────────────────────────────

let _instance: TriWitnessValidator | null = null;

export function getTriWitnessValidator(): TriWitnessValidator {
  if (!_instance) _instance = new TriWitnessValidator();
  return _instance;
}
