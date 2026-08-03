/**
 * p0Gates.test.ts — Unit tests for the P0 Deterministic Pre-Execution Gates.
 *
 * Tests all 5 gates: lease_validity, reversibility_check, identity_immutable,
 * observe_before_mutate, blast_radius_bound.
 *
 * Also tests the runner (runP0Gates) for ordering, rejection, and passthrough.
 *
 * Based on Reddy et al. (2026) arXiv:2607.07405
 *
 * @module test/p0Gates
 * @forged 2026-08-03 by 333-AGI
 *
 * DITEMPA BUKAN DIBERI
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  leaseValidityGate,
  reversibilityGate,
  identityImmutableGate,
  observeBeforeMutateGate,
  blastRadiusGate,
  P0_GATES,
} from "../domain/governance/p0-gates/gates.js";
import { runP0Gates } from "../domain/governance/p0-gates/runner.js";
import type { DBSnapshot, LeaseState } from "../domain/governance/p0-gates/types.js";

// ── Test fixtures ──────────────────────────────────────────────────────

const VALID_LEASE: LeaseState = {
  valid: true,
  expired: false,
  maxActionClass: "EXECUTE",
  actorId: "333-AGI",
  sessionId: "SEAL-test123",
};

const DEFAULT_DB: DBSnapshot = {
  session: {
    actorId: "333-AGI",
    sessionId: "SEAL-test123",
    leaseExpiry: null,
    maxActionClass: "EXECUTE",
  },
  filesystem: {
    targetPath: "/root/test.txt",
    exists: true,
    isDirectory: false,
    size: 1024,
  },
  preReadPerformed: true,
};

const EMPTY_ARGS: Record<string, unknown> = {};

// ── Gate 1: lease_validity ────────────────────────────────────────────

describe("lease_validity gate", () => {
  test("allows valid lease", () => {
    const result = leaseValidityGate("forge_shell", EMPTY_ARGS, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
    assert.equal(result.gateId, "lease_validity");
  });

  test("rejects invalid lease", () => {
    const invalidLease: LeaseState = { ...VALID_LEASE, valid: false };
    const result = leaseValidityGate("forge_shell", EMPTY_ARGS, DEFAULT_DB, invalidLease);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /No valid lease/);
  });

  test("rejects expired lease", () => {
    const expiredLease: LeaseState = { ...VALID_LEASE, expired: true };
    const result = leaseValidityGate("forge_shell", EMPTY_ARGS, DEFAULT_DB, expiredLease);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Lease expired/);
  });

  test("rejects actor mismatch", () => {
    const mismatchedDb: DBSnapshot = {
      ...DEFAULT_DB,
      session: { ...DEFAULT_DB.session, actorId: "different-actor" },
    };
    const result = leaseValidityGate("forge_shell", EMPTY_ARGS, mismatchedDb, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Lease actor mismatch/);
  });
});

// ── Gate 2: reversibility_check ──────────────────────────────────────

describe("reversibility_check gate", () => {
  test("allows reversible tool", () => {
    const result = reversibilityGate("forge_observe", EMPTY_ARGS, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("rejects irreversible tool without ack", () => {
    const result = reversibilityGate("forge_shell", {}, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /ack_irreversible/);
  });

  test("allows irreversible tool with ack_irreversible=true", () => {
    const result = reversibilityGate("forge_shell", { ack_irreversible: true }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("allows irreversible tool with ack_irreversible='true'", () => {
    const result = reversibilityGate("forge_vault", { ack_irreversible: "true" }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("rejects forge_seal without ack", () => {
    const result = reversibilityGate("forge_seal", {}, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /ack_irreversible/);
  });

  test("rejects delete mode without ack (caught by general irreversibility)", () => {
    const result = reversibilityGate("forge_filesystem", { mode: "delete" }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    // forged_filesystem matches irreversibleTools FIRST before delete check
    assert.match(result.reason!, /ack_irreversible/);
  });

  test("rejects permanent delete without ack (caught by general irreversibility)", () => {
    const result = reversibilityGate("forge_filesystem", { delete_mode: "permanent" }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /ack_irreversible/);
  });

  test("specifically catches delete mode when tool is not in irreversible list", () => {
    // A non-irreversible tool in delete mode still gets caught
    const result = reversibilityGate("forge_unknown_tool", { mode: "delete" }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Delete mode requires/);
  });

  test("allows delete with ack", () => {
    const result = reversibilityGate("forge_filesystem", { mode: "delete", ack_irreversible: true }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
  });
});

// ── Gate 3: identity_immutable ────────────────────────────────────────

describe("identity_immutable gate", () => {
  test("rejects when no SCT token provided", () => {
    const result = identityImmutableGate("forge_shell", {}, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /No valid session token/);
  });

  test("allows with valid SCT token", () => {
    const result = identityImmutableGate(
      "forge_shell",
      { session_token: "sct_v1.eyJhY3RvciI6IjMzMy1BR0ki", actor_id: "333-AGI" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, true);
  });

  test("rejects actor_id mismatch with lease", () => {
    const result = identityImmutableGate(
      "forge_shell",
      { session_token: "sct_v1.test123", actor_id: "impostor-agent" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Actor identity mismatch/);
  });

  test("rejects session_id mismatch with lease", () => {
    const result = identityImmutableGate(
      "forge_shell",
      { session_token: "sct_v1.test", session_id: "different-session" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Session mismatch/);
  });

  test("accepts sct alias field", () => {
    const result = identityImmutableGate(
      "forge_shell",
      { sct: "sct_v1.eyJhY3RvciI6IjMzMy1BR0ki", actor_id: "333-AGI" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, true);
  });

  test("rejects empty SCT", () => {
    const result = identityImmutableGate(
      "forge_shell",
      { session_token: "", actor_id: "333-AGI" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
  });
});

// ── Gate 4: observe_before_mutate ─────────────────────────────────────

describe("observe_before_mutate gate", () => {
  test("allows when preRead performed", () => {
    const result = observeBeforeMutateGate("forge_filesystem", { mode: "write" }, DEFAULT_DB, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("allows when file exist (evidence of prior read)", () => {
    const db: DBSnapshot = {
      ...DEFAULT_DB,
      preReadPerformed: false,
      filesystem: { ...DEFAULT_DB.filesystem, exists: true },
    };
    const result = observeBeforeMutateGate("forge_shell", { command: "rm test.txt" }, db, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("rejects write without prior observation", () => {
    const db: DBSnapshot = {
      ...DEFAULT_DB,
      preReadPerformed: false,
      filesystem: { ...DEFAULT_DB.filesystem, targetPath: "/root/new_file.txt", exists: false },
    };
    const result = observeBeforeMutateGate("forge_filesystem", { mode: "write" }, db, VALID_LEASE);
    assert.equal(result.allow, false);
    assert.match(result.reason!, /Must read before write/);
  });

  test("skips for non-write tools", () => {
    const db: DBSnapshot = {
      ...DEFAULT_DB,
      preReadPerformed: false,
    };
    const result = observeBeforeMutateGate("forge_observe", { mode: "read" }, db, VALID_LEASE);
    assert.equal(result.allow, true);
  });

  test("rejects forge_execute without prior observation", () => {
    const db: DBSnapshot = {
      ...DEFAULT_DB,
      preReadPerformed: false,
      filesystem: { ...DEFAULT_DB.filesystem, targetPath: "/root/deploy.sh", exists: false },
    };
    const result = observeBeforeMutateGate("forge_execute", { task: "deploy" }, db, VALID_LEASE);
    assert.equal(result.allow, false);
  });

  test("rejects forge_git commit without prior observation", () => {
    const db: DBSnapshot = {
      ...DEFAULT_DB,
      preReadPerformed: false,
      filesystem: { ...DEFAULT_DB.filesystem, exists: false },
    };
    const result = observeBeforeMutateGate("forge_git", { mode: "commit" }, db, VALID_LEASE);
    assert.equal(result.allow, false);
  });
});

// ── Gate 5: blast_radius_bound ───────────────────────────────────────

describe("blast_radius_bound gate", () => {
  test("allows low blast radius (tmp path)", () => {
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/tmp/test.txt" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, true);
  });

  test("allows moderate blast radius (root path) with EXECUTE lease", () => {
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/root/somefile.txt" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, true);
  });

  test("rejects arifOS path for EXECUTE lease (br=3 > max 3... wait, 3 <= 3)", () => {
    // arifOS has br=3 and EXECUTE allows 3, so it should pass
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/root/arifOS/something.py" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, true);
  });

  test("rejects VAULT999 path for EXECUTE lease (br=5 > max 3)", () => {
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/root/VAULT999/outcomes.jsonl" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
    assert.match(result.reason!, /blast radius/);
  });

  test("rejects /etc modification for EXECUTE lease (br=5 > max 3)", () => {
    // blast_radius uses path arg, not command. /etc → br=5 > EXECUTE max 3
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/etc/hosts" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
  });

  test("rejects rm -rf (br=5 > max 3)", () => {
    const result = blastRadiusGate(
      "forge_shell",
      { command: "rm -rf /some/dir" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
  });

  test("rejects rm -rf even with SEAL lease (br=5 > max 4)", () => {
    const sealLease: LeaseState = { ...VALID_LEASE, maxActionClass: "SEAL" };
    const result = blastRadiusGate(
      "forge_shell",
      { command: "rm -rf /some/dir", ack_irreversible: true },
      DEFAULT_DB,
      sealLease,
    );
    assert.equal(result.allow, false);
    assert.match(result.reason!, /blast radius/);
  });

  test("rejects DROP command", () => {
    const result = blastRadiusGate(
      "forge_shell",
      { command: "DROP TABLE users" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
  });

  test("rejects git push --force for EXECUTE lease", () => {
    const result = blastRadiusGate(
      "forge_shell",
      { command: "git push --force origin main" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.allow, false);
  });

  test("restricts OBSERVE_ONLY to blast radius 0", () => {
    const observeLease: LeaseState = { ...VALID_LEASE, maxActionClass: "OBSERVE_ONLY" };
    const result = blastRadiusGate(
      "forge_filesystem",
      { path: "/tmp/test.txt" },
      DEFAULT_DB,
      observeLease,
    );
    assert.equal(result.allow, false);
  });
});

// ── Runner: runP0Gates ────────────────────────────────────────────────

describe("P0 gate runner", () => {
  test("passes all 5 gates with valid state", () => {
    const result = runP0Gates(
      P0_GATES,
      "forge_filesystem",
      {
        path: "/tmp/test.txt",
        mode: "read",
        ack_irreversible: true,  // forge_filesystem is irreversible-class
        session_token: "sct_v1.test",
        actor_id: "333-AGI",
        session_id: "SEAL-test123",
      },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.passed, true);
    assert.equal(result.blockingGate, null);
    assert.ok(result.evaluations.length > 0);
    assert.ok(result.latencyMs >= 0);
  });

  test("first rejecting gate wins (lease_validity blocks before others)", () => {
    const invalidLease: LeaseState = { ...VALID_LEASE, valid: false };
    const result = runP0Gates(
      P0_GATES,
      "forge_shell",
      { command: "rm -rf /", session_token: "sct_v1.test" },
      DEFAULT_DB,
      invalidLease,
    );
    assert.equal(result.passed, false);
    assert.equal(result.blockingGate?.gateId, "lease_validity");
    // identity_immutable should NOT have evaluated (early exit)
    const identityEval = result.evaluations.find((e) => e.gateId === "identity_immutable");
    assert.equal(identityEval, undefined);
  });

  test("reversibility gates before observe (ordering)", () => {
    const result = runP0Gates(
      P0_GATES,
      "forge_shell",
      { command: "rm test.txt", session_token: "sct_v1.test", actor_id: "333-AGI" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    // reversibility_check should be first to fire after lease_validity passes
    assert.equal(result.passed, false);
    assert.equal(result.blockingGate?.gateId, "reversibility_check");
  });

  test("skips observe_before_mutate for non-targeted tools", () => {
    const result = runP0Gates(
      P0_GATES,
      "forge_health_check", // not in observe_before_mutate targeting
      { session_token: "sct_v1.test" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.equal(result.passed, true);
    // observe_before_mutate should not have evaluated
    const obsEval = result.evaluations.find((e) => e.gateId === "observe_before_mutate");
    assert.equal(obsEval, undefined);
  });

  test("returns latency in ms", () => {
    const result = runP0Gates(
      P0_GATES,
      "forge_filesystem",
      { mode: "read", path: "/tmp/x", session_token: "sct_v1.test", actor_id: "333-AGI" },
      DEFAULT_DB,
      VALID_LEASE,
    );
    assert.ok(result.latencyMs < 100, `latency ${result.latencyMs}ms should be < 100ms`);
  });
});

// ── Registry: P0_GATES ────────────────────────────────────────────────

describe("P0_GATES registry", () => {
  test("contains all 5 gates", () => {
    assert.equal(P0_GATES.length, 5);
  });

  test("gates are sorted by priority", () => {
    for (let i = 1; i < P0_GATES.length; i++) {
      assert.ok(
        P0_GATES[i].priority >= P0_GATES[i - 1].priority,
        `gate ${P0_GATES[i].id} (${P0_GATES[i].priority}) should not be before ${P0_GATES[i - 1].id} (${P0_GATES[i - 1].priority})`,
      );
    }
  });

  test("each gate has required registration fields", () => {
    for (const gate of P0_GATES) {
      assert.ok(gate.id, `gate missing id`);
      assert.ok(typeof gate.priority === "number", `gate ${gate.id} missing priority`);
      assert.ok(gate.predicate, `gate ${gate.id} missing predicate`);
      assert.ok(gate.floor, `gate ${gate.id} missing floor`);
    }
  });

  test("no duplicate gate IDs", () => {
    const ids = P0_GATES.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate gate IDs: ${ids}`);
  });
});
