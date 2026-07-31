/**
 * ephemeralComputeFn.test.ts — Non-API execution paths route through
 * the injected SandboxExecutor. Each template type emits a launcher
 * that the stubbed sandbox runs.
 *
 * Covers compute_fn, data_parser, format_converter, and the api_wrapper
 * "in-sandbox curl" path. The stub executor captures the exact
 * command string the engine builds so we can assert its structure.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EphemeralGenesis,
  type SandboxExecutor,
  type SandboxRunResult,
  ContainmentUnavailableError,
} from "../src/infrastructure/tools/EphemeralGenesis.js";
import { SELF_CERTIFIED, VerifierRegistry } from "../src/domain/governance/verifier/VerifierRegistry.js";

class CaptureExecutor implements SandboxExecutor {
  public commands: string[] = [];
  public next: (cmd: string) => Promise<SandboxRunResult>;
  constructor(next: (cmd: string) => Promise<SandboxRunResult>) { this.next = next; }
  async isAvailable() { return true; }
  async run(command: string, _opts: { allowedDomains: string[]; timeoutMs: number; stdin?: string }): Promise<SandboxRunResult> {
    this.commands.push(command);
    return this.next(command);
  }
}

function makeGenesis(exec: CaptureExecutor): EphemeralGenesis {
  return new EphemeralGenesis({
    sandbox: exec,
    verifierRegistry: new VerifierRegistry(),
  });
}

function seedTool(genesis: EphemeralGenesis, id: string, tpl: string, language: "python" | "bash" | "node", code: string) {
  genesis.store.register({
    id,
    templateId: tpl,
    templateType: tpl as "compute_fn" | "data_parser" | "format_converter",
    params: { language, code },
    implementation: JSON.stringify({ language, code }),
    description: "non-api test",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    sessionId: "s",
    state: "generated",
    hash: "h",
    metadata: { createdBy: "a", missionIntent: "m", capabilityGap: "g", invocationCount: 0, totalRuntimeMs: 0 },
  });
}

describe("non-API: compute_fn", () => {
  it("routes through sandbox; python launcher emitted; transitions to tested on exit 0", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: '{"sum":3}', stderr: "", wallTimeMs: 5, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-cf", "compute_fn", "python", "print(1+2)");
    const r = await genesis.sandboxTest("tool-cf", {});
    assert.equal(r.ok, true);
    assert.match(exec.commands[0], /python3 tool\.py/);
    assert.match(exec.commands[0], /< input\.json/);
    const tool = genesis.store.get("tool-cf");
    assert.equal(tool?.state, "tested");
  });

  it("invoke() routes through sandbox; non-API execute path", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: '{"result":42}', stderr: "", wallTimeMs: 3, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-cf-invoke", "compute_fn", "python", "print(42)");
    const r = await genesis.invoke("tool-cf-invoke", { x: 1 });
    assert.equal(r.ok, true);
    const tool = genesis.store.get("tool-cf-invoke");
    assert.equal(tool?.state, "invoked");
    assert.equal(tool?.metadata.invocationCount, 1);
  });

  it("verify() refuses SELF_CERTIFIED even for an invoked compute_fn", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: "ok", stderr: "", wallTimeMs: 1, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-cf-verify", "compute_fn", "python", "pass");
    await genesis.invoke("tool-cf-verify", {});
    const r = await genesis.verify("tool-cf-verify", SELF_CERTIFIED as never, {});
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /SELF_CERTIFIED is inadmissible/);
  });

  it("verify() with schema_invariant passes for a happy compute_fn", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: "ok", stderr: "", wallTimeMs: 1, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-cf-verify-ok", "compute_fn", "python", "pass");
    await genesis.invoke("tool-cf-verify-ok", {});
    const r = await genesis.verify("tool-cf-verify-ok", "schema_invariant", {
      outputSchema: { parse: () => ({ ok: true }) },
    });
    assert.equal(r.ok, true);
    assert.ok((r.receiptHash ?? "").length > 0);
  });
});

describe("non-API: data_parser", () => {
  it("emits a python launcher; passes when exit 0", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: '{"rows":2}', stderr: "", wallTimeMs: 4, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-dp", "data_parser", "python", "import json,sys; json.dump({'rows':2}, sys.stdout)");
    const r = await genesis.sandboxTest("tool-dp", {});
    assert.equal(r.ok, true);
    assert.match(exec.commands[0], /python3 tool\.py/);
  });
});

describe("non-API: format_converter", () => {
  it("emits a bash launcher when language=bash", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: "ok", stderr: "", wallTimeMs: 4, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    seedTool(genesis, "tool-fc", "format_converter", "bash", "echo ok");
    const r = await genesis.sandboxTest("tool-fc", {});
    assert.equal(r.ok, true);
    assert.match(exec.commands[0], /bash tool\.sh/);
  });
});

describe("non-API: api_wrapper routes through sandbox (no host fetch)", () => {
  it("emits a curl launcher; allowedDomains is the api host", async () => {
    const exec = new CaptureExecutor(async () => ({
      exitCode: 0, killed: false, stdout: '{"ok":true}', stderr: "", wallTimeMs: 50, backend: "stub",
    }));
    const genesis = makeGenesis(exec);
    const r = await genesis.generate(
      "mulerouter_image_gen",
      { prompt: "hello" },
      "s",
      "a",
      "m",
    );
    assert.equal(r.ok, true);
    const t = r.tool!;
    const sandboxResult = await genesis.sandboxTest(t.id, {});
    assert.equal(sandboxResult.ok, true);
    const cmd = exec.commands[exec.commands.length - 1];
    assert.match(cmd, /curl -sS/);
    assert.match(cmd, /api\.mulerouter\.ai/);
    // authRef resolves to env-var substitution marker (no raw secret)
    assert.match(cmd, /\$\{ENV:MULEROUTER_API_KEY\}/);
    // No process.env literal
    assert.ok(!cmd.includes("process.env"));
  });

  it("CONTAINMENT_UNAVAILABLE surfaced when backend missing", async () => {
    const exec = new CaptureExecutor(async () => {
      throw new ContainmentUnavailableError("nope");
    });
    const genesis = makeGenesis(exec);
    const r = await genesis.generate(
      "mulerouter_image_gen",
      { prompt: "hello" },
      "s", "a", "m",
    );
    const t = r.tool!;
    const sandboxResult = await genesis.sandboxTest(t.id, {});
    assert.equal(sandboxResult.ok, false);
    assert.match(sandboxResult.error ?? "", /P0\.4: nope/);
  });
});
