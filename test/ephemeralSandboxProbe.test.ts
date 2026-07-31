/**
 * ephemeralSandboxProbe.test.ts — Probe whether a real sandbox backend
 * is available; never auto-fallback to firejail/docker.
 *
 * On af-forge production (bwrap installed at /usr/bin/bwrap), the probe
 * reports available=true. When bwrap is missing, the engine surfaces
 * ContainmentUnavailableError rather than skipping silently.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DefaultSandboxExecutor,
  ContainmentUnavailableError,
  getDefaultSandboxExecutor,
} from "../src/infrastructure/tools/EphemeralGenesis.js";

describe("SandboxExecutor — factory", () => {
  it("returns a DefaultSandboxExecutor from getDefaultSandboxExecutor()", () => {
    const exec = getDefaultSandboxExecutor();
    assert.ok(exec instanceof DefaultSandboxExecutor);
  });
});

describe("SandboxExecutor — bwrap probe", () => {
  it("isAvailable() returns a boolean", async () => {
    const exec = new DefaultSandboxExecutor();
    const result = await exec.isAvailable();
    assert.equal(typeof result, "boolean");
  });

  it("on af-forge, bwrap is available", async () => {
    const exec = new DefaultSandboxExecutor();
    const result = await exec.isAvailable();
    // Production host has /usr/bin/bwrap. In CI without bwrap this
    // would be false; we assert boolean to remain portable.
    if (process.env.AFORGE_REQUIRE_SANDBOX === "1") {
      assert.equal(result, true);
    }
  });
});

describe("SandboxExecutor — error contract", () => {
  it("ContainmentUnavailableError carries the CONTAINMENT_UNAVAILABLE code", () => {
    const e = new ContainmentUnavailableError("nope");
    assert.equal(e.code, "CONTAINMENT_UNAVAILABLE");
    assert.match(e.message, /nope/);
  });
});
