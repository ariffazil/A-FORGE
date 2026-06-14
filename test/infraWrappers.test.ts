import assert from "node:assert/strict";
import test from "node:test";

import { execSafe } from "../src/infrastructure/tools/infra/docker_wrapper.js";
import { mkdir, writeFile } from "../src/infrastructure/tools/infra/file_ops_wrapper.js";
import { resolveWorkspacePath } from "../src/infrastructure/tools/infra/safety.js";
import { start, status } from "../src/infrastructure/tools/infra/systemctl_wrapper.js";

test("systemctl wrapper rejects shell-injected unit names before execution", async () => {
  await assert.rejects(
    () => status("ssh.service; systemctl stop caddy"),
    /Invalid systemd unit name/,
  );
});

test("systemctl start requires approval beyond acknowledgement", async () => {
  const result = await start("ssh.service", true);
  assert.equal(result.success, false);
  assert.match(result.error ?? "", /888_HOLD/);
});

test("file wrapper uses segment-aware workspace boundary", () => {
  assert.throws(() => resolveWorkspacePath("/root2/outside.txt"), /Path outside workspace/);
  assert.throws(() => resolveWorkspacePath("/root-backup/outside.txt"), /Path outside workspace/);
  assert.throws(() => resolveWorkspacePath("/root/.secrets/token"), /protected workspace boundary/);
});

test("file mutations require approved lease even for new files and mkdir", async () => {
  const write = await writeFile("/root/tmp/airlock-test-new.txt", "x");
  assert.equal(write.success, false);
  assert.match(write.error ?? "", /888_HOLD/);

  const dir = await mkdir("/root/tmp/airlock-test-new-dir");
  assert.equal(dir.success, false);
  assert.match(dir.error ?? "", /888_HOLD/);
});

test("docker execSafe rejects shell and mutation commands before docker execution", async () => {
  await assert.rejects(
    () => execSafe("redis;systemctl", ["ls"]),
    /Invalid docker container reference/,
  );

  const result = await execSafe("redis", ["sh", "-c", "systemctl stop caddy"]);
  assert.equal(result.success, false);
  assert.match(result.error ?? "", /read-only diagnostic commands/);
});
