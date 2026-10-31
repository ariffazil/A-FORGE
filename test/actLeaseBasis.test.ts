/**
 * Lease authority basis — regression for the 2026-10-25 LEASE_CLASS_EXCEEDED.
 *
 * Measured defect: forge_session_init asked arifOS for a lease, but
 *   1. TOOL_NAME_MAP rewrote arif_lease_issue → arif_judge (a verdict, not a lease)
 *   2. the kernel does not expose lease issuance on its canonical surface
 *   3. the missing lease was discarded silently and the session reported OK
 * so every subsequent EXECUTE_REVERSIBLE write was refused with
 * LEASE_CLASS_EXCEEDED while the actor had already been verified by arif_init.
 *
 * These tests pin the two legal paths and the one illegal shortcut:
 *   - a lease derived from a kernel-signed ACT is honoured (source=kernel_act)
 *   - no lease at all still fails closed for non-OBSERVE
 *   - a lease below the requested class is refused
 * and the coercion that caused the defect cannot come back.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TOOL_NAME_MAP } from "../src/domain/types/mcp-bridge.js";
import {
  registerActLease,
  validateLeaseForTool,
  type LeaseRecord,
} from "../src/interfaces/mcp/forgeTools.js";

function actLease(overrides: Partial<LeaseRecord> = {}): LeaseRecord {
  const now = Date.now();
  return {
    lease_id: `ACT-test-${Math.random().toString(36).slice(2, 8)}`,
    agent_id: "333-AGI",
    scope: ["forge_filesystem", "forge_vault"],
    max_action_class: "EXECUTE_REVERSIBLE",
    ttl_seconds: 600,
    issued_at: now,
    expires_at: now + 600_000,
    forbidden: [],
    revoked: false,
    ...overrides,
  };
}

test("lease verbs are not rewritten to a verdict tool", () => {
  assert.equal(TOOL_NAME_MAP.arif_lease_issue, undefined);
  assert.equal(TOOL_NAME_MAP.arif_lease_inspect, undefined);
  assert.equal(TOOL_NAME_MAP.arif_lease_revoke, undefined);
});

test("a kernel-ACT-derived lease passes the LEASE layer (verdict loop stays separate)", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1"; // kernel unreachable → cache path
  const lease = registerActLease(actLease());
  assert.equal(lease.source, "kernel_act");
  const result = await validateLeaseForTool(lease.lease_id, "forge_vault", "EXECUTE_REVERSIBLE");
  // The lease must be honoured: refusal, if any, comes from the verdict loop —
  // never from LEASE_REQUIRED / LEASE_KERNEL_UNKNOWN / LEASE_CLASS_EXCEEDED.
  if (!result.ok) {
    assert.doesNotMatch(result.gate, /LEASE_REQUIRED|LEASE_KERNEL_UNKNOWN|LEASE_CLASS/);
    assert.match(result.gate, /VERDICT|RESTRAINT/);
  }
});

test("with a real verdict trace the same ACT lease authorises the action", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1";
  const lease = registerActLease(
    actLease({
      verdict_geometry: { trace_id: "trc-real-judge-seal" },
    }),
  );
  const result = await validateLeaseForTool(lease.lease_id, "forge_vault", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, true, result.ok ? "" : `${result.gate}: ${result.reason}`);
});

test("no lease still fails closed for non-OBSERVE", async () => {
  const result = await validateLeaseForTool(undefined, "forge_vault", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.gate, "LEASE_REQUIRED");
});

test("an EXECUTE_REVERSIBLE lease cannot authorise IRREVERSIBLE", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1";
  const lease = registerActLease(actLease());
  const result = await validateLeaseForTool(lease.lease_id, "forge_vault", "IRREVERSIBLE");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.gate, /CLASS|RESTRAINT|888|IRREVERSIBLE|LEASE/);
});

test("an ACT lease outside its scope is refused", async () => {
  process.env.ARIFOS_MCP_URL = "http://127.0.0.1:1";
  const lease = registerActLease(actLease({ scope: ["forge_filesystem"] }));
  const result = await validateLeaseForTool(lease.lease_id, "forge_shell", "EXECUTE_REVERSIBLE");
  assert.equal(result.ok, false);
});
