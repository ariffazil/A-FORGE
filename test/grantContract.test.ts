/**
 * grantContract.test.ts — F13 ORDER 2026-11-01 "CONTRACT TEST FIRST, THEN T2"
 *
 * Authority: test construction + local test execution only. No deployment,
 * no service restart, no production mutation, no VAULT999 seal.
 *
 * AXIS DISCIPLINE (namespace-fatwa-k1.md §The Law — five coordinates):
 *   STAGE ABI  555 stage      = arif_memory        (kernel verb stage)
 *   LANE/TIER  555-ASI lane   = VERIFY             (constitutional role)
 *   STAGE ABI  666 stage      = judge              (kernel verb stage)
 *   LANE/TIER  888-APEX       = JUDGE              (constitutional role)
 * Nothing in this file renames, collapses, deprecates or reinterprets either
 * axis. Every "555" below appears with its coordinate marker; stage 555 and
 * lane 555-ASI are deliberately asserted to be distinct.
 *
 * These tests encode the REQUIREMENT, not the current behaviour. A requirement
 * that the implementation does not enforce MUST fail here — that failure is the
 * finding, and it is preserved by stopping before any T2 mutation.
 *
 * Group D and E additionally PING the already-passing regression tests that
 * carry the same guarantee (elicitationTrustVerification S1c,
 * actLeaseScope 06/07) instead of duplicating their bodies; each group states
 * which existing file/test is being reused.
 *
 * Run: npx tsc -p tsconfig.json && node --test dist/test/grantContract.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";

import { isExternalClient } from "../src/interfaces/mcp/policyTools.js";
import { resolveActLeaseScope, DEFAULT_LEASE_SCOPE } from "../src/interfaces/mcp/actLeaseScope.js";
import {
  registerTool,
  forgeExecute,
  validateReceipt,
  listUnknownOutcomes,
  clearUnknownOutcomes,
  clearReceiptLedger,
  getReceiptRecord,
  receiptState,
  listReceiptRecords,
  type ExecutorReceipt,
} from "../src/executor/index.js";

// ── Constants ────────────────────────────────────────────────────────────

const SECRET = "grant-contract-secret-0123456789ab";
const NOW_S = () => Math.floor(Date.now() / 1000);

// ── Helpers ──────────────────────────────────────────────────────────────

function mintAct(claims: Record<string, unknown>, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload, "ascii").digest("hex").slice(0, 16);
  return `act_v1.${payload}.${sig}`;
}

/** Stable stringify (sorted keys) — mirrors the executor's own canonicalisation. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

function paramsHash(params: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(params)).digest("hex");
}

/** A structurally valid receipt. Overrides let each test vary exactly one thing. */
function makeReceipt(over: Partial<ExecutorReceipt> = {}): ExecutorReceipt {
  const base: ExecutorReceipt = {
    receiptId: `RC-${Math.random().toString(16).slice(2, 10)}`,
    kernelSignature: "sha256:contract-test-kernel-signature",
    verdict: "SEAL",
    ccId: "CC-CONTRACT-TEST",
    judgment_reference: "judgment-contract-test-0001",
    allowedActions: ["probe_target_a"],
    toolName: "probe_target_a",
    inputHash: paramsHash({ command: "write-A" }),
    bounds: {
      reversible: true,
      blastRadius: "LOW",
      maxTools: 1,
      timeoutMs: 5000,
    },
    authority: {
      actorId: "arif",
      sessionId: "SEAL-contract0001",
      validUntil: new Date(Date.now() + 3600_000).toISOString(),
      scope: "MUTATE",
    },
    lineage: {
      evidenceIds: ["EV-CONTRACT-0001"],
      collapseTimestamp: new Date().toISOString(),
    },
  };
  return { ...base, ...over };
}

/**
 * Registers an instrumented probe tool. Returns a readable ledger so a test can
 * distinguish the four states the contract requires kept apart:
 *   invokedRequests   — the executor dispatched us (request reached the boundary)
 *   completed         — our body ran to completion
 *   worldMutations    — an observable state change was applied
 *   receiptsDelivered — an ActionResult came back to the caller
 * The caller/console observes `receiptsDelivered` indirectly (report.results).
 */
