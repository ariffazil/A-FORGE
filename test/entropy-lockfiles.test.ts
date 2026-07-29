import test, { after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isDependencyLockfile,
  quiesceCheckLockFiles,
} from "../src/interfaces/mcp/forgeGitEntropyCanonize.js";

const testRoot = await fs.mkdtemp(join(tmpdir(), "aforge-lockfiles-"));

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
});

test("dependency lockfile names are not runtime mutexes", () => {
  assert.equal(isDependencyLockfile("/repo/uv.lock"), true);
  assert.equal(isDependencyLockfile("/repo/yarn.lock"), true);
  assert.equal(isDependencyLockfile("/repo/process.lock"), false);
});

test("entropy sweep preserves dependency lockfiles", async () => {
  const lockPath = join(testRoot, "uv.lock");
  await fs.writeFile(lockPath, "version = 1\n");

  const reports = quiesceCheckLockFiles(testRoot);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, "dependency");
  assert.equal(reports[0].stale, false);
  assert.match(reports[0].recommendation, /preserve/i);
  assert.doesNotMatch(reports[0].recommendation, /remove/i);
});
