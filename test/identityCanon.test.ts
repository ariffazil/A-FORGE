/**
 * IDENTITY_CANON v1 test suite — reads the content-hashed shared fixture from
 * the arifOS repo (sibling directory on the forge box), verifies its hash, and
 * asserts the same cases the Python suite (tests/12_identity_canon.py) asserts.
 * If these drift apart, the hash check fails first.
 */
import * as assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

import { canonicalActorId, comparisonKey, samePrincipal } from "../src/domain/governance/identityCanon.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, "../../../arifOS/contracts/identity_canon_fixtures.json");

function loadFixture(): {
  canon_version: string;
  content_sha256: string;
  rule: string;
  cases: Array<{ raw: string; claimed: string; canonical_id: string; comparison_key: string; source: string }>;
} {
  const doc = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const body = JSON.stringify({
    canon_version: doc.canon_version,
    rule: doc.rule,
    cases: doc.cases,
  }, null, 2);
  assert.strictEqual(
    createHash("sha256").update(body).digest("hex"),
    doc.content_sha256,
    "fixture content hash mismatch — fixtures drifted; regenerate before testing",
  );
  return doc;
}

test("shared fixture hash intact", () => {
  loadFixture();
});

test("all fixture cases resolve identically to the Python canon", () => {
  for (const c of loadFixture().cases) {
    assert.strictEqual(canonicalActorId(c.raw), c.canonical_id, `canonical mismatch for ${c.raw}`);
    assert.strictEqual(comparisonKey(c.raw), c.comparison_key, `key mismatch for ${c.raw}`);
  }
});

test("same-principal equivalences", () => {
  const pairs: Array<[string, string]> = [
    ["arif-fazil", "arif"],
    ["ARIF_FAZIL", "ariffazil"],
    ["333-AGI", "333-agi"],
    ["claude/opus-5.5", "CLAUDE"],
    ["kimi-code/FI-008", "fi-008"],
    ["mesa-test-agent", "mesa_test_agent"],
  ];
  for (const [a, b] of pairs) {
    assert.ok(samePrincipal(a, b), `${a} and ${b} must be one principal`);
  }
});

test("different principals stay different", () => {
  const pairs: Array<[string, string]> = [
    ["arif", "333-AGI"],
    ["claude", "kimi-code/FI-008"],
    ["nova-9", "arif"],
  ];
  for (const [a, b] of pairs) {
    assert.ok(!samePrincipal(a, b), `${a} must not equal ${b}`);
  }
});

test("the 2026-10-21 false-mismatch pair now resolves", () => {
  assert.ok(samePrincipal("claude/opus-5.5", "CLAUDE"));
});

test("Amanah release semantics: same principal different case releases", () => {
  // The exact comparison AmanahLockManager.releaseLock now performs.
  assert.ok(samePrincipal("ARIF_FAZIL", "arif-fazil"));
  assert.ok(!samePrincipal("arif", "333-agi"));
});

test("F13 2026-10-22: role strings resolve to nothing — never to a principal", () => {
  // 'f13'/'sovereign'/'888' are power names, not person names. Resolving them
  // to ARIF would let anyone claim sovereignty with a string.
  for (const raw of ["f13", "sovereign", "888", "arif-fazil.com"]) {
    assert.strictEqual(canonicalActorId(raw), null, `${raw} must resolve to nothing`);
    assert.strictEqual(comparisonKey(raw), null, `${raw} must have no comparison key`);
    assert.ok(!samePrincipal(raw, "arif"), `${raw} must not be the sovereign principal`);
  }
});

test("F13-approved person-name aliases resolve to the sovereign principal", () => {
  for (const alias of ["arif_fazil", "muhammad arif"]) {
    assert.strictEqual(canonicalActorId(alias), "ARIF");
    assert.ok(samePrincipal(alias, "arif-fazil"));
  }
});
