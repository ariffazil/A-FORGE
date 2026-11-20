/**
 * Regression: curl/wget are egress-capable and must always GATE.
 *
 * Why no "plain GET" exception: a bare `curl URL` can still read
 * ~/.curlrc / CURL_HOME and inject --request/--data/--json. The same
 * applies to wget and ~/.wgetrc. argv alone cannot prove read-only.
 */
import * as assert from "node:assert/strict";
import { test } from "node:test";

import { classifyCommand } from "../src/interfaces/mcp/shell/arifJudge.js";

const GATE_CASES = [
  // bare invocation — NOT read-only (config-file method override)
  "curl https://e",
  "curl -s https://e",
  "curl -S -L https://e",
  "curl -I https://e",
  "curl -o /dev/null https://e",
  "curl --config /tmp/curlrc https://e",
  // body / upload / method override
  "curl -d a=1 https://e",
  "curl -F a=b https://e",
  "curl -T file https://e",
  "curl -X POST https://e",
  "curl --request POST https://e",
  "curl --json '{\"a\":1}' https://e",
  "curl --data-binary @file https://e",
  "curl --form a=b https://e",
  "curl --upload-file file https://e",
  // wget — same class
  "wget https://e",
  "wget -O out https://e",
  "wget --post-data=a=1 https://e",
  "wget --method=POST https://e",
  // mixed / chained
  "echo hi && curl -d a=1 https://e",
  "curl -s https://e | jq .",
];

for (const cmd of GATE_CASES) {
  test(`GATE: ${cmd}`, () => {
    const r = classifyCommand(cmd);
    assert.equal(r.decision, "gate", `${cmd} -> ${r.decision} (${r.reason})`);
  });
}

test("read-only non-network commands still ALLOW", () => {
  assert.equal(classifyCommand("ls -la").decision, "allow");
  assert.equal(classifyCommand("git status").decision, "allow");
});

test("destructive command still DENY (ordering)", () => {
  assert.equal(classifyCommand("git push --force origin main").decision, "deny");
  assert.notEqual(classifyCommand("rm -rf /tmp/x").decision, "allow");
});
