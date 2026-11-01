/**
 * G1 — EGRESS NEEDS A PER-MESSAGE GRANT · HUMAN_RASA P0 REMEDIATION
 *
 * Gap register: ./audit/human-rasa/GAP_REGISTER.md (2026-11-01). Authority: ARIF.
 * Execution: DRAFT PR only. Flag: AFORGE_EGRESS_PER_MESSAGE_GRANT (default "0", NOT flipped).
 *
 * Covers:
 *  (a) forge_telegram send/send_message/send_file classify IRREVERSIBLE
 *  (b) per-message grant — flag=1: no grant → HOLD, payload-hash mismatch → HOLD,
 *      no readable grant record → UNKNOWN → HOLD (fail-closed), valid grant → proceeds
 *  (c) flag=0 → behaviour unchanged (regression); F13_EMAIL_SEND lane intact
 *
 * EGRESS SAFETY (hard boundary): every handler-level test injects a stub bridge
 * through the handler's optional `deps` parameter. NO test reaches the real APA
 * telegram bridge (:18096) or gws_bridge.py — not even to test. Handler tests
 * that would reach a bridge are stubbed; the stub call count proves fail-closed
 * ordering (HOLD happens BEFORE any bridge invocation).
 *
 * Fixtures are synthetic only (subject "PERSON_A").
 */

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import {
  EGRESS_PER_MESSAGE_GRANT_FLAG,
  checkEgressGrant,
  perMessageGrantEnabled,
  sha256Hex,
} from "../src/domain/governance/egressGrant.js";
import { telegramHandler } from "../src/interfaces/mcp/forgeApaConnectors.js";
import { gmailHandler, gateMutate } from "../src/capabilities/google-workspace/forgeGoogleWorkspace.js";

const FLAG = EGRESS_PER_MESSAGE_GRANT_FLAG;
const SUBJECT = "PERSON_A";
const BODY = "PERSON_A synthetic fixture";
const CHAT_ID = "PERSON_A_CHAT";
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

// Restore the flag after every test — tests never leave env state behind.
const savedFlag = process.env[FLAG];
afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = savedFlag;
});

/** Stub for the APA telegram bridge — records calls, never opens a socket. */
function stubTelegramBridge() {
  const calls: Array<{ mode: string; params: Record<string, unknown> }> = [];
  const bridge = async (mode: string, params: Record<string, unknown> = {}) => {
    calls.push({ mode, params });
    return { ok: true, result: { sent: true, message_id: 42, chat: { id: params.chat_id } } };
  };
  return { bridge, calls };
}

/** Stub for the Google Workspace bridgeCall — records calls, spawns nothing. */
function stubGwsBridge() {
  const calls: Array<{ service: string; verb: string; args: Record<string, unknown> }> = [];
  const bridge = async (service: string, verb: string, args: Record<string, unknown> = {}) => {
    calls.push({ service, verb, args });
    return { status: "SENT", message_id: "gws-1" };
  };
  return { bridge, calls };
}

function payload(res: any): any {
  return JSON.parse(res.content[0].text);
}

function validTelegramGrant(text: string) {
  return {
    grant_id: "GRANT-TEST-1",
    recipient: CHAT_ID,
    // telegram has no subject → sha256("" + body)
    payload_sha256: sha256Hex("" + text),
    expires_at: FUTURE,
    issued_by: "arif",
  };
}

// ── FLAG MECHANICS ─────────────────────────────────────────────────────────

test("G1(c): AFORGE_EGRESS_PER_MESSAGE_GRANT defaults OFF; only exact \"1\" enables", () => {
  delete process.env[FLAG];
  assert.equal(perMessageGrantEnabled(), false, "unset → off (default \"0\")");
  process.env[FLAG] = "0";
  assert.equal(perMessageGrantEnabled(), false);
  process.env[FLAG] = "1";
  assert.equal(perMessageGrantEnabled(), true);
  process.env[FLAG] = "yes"; // non-canonical values do NOT silently enable
  assert.equal(perMessageGrantEnabled(), false);
});

// ── (b) TELEGRAM — flag=1 HOLD paths (stub bridge must stay untouched) ─────

test("G1(b): flag=1 — telegram send WITHOUT grant → HOLD, bridge never called", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    { verb: "send", chat_id: CHAT_ID, text: BODY },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "HOLD");
  assert.equal(p.gate, "EGRESS_PER_MESSAGE_GRANT");
  assert.equal(p.error, "GRANT_REQUIRED");
  assert.equal(calls.length, 0, "fail-closed: HOLD must happen BEFORE any bridge call");
});

