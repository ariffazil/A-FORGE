/**
 * Regression test for 2026-10-31 autonomous loop Blocker 1:
 *   1. forge_session_init must consume the advertised `act` credential
 *      (in addition to `session_token` and `sct`).
 *   2. Explicit valid ACT (`act` / `session_token`) whose `claims.allowed`
 *      carries kernel `arif_*` verbs must preserve all authorized A-FORGE
 *      `leaseScope` tools (including `forge_reality_loop` and `forge_vault`)
 *      and must never silently collapse `pre_minted_lease.scope` to
 *      `["arif_seal"]` only.
 *   3. The resulting ACT_DERIVED lease must authorize `forge_reality_loop`
 *      via `validateLeaseForTool` without mocking away HMAC signature,
 *      lease registration, or verdict trace binding.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { server } from "../src/interfaces/mcp/core.js";
import { validateLeaseForTool } from "../src/interfaces/mcp/forgeTools.js";
import {
  resolveActLeaseScope,
  DEFAULT_LEASE_SCOPE as LEASE_SCOPE,
} from "../src/interfaces/mcp/actLeaseScope.js";

function mintSignedKernelAct(params: {
  secret: string;
  sid: string;
  actor: string;
  auth: string;
  allowed: string[];
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    act_v: 1,
    actor: params.actor,
    allowed: params.allowed,
    auth: params.auth,
    av: true,
    canonical_id: params.actor.toUpperCase(),
    exp: now + 28800,
    iat: now,
    kid: "default",
    lane: "AGI",
    nbf: now,
    sid: params.sid,
    stage: "000",
    standing: { dominant_reason: null, state: "OK" },
    ttl: 28800,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sigHex = createHmac("sha256", params.secret)
    .update(payloadB64, "ascii")
    .digest("hex");
  return `act_v1.${payloadB64}.${sigHex}`;
}

const KERNEL_ALLOWED_VERBS = [
  "arif_init",
  "arif_observe",
  "arif_think",
  "arif_route",
  "arif_memory",
  "arif_judge",
  "arif_forge",
  "arif_seal",
  "arif_stage",
  "arif_commit",
];

test("forge_session_init consumes advertised act credential and preserves full A-FORGE leaseScope", async () => {
  const secret = process.env.ARIFOS_SESSION_SECRET || "test-session-secret-for-act-hmac";
  process.env.ARIFOS_SESSION_SECRET = secret;

  const sid = "SEAL-ee585bfbeb8e47cf";
  const actToken = mintSignedKernelAct({
    secret,
    sid,
    actor: "arif",
    auth: "FULL",
    allowed: KERNEL_ALLOWED_VERBS,
  });

  const registeredTools = (server as any)._registeredTools as Record<string, any>;
  const toolDef = registeredTools["forge_session_init"];
  assert.ok(toolDef, "forge_session_init must be registered on server");

  const res = await toolDef.handler(
    {
      actor_id: "arif",
      intent: "regression test for act credential and lease scope",
      mode: "external",
      session_id: sid,
      act: actToken,
    },
    {},
  );

  const text = res?.content?.[0]?.text;
  assert.ok(typeof text === "string", "forge_session_init must return text content");
  const rawEnvelope = JSON.parse(text);
  const parsed = rawEnvelope.data ?? rawEnvelope;

  assert.equal(parsed.status, "OK", `Unexpected response: ${text}`);
  assert.equal(parsed.act_verified, true, "forge_session_init must verify caller-supplied `act` token");
  assert.equal(parsed.act_auth, "FULL", "forge_session_init must preserve FULL auth band from `act` token");
  assert.equal(parsed.lease_status, "ACT_DERIVED", "forge_session_init must mint ACT_DERIVED lease");
  assert.ok(parsed.pre_minted_lease, "pre_minted_lease must be present");

  const scope: string[] = parsed.pre_minted_lease.scope;
  assert.ok(
    scope.length > 1,
    `ACT_DERIVED lease scope must not collapse to ["arif_seal"] only; got: ${JSON.stringify(scope)}`,
  );
  for (const requiredTool of [
    "forge_reality_loop",
    "forge_filesystem",
    "forge_vault",
    "forge_shell",
    "forge_seal",
    "arif_seal",
  ]) {
    assert.ok(
      scope.includes(requiredTool),
      `ACT_DERIVED lease scope must include ${requiredTool}; got: ${JSON.stringify(scope)}`,
    );
  }

  const leaseCheck = await validateLeaseForTool(
    parsed.pre_minted_lease.lease_id,
    "forge_reality_loop",
    "EXECUTE_REVERSIBLE",
  );
  assert.equal(
    leaseCheck.ok,
    true,
    leaseCheck.ok ? "" : `validateLeaseForTool refused forge_reality_loop: ${leaseCheck.gate}: ${leaseCheck.reason}`,
  );
});

test("forge_session_init with session_token does not collapse ACT_DERIVED scope to arif_seal only", async () => {
  const secret = process.env.ARIFOS_SESSION_SECRET || "test-session-secret-for-act-hmac";
  process.env.ARIFOS_SESSION_SECRET = secret;

  const sid = "SEAL-ee585bfbeb8e47cf";
  const actToken = mintSignedKernelAct({
    secret,
    sid,
    actor: "arif",
    auth: "FULL",
    allowed: KERNEL_ALLOWED_VERBS,
  });

  const registeredTools = (server as any)._registeredTools as Record<string, any>;
  const toolDef = registeredTools["forge_session_init"];
  const res = await toolDef.handler(
    {
      actor_id: "arif",
      intent: "regression test for session_token lease scope intersection",
      mode: "external",
      session_id: sid,
      session_token: actToken,
    },
    {},
  );

  const rawText = res?.content?.[0]?.text ?? "{}";
  const rawEnvelope = JSON.parse(rawText);
  const parsed = rawEnvelope.data ?? rawEnvelope;
  assert.equal(parsed.status, "OK", `Unexpected response: ${rawText}`);
  assert.equal(parsed.act_verified, true);
  assert.equal(parsed.act_auth, "FULL");
  assert.equal(parsed.lease_status, "ACT_DERIVED");
  assert.ok(parsed.pre_minted_lease);
  assert.ok(
    parsed.pre_minted_lease.scope.includes("forge_reality_loop"),
    `ACT_DERIVED lease scope collapsed to ${JSON.stringify(parsed.pre_minted_lease.scope)}`,
  );
});


test("06 a deliberate single-token grant of a shared name is honoured, not widened", () => {
  // 888-APEX review edge (2026-10-31): ["arif_seal"] alone is a plausible minimal
  // sealing-only grant. It shares a name with this organ's vocabulary, so widening it
  // to the full band would over-grant. Honour it.
  const r = resolveActLeaseScope(["arif_seal"], LEASE_SCOPE);
  assert.deepEqual(r.scope, ["arif_seal"]);
  assert.equal(r.source, "act_named_shared_token_only");
});

test("07 a kernel-verb list that merely contains arif_seal is NOT a narrow grant", () => {
  // The incident shape: six kernel verbs, one accidental name collision. This must
  // stay band default — otherwise the original defect returns disguised as a grant.
  const r = resolveActLeaseScope(["arif_init", "arif_judge", "arif_seal"], LEASE_SCOPE);
  assert.deepEqual(r.scope, LEASE_SCOPE);
  assert.equal(r.source, "band_default_act_vocabulary_mismatch");
});
