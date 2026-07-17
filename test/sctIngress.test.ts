/**
 * SCT ingress — multi-source conflict + production lockout.
 * Seal-A conditions 2 & 3.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSctFromCall,
  extractSctFromArgs,
  gateToolIngress,
  sctMutationGateHealth,
  assertSctMutationGateOrExit,
} from "../src/infrastructure/governance/sctIngress.js";

const TOK_A = "sct_v1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TOK_B = "sct_v1.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("extractSctFromCall — multi-source", () => {
  it("ABSENT when no token", () => {
    const e = extractSctFromCall({});
    assert.equal(e.status, "ABSENT");
  });

  it("PRESENT when single source", () => {
    const e = extractSctFromCall({ session_token: TOK_A });
    assert.equal(e.status, "PRESENT");
    if (e.status === "PRESENT") assert.equal(e.token, TOK_A);
  });

  it("PRESENT when identical tokens across sources", () => {
    const e = extractSctFromCall(
      { session_token: TOK_A, sct: TOK_A, _meta: { sct: TOK_A } },
      { headers: { "X-ArifOS-SCT": TOK_A, Authorization: `Bearer ${TOK_A}` } },
    );
    assert.equal(e.status, "PRESENT");
    assert.equal(e.unique_fingerprints, 1);
    assert.ok(e.source_count >= 4);
  });

  it("AMBIGUOUS when distinct tokens conflict", () => {
    const e = extractSctFromCall(
      { session_token: TOK_A },
      { headers: { "X-ArifOS-SCT": TOK_B } },
    );
    assert.equal(e.status, "AMBIGUOUS");
    if (e.status === "AMBIGUOUS") {
      assert.equal(e.conflict_detected, true);
      assert.equal(e.unique_fingerprints, 2);
    }
  });

  it("AMBIGUOUS when args.sct != args.session_token", () => {
    const e = extractSctFromCall({ session_token: TOK_A, sct: TOK_B });
    assert.equal(e.status, "AMBIGUOUS");
  });

  it("extractSctFromArgs returns null on AMBIGUOUS (no first-wins)", () => {
    assert.equal(extractSctFromArgs({ session_token: TOK_A, sct: TOK_B }), null);
    assert.equal(extractSctFromArgs({ session_token: TOK_A }), TOK_A);
  });
});

describe("gateToolIngress — AMBIGUOUS reject", () => {
  it("rejects conflicting tokens without calling arifOS", async () => {
    const r = await gateToolIngress(
      "forge_execute",
      { session_token: TOK_A, sct: TOK_B, actor_id: "test" },
      { requireSct: true },
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error, "SCT_AMBIGUOUS");
      assert.ok(r.extraction);
    }
  });
});

describe("sctMutationGateHealth + production lockout", () => {
  it("enforced=true bypass_profile=none when unset", () => {
    const h = sctMutationGateHealth({
      NODE_ENV: "production",
      AF_FORGE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(h.required, true);
    assert.equal(h.enforced, true);
    assert.equal(h.bypass_profile, "none");
  });

  it("dev bypass allowed only non-production", () => {
    const h = sctMutationGateHealth({
      NODE_ENV: "development",
      FORGE_SCT_REQUIRE_MUTATE: "0",
    } as NodeJS.ProcessEnv);
    assert.equal(h.enforced, false);
    assert.equal(h.bypass_profile, "dev");
  });

  it("assertSctMutationGateOrExit does not throw when enforced", () => {
    const r = assertSctMutationGateOrExit({
      NODE_ENV: "production",
      AF_FORGE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(r.enforced, true);
    assert.equal(r.bypass_profile, "none");
  });
});
