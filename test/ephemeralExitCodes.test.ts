/**
 * ephemeralExitCodes.test.ts — Synthetic Python tool that exits 7 →
 * the engine reports `exit=7` AND a stderr hash in the verification
 * receipt. The legacy `stderr.slice(0, 200)` masking is replaced
 * with a hash + length disclosure so F11 audits preserve the
 * stderr signature.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EphemeralGenesis,
  type SandboxExecutor,
  type SandboxRunResult,
  ContainmentUnavailableError,
} from "../src/infrastructure/tools/EphemeralGenesis.js";

class StubExecutor implements SandboxExecutor {
  private plan: (cmd: string) => Promise<SandboxRunResult>;
  isAvailableCalled = 0;
  runCalled = 0;

  constructor(plan: (cmd: string) => Promise<SandboxRunResult>) {
    this.plan = plan;
  }
  async isAvailable(): Promise<boolean> {
    this.isAvailableCalled += 1;
    return true;
  }
  async run(command: string): Promise<SandboxRunResult> {
    this.runCalled += 1;
    return this.plan(command);
  }
}

const PYTHON_EXIT7 = "raise SystemExit(7)";

async function genComputeFn(genesis: EphemeralGenesis, code: string, language: "python" | "bash" = "python") {
  return genesis.generate(
    "compute_fn_inline",
    { language, code },
    "session-x",
    "actor-y",
    "exit-code test",
  );
}

describe("ephemeral sandbox — exit codes preserved", () => {
  it("compute_fn template: exit 7 surfaces in errors[] and stderr_hash is non-empty", async () => {
    const exec = new StubExecutor(async () => ({
      exitCode: 7,
      killed: false,
      stdout: "",
      stderr: "SystemExit: 7",
      wallTimeMs: 12,
      backend: "stub",
    }));
    const genesis = new EphemeralGenesis({ sandbox: exec });
    // Register a one-off compute_fn template on the fly via a clone of
    // the engine's registry. The simpler path: use generate() with the
    // existing API path; since compute_fn has no built-in template we
    // assert via direct sandboxTest path.
    // We bypass by re-using the engine's storage directly.
    const toolId = "eph_compute_exit7";
    genesis.store.register({
      id: toolId,
      templateId: "compute_fn_inline",
      templateType: "compute_fn",
      params: { language: "python", code: PYTHON_EXIT7 },
      implementation: JSON.stringify({ language: "python", code: PYTHON_EXIT7 }),
      description: "exit code probe",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: "session-x",
      state: "generated",
      hash: "h",
      metadata: { createdBy: "actor-y", missionIntent: "probe", capabilityGap: "exit", invocationCount: 0, totalRuntimeMs: 0 },
    });
    const result = await genesis.sandboxTest(toolId, {});
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /exit=7/);
    assert.match(result.error ?? "", /stderr_hash=sha256:/);
    const tool = genesis.store.get(toolId);
    assert.equal(tool?.state, "failed");
    // The stub returns "SystemExit: 7" (13 bytes). Assert the format
    // and that the byte count is present.
    assert.match(tool?.verification?.error ?? "", /stderr_bytes=\d+/);
  });

  it("compute_fn template: exit 0 transitions to tested", async () => {
    const exec = new StubExecutor(async () => ({
      exitCode: 0,
      killed: false,
      stdout: '{"ok":true}',
      stderr: "",
      wallTimeMs: 5,
      backend: "stub",
    }));
    const genesis = new EphemeralGenesis({ sandbox: exec });
    const toolId = "eph_compute_ok";
    genesis.store.register({
      id: toolId,
      templateId: "compute_fn_inline",
      templateType: "compute_fn",
      params: { language: "python", code: "print('ok')" },
      implementation: JSON.stringify({ language: "python", code: "print('ok')" }),
      description: "happy path",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: "session-x",
      state: "generated",
      hash: "h",
      metadata: { createdBy: "actor-y", missionIntent: "probe", capabilityGap: "exit", invocationCount: 0, totalRuntimeMs: 0 },
    });
    const result = await genesis.sandboxTest(toolId, {});
    assert.equal(result.ok, true);
    const tool = genesis.store.get(toolId);
    assert.equal(tool?.state, "tested");
    assert.match(tool?.verification?.verifier_method ?? "", /schema_invariant/);
  });

  it("engine propagates ContainmentUnavailableError verbatim", async () => {
    const exec = new StubExecutor(async () => {
      throw new ContainmentUnavailableError("backend missing");
    });
    const genesis = new EphemeralGenesis({ sandbox: exec });
    const toolId = "eph_unavailable";
    genesis.store.register({
      id: toolId,
      templateId: "compute_fn_inline",
      templateType: "compute_fn",
      params: {},
      implementation: JSON.stringify({ language: "python", code: "pass" }),
      description: "no backend",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: "s",
      state: "generated",
      hash: "h",
      metadata: { createdBy: "a", missionIntent: "m", capabilityGap: "g", invocationCount: 0, totalRuntimeMs: 0 },
    });
    const r = await genesis.sandboxTest(toolId, {});
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /P0\.4: backend missing/);
  });
});
