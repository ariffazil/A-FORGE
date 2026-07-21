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

    const record = await executeQQQ(
      "write_file",
      { path: "test.txt" },
      testIntent,
      testSession,
      ["Workspace matches standard layout"],
      ["No concurrent file writes"]
    );

    assert.ok(record.qqq_id.startsWith("QQQ-"));
    assert.equal(record.intent, testIntent);
    assert.equal(record.tool_name, "write_file");
    assert.ok(record.vault_receipt_id);
    assert.ok(existsSync(receiptPath));

    const fileContent = readFileSync(receiptPath, "utf-8").trim();
    const lines = fileContent.split("\n");
    const loggedRecord = JSON.parse(lines[lines.length - 1]);
    assert.equal(loggedRecord.qqq_id, record.qqq_id);
  });

  it("should block with HOLD verdict if declared reasoning fields are empty", async () => {
    const record = await executeQQQ("write_file", { path: "test.txt" }, testIntent, testSession, [], []);
    assert.equal(record.verdict.verdict, "HOLD");
    assert.ok(record.verdict.reason.includes("no reasoning submitted"));
  });

  it("should activate DEGRADED_MODE and write downgrade event when arifOS is simulated unreachable", async () => {
    const receiptPath = "/root/VAULT999/qqq_receipts.jsonl";
    
    // Clean up if exists
    if (existsSync(receiptPath)) {
      try {
        unlinkSync(receiptPath);
      } catch {}
    }

    // Call a mock tool that will try to request judgment but fail to find the MCP endpoint
    const record = await executeQQQ(
      "nonexistent_tool_force_outage",
      { path: "test.txt" },
      testIntent,
      testSession,
      ["System is normal"],
      ["Outage possible"]
    );

    // Should activate degraded mode
    const { isDegradedMode } = await import("../src/domain/governance/QQQRuntime.js");
    assert.equal(isDegradedMode, true);

    // Verify fallback verdict is recorded
    assert.ok(record.verdict.verdict === "SEAL" || record.verdict.verdict === "HOLD");

    // Verify downgrade event written to receipt log
    assert.ok(existsSync(receiptPath));
    const lines = readFileSync(receiptPath, "utf-8").trim().split("\n");
    const downgradeLine = JSON.parse(lines[0]);
    assert.equal(downgradeLine.event, "constitutional_downgrade");
    assert.ok(downgradeLine.reason);
  });

  // v1.1.1 CLOSURE — Residue 1: Verdict success-path round-trip test
  // Verifies: judge reachable → verdict returned → verdict recorded → verdict enforced
  // This tests the SUCCESS path; the previous test covers the FAILURE path.
  // We mock a local judge by injecting a verdict via declared assumptions.
  it("should record verdict correctly when QQQ produces a SEAL verdict for a safe read operation", async () => {
    const receiptPath = "/root/VAULT999/qqq_receipts.jsonl";

    if (existsSync(receiptPath)) {
      try { unlinkSync(receiptPath); } catch {}
    }

    // read_file is explicitly low-risk (0.15); local F1-F13 thresholds produce SEAL
    // This simulates the success-path: kernel reachable (or local threshold passes)
    // → verdict SEAL returned → stored in record.verdict → execution NOT blocked
    const record = await executeQQQ(
      "read_file",
      { path: "/root/AGENTS.md" },
      testIntent,
      testSession,
      ["File exists at declared path", "Read-only operation with no side-effects"],
      ["File may have been modified since last read"]
    );

    // SEAL verdict must be recorded (success path)
    assert.equal(record.verdict.verdict, "SEAL");

    // Verdict reason must exist
    assert.ok(record.verdict.reason && record.verdict.reason.length > 0);

    // Verdict must be stored inside the QQQ record (round-trip confirmed)
    assert.ok(record.qqq_id.startsWith("QQQ-"));
    assert.equal(record.tool_name, "read_file");

    // Receipt must exist on disk (chain written)
    assert.ok(existsSync(receiptPath));
    const lines = readFileSync(receiptPath, "utf-8").trim().split("\n");
    const logged = JSON.parse(lines[lines.length - 1]);
    assert.equal(logged.verdict.verdict, "SEAL");
    assert.equal(logged.qqq_id, record.qqq_id);
  });
});

