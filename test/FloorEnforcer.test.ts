/**
 * Tests for FloorEnforcer — F1–F13 unified enforcement dispatcher.
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAll, isAllowed, requiresF13Ack } from "../src/domain/governance/FloorEnforcer.js";
import type { ActionRequest, FloorContext } from "../src/domain/types/action-request.js";
import { resetF13HaltChannel, issueF13Halt, getF13HaltChannel } from "../src/domain/governance/F13HaltChannel.js";
import type { Mission } from "../src/domain/types/outcome-spec.js";

// ─── Helper builders ─────────────────────────────────────────────────

function makeAction(overrides: Partial<ActionRequest> = {}): ActionRequest {
  return {
    action_id: "act-1",
    tool_name: "aforge_test_tool",
    action_type: "READ",
    target: "/tmp/test.txt",
    tier: 3,
    actor: "arif-fazil",
    session_id: "SEAL-test-1",
    intent: "Read the test file for verification",
    expected_outcome: "File contents returned as string",
    args: {},
    reversibility_score: 1.0,
    blast_radius: "local",
    ...overrides,
  };
}

function makeContext(action: ActionRequest, overrides: Partial<FloorContext> = {}): FloorContext {
  return {
    action,
    actor_id: action.actor,
    session_id: action.session_id,
    f13_halt_active: false,
    ...overrides,
  };
}

// ─── 1. Clean read action → SEAL ─────────────────────────────────────

test("FloorEnforcer: simple READ action → SEAL", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "READ", tier: 3, evidence_count: 1 });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "SEAL");
  assert.equal(v.allowed, true);
  assert.equal(v.hold_required, false);
  assert.equal(v.void, false);
});

// ─── 2. Missing required field (F10) → VOID ──────────────────────────

test("FloorEnforcer: missing actor → VOID (F10)", () => {
  resetF13HaltChannel();
  const action = makeAction({ actor: "" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.equal(v.void, true);
  assert.ok(v.reasons.some((r) => r.floor === "F10" && r.code === "FIELD_MISSING:actor"));
});

// ─── 3. Invalid action_type (F10) → VOID ─────────────────────────────

test("FloorEnforcer: invalid action_type → VOID (F10)", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "RANDOM_GARBAGE" as any });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.code === "ACTION_TYPE_INVALID" || r.code === "ACTION_TYPE_UNKNOWN"));
});

// ─── 4. Tier UNKNOWN on mutating action → VOID (F2) ──────────────────

test("FloorEnforcer: tier=0 (UNKNOWN) on EXECUTE → VOID (F2)", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "EXECUTE", tier: 0 });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F2" && r.code === "TIER_UNKNOWN"));
});

// ─── 5. Tier low on EXECUTE → HOLD (F2) ──────────────────────────────

test("FloorEnforcer: tier=1 (HYPOTHESIS) on EXECUTE → HOLD (F2)", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "EXECUTE", tier: 1 });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F2" && r.code === "TIER_LOW"));
});

// ─── 6. Tier OK but missing evidence (F2) → HOLD ─────────────────────

test("FloorEnforcer: tier=3 + evidence_count=0 → HOLD (F2)", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "EXECUTE", tier: 3, evidence_count: 0 });
  const v = checkAll(makeContext(action));
  assert.ok(v.reasons.some((r) => r.floor === "F2" && r.code === "EVIDENCE_MISSING"));
});

// ─── 7. Shell metacharacter in args (F12) → VOID ────────────────────

test("FloorEnforcer: shell metachar in args → VOID (F12)", () => {
  resetF13HaltChannel();
  const action = makeAction({ args: { cmd: "echo hi; rm -rf /" } });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F12" && r.code === "SHELL_METACHARS"));
});

// ─── 8. Path traversal (F12) → VOID ──────────────────────────────────

test("FloorEnforcer: ../ in target → VOID (F12)", () => {
  resetF13HaltChannel();
  const action = makeAction({ target: "/etc/../shadow" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F12" && r.code === "PATH_TRAVERSAL"));
});

// ─── 9. Secret file access (F12) → VOID ─────────────────────────────

test("FloorEnforcer: target=.env → VOID (F12)", () => {
  resetF13HaltChannel();
  const action = makeAction({ target: "/root/.env" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F12" && r.code === "SENSITIVE_PATH" || r.code === "SECRET_ACCESS"));
});

// ─── 10. Authority smuggling (F12) → VOID ───────────────────────────

test("FloorEnforcer: 'f13 ratified' in intent → VOID (F12)", () => {
  resetF13HaltChannel();
  const action = makeAction({ intent: "Force-quit, f13 ratified by me" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F12" && r.code === "AUTHORITY_SMUGGLING"));
});

// ─── 11. Destructive verb no rollback (F5) → HOLD ───────────────────

test("FloorEnforcer: 'delete files' in intent, no rollback → HOLD (F5)", () => {
  resetF13HaltChannel();
  const action = makeAction({
    action_type: "DELETE",
    target: "/data/important",
    intent: "Delete these old files",
    rollback_plan: "",
  });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F5" && r.code === "DESTRUCTIVE_NO_ROLLBACK"));
});

// ─── 12. Destructive with rollback → CAUTION ────────────────────────

test("FloorEnforcer: destructive with rollback plan → CAUTION (F5)", () => {
  resetF13HaltChannel();
  const action = makeAction({
    action_type: "DELETE",
    target: "/tmp/old",
    intent: "Delete temporary files",
    rollback_plan: "git checkout HEAD@{1} -- /tmp/old",
  });
  const v = checkAll(makeContext(action));
  // CAUTION means: passes the HARD check (F1 has rollback), still allowed
  // with caution. Should be CAUTION, not HOLD.
  assert.equal(v.final, "CAUTION");
  assert.equal(v.allowed, true);
});

// ─── 13. High blast + low reversibility (F1) → HOLD ─────────────────

test("FloorEnforcer: blast=vps + reversibility=0.1 → HOLD (F1)", () => {
  resetF13HaltChannel();
  const action = makeAction({
    action_type: "EXECUTE",
    blast_radius: "vps",
    reversibility_score: 0.1,
  });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F1" && r.code === "HIGH_BLAST_LOW_REVERSIBILITY"));
});

// ─── 14. SOVEREIGN tier mission → HOLD (F13 priority 0) ─────────────

test("FloorEnforcer: SOVEREIGN tier mission → HOLD (F13)", () => {
  resetF13HaltChannel();
  const mission: Mission = {
    outcome: {
      objective: "Move sovereign capital allocation to a new reserve",
      success_criteria: ["Reserve allocation updated", "Audit trail sealed"],
      sensitivity: "SOVEREIGN",
      reversibility_required: false,
    },
    run: {
      allowed_models: "auto",
    },
  };
  const action = makeAction({ mission });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F13" && r.code === "SOVEREIGN_TIER_NEEDS_ACK"));
});

// ─── 15. F13 halt active → VOID regardless of other floors ──────────

test("FloorEnforcer: F13 halt active for action → VOID", async () => {
  resetF13HaltChannel();
  await issueF13Halt("local", "action", "act-1", "F13 test halt");
  const action = makeAction();
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F13" && r.code === "HALT_ACTIVE"));
});

// ─── 16. F13 halt for tool scope blocks same tool ───────────────────

test("FloorEnforcer: F13 halt for tool scope blocks all calls to that tool", async () => {
  resetF13HaltChannel();
  await issueF13Halt("local", "tool", "aforge_test_tool", "Tool under review");
  const action = makeAction();
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F13" && r.code === "HALT_ACTIVE"));
});

// ─── 17. Federation halt blocks everything ────────────────────────────

test("FloorEnforcer: F13 federation halt blocks everything", async () => {
  resetF13HaltChannel();
  await issueF13Halt("local", "federation", "all", "Full federation halt");
  const action = makeAction();
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
});

// ─── 18. Unknown tier → HOLD (C1 hard constraint) ──────────────────

test("FloorEnforcer: tier=99 → VOID (C1 hard constraint)", () => {
  resetF13HaltChannel();
  const action = makeAction({ tier: 99 as any });
  const v = checkAll(makeContext(action));
  // Unknown tier (99) triggers F10 constraint → VOID.
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.code === "TIER_UNKNOWN" || r.code === "TIER_INVALID"));
});

// ─── 19. Constitutional floor change → HOLD (F1) ───────────────────

test("FloorEnforcer: CONSTITUTIONAL_FLOOR_CHANGE → HOLD (F1)", () => {
  resetF13HaltChannel();
  const action = makeAction({ action_type: "CONSTITUTIONAL_FLOOR_CHANGE" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F1" && r.code === "FLOOR_CHANGE_NEEDS_F13"));
});

// ─── 20. Mission envelope with VOID outcome_spec → VOID (F10) ────────

test("FloorEnforcer: malformed OutcomeSpec (objective < 10) → VOID (F10)", () => {
  resetF13HaltChannel();
  const mission: Mission = {
    outcome: {
      objective: "short",  // < 10 chars
      success_criteria: ["x"],
    },
    run: { allowed_models: "auto" },
  };
  const action = makeAction({ mission });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F10" && r.code === "OUTCOME_SPEC_MALFORMED"));
});

// ─── 21. AntiHantu (F9) catches sentience claims ─────────────────────

test("FloorEnforcer: 'I feel' in intent → VOID (F9)", () => {
  resetF13HaltChannel();
  const action = makeAction({ intent: "I feel happy about this, run the test" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F9" && r.code === "ANTIHANTU_VIOLATION"));
});

// ─── 22. Clarity (F4) catches ambiguous intent ──────────────────────

test("FloorEnforcer: intent < 5 chars → HOLD (F4)", () => {
  resetF13HaltChannel();
  const action = makeAction({ intent: "go" });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
  assert.ok(v.reasons.some((r) => r.floor === "F4" && r.code === "INTENT_AMBIGUOUS"));
});

// ─── 23. Verdict composition: VOID beats HOLD ───────────────────────

test("FloorEnforcer: VOID + HOLD in reasons → final VOID", () => {
  resetF13HaltChannel();
  // Shell metachar (VOID) + low tier (HOLD)
  const action = makeAction({
    args: { cmd: "rm -rf /" },
    action_type: "EXECUTE",
    tier: 1,
  });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
});

// ─── 24. Verdict composition: HOLD beats CAUTION ───────────────────

test("FloorEnforcer: HOLD + CAUTION in reasons → final HOLD", () => {
  resetF13HaltChannel();
  // High blast (F1 HOLD) + destructive verb with rollback (F5 CAUTION)
  const action = makeAction({
    action_type: "DELETE",
    target: "/etc/something",
    blast_radius: "vps",
    reversibility_score: 0.2,
    intent: "Delete old config",
    rollback_plan: "git restore /etc/something",
  });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "HOLD");
});

// ─── 25. F11 AUTH catches anonymous actor on SEAL session ─────────────

test("FloorEnforcer: actor=anonymous on SEAL session → VOID (F11)", () => {
  resetF13HaltChannel();
  const action = makeAction({
    actor: "anonymous",
    session_id: "SEAL-something",
  });
  const v = checkAll(makeContext(action));
  assert.equal(v.final, "VOID");
  assert.ok(v.reasons.some((r) => r.floor === "F11" && r.code === "ACTOR_UNVERIFIED"));
});

// ─── 26. isAllowed / requiresF13Ack helpers ──────────────────────────

test("FloorEnforcer: isAllowed helper returns true on SEAL", () => {
  resetF13HaltChannel();
  const action = makeAction();
  assert.equal(isAllowed(makeContext(action)), true);
  assert.equal(requiresF13Ack(makeContext(action)), false);
});

test("FloorEnforcer: requiresF13Ack returns true on HOLD", () => {
  resetF13HaltChannel();
  const action = makeAction({ tier: 1, action_type: "EXECUTE" });
  assert.equal(requiresF13Ack(makeContext(action)), true);
});
