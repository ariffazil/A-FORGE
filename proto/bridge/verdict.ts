/**
 * J-Space Canonical Verdict — TypeScript Mirror
 * ==============================================
 * Unified verdict type for all organs. Imports from the same geometry
 * as the Python verdict.py. No local verdict definitions.
 *
 * v1.0 ratified 2026-07-07 — 5-state lattice (added PARTIAL between SABAR and SEAL)
 * Monotonicity: VOID > HOLD > SABAR > PARTIAL > SEAL
 *
 * This is the TypeScript side of the J-Space bridge.
 *
 * DITEMPA BUKAN DIBERI — Verdicts are unified, not duplicated.
 */

// ── The five canonical verdicts (v1.0 ratified 2026-07-07) ──────────────────

export const VERDICT_TYPES = ["VOID", "HOLD", "SABAR", "PARTIAL", "SEAL"] as const;
export type VerdictType = (typeof VERDICT_TYPES)[number];

// Weight mapping — higher = more restrictive (matches Python VERDICT_ORDER)
// VOID=4, HOLD=3, SABAR=2, PARTIAL=1, SEAL=0
export const VERDICT_WEIGHT: Record<VerdictType, number> = {
  VOID: 4,
  HOLD: 3,
  SABAR: 2,
  PARTIAL: 1,
  SEAL: 0,
};

export const VERDICT_TERMINAL: Set<VerdictType> = new Set(["SEAL", "VOID"]);

export function isTerminal(verdict: VerdictType): boolean {
  return VERDICT_TERMINAL.has(verdict);
}

export function isAllowed(verdict: VerdictType): boolean {
  // SEAL/PARTIAL/SABAR (weight ≤ 2) allow progression with semantics
  return VERDICT_WEIGHT[verdict] <= 2;
}

export function canTransition(from: VerdictType, to: VerdictType): boolean {
  if (isTerminal(from)) return false; // SEAL/VOID cannot transition
  if (to === "VOID") return true;     // violation always allowed
  if (to === "SEAL") return true;     // approval always allowed
  return true; // HOLD ↔ SABAR ↔ PARTIAL allowed
}

// ── Action classes ──────────────────────────────────────────────────────────

export const ACTION_CLASSES = [
  "OBSERVE",
  "EXECUTE_REVERSIBLE",
  "EXECUTE_IRREVERSIBLE",
  "EXTERNAL_SIDE_EFFECT",
] as const;
export type ActionClass = (typeof ACTION_CLASSES)[number];

// ── Epistemic labels ────────────────────────────────────────────────────────

export const EPISTEMIC_LABELS = ["OBS", "DER", "INT", "SPEC"] as const;
export type EpistemicLabel = (typeof EPISTEMIC_LABELS)[number];

export const EPISTEMIC_CAPS: Record<EpistemicLabel, number> = {
  OBS: 0.90,
  DER: 0.85,
  INT: 0.75,
  SPEC: 0.60,
};

export function canPromote(from: EpistemicLabel, to: EpistemicLabel): boolean {
  const order: EpistemicLabel[] = ["SPEC", "INT", "DER", "OBS"];
  return order.indexOf(to) > order.indexOf(from);
}

// ── Canonical Verdict ───────────────────────────────────────────────────────

export interface CanonicalVerdict {
  verdict: VerdictType;
  action_class: ActionClass;
  epistemic: EpistemicLabel;
  confidence: number;
  organ: string;
  tool: string;
  target: string;
  intent: string;
  actor: string;
  session_id?: string;
  lease_id?: string;
  authority_token?: string;
  violated_floors: string[];
  evidence: Array<Record<string, unknown>>;
  receipt_id?: string;
  timestamp: string;
  fingerprint: string;
}

/**
 * Compute fingerprint for a verdict (same algorithm as Python).
 */
export function fingerprintVerdict(v: Omit<CanonicalVerdict, "fingerprint">): string {
  const canonical = JSON.stringify({
    verdict: v.verdict,
    action_class: v.action_class,
    epistemic: v.epistemic,
    organ: v.organ,
    tool: v.tool,
    target: v.target,
    actor: v.actor,
    timestamp: v.timestamp,
  });
  const hash = require("node:crypto").createHash("sha256").update(canonical).digest("hex");
  return hash.slice(0, 16);
}

// ── Factory functions ───────────────────────────────────────────────────────

export function sealVerdict(
  organ: string, tool: string, target: string, actor: string,
  opts: Partial<Pick<CanonicalVerdict, "action_class" | "epistemic" | "confidence" | "session_id" | "lease_id">> = {},
): CanonicalVerdict {
  const now = new Date().toISOString();
  const v: Omit<CanonicalVerdict, "fingerprint"> = {
    verdict: "SEAL",
    action_class: opts.action_class ?? "OBSERVE",
    epistemic: opts.epistemic ?? "OBS",
    confidence: opts.confidence ?? 0.90,
    organ, tool, target, actor,
    intent: "Action is lawful. Proceed.",
    violated_floors: [],
    evidence: [],
    timestamp: now,
    session_id: opts.session_id,
    lease_id: opts.lease_id,
  };
  return { ...v, fingerprint: fingerprintVerdict(v) };
}

