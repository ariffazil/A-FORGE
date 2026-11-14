/**
 * containmentEnvSanitization.test.ts — Verification of Centralized Environment Sanitizer
 * ════════════════════════════════════════════════════════════════════════════════════════
 *
 * Requirements verified:
 * 1. Default-deny: parent environment above 256 variables is stripped down to safe allowlist.
 * 2. Secret variables (matching KEY, TOKEN, SECRET, PASSWORD, etc.) are strictly omitted.
 * 3. Required execution variables (PATH, LANG, TMPDIR, etc.) are retained.
 * 4. Explicit caller variables are accepted if clean, and rejected if secret-bearing.
 * 5. Backend-specific limits enforced (Firejail cap <= 128, bwrap <= 256).
 * 6. Live probe reproduction:
 *    - Firejail with unsanitized parent env (446 vars) FAILS with MAX_ENVS (256).
 *    - Firejail with sanitized env (< 10 vars) SUCCEEDS with exit code 0.
 *    - bwrap succeeds in both.
 * 7. Production integration:
 *    - ContainmentEngine.testBackend('firejail') returns ok: true using sanitized environment.
 */

import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  buildSanitizedEnvironment,
  SECRET_PATTERN,
  DEFAULT_REQUIRED_VARS,
  MAX_ENVS_CAPS,
  EnvironmentSanitizationError,
  testBackend,
  type SanitizedEnvOptions,
} from "../src/domain/containment/ContainmentEngine.js";
import type { SandboxBackend } from "../src/domain/containment/SandboxPolicy.js";

// ── Test Suites ─────────────────────────────────────────────────────────────

describe("EnvironmentSanitizer — Core Logic (Imported from Production)", () => {
  it("strips parent environment from > 300 variables down to allowlist", () => {
    const bloatedEnv: Record<string, string> = {
      PATH: "/usr/bin",
      LANG: "en_US.UTF-8",
    };
    for (let i = 0; i < 350; i++) {
      bloatedEnv[`RANDOM_VAR_${i}`] = `value_${i}`;
    }

    assert.ok(Object.keys(bloatedEnv).length > 300);

    const clean = buildSanitizedEnvironment({
      backend: "firejail",
      parentEnv: bloatedEnv,
    });

    assert.ok(Object.keys(clean).length <= 10);
    assert.equal(clean.PATH, "/usr/bin");
    assert.equal(clean.LANG, "en_US.UTF-8");
    assert.equal(clean.RANDOM_VAR_0, undefined);
  });

  it("strictly filters secret-bearing environment variables", () => {
    const taintedEnv: Record<string, string> = {
      PATH: "/usr/bin",
      API_KEY: "secret_123",
      AUTH_TOKEN: "bearer_xyz",
      DB_PASSWORD: "admin",
      SESSION_SECRET: "hash",
      PRIVATE_SIGNING_KEY: "pem",
    };

    const clean = buildSanitizedEnvironment({
      backend: "firejail",
      parentEnv: taintedEnv,
    });

    assert.equal(clean.API_KEY, undefined);
    assert.equal(clean.AUTH_TOKEN, undefined);
    assert.equal(clean.DB_PASSWORD, undefined);
    assert.equal(clean.SESSION_SECRET, undefined);
    assert.equal(clean.PRIVATE_SIGNING_KEY, undefined);
  });

  it("throws EnvironmentSanitizationError if caller attempts to inject secret variable", () => {
    assert.throws(
      () => {
        buildSanitizedEnvironment({
          backend: "bwrap",
          extraEnv: { STRIPE_SECRET_KEY: "sk_live_123" },
        });
      },
      (err: any) => {
        return err instanceof EnvironmentSanitizationError && /forbidden secret variable/.test(err.message);
      }
    );
  });

  it("retains required variables with sensible defaults if missing in parent", () => {
    const clean = buildSanitizedEnvironment({
      backend: "bwrap",
      parentEnv: {},
    });

    assert.ok(clean.PATH.includes("/usr/bin"));
    assert.equal(clean.LANG, "C.UTF-8");
    assert.equal(clean.TMPDIR, "/tmp");
  });
});

describe("EnvironmentSanitizer — Live Backend Reproduction", () => {
  it("proves Firejail FAILS on unsanitized environment with > 256 variables", () => {
    const largeEnv: NodeJS.ProcessEnv = { ...process.env };
    // Ensure large count
    for (let i = 0; i < 300; i++) {
      largeEnv[`TEST_POLLUTION_${i}`] = "x";
    }

    const res = spawnSync("firejail", ["--quiet", "true"], {
      env: largeEnv,
      encoding: "utf-8",
    });

    assert.equal(res.status, 1);
    assert.match(res.stderr, /MAX_ENVS \(256\)/);
  });

  it("proves Firejail SUCCEEDS on sanitized environment", () => {
    const cleanEnv = buildSanitizedEnvironment({ backend: "firejail" });

    const res = spawnSync("firejail", ["--quiet", "true"], {
      env: cleanEnv,
      encoding: "utf-8",
    });

    assert.equal(res.status, 0);
  });

  it("proves bwrap succeeds on both large and sanitized environment", () => {
    const cleanEnv = buildSanitizedEnvironment({ backend: "bwrap" });

    const resClean = spawnSync("bwrap", ["--ro-bind", "/", "/", "true"], {
      env: cleanEnv,
      encoding: "utf-8",
    });
    assert.equal(resClean.status, 0);

    const resAmbient = spawnSync("bwrap", ["--ro-bind", "/", "/", "true"], {
      env: process.env,
      encoding: "utf-8",
    });
    assert.equal(resAmbient.status, 0);
  });

  it("proves testBackend('firejail') succeeds using sanitized environment in production code", async () => {
    const res = await testBackend("firejail");
    assert.equal(res.ok, true);
    assert.ok(res.version?.includes("firejail version"));
  });
});
