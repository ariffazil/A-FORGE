/**
 * mcpPolicyGateActor.test.ts — F13 L09 (2026-09-25) __legacy_active hardening.
 *
 * Tests:
 *  - setActor() without session does NOT create cross-client global attribution
 *  - per-actorId setActor() entries are isolated from each other
 *  - Without FORGE_ALLOW_LEGACY_ACTOR_FALLBACK=1, derivePrincipal falls through
 *    to client_supplied / transport_fallback (NOT verified_session)
 *  - With the env flag, the legacy opt-in path works (warns on stderr)
 *  - ACT-verified registerVerifiedSession path is unchanged
 *
 * Run: node --test dist/test/mcpPolicyGateActor.test.js
 */

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  McpPolicyGate,
  type ToolCallRequest,
} from "../domain/governance/McpPolicyGate.js";

const SECRET = "l09-test-secret-0123456789ab";

let originalEnv: Record<string, string | undefined> = {};
let stderrWrites: string[] = [];
let realStderrWrite: typeof process.stderr.write = process.stderr.write;

beforeEach(() => {
  // Capture stderr writes from the deprecation / warn logs
  stderrWrites = [];
  realStderrWrite = process.stderr.write;
  // Replace with a capture shim. eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr as any).write = (chunk: any): boolean => {
    stderrWrites.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  };
});

after(() => {
  (process.stderr as any).write = realStderrWrite;
  // Restore env
  for (const k of Object.keys(originalEnv)) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  }
});

before(() => {
  for (const k of ["FORGE_ALLOW_LEGACY_ACTOR_FALLBACK"]) {
    originalEnv[k] = process.env[k];
  }
});

function makeReq(overrides: Partial<ToolCallRequest> = {}): ToolCallRequest {
  return {
    tool_name: "forge_filesystem_read",
    actor_id: "client-A",
    arguments: { path: "/tmp/x" },
    ...overrides,
  };
}

// ─── §1 — setActor() without session does NOT silently cross-attribute ─────
test("setActor without session: no cross-client global attribution (default)", () => {
  const gate = new McpPolicyGate();

  // Client A bootstrap: setActor then evaluate
  gate.setActor("client-A");
  const verdictA = gate.evaluate(makeReq({ actor_id: "client-A" }));

  // Client B (no setActor call) sends a request — must NOT inherit Client A's attribution
  const verdictB = gate.evaluate(makeReq({ actor_id: "client-B" }));

  assert.equal(verdictA.principal.source, "client_supplied",
    "Client A without verified session must be client_supplied (NOT verified_session)");
  assert.equal(verdictB.principal.source, "client_supplied",
    "Client B without verified session must be client_supplied (NOT verified_session — silent cross-client leakage was the bug)");
  assert.notEqual(verdictA.principal.actorId, verdictB.principal.actorId);

  // setActor emitted a deprecation log
  const deprecation = stderrWrites.find(w => /DEPRECATION.*setActor/.test(w));
  assert.ok(deprecation, `expected a DEPRECATION log; got: ${JSON.stringify(stderrWrites)}`);
});

test("per-actorId setActor entries: env-flag attribution follows freshest caller", async () => {
  const gate = new McpPolicyGate();
  process.env.FORGE_ALLOW_LEGACY_ACTOR_FALLBACK = "1";

  // Sleep between calls so verifiedAt timestamps differ. With the env flag,
  // derivePrincipal picks the FRESHEST per-actor entry as a faithful proxy
  // for the legacy global behaviour. (Note: this is best-effort attribution —
  // it is NOT a guarantee that the actor matches the calling request.)
  gate.setActor("client-A");
  await new Promise<void>(r => setTimeout(r, 15));
  gate.setActor("client-B");

  const vA = gate.evaluate(makeReq({ actor_id: "client-A" }));
  const vB = gate.evaluate(makeReq({ actor_id: "client-B" }));

  // Both vA and vB resolve to client-B (the freshest setActor caller). With
  // the env flag, the legacy path is a DEPRECATED best-effort proxy, NOT a
  // per-request guarantee.
  assert.equal(vA.principal.actorId, "client-B",
    "env-flag path: freshest setActor caller is the legacy global proxy");
  assert.equal(vB.principal.actorId, "client-B");

  const warns = stderrWrites.filter(w => /FORGE_ALLOW_LEGACY_ACTOR_FALLBACK/.test(w));
  assert.ok(warns.length >= 1, "env-flag path must log a warning");
  delete process.env.FORGE_ALLOW_LEGACY_ACTOR_FALLBACK;
});

