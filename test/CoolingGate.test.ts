/**
 * CoolingGate.test.ts — Unit tests for SABAR Cooldown Protocol
 */

import test from "node:test";
import assert from "node:assert/strict";
import { CoolingGate, getCoolingGate, resetCoolingGate } from "../src/governance/CoolingGate.js";

test("CoolingGate: propose creates SABAR entry with default 72h", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "image:abc123", description: "test build" });

  assert.equal(entry.verdict, "SABAR");
  assert.equal(entry.risk_tier, "medium");
  assert.equal(entry.cooldown_hours, 72);
  assert.equal(entry.artifact_ref, "image:abc123");
  assert.ok(entry.entry_id.length === 12);
  assert.ok(new Date(entry.cooldown_expiry) > new Date(entry.proposed_at));
});

test("CoolingGate: propose respects risk tier hours", () => {
  const gate = new CoolingGate();
  const low = gate.propose({ risk_tier: "low" });
  const high = gate.propose({ risk_tier: "high" });
  const critical = gate.propose({ risk_tier: "critical" });

  assert.equal(low.cooldown_hours, 24);
  assert.equal(high.cooldown_hours, 168);
  assert.equal(critical.cooldown_hours, 720);
});

test("CoolingGate: seal succeeds with tri-witness complete", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "test:seal" });

  gate.witness(entry.entry_id, "human", true);
  gate.witness(entry.entry_id, "ai_audit", true);
  gate.witness(entry.entry_id, "reality_check", true);

  const result = gate.seal(entry.entry_id);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "sealed");

  const updated = gate.getEntry(entry.entry_id);
  assert.equal(updated?.verdict, "SEAL");
  assert.ok(updated?.sealed_at !== null);
});

test("CoolingGate: seal fails with incomplete tri-witness", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "test:incomplete" });

  gate.witness(entry.entry_id, "human", true);
  // Only 1/3 witnesses

  const result = gate.seal(entry.entry_id);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes("tri-witness incomplete"));
  assert.ok(result.reason.includes("1/3"));
});

test("CoolingGate: seal fails if budget exhausted", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "test:big" });

  // Exhaust disk budget
  entry.resource_budget.disk_bytes_allocated = 60_000_000_000; // 60 GB > 50 GB limit

  gate.witness(entry.entry_id, "human", true);
  gate.witness(entry.entry_id, "ai_audit", true);
  gate.witness(entry.entry_id, "reality_check", true);

  // seal() calls check() first which auto-VOIDs on budget exhaustion
  const result = gate.seal(entry.entry_id);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes("auto-resolved") || result.reason.includes("budget"));
  const updated = gate.getEntry(entry.entry_id);
  assert.equal(updated?.verdict, "VOID");
});

test("CoolingGate: auto-VOID on expiry", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "test:expire", risk_tier: "low" });

  // Manually expire
  entry.cooldown_expiry = new Date(Date.now() - 1000).toISOString();

  const checked = gate.check(entry.entry_id);
  assert.equal(checked?.verdict, "VOID");
  assert.ok(checked?.void_reason?.includes("expired"));
});

test("CoolingGate: deploy gate tracks new artifacts", () => {
  const gate = new CoolingGate();
  const result = gate.deployGate("sha256:new-deploy");

  assert.equal(result.allowed, true);
  assert.equal(result.verdict, "SABAR");
  assert.ok(result.cooldown_entry_id !== null);
  assert.equal(result.remaining_hours, 72);

  // Second deploy of same artifact during cooldown blocks
  const result2 = gate.deployGate("sha256:new-deploy");
  assert.equal(result2.allowed, false);
  assert.equal(result2.verdict, "SABAR");
});

test("CoolingGate: vitals returns accurate counts", () => {
  const gate = new CoolingGate();

  // Create some entries
  gate.propose({ artifact_ref: "a" });
  gate.propose({ artifact_ref: "b" });
  const c = gate.propose({ artifact_ref: "c" });

  // Seal one
  gate.witness(c.entry_id, "human", true);
  gate.witness(c.entry_id, "ai_audit", true);
  gate.witness(c.entry_id, "reality_check", true);
  gate.seal(c.entry_id);

  const v = gate.vitals();
  assert.equal(v.active_count, 2); // a and b still active
  assert.equal(v.sealed_count, 1);
  assert.equal(v.voided_count, 0);
  assert.equal(v.total_entries, 3);
  assert.equal(v.budget_exhausted_any, false);
});

test("CoolingGate: singleton pattern", () => {
  resetCoolingGate();
  const g1 = getCoolingGate();
  const g2 = getCoolingGate();
  assert.equal(g1, g2);

  g1.propose({ artifact_ref: "singleton-test" });
  assert.equal(g2.vitals().total_entries, 1);

  resetCoolingGate();
});

test("CoolingGate: prune removes voided entries", () => {
  const gate = new CoolingGate();
  const entry = gate.propose({ artifact_ref: "to-void" });

  // Force void
  entry.verdict = "VOID";
  entry.voided_at = new Date().toISOString();
  gate["voidedCount"]++; // Simulate void

  const pruned = gate.pruneVoided();
  assert.equal(pruned, 1);
  assert.equal(gate.getEntry(entry.entry_id), undefined);
});
