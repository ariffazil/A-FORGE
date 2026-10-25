/**
 * classifierCoverage — registry ↔ live-surface parity gate.
 *
 * Makes true the claim written in actionClassifier.ts: "CI coverage test fails
 * the build when any live tool is unclassified or any entry here is dead."
 * Until this file existed, `classifiedToolRegistry()` had ZERO consumers and
 * that claim was documentation only (declared gate, absent gate).
 *
 * Ratchet, not a dial:
 *  - every name on the live A-FORGE surface (tools_sot.yaml, generated from
 *    the :7072 tools/list) MUST be explicitly classified;
 *  - every classified name MUST be live on A-FORGE, or on the explicit
 *    cross-organ allowlist below (verified on that organ, not here);
 *  - an implausibly small SOT parse FAILS instead of passing vacuously — a
 *    gate that passes on no data is worse than no gate;
 *  - the unknown-tool contract stays the MUTATE floor.
 *
 * 2026-10-26 · 333-AGI · FEDERATION_HARDENING P1 follow-up.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyTool,
  classifiedToolRegistry,
  isClassifiedTool,
  requiresGovernance,
  MUTATE_FLOOR,
  type ActionClass,
} from "../src/domain/governance/actionClassifier.js";

/** Resolve repo root without assuming cwd (canonical runner runs at root). */
function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [process.cwd(), resolve(here, "..", ".."), resolve(here, "..", "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "tools_sot.yaml"))) return candidate;
  }
  throw new Error(`tools_sot.yaml not found from any of: ${candidates.join(", ")}`);
}

const SOT_PATH = resolve(repoRoot(), "tools_sot.yaml");

/** Live A-FORGE tool names from the registry SOT. */
function liveTools(): string[] {
  const yaml = readFileSync(SOT_PATH, "utf8");
  const names = Array.from(
    yaml.matchAll(/^\s*-\s*name:\s*["']?([A-Za-z0-9_]+)/gm),
    (match) => match[1],
  );
  return Array.from(new Set(names)).sort();
}

/**
 * Classified names deliberately NOT on A-FORGE's own surface: they live on
 * another organ and are classified here so cross-organ dispatch is governed.
 * Explicit pins — a new cross-organ tool must be added deliberately, never
 * inherit permission from a name prefix.
 */
const CROSS_ORGAN_ALLOWLIST = new Set<string>([
  // arifOS kernel :8088 — constitutional verbs (the legal path, not a bypass)
  "arif_init",
  "arif_observe",
  "arif_think",
  "arif_route",
  "arif_memory",
  "arif_judge",
  "arif_forge",
  "arif_seal",
  "arif_report",
  // GEOX :8081
  "geox_prospect",
  "geox_seismic_compute",
]);

const VALID_CLASSES: ActionClass[] = [
  "OBSERVE",
  "SUGGEST",
  "SIMULATE",
  "DRAFT",
  "QUEUE",
  "EXECUTE_REVERSIBLE",
  "EXECUTE_HIGH_IMPACT",
  "IRREVERSIBLE",
];

test("SOT parse is non-vacuous: the live surface has plausibly many tools", () => {
  const live = liveTools();
  assert.ok(
    live.length >= 100,
    `tools_sot.yaml parsed to only ${live.length} tools — refusing to pass vacuously. ` +
      "A coverage gate that passes on an empty parse is worse than no gate.",
  );
});

test("every live A-FORGE tool is explicitly classified", () => {
  const unclassified = liveTools().filter((tool) => !isClassifiedTool(tool));
  assert.deepEqual(
    unclassified,
    [],
    `live tools missing from actionClassifier.ts: ${unclassified.join(", ")}. ` +
      "An unclassified tool is held at McpPolicyGate L4b — a read blocks, " +
      "and a write has no declared class. Add each to the correct set.",
  );
});

test("every live tool resolves to a defined action class", () => {
  for (const tool of liveTools()) {
    const resolved = classifyTool(tool) as string;
    assert.ok(
      VALID_CLASSES.includes(resolved as ActionClass),
      `${tool} resolved to "${resolved}", which is not an ActionClass`,
    );
  }
});

test("no dead classifier entries: classified ⊆ live A-FORGE ∪ cross-organ", () => {
  const live = new Set(liveTools());
  const dead = classifiedToolRegistry()
    .filter((tool) => !live.has(tool) && !CROSS_ORGAN_ALLOWLIST.has(tool))
    .sort();
  assert.deepEqual(
    dead,
    [],
    `classifier names a tool that is live nowhere: ${dead.join(", ")}. ` +
      "Registry-is-SOT: delete the entry, or pin it in CROSS_ORGAN_ALLOWLIST " +
      "with a note saying which organ serves it.",
  );
});

test("cross-organ allowlist stays honest: each pinned name is classified", () => {
  for (const tool of CROSS_ORGAN_ALLOWLIST) {
    assert.equal(
      isClassifiedTool(tool),
      true,
      `CROSS_ORGAN_ALLOWLIST pins ${tool} but the classifier does not know it — dead pin`,
    );
  }
});

test("unknown-tool contract: MUTATE floor, unclassified, governance required", () => {
  const unknown = "forge_tool_that_does_not_exist_20261026";
  assert.equal(MUTATE_FLOOR, "EXECUTE_REVERSIBLE", "the MUTATE floor is pinned");
  assert.equal(classifyTool(unknown), MUTATE_FLOOR, "unknown tools fall to the MUTATE floor");
  assert.equal(isClassifiedTool(unknown), false, "unknown tools stay interceptable by L4b");
  assert.equal(requiresGovernance(classifyTool(unknown)), true, "unknown tools require governance");
});
