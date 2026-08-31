/**
 * actIngressSigLength.test.ts — dual-length HMAC verification (G2, Fasa 1, 2026-08-30).
 *
 * arifOS issuers now emit the FULL 64-hex HMAC-SHA256 signature; legacy
 * tokens (pre-upgrade, TTL-bounded) carry 16 hex chars. verifyLocalAct must
 * accept both, reject forgeries at either length, timing-safe.
 */
import * as crypto from "crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyLocalAct } from "../src/infrastructure/governance/actIngress.js";

const SECRET = "test-session-secret-phase1";

function b64url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}

function fullSig(payloadB64: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64, "ascii")
    .digest("hex");
}

function tokenWith(sigHex: string, auth = "LIMITED_MUTATE"): string {
  const claims = {
    act_v: 1,
    actor: "333-agi",
    auth,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const payloadB64 = b64url(JSON.stringify(claims));
  return `act_v1.${payloadB64}.${sigHex}`;
}

test("G2: accepts full 64-hex signature (new tokens)", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const payloadB64 = b64url(
    JSON.stringify({
      act_v: 1,
      actor: "333-agi",
      auth: "LIMITED_MUTATE",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const token = `act_v1.${payloadB64}.${fullSig(payloadB64)}`;
  const res = verifyLocalAct(token, { expectedActor: "333-agi" });
  assert.ok(res && res.ok, `expected ok, got: ${JSON.stringify(res)}`);
  assert.equal((res as { actor?: string }).actor, "333-agi");
  delete process.env.ARIFOS_SESSION_SECRET;
});

test("G2: accepts legacy 16-hex signature (compat window)", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const payloadB64 = b64url(
    JSON.stringify({
      act_v: 1,
      actor: "333-agi",
      auth: "OBSERVE_ONLY",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const legacySig = fullSig(payloadB64).slice(0, 16);
  const res = verifyLocalAct(`act_v1.${payloadB64}.${legacySig}`, {
    expectedActor: "333-agi",
  });
  assert.ok(res && res.ok, `expected ok for legacy sig, got: ${JSON.stringify(res)}`);
  delete process.env.ARIFOS_SESSION_SECRET;
});

test("G2: rejects forged 64-hex signature", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const res = verifyLocalAct(tokenWith("f".repeat(64)), {});
  assert.ok(!res || !res.ok, "forged full-length signature must fail");
  if (res && !res.ok) assert.equal(res.error, "ERR_ACT_SIGNATURE_INVALID");
  delete process.env.ARIFOS_SESSION_SECRET;
});

test("G2: rejects forged 16-hex signature", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const res = verifyLocalAct(tokenWith("f".repeat(16)), {});
  assert.ok(!res || !res.ok, "forged legacy-length signature must fail");
  delete process.env.ARIFOS_SESSION_SECRET;
});

test("G2: rejects signature below the 16-char floor", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const payloadB64 = b64url(JSON.stringify({ act_v: 1, actor: "x", auth: "OBSERVE_ONLY" }));
  const shortSig = fullSig(payloadB64).slice(0, 8);
  const res = verifyLocalAct(`act_v1.${payloadB64}.${shortSig}`, {});
  assert.ok(!res || !res.ok, "short signature must fail");
  if (res && !res.ok) assert.equal(res.error, "ERR_ACT_SIGNATURE_SHORT");
  delete process.env.ARIFOS_SESSION_SECRET;
});

test("G2: single-char tamper on full signature fails", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const payloadB64 = b64url(
    JSON.stringify({
      act_v: 1,
      actor: "333-agi",
      auth: "LIMITED_MUTATE",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const sig = fullSig(payloadB64);
  const flipped = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
  const res = verifyLocalAct(`act_v1.${payloadB64}.${flipped}`, {});
  assert.ok(!res || !res.ok, "tampered signature must fail");
  delete process.env.ARIFOS_SESSION_SECRET;
});
