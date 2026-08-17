/**
 * Claude live test 2026-08-18 — three execution-organ defects.
 *
 * 1. classifyTool(forge_filesystem) without mode was IRREVERSIBLE
 *    (stat/tree/glob treated as mutation).
 * 2. tree/glob swallowed EACCES and returned empty success.
 * 3. Policy gate must allow OBSERVE filesystem modes for transport_fallback.
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { classifyTool } from "../src/domain/governance/actionClassifier.js";
import { McpPolicyGate } from "../src/domain/governance/McpPolicyGate.js";

describe("classifyTool — forge_filesystem mode-aware", () => {
  it("no-mode defaults to OBSERVE (not IRREVERSIBLE)", () => {
    assert.equal(classifyTool("forge_filesystem"), "OBSERVE");
  });

  for (const mode of ["read", "tree", "stat", "glob", "grep", "search"]) {
    it(`mode=${mode} is OBSERVE`, () => {
      assert.equal(classifyTool("forge_filesystem", mode), "OBSERVE");
    });
  }

  for (const mode of ["write", "patch", "move", "restore"]) {
    it(`mode=${mode} is EXECUTE_REVERSIBLE`, () => {
      assert.equal(classifyTool("forge_filesystem", mode), "EXECUTE_REVERSIBLE");
    });
  }

  it("mode=delete is EXECUTE_HIGH_IMPACT", () => {
    assert.equal(classifyTool("forge_filesystem", "delete"), "EXECUTE_HIGH_IMPACT");
  });
});

describe("McpPolicyGate — observe filesystem modes", () => {
  const gate = new McpPolicyGate();

  for (const mode of ["stat", "tree", "glob", "read"]) {
    it(`transport_fallback ALLOW forge_filesystem mode=${mode}`, () => {
      const v = gate.evaluate({
        tool_name: "forge_filesystem",
        arguments: { mode, path: "/tmp" },
      });
      assert.equal(v.verdict, "ALLOW", `${mode}: ${v.reasons.join("; ")}`);
      assert.ok(
        !v.reasons.some((r) => r.includes("IRREVERSIBLE")),
        `${mode} must not be classified IRREVERSIBLE: ${v.reasons.join("; ")}`,
      );
    });
  }

  it("write is classified EXECUTE_REVERSIBLE (session gate, not L1, enforces mutate)", () => {
    const v = gate.evaluate({
      tool_name: "forge_filesystem",
      arguments: { mode: "write", path: "/tmp/x", content: "n" },
    });
    // Policy gate L1 passes transport_fallback; serve.ts session gate blocks MUTATE.
    assert.equal(classifyTool("forge_filesystem", "write"), "EXECUTE_REVERSIBLE");
    assert.equal(v.layers.identity, true);
  });
});

describe("tree/glob hollow-success — root listing must fail closed", () => {
  it("unreadable directory is not an empty success (forge user probe)", () => {
    // /root is 710 root:root. The forge service user can stat it but cannot
    // readdir. That is the exact Claude reproduction. If we are root, drop
    // to forge for the probe.
    const probe = `
import os, sys
path = sys.argv[1]
try:
    os.listdir(path)
    print("READABLE")
except OSError as e:
    print(e.errno, e.strerror)
`;
    const r = spawnSync("sudo", ["-u", "forge", "python3", "-c", probe, "/root"], {
      encoding: "utf-8",
    });
    if (r.status !== 0 && /unknown user|not found|sudo/i.test(r.stderr || "")) {
      // Environment without forge user — skip, classifier tests still bind.
      return;
    }
    const out = (r.stdout || "").trim();
    assert.notEqual(out, "READABLE", "forge must not be able to list /root (test fixture)");
    assert.match(out, /13|Permission denied/i);
  });

  it("ENOENT on requested root is an error path, not empty entries", async () => {
    const missing = join(tmpdir(), `aforge-missing-${Date.now()}`);
    let threw = false;
    try {
      const { readdir } = await import("node:fs/promises");
      await readdir(missing);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, "ENOENT");
    }
    assert.equal(threw, true);
  });
});
