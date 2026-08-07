/**
 * PolicyGate Identity Model — 10 regression tests
 *
 * Tests the provenance-aware Principal system:
 *   transport_fallback  → OBSERVE_ONLY (tests 1, 4)
 *   client_supplied     → unverified, OBSERVE_ONLY (test 6)
 *   explicit anonymous  → DENY always (test 3)
 *   explicit spoofing   → DENY (test 4)
 *   verified_session    → FULL (test 8)
 *
 * Invariant: authority ≠ actor_id string
 *
 * @forged 2026-07-19 — audit-driven identity fix
 */

import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { McpPolicyGate, authorityPermits, buildACT } from "../src/domain/governance/McpPolicyGate.js";
import type { Principal } from "../src/domain/governance/McpPolicyGate.js";

let gate: McpPolicyGate;

beforeEach(() => {
  gate = new McpPolicyGate();
});

// ── Test 1: No actor_id + OBSERVE → ALLOW, authority=OBSERVE_ONLY ──
describe("Test 1 — transport_fallback", () => {
  it("allows OBSERVE tool without actor_id", () => {
    const v = gate.evaluate({
      tool_name: "forge_fetch",
      arguments: { url: "https://example.com" },
    });
    assert.equal(v.verdict, "ALLOW");
    assert.equal(v.principal.source, "transport_fallback");
    assert.equal(v.principal.authenticated, false);
    assert.equal(v.principal.authority, "OBSERVE_ONLY");
    assert.equal(v.principal.actorId, null);
    assert.equal(v.principal.displayLabel, "stateless-client");
  });

  it("allows OBSERVE tool via transport_fallback with multiple tools", () => {
    for (const tool of ["forge_filesystem_read", "forge_search", "forge_probe"]) {
      const v = gate.evaluate({ tool_name: tool, arguments: {} });
      assert.equal(v.verdict, "ALLOW", `${tool} should ALLOW`);
      assert.equal(v.principal.source, "transport_fallback");
      assert.equal(v.principal.authority, "OBSERVE_ONLY");
    }
  });
});

// ── Test 2: No actor_id + MUTATE → needs session gate ──
// The policy gate passes L1 for transport_fallback. The MUTATE denial
// happens at the session gate layer in serve.ts (FORGE 2-B).
// This test verifies the policy gate itself doesn't block MUTATE at L1.
describe("Test 2 — transport_fallback + MUTATE (L1 only)", () => {
  it("passes L1 for MUTATE tool — downstream session gate handles denial", () => {
    const v = gate.evaluate({
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/test", content: "test" },
    });
    // Policy gate passes L1 with transport_fallback
    assert.equal(v.layers.identity, true);
    assert.equal(v.principal.source, "transport_fallback");
    // The ALLOW at policy level is correct — session/lease gates enforce MUTATE downstream
  });
});