function probeTool(name: string, opts: { delayMs?: number } = {}) {
  const ledger = { invokedRequests: 0, completed: 0, worldMutations: 0, lastParams: null as unknown };
  registerTool({
    name,
    domain: "contract-test",
    execute: async (params: Record<string, unknown>) => {
      ledger.invokedRequests += 1;
      ledger.lastParams = params;
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      ledger.completed += 1;
      ledger.worldMutations += 1;
      return { ok: true, applied: params };
    },
  });
  return ledger;
}

/** Two distinct targets, both registered, both mutating. */
function registerTargets() {
  const a = probeTool("probe_target_a");
  const b = probeTool("probe_target_b");
  const shell = probeTool("probe_shell"); // one tool, target chosen by a param
  return { a, b, shell };
}

// ═════════════════════════════════════════════════════════════════════════
// A. EXPIRED_GRANT_REJECTED
// ═════════════════════════════════════════════════════════════════════════

test("A1 ACT expiry: an expired ACT is denied with a reason tied to expiry", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const expired = mintAct({
    actor: "F13",
    sid: "SEAL-A1expired0001",
    auth: "MUTATE",
    exp: 1, // evaluated long before now
  });
  const r = isExternalClient({ actor_id: "F13", act: expired });
  assert.equal(r.external, true, "an expired ACT must not be treated as trusted");
  assert.match(
    r.reason ?? "",
    /expire|exp\b|stale/i,
    `rejection reason must name expiry, got: ${r.reason ?? "<none>"}`,
  );
});

test("A1 POSITIVE CONTROL: same claims, unexpired, are trusted", () => {
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const live = mintAct({
    actor: "F13",
    sid: "SEAL-A1control0001",
    auth: "MUTATE",
    exp: NOW_S() + 3600,
  });
  const r = isExternalClient({ actor_id: "F13", act: live });
  assert.equal(r.external, false, `unexpired ACT must pass: ${r.reason ?? ""}`);
});

test("A2 receipt lease expiry: refused before dispatch, zero executor invocations", async () => {
  const { a } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    authority: {
      actorId: "arif",
      sessionId: "SEAL-A2expired0001",
      validUntil: new Date(Date.now() - 60_000).toISOString(), // lease already expired
      scope: "MUTATE",
    },
  });

  const validation = validateReceipt(receipt);
  assert.equal(validation.valid, false, "expired lease must fail receipt validation");
  assert.ok(
    validation.violations.some((v) => /lease expired/i.test(v)),
    `violations must name lease expiry, got: ${JSON.stringify(validation.violations)}`,
  );

  const report = await forgeExecute(receipt, { probe_target_a: { command: "write-A" } });

  assert.equal(report.summary.verdict, "REFUSED", "expired lease must produce REFUSED");
  assert.equal(report.summary.outcome_class, "DENIED", "no side effect may be claimed");
  assert.equal(report.results.length, 0, "no ActionResult may be emitted (no mutation receipt)");
  assert.equal(a.invokedRequests, 0, "the executor must never be invoked under an expired lease");
  assert.equal(a.worldMutations, 0, "no world-state mutation may occur");
  assert.ok(
    (report.refusalReasons ?? []).some((v) => /lease expired/i.test(v)),
    "the refusal must carry the expiry reason back to the caller",
  );
});

// ═════════════════════════════════════════════════════════════════════════
// B. TARGET_SUBSTITUTION_REJECTED
// ═════════════════════════════════════════════════════════════════════════

test("B1 tool-level substitution: a grant for target A never dispatches target B", async () => {
  const { a, b } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    inputHash: paramsHash({ command: "write-A" }),
  });

  // Caller tries to steer execution to B by supplying B's params, and by also
  // supplying B in the params map under its own key.
  const report = await forgeExecute(receipt, {
    probe_target_a: { command: "write-A" },
    probe_target_b: { command: "write-B" },
  });

  assert.equal(b.invokedRequests, 0, "target B must never be dispatched by an A-bound grant");
  assert.equal(b.worldMutations, 0, "no mutation may occur against B");
  assert.equal(a.worldMutations, 1, "the authorized target still executes exactly once");
  assert.equal(report.results.length, 1, "exactly one action result");
  assert.equal(report.results[0].tool, "probe_target_a", "no silent target normalisation");
});

