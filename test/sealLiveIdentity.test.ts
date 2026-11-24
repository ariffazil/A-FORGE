/**
 * FTG-01/FTG-03 regression (2026-11-24) — identity comes only from explicit
 * actor_verified, never from status/verdict text or session_id echo.
 *
 * Fixtures are REAL kernel responses captured 2026-11-24 via
 * arif_init(mode=validate) against :8088 — both an unbound canary session id
 * and an init attempt returned status="completed", verdict="HOLD",
 * actor_verified=false while echoing session_id.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { sealLiveFromValidateResult } from "../src/interfaces/mcp/shell/forgeShell.js";

const CANARY_FIXTURE = {
  status: "completed",
  tool: "arif_init",
  verdict: "HOLD",
  actor: { actor_id: "aforge", actor_verified: false, authority_level: "OBSERVE_ONLY" },
  session_id: "ses_probe_bogus_000",
  actor_verified: false,
  band: "OBSERVE_ONLY",
};

test("FTG-01: unbound canary (status=completed, actor_verified=false) must NOT verify", () => {
  assert.equal(sealLiveFromValidateResult(CANARY_FIXTURE), false);
});

test("FTG-01: session_id echo must NOT verify (old bypass limb)", () => {
  assert.equal(
    sealLiveFromValidateResult({ status: "completed", session_id: "SEAL-0123456789abcdef" }),
    false,
  );
});

test("FTG-03: verdict=SEAL text alone must NOT verify (old bypass limb)", () => {
  assert.equal(sealLiveFromValidateResult({ verdict: "SEAL", status: "completed" }), false);
});

test("FTG-01: status=completed alone must NOT verify (old bypass limb)", () => {
  assert.equal(sealLiveFromValidateResult({ status: "completed" }), false);
});

test("FTG-01: explicit actor.actor_verified=true IS identity evidence", () => {
  assert.equal(sealLiveFromValidateResult({ actor: { actor_verified: true, actor_id: "aforge" } }), true);
});

test("FTG-01: top-level actor_verified=true also verifies (kernel sets both fields)", () => {
  assert.equal(sealLiveFromValidateResult({ actor_verified: true }), true);
});

test("FTG-01: null/undefined/empty shapes fail closed", () => {
  assert.equal(sealLiveFromValidateResult(null), false);
  assert.equal(sealLiveFromValidateResult(undefined), false);
  assert.equal(sealLiveFromValidateResult({}), false);
});
