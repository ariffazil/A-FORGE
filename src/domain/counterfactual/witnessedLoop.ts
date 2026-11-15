/**
 * witnessedLoop.ts — deterministic pre-collapse choke point + witnessed consequence update.
 *
 * Composes with admissibility.ts without altering it:
 *   1. Verifies real evidence files on disk via sha256 (missing or mismatched = unbound).
 *   2. Verifies witness artifact sha256 against verified disk registry (fail-closed).
 *   3. Executes Round 1 selection -> binds verified witness refutations immutably ->
 *      executes Round 2 selection with Round 1 posterior as prior -> proves behavioral update ->
 *      executes Round 3 stability replay at converged ranking.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
  evaluateCandidate,
  selectAdmissibleCandidates,
  emitReceipt,
  type CandidateInput,
  type CandidateEvaluation,
  type CandidateSelection,
  type EvidenceRegistry,
  type EvaluationReceipt,
} from "./admissibility.js";

export interface DiskEvidenceVerification {
  registry: EvidenceRegistry;
  provenance: Record<string, { path: string; bytes: number; sha256: string }>;
  failures: Record<string, string>;
}

export interface CandidateRefutation {
  candidateId: string;
  contradiction: string;
  evidenceRef: string;
}

export interface WitnessOutcome {
  witnessId: string;
  witnessArtifactRef: string;
  witnessSha256: string;
  observedAt: string;
  refutations: CandidateRefutation[];
}

export interface PreCollapseGuardResult {
  allowed: boolean;
  selectedCandidateId: string | null;
  reason: string;
  proposalOnly: true;
}

export interface WitnessedCycleReport {
  report_version: "geox-witnessed-cycle-v1";
  evidence_verification: DiskEvidenceVerification;
  witness: WitnessOutcome;
  round1: {
    evaluations: CandidateEvaluation[];
    selection: CandidateSelection;
    receipt: EvaluationReceipt;
    guard: PreCollapseGuardResult;
  };
  round2: {
    candidates: CandidateInput[];
    evaluations: CandidateEvaluation[];
    selection: CandidateSelection;
    receipt: EvaluationReceipt;
    guard: PreCollapseGuardResult;
  };
  round3_stability: {
    selection: CandidateSelection;
    receipt: EvaluationReceipt;
    guard: PreCollapseGuardResult;
  };
  prior_selected: string | null;
  posterior_selected: string | null;
  selection_flipped: boolean;
  changed_future_behavior: boolean;
  converged_on_replay: boolean;
  deterministic_cycle_hash: string;
  generated_at: string;
}

const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Resolve and hash evidence files directly from disk. Any missing file, non-file,
 * or sha256 mismatch is omitted from the verified EvidenceRegistry so evaluateCandidate
 * fails closed on `evidence_bound`.
 */
export function verifyDiskEvidence(
  refPaths: Readonly<Record<string, string>>,
  expectedSha256?: Readonly<Record<string, string>>,
): DiskEvidenceVerification {
  const registry: EvidenceRegistry = {};
  const provenance: Record<string, { path: string; bytes: number; sha256: string }> = {};
  const failures: Record<string, string> = {};

  for (const ref of Object.keys(refPaths).sort()) {
    const filePath = refPaths[ref];
    try {
      const st = statSync(filePath);
      if (!st.isFile()) {
        failures[ref] = "not_regular_file";
        continue;
      }
      const bytes = readFileSync(filePath);
      const actualSha = createHash("sha256").update(bytes).digest("hex");
      const expected = expectedSha256?.[ref];
      if (expected !== undefined && expected !== actualSha) {
        failures[ref] = `sha256_mismatch:expected=${expected},actual=${actualSha}`;
        continue;
      }
      registry[ref] = { sha256: actualSha };
      provenance[ref] = { path: filePath, bytes: bytes.byteLength, sha256: actualSha };
    } catch (err) {
      failures[ref] = err instanceof Error ? err.message : "stat_or_read_failed";
    }
  }

  return { registry, provenance, failures };
}

/** Deterministic pre-collapse execution guard: HOLD blocks downstream execution. */
export function preCollapseGuard(receipt: EvaluationReceipt): PreCollapseGuardResult {
  const selected = receipt.selection.selected;
  if (receipt.selection.status !== "SELECTED" || !selected) {
    return {
      allowed: false,
      selectedCandidateId: null,
      reason: `HOLD:${receipt.selection.reason}`,
      proposalOnly: true,
    };
  }
  return {
    allowed: true,
    selectedCandidateId: selected,
    reason: "admissible_candidate_selected",
    proposalOnly: true,
  };
}

