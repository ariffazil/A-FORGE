import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FileVaultClient, NoOpVaultClient, computeInputHash, generateSealId, type VaultSealRecord } from "../src/vault/VaultClient.js";

test("VaultClient: NoOpVaultClient", async () => {
  const client = new NoOpVaultClient();
  assert.equal(client.writerMode, "read");
  await client.seal({} as any);
  const q = await client.query();
  assert.deepEqual(q, []);
  const f = await client.findById("test");
  assert.equal(f, undefined);
});

test("VaultClient: FileVaultClient lifecycle", async () => {
  const file = resolve(tmpdir(), `vault-${Date.now()}.jsonl`);
  const client = new FileVaultClient(file);
  
  // Note: FileVaultClient normally throws in production, but tests run with NODE_ENV="test" typically.
  
  const record: import("../src/vault/VaultClient.js").VaultSealRecord = {
    sessionId: "test-session",
    verdict: "SEAL" as const,
    hashofinput: computeInputHash("task", "text", "test-session", 1),
    telemetrysnapshot: { dS: 0.1, peace2: 0.9, psi_le: 0.95, W3: 0.8, G: 0.75 },
    floors_triggered: [],
    irreversibilityacknowledged: false,
    timestamp: new Date().toISOString(),
    task: "test task",
    finalText: "done",
    turnCount: 1,
    profileName: "test"
  };

  await client.seal(record);
  
  // Should have generated record_id and prev_hash
  assert.ok(record.record_id);
  
  const results = await client.query({ sessionId: "test-session" });
  assert.equal(results.length, 1);
  assert.equal(results[0].sessionId, "test-session");
  
  const found = await client.findById(record.record_id!);
  assert.ok(found);
  assert.equal(found!.sessionId, "test-session");
  
  // Additional queries
  const q1 = await client.query({ verdict: "SEAL" });
  assert.equal(q1.length, 1);
  const q2 = await client.query({ verdict: "HOLD" });
  assert.equal(q2.length, 0);
  const q3 = await client.query({ limit: 1 });
  assert.equal(q3.length, 1);
});

test("VaultClient helpers", () => {
  const hash = computeInputHash("t", "text", "s1", 1);
  assert.ok(hash);
  const id = generateSealId();
  assert.ok(id);
});
