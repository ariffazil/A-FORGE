/**
 * WO-2 / R18 regression suite — actor resolution must not grant privilege
 * from string shape. Law: lexical resemblance must not confer semantic
 * authority (E-TRANSLATION-WITNESS-2026-10-11, F13-ratified 2026-10-11).
 *
 * Former defect: any actorId matching /^SEAL-[a-f0-9]{16}$/ resolved to an
 * 888-APEX-oriented binding ("SEAL tokens get kernel authority").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveActor } from "../src/domain/aaa/AaaAgentRegistry.js";

test("WO-2: SEAL-shaped actor ids no longer resolve to any binding (fail-closed)", () => {
  const shapes = [
    "SEAL-5d425fc9ad8244fa",
    "SEAL-abcdef0123456789",
    "SEAL-0000000000000000",
    "SEAL-ffffffffffffffff",
  ];
  for (const s of shapes) {
    assert.equal(resolveActor(s), null, `${s} must resolve to null (caller HOLDs)`);
  }
});

test("WO-2: near-miss shapes also resolve to null", () => {
  for (const s of ["seal-5d425fc9ad8244fa", "SEAL-5D425FC9AD8244FA", "SEAL-5d425fc9ad8244fa ", "XSEAL-5d425fc9ad8244fa"]) {
    assert.equal(resolveActor(s), null, `${s} must resolve to null`);
  }
});

test("WO-2: documented session:: namespace still binds (proper path preserved)", () => {
  const b = resolveActor("session::SEAL-5d425fc9ad8244fa");
  assert.ok(b, "session:: namespace must resolve");
  assert.equal(b.primaryAgent, "333-AGI");
  assert.deepEqual(b.delegateAgents, ["555-ASI"]);
  assert.equal(b.humanOverride, false);
});

test("WO-2: exact registry entries unaffected", () => {
  const sovereign = resolveActor("arif-fazil");
  assert.ok(sovereign);
  assert.equal(sovereign.primaryAgent, "888-APEX");
  assert.equal(sovereign.humanOverride, true);

  const sealed = resolveActor("kernel-sealed");
  assert.ok(sealed);
  assert.equal(sealed.primaryAgent, "888-APEX");

  const sealService = resolveActor("a-forge::seal-service");
  assert.ok(sealService);
  assert.equal(sealService.primaryAgent, "888-APEX");
});

test("WO-2: prefix namespaces still bind", () => {
  assert.equal(resolveActor("a-forge::anything")?.primaryAgent, "555-ASI");
  const h = resolveActor("human::arif");
  assert.ok(h);
  assert.equal(h.primaryAgent, "888-APEX");
  assert.equal(h.humanOverride, true);
});

test("WO-2: unknown actors resolve null — never default to privileged", () => {
  assert.equal(resolveActor("random-string"), null);
  assert.equal(resolveActor(""), null);
  assert.equal(resolveActor("888-APEX-wannabe"), null);
});
