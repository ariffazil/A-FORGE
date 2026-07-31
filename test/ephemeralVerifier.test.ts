/**
 * ephemeralVerifier.test.ts — VerifierRegistry rejects SELF_CERTIFIED,
 * each method produces a signed receipt, and concurrent verification
 * dedupes.
 */
import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  VerifierRegistry,
  KnownAnswerVerifier,
  SchemaInvariantVerifier,
  IndependentRecomputeVerifier,
  DomainWitnessVerifier,
  SELF_CERTIFIED,
  type VerifierMethod,
} from "../src/domain/governance/verifier/VerifierRegistry.js";

function makeTool(id: string, impl: string) {
  return {
    id,
    templateId: "t1",
    templateType: "compute_fn",
    implementation: impl,
    state: "invoked",
  };
}

describe("VerifierRegistry — SELF_CERTIFIED rejection", () => {
  it("throws when SELF_CERTIFIED is supplied", async () => {
    const reg = new VerifierRegistry();
    await assert.rejects(
      () => reg.execute(makeTool("a", "x"), SELF_CERTIFIED as VerifierMethod, {}),
      /SELF_CERTIFIED is inadmissible/,
    );
  });
});

describe("VerifierRegistry — known_answer", () => {
  let reg: VerifierRegistry;
  beforeEach(() => { reg = new VerifierRegistry(); reg.clearInFlight(); });

  it("returns failed receipt when fixturesPath missing", async () => {
    const r = await reg.execute(makeTool("a", "x"), "known_answer", {});
    assert.equal(r.passed, false);
    assert.equal(r.signed_by, "aforge-local-attestor");
    assert.notEqual(r.receipt_hash, "");
  });

  it("returns passed receipt when fixture hash matches implementation", async () => {
    const impl = "echo hello";
    const r = await reg.execute(
      makeTool("a", impl),
      "known_answer",
      { fixturesPath: impl },
    );
    assert.equal(r.passed, true);
  });
});

describe("VerifierRegistry — schema_invariant", () => {
  let reg: VerifierRegistry;
  beforeEach(() => { reg = new VerifierRegistry(); reg.clearInFlight(); });

  it("returns failed when outputSchema missing", async () => {
    const r = await reg.execute(makeTool("a", "{}"), "schema_invariant", {});
    assert.equal(r.passed, false);
  });

  it("returns passed when schema parse succeeds", async () => {
    const schema = { parse: (_: unknown) => ({ ok: true }) };
    const r = await reg.execute(makeTool("a", "{}"), "schema_invariant", { outputSchema: schema });
    assert.equal(r.passed, true);
  });

  it("returns failed when schema parse throws", async () => {
    const schema = { parse: () => { throw new Error("bad schema"); } };
    const r = await reg.execute(makeTool("a", "{}"), "schema_invariant", { outputSchema: schema });
    assert.equal(r.passed, false);
  });
});

describe("VerifierRegistry — independent_recompute", () => {
  let reg: VerifierRegistry;
  beforeEach(() => { reg = new VerifierRegistry(); reg.clearInFlight(); });

  it("returns failed when alternateImplementation missing", async () => {
    const r = await reg.execute(makeTool("a", "x"), "independent_recompute", {});
    assert.equal(r.passed, false);
  });

  it("returns passed when primary hash matches alternate", async () => {
    const r = await reg.execute(
      makeTool("a", "x"),
      "independent_recompute",
      { alternateImplementation: "x" },
    );
    assert.equal(r.passed, true);
  });
});

describe("VerifierRegistry — domain_witness", () => {
  let reg: VerifierRegistry;
  beforeEach(() => { reg = new VerifierRegistry(); reg.clearInFlight(); });

  it("returns failed when arifosSessionId missing", async () => {
    const r = await reg.execute(makeTool("a", "x"), "domain_witness", {});
    assert.equal(r.passed, false);
    assert.equal(r.signed_by, "aforge-local-attestor");
  });

  it("returns passed receipt with arifos-arif_judge signature when anchored", async () => {
    const r = await reg.execute(
      makeTool("a", "x"),
      "domain_witness",
      { arifosSessionId: "SEAL-test", arifosLeaseHash: "lh-1" },
    );
    assert.equal(r.passed, true);
    assert.equal(r.signed_by, "arifos-arif_judge");
    assert.ok(r.cc_id && r.cc_id.length > 0);
  });
});

describe("VerifierRegistry — singleton", () => {
  it("exports SELF_CERTIFIED sentinel", () => {
    assert.equal(SELF_CERTIFIED, "SELF_CERTIFIED");
  });
});

describe("VerifierRegistry — singletons constructable", () => {
  it("KnownAnswerVerifier/SchemaInvariantVerifier/IndependentRecomputeVerifier/DomainWitnessVerifier are direct-constructable", () => {
    assert.ok(new KnownAnswerVerifier());
    assert.ok(new SchemaInvariantVerifier());
    assert.ok(new IndependentRecomputeVerifier());
    assert.ok(new DomainWitnessVerifier());
  });
});
