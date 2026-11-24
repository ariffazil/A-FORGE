/**
 * EXECUTION GRANT DENIAL MATRIX
 * F13 ARIFOS::CONSEQUENCE_BOUND_CLOSURE::2026-11-24
 *
 * Every denied case must prove TWO things:
 *   1. consumeExecutionGrant returns valid === false
 *   2. world state did not change — for this surface that means NO claim
 *      marker was created in the grant ledger.
 *
 * An error message alone is not evidence. State equality is evidence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  consumeExecutionGrant,
  type ExecutionAuthorizationGrant,
  type ExecutionGrantExpectation,
} from "../src/domain/governance/governed-transition.js";

const BASE = "sha256:baseline-restate-8f5cf9c6";
const PROPOSAL = "sha256:proposal-abc";
const PLAN = "sha256:plan-abc";

function freshLedger(): string {
  return mkdtempSync(join(tmpdir(), "grant-ledger-"));
}

function makeGrant(
  overrides: Partial<ExecutionAuthorizationGrant> = {}
): ExecutionAuthorizationGrant {
  const now = Date.now();
  return {
    authorization_grant_id: overrides.authorization_grant_id ?? "grant-001",
    proposal_hash: overrides.proposal_hash ?? PROPOSAL,
    plan_hash: overrides.plan_hash ?? PLAN,
    session_id: overrides.session_id ?? "session_abc",
    actor_id: overrides.actor_id ?? "kimi-code/FI-008",
    executor_id: overrides.executor_id ?? "A-FORGE",
    allowed_operation: overrides.allowed_operation ?? "bridge_execution_grant",
    target_scope: overrides.target_scope ?? [
      "A-FORGE/src/domain/governance/governed-transition.ts",
    ],
    baseline_hash: overrides.baseline_hash ?? BASE,
    policy_version: overrides.policy_version ?? "arifos-constitution-v2026.05.05-SSCT",
    issued_at: overrides.issued_at ?? new Date(now - 60_000).toISOString(),
    expires_at: overrides.expires_at ?? new Date(now + 3_600_000).toISOString(),
    single_use: overrides.single_use ?? true,
    used_at: overrides.used_at ?? null,
    revoked_at: overrides.revoked_at ?? null,
    issuer: overrides.issuer ?? "F13",
  };
}

function makeExpectation(
  overrides: Partial<ExecutionGrantExpectation> = {}
): ExecutionGrantExpectation {
  return {
    proposal_hash: overrides.proposal_hash ?? PROPOSAL,
    plan_hash: overrides.plan_hash ?? PLAN,
    executor_id: overrides.executor_id ?? "A-FORGE",
    actor_id: overrides.actor_id ?? "kimi-code/FI-008",
    allowed_operation: overrides.allowed_operation ?? "bridge_execution_grant",
    baseline_hash: overrides.baseline_hash ?? BASE,
    target: overrides.target,
    at_time: overrides.at_time,
  };
}

/** Execute a denial case and assert zero world-state change. */
function assertDenied(
  label: string,
  grant: any,
  expected: ExecutionGrantExpectation,
  reasonPattern: RegExp
): void {
  const ledger = freshLedger();
  const before = readdirSync(ledger).sort();

  const result = consumeExecutionGrant(grant, expected, ledger);

  const after = readdirSync(ledger).sort();

  assert.equal(result.valid, false, `${label}: must be DENIED`);
  assert.match(
    String(result.reason),
    reasonPattern,
    `${label}: unexpected reason "${result.reason}"`
  );
  assert.deepEqual(
    after,
    before,
    `${label}: WORLD STATE CHANGED — claim marker written on a denial`
  );
}

// ── 1. missing grant ─────────────────────────────────────────────────────────
test("deny 01: missing grant", () => {
  assertDenied("missing grant", null, makeExpectation(), /grant_missing/);
});

// ── 2. expired grant ─────────────────────────────────────────────────────────
test("deny 02: expired grant", () => {
  const g = makeGrant({ expires_at: new Date(Date.now() - 3_600_000).toISOString() });
  assertDenied("expired", g, makeExpectation(), /grant_expired/);
});

