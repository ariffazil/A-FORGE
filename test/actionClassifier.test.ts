/**
 * actionClassifier regression pins — H6 (2026-09-27).
 *
 * Born from the 333-AGI mutation-model audit (sovereign directive):
 *  - P1: forge_transfer_confirm (money) was EXECUTE_REVERSIBLE while its own
 *    comment said HIGH_IMPACT ("moved below" never executed) — silent lenient
 *    drift = CSA "safety co-option" class. Pinned HIGH_IMPACT forever below.
 *  - Ghost dual-classifications (github writers in two sets) — pinned to their
 *    severity-wins resolution.
 *  - Name drift (forge_cool, forge_compose live but unclassified → fail-closed
 *    HOLD blocked even reads) — pinned classified.
 *  - Fail-closed contract: unknown tool → IRREVERSIBLE fallback +
 *    isClassifiedTool=false (policy gate forces HOLD).
 *
 * Any future edit that weakens these pins fails the build. Ratchet, not dial.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTool,
  isClassifiedTool,
  requiresGovernance,
  requires888Hold,
} from "../src/domain/governance/actionClassifier.js";

test("H1: money/send/sealed-execute tools are EXECUTE_HIGH_IMPACT", () => {
  for (const t of ["forge_transfer_confirm", "forge_send_confirm", "forge_execute_sealed"]) {
    assert.equal(classifyTool(t), "EXECUTE_HIGH_IMPACT", `${t} must be HIGH_IMPACT (money/egress/sealed execution)`);
    assert.equal(requires888Hold(classifyTool(t)), true, `${t} must require 888_HOLD`);
    assert.equal(requiresGovernance(classifyTool(t)), true, `${t} must require governance`);
  }
});

test("H2: github writers resolve to their severe class (no ghost leniency)", () => {
  assert.equal(classifyTool("forge_github_create_or_update_file"), "IRREVERSIBLE");
  assert.equal(classifyTool("forge_github_create_issue"), "EXECUTE_HIGH_IMPACT");
});

test("H3: forge_predict stays OBSERVE (pure evidence tool, no session gating)", () => {
  assert.equal(classifyTool("forge_predict"), "OBSERVE");
  assert.equal(requiresGovernance("OBSERVE"), false);
});

test("H4: former name-drift tools are classified (no fail-closed HOLD on live surface)", () => {
  assert.equal(isClassifiedTool("forge_cool"), true);
  assert.equal(classifyTool("forge_cool"), "OBSERVE");
  assert.equal(isClassifiedTool("forge_compose"), true);
  // compose is mode-aware
  assert.equal(classifyTool("forge_compose", "status"), "OBSERVE");
  assert.equal(classifyTool("forge_compose", "analyze"), "OBSERVE");
  assert.equal(classifyTool("forge_compose", "execute"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_compose", "cancel"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("auth_pipeline"), "OBSERVE");
});

test("fail-closed contract: unknown tool → IRREVERSIBLE fallback, unclassified, gate HOLDs", () => {
  const unknown = "forge_definitely_not_a_real_tool_xyz";
  assert.equal(classifyTool(unknown), "IRREVERSIBLE", "unknown tools must fall to max blast radius");
  assert.equal(isClassifiedTool(unknown), false, "unknown tools must be interceptable by policy gate");
  assert.equal(requires888Hold("IRREVERSIBLE"), true);
});

test("seals are IRREVERSIBLE (constitutional floor)", () => {
  for (const t of ["forge_seal", "forge_visual_seal", "arif_seal"]) {
    assert.equal(classifyTool(t), "IRREVERSIBLE", `${t} must never be downgraded`);
  }
});

test("mode-aware filesystem ladder: read < write < delete", () => {
  assert.equal(classifyTool("forge_filesystem", "read"), "OBSERVE");
  assert.equal(classifyTool("forge_filesystem", "grep"), "OBSERVE");
  assert.equal(classifyTool("forge_filesystem", "write"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_filesystem", "patch"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_filesystem", "delete"), "EXECUTE_HIGH_IMPACT");
  assert.equal(classifyTool("forge_filesystem"), "OBSERVE", "modeless pre-classification must not block reads");
});

test("mode-aware vault: append-only write is REVERSIBLE, read is OBSERVE", () => {
  assert.equal(classifyTool("forge_vault", "read"), "OBSERVE");
  assert.equal(classifyTool("forge_vault", "write"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_vault"), "OBSERVE");
});

test("shell is governed EXECUTE_REVERSIBLE (T1 2026-07-19 pin)", () => {
  assert.equal(classifyTool("forge_shell"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_shell_dryrun"), "OBSERVE");
  assert.equal(requiresGovernance(classifyTool("forge_shell")), true);
});

test("severity ordering: IRREVERSIBLE outranks every class", () => {
  const order = [
    "IRREVERSIBLE",
    "EXECUTE_HIGH_IMPACT",
    "EXECUTE_REVERSIBLE",
    "QUEUE",
    "DRAFT",
    "SIMULATE",
    "SUGGEST",
    "OBSERVE",
  ] as const;
  for (let i = 0; i < order.length - 1; i++) {
    assert.equal(
      requires888Hold(order[i]) || !requires888Hold(order[i + 1]),
      true,
      `888_HOLD must cover ${order[i]} at least as strictly as ${order[i + 1]}`
    );
  }
  assert.equal(requires888Hold("EXECUTE_HIGH_IMPACT"), true);
  assert.equal(requires888Hold("EXECUTE_REVERSIBLE"), false);
  assert.equal(requires888Hold("OBSERVE"), false);
});
