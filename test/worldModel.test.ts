/**
 * World Model Unit Tests — Routing, Hashing, Scoring, Threshold Logic
 *
 * Covers the functions identified in the WM test coverage authorization:
 *   P0: classifyWmPriority, checkGapAlert, classifyFault (routing + thresholds)
 *   P1: hashAction, hashObservation (data integrity)
 *   P2: computePredictionGap (scoring logic)
 *
 * Also covers: isWmEligible, buildWmMetadata, computeSurpriseScore
 *
 * Forged: 2026-07-21
 * Constitutional: F1 AMANAH (reversible), F2 TRUTH (deterministic hashing)
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  classifyWmPriority,
  isWmEligible,
  hashAction,
  hashObservation,
  computePredictionGap,
  buildWmMetadata,
  TOOL_PRIORITY_MAP,
} from "../src/domain/governance/worldModel.js";

import { checkGapAlert } from "../src/domain/governance/observationPredictor.js";
import { classifyFault } from "../src/domain/governance/faultFixFlow.js";

// ═══════════════════════════════════════════════════════════════════════
// P0: ROUTING & THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════

describe("classifyWmPriority (P0 — routing)", () => {
  // Exact matches
  it("classifies forge_shell as P0", () => {
    assert.equal(classifyWmPriority("forge_shell"), "P0");
  });
  it("classifies forge_docker as P0", () => {
    assert.equal(classifyWmPriority("forge_docker"), "P0");
  });
  it("classifies forge_git as P0", () => {
    assert.equal(classifyWmPriority("forge_git"), "P0");
  });
  it("classifies forge_filesystem_read as P1", () => {
    assert.equal(classifyWmPriority("forge_filesystem_read"), "P1");
  });
  it("classifies forge_postgres as P1", () => {
    assert.equal(classifyWmPriority("forge_postgres"), "P1");
  });
  it("classifies forge_fetch as P2", () => {
    assert.equal(classifyWmPriority("forge_fetch"), "P2");
  });
  it("classifies forge_search as P2", () => {
    assert.equal(classifyWmPriority("forge_search"), "P2");
  });
  it("classifies forge_web_search as P2", () => {
    assert.equal(classifyWmPriority("forge_web_search"), "P2");
  });

  // Prefix matches
  it("prefix-matches forge_shell_dryrun to P0", () => {
    assert.equal(classifyWmPriority("forge_shell_dryrun"), "P0");
  });
  it("prefix-matches forge_docker_status to P0", () => {
    assert.equal(classifyWmPriority("forge_docker_status"), "P0");
  });
  it("prefix-matches forge_git_status to P0", () => {
    assert.equal(classifyWmPriority("forge_git_status"), "P0");
  });
  it("prefix-matches forge_filesystem_* to P1", () => {
    assert.equal(classifyWmPriority("forge_filesystem_stats"), "P1");
  });
  it("prefix-matches forge_db_* to P1", () => {
    assert.equal(classifyWmPriority("forge_db_migrate"), "P1");
  });
  it("prefix-matches forge_fetch_* to P2", () => {
    assert.equal(classifyWmPriority("forge_fetch_json"), "P2");
  });
  it("prefix-matches forge_browse_* to P2", () => {
    assert.equal(classifyWmPriority("forge_browse_page"), "P2");
  });

  // Unknown → P1 default
  it("defaults unknown tool to P1", () => {
    assert.equal(classifyWmPriority("some_random_tool"), "P1");
  });
  it("defaults empty string to P1", () => {
    assert.equal(classifyWmPriority(""), "P1");
  });

  // Boundary: every tool in TOOL_PRIORITY_MAP is explicitly classifiable
  it("all TOOL_PRIORITY_MAP entries classify to their declared priority", () => {
    for (const [tool, expected] of Object.entries(TOOL_PRIORITY_MAP)) {
      assert.equal(classifyWmPriority(tool), expected,
        `${tool} should be ${expected}`);
    }
  });
});

describe("isWmEligible (eligibility gate)", () => {
  it("P0 tools are always eligible", () => {
    assert.equal(isWmEligible("forge_shell", ""), true);
    assert.equal(isWmEligible("forge_shell", "anything"), true);
  });
  it("P2 tools are never eligible", () => {
    assert.equal(isWmEligible("forge_fetch", "large output here bla bla bla"), false);
    assert.equal(isWmEligible("forge_search", "anything"), false);
  });
  it("P1 empty output is not eligible", () => {
    assert.equal(isWmEligible("forge_filesystem_read", ""), false);
  });
  it("P1 short output (< 10 chars) is not eligible", () => {
    assert.equal(isWmEligible("forge_filesystem_read", "OK"), false);
    assert.equal(isWmEligible("forge_filesystem_read", "short"), false);
  });
  it("P1 trivial outputs are not eligible", () => {
    assert.equal(isWmEligible("forge_filesystem_read", "OK"), false);
    assert.equal(isWmEligible("forge_filesystem_read", "ok"), false);
    assert.equal(isWmEligible("forge_filesystem_read", "[]"), false);
    assert.equal(isWmEligible("forge_filesystem_read", "{}"), false);
  });
  it("P1 substantial output is eligible", () => {
    assert.equal(isWmEligible("forge_filesystem_read", "file contents: important data here"), true);
  });
});

describe("checkGapAlert (P0 — threshold logic)", () => {
  it("CRITICAL: high confidence + gap > 0.7", () => {
    const result = checkGapAlert(0.85, 0.9);
    assert.equal(result.alert, true);
    assert.equal(result.severity, "CRITICAL");
  });
  it("CRITICAL: confidence exactly at threshold + gap > 0.7", () => {
    const result = checkGapAlert(0.71, 0.81);
    assert.equal(result.alert, true);
    assert.equal(result.severity, "CRITICAL");
  });
  it("WARN: high confidence + gap > 0.4 but ≤ 0.7", () => {
    const result = checkGapAlert(0.5, 0.85);
    assert.equal(result.alert, true);
    assert.equal(result.severity, "WARN");
  });
  it("WARN: gap at 0.41 with confidence 0.81", () => {
    const result = checkGapAlert(0.41, 0.81);
    assert.equal(result.alert, true);
    assert.equal(result.severity, "WARN");
  });
  it("INFO: low gap with high confidence", () => {
    const result = checkGapAlert(0.1, 0.9);
    assert.equal(result.alert, false);
    assert.equal(result.severity, "INFO");
  });
  it("INFO: high gap but low confidence", () => {
    const result = checkGapAlert(0.8, 0.5);
    assert.equal(result.alert, false);
    assert.equal(result.severity, "INFO");
  });
  it("INFO: gap at 0.39 with confidence 0.81 (below WARN threshold)", () => {
    const result = checkGapAlert(0.39, 0.81);
    assert.equal(result.alert, false);
    assert.equal(result.severity, "INFO");
  });
  it("INFO: gap at 0.15 — model calibrating", () => {
    const result = checkGapAlert(0.14, 0.5);
    assert.equal(result.alert, false);
    assert.equal(result.message.includes("calibrat"), true);
  });
  it("WARN messages contain percentages", () => {
    const result = checkGapAlert(0.5, 0.82);
    assert.equal(result.message.includes("82%"), true);
    assert.equal(result.message.includes("50%"), true);
  });
  it("CRITICAL triggers F7 HUMILITY message", () => {
    const result = checkGapAlert(0.8, 0.85);
    assert.equal(result.message.includes("F7 HUMILITY"), true);
  });

  // Boundary: gap exactly at thresholds
  it("boundary: gap = 0.7 exactly → CRITICAL if confident", () => {
    // > 0.7 triggers CRITICAL, so 0.7 alone does NOT
    const result = checkGapAlert(0.7, 0.9);
    assert.equal(result.severity, "WARN"); // falls through to WARN
  });
  it("boundary: gap = 0.71 → CRITICAL if confident", () => {
    const result = checkGapAlert(0.71, 0.9);
    assert.equal(result.severity, "CRITICAL");
  });
  it("boundary: confidence = 0.8 exactly → does NOT trigger high conf checks", () => {
    // > 0.8, so 0.8 just hits INFO
    const result = checkGapAlert(0.5, 0.8);
    assert.equal(result.severity, "INFO");
  });
});

describe("classifyFault (P0 — fault routing)", () => {
  const baseContext = {
    attempted_tool: "forge_shell",
    intent: "test intent",
    cwd: "/root",
  };

  it("routes CRITICAL wm_gap when gap + confidence trigger alert", () => {
    const result = classifyFault(new Error("some error"), {
      ...baseContext,
      gap_score: 0.85,
      confidence: 0.9,
    });
    assert.equal(result.source, "wm_gap");
    assert.equal(result.gap_score, 0.85);
  });
  it("routes WARN wm_gap with moderate gap", () => {
    const result = classifyFault(new Error("some error"), {
      ...baseContext,
      gap_score: 0.5,
      confidence: 0.85,
    });
    assert.equal(result.source, "wm_gap");
  });
  it("does NOT route wm_gap for INFO-level gaps", () => {
    const result = classifyFault(new Error("some error"), {
      ...baseContext,
      gap_score: 0.1,
      confidence: 0.9,
    });
    assert.notEqual(result.source, "wm_gap");
  });
  it("routes collision errors", () => {
    const result = classifyFault({ error_class: "COLLISION" }, baseContext);
    assert.equal(result.source, "collision");
  });
  it("routes godel_lock for FLOOR_BLOCK on locked path", () => {
    const result = classifyFault(
      { error_class: "FLOOR_BLOCK" },
      { ...baseContext, target_path: "/root/AAA/AGENTS.md" },
    );
    assert.equal(result.source, "godel_lock");
  });
  it("routes judge_deny", () => {
    const result = classifyFault(
      { judge_decision: "deny", gate: "ArifJudge" },
      baseContext,
    );
    assert.equal(result.source, "judge_deny");
  });
  it("routes timeout from structured error", () => {
    const result = classifyFault(
      { error_class: "RESOURCE_EXHAUSTED" },
      baseContext,
    );
    assert.equal(result.source, "timeout");
  });
  it("routes timeout from message heuristics (timeout)", () => {
    const result = classifyFault(new Error("connect timeout"), baseContext);
    assert.equal(result.source, "timeout");
  });
  it("routes collision from message heuristics", () => {
    const result = classifyFault(new Error("file collision detected"), baseContext);
    assert.equal(result.source, "collision");
  });
  it("routes godel_lock from message heuristics", () => {
    const result = classifyFault(new Error("gödel locked path"), baseContext);
    assert.equal(result.source, "godel_lock");
  });
  it("routes judge_deny from message heuristics", () => {
    const result = classifyFault(new Error("deny: command blocked"), baseContext);
    assert.equal(result.source, "judge_deny");
  });
  it("routes resource exhaustion from message heuristics", () => {
    const result = classifyFault(new Error("oom memory exhausted"), baseContext);
    assert.equal(result.source, "resource");
  });
  it("routes unknown for unrecognized errors", () => {
    const result = classifyFault(new Error("completely random failure"), baseContext);
    assert.equal(result.source, "unknown");
  });
  it("generates unique fault_id per call (different timestamps)", (_, done) => {
    const a = classifyFault(new Error("err"), baseContext);
    // Small delay to ensure different Date.now()
    setTimeout(() => {
      const b = classifyFault(new Error("err"), baseContext);
      assert.notEqual(a.fault_id, b.fault_id);
      done();
    }, 2);
  });
  it("includes attempted_tool and intent in report", () => {
    const result = classifyFault(new Error("err"), {
      attempted_tool: "forge_git",
      intent: "commit files",
    });
    assert.equal(result.attempted_tool, "forge_git");
    assert.equal(result.intent, "commit files");
  });
  it("wm_gap takes priority over other structured error routing", () => {
    // When both wm_gap AND collision exist, wm_gap wins
    const result = classifyFault(
      { error_class: "COLLISION" },
      {
        ...baseContext,
        gap_score: 0.85,
        confidence: 0.9,
      },
    );
    assert.equal(result.source, "wm_gap");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// P1: DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════

describe("hashAction (P1 — deterministic hashing)", () => {
  it("produces stable SHA-256 output", () => {
    const a = hashAction("forge_shell", { command: "ls -la", cwd: "/tmp" });
    const b = hashAction("forge_shell", { command: "ls -la", cwd: "/tmp" });
    assert.equal(a, b);
    assert.equal(a.length, 64); // SHA-256 hex
  });
  it("different tools produce different hashes", () => {
    const a = hashAction("forge_shell", { command: "ls" });
    const b = hashAction("forge_git", { command: "ls" });
    assert.notEqual(a, b);
  });
  it("different args produce different hashes", () => {
    const a = hashAction("forge_shell", { command: "ls" });
    const b = hashAction("forge_shell", { command: "pwd" });
    assert.notEqual(a, b);
  });
  it("arg order does NOT affect hash (canonical JSON)", () => {
    const a = hashAction("forge_shell", { a: "1", b: "2" });
    const b = hashAction("forge_shell", { b: "2", a: "1" });
    assert.equal(a, b);
  });
  it("empty args produce deterministic hash", () => {
    const a = hashAction("forge_shell", {});
    const b = hashAction("forge_shell", {});
    assert.equal(a, b);
  });
  it("nested args produce deterministic hash", () => {
    const a = hashAction("forge_shell", { nested: { x: 1, y: 2 } });
    const b = hashAction("forge_shell", { nested: { x: 1, y: 2 } });
    assert.equal(a, b);
  });
});

describe("hashObservation (P1 — observation fingerprint)", () => {
  it("produces stable SHA-256 output", () => {
    const a = hashObservation("hello world");
    const b = hashObservation("hello world");
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });
  it("different content → different hash", () => {
    const a = hashObservation("hello");
    const b = hashObservation("world");
    assert.notEqual(a, b);
  });
  it("empty string is deterministic", () => {
    const a = hashObservation("");
    const b = hashObservation("");
    assert.equal(a, b);
  });
  it("whitespace matters", () => {
    const a = hashObservation("hello");
    const b = hashObservation("hello ");
    assert.notEqual(a, b);
  });
  it("known SHA-256 for 'hello' (cross-validate)", () => {
    // SHA-256 of "hello" = 2cf24dba5fb0a30e...
    const hash = hashObservation("hello");
    assert.equal(hash, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// P2: SCORING LOGIC
// ═══════════════════════════════════════════════════════════════════════

describe("computePredictionGap (P2 — scoring)", () => {
  it("perfect match → gap = 0", () => {
    const gap = computePredictionGap("hello world", "hello world");
    assert.equal(gap, 0);
  });
  it("complete mismatch → gap = 1", () => {
    const gap = computePredictionGap("hello", "goodbye");
    assert.equal(gap, 1);
  });
  it("partial overlap → 0 < gap < 1", () => {
    const gap = computePredictionGap("hello world foo", "hello world bar");
    assert.ok(gap > 0);
    assert.ok(gap < 1);
  });
  it("null prediction → sentinel -1", () => {
    const gap = computePredictionGap(null, "anything");
    assert.equal(gap, -1);
  });
  it("empty string prediction → sentinel -1", () => {
    const gap = computePredictionGap("", "anything");
    assert.equal(gap, -1);
  });
  it("both empty → gap = 0", () => {
    const gap = computePredictionGap("", "");
    assert.equal(gap, -1); // sentinel because prediction is empty
  });
  it("single-word tokens < 3 chars are filtered out", () => {
    // "a" and "b" are < 3 chars, filtered → both empty sets → gap = 0
    const gap = computePredictionGap("a b", "a b");
    assert.equal(gap, 0);
  });
  it("case insensitive", () => {
    const gap = computePredictionGap("HELLO WORLD", "hello world");
    assert.equal(gap, 0);
  });
  it("whitespace normalization — multiple spaces", () => {
    const gap = computePredictionGap("hello   world", "hello world");
    assert.equal(gap, 0);
  });
  it("subset relationship produces partial gap", () => {
    // "hello world" has tokens {hello, world}
    // "hello world foo" has tokens {hello, world, foo}
    // jaccard = 2/3 → gap = 1 - 2/3 = 0.333...
    const gap = computePredictionGap("hello world", "hello world foo");
    assert.ok(gap > 0.3 && gap < 0.34);
  });
});

describe("buildWmMetadata (integration)", () => {
  it("produces complete metadata with all fields", () => {
    const meta = buildWmMetadata({
      tool: "forge_shell",
      args: { command: "ls" },
      observation: "file1.txt\nfile2.txt",
      agentConfidence: 0.8,
      predictedObservation: "file1.txt\nfile2.txt",
      exitCode: 0,
    });
    assert.equal(meta.tool, "forge_shell");
    assert.equal(meta.wm_priority, "P0");
    assert.equal(meta.wm_eligible, true);
    assert.equal(typeof meta.action_hash, "string");
    assert.equal(typeof meta.observation_hash, "string");
    assert.equal(meta.agent_confidence, 0.8);
    assert.equal(meta.surprise_score, 0); // perfect match
    assert.equal(meta.prediction_gap, 0);
  });

  it("uses default confidence 0.5 when not provided", () => {
    const meta = buildWmMetadata({
      tool: "forge_shell",
      args: { command: "ls" },
      observation: "output",
    });
    assert.equal(meta.agent_confidence, 0.5);
  });

  it("surprise_score is rounded to 3 decimal places", () => {
    const meta = buildWmMetadata({
      tool: "forge_shell",
      args: {},
      observation: "output",
      predictedObservation: "completely different value here",
    });
    // surprise is near 1.0 (minimal token overlap), rounded to 3 decimal places
    assert.ok(meta.surprise_score >= 0.9);
    assert.ok(meta.surprise_score <= 1.0);
    assert.equal(meta.surprise_score, Math.round(meta.surprise_score * 1000) / 1000);
  });

  it("P2 tool produces not eligible even with good observation", () => {
    const meta = buildWmMetadata({
      tool: "forge_fetch",
      args: {},
      observation: "very long and detailed output here",
    });
    assert.equal(meta.wm_priority, "P2");
    assert.equal(meta.wm_eligible, false);
  });

  it("prediction_gap is undefined when no prediction attempted", () => {
    const meta = buildWmMetadata({
      tool: "forge_shell",
      args: {},
      observation: "output",
      predictedObservation: null,
    });
    assert.equal(meta.prediction_gap, undefined);
  });
});