test("B1b toolName outside allowedActions is refused (no widening by renaming)", async () => {
  const { a, b } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_b", // caller rewrote the primary tool
    allowedActions: ["probe_target_a"],
  });

  const validation = validateReceipt(receipt);
  assert.equal(validation.valid, false, "toolName outside allowedActions must not validate");
  assert.ok(
    validation.violations.some((v) => /not in allowedActions/i.test(v)),
    `must name the allowedActions violation, got: ${JSON.stringify(validation.violations)}`,
  );

  const report = await forgeExecute(receipt, {
    probe_target_a: { command: "write-A" },
    probe_target_b: { command: "write-B" },
  });
  assert.equal(report.summary.outcome_class, "DENIED");
  assert.equal(a.worldMutations, 0, "no mutation against the originally-bound target either");
  assert.equal(b.worldMutations, 0, "no mutation against the substituted target");
});

test("B2 param-level substitution: grant bound to target A must refuse a request for target B", async () => {
  // THE REQUIREMENT: the receipt carries inputHash — a commitment to the exact
  // approved inputs. Swapping the inputs inside the same tool (same toolName,
  // different target argument) is target substitution and must be refused, with
  // no fallback, no silent normalisation, and no mutation against either target.
  const { shell } = registerTargets();

  const approvedParams = { command: "write-A" };
  const receipt = makeReceipt({
    toolName: "probe_shell",
    allowedActions: ["probe_shell"],
    inputHash: paramsHash(approvedParams),
  });

  const report = await forgeExecute(receipt, {
    probe_shell: { command: "write-B" }, // committed hash says A, request says B
  });

  assert.equal(
    report.summary.outcome_class,
    "DENIED",
    "a request whose params do not match the receipt's inputHash must be DENIED before dispatch",
  );
  assert.equal(shell.invokedRequests, 0, "the executor must not be invoked for unapproved inputs");
  assert.equal(shell.worldMutations, 0, "no mutation may occur against the substituted target");
  assert.ok(
    (report.refusalReasons ?? []).some((v) => /inputHash|hash mismatch|target/i.test(v)),
    `the refusal must record a hash/scope-mismatch reason, got: ${JSON.stringify(report.refusalReasons ?? [])}`,
  );
});

// ═════════════════════════════════════════════════════════════════════════
// C. TIMEOUT_DOES_NOT_DUPLICATE_MUTATION
// ═════════════════════════════════════════════════════════════════════════

test("C1 timeout is UNKNOWN_OUTCOME, and the four states stay distinguishable", async () => {
  clearUnknownOutcomes();
  const slow = probeTool("probe_slow", { delayMs: 60 });
  const receipt = makeReceipt({
    toolName: "probe_slow",
    allowedActions: ["probe_slow"],
    bounds: { reversible: true, blastRadius: "LOW", maxTools: 1, timeoutMs: 10 },
    inputHash: paramsHash({ command: "slow-write" }),
  });

  const report = await forgeExecute(receipt, { probe_slow: { command: "slow-write" } });

  // 1. request timeout — observed by the caller
  const result = report.results[0];
  assert.equal(result.outcome_class, "UNKNOWN_OUTCOME", "timeout must NOT be classified FAILURE");
  assert.match(result.error ?? "", /timed out/i, "timeout reason must be explicit");

  // 2. command completion — the body did run to completion (delayed body)
  // 3. world mutation — it does mutate, but that fact is UNKNOWN to the caller
  // 4. receipt delivery — no verified result was delivered
  assert.equal(slow.invokedRequests, 1, "the request reached the mutation boundary exactly once");
  assert.equal(
    report.summary.outcome_class,
    "UNKNOWN_OUTCOME",
    "aggregate must stay UNKNOWN — executor self-report cannot promote it",
  );

  const recorded = listUnknownOutcomes(); // array of action hashes awaiting reconcile()
  assert.ok(
    recorded.includes(result.actionHash ?? ""),
    "the timeout must be recorded for reconcile() before the call returns",
  );
});

test("C2 the same authorized receipt executed twice creates ONE mutation, not two", async () => {
  const { a } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    inputHash: paramsHash({ command: "write-A" }),
  });

  const first = await forgeExecute(receipt, { probe_target_a: { command: "write-A" } });
  assert.equal(first.summary.outcome_class, "SUCCESS");

  // The caller loses the response (or the transport drops) and retries with the
  // SAME receipt. A grant that is single-use, or an execution receipt lookup,
  // must prevent the second world mutation.
  const retry = await forgeExecute(receipt, { probe_target_a: { command: "write-A" } });

  assert.equal(
    a.worldMutations,
    1,
    `a retry with receiptId=${receipt.receiptId} must not produce a second mutation ` +
      `(observed ${a.worldMutations} mutations from 2 submissions)`,
  );
  assert.equal(
    retry.summary.outcome_class,
    "DENIED",
    "a replayed receipt must be refused as DENIED (already-consumed grant)",
  );
});

