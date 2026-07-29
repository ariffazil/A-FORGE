/**
 * L13 / Scar Mechanism — Failure Memory + Consultation Tests
 *
 * Closes Trauma Audit Gap #2 (L13: "Denied failures become law").
 * Tests that failures are permanently recorded, consulted before repeat execution,
 * and cannot be silently overwritten.
 *
 * DITEMPA BUKAN DIBERI — Forged 2026-07-29
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sealFailure,
  listFailures,
  consultFailurePressure,
  revokeFailure,
} from "../src/domain/forge/scar.js";
import type { GovernedDomain } from "../src/contracts/types.js";

// ─── SCAR CREATION ─────────────────────────────────────

test("sealFailure creates a permanent scar record", async () => {
  const scar = await sealFailure({
    failure_mode: "TEST: epistemic label missing on claim",
    severity: "MEDIUM",
    scar_pressure: 0.6,
    domain: "aforge" as GovernedDomain,
    detection_method: "epistemic-signal.test.ts",
    constraint_imposed: "All MCP responses must carry epistemic label",
    sealed_by: "trauma-audit-closure",
  });

  assert.ok(scar.scar_id, "scar must have an ID");
  assert.ok(scar.fingerprint, "scar must have a fingerprint");
  assert.strictEqual(scar.failure_mode, "TEST: epistemic label missing on claim");
  assert.strictEqual(scar.severity, "MEDIUM");
  assert.strictEqual(scar.scar_pressure, 0.6);
  assert.strictEqual(scar.domain, "aforge");
  assert.ok(scar.occurred_at, "scar must have timestamp");
  assert.ok(scar.sealed_at, "scar must have seal timestamp");
  assert.strictEqual(scar.sealed_by, "trauma-audit-closure");
});

test("sealFailure generates unique fingerprint per failure mode", async () => {
  const scar1 = await sealFailure({
    failure_mode: "UNIQUE: test pattern alpha",
    severity: "LOW",
    scar_pressure: 0.2,
    domain: "geox" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Alpha constraint",
    sealed_by: "test",
  });

  const scar2 = await sealFailure({
    failure_mode: "UNIQUE: test pattern beta",
    severity: "LOW",
    scar_pressure: 0.2,
    domain: "geox" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Beta constraint",
    sealed_by: "test",
  });

  assert.notStrictEqual(scar1.fingerprint, scar2.fingerprint,
    "Different failure modes should produce different fingerprints");
});

test("sealFailure with same mode+domain produces same fingerprint", async () => {
  const scar1 = await sealFailure({
    failure_mode: "SAME: duplicate pattern",
    severity: "HIGH",
    scar_pressure: 0.7,
    domain: "arifos" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Dupe constraint",
    sealed_by: "test",
  });

  const scar2 = await sealFailure({
    failure_mode: "SAME: duplicate pattern",
    severity: "HIGH",
    scar_pressure: 0.7,
    domain: "arifos" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Dupe constraint",
    sealed_by: "test",
  });

  assert.strictEqual(scar1.fingerprint, scar2.fingerprint,
    "Same mode+domain should produce same fingerprint");
  assert.notStrictEqual(scar1.scar_id, scar2.scar_id,
    "But each sealing gets a unique scar_id");
});

// ─── SCAR LISTING ──────────────────────────────────────

test("listFailures returns all scars when no domain filter", async () => {
  const scars = await listFailures();
  assert.ok(Array.isArray(scars), "should return array");
  assert.ok(scars.length >= 3, "should have at least 3 test scars from above");
});

test("listFailures filters by domain", async () => {
  const aforgeScars = await listFailures("aforge" as GovernedDomain);
  for (const scar of aforgeScars) {
    assert.strictEqual(scar.domain, "aforge",
      "Filtered scars should all belong to the specified domain");
  }
});

// ─── SCAR CONSULTATION ─────────────────────────────────

test("consultFailurePressure returns pressure for matching fingerprint", async () => {
  // First, create a known scar
  const scar = await sealFailure({
    failure_mode: "CONSULT: test consultation lookup",
    severity: "CRITICAL",
    scar_pressure: 0.9,
    domain: "wealth" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Consult constraint",
    sealed_by: "test",
  });

  const result = await consultFailurePressure(scar.fingerprint);
  assert.ok(result.count >= 1, "should find at least 1 matching scar");
  assert.ok(result.scarPressure > 0, "pressure should be > 0 for critical scar");
});

test("consultFailurePressure returns zero for unknown fingerprint", async () => {
  const result = await consultFailurePressure("ffffffffffffffff");
  assert.strictEqual(result.count, 0, "unknown fingerprint should yield 0 matches");
  assert.strictEqual(result.scarPressure, 0, "unknown fingerprint should yield 0 pressure");
});

test("CRITICAL severity has higher pressure multiplier than LOW", async () => {
  const critical = await sealFailure({
    failure_mode: "PRESSURE: critical test",
    severity: "CRITICAL",
    scar_pressure: 0.8,
    domain: "well" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Critical constraint",
    sealed_by: "test",
  });

  const low = await sealFailure({
    failure_mode: "PRESSURE: low test",
    severity: "LOW",
    scar_pressure: 0.8,
    domain: "well" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Low constraint",
    sealed_by: "test",
  });

  const criticalResult = await consultFailurePressure(critical.fingerprint);
  const lowResult = await consultFailurePressure(low.fingerprint);

  assert.ok(criticalResult.scarPressure > lowResult.scarPressure,
    `CRITICAL pressure (${criticalResult.scarPressure}) should exceed LOW pressure (${lowResult.scarPressure})`);
});

// ─── SCAR REVOCATION ───────────────────────────────────

test("revokeFailure soft-deletes scar by zeroing pressure", async () => {
  const scar = await sealFailure({
    failure_mode: "REVOKE: test revocable scar",
    severity: "MEDIUM",
    scar_pressure: 0.5,
    domain: "aaa" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Revocable constraint",
    sealed_by: "test",
  });

  const result = await revokeFailure(scar.scar_id, "admin-test");
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.scar!.scar_pressure, 0,
    "Revoked scar should have zero pressure");
  assert.ok(result.scar!.constraint_imposed.includes("REVOKED"),
    "Revoked scar should be marked REVOKED in constraint text");
});

test("revokeFailure returns false for non-existent scar", async () => {
  const result = await revokeFailure("scar_nonexistent_12345", "admin-test");
  assert.strictEqual(result.success, false);
});

// ─── NEGATIVE TESTS ────────────────────────────────────

test("NEGATIVE: scar cannot be deleted — only soft-revoked", async () => {
  const scar = await sealFailure({
    failure_mode: "NEGATIVE: immutable test",
    severity: "HIGH",
    scar_pressure: 0.7,
    domain: "aforge" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Immutable constraint",
    sealed_by: "test",
  });

  // Revoke it
  await revokeFailure(scar.scar_id, "admin");

  // The scar should still appear in listings (soft-deleted, not removed)
  const allScars = await listFailures();
  const stillExists = allScars.find(s => s.scar_id === scar.scar_id);
  assert.ok(stillExists, "Revoked scar must still exist — soft-delete only");
  assert.strictEqual(stillExists!.scar_pressure, 0,
    "But should have zero active pressure");
});

test("NEGATIVE: double-sealing same failure creates separate records", async () => {
  const scar1 = await sealFailure({
    failure_mode: "DOUBLE: repeat failure",
    severity: "LOW",
    scar_pressure: 0.3,
    domain: "geox" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Repeat constraint",
    sealed_by: "test",
  });
  const scar2 = await sealFailure({
    failure_mode: "DOUBLE: repeat failure",
    severity: "LOW",
    scar_pressure: 0.3,
    domain: "geox" as GovernedDomain,
    detection_method: "test",
    constraint_imposed: "Repeat constraint",
    sealed_by: "test",
  });

  assert.strictEqual(scar1.fingerprint, scar2.fingerprint,
    "Same fingerprint — this IS the same failure repeating");
  assert.notStrictEqual(scar1.scar_id, scar2.scar_id,
    "But each occurrence gets a unique scar_id — the system remembers EVERY instance");
  assert.notStrictEqual(scar1.occurred_at, scar2.occurred_at,
    "Timestamps should differ for separate occurrences");

  // Consult should show cumulative pressure from BOTH scars
  const result = await consultFailurePressure(scar1.fingerprint);
  assert.ok(result.count >= 2, "Consultation should find BOTH instances of the repeat failure");
});
