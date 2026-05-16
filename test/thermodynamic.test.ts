import test from "node:test";
import assert from "node:assert/strict";
import { ThermodynamicCostEstimator } from "../src/ops/ThermodynamicCostEstimator.js";
import {
  KAPPA_R_THRESHOLD,
  BLAST_RADIUS_THRESHOLD,
} from "../src/types/wealth.js";

const estimator = new ThermodynamicCostEstimator();

test("ThermodynamicCostEstimator — read_file returns PASS, LOW band", () => {
  const result = estimator.estimateWithWealth("read_file", { path: "foo.txt" });
  assert.equal(result.verdict, "PASS");
  assert.equal(result.cost.thermodynamicBand, "LOW");
  assert.equal(result.cost.landauerCost, 0.05);
  assert.equal(result.cost.kappa_r, 1.0);
  assert.equal(result.cost.blastRadius, 0);
});

test("ThermodynamicCostEstimator — sudo rm -rf /production triggers VOID (blast radius critical)", () => {
  const result = estimator.estimateWithWealth("run_command", {
    command: "sudo rm -rf /production/data",
  });
  assert.equal(result.verdict, "VOID");
  assert.ok(result.violations.some((v) => v.includes("BLAST_RADIUS")));
});

test("ThermodynamicCostEstimator — kubectl delete prod triggers VOID (blast radius critical)", () => {
  const result = estimator.estimateWithWealth("run_command", {
    command: "kubectl delete pod production-api",
  });
  assert.equal(result.verdict, "VOID");
  assert.ok(result.violations.some((v) => v.includes("BLAST_RADIUS")));
});

test("ThermodynamicCostEstimator — apply_patches is LOW band and passes", () => {
  const result = estimator.estimateWithWealth("apply_patches", {
    patches: [
      {
        file_path: "src/foo.ts",
        unified_diff: "--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,4 @@\n+// new line\n",
      },
    ],
  });
  assert.equal(result.verdict, "PASS");
  assert.equal(result.cost.thermodynamicBand, "MEDIUM");
  assert.ok(result.cost.blastRadius < BLAST_RADIUS_THRESHOLD);
});

test("ThermodynamicCostEstimator — quickEntropyCheck PASS for safe tools", () => {
  const result = estimator.quickEntropyCheck("read_file", { path: "foo.txt" }, 0.1);
  assert.equal(result.verdict, "PASS");
  assert.ok(result.dS >= 0);
});

test("ThermodynamicCostEstimator — quickEntropyCheck HOLD when dS spikes after high prior risk", () => {
  const result = estimator.quickEntropyCheck("run_command", { command: "sudo rm -rf /data" }, 0.8);
  assert.equal(result.verdict, "HOLD");
});

test("ThermodynamicCostEstimator — computeEMV positive for viable scenario", () => {
  const result = estimator.computeEMV({
    name: "Oilfield Development",
    initialInvestment: 100,
    discountRate: 0.1,
    riskFreeRate: 0.04,
    cashFlows: [
      { period: 1, amount: 100, probability: 0.8 },
      { period: 2, amount: 100, probability: 0.8 },
    ],
  });
  assert.equal(result.emv, 60);
  assert.ok(result.emv > 0);
  assert.ok(result.reason.includes("positive expected value"));
});

test("ThermodynamicCostEstimator — computeEMV negative for loss scenario", () => {
  const result = estimator.computeEMV({
    name: "Failed Prospect",
    initialInvestment: 100,
    discountRate: 0.1,
    riskFreeRate: 0.04,
    cashFlows: [
      { period: 1, amount: 20, probability: 0.3 },
      { period: 2, amount: 10, probability: 0.2 },
    ],
  });
  assert.ok(result.emv < 0);
  assert.ok(result.reason.includes("negative expected value"));
});

test("ThermodynamicCostEstimator — computeNPV positive for viable investment", () => {
  const result = estimator.computeNPV({
    name: "Development Project",
    initialInvestment: 100,
    discountRate: 0.1,
    riskFreeRate: 0.04,
    cashFlows: [
      { period: 1, amount: 60, probability: 1.0 },
      { period: 2, amount: 70, probability: 1.0 },
    ],
  });
  assert.ok(result.npv > 0);
  assert.equal(result.presentValues.length, 2);
});

test("ThermodynamicCostEstimator — computeNPV negative for non-viable investment", () => {
  const result = estimator.computeNPV({
    name: "Loss Project",
    initialInvestment: 100,
    discountRate: 0.15,
    riskFreeRate: 0.04,
    cashFlows: [
      { period: 1, amount: 10, probability: 1.0 },
      { period: 2, amount: 20, probability: 1.0 },
    ],
  });
  assert.ok(result.npv < 0);
  assert.ok(result.reason.includes("not viable"));
});

test("ThermodynamicCostEstimator — all tool bands are valid (LOW/MEDIUM/HIGH/CRITICAL)", () => {
  const tools = ["read_file", "list_files", "grep_text", "apply_patches", "write_file", "run_tests", "run_command"] as const;
  for (const toolName of tools) {
    const cost = estimator.estimate(toolName, {});
    assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(cost.thermodynamicBand));
  }
});

test("ThermodynamicCostEstimator — estimateWithWealth enriches with EMV/NPV when scenario provided", () => {
  const scenario = {
    name: "Test",
    initialInvestment: 100,
    discountRate: 0.1,
    riskFreeRate: 0.04,
    cashFlows: [{ period: 1, amount: 150, probability: 0.8 }],
  };
  const result = estimator.estimateWithWealth("read_file", { path: "foo.txt" }, scenario);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.cost.emv, 20);
  assert.ok(result.cost.npv > 0);
});

test("ThermodynamicCostEstimator — getThermodynamicEstimator returns instance", async () => {
  const { getThermodynamicEstimator } = await import("../src/ops/ThermodynamicCostEstimator.js");
  const instance = getThermodynamicEstimator();
  assert.ok(instance instanceof ThermodynamicCostEstimator);
});

test("ThermodynamicCostEstimator — worst-case run_command lands in HIGH or CRITICAL band", () => {
  const worstCase = estimator.estimate("run_command", {
    command: "sudo rm -rf /production --no-preserve-root",
  });
  assert.ok(
    worstCase.thermodynamicBand === "HIGH" || worstCase.thermodynamicBand === "CRITICAL",
  );
});