// ═════════════════════════════════════════════════════════════════════════
// D. ACTOR_BINDING_REJECTED  (reuses elicitationTrustVerification S1c)
// ═════════════════════════════════════════════════════════════════════════

test("D actor binding: an ACT bound to actor A is refused when presented by actor B", () => {
  // Reused guarantee: test/elicitationTrustVerification.test.ts
  //   "S1c: a valid ACT bound to a DIFFERENT actor is refused (binding, not possession)"
  // Re-asserted here so the contract suite is self-contained and runnable alone.
  process.env.ARIFOS_SESSION_SECRET = SECRET;
  const act = mintAct({
    actor: "arif", // minted for arif
    sid: "SEAL-Dbinding00001",
    auth: "MUTATE",
    exp: NOW_S() + 3600,
  });

  const asOther = isExternalClient({ actor_id: "F13", act }); // presented as F13
  assert.equal(asOther.external, true, "possession of a valid ACT is not identity");
  assert.match(
    asOther.reason ?? "",
    /does not match its ACT-bound actor/i,
    `reason must name actor binding, got: ${asOther.reason ?? "<none>"}`,
  );

  const asSelf = isExternalClient({ actor_id: "arif", act });
  assert.equal(asSelf.external, false, "the correctly bound actor must still pass");
});

// ═════════════════════════════════════════════════════════════════════════
// E. SCOPE_WIDENING_REJECTED  (reuses actLeaseScope 06/07)
// ═════════════════════════════════════════════════════════════════════════

test("E1 a single-token grant stays exactly that token (never widened to the band)", () => {
  // Reused guarantee: test/actLeaseScope.test.ts
  //   "06 a deliberate single-token grant of a shared name is honoured, not widened"
  const r = resolveActLeaseScope(["arif_seal"], DEFAULT_LEASE_SCOPE);
  assert.deepEqual(r.scope, ["arif_seal"], "a minimal grant must not expand");
  assert.equal(r.source, "act_named_shared_token_only");
});

test("E2 a kernel-verb list is not a narrow grant and cannot be read as one", () => {
  // Reused guarantee: test/actLeaseScope.test.ts
  //   "07 a kernel-verb list that merely contains arif_seal is NOT a narrow grant"
  const r = resolveActLeaseScope(["arif_init", "arif_judge", "arif_seal"], DEFAULT_LEASE_SCOPE);
  assert.deepEqual(r.scope, DEFAULT_LEASE_SCOPE);
  assert.equal(r.source, "band_default_act_vocabulary_mismatch");
});

test("E3 an ACT naming forge tools grants only the named ones, never the band", () => {
  const named = ["forge_reality_loop"];
  const r = resolveActLeaseScope(named, DEFAULT_LEASE_SCOPE);
  assert.deepEqual(r.scope, named, "naming one tool must not confer the whole band");
  assert.equal(r.source, "act_named_forge_tools");
  assert.ok(r.scope.length < DEFAULT_LEASE_SCOPE.length, "scope must be strictly narrower");
});

test("E4 allowedActions beyond bounds.maxTools is capped, not widened at execution", async () => {
  const { a, b } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a", "probe_target_b"], // caller widened the list
    bounds: { reversible: true, blastRadius: "LOW", maxTools: 1, timeoutMs: 5000 },
  });

  const report = await forgeExecute(receipt, {
    probe_target_a: { command: "write-A" },
    probe_target_b: { command: "write-B" },
  });

  assert.equal(a.worldMutations, 1, "only the bounded number of actions may run");
  assert.equal(b.worldMutations, 0, "actions beyond maxTools must not execute");
  assert.equal(report.results.length, 1, "results must reflect the capped action list");
});

// ═════════════════════════════════════════════════════════════════════════
// C2 STATE MACHINE — atomicity, non-consumption, dispatch boundary
// ═════════════════════════════════════════════════════════════════════════

