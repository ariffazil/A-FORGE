/**
 * R-05 Tests: Scoped deterministic idempotency_key (intent + target + scope + auth + validity_window).
 * Proves:
 *  1. Same action retried within same validity window + auth => IDENTICAL key (deduplicated).
 *  2. Legitimate repeat action in a NEW validity window or NEW authorization => DISTINCT key (NOT falsely rejected).
 *  3. Incomplete binding context => throws F11_IDEMPOTENCY_CONTEXT_INCOMPLETE.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAAE,
  deriveScopedIdempotencyKey,
} from "../src/domain/governance/amanahEnvelope.js";

const SECRET = "test-organ-secret-32bytes-long!!";

test("R-05 DEDUP: identical intent+target+scope+auth+validity_window yields identical key", async () => {
  const ctx = {
    target: "repo:/root/A-FORGE",
    scope: "worktree:r01-r05",
    authorization_ref: "verdict:888-20261126-01",
    validity_window: "2026-11-26T11:45Z/PT5M",
  };
  const a1 = await buildAAE({
    actor_id: "agy",
    intent: "run unit tests",
    action_class: "EXECUTE_REVERSIBLE",
    reversibility: 1.0,
    blast_radius: "repo",
    organ_secret: SECRET,
    idempotency_context: ctx,
  });
  const a2 = await buildAAE({
    actor_id: "agy",
    intent: "run unit tests",
    action_class: "EXECUTE_REVERSIBLE",
    reversibility: 1.0,
    blast_radius: "repo",
    organ_secret: SECRET,
    idempotency_context: ctx,
  });
  assert.equal(a1.idempotency_key, a2.idempotency_key, "same retry window must deduplicate");
  assert.match(a1.idempotency_key, /^idem_[0-9a-f]{32}$/);
});

test("R-05 LEGITIMATE REPEAT: same command in a new validity_window is NOT falsely rejected", async () => {
  const kWindow1 = deriveScopedIdempotencyKey("restart geox-mcp", {
    target: "service:geox-mcp",
    scope: "deploy:canary",
    authorization_ref: "verdict:888-01",
    validity_window: "2026-11-26T11:45Z/PT5M",
  });
  const kWindow2 = deriveScopedIdempotencyKey("restart geox-mcp", {
    target: "service:geox-mcp",
    scope: "deploy:canary",
    authorization_ref: "verdict:888-01",
    validity_window: "2026-11-26T12:00Z/PT5M",
  });
  assert.notEqual(kWindow1, kWindow2, "new validity window must produce distinct key");
});

test("R-05 LEGITIMATE REPEAT: same command with new authorization_ref is NOT falsely rejected", () => {
  const kAuth1 = deriveScopedIdempotencyKey("sync registry", {
    target: "repo:mcp-servers",
    scope: "worktree",
    authorization_ref: "verdict:888-01",
    validity_window: "2026-11-26T11:45Z/PT5M",
  });
  const kAuth2 = deriveScopedIdempotencyKey("sync registry", {
    target: "repo:mcp-servers",
    scope: "worktree",
    authorization_ref: "verdict:888-02",
    validity_window: "2026-11-26T11:45Z/PT5M",
  });
  assert.notEqual(kAuth1, kAuth2, "new authorization must produce distinct key");
});

test("R-05 NEGATIVE: missing authorization_ref or validity_window throws F11_IDEMPOTENCY_CONTEXT_INCOMPLETE", () => {
  assert.throws(
    () =>
      deriveScopedIdempotencyKey("sync registry", {
        target: "repo:mcp-servers",
        scope: "worktree",
        authorization_ref: "",
        validity_window: "",
      }),
    /F11_IDEMPOTENCY_CONTEXT_INCOMPLETE/,
  );
});
