/**
 * P0.5 (2026-07-19): ACT cryptographic verification
 *
 * Tests verify that:
 *   - Valid ACT (correct format + signature) is accepted
 *   - Forged ACT (wrong secret) is rejected
 *   - Tampered ACT (modified payload) is rejected
 *   - Expired ACT is rejected
 *   - ACT with wrong actor_id is rejected
 *   - ACT with wrong session_id is rejected
 *   - buildACT produces wire format `sct_v1.<base64url>.<base64url>`
 *   - registerVerifiedSession requires ACT (returns false without it)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildACT,
  verifyACT,
  McpPolicyGate,
} from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "arif-fazil-sovereign-continuity-key";
const OTHER_SECRET = "wrong-secret-attempt";
const ACTOR = "arif";
const SESSION = "sess-test-123";

describe("P0.5 — buildACT + verifyACT wire format", () => {
  it("buildACT produces act_v1.<base64>.<base64> format", () => {
    const act = buildACT(ACTOR, SESSION, SECRET);
    assert.match(act, /^act_v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("verifyACT accepts a freshly built SCT", () => {
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const result = verifyACT(sct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.actor_id, ACTOR);
    assert.equal(result.payload?.session_id, SESSION);
  });

  it("verifyACT REJECTS forged ACT with wrong secret", () => {
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const result = verifyACT(sct, ACTOR, SESSION, OTHER_SECRET);
    assert.equal(result.valid, false);
    assert.ok(
      result.reason?.includes("signature") || result.reason?.includes("length"),
      `Expected signature rejection, got: ${result.reason}`,
    );
  });

  it("verifyACT REJECTS tampered payload (payload mismatch → signature mismatch)", () => {
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const parts = sct.split(".");
    // Swap to a tampered payload (different actor_id) but keep the original signature
    const tamperedPayload = Buffer.from(
      JSON.stringify({ actor_id: "evil-actor", session_id: SESSION, issued_at: Date.now(), expiry: Date.now() + 60_000 }),
    ).toString("base64url");
    const tamperedSct = `sct_v1.${tamperedPayload}.${parts[2]}`;
    const result = verifyACT(tamperedSct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
  });

  it("verifyACT REJECTS expired SCT", () => {
    // Build with TTL=1ms then wait
    const sct = buildACT(ACTOR, SESSION, SECRET, 1);
    // Wait > 1ms
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    const result = verifyACT(sct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.equal(result.expired, true);
  });

  it("verifyACT REJECTS wrong actor_id", () => {
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const result = verifyACT(sct, "different-actor", SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("actor mismatch"));
  });

  it("verifyACT REJECTS wrong session_id", () => {
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const result = verifyACT(sct, ACTOR, "different-session", SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("session_id mismatch"));
  });

  it("verifyACT REJECTS missing act_v1/sct_v1 prefix", () => {
    const result = verifyACT("garbage.token.here", ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("act_v1|sct_v1"));
  });

  it("verifyACT REJECTS malformed (wrong part count)", () => {
    const result = verifyACT("sct_v1.only_two_parts", ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("malformed"));
  });
});

describe("P0.5 — registerVerifiedSession ACT-gated", () => {
  it("registerVerifiedSession with valid ACT succeeds and returns true", () => {
    const gate = new McpPolicyGate();
    const sct = buildACT(ACTOR, SESSION, SECRET);
    const ok = gate.registerVerifiedSession(SESSION, ACTOR, sct, SECRET);
    assert.equal(ok, true);
  });

  it("registerVerifiedSession without ACT returns false (legacy setActor still works)", () => {
    const gate = new McpPolicyGate();
    // No ACT supplied
    const ok = gate.registerVerifiedSession(SESSION, ACTOR);
    assert.equal(ok, false);
    // Legacy setActor still works (stores under __legacy_active)
    gate.setActor(ACTOR);
    const v = gate.evaluate({ tool_name: "forge_health_check", arguments: {} });
    assert.equal(v.principal.source, "verified_session");
  });

  it("registerVerifiedSession with forged ACT returns false", () => {
    const gate = new McpPolicyGate();
    const forgedAct = buildACT(ACTOR, SESSION, OTHER_SECRET);
    const ok = gate.registerVerifiedSession(SESSION, ACTOR, forgedAct, SECRET);
    assert.equal(ok, false);
  });

  it("Forged ACT does NOT grant FULL authority", () => {
    const gate = new McpPolicyGate();
    const forgedAct = buildACT(ACTOR, SESSION, OTHER_SECRET);
    gate.registerVerifiedSession(SESSION, ACTOR, forgedAct, SECRET);
    const v = gate.evaluate({
      session_id: SESSION,
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/test", content: "x" },
    });
    // Without verified registration, principal is unauthenticated
    // (transport_fallback since no actor_id supplied; or client_supplied if actor_id supplied).
    // → forge_filesystem_write is EXECUTE_REVERSIBLE → DENY at P0.2 authority
    assert.equal(v.verdict, "DENY");
    assert.notEqual(v.principal.authority, "FULL", "Forged ACT must NOT grant FULL authority");
    assert.equal(v.principal.authenticated, false);
  });

  it("Valid ACT grants FULL authority for MUTATE actions", () => {
    const gate = new McpPolicyGate();
    const sct = buildACT(ACTOR, SESSION, SECRET);
    gate.registerVerifiedSession(SESSION, ACTOR, sct, SECRET);
    const v = gate.evaluate({
      session_id: SESSION,
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/test", content: "x" },
    });
    // After P0.5 verification, principal is verified_session + FULL
    // tool is EXECUTE_REVERSIBLE → FULL permits it (per authorityPermits)
    assert.equal(v.principal.source, "verified_session");
    assert.equal(v.principal.authority, "FULL");
  });
});
