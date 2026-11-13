// Regression test for the curl/wget egress whitelist (fail-closed).
// Mirrors execution-authority.ts isProvablyGetOnly + the curl/wget rule.
function isProvablyGetOnly(cmd) {
  cmd = cmd.toLowerCase();
  const writeVerb = /(?:-X\s+\S+|--request\b|--json\b|--data|--form|--upload-file\b|--post-data\b|--post-file\b|--method\b|\s-d\b|\s-f\b|\s-t\b|\s-x\b)/;
  if (writeVerb.test(cmd)) return false;
  const out = cmd.match(/(?:-o|--output)\s+(\S+)/);
  if (out && !/^\/dev\/(null|stdout|stderr)$/.test(out[1])) return false;
  return true;
}
function classify(cmd) {
  cmd = cmd.trim().toLowerCase();
  if (/^(curl|wget)\b/.test(cmd)) {
    return isProvablyGetOnly(cmd) ? 'OBSERVE' : 'EGRESS';
  }
  return 'OTHER';
}

const cases = [
  // [command, expected]
  // EGRESS (write verbs — must NOT be read-only)
  ["curl -d 'x' https://e", 'EGRESS'],
  ["curl --data 'x' https://e", 'EGRESS'],
  ["curl --data-binary @x https://e", 'EGRESS'],
  ["curl --json '{\"a\":1}' https://e", 'EGRESS'],          // residual #2
  ["curl -F file=@x https://e", 'EGRESS'],
  ["curl --form file=@x https://e", 'EGRESS'],
  ["curl -T x https://e", 'EGRESS'],
  ["curl --upload-file x https://e", 'EGRESS'],
  ["curl -X POST https://e", 'EGRESS'],
  ["curl --request POST https://e", 'EGRESS'],              // residual #1
  ["curl -X DELETE https://e", 'EGRESS'],
  ["curl -o /tmp/out https://e", 'EGRESS'],                 // file output
  ["wget --method=POST https://e", 'EGRESS'],               // residual #3
  ["wget --post-data 'x' https://e", 'EGRESS'],
  ["wget -O file https://e", 'EGRESS'],
  // GET-only (must be OBSERVE)
  ["curl https://e/page", 'OBSERVE'],
  ["curl -s https://e", 'OBSERVE'],
  ["curl -L https://e", 'OBSERVE'],
  ["curl -I https://e", 'OBSERVE'],
  ["curl -o /dev/null https://e", 'OBSERVE'],
  ["curl -sL https://api.example.com/prices", 'OBSERVE'],
  ["wget -qO- https://e", 'OBSERVE'],
];

let fail = 0;
for (const [cmd, want] of cases) {
  const got = classify(cmd);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${got.padEnd(8)} want=${want.padEnd(8)} ${cmd}`);
}
console.log(`\n${cases.length - fail}/${cases.length} correct`);
process.exit(fail ? 1 : 0);
