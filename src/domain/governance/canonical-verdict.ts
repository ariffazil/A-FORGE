/**
 * canonical-verdict.ts — THE ONE canonical verdict computer (R5).
 *
 * REPAIR R5 — ONE canonical kernel state/verdict computer.
 * Findings closed: CON-12 (two kernel self-reports disagree), CON-14 (init
 * success + HOLD in the same response), CON-15 (SABAR vs HOLD vs DENY across
 * fields), and the verdict half of the ghost-heartbeat family.
 *
 * ROOT CAUSE (RC-5, "state-redundant"): production ran several independent
 * verdict computers — the MCP interceptor, the seal mapper, the floor severity
 * mapper and the arifFlow adapter each derived their own effective verdict from
 * different fields. When they disagreed, nothing reconciled them, so one chain
 * carried three numbers/tokens for the same run (the SABAR-vs-HOLD-vs-DENY
 * divergence). Per reality-grounding doctrine we do NOT average disagreement —
 * we take the strictest candidate and DECLARE the divergence.
 *
 * LAW
 *  - One vocabulary: SEAL | SABAR | HOLD | VOID | ERROR.
 *  - Strictest wins: VOID > HOLD > SABAR > SEAL. A fault (isError) dominates all.
 *  - SABAR ≠ HOLD. SABAR means "proceed with caution"; HOLD means "blocked".
 *    Collapsing them is its own defect (AOB P0 2026-07-03).
 *  - Divergence is surfaced, never silently resolved.
 *  - Unknown verdict-family token fails closed (never inferred to SEAL).
 *
 * DITEMPA BUKAN DIBERI.
 */

export type CanonicalVerdict = "SEAL" | "SABAR" | "HOLD" | "VOID" | "ERROR";

/** Ordinal rank — higher is stricter. ERROR (fault) dominates every verdict. */
export const CANONICAL_VERDICT_RANK: Record<CanonicalVerdict, number> = {
  SEAL: 1,
  SABAR: 2,
  HOLD: 3,
  VOID: 4,
  ERROR: 5,
};

/**
 * Canonical token map. Foreign vocabularies that appear on the wire or in
 * sibling envelopes are folded into the single vocabulary HERE and nowhere
 * else. Add new aliases to this table — never to a second computer.
 */
const TOKEN_MAP: Record<string, CanonicalVerdict> = {
  // seal / success family
  SEAL: "SEAL",
  OK: "SEAL",
  SUCCESS: "SEAL",
  PASS: "SEAL",
  PASSED: "SEAL",
  APPROVED: "SEAL",
  PROCEED: "SEAL",
  ALLOWED: "SEAL",
  COMPLETED: "SEAL",
  WORK_DONE: "SEAL",
  // sabar / caution family
  SABAR: "SABAR",
  CAUTION: "SABAR",
  WARN: "SABAR",
  WARNING: "SABAR",
  DEGRADED: "SABAR",
  PARTIAL: "SABAR",
  // hold family
  HOLD: "HOLD",
  "888_HOLD": "HOLD",
  HOLDING: "HOLD",
  DENY: "HOLD",
  DENIED: "HOLD",
  BLOCKED: "HOLD",
  REJECTED: "HOLD",
  ACT_REQUIRED: "HOLD",
  NEEDS_REVIEW: "HOLD",
  // void family
  VOID: "VOID",
  FAIL: "VOID",
  FAILED: "VOID",
  ABORT: "VOID",
  ABORTED: "VOID",
  FATAL: "VOID",
  // fault
  ERROR: "ERROR",
  EXCEPTION: "ERROR",
};

export interface VerdictCandidate {
  /** Field path the token was read from — provenance, for the divergence report. */
  source: string;
  raw: unknown;
  verdict: CanonicalVerdict;
}

export interface CanonicalVerdictResult {
  /** THE verdict. This is the only field a consumer should branch on. */
  verdict: CanonicalVerdict;
  /** True when candidates disagreed — the finding itself, not noise. */
  divergent: boolean;
  /** Every distinct token observed, with provenance. Never averaged away. */
  observed: VerdictCandidate[];
  /** Human-readable reason: why this token won. */
  reason: string;
}

