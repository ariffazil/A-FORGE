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
import { createHmac } from "node:crypto";
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

test("S1b: a sovereign NAME alone is no longer trusted (flips the S1 characterization)", () => {
  // S1 pinned this hole as a characterization test so that closing it would have
  // to deliberately flip the assertion. This is that flip. Before S1b an
  // anonymous caller asserting actor_id:"F13" was trusted with no credential at
  // all — the last name-based bypass of the elicitation gate.
  for (const actor_id of ["F13", "f13", "arif", "ARIF", "sovereign", "ariffazil", "888"]) {
    const r = isExternalClient({ actor_id });
    assert.equal(r.external, true, `bare sovereign name "${actor_id}" must not grant trust`);
    assert.match(r.reason ?? "", /name is not proof|ACT/i);
  }
});

test("S1b: the sovereign name fold is now symmetric", () => {
  // Was asymmetric: isSovereign lowercased the input while the set stored "F13"
  // uppercase, so "ARIF" matched and "f13" did not — authority that depended on
  // capitalisation. Both now behave identically (both refused without an ACT,
  // which is the point: the matcher is total, the credential decides).
  const upper = isExternalClient({ actor_id: "F13" });
  const lower = isExternalClient({ actor_id: "f13" });
  assert.equal(upper.external, lower.external);
  assert.equal(upper.external, true);
});

test("S1b: a sovereign name with an unparseable or OBSERVE_ONLY ACT is still refused", () => {
  assert.equal(isExternalClient({ actor_id: "F13", act: "not-a-token" }).external, true);
  assert.equal(isExternalClient({ actor_id: "F13", act: "" }).external, true);
});

// ── S1c (F13 SAH 2026-10-01): cryptographic sovereign binding ──────────────
// S1b recorded a LIMIT here: it could only test refusal, because checking the
// positive direction needs a validly signed act_v1.* token. S1c exports
// verifyActToken() from sessionGate, so these tests mint real tokens with the
// same HMAC construction the gate verifies (sha256(secret, payloadB64).hex[:16]).
const S1C_SECRET = "s1c-test-secret-0123456789ab";
function mintAct(claims: Record<string, unknown>, secret = S1C_SECRET, sigOverride?: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig =
    sigOverride ??
    createHmac("sha256", secret).update(payload, "ascii").digest("hex").slice(0, 16);
  return `act_v1.${payload}.${sig}`;
}

test("S1c POSITIVE CONTROL: sovereign name + validly signed ACT IS trusted", () => {
  process.env.ARIFOS_SESSION_SECRET = S1C_SECRET;
  const act = mintAct({
    actor: "F13",
    sid: "SEAL-s1ccontrol01",
    auth: "MUTATE",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const r = isExternalClient({ actor_id: "F13", act });
  assert.equal(r.external, false, `a correctly signed sovereign ACT must be trusted: ${r.reason ?? ""}`);
});

test("S1c: a FORGED signature is refused (this is what S1b could not catch)", () => {
  process.env.ARIFOS_SESSION_SECRET = S1C_SECRET;
  // Well-formed shape, claims say sovereign, but signed with the wrong secret.
  // parseActClaims() would have accepted this; verifyActToken() must not.
  const forged = mintAct(
    { actor: "F13", sid: "SEAL-forged00001", auth: "MUTATE", exp: Math.floor(Date.now() / 1000) + 3600 },
    "attacker-does-not-know-the-real-secret",
  );
  const r = isExternalClient({ actor_id: "F13", act: forged });
  assert.equal(r.external, true, "a forged ACT must not grant sovereign trust");
  assert.match(r.reason ?? "", /failed verification|signature mismatch/i);
});

test("S1c: a valid ACT bound to a DIFFERENT actor is refused (binding, not possession)", () => {
  process.env.ARIFOS_SESSION_SECRET = S1C_SECRET;
  // Correctly signed, but minted for "arif" while the caller asserts "F13".
  // Possessing a valid token is not the same as being the name you type. Both
  // names are in SOVEREIGN_ACTORS, so this isolates the BINDING check rather
  // than the name check.
  const act = mintAct({
    actor: "arif",
    sid: "SEAL-s1cbind0001",
    auth: "MUTATE",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const r = isExternalClient({ actor_id: "F13", act });
  assert.equal(r.external, true, "actor binding must be enforced");
  assert.match(r.reason ?? "", /does not match its ACT-bound actor/i);
  // The same token IS accepted for the actor it was actually minted for.
  assert.equal(
    isExternalClient({ actor_id: "arif", act }).external,
    false,
    "the correctly bound sovereign identity must still pass",
  );
});

test("S1c: an expired ACT is refused", () => {
  process.env.ARIFOS_SESSION_SECRET = S1C_SECRET;
  const act = mintAct({ actor: "F13", sid: "SEAL-s1cexpired1", auth: "MUTATE", exp: 1 });
  assert.equal(isExternalClient({ actor_id: "F13", act }).external, true);
});

test("S1c: an OBSERVE_ONLY ACT does not confer sovereign trust", () => {
  process.env.ARIFOS_SESSION_SECRET = S1C_SECRET;
  const act = mintAct({
    actor: "F13",
    sid: "SEAL-s1cobserve1",
    auth: "OBSERVE_ONLY",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const r = isExternalClient({ actor_id: "F13", act });
  assert.equal(r.external, true);
  assert.match(r.reason ?? "", /OBSERVE_ONLY/i);
});
