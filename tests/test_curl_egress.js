// Manual regression harness for the PRODUCTION classifier.
// Run after `npm run build`: node tests/test_curl_egress.js
// Mirrors nothing — imports classifyShellCommand directly.
import { classifyShellCommand } from "../dist/src/domain/governance/execution-authority.js";

const cases = [
  // Every curl/wget invocation is EGRESS, including bare URL.
  "curl https://e/page",
  "curl -s https://e",
  "curl -L https://e",
  "curl -I https://e",
  "curl -o /dev/null https://e",
  "curl --config /tmp/curlrc https://e",
  "curl -d 'x' https://e",
  "curl --data 'x' https://e",
  "curl --data-binary @x https://e",
  "curl --json '{\"a\":1}' https://e",
  "curl -F file=@x https://e",
  "curl --form file=@x https://e",
  "curl -T x https://e",
  "curl --upload-file x https://e",
  "curl -X POST https://e",
  "curl --request POST https://e",
  "curl -X DELETE https://e",
  "curl -o /tmp/out https://e",
  "wget https://e",
  "wget --method=POST https://e",
  "wget --post-data 'x' https://e",
  "wget -O file https://e",
  "wget -qO- https://e",
];

let fail = 0;
for (const cmd of cases) {
  const got = classifyShellCommand(cmd);
  const ok = got === "EXECUTE_HIGH_IMPACT";
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${got.padEnd(22)} ${cmd}`);
}
console.log(`\n${cases.length - fail}/${cases.length} correct`);
process.exit(fail ? 1 : 0);
