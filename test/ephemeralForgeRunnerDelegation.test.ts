/**
 * ephemeralForgeRunnerDelegation.test.ts — The domain/forge adapter
 * (`EphemeralGenesisRunner`) remains for API compatibility; the
 * canonical engine owns the lifecycle. The class is marked
 * `@deprecated 2026-08-01` and must still be importable.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EphemeralGenesisRunner } from "../src/domain/forge/EphemeralGenesisRunner.js";
import { getEphemeralGenesis } from "../src/infrastructure/tools/EphemeralGenesis.js";

describe("forge/EphemeralGenesisRunner — deprecation + importability", () => {
  it("is importable", () => {
    assert.equal(typeof EphemeralGenesisRunner, "function");
  });

  it("carries @deprecated 2026-08-01 in its header", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/domain/forge/EphemeralGenesisRunner.ts"),
      "utf-8",
    );
    assert.match(src, /@deprecated 2026-08-01/);
  });

  it("canonical engine instance is reachable from the same import path", () => {
    const genesis = getEphemeralGenesis();
    assert.ok(genesis);
    assert.equal(typeof genesis.generate, "function");
    assert.equal(typeof genesis.sandboxTest, "function");
    assert.equal(typeof genesis.invoke, "function");
    assert.equal(typeof genesis.verify, "function");
    assert.equal(typeof genesis.retire, "function");
  });
});
