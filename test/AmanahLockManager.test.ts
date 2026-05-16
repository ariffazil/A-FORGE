import test from "node:test";
import assert from "node:assert/strict";
import { AmanahLockManager } from "../src/governance/AmanahLockManager.js";

test("AmanahLockManager singleton", () => {
  const a = AmanahLockManager.getInstance();
  const b = AmanahLockManager.getInstance();
  assert.strictEqual(a, b);
});

test("acquire and release lock lifecycle", async () => {
  const manager = AmanahLockManager.getInstance();

  const acquire = await manager.acquireLock(
    "/tmp/test-resource.txt",
    "agent-alpha",
    "Testing write operation",
    "session-001",
    5000
  );
  assert.strictEqual(acquire.granted, true);
  assert.strictEqual(acquire.verdict, "SEAL");
  assert.ok(acquire.lock_id);

  const locked = await manager.isLocked("/tmp/test-resource.txt");
  assert.strictEqual(locked, true);

  const release = await manager.releaseLock(acquire.lock_id!, "agent-alpha", "Test complete");
  assert.strictEqual(release.released, true);
  assert.strictEqual(release.verdict, "SEAL");

  const lockedAfter = await manager.isLocked("/tmp/test-resource.txt");
  assert.strictEqual(lockedAfter, false);
});

test("second agent gets 888-HOLD on locked resource", async () => {
  const manager = AmanahLockManager.getInstance();

  const first = await manager.acquireLock(
    "/tmp/test-resource-2.txt",
    "agent-alpha",
    "First lock",
    "session-001",
    5000
  );
  assert.strictEqual(first.granted, true);

  const second = await manager.acquireLock(
    "/tmp/test-resource-2.txt",
    "agent-beta",
    "Second lock attempt",
    "session-002",
    5000
  );
  assert.strictEqual(second.granted, false);
  assert.strictEqual(second.verdict, "888-HOLD");
  assert.ok(second.holder);
  assert.strictEqual(second.holder!.actor_id, "agent-alpha");

  // Cleanup
  await manager.releaseLock(first.lock_id!, "agent-alpha");
});

test("re-entrant lock by same actor/session is allowed", async () => {
  const manager = AmanahLockManager.getInstance();

  const first = await manager.acquireLock(
    "/tmp/test-resource-3.txt",
    "agent-alpha",
    "First lock",
    "session-003",
    5000
  );
  assert.strictEqual(first.granted, true);

  const second = await manager.acquireLock(
    "/tmp/test-resource-3.txt",
    "agent-alpha",
    "Re-entrant lock",
    "session-003",
    5000
  );
  assert.strictEqual(second.granted, true);
  assert.strictEqual(second.lock_id, first.lock_id);

  await manager.releaseLock(first.lock_id!, "agent-alpha");
});

test("release by wrong actor is VOID", async () => {
  const manager = AmanahLockManager.getInstance();

  const acquire = await manager.acquireLock(
    "/tmp/test-resource-4.txt",
    "agent-alpha",
    "First lock",
    "session-004",
    5000
  );

  const badRelease = await manager.releaseLock(acquire.lock_id!, "agent-beta");
  assert.strictEqual(badRelease.released, false);
  assert.strictEqual(badRelease.verdict, "VOID");

  await manager.releaseLock(acquire.lock_id!, "agent-alpha");
});
