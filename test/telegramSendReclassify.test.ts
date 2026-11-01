/**
 * G1(a) — forge_telegram send must classify IRREVERSIBLE · HUMAN_RASA P0 REMEDIATION
 *
 * Gap: src/domain/governance/actionClassifier.ts:360-364 classified
 * forge_telegram send as EXECUTE_REVERSIBLE — but a sent Telegram message
 * cannot be recalled (external egress, no undo), matching gmail send's
 * IRREVERSIBLE treatment in gateMutate.
 *
 * Regression pins: non-send modes and the fail-closed floors must not move.
 * Fixtures are synthetic only (PERSON_A).
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  classifyTool,
  requires888Hold,
  requiresGovernance,
} from "../src/domain/governance/actionClassifier.js";

test("G1(a): forge_telegram send/send_message/send_file classify IRREVERSIBLE", () => {
  assert.equal(classifyTool("forge_telegram", "send"), "IRREVERSIBLE");
  assert.equal(classifyTool("forge_telegram", "send_message"), "IRREVERSIBLE");
  assert.equal(classifyTool("forge_telegram", "send_file"), "IRREVERSIBLE");
  // verb-carrier form (the 2026-10-25 carrier-fix path)
  assert.equal(classifyTool("forge_telegram", { verb: "send" }), "IRREVERSIBLE");

  // IRREVERSIBLE must route to the 888_HOLD consumers, not the reversible tier.
  assert.ok(requires888Hold(classifyTool("forge_telegram", "send")), "send must require 888_HOLD");
  assert.ok(requiresGovernance(classifyTool("forge_telegram", "send")));
});

test("G1(a) regression: non-send modes and floors do not move", () => {
  // get_me stays a read.
  assert.equal(classifyTool("forge_telegram", "get_me"), "OBSERVE");
  assert.equal(classifyTool("forge_telegram", { verb: "get_me" }), "OBSERVE");
  // Unknown verb on a required-carrier tool falls to the MUTATE floor
  // (the handler rejects it anyway).
  assert.equal(classifyTool("forge_telegram", { verb: "not_a_real_verb" }), "EXECUTE_REVERSIBLE");
  // Modeless / missing-carrier floor (registration-annotation path) unchanged.
  assert.equal(classifyTool("forge_telegram"), "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool("forge_telegram", {}), "EXECUTE_REVERSIBLE");
});
