import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import {
  extractAssumptions,
  detectUnknowns,
  generatePaths,
  calculateRiskScore,
  generateRollback,
  runSimulationPass,
  executeQQQ,
} from "../src/domain/governance/QQQRuntime.js";

describe("QQQ Runtime v1 Constitutional Layer", () => {
  const testSession = "test-session-12345";
  const testIntent = "Verify and write clean configuration files";

  it("should extract assumptions correctly based on tool type", () => {
    const fileAssumptions = extractAssumptions("write_file", { path: "test.txt" });
    assert.ok(fileAssumptions.some((a) => a.includes("writeable")));
    assert.ok(fileAssumptions.some((a) => a.includes("Workspace matches")));

    const shellAssumptions = extractAssumptions("forge_shell", { CommandLine: "npm run test" });
    assert.ok(shellAssumptions.some((a) => a.includes("required binaries")));
  });

  it("should detect unknowns correctly based on tool type", () => {
    const fileUnknowns = detectUnknowns("write_file", { path: "test.txt" });
    assert.ok(fileUnknowns.some((u) => u.includes("live contents of file")));

    const shellUnknowns = detectUnknowns("forge_shell", { CommandLine: "npm run test" });
    assert.ok(shellUnknowns.some((u) => u.includes("Side-effects")));
  });

  it("should generate three distinct execution paths", () => {
    const paths = generatePaths("write_file", { path: "test.txt" });
    assert.ok(paths.path_1.includes("Direct Execution"));
    assert.ok(paths.path_2.includes("Pre-check"));
    assert.ok(paths.path_3.includes("NO-OP"));
  });

  it("should score risk level accurately", () => {
    const dangerousRisk = calculateRiskScore("forge_shell", { CommandLine: "rm -rf /root/*" });
    assert.equal(dangerousRisk, 0.95);

    const highRisk = calculateRiskScore("forge_shell", { CommandLine: "git commit" });
    assert.equal(highRisk, 0.80);

    const safeRisk = calculateRiskScore("read_file", { path: "test.txt" });
    assert.equal(safeRisk, 0.15);
  });

  it("should generate a proper rollback strategy", () => {
    const fileRollback = generateRollback("write_file", { path: "test.txt" });
    assert.ok(fileRollback.includes("git checkout") || fileRollback.includes("rm -f"));

    const safeRollback = generateRollback("read_file", { path: "test.txt" });
    assert.ok(safeRollback.includes("No state rollback"));
  });

  it("should run a simulation pass and yield expected outputs", () => {
    const simSafe = runSimulationPass("read_file", {}, 0.15);
    assert.equal(simSafe.passed, true);
    assert.equal(simSafe.domain, "general");

    const simUnsafe = runSimulationPass("forge_shell", { CommandLine: "rm -rf /root/*" }, 0.95);
    assert.equal(simUnsafe.passed, false);
  });

  it("should execute full QQQ loop and write to VAULT999 receipt log", async () => {
    const receiptPath = "/root/VAULT999/qqq_receipts.jsonl";

    // Clean up if exists
    if (existsSync(receiptPath)) {
      try {
        unlinkSync(receiptPath);
      } catch {}
    }

    const record = await executeQQQ("write_file", { path: "test.txt" }, testIntent, testSession);

    assert.ok(record.qqq_id.startsWith("QQQ-"));
    assert.equal(record.intent, testIntent);
    assert.equal(record.tool_name, "write_file");
    assert.ok(record.vault_receipt_id);
    assert.ok(existsSync(receiptPath));

    const fileContent = readFileSync(receiptPath, "utf-8").trim();
    const loggedRecord = JSON.parse(fileContent);
    assert.equal(loggedRecord.qqq_id, record.qqq_id);
  });
});