test("C3 concurrent replay: exactly one claimant, one invocation, one mutation", async () => {
  clearReceiptLedger();
  const { a } = registerTargets();
  const receipt = makeReceipt({
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    inputHash: paramsHash({ command: "write-A" }),
  });
  const params = { probe_target_a: { command: "write-A" } };

  // Two submissions in flight at the same time, not one after the other.
  const [r1, r2] = await Promise.all([
    forgeExecute(receipt, params),
    forgeExecute(receipt, params),
  ]);

  const outcomes = [r1.summary.outcome_class, r2.summary.outcome_class].sort();
  assert.deepEqual(outcomes, ["DENIED", "SUCCESS"], "exactly one winner, one loser");
  assert.equal(a.invokedRequests, 1, "at most one tool invocation");
  assert.equal(a.worldMutations, 1, "at most one mutation");

  const records = listReceiptRecords().filter((r) => r.receiptId === receipt.receiptId);
  assert.equal(records.length, 1, "exactly one claim record exists (no check-then-set race)");
  assert.equal(records[0].state, "OUTCOME_KNOWN");

  const loser = r1.summary.outcome_class === "DENIED" ? r1 : r2;
  assert.ok(
    (loser.refusalReasons ?? []).some((v) => /REPLAY_REJECTED/.test(v)),
    "the loser must be refused as a replay, not silently ignored",
  );
});

test("C4 a validation refusal does NOT consume the receipt", async () => {
  clearReceiptLedger();
  const { a } = registerTargets();
  const id = `RC-noconsume-${Math.random().toString(16).slice(2, 8)}`;

  const expiredLease = makeReceipt({
    receiptId: id,
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    inputHash: paramsHash({ command: "write-A" }),
    authority: {
      actorId: "arif",
      sessionId: "SEAL-C4noconsume1",
      validUntil: new Date(Date.now() - 60_000).toISOString(),
      scope: "MUTATE",
    },
  });
  const params = { probe_target_a: { command: "write-A" } };

  const refused = await forgeExecute(expiredLease, params);
  assert.equal(refused.summary.outcome_class, "DENIED");
  assert.equal(
    receiptState(id),
    "UNKNOWN_RECEIPT",
    "a receipt refused before dispatch must not be consumed",
  );
  assert.equal(a.invokedRequests, 0);

  // The same receiptId, now valid, still executes — exactly once.
  const valid = makeReceipt({
    receiptId: id,
    toolName: "probe_target_a",
    allowedActions: ["probe_target_a"],
    inputHash: paramsHash({ command: "write-A" }),
  });
  const ok = await forgeExecute(valid, params);
  assert.equal(ok.summary.outcome_class, "SUCCESS", "an unconsumed receipt must still execute");
  assert.equal(a.worldMutations, 1);
});

test("C5 claimed but never dispatched: consumed, but dispatched stays false", async () => {
  clearReceiptLedger();
  const receipt = makeReceipt({
    toolName: "probe_absent_tool", // never registered
    allowedActions: ["probe_absent_tool"],
  });

  const first = await forgeExecute(receipt);
  assert.equal(first.summary.outcome_class, "FAILURE", "an unregistered tool fails");

  const rec = getReceiptRecord(receipt.receiptId);
  assert.ok(rec, "the claim must be recorded");
  assert.equal(
    rec.dispatched,
    false,
    "no tool body ran, so the dispatched flag must stay false (explicit rule 5)",
  );
  assert.equal(rec.state, "OUTCOME_KNOWN");

  const retry = await forgeExecute(receipt);
  assert.equal(
    retry.summary.outcome_class,
    "DENIED",
    "a claimed receipt is consumed even when dispatch was prevented",
  );
});

test("C6 a timeout leaves the receipt consumed as UNKNOWN_OUTCOME; retry is denied", async () => {
  clearReceiptLedger();
  const slow = probeTool("probe_slow2", { delayMs: 60 });
  const receipt = makeReceipt({
    toolName: "probe_slow2",
    allowedActions: ["probe_slow2"],
    bounds: { reversible: true, blastRadius: "LOW", maxTools: 1, timeoutMs: 10 },
    inputHash: paramsHash({ command: "slow-write" }),
  });

  const first = await forgeExecute(receipt, { probe_slow2: { command: "slow-write" } });
  assert.equal(first.summary.outcome_class, "UNKNOWN_OUTCOME");

  const rec = getReceiptRecord(receipt.receiptId);
  assert.equal(rec?.state, "UNKNOWN_OUTCOME", "UNKNOWN is a consumed terminal state");
  assert.equal(rec?.dispatched, true, "the tool body did start, so dispatch is true");

  const retry = await forgeExecute(receipt, { probe_slow2: { command: "slow-write" } });
  assert.equal(retry.summary.outcome_class, "DENIED");
  assert.equal(
    slow.invokedRequests,
    1,
    "a consumed receipt must never re-invoke the tool — resolution is reconcile() or a new receipt",
  );
});

