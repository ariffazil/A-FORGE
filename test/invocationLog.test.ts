/**
 * invocationLog.test.ts — P0-1 refusal-cause observability contract (2026-11-21).
 *
 * Measured defect this closes: across 1,156 enriched-schema ledger rows,
 * verdict=None and refusal_cause=None for 100% of rows, including 233 rows with
 * ok:false. A failed invocation was therefore recorded with neither its
 * constitutional status nor its cause — post-incident forensics could not say
 * why it failed.
 *
 * Contract enforced here:
 *  1. HOLD/VOID keeps its verdict and always carries a non-empty cause.
 *  2. Any other ok:false invocation carries a non-empty cause, while verdict
 *     stays null (an ordinary runtime error is not a constitutional verdict).
 *  3. An explicitly supplied refusal_cause is preserved verbatim.
 *  4. ok:true never acquires a fabricated cause.
 *  5. Error-derived causes are redacted and bounded; never multi-line.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvocationRecord,
  deriveRefusalCause,
  sanitizeRefusalCause,
} from "../src/infrastructure/metrics/invocationLog.js";

test("P0-1 §1 — HOLD + ok:false + missing cause stays HOLD with a non-empty cause", () => {
  const rec = buildInvocationRecord("arif_judge", {
    ok: false,
    verdict: "HOLD",
    error: "floor F6 unmeasured",
  });
  assert.equal(rec.verdict, "HOLD");
  assert.equal(rec.ok, false);
  assert.equal(rec.refusal_cause, "floor F6 unmeasured");
});

test("P0-1 §1b — HOLD with no error still gets the stable UNSPECIFIED_REFUSAL cause", () => {
  const rec = buildInvocationRecord("arif_judge", { verdict: "HOLD" });
  assert.equal(rec.ok, false, "a HOLD verdict alone must fail the transport outcome");
  assert.equal(rec.refusal_cause, "UNSPECIFIED_REFUSAL");
});

test("P0-1 §2 — VOID + ok:false + missing cause stays VOID with a non-empty cause", () => {
  const rec = buildInvocationRecord("arif_seal", { ok: false, verdict: "VOID", error: "hash mismatch" });
  assert.equal(rec.verdict, "VOID");
  assert.equal(rec.ok, false);
  assert.equal(rec.refusal_cause, "hash mismatch");
});

test("P0-1 §3 — verdict absent + ok:false + structured error: verdict stays null, cause populated", () => {
  const rec = buildInvocationRecord("forge_shell", {
    ok: false,
    error: "E_TOOL_TIMEOUT: executor did not answer within 30000ms",
  });
  assert.equal(rec.verdict, null, "an error must never be promoted to a verdict");
  assert.equal(rec.governance_verdict, null);
  assert.equal(rec.refusal_cause, "E_TOOL_TIMEOUT: executor did not answer within 30000ms");
});

test("P0-1 §4 — verdict absent + ok:false + no usable error: stable fallback cause", () => {
  const rec = buildInvocationRecord("forge_git", { ok: false });
  assert.equal(rec.verdict, null);
  assert.equal(rec.refusal_cause, "unspecified_failure");
});

test("P0-1 §5 — an explicit refusal_cause is preserved verbatim", () => {
  const explicit = "POLICY_KEYED_TO_UNVERIFIED_IDENTITY";
  const rec = buildInvocationRecord("forge_shell", {
    ok: false,
    verdict: "HOLD",
    error: "ignored because an explicit cause was supplied",
    refusalCause: explicit,
  });
  assert.equal(rec.refusal_cause, explicit);
});

test("P0-1 §6 — ok:true never acquires a fabricated refusal cause", () => {
  const rec = buildInvocationRecord("arif_observe", { ok: true });
  assert.equal(rec.ok, true);
  assert.equal(rec.refusal_cause, null);
  assert.equal(rec.verdict, null);
});

test("P0-1 §7 — secret-like and oversized error material is redacted and bounded", () => {
  const leaky =
    "Authorization: Bearer abcdef1234567890 saw sk-live-ABCDEFGHIJKLMNOP and "
    + "https://internal.example/token?x=1 failed\nat layer 2\n"
    + "x".repeat(400);
  const cause = sanitizeRefusalCause(leaky);
  assert.ok(cause.length <= 200, `cause must be bounded to 200 chars, got ${cause.length}`);
  assert.ok(!cause.includes("abcdef1234567890"), "bearer token must be redacted");
  assert.ok(!cause.includes("sk-live-ABCDEFGHIJKLMNOP"), "sk- key must be redacted");
  assert.ok(!cause.includes("internal.example"), "url must be redacted");
  assert.ok(!cause.includes("\n"), "cause must be a single line");

  const rec = buildInvocationRecord("forge_fetch", { ok: false, error: leaky });
  assert.ok(typeof rec.refusal_cause === "string" && (rec.refusal_cause as string).length <= 200);
  assert.equal(rec.verdict, null);
});

test("P0-1 §7b — sanitizer is deterministic on empty input", () => {
  assert.equal(sanitizeRefusalCause("   \n\t "), "unspecified_failure");
  assert.equal(deriveRefusalCause({ ok: false }, false), "unspecified_failure");
});
