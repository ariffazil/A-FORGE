/**
 * CoolingGate.test.ts — Unit tests for SABAR Cooldown Protocol
 *
 * Updated 2026-06-29: all propose/seal/deployGate/check/resolve/expireAll
 * are now async (AAA Memory Linkage + persistence).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CoolingGate, getCoolingGate, resetCoolingGate } from "../src/domain/governance/CoolingGate.js";

test.beforeEach(() => {
  const tempDir = mkdtempSync(join(tmpdir(), "a-forge-cooling-"));
  process.env.COOLING_STATE_PATH = join(tempDir, "cooling-state.json");
  resetCoolingGate();
});

test.afterEach(() => {
  const statePath = process.env.COOLING_STATE_PATH;
  resetCoolingGate();
  if (statePath) {
    rmSync(join(statePath, ".."), { recursive: true, force: true });
  }
  delete process.env.COOLING_STATE_PATH;
});

test("CoolingGate: propose creates SABAR entry with default 72h", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "image:abc123", description: "test build" });

  assert.equal(entry.verdict, "SABAR");
  assert.equal(entry.risk_tier, "medium");
  assert.equal(entry.cooldown_hours, 72);
  assert.equal(entry.artifact_ref, "image:abc123");
  assert.ok(entry.entry_id.length === 12);
  assert.ok(new Date(entry.cooldown_expiry) > new Date(entry.proposed_at));
});

test("CoolingGate: propose respects risk tier hours", async () => {
  const gate = new CoolingGate();
  const low = await gate.propose({ risk_tier: "low" });
  const high = await gate.propose({ risk_tier: "high" });
  const critical = await gate.propose({ risk_tier: "critical" });

  assert.equal(low.cooldown_hours, 24);
  assert.equal(high.cooldown_hours, 168);
  assert.equal(critical.cooldown_hours, 720);
});

test("CoolingGate: seal succeeds with tri-witness complete", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "test:seal" });

  gate.witness(entry.entry_id, "human", true);
  gate.witness(entry.entry_id, "ai_audit", true);
  gate.witness(entry.entry_id, "reality_check", true);

  const result = await gate.seal(entry.entry_id);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "sealed");

  const updated = gate.getEntry(entry.entry_id);
  assert.equal(updated?.verdict, "SEAL");
  assert.ok(updated?.sealed_at !== null);
});

test("CoolingGate: seal fails with incomplete tri-witness", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "test:incomplete" });

  gate.witness(entry.entry_id, "human", true);
  // Only 1/3 witnesses

  const result = await gate.seal(entry.entry_id);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes("tri-witness incomplete"));
  assert.ok(result.reason.includes("1/3"));
});

test("CoolingGate: seal fails if budget exhausted", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "test:big" });

  // Exhaust disk budget
  entry.resource_budget.disk_bytes_allocated = 60_000_000_000; // 60 GB > 50 GB limit

  gate.witness(entry.entry_id, "human", true);
  gate.witness(entry.entry_id, "ai_audit", true);
  gate.witness(entry.entry_id, "reality_check", true);

  // seal() calls check() first which auto-VOIDs on budget exhaustion
  const result = await gate.seal(entry.entry_id);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes("auto-resolved") || result.reason.includes("budget") || result.reason.includes("AAA gate"));
  const updated = gate.getEntry(entry.entry_id);
  assert.equal(updated?.verdict, "VOID");
});

test("CoolingGate: auto-VOID on expiry", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "test:expire", risk_tier: "low" });

  // Manually expire
  entry.cooldown_expiry = new Date(Date.now() - 1000).toISOString();

  const checked = await gate.check(entry.entry_id);
  assert.equal(checked?.verdict, "VOID");
  assert.ok(checked?.void_reason?.includes("expired"));
});

test("CoolingGate: deploy gate tracks new artifacts", async () => {
  const gate = new CoolingGate();
  const result = await gate.deployGate("sha256:new-deploy");

  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "SABAR");
  assert.ok(result.cooldown_entry_id !== null);
  assert.equal(result.remaining_hours, 72);

  // Second deploy of same artifact during cooldown blocks
  const result2 = await gate.deployGate("sha256:new-deploy");
  assert.equal(result2.allowed, false);
  assert.equal(result2.verdict, "SABAR");
});

test("CoolingGate: vitals returns accurate counts", async () => {
  const gate = new CoolingGate();

  // Create some entries
  await gate.propose({ artifact_ref: "a" });
  await gate.propose({ artifact_ref: "b" });
  const c = await gate.propose({ artifact_ref: "c" });

  // Seal one
  gate.witness(c.entry_id, "human", true);
  gate.witness(c.entry_id, "ai_audit", true);
  gate.witness(c.entry_id, "reality_check", true);
  await gate.seal(c.entry_id);

  const v = gate.vitals();
  assert.equal(v.active_count, 2); // a and b still active
  assert.equal(v.sealed_count, 1);
  assert.equal(v.voided_count, 0);
  assert.equal(v.total_entries, 3);
  assert.equal(v.budget_exhausted_any, false);
});

test("CoolingGate: singleton pattern", async () => {
  resetCoolingGate();
  const g1 = getCoolingGate();
  const g2 = getCoolingGate();
  assert.equal(g1, g2);

  await g1.propose({ artifact_ref: "singleton-test" });
  assert.equal(g2.vitals().total_entries, 1);

  resetCoolingGate();
});

test("CoolingGate: prune removes voided entries", async () => {
  const gate = new CoolingGate();
  const entry = await gate.propose({ artifact_ref: "to-void" });

  // Force void
  entry.verdict = "VOID";
  entry.voided_at = new Date().toISOString();
  (gate as any)["voidedCount"]++; // Simulate void

  const pruned = gate.pruneVoided();
  assert.equal(pruned, 1);
  assert.equal(gate.getEntry(entry.entry_id), undefined);
});