// ═════════════════════════════════════════════════════════════════════════
// AXIS DISCIPLINE (structural, not decorative)
// ═════════════════════════════════════════════════════════════════════════

test("AXIS: stage 555 and lane 555-ASI are different coordinates and both stand", () => {
  // STAGE ABI (bare numeral, kernel context) — arifOS/kernel-sot.yaml
  //   stage 555 = arif_memory   (memory governor — a POSITION in the session arc)
  // LANE/TIER (numeral-TIER suffix) — AAA/instructions/apex-zen-alignment.md
  //   555-ASI = VERIFY          (the ASI tier HOLDS the verify role)
  // fatwa K1 rulings 1-3,4: stage ≠ tier; a missing marker is a naming defect,
  // not a doctrine conflict. Neither axis may be renamed or collapsed here.
  const stage = { 555: "arif_memory", 666: "judge" } as const;
  const lane = { "555-ASI": "VERIFY", "888-APEX": "JUDGE" } as const;
  assert.equal(stage[555], "arif_memory");
  assert.equal(lane["555-ASI"], "VERIFY");
  assert.notEqual(stage[555], lane["555-ASI"], "stage memory ≠ lane VERIFY");
  assert.equal(stage[666], "judge");
  assert.equal(lane["888-APEX"], "JUDGE");
});

// ═════════════════════════════════════════════════════════════════════════
// F. VERIFICATION_FAILURE_BLOCKS_COMPLETION  (F13 ORDER 2026-11-01)
// Command success ≠ intended world outcome. A supplied expected_output is a
// claim about the outcome; when it fails verification, "done" is not issuable.
// ═════════════════════════════════════════════════════════════════════════

function stringTool(name: string, out: string) {
  const ledger = { invokedRequests: 0, worldMutations: 0 };
  registerTool({
    name,
    domain: "contract-test",
    execute: async () => {
      ledger.invokedRequests += 1;
      ledger.worldMutations += 1;
      return out;
    },
  });
  return ledger;
}

test("F1 a failed verification blocks the done claim (verdict is VERIFICATION_FAILED)", async () => {
  const t = stringTool("probe_vf_mismatch", "goodbye");
  const approved = { expected_output: "hello" };
  const receipt = makeReceipt({
    toolName: "probe_vf_mismatch",
    allowedActions: ["probe_vf_mismatch"],
    inputHash: paramsHash(approved),
  });

  const report = await forgeExecute(receipt, { probe_vf_mismatch: approved });

  assert.equal(t.worldMutations, 1, "the command DID run — this is not a refusal");
  assert.equal(report.summary.outcome_class, "SUCCESS", "command-level outcome is success");
  assert.equal(
    report.summary.verdict,
    "VERIFICATION_FAILED",
    "completion may not be claimed when the intended outcome failed verification",
  );
  assert.equal(report.summary.verification?.failed, 1);
  assert.equal(report.results[0].verification, "FAIL");
});

test("F2 a verified outcome still claims completion (positive control)", async () => {
  stringTool("probe_vf_match", "hello");
  const approved = { expected_output: "hello" };
  const receipt = makeReceipt({
    toolName: "probe_vf_match",
    allowedActions: ["probe_vf_match"],
    inputHash: paramsHash(approved),
  });

  const report = await forgeExecute(receipt, { probe_vf_match: approved });

  assert.equal(report.summary.verdict, "SUCCESS");
  assert.equal(report.summary.verification?.passed, 1);
  assert.equal(report.results[0].verification, "PASS");
});

test("F3 no supplied expectation keeps legacy completion semantics (UNSPECIFIED)", async () => {
  stringTool("probe_vf_none", "whatever");
  const approved = {};
  const receipt = makeReceipt({
    toolName: "probe_vf_none",
    allowedActions: ["probe_vf_none"],
    inputHash: paramsHash(approved),
  });

  const report = await forgeExecute(receipt, { probe_vf_none: approved });

  assert.equal(report.summary.verdict, "SUCCESS", "no expectation = no verification gate");
  assert.equal(report.summary.verification?.specified, 0);
  assert.equal(report.results[0].verification, "UNSPECIFIED");
});
