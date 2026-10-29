/**
 * APA custody gate tests — kill switch, denial ledger, idempotency, read-back verdict.
 * No network: read-back failure is injected through the payload contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, utimesSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP = mkdtempSync(join(tmpdir(), "apa-custody-test-"));
process.env.APA_STATE_DIR = TMP;

const {
  resolveApaApp,
  isMutatingApaVerb,
  computeIdempotencyKey,
  checkApaRevocation,
  apaPreflight,
  apaPostflight,
  beginIdempotent,
  completeIdempotent,
  unverifyIdempotent,
  stableStringify,
} = await import("./apaCustody.js");

function writeRevocations(state: unknown): void {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, "revocations.json");
  writeFileSync(p, JSON.stringify(state));
  const now = new Date();
  utimesSync(p, now, new Date(now.getTime() + 1000));
}

test("resolveApaApp maps tools to apps", () => {
  assert.equal(resolveApaApp("forge_gmail"), "gmail");
  assert.equal(resolveApaApp("forge_telegram"), "telegram");
  assert.equal(resolveApaApp("forge_drive_create"), "drive");
  assert.equal(resolveApaApp("forge_sheets"), "sheets");
  assert.equal(resolveApaApp("forge_health_check"), null);
});

test("isMutatingApaVerb only flags external writes", () => {
  assert.equal(isMutatingApaVerb("gmail", "send"), true);
  assert.equal(isMutatingApaVerb("gmail", "read-unread"), false);
  assert.equal(isMutatingApaVerb("sheets", "append"), true);
  assert.equal(isMutatingApaVerb("drive", "create"), true);
  assert.equal(isMutatingApaVerb("telegram", "send"), true);
  assert.equal(isMutatingApaVerb("telegram", "get_me"), false);
  assert.equal(isMutatingApaVerb("github", "", "forge_github_get_file"), false);
  assert.equal(isMutatingApaVerb("github", "pr", "forge_github"), true);
  assert.equal(isMutatingApaVerb("github", "", "forge_github_create_or_update_file"), true);
});

test("idempotency key is stable and ignores governance fields", () => {
  const a = computeIdempotencyKey("gmail", "send", {
    to: "x@example.com", subject: "s", body: "b",
    session_id: "s1", lease_id: "l1", actor_id: "a1",
  });
  const b = computeIdempotencyKey("gmail", "send", {
    body: "b", subject: "s", to: "x@example.com",
    session_id: "s2", lease_id: "l2", actor_id: "a2",
  });
  assert.equal(a, b);
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("global kill switch blocks gmail before lease and records denial", async () => {
  writeRevocations({ revoked: { gmail: { reason: "test-kill", by: "test", at: "2026-10-23T00:00:00Z" } } });
  assert.equal(checkApaRevocation("gmail").revoked, true);
  const pre = await apaPreflight("forge_gmail", { verb: "read-unread" });
  assert.equal(pre.ok, false);
  if (!pre.ok) {
    const text = pre.response.content[0].text;
    assert.match(text, /APA_REVOKED/);
    assert.match(text, /APA_KILL_SWITCH/);
  }
  const ledger = readFileSync(join(TMP, "denials.jsonl"), "utf8");
  assert.match(ledger, /APA_KILL_SWITCH/);
  assert.match(ledger, /forge_gmail/);
});

test("clearing the kill switch re-opens the app", async () => {
  writeRevocations({ revoked: {} });
  const pre = await apaPreflight("forge_gmail", { verb: "read-unread" });
  assert.equal(pre.ok, true);
});

test("idempotency: execute -> in_flight -> replay -> unverified", async () => {
  const args = { verb: "append", id: "sheet-1", values: [["a", "b"]] };
  const first = await beginIdempotent("sheets", "append", args);
  assert.equal(first.mode, "execute");

  const second = await beginIdempotent("sheets", "append", args);
  assert.equal(second.mode, "in_flight");

  await completeIdempotent(first.key, { content: [{ type: "text", text: '{"status":"SEAL"}' }] });
  const replay = await beginIdempotent("sheets", "append", args);
  assert.equal(replay.mode, "replay");

  await unverifyIdempotent(first.key, "read-back failed");
  const unverified = await beginIdempotent("sheets", "append", args);
  assert.equal(unverified.mode, "in_flight");
  assert.equal(unverified.record?.status, "unverified");
});

test("postflight downgrades a failed read-back to EXECUTED_UNVERIFIED", async () => {
  const key = "test-readback-key";
  const pre = { ok: true as const, app: "gmail" as const, tool: "forge_gmail", verb: "send", idemKey: key };
  const result = {
    content: [{
      type: "text",
      text: JSON.stringify({ status: "SEAL", read_back: { ok: false, reason: "MESSAGE_NOT_FOUND_ON_READBACK" } }),
    }],
  };
  const out = await apaPostflight(pre, { verb: "send" }, result);
  assert.equal(out.isError, true);
  const payload = JSON.parse(out.content[0].text);
  assert.equal(payload.verdict, "HOLD");
  assert.equal(payload.apa.state, "EXECUTED_UNVERIFIED");
});
