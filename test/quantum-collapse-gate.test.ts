/**
 * P0-QUANTUM-DETERMINISTIC-COLLAPSE-GATE — focused tests (2026-11-15)
 *
 * Slice status: INPUT_BINDING_GAP. The model→engine boundary does not yet
 * carry structured axes; this suite proves the typed ingestion contract,
 * the fail-closed evaluator, and the guarded collapse choke point that make
 * that gap SAFE (nothing can collapse without a deterministic evaluation).
 *
 * Falsification: passing tests do NOT prove the collapse formula matches
 * reality; they prove the gate refuses everything that is not a valid,
 * current, hash-bound evaluation.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createLoop } from "../src/domain/reality-loop/engine.js";
import {
  QuantumAxesError,
  collapseHypothesis,
  evaluateQuantumCandidate,
  quantumAxesHash,
  selectAdmissible,
  setHypotheses,
  validateQuantumAxes,
} from "../src/domain/reality-loop/engine.js";
import type {
  QuantumAxes,
  QuantumEvaluation,
  RealityLoopState,
} from "../src/domain/reality-loop/types.js";

const AX: QuantumAxes = { q: 0.8, v: 0.75, psi: 0.85, phi: 0.9 };

function makeLoop(axesList: Array<QuantumAxes | null>): RealityLoopState {
  // Floor split (F13 2026-11-15): axis tests bind axis_floor=0.70 and set the
  // product floor to 0 so these fixtures exercise AXIS semantics only. The
  // product-floor check has its own dedicated tests below.
  const state = createLoop(`p0-quantum-test-${Math.random().toString(36).slice(2)}`, {
    min_g_score: 0,
    min_witness: 0,
    axis_floor: 0.7,
  });
  state.iteration = 1;
  setHypotheses(
    state,
    axesList.map((axes, i) => ({
      statement: `hypothesis ${i + 1}`,
      supporting_evidence: [],
      contradicting_evidence: [],
      collapse_measurement: "",
      collapsed: false,
      axes,
    })),
  );
  return state;
}

function evaluateFor(state: RealityLoopState, idx = 0): QuantumEvaluation {
  const h = state.active_hypotheses[idx];
  assert.ok(h.axes, "test fixture must carry axes");
  return evaluateQuantumCandidate({
    hypothesisId: h.id,
    axes: h.axes,
    floor: state.effective_config.axis_floor,
    productFloor: state.effective_config.min_g_score,
    iteration: state.iteration,
  });
}

// 1 — balanced axes pass
test("balanced axes: product score, min>=floor, eligible", () => {
  const ev = evaluateQuantumCandidate({ hypothesisId: "H1-1", axes: AX, floor: 0.7, iteration: 1 });
  assert.ok(Math.abs(ev.score - 0.8 * 0.75 * 0.85 * 0.9) < 1e-12);
  assert.equal(ev.minAxis, 0.75);
  assert.equal(ev.eligible, true);
  assert.deepEqual(ev.failedAxes, []);
  assert.equal(ev.evaluatorVersion, "quantum-evaluator-v1");
});

// 2 — one axis below floor fails despite high product elsewhere
test("one axis below floor: ineligible despite high product", () => {
  const ev = evaluateQuantumCandidate({
    hypothesisId: "H1-1",
    axes: { q: 0.99, v: 0.99, psi: 0.99, phi: 0.5 },
    floor: 0.7,
    iteration: 1,
  });
  assert.ok(ev.score > 0.48, "product stays high");
  assert.equal(ev.eligible, false);
  assert.deepEqual(ev.failedAxes, ["phi"]);
});

// 3 — exact floor passes (not below)
test("axis exactly at floor is admissible", () => {
  const ev = evaluateQuantumCandidate({
    hypothesisId: "H1-1",
    axes: { q: 0.7, v: 0.7, psi: 0.7, phi: 0.7 },
    floor: 0.7,
    iteration: 1,
  });
  assert.equal(ev.eligible, true);
  assert.deepEqual(ev.failedAxes, []);
});

// 4 — missing axis fails closed
test("missing axis throws (fail closed, no invention)", () => {
  assert.throws(
    () =>
      evaluateQuantumCandidate({
        hypothesisId: "H1-1",
        axes: { q: 0.8, v: 0.8, psi: 0.8 } as unknown as QuantumAxes,
        floor: 0.7,
        iteration: 1,
      }),
    QuantumAxesError,
  );
});

// 5 — NaN / Infinity / out-of-range fail closed
test("NaN, Infinity, out-of-range all fail closed (no clamping)", () => {
  for (const bad of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(
      () =>
        evaluateQuantumCandidate({
          hypothesisId: "H1-1",
          axes: { q: bad, v: 0.8, psi: 0.8, phi: 0.8 },
          floor: 0.7,
          iteration: 1,
        }),
      QuantumAxesError,
      `axis=${bad} must throw`,
    );
  }
  assert.deepEqual(validateQuantumAxes(null), { ok: false, failed: ["q", "v", "psi", "phi"] });
});

// 6 — empty admissible set -> HOLD
test("no admissible candidate returns HOLD", () => {
  const mk = (id: string, phi: number): QuantumEvaluation =>
    evaluateQuantumCandidate({ hypothesisId: id, axes: { q: 0.9, v: 0.9, psi: 0.9, phi }, floor: 0.7, iteration: 1 });
  assert.deepEqual(selectAdmissible([mk("H1-1", 0.5), mk("H1-2", 0.69)]), {
    status: "HOLD",
    reason: "no_admissible_candidate",
  });
});

// 7 — argmax considers only admissible candidates
test("argmax ignores ineligible higher scores", () => {
  const good = evaluateQuantumCandidate({ hypothesisId: "H1-1", axes: { q: 0.8, v: 0.8, psi: 0.8, phi: 0.8 }, floor: 0.7, iteration: 1 });
  const betterButIneligible = evaluateQuantumCandidate({ hypothesisId: "H1-2", axes: { q: 0.99, v: 0.99, psi: 0.99, phi: 0.699 }, floor: 0.7, iteration: 1 });
  assert.ok(betterButIneligible.score > good.score);
  const sel = selectAdmissible([betterButIneligible, good]);
  assert.equal(sel.status, "SELECTED");
  if (sel.status === "SELECTED") assert.equal(sel.evaluation.hypothesisId, "H1-1");
});

// 8 — deterministic tie-break
test("tie-break is deterministic (score desc then id asc)", () => {
  const a = evaluateQuantumCandidate({ hypothesisId: "H1-1", axes: AX, floor: 0.7, iteration: 1 });
  const b = evaluateQuantumCandidate({ hypothesisId: "H1-2", axes: AX, floor: 0.7, iteration: 1 });
  const sel = selectAdmissible([b, a]); // order of input must not matter
  assert.equal(sel.status, "SELECTED");
  if (sel.status === "SELECTED") assert.equal(sel.evaluation.hypothesisId, "H1-1");
});

// 9 — hypothesis id mismatch refuses mutation
test("id mismatch refuses collapse", () => {
  const state = makeLoop([AX]);
  const ev = evaluateFor(state, 0); // evaluated for H1-1
  const other = evaluateQuantumCandidate({ hypothesisId: "H1-9", axes: AX, floor: 0.7, iteration: 1 });
  const res = collapseHypothesis(state, state.active_hypotheses[0].id, other);
  assert.equal(res.status, "REFUSED");
  if (res.status === "REFUSED") assert.equal(res.reason, "id_mismatch");
});

// 10 — input-hash mismatch (axes changed after evaluation) refuses
test("input-hash mismatch refuses collapse", () => {
  const state = makeLoop([AX]);
  const ev = evaluateFor(state, 0);
  state.active_hypotheses[0].axes = { q: 0.81, v: 0.75, psi: 0.85, phi: 0.9 }; // tamper
  const res = collapseHypothesis(state, state.active_hypotheses[0].id, ev);
  assert.equal(res.status, "REFUSED");
  if (res.status === "REFUSED") assert.equal(res.reason, "input_hash_mismatch");
});

// 11 — stale evaluation (iteration moved on) refuses
test("stale evaluation refuses collapse", () => {
  const state = makeLoop([AX]);
  const ev = evaluateFor(state, 0);
  state.iteration = 2;
  const res = collapseHypothesis(state, state.active_hypotheses[0].id, ev);
  assert.equal(res.status, "REFUSED");
  if (res.status === "REFUSED") assert.equal(res.reason, "stale_evaluation");
});

// 12 — caller-supplied boolean / forged object cannot bypass
test("boolean cannot bypass; forged evaluation refuses", () => {
  const state = makeLoop([AX]);
  const h = state.active_hypotheses[0];
  const res1 = collapseHypothesis(state, h.id, true as unknown as QuantumEvaluation);
  assert.equal(res1.status, "REFUSED");
  const forged = { hypothesisId: h.id, eligible: true } as unknown as QuantumEvaluation;
  const res2 = collapseHypothesis(state, h.id, forged);
  assert.equal(res2.status, "REFUSED");
  assert.equal(h.collapsed, false);
});

// 13 — rejected candidate remains uncollapsed with no timestamp
test("rejected candidate state unchanged (no collapsed, no timestamp, no telemetry)", () => {
  const state = makeLoop([AX]);
  const h = state.active_hypotheses[0];
  const ev = evaluateFor(state, 0);
  state.iteration = 2; // force stale
  const res = collapseHypothesis(state, h.id, ev);
  assert.equal(res.status, "REFUSED");
  assert.equal(h.collapsed, false);
  assert.equal(h.collapsed_at, undefined);
  assert.equal(state.last_quantum_evaluation, null);
});

// 14 — telemetry provenance equals the gate evaluation exactly
test("telemetry equals gate evaluation (same object, same score)", () => {
  const state = makeLoop([AX]);
  const h = state.active_hypotheses[0];
  const ev = evaluateFor(state, 0);
  const res = collapseHypothesis(state, h.id, ev);
  assert.equal(res.status, "COLLAPSED");
  assert.equal(state.last_quantum_evaluation, ev);
  assert.equal(state.last_quantum_evaluation?.score, ev.score);
  assert.equal(h.collapsed, true);
  assert.ok(h.collapsed_at);
});

// 15 — collapse eligibility does not create authority; result shape bounded
test("collapse result carries no seal/authority fields", () => {
  const state = makeLoop([AX]);
  const h = state.active_hypotheses[0];
  const ev = evaluateFor(state, 0);
  assert.ok(Object.isFrozen(ev));
  const res = collapseHypothesis(state, h.id, ev);
  assert.equal(res.status, "COLLAPSED");
  assert.deepEqual(Object.keys(res).sort(), ["evaluation", "hypothesis", "status"]);
});

// 16 — unbound axes (INPUT_BINDING_GAP) refuse collapse
test("hypothesis without axes refuses collapse (INPUT_BINDING_GAP)", () => {
  const state = makeLoop([null]);
  const h = state.active_hypotheses[0];
  const ev = evaluateQuantumCandidate({ hypothesisId: h.id, axes: AX, floor: 0.7, iteration: 1 });
  const res = collapseHypothesis(state, h.id, ev);
  assert.equal(res.status, "REFUSED");
  if (res.status === "REFUSED") assert.match(res.reason, /axes_unbound/);
  assert.equal(h.collapsed, false);
});

// 17 — ingestion with invalid axes throws at the boundary
test("setHypotheses rejects invalid axes at ingestion", () => {
  const state = createLoop(`p0-quantum-ingest-${Math.random().toString(36).slice(2)}`);
  assert.throws(
    () =>
      setHypotheses(state, [
        {
          statement: "bad",
          supporting_evidence: [],
          contradicting_evidence: [],
          collapse_measurement: "",
          collapsed: false,
          axes: { q: 2, v: 0.5, psi: 0.5, phi: 0.5 },
        },
      ]),
    QuantumAxesError,
  );
});

// 19 — product floor is a second, named check (axes pass, product fails)
test("product floor separates from axis floor", () => {
  const ev = evaluateQuantumCandidate({
    hypothesisId: "H1-1",
    axes: { q: 0.9, v: 0.9, psi: 0.9, phi: 0.9 },
    floor: 0.7,
    productFloor: 0.7,
    iteration: 1,
  });
  assert.deepEqual(ev.failedAxes, []);
  assert.ok(ev.score < 0.7);
  assert.equal(ev.scoreGatePassed, false);
  assert.equal(ev.eligible, false);
  assert.equal(ev.productFloor, 0.7);
});

// 20 — guard refuses an evaluation that binds the wrong product floor
test("guard refuses product-floor mismatch against effective config", () => {
  const state = createLoop(`p0-quantum-prod-${Math.random().toString(36).slice(2)}`, {
    min_g_score: 0.7,
    min_witness: 0,
    axis_floor: 0.7,
  });
  state.iteration = 1;
  setHypotheses(state, [{
    statement: "h", supporting_evidence: [], contradicting_evidence: [],
    collapse_measurement: "", collapsed: false, axes: AX,
  }]);
  const h = state.active_hypotheses[0];
  const ev = evaluateQuantumCandidate({
    hypothesisId: h.id, axes: AX, floor: 0.7, productFloor: 0, iteration: 1,
  });
  const res = collapseHypothesis(state, h.id, ev);
  assert.equal(res.status, "REFUSED");
  if (res.status === "REFUSED") assert.match(res.reason, /product_floor_mismatch/);
  assert.equal(h.collapsed, false);
  // unbound product floor also refuses
  const evNone = evaluateQuantumCandidate({ hypothesisId: h.id, axes: AX, floor: 0.7, iteration: 1 });
  const res2 = collapseHypothesis(state, h.id, evNone);
  assert.equal(res2.status, "REFUSED");
  if (res2.status === "REFUSED") assert.match(res2.reason, /input_hash_mismatch|product_floor_unbound/);
});

// 21 — axis_floor is its own config key (never overloaded with min_g_score)
test("axis_floor and min_g_score are separate config keys", () => {
  const state = createLoop(`p0-quantum-keys-${Math.random().toString(36).slice(2)}`, {
    min_g_score: 0.5,
    axis_floor: 0.8,
    min_witness: 0,
  });
  assert.equal(state.effective_config.min_g_score, 0.5);
  assert.equal(state.effective_config.axis_floor, 0.8);
  assert.equal(state.threshold_validation.axis_floor.status, "ok");
  assert.equal(state.threshold_validation.axis_floor.effective_value, 0.8);
});

// 18 — hash function is stable and input-bound
test("quantumAxesHash binds id+axes+floor", () => {
  const h1 = quantumAxesHash("H1-1", AX, 0.7, 0.5);
  assert.equal(h1, quantumAxesHash("H1-1", AX, 0.7, 0.5));
  assert.notEqual(h1, quantumAxesHash("H1-2", AX, 0.7, 0.5));
  assert.notEqual(h1, quantumAxesHash("H1-1", AX, 0.8, 0.5));
  assert.notEqual(h1, quantumAxesHash("H1-1", AX, 0.7, 0.6));
  assert.match(h1, /^[0-9a-f]{64}$/);
});
