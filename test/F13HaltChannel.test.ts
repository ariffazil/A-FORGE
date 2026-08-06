/**
 * Tests for F13HaltChannel — sovereign veto channel.
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getF13HaltChannel,
  resetF13HaltChannel,
  issueF13Halt,
  isValidHaltMessage,
  type F13HaltMessage,
  type F13Source,
  type F13Scope,
} from "../src/domain/governance/F13HaltChannel.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─── 1. Valid halt message accepted ─────────────────────────────────

test("F13Halt: valid message published and active", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "action", "act-1", "test reason");
  assert.equal(channel.isActive("action", "act-1"), true);
  assert.equal(channel.isActive("action", "act-2"), false);
});

// ─── 2. Tool scope halt blocks all calls to that tool ───────────────

test("F13Halt: tool scope halt blocks all calls to that tool", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "tool", "aforge_browser_navigate", "review");
  assert.equal(channel.isActive("tool", "aforge_browser_navigate"), true);
  assert.equal(channel.isActive("tool", "aforge_browser_click"), false);
});

// ─── 3. Federation halt blocks everything ───────────────────────────

test("F13Halt: federation halt blocks everything", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "federation", "all", "federation halt");
  assert.equal(channel.isActive("federation", "all"), true);
  assert.equal(channel.isActive("action", "anything"), true);
  assert.equal(channel.isActive("tool", "anything"), true);
});

// ─── 4. Organ scope halt blocks that organ ──────────────────────────

test("F13Halt: organ scope halt blocks that organ", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "organ", "arifOS", "kernel review");
  assert.equal(channel.isActive("organ", "arifOS"), true);
  assert.equal(channel.isActive("organ", "WEALTH"), false);
});

// ─── 5. Subscribe receives publish events ───────────────────────────

test("F13Halt: subscriber receives publish events", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  const received: F13HaltMessage[] = [];
  const unsub = channel.subscribe((msg) => received.push(msg));

  await issueF13Halt("local", "action", "act-1", "test");
  await issueF13Halt("local", "action", "act-2", "test 2");

  assert.equal(received.length, 2);
  assert.equal(received[0].target, "act-1");
  assert.equal(received[1].target, "act-2");

  unsub();
});

// ─── 6. Invalid halt message rejected silently ─────────────────────

test("F13Halt: invalid message is rejected (logged but not published)", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  const received: F13HaltMessage[] = [];
  const unsub = channel.subscribe((msg) => received.push(msg));

  // Manually publish invalid message
  await channel.publish({
    type: "WRONG_TYPE",
    issued_by: "x",
    source: "telegram",
    scope: "action",
    target: "x",
    reason: "x",
    issued_at: "2026-01-01",
    nonce: "x",
    signature_or_token: "x",
  } as any);

  assert.equal(received.length, 0);
  assert.equal(channel.isActive("action", "x"), false);

  unsub();
});

// ─── 7. Validation function ─────────────────────────────────────────

test("F13Halt: isValidHaltMessage accepts well-formed message", () => {
  const valid = {
    type: "F13_HALT",
    issued_by: "arif",
    source: "telegram",
    scope: "action",
    target: "x",
    reason: "x",
    issued_at: new Date().toISOString(),
    nonce: "abc",
    signature_or_token: "xyz",
  };
  assert.equal(isValidHaltMessage(valid), true);
});

test("F13Halt: isValidHaltMessage rejects malformed", () => {
  assert.equal(isValidHaltMessage(null), false);
  assert.equal(isValidHaltMessage({}), false);
  assert.equal(isValidHaltMessage({ type: "WRONG" }), false);
  assert.equal(isValidHaltMessage({
    type: "F13_HALT",
    issued_by: "",  // empty
    source: "telegram",
    scope: "action",
    target: "x",
    reason: "x",
    issued_at: "x",
    nonce: "x",
    signature_or_token: "x",
  }), false);
  assert.equal(isValidHaltMessage({
    type: "F13_HALT",
    issued_by: "arif",
    source: "INVALID_SOURCE" as F13Source,  // invalid enum
    scope: "action",
    target: "x",
    reason: "x",
    issued_at: "x",
    nonce: "x",
    signature_or_token: "x",
  }), false);
});

// ─── 8. Reset clears all halts ──────────────────────────────────────

test("F13Halt: reset clears all halts", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "action", "act-1", "test");
  assert.equal(channel.isActive("action", "act-1"), true);
  resetF13HaltChannel();
  assert.equal(channel.isActive("action", "act-1"), false);
});

// ─── 9. Multiple halts compose ──────────────────────────────────────

test("F13Halt: multiple halts on different scopes coexist", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "action", "act-1", "halt action");
  await issueF13Halt("local", "tool", "tool-1", "halt tool");
  await issueF13Halt("local", "organ", "WEALTH", "halt organ");

  assert.equal(channel.isActive("action", "act-1"), true);
  assert.equal(channel.isActive("tool", "tool-1"), true);
  assert.equal(channel.isActive("organ", "WEALTH"), true);
  assert.equal(channel.isActive("action", "act-2"), false);
  assert.equal(channel.isActive("organ", "GEOX"), false);
});

// ─── 10. scope "all" within a non-federation scope is honored ───────

test("F13Halt: scope=action target=all matches any action", async () => {
  resetF13HaltChannel();
  const channel = getF13HaltChannel();
  await issueF13Halt("local", "action", "all", "halt all actions");
  assert.equal(channel.isActive("action", "any-action-id"), true);
  assert.equal(channel.isActive("action", "another"), true);
  assert.equal(channel.isActive("tool", "any"), false);
});

// ═══════════════════════════════════════════════════════════════════
// FileBackedHaltChannel tests — cross-process halt persistence
// ═══════════════════════════════════════════════════════════════════

const TEST_HALT_FILE = path.join(os.tmpdir(), `f13_halts_test_${Date.now()}.jsonl`);

// Dynamically import to access the class (exported via module)
// We test the file persistence behavior by writing halts to the file
// and verifying the FileBackedHaltChannel loads them correctly.

import { FileBackedHaltChannel } from "../src/domain/governance/F13HaltChannel.js";

test("F13Halt: file-backed channel loads halt from file on startup", async () => {
  // Clean state
  try { fs.unlinkSync(TEST_HALT_FILE); } catch {}

  const haltMsg: F13HaltMessage = {
    type: "F13_HALT",
    issued_by: "arif",
    source: "telegram",
    scope: "federation",
    target: "all",
    reason: "emergency federation halt",
    issued_at: new Date().toISOString(),
    nonce: "test-nonce-1",
    signature_or_token: "sig-xyz",
  };

  // Write halt to file (simulating external agent writing)
  fs.writeFileSync(TEST_HALT_FILE, JSON.stringify(haltMsg) + "\n", "utf-8");

  // Create channel — should load from file
  const channel = new FileBackedHaltChannel(TEST_HALT_FILE);
  assert.equal(channel.isActive("federation", "all"), true);
  assert.equal(channel.isActive("tool", "any"), true); // federation:all blocks everything

  channel.reset();
});

test("F13Halt: file-backed channel survives process restart (persistence)", async () => {
  try { fs.unlinkSync(TEST_HALT_FILE); } catch {}

  // First "process" — create channel and publish halt
  const channel1 = new FileBackedHaltChannel(TEST_HALT_FILE);
  await channel1.publish({
    type: "F13_HALT",
    issued_by: "arif",
    source: "telegram" as F13Source,
    scope: "tool" as F13Scope,
    target: "aforge_browser_navigate",
    reason: "security audit",
    issued_at: new Date().toISOString(),
    nonce: "test-nonce-2",
    signature_or_token: "sig-abc",
  });
  assert.equal(channel1.isActive("tool", "aforge_browser_navigate"), true);

  // Verify file has the halt BEFORE reset
  const fileContent = fs.readFileSync(TEST_HALT_FILE, "utf-8");
  assert.ok(fileContent.includes("aforge_browser_navigate"), "halt persisted in file");

  // Simulate process death: stop watching + let channel1 go
  channel1.reset();

  // Verify file is empty after reset (cleanup works)
  const afterReset = fs.readFileSync(TEST_HALT_FILE, "utf-8");
  assert.equal(afterReset.trim(), "", "file cleared after reset");

  // Write halt back (simulating that the file survived a process crash where reset was NOT called)
  fs.writeFileSync(TEST_HALT_FILE, JSON.stringify({
    type: "F13_HALT",
    issued_by: "arif",
    source: "telegram",
    scope: "tool",
    target: "aforge_browser_navigate",
    reason: "security audit",
    issued_at: new Date().toISOString(),
    nonce: "test-nonce-2b",
    signature_or_token: "sig-abc",
  }) + "\n", "utf-8");

  // Second "process" — new channel loads from surviving file
  const channel2 = new FileBackedHaltChannel(TEST_HALT_FILE);
  assert.equal(channel2.isActive("tool", "aforge_browser_navigate"), true, "halt survives process restart");
  channel2.reset();
});

test("F13Halt: file-backed channel ignores malformed lines", async () => {
  try { fs.unlinkSync(TEST_HALT_FILE); } catch {}

  // Write a mix of valid and invalid lines
  fs.writeFileSync(TEST_HALT_FILE, [
    "not json at all",
    JSON.stringify({ type: "WRONG", foo: "bar" }),
    "", // empty line
    JSON.stringify({
      type: "F13_HALT",
      issued_by: "arif",
      source: "local",
      scope: "organ",
      target: "WEALTH",
      reason: "valid halt",
      issued_at: new Date().toISOString(),
      nonce: "test-nonce-3",
      signature_or_token: "sig-3",
    }),
  ].join("\n"), "utf-8");

  const channel = new FileBackedHaltChannel(TEST_HALT_FILE);
  // Only the valid halt should be loaded
  assert.equal(channel.isActive("organ", "WEALTH"), true);
  assert.equal(channel.isActive("organ", "GEOX"), false);
  channel.reset();
});

test("F13Halt: file-backed channel detects externally added halts via reload", async () => {
  try { fs.unlinkSync(TEST_HALT_FILE); } catch {}

  const channel = new FileBackedHaltChannel(TEST_HALT_FILE);

  // Simulate external agent writing a halt to the file
  const haltMsg: F13HaltMessage = {
    type: "F13_HALT",
    issued_by: "arif",
    source: "aaa_a2a",
    scope: "action",
    target: "deploy-prod",
    reason: "external override",
    issued_at: new Date().toISOString(),
    nonce: "ext-nonce-1",
    signature_or_token: "ext-sig",
  };
  fs.appendFileSync(TEST_HALT_FILE, JSON.stringify(haltMsg) + "\n", "utf-8");

  // Trigger reload manually (simulating watchFile callback)
  // The watchFile polls every 2s — we simulate by calling the private method
  // @ts-expect-error accessing private method for test
  channel.reloadFromFile();

  assert.equal(channel.isActive("action", "deploy-prod"), true);
  channel.reset();
});

