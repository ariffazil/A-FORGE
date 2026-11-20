/**
 * Regression: curl/wget are EGRESS in the production classifier.
 *
 * A bare `curl URL` is NOT proof of GET: .curlrc / CURL_HOME / --config can
 * inject --request/--data/--json. argv alone cannot prove read-only.
 */
import * as assert from "node:assert/strict";
import { test } from "node:test";

import { classifyShellCommand } from "../src/domain/governance/execution-authority.js";

const EGRESS_CASES = [
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

for (const cmd of EGRESS_CASES) {
  test(`EGRESS: ${cmd}`, () => {
    assert.equal(
      classifyShellCommand(cmd),
      "EXECUTE_HIGH_IMPACT",
      `${cmd} must be EXECUTE_HIGH_IMPACT`,
    );
  });
}

test("local read-only command remains OBSERVE", () => {
  assert.equal(classifyShellCommand("ls -la"), "OBSERVE");
  assert.equal(classifyShellCommand("git status"), "OBSERVE");
});