// ── 3. replayed / already consumed grant ─────────────────────────────────────
test("deny 03: replayed (already consumed) grant", () => {
  const ledger = freshLedger();
  const g = makeGrant({ authorization_grant_id: "grant-replay" });
  const first = consumeExecutionGrant(g, makeExpectation(), ledger);
  assert.equal(first.valid, true, "first use must succeed");

  const before = readdirSync(ledger).sort();
  const second = consumeExecutionGrant(g, makeExpectation(), ledger);
  const after = readdirSync(ledger).sort();

  assert.equal(second.valid, false, "replay must be denied");
  assert.match(String(second.reason), /already_consumed|already_used/);
  assert.deepEqual(after, before, "replay must not alter world state");
});

// ── 4. wrong actor ───────────────────────────────────────────────────────────
test("deny 04: wrong actor", () => {
  assertDenied(
    "wrong actor",
    makeGrant({ actor_id: "intruder/XYZ" }),
    makeExpectation(),
    /actor_mismatch/
  );
});

// ── 5. wrong executor ────────────────────────────────────────────────────────
test("deny 05: wrong executor", () => {
  assertDenied(
    "wrong executor",
    makeGrant({ executor_id: "ROGUE-EXEC" }),
    makeExpectation(),
    /executor_mismatch/
  );
});

// ── 6. wrong operation ───────────────────────────────────────────────────────
test("deny 06: wrong operation", () => {
  assertDenied(
    "wrong operation",
    makeGrant({ allowed_operation: "deploy_release" }),
    makeExpectation(),
    /operation_mismatch/
  );
});

// ── 7. wrong target ──────────────────────────────────────────────────────────
test("deny 07: wrong target", () => {
  assertDenied(
    "wrong target",
    makeGrant({ target_scope: ["A-FORGE/other/file.ts"] }),
    makeExpectation({ target: "A-FORGE/src/domain/governance/governed-transition.ts" }),
    /target_scope_escape/
  );
});

// ── 8. wrong baseline hash ───────────────────────────────────────────────────
test("deny 08: wrong baseline hash", () => {
  assertDenied(
    "wrong baseline",
    makeGrant({ baseline_hash: "sha256:stale-baseline" }),
    makeExpectation(),
    /baseline_mismatch/
  );
});

// ── 9. wrong proposal hash ───────────────────────────────────────────────────
test("deny 09: wrong proposal hash", () => {
  assertDenied(
    "wrong proposal",
    makeGrant({ proposal_hash: "sha256:other-proposal" }),
    makeExpectation(),
    /proposal_hash_mismatch/
  );
});

// ── 10. wrong plan / payload hash ────────────────────────────────────────────
test("deny 10: wrong plan (payload) hash", () => {
  assertDenied(
    "wrong plan",
    makeGrant({ plan_hash: "sha256:tampered-payload" }),
    makeExpectation(),
    /plan_hash_mismatch/
  );
});

// ── 11. scope expansion ──────────────────────────────────────────────────────
test("deny 11: scope expansion beyond granted targets", () => {
  assertDenied(
    "scope expansion",
    makeGrant({ target_scope: ["A-FORGE/src/domain/governance/governed-transition.ts"] }),
    makeExpectation({ target: "A-FORGE/src/interfaces/mcp/core.ts" }),
    /target_scope_escape/
  );
});

// ── 12. revoked grant ────────────────────────────────────────────────────────
test("deny 12: revoked grant", () => {
  assertDenied(
    "revoked",
    makeGrant({ revoked_at: new Date().toISOString() }),
    makeExpectation(),
    /grant_revoked/
  );
});

// ── 13. HOLD presented as authorization ──────────────────────────────────────
test("deny 13: HOLD verdict presented as authorization", () => {
  assertDenied(
    "HOLD as auth",
    { verdict: "HOLD" },
    makeExpectation(),
    /grant_incomplete|grant_missing/
  );
});

