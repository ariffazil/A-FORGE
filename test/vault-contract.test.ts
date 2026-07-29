import test from "node:test";
import assert from "node:assert/strict";
import {
  ForgeVaultInputSchema,
  vaultRecordMetadata,
  vaultRecordValue,
} from "../src/interfaces/mcp/vaultContract.js";

test("canonical Lane B receipt survives schema parsing", () => {
  const parsed = ForgeVaultInputSchema.parse({
    mode: "receipt",
    name: "session-close",
    content: "Verified work summary",
    reason: "SESSION_CLOSE",
    tier: "session.ledger",
    category: "session.receipt",
    actor_id: "codex-cli",
    session_id: "session-123",
    session_token: "sct_v1.test.token",
    lease_id: "lease-123",
  });

  assert.equal(vaultRecordValue(parsed), "Verified work summary");
  assert.equal(parsed.session_id, "session-123");
  assert.equal(parsed.session_token, "sct_v1.test.token");
  assert.equal(parsed.lease_id, "lease-123");

  const metadata = vaultRecordMetadata(parsed, "receipt");
  assert.equal(metadata.reason, "SESSION_CLOSE");
  assert.equal(metadata.tier, "session.ledger");
  assert.equal(metadata.actor_id, "codex-cli");
  assert.equal(metadata.session_id, "session-123");
  assert.equal(metadata._receipt, true);
  assert.equal("session_token" in metadata, false);
  assert.equal("lease_id" in metadata, false);
});

test("legacy value remains supported for additive compatibility", () => {
  const parsed = ForgeVaultInputSchema.parse({
    mode: "write",
    name: "legacy",
    category: "cache",
    value: "legacy payload",
  });

  assert.equal(vaultRecordValue(parsed), "legacy payload");
});
