/**
 * classifierCoverage — registry ↔ live-surface parity gate.
 *
 * Makes true the claim written in actionClassifier.ts: "CI coverage test fails
 * the build when any live tool is unclassified or any entry here is dead."
 * Until this file existed, `classifiedToolRegistry()` had ZERO consumers.
 *
 * PORTABILITY (2026-10-26, learned from the first clean-checkout run): the live
 * registry `tools_sot.yaml` is **gitignored** (.gitignore:143), so a gate that
 * reads it at module scope throws on a fresh clone. The tracked authority is
 * now `test/tools_sot.snapshot.json`; the live file is an OPTIONAL drift check
 * that skips with a reason when absent. A gate must never depend on an ignored
 * artifact.
 *
 * Ratchet, not a dial:
 *  - every snapshot tool MUST be explicitly classified;
 *  - every classified name MUST be in the snapshot or the cross-organ allowlist;
 *  - an implausibly small snapshot FAILS instead of passing vacuously;
 *  - when the live registry is present, live must equal snapshot;
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

/** Repo root: nearest ancestor holding package.json + the tracked snapshot. */
function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [process.cwd(), resolve(here, "..", ".."), resolve(here, "..", "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "package.json")) && existsSync(resolve(candidate, "test", "tools_sot.snapshot.json"))) {
      return candidate;
    }
  }
  throw new Error(
    `tracked snapshot test/tools_sot.snapshot.json not found from: ${candidates.join(", ")}. ` +
      "It must be committed — the live tools_sot.yaml is gitignored and cannot be a build dependency.",
  );
}

const ROOT = repoRoot();
const SNAPSHOT_PATH = resolve(ROOT, "test", "tools_sot.snapshot.json");
const LIVE_PATH = resolve(ROOT, "tools_sot.yaml");

type Snapshot = { generated_from: string; source_sha256: string; count: number; tools: string[] };
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
const snapshotTools = [...snapshot.tools].sort();

/** Live registry, when the operator has one (gitignored, optional). */
function liveTools(): string[] | null {
  if (!existsSync(LIVE_PATH)) return null;
  const yaml = readFileSync(LIVE_PATH, "utf8");
  const names = Array.from(yaml.matchAll(/^\s*-\s*name:\s*["']?([A-Za-z0-9_]+)/gm), (m) => m[1]);
  return Array.from(new Set(names)).sort();
}

/**
 * Classified names deliberately NOT on A-FORGE's own surface: they live on
 * another organ and are classified here so cross-organ dispatch is governed.
 * Explicit pins — a new cross-organ tool must be added deliberately.
 */
const CROSS_ORGAN_ALLOWLIST = new Set<string>([
  "arif_init", "arif_observe", "arif_think", "arif_route", "arif_memory",
  "arif_judge", "arif_forge", "arif_seal", "arif_report",
  "geox_prospect", "geox_seismic_compute",
]);

const VALID_CLASSES: ActionClass[] = [
  "OBSERVE", "SUGGEST", "SIMULATE", "DRAFT", "QUEUE",
  "EXECUTE_REVERSIBLE", "EXECUTE_HIGH_IMPACT", "IRREVERSIBLE",
];

test("snapshot is non-vacuous: the recorded surface has plausibly many tools", () => {
  assert.ok(
    snapshotTools.length >= 100,
    `snapshot holds only ${snapshotTools.length} tools — refusing to pass vacuously.`,
  );
  assert.equal(snapshot.count, snapshotTools.length, "snapshot count must match its tool list");
  assert.match(snapshot.source_sha256, /^[0-9a-f]{64}$/, "snapshot must record the source digest");
});

test("every snapshot tool is explicitly classified", () => {
  const unclassified = snapshotTools.filter((tool) => !isClassifiedTool(tool));
  assert.deepEqual(
    unclassified,
    [],
    `live tools missing from actionClassifier.ts: ${unclassified.join(", ")}.`,
  );
});

test("every snapshot tool resolves to a defined action class", () => {
  for (const tool of snapshotTools) {
    const resolved = classifyTool(tool) as string;
    assert.ok(VALID_CLASSES.includes(resolved as ActionClass), `${tool} resolved to "${resolved}"`);
  }
});

test("no dead classifier entries: classified ⊆ snapshot ∪ cross-organ", () => {
  const known = new Set(snapshotTools);
  const dead = classifiedToolRegistry()
    .filter((tool) => !known.has(tool) && !CROSS_ORGAN_ALLOWLIST.has(tool))
    .sort();
  assert.deepEqual(
    dead,
    [],
    `classifier names a tool that is live nowhere: ${dead.join(", ")}. ` +
      "Delete the entry, or pin it in CROSS_ORGAN_ALLOWLIST with the organ that serves it.",
  );
});

test("cross-organ allowlist stays honest: each pinned name is classified", () => {
  for (const tool of CROSS_ORGAN_ALLOWLIST) {
    assert.equal(isClassifiedTool(tool), true, `CROSS_ORGAN_ALLOWLIST pins ${tool} but the classifier does not know it`);
  }
});

test("unknown-tool contract: MUTATE floor, unclassified, governance required", () => {
  const unknown = "forge_tool_that_does_not_exist_20261026";
  assert.equal(MUTATE_FLOOR, "EXECUTE_REVERSIBLE");
  assert.equal(classifyTool(unknown), MUTATE_FLOOR);
  assert.equal(isClassifiedTool(unknown), false);
  assert.equal(requiresGovernance(classifyTool(unknown)), true);
});

test("live registry drift (optional): live tools === snapshot", (t) => {
  const live = liveTools();
  if (live === null) {
    t.skip("tools_sot.yaml absent (gitignored) — snapshot is the authority in a clean checkout");
    return;
  }
  const added = live.filter((x) => !snapshotTools.includes(x));
  const removed = snapshotTools.filter((x) => !live.includes(x));
  assert.deepEqual(
    { added, removed },
    { added: [], removed: [] },
    "live registry drifted from the tracked snapshot — refresh " +
      "test/tools_sot.snapshot.json from the live :7072 tools/list, then re-run",
  );
});