// ─── §2 — Without env flag: NO legacy fallback, default safe path ──────────
test("without env flag, derivePrincipal returns client_supplied / transport_fallback (not verified_session)", () => {
  const gate = new McpPolicyGate();
  // Ensure env flag is OFF
  delete process.env.FORGE_ALLOW_LEGACY_ACTOR_FALLBACK;

  gate.setActor("client-A");

  // Case A: client supplied an actor_id → client_supplied, OBSERVE_ONLY
  const vClient = gate.evaluate(makeReq({ actor_id: "client-A" }));
  assert.equal(vClient.principal.source, "client_supplied");
  assert.equal(vClient.principal.authority, "OBSERVE_ONLY");

  // Case B: no actor_id at all → transport_fallback, never verified_session
  const vNoActor = gate.evaluate(
    makeReq({ actor_id: undefined as unknown as string })
  );
  assert.equal(vNoActor.principal.source, "transport_fallback");
  assert.equal(vNoActor.principal.displayLabel, "stateless-client");
  assert.equal(vNoActor.principal.authority, "OBSERVE_ONLY");
});

// ─── §3 — With env flag: legacy opt-in path returns verified_session ───────
test("with FORGE_ALLOW_LEGACY_ACTOR_FALLBACK=1, legacy attribution path is active (with warn log)", () => {
  const gate = new McpPolicyGate();
  process.env.FORGE_ALLOW_LEGACY_ACTOR_FALLBACK = "1";

  gate.setActor("client-A");

  // No session_id, no client actor_id — should fall through to legacy attribution
  // because the env flag is on.
  const v = gate.evaluate(
    makeReq({ actor_id: undefined as unknown as string })
  );
  assert.equal(v.principal.source, "verified_session",
    "with env flag, derivePrincipal should attribute to the most-recent setActor() caller");
  assert.equal(v.principal.actorId, "client-A");
  assert.equal(v.principal.authority, "FULL");

  const warn = stderrWrites.find(w => /FORGE_ALLOW_LEGACY_ACTOR_FALLBACK=1/.test(w));
  assert.ok(warn, "env-flag path must emit a WARN log");

  delete process.env.FORGE_ALLOW_LEGACY_ACTOR_FALLBACK;
});

// ─── §4 — ACT-verified session path is UNCHANGED ────────────────────────────
test("ACT-verified registerVerifiedSession path is unchanged by L09 hardening", () => {
  const gate = new McpPolicyGate();
  // Mint a valid ACT for ARIF/session-1
  // The McpPolicyGate ACT type uses a different wire format (act_v1.<payloadB64>.<sigB64>)
  const actorId = "ARIF";
  const sessionId = "session-1";
  const now = Date.now();
  const payload = { actor_id: actorId, session_id: sessionId, issued_at: now, expiry: now + 3600_000 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  const act = `act_v1.${payloadB64}.${sig}`;

  const ok = gate.registerVerifiedSession(sessionId, actorId, act, SECRET);
  assert.equal(ok, true, "ACT verification should still pass on a valid signature");

  const v = gate.evaluate(makeReq({ actor_id: actorId, session_id: sessionId }));
  assert.equal(v.principal.source, "verified_session",
    "ACT-verified session must still produce verified_session principal");
  assert.equal(v.principal.actorId, actorId);
  assert.equal(v.principal.authority, "FULL");
});