test("G1(b): flag=1 — mismatched body hash → HOLD, bridge never called", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    {
      verb: "send",
      chat_id: CHAT_ID,
      text: BODY,
      grant_id: "GRANT-TEST-1",
      grant_record: {
        grant_id: "GRANT-TEST-1",
        recipient: CHAT_ID,
        payload_sha256: sha256Hex("some other body"), // ≠ sha256("" + BODY)
        expires_at: FUTURE,
        issued_by: "arif",
      },
    },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "HOLD");
  assert.equal(p.gate, "EGRESS_PER_MESSAGE_GRANT");
  assert.equal(p.error, "GRANT_PAYLOAD_MISMATCH");
  assert.equal(calls.length, 0, "fail-closed: HOLD must happen BEFORE any bridge call");
});

test("G1(b): flag=1 — recipient mismatch → HOLD", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    {
      verb: "send",
      chat_id: CHAT_ID,
      text: BODY,
      grant_id: "GRANT-TEST-1",
      grant_record: {
        grant_id: "GRANT-TEST-1",
        recipient: "SOMEONE_ELSE_CHAT", // bound to a different recipient
        payload_sha256: sha256Hex("" + BODY),
        expires_at: FUTURE,
        issued_by: "arif",
      },
    },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "HOLD");
  assert.equal(p.error, "GRANT_RECIPIENT_MISMATCH");
  assert.equal(calls.length, 0);
});

test("G1(b): flag=1 — expired grant → HOLD", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    {
      verb: "send",
      chat_id: CHAT_ID,
      text: BODY,
      grant_id: "GRANT-TEST-1",
      grant_record: { ...validTelegramGrant(BODY), expires_at: PAST },
    },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "HOLD");
  assert.equal(p.error, "GRANT_EXPIRED");
  assert.equal(calls.length, 0);
});

test("G1(b): flag=1 — no readable grant record → UNKNOWN → HOLD (fail-closed)", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  // grant_id present, but neither grant_record nor a readable grant_path
  const res1 = await telegramHandler(
    { verb: "send", chat_id: CHAT_ID, text: BODY, grant_id: "GRANT-TEST-1" },
    undefined,
    { bridge },
  );
  assert.equal(payload(res1).status, "HOLD");
  assert.equal(payload(res1).error, "GRANT_RECORD_UNKNOWN");
  // grant_path points at nothing → unreadable → UNKNOWN → HOLD
  const res2 = await telegramHandler(
    {
      verb: "send",
      chat_id: CHAT_ID,
      text: BODY,
      grant_id: "GRANT-TEST-1",
      grant_path: "/tmp/opencode/nonexistent-grant-record.json",
    },
    undefined,
    { bridge },
  );
  assert.equal(payload(res2).status, "HOLD");
  assert.equal(payload(res2).error, "GRANT_RECORD_UNKNOWN");
  assert.equal(calls.length, 0, "no bridge call on any UNKNOWN HOLD");
});

test("G1(b): flag=1 — valid grant → send proceeds to (stubbed) bridge", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    {
      verb: "send",
      chat_id: CHAT_ID,
      text: BODY,
      grant_id: "GRANT-TEST-1",
      grant_record: validTelegramGrant(BODY),
    },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "SEAL", "a verified grant must NOT be held");
  assert.equal(calls.length, 1, "exactly one bridge send");
  assert.equal(calls[0].mode, "send_message");
});

// ── (c) TELEGRAM — flag=0 regression (behaviour unchanged) ─────────────────

test("G1(c): flag=0 — telegram send without grant behaves exactly as before (bridge reached)", async () => {
  delete process.env[FLAG];
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler(
    { verb: "send", chat_id: CHAT_ID, text: BODY },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.status, "SEAL", "flag=0 must not introduce a grant requirement");
  assert.equal(calls.length, 1, "send reaches the bridge exactly once, as before G1");
});

test("G1(c): flag=0 — get_me path unchanged (no grant gate on reads)", async () => {
  delete process.env[FLAG];
  const { bridge, calls } = stubTelegramBridge();
  const res = await telegramHandler({ verb: "get_me" }, undefined, { bridge });
  assert.equal(payload(res).status, "SEAL");
  assert.equal(calls.length, 1);
});

// ── (b)/(c) GMAIL — grant gate + F13_EMAIL_SEND lane intact ────────────────

test("G1(b): flag=1 — gmail send WITHOUT grant → HOLD, gws bridge never called", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubGwsBridge();
  const res = await gmailHandler(
    { verb: "send", to: "PERSON_A@example.invalid", subject: SUBJECT, body: BODY },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.verdict, "HOLD");
  assert.equal(p.gate, "EGRESS_PER_MESSAGE_GRANT");
  assert.match(String(p.reason), /^GRANT_REQUIRED/);
  assert.equal(calls.length, 0, "fail-closed: HOLD BEFORE any gws bridge spawn");
});

