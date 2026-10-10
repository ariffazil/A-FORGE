/**
 * WO-1 / R18 regression suite — exact-match verdict parser.
 *
 * Law under test: lexical resemblance must not confer semantic authority
 * (E-TRANSLATION-WITNESS-2026-10-11, F13-ratified 2026-10-11).
 * No SEAL-prefixed negative or unknown verdict string may ever map to PASS.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mapArifOSVerdictText, NEGATIVE_SEAL_VERDICTS } from "../src/domain/governance/SealService.js";

test("WO-1: exact SEAL maps to PASS with low risk", () => {
  const r = mapArifOSVerdictText("SEAL", false);
  assert.equal(r.status, "PASS");
  assert.equal(r.riskScore, 0.1);
});

test("WO-1: case/whitespace normalization still yields PASS for exact SEAL", () => {
  const r = mapArifOSVerdictText("  seal \n", false);
  assert.equal(r.status, "PASS");
});

test("WO-1: SEAL_REJECTED maps to VOID — the R18 regression", () => {
  const r = mapArifOSVerdictText("SEAL_REJECTED", false);
  assert.equal(r.status, "VOID");
  assert.equal(r.riskScore, 1.0);
});

test("WO-1: every negative SEAL-family token maps to VOID", () => {
  for (const v of NEGATIVE_SEAL_VERDICTS) {
    const r = mapArifOSVerdictText(v, false);
    assert.equal(r.status, "VOID", `${v} must be VOID`);
    // decorated forms must also reject
    const decorated = mapArifOSVerdictText(`${v}: self-seal detected (Q9)`, false);
    assert.equal(decorated.status, "VOID", `${v} decorated must be VOID`);
  }
});

test("WO-1: unknown SEAL-prefixed strings fail closed to HOLD, never PASS", () => {
  for (const v of ["SEALED", "SEAL_APPROVED_MAYBE", "SEALISH", "SEAL-5d425fc9ad8244fa"]) {
    const r = mapArifOSVerdictText(v, false);
    assert.equal(r.status, "HOLD", `${v} must be HOLD`);
    assert.equal(r.riskScore, 0.85);
  }
});

test("WO-1: defer/hold vocabulary preserved", () => {
  assert.equal(mapArifOSVerdictText("SABAR", false).status, "SABAR");
  assert.equal(mapArifOSVerdictText("HOLD", false).status, "HOLD");
  assert.equal(mapArifOSVerdictText("888_HOLD", false).status, "HOLD");
  assert.equal(mapArifOSVerdictText("VOID", false).status, "VOID");
});

test("WO-1: isError dominates to VOID regardless of text", () => {
  const r = mapArifOSVerdictText("SEAL", true);
  assert.equal(r.status, "VOID");
  assert.equal(r.riskScore, 1.0);
});

test("WO-1: empty and garbage input fail closed to HOLD", () => {
  assert.equal(mapArifOSVerdictText("", false).status, "HOLD");
  assert.equal(mapArifOSVerdictText("totally unexpected json blob", false).status, "HOLD");
});

test("WO-1: no SEAL-prefixed string outside exact 'SEAL' reaches PASS (exhaustive sweep)", () => {
  const candidates = [
    "SEAL_REJECTED", "SELF_SEAL_REJECTED", "SELF_SEAL_VALIDATION_FAILED",
    "SEALED", "SEAL-abc", "SEALX", "SEAL:", "SEAL verdict id 123",
  ];
  for (const c of candidates) {
    const r = mapArifOSVerdictText(c, false);
    assert.notEqual(r.status, "PASS", `"${c}" must not map to PASS`);
  }
  // control: exact SEAL (trimmed) is the only PASS path
  assert.equal(mapArifOSVerdictText("SEAL ", false).status, "PASS");
});