// ── 14. PASS / resumed status presented as authorization ─────────────────────
test("deny 14: PASS/resumed status presented as authorization", () => {
  assertDenied(
    "resumed as auth",
    { status: "resumed", verdict: "PASS" },
    makeExpectation(),
    /grant_incomplete|grant_missing/
  );
});

// ── 15. plain chat approval without a bound grant ────────────────────────────
test("deny 15: plain chat approval without bound grant", () => {
  assertDenied(
    "chat approval as auth",
    "ok buatlah semua benda",
    makeExpectation(),
    /grant_missing_or_not_an_object|grant_incomplete/
  );
});

// ── 16. fabricated SEAL-prefixed session identifier ──────────────────────────
test("deny 16: fabricated SEAL-prefixed session id as authorization", () => {
  assertDenied(
    "fabricated SEAL session",
    { session_id: "SEAL-ffffffffffffffff", verdict: "SEAL" },
    makeExpectation(),
    /grant_incomplete|grant_missing/
  );
});

// ── 17. missing scope evidence ───────────────────────────────────────────────
test("deny 17: missing scope evidence (target_scope absent)", () => {
  const g: any = makeGrant();
  delete g.target_scope;
  assertDenied("missing target_scope", g, makeExpectation(), /grant_incomplete/);
});

// ── 18. missing replay evidence ──────────────────────────────────────────────
test("deny 18: missing replay evidence (expires_at absent)", () => {
  const g: any = makeGrant();
  delete g.expires_at;
  assertDenied("missing expires_at", g, makeExpectation(), /grant_incomplete/);
});

// ── 19. second execution using same grant (sequential) ───────────────────────
test("deny 19: second execution with consumed grant", () => {
  const ledger = freshLedger();
  const g = makeGrant({ authorization_grant_id: "grant-second-use" });
  assert.equal(consumeExecutionGrant(g, makeExpectation(), ledger).valid, true);
  const before = readdirSync(ledger).sort();
  const r = consumeExecutionGrant(g, makeExpectation(), ledger);
  assert.equal(r.valid, false);
  assert.deepEqual(readdirSync(ledger).sort(), before);
});

// ── AUTHORIZED LANE: executes exactly once ───────────────────────────────────
test("authorized lane: valid bound grant executes exactly once", () => {
  const ledger = freshLedger();
  const g = makeGrant({ authorization_grant_id: "grant-happy" });
  const exp = makeExpectation();

  const before = readdirSync(ledger).sort();
  assert.deepEqual(before, [], "ledger must start empty");

  const r1 = consumeExecutionGrant(g, exp, ledger);
  assert.equal(r1.valid, true, `first use must pass: ${r1.reason}`);

  const after = readdirSync(ledger);
  assert.equal(after.length, 1, "exactly one claim marker");
  assert.match(after[0], /grant-happy\.claimed$/);

  const r2 = consumeExecutionGrant(g, exp, ledger);
  assert.equal(r2.valid, false, "second use must be denied");
  assert.equal(readdirSync(ledger).length, 1, "no second marker");
});

// ── incomplete expectation is not permission ────────────────────────────────
test("deny: incomplete expectation fails closed", () => {
  const ledger = freshLedger();
  const exp = makeExpectation();
  (exp as any).baseline_hash = "";
  const r = consumeExecutionGrant(makeGrant(), exp, ledger);
  assert.equal(r.valid, false);
  assert.match(String(r.reason), /expectation_incomplete/);
  assert.deepEqual(readdirSync(ledger), []);
});

// ── durability: a pre-existing claim blocks even a fresh process view ────────
test("deny: durable marker blocks reuse across process restarts", () => {
  const ledger = freshLedger();
  const g = makeGrant({ authorization_grant_id: "grant-durable" });
  writeFileSync(join(ledger, "grant-durable.claimed"), '{"simulated_prior_claim":true}\n');

  const r = consumeExecutionGrant(g, makeExpectation(), ledger);
  assert.equal(r.valid, false);
  assert.match(String(r.reason), /already_consumed/);
});
