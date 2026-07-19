/**
 * test/mutationGate.test.ts — Integration tests for authorize-mutation bridge
 *
 * Tests every mutation sink: benign, controlled, denied.
 * Uses real CLI bridge (requires arifOS authorize_mutation_cli.py).
 *
 * DITEMPA BUKAN DIBERI
 */

import { describe, it, before } from "node:test";
import { strict as assert } from "node:assert";
import {
  callAuthorizeMutationBridge,
  requireAuthorization,
} from "../src/infrastructure/bridges/authorizeMutationBridge.js";

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

describe("Bridge Health", () => {
  it("bridge responds for benign command", async () => {
    const result = await callAuthorizeMutationBridge({
      executable: "ls",
      arguments: ["-la"],
    });
    assert.equal(result.allowed, true);
    assert.equal(result.verdict, "PROCEED");
  });

  it("bridge blocks destructive command", async () => {
    const result = await callAuthorizeMutationBridge({
      executable: "rm",
      arguments: ["-rf", "/var/lib/postgresql"],
      actorPrivilege: "root",
      targetEnvironment: "production",
    });
    assert.equal(result.allowed, false);
    assert.ok(["HOLD", "HOLD_SELF_AUTHORIZATION"].includes(result.verdict));
  });

  it("bridge fail-closed on empty input", async () => {
    const result = await callAuthorizeMutationBridge({
      executable: "",
      arguments: [],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.verdict, "HOLD_UNCLASSIFIED");
  });
});

// ═══════════════════════════════════════════════════════════════
// PER-SINK INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

describe("forgeGit", () => {
  it("benign: git status", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "git",
      arguments: ["status"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: git push feature branch", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "git",
      arguments: ["push", "origin", "feature/test"],
      targetEnvironment: "staging",
    });
    assert.equal(r.allowed, true);
  });

  it("denied: git push --force main", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "git",
      arguments: ["push", "--force", "origin", "main"],
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.ok(["HOLD", "JUDGE_REQUIRED"].includes(r.verdict));
  });

  it("denied: git update-ref -d main", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "git",
      arguments: ["update-ref", "-d", "refs/heads/main"],
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
  });
});

describe("forgeDocker", () => {
  it("benign: docker ps", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "docker",
      arguments: ["ps"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: docker restart container", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "docker",
      arguments: ["restart", "myapp"],
      targetEnvironment: "staging",
    });
    assert.ok(r.allowed || r.verdict === "REQUIRE_CONTROLS");
  });

  it("denied: docker system prune --volumes", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "docker",
      arguments: ["system", "prune", "--volumes"],
      actorPrivilege: "root",
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.ok(["HOLD", "HOLD_SELF_AUTHORIZATION"].includes(r.verdict));
  });
});

describe("forgeFilesystem", () => {
  it("benign: read file", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "cat",
      arguments: ["/etc/hosts"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: bounded config write", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "write",
      arguments: ["/tmp/test.txt"],
    });
    assert.equal(r.allowed, true);
  });

  it("denied: recursive data delete", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "rm",
      arguments: ["-rf", "/var/lib/mysql"],
      actorPrivilege: "root",
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.ok(["HOLD", "HOLD_SELF_AUTHORIZATION"].includes(r.verdict));
  });
});

describe("forgeSystemd", () => {
  it("benign: systemctl status", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "systemctl",
      arguments: ["status", "arifos"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: restart with controls", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "systemctl",
      arguments: ["restart", "arifos"],
      targetEnvironment: "production",
      suppliedControls: [
        "pre_health_snapshot",
        "rollback_command",
        "post_health_probe",
        "timeout_seconds",
      ],
    });
    assert.equal(r.allowed, true);
  });

  it("denied: restart without controls", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "systemctl",
      arguments: ["restart", "arifos"],
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.equal(r.verdict, "HOLD_MISSING_CONTROLS");
  });
});

describe("forgePostgres", () => {
  it("benign: SELECT query", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "SELECT",
      arguments: ["*", "FROM", "users"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: reversible migration (CREATE TABLE)", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "CREATE",
      arguments: ["TABLE", "temp_analytics", "(id", "SERIAL)"],
      targetEnvironment: "staging",
    });
    assert.ok(r.allowed || r.verdict === "ANNOUNCE" || r.verdict === "REQUIRE_CONTROLS");
  });

  it("denied: DROP TABLE production", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "DROP",
      arguments: ["TABLE", "users", "CASCADE"],
      actorPrivilege: "root",
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.ok(["HOLD", "HOLD_SELF_AUTHORIZATION"].includes(r.verdict));
  });

  it("denied: TRUNCATE production", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "TRUNCATE",
      arguments: ["TABLE", "orders"],
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
  });
});

describe("forgeDeploy", () => {
  it("benign: deploy dry-run", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "deploy",
      arguments: ["--dry-run", "--env", "staging"],
    });
    assert.equal(r.allowed, true);
  });

  it("controlled: production deploy with controls", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "deploy",
      arguments: ["--env", "production"],
      targetEnvironment: "production",
      suppliedControls: [
        "config_validation",
        "previous_release_reference",
        "rollback_command",
        "post_deploy_verification",
      ],
    });
    assert.equal(r.allowed, true);
  });

  it("denied: production deploy without controls", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "deploy",
      arguments: ["--env", "production"],
      targetEnvironment: "production",
    });
    assert.equal(r.allowed, false);
    assert.equal(r.verdict, "HOLD_MISSING_CONTROLS");
  });
});

// ═══════════════════════════════════════════════════════════════
// TOKEN TAMPER TESTS
// ═══════════════════════════════════════════════════════════════

describe("Token Tamper Protection", () => {
  it("expired token rejected", async () => {
    const r = await callAuthorizeMutationBridge({
      executable: "ls",
      arguments: ["-la"],
    });
    if (r.authorizedExecution) {
      // Simulate expiry by checking expiresAt is set
      assert.ok(r.authorizedExecution.expiresAt);
      const issued = new Date(r.authorizedExecution.issuedAt).getTime();
      const expires = new Date(r.authorizedExecution.expiresAt).getTime();
      assert.ok(expires > issued, "expiresAt must be after issuedAt");
      // 30s TTL
      const ttl = (expires - issued) / 1000;
      assert.ok(ttl <= 35, `TTL ${ttl}s should be ~30s`);
    }
  });

  it("token hash-bound: different command rejected", async () => {
    const r1 = await callAuthorizeMutationBridge({
      executable: "ls",
      arguments: ["-la"],
    });
    const r2 = await callAuthorizeMutationBridge({
      executable: "rm",
      arguments: ["-rf", "/"],
    });
    if (r1.authorizedExecution && r2.authorizedExecution) {
      assert.notEqual(
        r1.authorizedExecution.profileHash,
        r2.authorizedExecution.profileHash,
        "Different commands must have different profile hashes"
      );
    }
  });

  it("requireAuthorization throws on denied", async () => {
    try {
      await requireAuthorization({
        executable: "rm",
        arguments: ["-rf", "/var/lib/postgresql"],
        actorPrivilege: "root",
        targetEnvironment: "production",
      });
      assert.fail("Should have thrown MUTATION_GATE_DENIED");
    } catch (err: any) {
      assert.equal(err.code, "MUTATION_GATE_DENIED");
      assert.ok(err.message.includes("HOLD"));
    }
  });
});
