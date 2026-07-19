/**
 * P0.5 (2026-07-19): SCT cryptographic verification
 *
 * Tests verify that:
 *   - Valid SCT (correct format + signature) is accepted
 *   - Forged SCT (wrong secret) is rejected
 *   - Tampered SCT (modified payload) is rejected
 *   - Expired SCT is rejected
 *   - SCT with wrong actor_id is rejected
 *   - SCT with wrong session_id is rejected
 *   - buildSCT produces wire format `sct_v1.<base64url>.<base64url>`
 *   - registerVerifiedSession requires SCT (returns false without it)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildSCT,
  verifySCT,
  McpPolicyGate,
} from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "arif-fazil-sovereign-continuity-key";
const OTHER_SECRET = "wrong-secret-attempt";
const ACTOR = "arif";
const SESSION = "sess-test-123";

describe("P0.5 — buildSCT + verifySCT wire format", () => {
  it("buildSCT produces sct_v1.<base64>.<base64> format", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    assert.match(sct, /^sct_v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("verifySCT accepts a freshly built SCT", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const result = verifySCT(sct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.actor_id, ACTOR);
    assert.equal(result.payload?.session_id, SESSION);
  });

  it("verifySCT REJECTS forged SCT with wrong secret", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const result = verifySCT(sct, ACTOR, SESSION, OTHER_SECRET);
    assert.equal(result.valid, false);
    assert.ok(
      result.reason?.includes("signature") || result.reason?.includes("length"),
      `Expected signature rejection, got: ${result.reason}`,
    );
  });

  it("verifySCT REJECTS tampered payload (payload mismatch → signature mismatch)", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const parts = sct.split(".");
    // Swap to a tampered payload (different actor_id) but keep the original signature
    const tamperedPayload = Buffer.from(
      JSON.stringify({ actor_id: "evil-actor", session_id: SESSION, issued_at: Date.now(), expiry: Date.now() + 60_000 }),
    ).toString("base64url");
    const tamperedSct = `sct_v1.${tamperedPayload}.${parts[2]}`;
    const result = verifySCT(tamperedSct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
  });

  it("verifySCT REJECTS expired SCT", () => {
    // Build with TTL=1ms then wait
    const sct = buildSCT(ACTOR, SESSION, SECRET, 1);
    // Wait > 1ms
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    const result = verifySCT(sct, ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.equal(result.expired, true);
  });

  it("verifySCT REJECTS wrong actor_id", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const result = verifySCT(sct, "different-actor", SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("actor_id mismatch"));
  });

  it("verifySCT REJECTS wrong session_id", () => {
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const result = verifySCT(sct, ACTOR, "different-session", SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("session_id mismatch"));
  });

  it("verifySCT REJECTS missing sct_v1 prefix", () => {
    const result = verifySCT("garbage.token.here", ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("sct_v1"));
  });

  it("verifySCT REJECTS malformed (wrong part count)", () => {
    const result = verifySCT("sct_v1.only_two_parts", ACTOR, SESSION, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("malformed"));
  });
});

describe("P0.5 — registerVerifiedSession SCT-gated", () => {
  it("registerVerifiedSession with valid SCT succeeds and returns true", () => {
    const gate = new McpPolicyGate();
    const sct = buildSCT(ACTOR, SESSION, SECRET);
    const ok = gate.registerVerifiedSession(SESSION, ACTOR, sct, SECRET);
    assert.equal(ok, true);
  });

  it("registerVerifiedSession without SCT returns false (legacy setActor still works)", () => {
    const gate = new McpPolicyGate();
    // No SCT supplied
    const ok = gate.registerVerifiedSession(SESSION, ACTOR);
    assert.equal(ok, false);
    // Legacy setActor still works (stores under __legacy_active)
    gate.setActor(ACTOR);
    const v = gate.evaluate({ tool_name: "forge_health_check", arguments: {} });
    assert.equal(v.principal.source, "verified_session");
  });

  it("registerVerifiedSession with forged SCT returns false", () => {
    const gate = new McpPolicyGate();
    const forgedSct = buildSCT(ACTOR, SESSION, OTHER_SECRET);
    const ok = gate.registerVerifiedSession(SESSION, ACTOR, forgedSct, SECRET);
    assert.equal(ok, false);
  });

  it("Forged SCT does NOT grant FULL authority", () => {
    const gate = new McpPolicyGate();
    const forgedSct = buildSCT(ACTOR, SESSION, OTHER_SECRET);
    gate.registerVerifiedSession(SESSION, ACTOR, forgedSct, SECRET);
    const v = gate.evaluate({
      session_id: SESSION,
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/test", content: "x" },
    });
    // Without verified registration, principal is unauthenticated
    // (transport_fallback since no actor_id supplied; or client_supplied if actor_id supplied).
    // → forge_filesystem_write is EXECUTE_REVERSIBLE → DENY at P0.2 authority
    assert.equal(v.verdict, "DENY");
    assert.notEqual(v.principal.authority, "FULL", "Forged SCT must NOT grant FULL authority");
    assert.equal(v.principal.authenticated, false);
  });

  it("Valid SCT grants FULL authority for MUTATE actions", () => {
    const gate = new McpPolicyGate();
    const sct = buildSCT(ACTOR, SESSION, SECRET);
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
