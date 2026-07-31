/**
 * secretBroker.test.ts — ProcessEnvSecretBroker + ArifOsVaultSecretBroker.
 * ProcessEnv refuses to return an empty secret (F9); vault broker
 * routes to arifos-vault. Both expose audit logs and revocation.
 */
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  ProcessEnvSecretBroker,
  ArifOsVaultSecretBroker,
  getDefaultSecretBroker,
} from "../src/infrastructure/secrets/SecretBroker.js";

describe("ProcessEnvSecretBroker", () => {
  const originalKey = process.env.AFORGE_TEST_SECRET;
  before(() => { process.env.AFORGE_TEST_SECRET = "shh-123"; });
  after(() => {
    if (originalKey === undefined) delete process.env.AFORGE_TEST_SECRET;
    else process.env.AFORGE_TEST_SECRET = originalKey;
  });

  it("resolves a present env-var and records an audit entry", async () => {
    const broker = new ProcessEnvSecretBroker();
    const value = await broker.resolve(
      { kind: "env", name: "AFORGE_TEST_SECRET", scope: "test" },
      { toolId: "t1", actorId: "a" },
    );
    assert.equal(value, "shh-123");
    const audit = await broker.audit();
    assert.equal(audit.length, 1);
    assert.equal(audit[0].ref.kind, "env");
    assert.equal(audit[0].context.toolId, "t1");
  });

  it("throws on empty secret (F9 — never silently expose ambient)", async () => {
    const broker = new ProcessEnvSecretBroker();
    await assert.rejects(
      () => broker.resolve(
        { kind: "env", name: "AFORGE_TEST_DEFINITELY_UNSET", scope: "test" },
        {},
      ),
      /env var AFORGE_TEST_DEFINITELY_UNSET is empty/,
    );
  });

  it("revokes a scope so subsequent resolves throw", async () => {
    const broker = new ProcessEnvSecretBroker();
    await broker.revoke("kill-switch");
    await assert.rejects(
      () => broker.resolve(
        { kind: "env", name: "AFORGE_TEST_SECRET", scope: "kill-switch" },
        {},
      ),
      /scope kill-switch has been revoked/,
    );
  });

  it("rejects non-env refs (caller must use ArifOsVaultSecretBroker)", async () => {
    const broker = new ProcessEnvSecretBroker();
    await assert.rejects(
      () => broker.resolve(
        { kind: "arifos-vault", vault_entry_id: "v1" } as never,
        {},
      ),
      /ProcessEnvSecretBroker only handles kind:"env"/,
    );
  });
});

describe("ArifOsVaultSecretBroker", () => {
  it("returns arifos-vault:<id> for vault refs and logs the audit hash", async () => {
    const broker = new ArifOsVaultSecretBroker();
    const v = await broker.resolve(
      { kind: "arifos-vault", vault_entry_id: "v-test" },
      { actorId: "a" },
    );
    assert.equal(v, "arifos-vault:v-test");
    const audit = await broker.audit();
    assert.equal(audit.length, 1);
    assert.equal(audit[0].ref.kind, "arifos-vault");
  });

  it("rejects env refs (caller must use ProcessEnvSecretBroker)", async () => {
    const broker = new ArifOsVaultSecretBroker();
    await assert.rejects(
      () => broker.resolve(
        { kind: "env", name: "x", scope: "y" } as never,
        {},
      ),
      /ArifOsVaultSecretBroker only handles kind:"arifos-vault"/,
    );
  });
});

describe("Singleton — getDefaultSecretBroker()", () => {
  it("returns the ProcessEnvSecretBroker singleton", () => {
    const b = getDefaultSecretBroker();
    assert.ok(b instanceof ProcessEnvSecretBroker);
  });
});