/** Fail closed unless the witness matches a verified 64-hex disk evidence artifact. */
export function verifyWitnessOutcome(
  witness: WitnessOutcome,
  evidence: EvidenceRegistry,
): void {
  if (!witness.witnessId || witness.witnessId.trim().length === 0) {
    throw new Error("WITNESS_UNVERIFIED: empty witnessId");
  }
  if (!SHA256_RE.test(witness.witnessSha256)) {
    throw new Error("WITNESS_UNVERIFIED: invalid sha256 format");
  }
  const bound = evidence[witness.witnessArtifactRef];
  if (!bound || bound.sha256 !== witness.witnessSha256) {
    throw new Error(
      `WITNESS_UNVERIFIED: artifact ref ${witness.witnessArtifactRef} hash mismatch or unbound`,
    );
  }
  for (const r of witness.refutations) {
    if (!r.contradiction || r.contradiction.trim().length === 0) {
      throw new Error(`WITNESS_INVALID: empty contradiction for ${r.candidateId}`);
    }
    const ev = evidence[r.evidenceRef];
    if (!ev || !SHA256_RE.test(ev.sha256)) {
      throw new Error(
        `WITNESS_EVIDENCE_UNBOUND: ref ${r.evidenceRef} for ${r.candidateId} not verified`,
      );
    }
  }
}

function cloneCandidate(c: CandidateInput): CandidateInput {
  return {
    id: c.id,
    claims: [...c.claims],
    evidence_refs: [...c.evidence_refs],
    contradictions: [...c.contradictions],
    falsifier: c.falsifier,
    unknowns: [...c.unknowns],
  };
}

/** Apply verified witness refutations without mutating Round 1 candidate objects. */
export function applyWitnessRefutations(
  candidates: readonly CandidateInput[],
  witness: WitnessOutcome,
): CandidateInput[] {
  const byId = new Map<string, CandidateRefutation[]>();
  for (const ref of witness.refutations) {
    const list = byId.get(ref.candidateId) ?? [];
    list.push(ref);
    byId.set(ref.candidateId, list);
  }
  return candidates.map((c) => {
    const copy = cloneCandidate(c);
    const matches = byId.get(c.id);
    if (!matches || matches.length === 0) return copy;
    for (const m of matches) {
      if (!copy.contradictions.includes(m.contradiction)) {
        copy.contradictions.push(m.contradiction);
      }
      if (!copy.evidence_refs.includes(m.evidenceRef)) {
        copy.evidence_refs.push(m.evidenceRef);
      }
    }
    return copy;
  });
}

/** Execute Round 1 -> Witness Verification -> Round 2 Flip -> Round 3 Replay Convergence. */
export function runWitnessedSelectionCycle(params: {
  round1Candidates: readonly CandidateInput[];
  priorRanking: readonly string[];
  evidenceVerification: DiskEvidenceVerification;
  witness: WitnessOutcome;
  now?: () => string;
}): WitnessedCycleReport {
  const now = params.now ?? (() => new Date().toISOString());
  const { registry } = params.evidenceVerification;

  const r1Evals = params.round1Candidates.map((c) => evaluateCandidate(c, registry, now));
  const r1Sel = selectAdmissibleCandidates(r1Evals, params.priorRanking);
  const r1Receipt = emitReceipt(r1Evals, r1Sel, params.priorRanking, now);
  const r1Guard = preCollapseGuard(r1Receipt);

  // Fail closed before allowing witness refutations to alter Round 2 candidates.
  verifyWitnessOutcome(params.witness, registry);

  const r2Candidates = applyWitnessRefutations(params.round1Candidates, params.witness);
  const r2Evals = r2Candidates.map((c) => evaluateCandidate(c, registry, now));
  const r2Prior = r1Receipt.posterior_ranking;
  const r2Sel = selectAdmissibleCandidates(r2Evals, r2Prior);
  const r2Receipt = emitReceipt(r2Evals, r2Sel, r2Prior, now);
  const r2Guard = preCollapseGuard(r2Receipt);

  const r3Prior = r2Receipt.posterior_ranking;
  const r3Sel = selectAdmissibleCandidates(r2Evals, r3Prior);
  const r3Receipt = emitReceipt(r2Evals, r3Sel, r3Prior, now);
  const r3Guard = preCollapseGuard(r3Receipt);

  const corePayload = JSON.stringify({
    r1: r1Receipt.deterministic_core_hash,
    r2: r2Receipt.deterministic_core_hash,
    r3: r3Receipt.deterministic_core_hash,
    witnessSha256: params.witness.witnessSha256,
  });

  return {
    report_version: "geox-witnessed-cycle-v1",
    evidence_verification: params.evidenceVerification,
    witness: params.witness,
    round1: { evaluations: r1Evals, selection: r1Sel, receipt: r1Receipt, guard: r1Guard },
    round2: {
      candidates: r2Candidates,
      evaluations: r2Evals,
      selection: r2Sel,
      receipt: r2Receipt,
      guard: r2Guard,
    },
    round3_stability: { selection: r3Sel, receipt: r3Receipt, guard: r3Guard },
    prior_selected: r1Receipt.selection.selected,
    posterior_selected: r2Receipt.selection.selected,
    selection_flipped: r2Receipt.selection.selected !== r1Receipt.selection.selected,
    changed_future_behavior:
      r2Receipt.changed_future_behavior ||
      r2Receipt.selection.selected !== r1Receipt.selection.selected,
    converged_on_replay:
      r3Receipt.selection.selected === r2Receipt.selection.selected &&
      !r3Receipt.changed_future_behavior,
    deterministic_cycle_hash: createHash("sha256").update(corePayload).digest("hex"),
    generated_at: now(),
  };
}
