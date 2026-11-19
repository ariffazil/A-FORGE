/**
 * refusalGate.test.ts — Unit tests for A-FORGE Gate 0 Refusal integration.
 *
 * Invariants:
 *  - Refusal blocks execution before any command is run.
 *  - Store failure / corruption results in fail-closed HOLD.
 *  - Withdrawal restores execution capability.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkRefusalGate } from "../src/infrastructure/bridges/refusalGateBridge.js";

const execFileAsync = promisify(execFile);
const GATE_CLI = "/root/forge_work/patches/refusal-gate-20261028/gate.py";

test("Refusal Gate Bridge: unrefused scope returns allow=true", async () => {
  const testScope = `test:unrefused-${Date.now()}`;
  const result = await checkRefusalGate(testScope);
  assert.equal(result.allow, true);
  assert.equal(result.block, false);
  assert.equal(result.hold, false);
});

test("Refusal Gate Bridge: live issue -> block -> withdraw -> allow lifecycle", async () => {
  const testScope = `test:lifecycle-${Date.now()}`;

  // 1. Initially unrefused
  const initial = await checkRefusalGate(testScope);
  assert.equal(initial.allow, true);
  assert.equal(initial.block, false);

  // 2. Issue refusal
  const { stdout: issueOut } = await execFileAsync("python3", [
    GATE_CLI,
    "issue",
    "--bearer",
    "arif",
    "--scope",
    testScope,
    "--reason",
    "Automated bridge verification test",
  ]);
  const issueRec = JSON.parse(issueOut.trim());
  assert.ok(issueRec.refusal_id);

  // 3. Must be blocked
  const blocked = await checkRefusalGate(testScope);
  assert.equal(blocked.block, true);
  assert.equal(blocked.allow, false);
  assert.equal(blocked.blocking.length, 1);
  assert.equal(blocked.blocking[0].refusal_id, issueRec.refusal_id);

  // 4. Hierarchical child scope must also be blocked
  const childScope = `${testScope}:child:subaction`;
  const childBlocked = await checkRefusalGate(childScope);
  assert.equal(childBlocked.block, true);
  assert.equal(childBlocked.allow, false);

  // 5. Withdraw refusal
  const { stdout: withdrawOut } = await execFileAsync("python3", [
    GATE_CLI,
    "withdraw",
    "--id",
    issueRec.refusal_id,
    "--by",
    "arif",
    "--note",
    "Bridge verification complete",
  ]);
  const withdrawRec = JSON.parse(withdrawOut.trim());
  assert.equal(withdrawRec.status, "WITHDRAWN");

  // 6. Restored to allow
  const restored = await checkRefusalGate(testScope);
  assert.equal(restored.allow, true);
  assert.equal(restored.block, false);
});
