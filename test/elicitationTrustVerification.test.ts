/**
 * elicitationTrustVerification.test.ts — S1 (F13 SAH 2026-10-01).
 *
 * Falsifies the pre-S1 elicitation bypasses and confirms the legitimate paths
 * still pass, so the gate was corrected rather than merely tightened.
 *
 * Pre-S1, isExternalClient() returned {external:false} — i.e. "trusted", no
 * human confirmation — for any of:
 *   session_id longer than 8 chars      (never verified against an issuer)
 *   lease_id  longer than 4 chars       (never verified; demonstrated live)
 *   ack_irreducible / ack_irreversible  (caller-supplied; nothing mints them)
 *   _constitution_gate === true         (caller-supplied; nothing mints it)
 *
 * Run: node --test dist/test/elicitationTrustVerification.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { isExternalClient } from "../src/interfaces/mcp/policyTools.js";
import { registerSession } from "../src/domain/session/sessionGate.js";

test("S1: fabricated session_id is NOT trusted (was: any string >8 chars)", () => {
  const r = isExternalClient({ session_id: "totally-made-up-session-1234567890" });
  assert.equal(r.external, true, "a long unregistered session_id must not grant trust");
  assert.match(r.reason ?? "", /failed verification|SESSION_UNKNOWN/i);
});

test("S1: forged SEAL-* session_id is NOT trusted (P0.2 doctrine preserved)", () => {
  const r = isExternalClient({ session_id: "SEAL-0123456789abcdef" });
  assert.equal(r.external, true, "format matching alone must not accept a session");
});

test("S1: fabricated lease_id alone is NOT trusted (was: any string >4 chars)", () => {
  const r = isExternalClient({ lease_id: "probe-nonexistent" });
  assert.equal(r.external, true);
  assert.match(r.reason ?? "", /lease_id/i);
});

test("S1: self-acknowledgement booleans are NOT trusted (nothing mints them)", () => {
  for (const args of [
    { ack_irreversible: true },
    { ack_irreducible: true },
    { _constitution_gate: true },
    { _constitution_gate: "true" },
  ]) {
    const r = isExternalClient(args);
    assert.equal(r.external, true, `${JSON.stringify(args)} must not grant trust`);
  }
});

test("S1: anonymous caller with no credentials is external", () => {
  assert.equal(isExternalClient({}).external, true);
  assert.equal(isExternalClient({ mode: "status" }).external, true);
});

test("S1 POSITIVE CONTROL: a kernel-registered session IS trusted", () => {
  // Guards against "fixed" meaning "everything now gates". registerSession marks
  // the record kernel_verified, which is what validateSession requires.
  const sid = "S1-CONTROL-SESSION-0001";
  registerSession(sid, "FI-003", 3_600_000);
  const r = isExternalClient({ session_id: sid, actor_id: "FI-003" });
  assert.equal(r.external, false, `registered session must stay trusted: ${r.reason ?? ""}`);
});

test("S1 POSITIVE CONTROL: sovereign actor_id IS trusted (unchanged behaviour)", () => {
  assert.equal(isExternalClient({ actor_id: "F13" }).external, false);
});

test("S1 RESIDUAL (characterization, NOT endorsement): sovereign trust is a NAME match", () => {
  // isSovereign() tests membership in SOVEREIGN_ACTORS by string, so an
  // anonymous caller asserting a sovereign actor_id is still trusted with no
  // signature. S1 did NOT close this — it is staged as S1b: require a verified
  // sovereign signature; the Ed25519 signer already exists in
  // interfaces/mcp/client.ts (injectSovereignSignature) with sovereign_verify.py
  // on the kernel side. Pinned here so the residual hole is executable and
  // visible rather than implicit, and so closing it later must deliberately
  // flip this test.
  assert.equal(isExternalClient({ actor_id: "F13" }).external, false);
  assert.equal(isExternalClient({ actor_id: "arif" }).external, false);

  // The case fold is ASYMMETRIC: isSovereign lowercases the input but the set
  // stores "F13" uppercase, so "ARIF" matches (folds to "arif", which is in the
  // set) while "f13" does not (folds to "f13", which is not). Authority that
  // depends on the capitalisation of a name is itself a defect — recorded here
  // so S1b fixes the matcher rather than inheriting it.
  assert.equal(isExternalClient({ actor_id: "ARIF" }).external, false);
  assert.equal(
    isExternalClient({ actor_id: "f13" }).external,
    true,
    "lowercase f13 is NOT sovereign — the fold only rescues names already lowercase in the set",
  );
});
