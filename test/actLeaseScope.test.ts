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
    .digest("hex")
    .slice(0, 16);
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

  const res = await toolDef.callback(
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
  const parsed = JSON.parse(text);

  assert.equal(parsed.status, "OK");
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
