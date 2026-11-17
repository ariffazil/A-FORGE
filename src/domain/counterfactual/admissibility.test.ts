/** Negative + positive + determinism tests for the predicate choke point.
 *  2026-11-15. All candidates here are TEST FIXTURES — not geology claims. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCandidate,
  selectAdmissibleCandidates,
  emitReceipt,
  type CandidateInput,
  type EvidenceRegistry,
} from "./admissibility.js";

const H = (n: number) => n.toString(16).padStart(64, "0");
const EV: EvidenceRegistry = {
  "ev.gas": { sha256: H(1) },
  "ev.temp": { sha256: H(2) },
};
const good: CandidateInput = {
  id: "H-good",
  claims: ["candidate with bound evidence and explicit falsifier"],
  evidence_refs: ["ev.gas", "ev.temp"],
  contradictions: [],
  falsifier: "isotope separation cannot explain C1-C2 delta beyond measurement error",
  unknowns: [],
};
const now = () => "2026-11-15T00:00:00.000Z";

test("negative: missing evidence refs -> inadmissible, reason listed", () => {
  const e = evaluateCandidate({ ...good, evidence_refs: [] }, EV, now);
  assert.equal(e.admissible, false);
  assert.ok(e.failed.includes("evidence_bound"));
});

test("negative: unresolved ref (no hash) -> inadmissible (fail closed)", () => {
  const e = evaluateCandidate({ ...good, evidence_refs: ["ev.gas", "ev.missing"] }, EV, now);
  assert.equal(e.admissible, false);
  assert.ok(e.failed.includes("evidence_bound"));
});

test("negative: falsifier sentinels are not falsifiers", () => {
  for (const f of [null, "", "tbd", "N/A", "none"]) {
    const e = evaluateCandidate({ ...good, falsifier: f as any }, EV, now);
    assert.equal(e.admissible, false, `falsifier=${JSON.stringify(f)} must fail`);
    assert.ok(e.failed.includes("falsifier_present"));
  }
});

test("negative: any contradiction keeps candidate inadmissible", () => {
  const e = evaluateCandidate({ ...good, contradictions: ["well top vs seismic mismatch unresolved"] }, EV, now);
  assert.equal(e.admissible, false);
  assert.ok(e.failed.includes("contradictions_clear"));
});

test("negative: empty claims -> inadmissible", () => {
  const e = evaluateCandidate({ ...good, claims: ["  "] }, EV, now);
  assert.equal(e.admissible, false);
  assert.ok(e.failed.includes("claims_nonempty"));
});

test("positive: all predicates hold -> admissible", () => {
  const e = evaluateCandidate(good, EV, now);
  assert.equal(e.admissible, true, JSON.stringify(e.failed));
  assert.equal(e.failed.length, 0);
});

test("determinism: same input => same inputHash; core hash stable across timestamps", () => {
  const e1 = evaluateCandidate(good, EV, () => "2026-11-15T00:00:00.000Z");
  const e2 = evaluateCandidate(good, EV, () => "2030-01-01T00:00:00.000Z");
  assert.equal(e1.inputHash, e2.inputHash);
  const s = selectAdmissibleCandidates([e1], []);
  const r1 = emitReceipt([e1], s, [], () => "2026-11-15T00:00:00.000Z");
  const r2 = emitReceipt([e2], s, [], () => "2030-01-01T00:00:00.000Z");
  assert.equal(r1.deterministic_core_hash, r2.deterministic_core_hash);
});

test("selection: no admissible -> HOLD, never selects", () => {
  const bad = evaluateCandidate({ ...good, id: "H-bad", evidence_refs: [] }, EV, now);
  const s = selectAdmissibleCandidates([bad], ["H-bad"]);
  assert.equal(s.status, "HOLD");
  assert.equal(s.selected, null);
});

test("selection: admissible beats higher-prior inadmissible", () => {
  const bad = evaluateCandidate({ ...good, id: "H-bad", evidence_refs: [] }, EV, now);
  const okc = evaluateCandidate(good, EV, now);
  const s = selectAdmissibleCandidates([bad, okc], ["H-bad", "H-good"]);
  assert.equal(s.status, "SELECTED");
  assert.equal(s.selected?.candidateId, "H-good");
});

test("selection: prior ranking respected among admissible; id tie-break", () => {
  const a = evaluateCandidate({ ...good, id: "H-a" }, EV, now);
  const b = evaluateCandidate({ ...good, id: "H-b" }, EV, now);
  const s1 = selectAdmissibleCandidates([a, b], ["H-b", "H-a"]);
  assert.equal(s1.selected?.candidateId, "H-b");
  const s2 = selectAdmissibleCandidates([a, b], []);
  assert.equal(s2.selected?.candidateId, "H-a");
});

test("receipt: changed_future_behavior true when posterior head differs from prior head", () => {
  const bad = evaluateCandidate({ ...good, id: "H-bad", evidence_refs: [] }, EV, now);
  const okc = evaluateCandidate(good, EV, now);
  const s = selectAdmissibleCandidates([bad, okc], ["H-bad", "H-good"]);
  const r = emitReceipt([bad, okc], s, ["H-bad", "H-good"], now);
  assert.equal(r.selection.status, "SELECTED");
  assert.equal(r.posterior_ranking[0], "H-good");
  assert.equal(r.changed_future_behavior, true);
  assert.equal(r.selected_proposal_only, true);
});

test("ordering among inadmissible: fewer failed predicates first (most recoverable)", () => {
  const near = evaluateCandidate({ ...good, id: "H-near", contradictions: ["x"] }, EV, now); // 1 fail
  const far = evaluateCandidate({ ...good, id: "H-far", evidence_refs: [], falsifier: null }, EV, now); // 3 fails
  const s = selectAdmissibleCandidates([far, near], []);
  assert.deepEqual(s.ordered.map((x) => x.candidateId), ["H-near", "H-far"]);
});
