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
} from "../src/governance/F13HaltChannel.js";

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
