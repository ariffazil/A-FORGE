/**
 * admissibility.ts — deterministic pre-collapse choke point (predicate contract)
 * Forged 2026-11-15 (F13 directive): when the four quantum axes are NOT supplied
 * as structured data, do not fabricate pseudo-physics scalars. Admissibility from
 * PROVABLE predicates with provenance wins.
 *
 * Contract: candidate { id, claims[], evidence_refs[], contradictions[], falsifier, unknowns[] }
 * Rules: pure; fail closed; no invented falsifier/hash; never mutates;
 *        selected_proposal_only = true.
 */

import { createHash } from "node:crypto";

export interface CandidateInput {
  id: string;
  claims: string[];
  evidence_refs: string[];
  contradictions: string[];
  falsifier: string | null;
  unknowns: string[];
}

/** Resolved evidence: caller MUST supply a 64-hex sha256 per ref. Unresolved ref = unbound. */
export interface EvidenceRegistry {
  [ref: string]: { sha256: string } | undefined;
}

export interface CandidateEvaluation {
  candidateId: string;
  predicates: {
    claims_nonempty: boolean;
    evidence_bound: boolean;
    falsifier_present: boolean;
    contradictions_clear: boolean;
    unknowns_declared: boolean;
  };
  failed: string[];
  admissible: boolean;
  evaluatorVersion: "candidate-admissibility-v1";
  inputHash: string;
  evaluatedAt: string;
}

export interface CandidateSelection {
  status: "SELECTED" | "HOLD";
  selected: CandidateEvaluation | null;
  ordered: CandidateEvaluation[];
  reason: string;
}

const FALSIFIER_SENTINELS = new Set(["", "none", "n/a", "na", "tbd", "unknown", "null"]);

function canon(c: CandidateInput): string {
  return JSON.stringify({
    id: c.id,
    claims: [...c.claims],
    evidence_refs: [...c.evidence_refs].sort(),
    contradictions: [...c.contradictions],
    falsifier: c.falsifier,
    unknowns: [...c.unknowns].sort(),
  });
}

export function candidateInputHash(c: CandidateInput, evidence: EvidenceRegistry): string {
  const ev = Object.keys(evidence)
    .filter((k) => c.evidence_refs.includes(k))
    .sort()
    .map((k) => [k, evidence[k]?.sha256 ?? null]);
  return createHash("sha256").update(canon(c) + "|" + JSON.stringify(ev)).digest("hex");
}

export function evaluateCandidate(
  c: CandidateInput,
  evidence: EvidenceRegistry,
  now: () => string = () => new Date().toISOString(),
): CandidateEvaluation {
  const predicates = {
    claims_nonempty:
      Array.isArray(c.claims) && c.claims.some((x) => typeof x === "string" && x.trim().length > 0),
    evidence_bound:
      Array.isArray(c.evidence_refs) &&
      c.evidence_refs.length > 0 &&
      c.evidence_refs.every((r) => {
        const e = evidence[r];
        return !!e && typeof e.sha256 === "string" && /^[0-9a-f]{64}$/.test(e.sha256);
      }),
    falsifier_present:
      typeof c.falsifier === "string" && !FALSIFIER_SENTINELS.has(c.falsifier.trim().toLowerCase()),
    contradictions_clear: Array.isArray(c.contradictions) && c.contradictions.length === 0,
    unknowns_declared: Array.isArray(c.unknowns),
  };
  const failed = Object.entries(predicates)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return {
    candidateId: c.id,
    predicates,
    failed,
    admissible: failed.length === 0,
    evaluatorVersion: "candidate-admissibility-v1",
    inputHash: candidateInputHash(c, evidence),
    evaluatedAt: now(),
  };
}

/** Deterministic: admissible first; within group prior ranking then id; within
 *  inadmissible fewer failed predicates first. Posterior is a valid next prior. */
export function selectAdmissibleCandidates(
  evaluations: readonly CandidateEvaluation[],
  priorRanking: readonly string[] = [],
): CandidateSelection {
  const rank = (id: string) => {
    const i = priorRanking.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ordered = [...evaluations].sort((a, b) => {
    if (a.admissible !== b.admissible) return a.admissible ? -1 : 1;
    if (a.admissible) {
      return (
        rank(a.candidateId) - rank(b.candidateId) ||
        (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0)
      );
    }
    return (
      a.failed.length - b.failed.length ||
      rank(a.candidateId) - rank(b.candidateId) ||
      (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0)
    );
  });
  const selected = ordered[0]?.admissible ? ordered[0] : null;
  return {
    status: selected ? "SELECTED" : "HOLD",
    selected,
    ordered,
    reason: selected ? "admissible_candidate_selected" : "no_admissible_candidate",
  };
}

export interface EvaluationReceipt {
  receipt_version: "counterfactual-loop-receipt-v1";
  evaluator_version: "candidate-admissibility-v1";
  evaluated_count: number;
  admissible_count: number;
  input_hashes: Record<string, string>;
  admissible_set: string[];
  selection: { status: "SELECTED" | "HOLD"; selected: string | null; reason: string };
  selected_proposal_only: true;
  prior_ranking: string[];
  posterior_ranking: string[];
  changed_future_behavior: boolean;
  deterministic_core_hash: string;
  emitted_at: string;
}

export function emitReceipt(
  evaluations: readonly CandidateEvaluation[],
  selection: CandidateSelection,
  priorRanking: readonly string[],
  now: () => string = () => new Date().toISOString(),
): EvaluationReceipt {
  const input_hashes: Record<string, string> = {};
  for (const e of evaluations) input_hashes[e.candidateId] = e.inputHash;
  const posterior = selection.ordered.map((e) => e.candidateId);
  const core = JSON.stringify({
    evaluator: "candidate-admissibility-v1",
    input_hashes,
    admissible_set: evaluations.filter((e) => e.admissible).map((e) => e.candidateId),
    ordered: posterior,
    selected: selection.selected?.candidateId ?? null,
    prior: priorRanking,
  });
  return {
    receipt_version: "counterfactual-loop-receipt-v1",
    evaluator_version: "candidate-admissibility-v1",
    evaluated_count: evaluations.length,
    admissible_count: evaluations.filter((e) => e.admissible).length,
    input_hashes,
    admissible_set: evaluations.filter((e) => e.admissible).map((e) => e.candidateId),
    selection: {
      status: selection.status,
      selected: selection.selected?.candidateId ?? null,
      reason: selection.reason,
    },
    selected_proposal_only: true,
    prior_ranking: [...priorRanking],
    posterior_ranking: posterior,
    changed_future_behavior: posterior.length > 0 && posterior[0] !== (priorRanking[0] ?? null),
    deterministic_core_hash: createHash("sha256").update(core).digest("hex"),
    emitted_at: now(),
  };
}