/**
 * Normalise one raw token to the canonical vocabulary.
 * Returns null when the token carries no verdict meaning (not a refusal,
 * not an affirmation) so callers can ignore it without inventing a verdict.
 */
export function normalizeVerdictToken(raw: unknown): CanonicalVerdict | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw ? "SEAL" : "HOLD";
  let s = String(raw).trim().toUpperCase();
  if (!s) return null;
  // "OK.CONDITIONAL" → OK ; "HOLD.AUTH_REQUIRED" → HOLD ; "VOID.HANTU" → VOID
  const dot = s.indexOf(".");
  if (dot > 0) s = s.slice(0, dot);
  if (Object.prototype.hasOwnProperty.call(TOKEN_MAP, s)) return TOKEN_MAP[s];
  return null;
}

function collect(obj: any): VerdictCandidate[] {
  const out: VerdictCandidate[] = [];
  if (!obj || typeof obj !== "object") return out;

  const push = (source: string, raw: unknown) => {
    const v = normalizeVerdictToken(raw);
    if (v) out.push({ source, raw, verdict: v });
  };

  // Explicit fault signals first — a crash is not a constitutional refusal.
  if (obj.isError === true || obj.error) {
    out.push({ source: "isError", raw: true, verdict: "ERROR" });
  }

  // Top-level verdict-bearing fields.
  push("status", obj.status);
  push("verdict", obj.verdict);
  push("effective_verdict", obj.effective_verdict);
  push("canonical_verdict", obj.canonical_verdict);

  // Boolean refusals.
  if (obj.blocked === true) push("blocked", "HOLD");
  if (obj.allowed === false) push("allowed", "HOLD");

  // CON-15: the kernel's own reconciliation block is a verdict source and was
  // being ignored — the top-level said SABAR while reconciliation said HOLD/DENY.
  const recon = obj.meta?.reconciliation ?? obj.reconciliation;
  if (recon && typeof recon === "object") {
    push("meta.reconciliation.effective_verdict", recon.effective_verdict);
    push("meta.reconciliation.canonical_verdict", recon.canonical_verdict);
    push("meta.reconciliation.raw_verdict", recon.raw_verdict);
  }

  return out;
}

/**
 * THE computer. Given any kernel/MCP response shape, return one verdict.
 *
 * Precedence is not "first field wins" (that is how CON-14 and CON-15 leaked —
 * the success receipt was read before the refusal). Strictest-wins is the law:
 * a run that is simultaneously reported healthy and held IS held.
 */
export function resolveCanonicalVerdict(input: any): CanonicalVerdictResult {
  const observed = collect(input);

  if (observed.length === 0) {
    // No verdict signal at all. A tool that returned plain data with no
    // refusal is a success — this default is unchanged from the previous
    // interceptor so bare data responses keep their meaning.
    return {
      verdict: "SEAL",
      divergent: false,
      observed,
      reason: "no verdict signal present — default pass (bare data response)",
    };
  }

  const strictest = observed.reduce((a, b) =>
    CANONICAL_VERDICT_RANK[b.verdict] > CANONICAL_VERDICT_RANK[a.verdict] ? b : a,
  );

  const distinct = new Set(observed.map((o) => o.verdict));
  const divergent = distinct.size > 1;

  const reason = divergent
    ? `DIVERGENT verdicts observed (${[...distinct].join(" vs ")}) — strictest wins: ${strictest.verdict} (from ${strictest.source})`
    : `${strictest.verdict} (from ${strictest.source})`;

  return { verdict: strictest.verdict, divergent, observed, reason };
}

/**
 * Convenience: the verdict token only, for callers that just need the word.
 */
export function canonicalVerdictOf(input: any): CanonicalVerdict {
  return resolveCanonicalVerdict(input).verdict;
}