test("G1(b): flag=1 — gmail mismatched body hash → HOLD", async () => {
  process.env[FLAG] = "1";
  const { bridge, calls } = stubGwsBridge();
  const res = await gmailHandler(
    {
      verb: "send",
      to: "PERSON_A@example.invalid",
      subject: SUBJECT,
      body: BODY,
      grant_id: "GRANT-TEST-2",
      grant_record: {
        grant_id: "GRANT-TEST-2",
        recipient: "PERSON_A@example.invalid",
        payload_sha256: sha256Hex(SUBJECT + "WRONG BODY"),
        expires_at: FUTURE,
        issued_by: "arif",
      },
    },
    undefined,
    { bridge },
  );
  const p = payload(res);
  assert.equal(p.verdict, "HOLD");
  assert.match(String(p.reason), /GRANT_PAYLOAD_MISMATCH/);
  assert.equal(calls.length, 0);
});

test("G1(c): flag=0 — gmail send unchanged: reaches bridge, grant fields stripped from bridge args", async () => {
  delete process.env[FLAG];
  const { bridge, calls } = stubGwsBridge();
  const res = await gmailHandler(
    {
      verb: "send",
      to: "PERSON_A@example.invalid",
      subject: SUBJECT,
      body: BODY,
      // grant fields present at flag=0 must be inert AND must not leak to the bridge CLI
      grant_id: "GRANT-TEST-2",
      grant_record: { grant_id: "GRANT-TEST-2" },
    },
    undefined,
    { bridge },
  );
  assert.equal(payload(res).status, "SENT", "flag=0: no grant requirement, behaviour unchanged");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, "gmail");
  assert.equal(calls[0].verb, "send");
  assert.ok(!("grant_id" in calls[0].args), "grant_id must not leak into bridge args");
  assert.ok(!("grant_record" in calls[0].args), "grant_record must not leak into bridge args");
  assert.ok(!("grant_path" in calls[0].args), "grant_path must not leak into bridge args");
});

test("G1(c): F13_EMAIL_SEND lane intact — gateMutate still passes gmail send; other IRREVERSIBLE verbs still HOLD", async () => {
  delete process.env[FLAG];
  const pass = await gateMutate("gmail.send", "HIGH", "IRREVERSIBLE");
  assert.equal(pass.passed, true, "2026-10-18 F13_EMAIL_SEND lane must NOT be deleted");
  assert.equal(pass.cc_id, "F13_EMAIL_SEND");
  const pass2 = await gateMutate("gmail.draft_send", "HIGH", "IRREVERSIBLE");
  assert.equal(pass2.passed, true);
  assert.equal(pass2.cc_id, "F13_EMAIL_SEND");
  const hold = await gateMutate("gmail.explode", "HIGH", "IRREVERSIBLE");
  assert.equal(hold.passed, false, "non-lane IRREVERSIBLE verbs still fail closed");
});

// ── GRANT BINDING FORMULA ──────────────────────────────────────────────────

test("G1(b): grant binds sha256(subject+body) literally — no separator, both fields count", () => {
  const env = { [FLAG]: "1" };
  const params = {
    grantId: "GRANT-TEST-3",
    recipient: "PERSON_A@example.invalid",
    subject: SUBJECT,
    body: BODY,
    env,
  };
  const record = (payload_sha256: string) => ({
    grant_id: "GRANT-TEST-3",
    recipient: "PERSON_A@example.invalid",
    payload_sha256,
    expires_at: FUTURE,
    issued_by: "arif",
  });
  // correct: literal concatenation subject + body
  const ok = checkEgressGrant({
    ...params,
    grantRecord: record(sha256Hex(SUBJECT + BODY)),
  });
  assert.equal(ok.hold, false, "exact subject+body concat must verify");
  // a separator in the hash → mismatch → HOLD
  const bad = checkEgressGrant({
    ...params,
    grantRecord: record(sha256Hex(SUBJECT + "\n" + BODY)),
  });
  assert.equal(bad.hold, true);
  assert.equal((bad as any).code, "GRANT_PAYLOAD_MISMATCH");
  // changing only the body must invalidate the grant
  const bodySwap = checkEgressGrant({
    ...params,
    body: BODY + "!",
    grantRecord: record(sha256Hex(SUBJECT + BODY)),
  });
  assert.equal(bodySwap.hold, true);
  assert.equal((bodySwap as any).code, "GRANT_PAYLOAD_MISMATCH");
  // flag off → gate inert regardless of grant state
  const inert = checkEgressGrant({
    ...params,
    env: { [FLAG]: "0" },
  });
  assert.equal(inert.hold, false, "flag=0 → gate skipped entirely");
  assert.equal((inert as any).skipped, true);
});

test("G1(b): missing/empty issued_by → HOLD (issuer binding is mandatory)", () => {
  const res = checkEgressGrant({
    grantId: "GRANT-TEST-4",
    recipient: CHAT_ID,
    subject: "",
    body: BODY,
    env: { [FLAG]: "1" },
    grantRecord: {
      grant_id: "GRANT-TEST-4",
      recipient: CHAT_ID,
      payload_sha256: sha256Hex("" + BODY),
      expires_at: FUTURE,
      issued_by: "   ",
    },
  });
  assert.equal(res.hold, true);
  assert.equal((res as any).code, "GRANT_ISSUER_MISSING");
});