export function holdVerdict(
  organ: string, tool: string, target: string, actor: string, reason: string,
  opts: Partial<Pick<CanonicalVerdict, "action_class" | "epistemic" | "confidence">> = {},
): CanonicalVerdict {
  const now = new Date().toISOString();
  const v: Omit<CanonicalVerdict, "fingerprint"> = {
    verdict: "HOLD",
    action_class: opts.action_class ?? "EXECUTE_REVERSIBLE",
    epistemic: opts.epistemic ?? "DER",
    confidence: opts.confidence ?? 0.80,
    organ, tool, target, actor,
    intent: reason,
    violated_floors: [],
    evidence: [],
    timestamp: now,
  };
  return { ...v, fingerprint: fingerprintVerdict(v) };
}

export function voidVerdict(
  organ: string, tool: string, target: string, actor: string, violations: string[],
): CanonicalVerdict {
  const now = new Date().toISOString();
  const v: Omit<CanonicalVerdict, "fingerprint"> = {
    verdict: "VOID",
    action_class: "EXECUTE_IRREVERSIBLE",
    epistemic: "OBS",
    confidence: 0.0,
    organ, tool, target, actor,
    intent: "Constitutionally prohibited.",
    violated_floors: violations,
    evidence: [],
    timestamp: now,
  };
  return { ...v, fingerprint: fingerprintVerdict(v) };
}

// ── Monotonicity enforcement ────────────────────────────────────────────────

export class VerdictChain {
  private chain: CanonicalVerdict[] = [];

  append(verdict: CanonicalVerdict): boolean {
    if (this.chain.length > 0) {
      const last = this.chain[this.chain.length - 1];
      if (!canTransition(last.verdict, verdict.verdict)) {
        throw new Error(
          `Verdict monotonicity violation: ${last.verdict} → ${verdict.verdict} (terminal verdicts cannot transition)`,
        );
      }
    }
    this.chain.push(verdict);
    return true;
  }

  last(): CanonicalVerdict | undefined {
    return this.chain[this.chain.length - 1];
  }

  isSealed(): boolean {
    return this.chain.some(v => v.verdict === "SEAL");
  }

  isVoided(): boolean {
    return this.chain.some(v => v.verdict === "VOID");
  }

  toArray(): CanonicalVerdict[] {
    return [...this.chain];
  }
}

// ── The 14 substates ───────────────────────────────────────────────────────

export const VERDICT_SUBSTATES = [
  // SEAL (4)
  "S1_SEAL_ROUTINE", "S2_SEAL_CONDITIONAL", "S3_SEAL_WITNESSED", "S4_SEAL_SOVEREIGN",
  // HOLD (4)
  "H1_HOLD_AUTHORITY", "H2_HOLD_EVIDENCE", "H3_HOLD_CONFLICT", "H4_HOLD_ELICITATION",
  // SABAR (3)
  "B1_SABAR_PATIENCE", "B2_SABAR_MATURITY", "B3_SABAR_COOLDOWN",
  // VOID (2)
  "V1_VOID_VIOLATION", "V2_VOID_HALLUCINATION",
  // UNKNOWN (1)
  "U1_UNKNOWN_INSUFFICIENT",
] as const;
export type VerdictSubstate = (typeof VERDICT_SUBSTATES)[number];

// ── DeliveryVerdict — tool execution outcomes, NOT governance ──────────────

export const DELIVERY_VERDICTS = ["SUCCESS", "ERROR", "TIMEOUT", "BLOCKED", "PENDING"] as const;
export type DeliveryVerdict = (typeof DELIVERY_VERDICTS)[number];

// ── L↔F Mapping (MALU-GÖDEL ↔ Verdict Lattice) ─────────────────────────────

export const MALU_GODEL_STATES = ["LURUS", "SESAT", "HALLUCINATIO", "BIJAKSANA", "BANGANG"] as const;
export type MaluGodelState = (typeof MALU_GODEL_STATES)[number];

export const MALU_GODEL_TO_VERDICT: Record<MaluGodelState, VerdictType> = {
  LURUS: "PARTIAL",        // Ready for SEAL candidacy
  SESAT: "HOLD",           // Needs refinement
  HALLUCINATIO: "VOID",    // Void immediately
  BIJAKSANA: "SEAL",       // Seal with witness
  BANGANG: "SABAR",        // Cool down, re-approach
};
