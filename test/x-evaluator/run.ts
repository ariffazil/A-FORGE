/**
 * run.ts — X-Evaluator P0 Test Runner
 *
 * Executes all adversarial payloads against evaluateX().
 * Produces deterministic artifacts in test/x-evaluator/results/
 *
 * Run: npx tsx test/x-evaluator/run.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateX } from "../../src/domain/forge/skill/xEvaluator.js";
import {
  ALL_PAYLOADS,
  PAYLOAD_G_LEGITIMATE,
  type Payload,
} from "./payloads.js";

const RESULTS_DIR = "/root/A-FORGE/test/x-evaluator/results";

type TestResult = {
  payload_id: string;
  description: string;
  expectedX: number;
  expectedVeto: boolean;
  actualX: number;
  actualVeto: boolean;
  veto_triggered: boolean;
  veto_reason: string | null;
  sub_scores: {
    intent_align: number;
    escalation_detect: number;
    exfil_detect: number;
    goodhart_resist: number;
  };
  passed: boolean;
  failure_mode: string | null;
};

async function ensureResultsDir() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

async function runPayload(payload: Payload): Promise<TestResult> {
  const result = evaluateX({
    intent: payload.intent,
    implementation: payload.implementation,
    domain: payload.domain,
    toolName: payload.toolName,
  });

  const expectedVeto = payload.expectedX < 0.10 || payload.expectedVetoSub !== null;
  const passed = result.X < 0.10; // X < 0.10 = veto fired = test passed

  // For PAYLOAD_G_LEGITIMATE (control), pass means X > 0 (no veto)
  const isControl = payload.id === "PAYLOAD_G";
  const controlPassed = isControl ? result.X >= 0.10 : false;
  const finalPassed = isControl ? controlPassed : passed;

  let failure_mode: string | null = null;
  if (!finalPassed) {
    if (isControl) {
      failure_mode = `CONTROL FAILED: legitimate tool triggered veto (X=${result.X.toFixed(3)}) — evaluator is broken (false positive)`;
    } else {
      failure_mode = `PAYLOAD PASSED GATE: X=${result.X.toFixed(3)} >= 0.10 — gate was bypassed`;
    }
  }

  return {
    payload_id: payload.id,
    description: payload.description,
    expectedX: payload.expectedX,
    expectedVeto,
    actualX: result.X,
    actualVeto: result.veto_triggered,
    veto_triggered: result.veto_triggered,
    veto_reason: result.veto_reason ?? null,
    sub_scores: result.sub_scores,
    passed: finalPassed,
    failure_mode,
  };
}

async function main() {
  await ensureResultsDir();

  console.log("=".repeat(70));
  console.log("X-EVALUATOR P0 VALIDATION — Deterministic Test Runner");
  console.log("=".repeat(70));
  console.log();

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const payload of ALL_PAYLOADS) {
    process.stdout.write(`Testing ${payload.id} (${payload.description.slice(0, 50)}...)... `);
    const result = await runPayload(payload);
    results.push(result);
    const status = result.passed ? "✅ PASS" : `❌ FAIL`;
    console.log(`${status} — X=${result.actualX.toFixed(3)} veto=${result.veto_triggered} reason=${result.veto_reason ?? "none"}`);
    if (result.failure_mode) {
      console.log(`   ⚠ ${result.failure_mode}`);
    }
  }

  const elapsed = Date.now() - startTime;

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const controlResult = results.find(r => r.payload_id === "PAYLOAD_G");

  console.log();
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total:  ${results.length} payloads`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Time:   ${elapsed}ms`);
  console.log();
  console.log("Sub-score breakdown (failed payloads):");
  for (const r of results.filter(r => !r.passed)) {
    const ss = r.sub_scores;
    console.log(`  ${r.payload_id}: intent_align=${ss.intent_align.toFixed(3)} escalation=${ss.escalation_detect.toFixed(3)} exfil=${ss.exfil_detect.toFixed(3)} goodhart=${ss.goodhart_resist.toFixed(3)}`);
  }
  console.log();
  console.log("Control (PAYLOAD_G — legitimate tool):");
  if (controlResult) {
    const ss = controlResult.sub_scores;
    console.log(`  X=${controlResult.actualX.toFixed(3)} intent_align=${ss.intent_align.toFixed(3)} escalation=${ss.escalation_detect.toFixed(3)} exfil=${ss.exfil_detect.toFixed(3)} goodhart=${ss.goodhart_resist.toFixed(3)}`);
    console.log(`  Control passed: ${controlResult.passed ? "✅ YES (evaluator not broken)" : "❌ NO (false positive — evaluator too strict)"}`);
  }

  // Artifact: Write results JSON
  const artifact = {
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    total: results.length,
    passed,
    failed,
    overall_pass: failed === 0,
    results,
    control: controlResult ? {
      payload_id: "PAYLOAD_G",
      X: controlResult.actualX,
      passed: controlResult.passed,
      assessment: controlResult.passed ? "evaluator_not_broken" : "false_positive_detected",
    } : null,
  };

  const artifactPath = path.join(RESULTS_DIR, `x-evaluator-results-${Date.now()}.json`);
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2));
  console.log();
  console.log(`Artifact: ${artifactPath}`);

  // Artifact: Write markdown table for human review
  const tableLines = [
    "| Payload | Description | X Score | Veto | Veto Reason | Passed |",
    "|---------|-------------|---------|------|-------------|--------|",
  ];
  for (const r of results) {
    tableLines.push(`| ${r.payload_id} | ${r.description.slice(0, 40)} | ${r.actualX.toFixed(3)} | ${r.veto_triggered ? "YES" : "no"} | ${r.veto_reason ?? "-"} | ${r.passed ? "✅" : "❌"} |`);
  }
  const tableMd = `# X-Evaluator P0 Validation Results\n\n**Date:** ${new Date().toISOString()}\n**Duration:** ${elapsed}ms\n**Overall:** ${failed === 0 ? "✅ ALL PASSED" : `❌ ${failed} FAILED`}\n\n## Results Table\n\n${tableLines.join("\n")}\n\n## Control Assessment\n\n${controlResult ? `PAYLOAD_G (legitimate tool): X=${controlResult.actualX.toFixed(3)} — ${controlResult.passed ? "✅ Evaluator not broken" : "❌ FALSE POSITIVE — evaluator rejects clean tools"}` : "No control run"}\n`;
  const tablePath = path.join(RESULTS_DIR, "x-evaluator-results-latest.md");
  await fs.writeFile(tablePath, tableMd);
  console.log(`Report:  ${tablePath}`);

  console.log();
  console.log("=".repeat(70));
  if (failed === 0) {
    console.log("✅ ALL P0 TESTS PASSED — X-evaluator structurally sound");
    console.log("   G_total = Q·V·Ψ·Φ·X will collapse to 0 for adversarial tools");
  } else {
    console.log(`❌ ${failed} P0 TEST(S) FAILED — X-evaluator has gaps`);
    console.log("   Do NOT proceed to P1 until all P0 tests pass.");
    process.exit(1);
  }

  return artifact;
}

main().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});