// ── Test 3: Explicit anonymous → DENY always ──
describe("Test 3 — explicit anonymous", () => {
  it("denies anonymous actor_id on OBSERVE tool", () => {
    const v = gate.evaluate({
      actor_id: "anonymous",
      tool_name: "forge_fetch",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("anonymous_actor_explicitly_denied")),
      `Expected anonymous denial, got: ${v.reasons.join(", ")}`,
    );
    assert.equal(v.layers.identity, false);
  });

  it("denies anonymous actor_id on any tool", () => {
    for (const tool of ["forge_health_check", "forge_probe", "forge_memory"]) {
      const v = gate.evaluate({ actor_id: "anonymous", tool_name: tool, arguments: {} });
      assert.equal(v.verdict, "DENY", `${tool} should DENY anonymous`);
    }
  });

  it("denies empty string actor_id like anonymous", () => {
    const v = gate.evaluate({
      actor_id: "",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
  });
});

// ── Test 4: Explicit "stateless-client" → spoofing rejected ──
describe("Test 4 — explicit stateless-client spoofing", () => {
  it("rejects client-supplied 'stateless-client' actor_id", () => {
    const v = gate.evaluate({
      actor_id: "stateless-client",
      tool_name: "forge_fetch",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("spoofing_rejected")),
      `Expected spoofing rejection, got: ${v.reasons.join(", ")}`,
    );
    assert.equal(v.principal.source, "client_supplied");
    assert.equal(v.principal.authenticated, false);
    // source is client_supplied, NOT transport_fallback
    assert.notEqual(v.principal.source, "transport_fallback");
  });

  it("rejects client-supplied 'stateless-client' on OBSERVE tools", () => {
    for (const tool of ["forge_filesystem_read", "forge_probe", "forge_search"]) {
      const v = gate.evaluate({
        actor_id: "stateless-client",
        tool_name: tool,
        arguments: {},
      });
      assert.equal(v.verdict, "DENY", `${tool} should reject spoofing`);
      assert.ok(v.reasons.some((r) => r.includes("spoofing_rejected")));
    }
  });
});

// ── Test 5: Forged session ID → needs external validation ──
// Session validation happens in serve.ts validateSession().
// The policy gate treats any explicit actor_id as client_supplied (unverified).
describe("Test 5 — forged session ID", () => {
  it("treats any explicit actor_id as client_supplied", () => {
    const v = gate.evaluate({
      actor_id: "fake-session-arif",
      tool_name: "forge_fetch",
      arguments: {},
    });
    // Passes L1 (client_supplied → OBSERVE_ONLY)
    assert.equal(v.layers.identity, true);
    assert.equal(v.principal.source, "client_supplied");
    assert.equal(v.principal.authenticated, false);
    assert.equal(v.principal.authority, "OBSERVE_ONLY");
  });
});

// ── Test 6: Client-supplied ID → OBSERVE_ONLY (unverified) ──
describe("Test 6 — client_supplied unverified", () => {
  it("allows OBSERVE but with client_supplied provenance", () => {
    const v = gate.evaluate({
      actor_id: "some-client-id",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.verdict, "ALLOW");
    assert.equal(v.principal.source, "client_supplied");
    assert.equal(v.principal.authenticated, false);
    assert.equal(v.principal.authority, "OBSERVE_ONLY");
  });

  it("carries unverified_client_id caveat in reasons", () => {
    const v = gate.evaluate({
      actor_id: "some-client",
      tool_name: "forge_fetch",
      arguments: {},
    });
    assert.ok(
      v.reasons.some((r) => r.includes("unverified_client_id")),
      `Expected unverified caveat, got: ${v.reasons.join(", ")}`,
    );
  });
});

// ── Test 7: verified_session → FULL authority ──
describe("Test 7 — verified_session", () => {
  it("grants FULL authority after setActor()", () => {
    gate.setActor("arif");
    const v = gate.evaluate({
      tool_name: "forge_fetch",
      arguments: {},
    });
    assert.equal(v.verdict, "ALLOW");
    assert.equal(v.principal.source, "verified_session");
    assert.equal(v.principal.authenticated, true);
    assert.equal(v.principal.authority, "FULL");
    assert.equal(v.principal.actorId, "arif");
  });

  it("resolves policy by actorId for verified sessions", () => {
    gate.setActor("arif");
    const v = gate.evaluate({
      tool_name: "forge_filesystem_write",
      arguments: { path: "/tmp/x", content: "x" },
    });
    assert.equal(v.verdict, "ALLOW");
    assert.equal(v.principal.actorId, "arif");
    assert.equal(v.principal.authenticated, true);
  });
});

// ── Test 8: Explicit actor_id overrides activeActor ──
describe("Test 8 — explicit overrides activeActor", () => {
  it("uses explicit actor_id when provided, not activeActor", () => {
    gate.setActor("arif");
    const v = gate.evaluate({
      actor_id: "anonymous",
      tool_name: "forge_health_check",
      arguments: {},
    });
    // "anonymous" should still be DENIED even though activeActor is set
    assert.equal(v.verdict, "DENY");
    assert.ok(v.reasons.some((r) => r.includes("anonymous_actor")));
  });
});

// ── Test 9: Principal structure invariant ──
describe("Test 9 — Principal structure invariant", () => {
  it("never sets authority=FULL for unauthenticated principals", () => {
    const cases: Array<{ actor_id?: string; desc: string }> = [
      { desc: "omitted" },
      { actor_id: "some-client", desc: "client-supplied" },
      { actor_id: "stateless-client", desc: "spoof attempt" },
    ];
    for (const c of cases) {
      const v = gate.evaluate({
        actor_id: c.actor_id,
        tool_name: "forge_health_check",
        arguments: {},
      });
      if (v.verdict === "ALLOW") {
        assert.notEqual(
          v.principal.authority,
          "FULL",
          `${c.desc}: unauthenticated must not get FULL`,
        );
      }
    }
  });

  it("always includes principal in verdict result", () => {
    const v = gate.evaluate({ tool_name: "forge_health_check", arguments: {} });
    assert.ok(v.principal, "principal must be present");
    assert.equal(typeof v.principal.source, "string");
    assert.equal(typeof v.principal.authenticated, "boolean");
    assert.equal(typeof v.principal.authority, "string");
    assert.ok(
      ["verified_session", "client_supplied", "transport_fallback"].includes(v.principal.source),
      `Invalid source: ${v.principal.source}`,
    );
  });
});

// ── Test 10: Display label never becomes actor ──
describe("Test 10 — display label integrity", () => {
  it("transport_fallback has actorId=null", () => {
    const v = gate.evaluate({ tool_name: "forge_fetch", arguments: {} });
    assert.equal(v.principal.actorId, null);
    assert.equal(v.principal.displayLabel, "stateless-client");
    // The label is for display, not identity
    assert.notEqual(v.principal.displayLabel, v.principal.actorId);
  });

  it("displayLabel matches actor_id for client_supplied", () => {
    const v = gate.evaluate({
      actor_id: "my-agent",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.principal.actorId, "my-agent");
    assert.equal(v.principal.displayLabel, "my-agent");
  });
});

// ── Test 11 (P0.6 FIX 2026-07-19): Unknown tool → HOLD for all paths ──
// Previously the UNKNOWN_TOOL check was inside the AAE-only branch.
// New behaviour: any unclassified tool is DENY/HOLD regardless of AAE.
describe("Test 11 — P0.6: Unknown tool forces HOLD for all paths", () => {
  it("unknown tool with transport_fallback + no AAE → DENY (P0.2 authority fires first)", () => {
    const v = gate.evaluate({
      tool_name: "forge_totally_made_up_tool",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
    // P0.2 now fires BEFORE P0.6 for unauthenticated actors.
    // OBSERVE_ONLY + IRREVERSIBLE tool → L1_AUTHORITY denial.
    assert.ok(
      v.reasons.some((r) => r.includes("L1_AUTHORITY")),
      `Expected L1_AUTHORITY, got: ${v.reasons.join(", ")}`,
    );
  });

  it("unknown tool with verified_session + no AAE → DENY with UNKNOWN_TOOL", () => {
    // P0.5: registerVerifiedSession now requires an ACT + organSecret for cryptographic verification.
    const secret = "test-organ-secret";
    const sct = buildACT("arif", "test-session-1", secret);
    const registered = gate.registerVerifiedSession("test-session-1", "arif", sct, secret);
    assert.equal(registered, true, "ACT-gated registration must succeed with valid token");
    const v = gate.evaluate({
      session_id: "test-session-1",
      tool_name: "arif_some_future_tool",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
    // Verified session passes P0.2; Layer 4b catches the unknown tool.
    assert.ok(
      v.reasons.some((r) => r.includes("UNKNOWN_TOOL")),
      `Verified sessions must hit Layer 4b UNKNOWN_TOOL, got: ${v.reasons.join(", ")}`,
    );
  });

  it("known tool still ALLOWs (regression check)", () => {
    gate.setActor("arif");
    const v = gate.evaluate({
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.verdict, "ALLOW", "Classified OBSERVE tools must still ALLOW");
  });

  it("empty string actor_id is treated as anonymous → DENY", () => {
    const v = gate.evaluate({
      actor_id: "",
      tool_name: "forge_health_check",
      arguments: {},
    });
    assert.equal(v.verdict, "DENY");
    assert.ok(
      v.reasons.some((r) => r.includes("empty_actor_id") || r.includes("anonymous")),
      `Expected empty/anonymous reason, got: ${v.reasons.join(", ")}`,
    );
  });
});

// ── Test 12 (P0.2 FIX 2026-07-19): authorityPermits() matrix ──
// Pure-function tests of the authority/action-class permission matrix.
// Extracted from inline Layer 1.5 check for testability.
describe("Test 12 — P0.2: authorityPermits() matrix", () => {
  it("OBSERVE_ONLY permits OBSERVE/SUGGEST/SIMULATE", () => {
    assert.equal(authorityPermits("OBSERVE_ONLY", "OBSERVE"), true);
    assert.equal(authorityPermits("OBSERVE_ONLY", "SUGGEST"), true);
    assert.equal(authorityPermits("OBSERVE_ONLY", "SIMULATE"), true);
  });

  it("OBSERVE_ONLY denies DRAFT/QUEUE/EXECUTE_REVERSIBLE/HIGH_IMPACT/IRREVERSIBLE", () => {
    assert.equal(authorityPermits("OBSERVE_ONLY", "DRAFT"), false);
    assert.equal(authorityPermits("OBSERVE_ONLY", "QUEUE"), false);
    assert.equal(authorityPermits("OBSERVE_ONLY", "EXECUTE_REVERSIBLE"), false);
    assert.equal(authorityPermits("OBSERVE_ONLY", "EXECUTE_HIGH_IMPACT"), false);
    assert.equal(authorityPermits("OBSERVE_ONLY", "IRREVERSIBLE"), false);
  });

  it("LIMITED_MUTATE permits OBSERVE/SUGGEST/SIMULATE/DRAFT/QUEUE/EXECUTE_REVERSIBLE", () => {
    for (const cls of ["OBSERVE", "SUGGEST", "SIMULATE", "DRAFT", "QUEUE", "EXECUTE_REVERSIBLE"] as const) {
      assert.equal(authorityPermits("LIMITED_MUTATE", cls), true, `LIMITED_MUTATE must permit ${cls}`);
    }
  });

  it("LIMITED_MUTATE denies EXECUTE_HIGH_IMPACT and IRREVERSIBLE", () => {
    assert.equal(authorityPermits("LIMITED_MUTATE", "EXECUTE_HIGH_IMPACT"), false);
    assert.equal(authorityPermits("LIMITED_MUTATE", "IRREVERSIBLE"), false);
  });

  it("FULL permits all 7 action classes", () => {
    for (const cls of [
      "OBSERVE", "SUGGEST", "SIMULATE", "DRAFT",
      "QUEUE", "EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE",
    ] as const) {
      assert.equal(authorityPermits("FULL", cls), true, `FULL must permit ${cls}`);
    }
  });
});
