/**
 * opencode-tripwire.test.ts — 11/11 888_HOLD tripwire regex validation
 *
 * Locked: 2026-07-16 (carry-forward from opencode-init-seal-autonomy audit)
 * Source: /root/.config/opencode/plugins/aaa-autonomy.ts (HOLD_PATTERNS)
 * Doctrine: F13 SOVEREIGN directive 2026-06-12 — hooks witness, never deny.
 *           This test validates the 6 tripwire patterns that DO hard-block.
 *
 * Run: node --test test/opencode-tripwire.test.ts
 *      or: npm test (after `npx tsc test/opencode-tripwire.test.ts` + run dist)
 *
 * Uses node:test + node:assert (no external deps) so A-FORGE's bare Node
 * test runner can pick it up. See A-FORGE/test/AgentEngine.test.ts pattern.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";

// 6 HOLD_PATTERNS lifted verbatim from /root/.config/opencode/plugins/aaa-autonomy.ts
// KEEP IN SYNC: any change to that file's HOLD_PATTERNS array MUST mirror here.
const HOLD_PATTERNS: RegExp[] = [
  /rm\s+-rf?\s+\/(?!tmp|root\/(?:tmp|\.cache))/,             // rm -rf outside safe zones
  /\bdrop\s+table\b/i,                                       // DROP TABLE
  /git\s+push\s+.*--force(?!-with-lease).*\s+(origin\s+)?(main|master)\b/, // force-push main
  /\b(shutdown|reboot|poweroff)\b/,                          // VPS restart
  /docker\s+volume\s+rm/,                                    // volume destruction
  /ufw\s+(delete|deny|disable)/,                             // firewall mutation
];

interface Case {
  cmd: string;
  shouldBlock: boolean;
  reason: string;
}

const CASES: Case[] = [
  // SHOULD BLOCK (9 cases)
  { cmd: "rm -rf /etc/nginx",              shouldBlock: true,  reason: "rm -rf system dir" },
  { cmd: "rm -rf /var/lib/data",           shouldBlock: true,  reason: "rm -rf system data" },
  { cmd: "DROP TABLE users",               shouldBlock: true,  reason: "DROP TABLE" },
  { cmd: "git push --force origin main",   shouldBlock: true,  reason: "force-push main" },
  { cmd: "git push --force origin master", shouldBlock: true,  reason: "force-push master" },
  { cmd: "sudo shutdown -h now",           shouldBlock: true,  reason: "VPS shutdown" },
  { cmd: "reboot",                         shouldBlock: true,  reason: "VPS reboot" },
  { cmd: "docker volume rm myvol",         shouldBlock: true,  reason: "volume rm" },
  { cmd: "ufw deny 22",                    shouldBlock: true,  reason: "firewall deny" },
  // SHOULD ALLOW (2 cases)
  { cmd: "rm -rf /tmp/build",                          shouldBlock: false, reason: "rm -rf in /tmp safe zone" },
  { cmd: "git push --force-with-lease origin main",    shouldBlock: false, reason: "force-with-lease is reversible" },
];

test("HOLD_PATTERNS has exactly 6 entries (no drift from aaa-autonomy.ts)", () => {
  assert.equal(HOLD_PATTERNS.length, 6, "Pattern count drift — re-sync from aaa-autonomy.ts");
});

for (const c of CASES) {
  test(`tripwire[${c.cmd}] → ${c.shouldBlock ? "BLOCK" : "ALLOW"} (${c.reason})`, () => {
    const hit = HOLD_PATTERNS.some((re) => re.test(c.cmd));
    assert.equal(hit, c.shouldBlock, `Expected ${c.shouldBlock} but got ${hit}`);
  });
}

test("summary: 11/11 expected cases pass", () => {
  let pass = 0;
  for (const c of CASES) {
    const hit = HOLD_PATTERNS.some((re) => re.test(c.cmd));
    if (hit === c.shouldBlock) pass++;
  }
  assert.equal(pass, CASES.length, `Only ${pass}/${CASES.length} cases pass`);
  assert.equal(pass, 11, "11/11 invariant — if this fails, audit the opencode plugin");
});
