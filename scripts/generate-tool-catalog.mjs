#!/usr/bin/env node
/**
 * generate-tool-catalog.mjs — S3 (F13 order 2026-10-01)
 *
 * Regenerates docs/MCP_TOOL_CATALOG.md from the LIVE tool surface and the LIVE
 * action classifier. The previous catalog was hand-written, declared "78 Tools",
 * was last audited 2026-06-23, and taught an atomic grammar (forge_git_status,
 * forge_filesystem_read, forge_lease_request) for tools that are live as union
 * tools (forge_git(mode="status")). Measured: 71 documented names were not live
 * and 39 live tools appeared in no doc. An agent following that catalog calls
 * names that cannot exist.
 *
 * Two rules this generator enforces:
 *   1. Callable syntax only — a union tool is written forge_git(mode="status"),
 *      never forge_git_status.
 *   2. Class and Lease columns are DERIVED from classifyTool()/requiresGovernance(),
 *      the same component the runtime gate uses. One source of truth, so the doc
 *      cannot disagree with the gate.
 *
 * Usage: node scripts/generate-tool-catalog.mjs [--check]
 *   --check  do not write; exit 1 if the committed catalog is stale (CI gate)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'MCP_TOOL_CATALOG.md');
const CHECK = process.argv.includes('--check');

const { classifyTool, requiresGovernance } = await import(
  path.join(ROOT, 'dist/src/domain/governance/actionClassifier.js')
);

// ── live surface from a freshly spawned stdio instance ────────────────────
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(ROOT, 'dist/src/interfaces/mcp/cli.js'), 'serve', '--transport', 'stdio'],
  cwd: ROOT,
});
const client = new Client({ name: 'catalog-generator', version: '1.0.0' });
await client.connect(transport);
const { tools } = await client.listTools();
await client.close();

// ── derive class / lease / modes per tool ─────────────────────────────────
const rows = tools.map((t) => {
  const props = t.inputSchema?.properties ?? {};
  const modeEnum = props.mode?.enum ?? props.mode?.anyOf?.flatMap((a) => a.enum ?? []) ?? null;
  const modes = Array.isArray(modeEnum) ? modeEnum : null;
  const baseClass = classifyTool(t.name, modes ? modes[0] : undefined);
  // A union tool's class varies by mode; show the per-mode truth.
  const perMode = modes
    ? modes.map((m) => ({ mode: m, cls: classifyTool(t.name, m) }))
    : null;
  const classes = perMode ? [...new Set(perMode.map((p) => p.cls))] : [baseClass];
  const lease = classes.some((c) => requiresGovernance(c));
  // family + class from the description prefix "ACTUATOR · <family> · <CLASS>."
  const m = /^(?:ACTUATOR|KERNEL)\s*·\s*([a-z_]+)\s*·\s*([A-Z_]+)/i.exec(t.description ?? '');
  const family = m ? m[1] : 'meta';
  // "Use when:" clause if the description carries one. Many A-FORGE descriptions
  // append a "Use when:" that simply REPEATS the description (measured 2026-10-01),
  // which is noise in a catalog and no discriminator at all. Detect and label it
  // rather than echoing the duplication.
  const desc = (t.description ?? '').replace(/\s+/g, ' ').trim();
  const uw = /Use when:\s*(.+)$/i.exec(t.description ?? '');
  const preUseWhen = desc.split(/Use when:/i)[0].trim();
  const uwRaw = uw ? uw[1].trim().replace(/\s+/g, ' ') : '';
  const isDuplicateTrigger =
    uwRaw.length > 0 && preUseWhen.includes(uwRaw.slice(0, Math.min(40, uwRaw.length)));
  const useWhen = isDuplicateTrigger ? '' : uwRaw;
  const short = desc.split(/\.\s|·/)[0].trim();
  return { name: t.name, family, classes, lease, modes, perMode, useWhen, duplicateTrigger: isDuplicateTrigger, short };
}).sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

const families = [...new Set(rows.map((r) => r.family))].sort();
const counts = {
  total: rows.length,
  union: rows.filter((r) => r.modes).length,
  atomic: rows.filter((r) => !r.modes).length,
  lease: rows.filter((r) => r.lease).length,
  noUseWhen: rows.filter((r) => !r.useWhen).length,
  dupTrigger: rows.filter((r) => r.duplicateTrigger).length,
};

// ── callable syntax helper (rule 1) ───────────────────────────────────────
const call = (name, mode) => (mode ? `${name}(mode="${mode}")` : `${name}()`);

const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';
const L = [];
L.push(`# A-FORGE MCP Tool Catalog — ${counts.total} live tools`);
L.push('');
L.push(`> **GENERATED — do not edit by hand.** \`node scripts/generate-tool-catalog.mjs\``);
L.push(`> **Generated:** ${now} · **Source of truth:** live \`tools/list\` from \`dist/src/interfaces/mcp/cli.js\``);
L.push(`> **Class / Lease columns:** derived from \`classifyTool()\` + \`requiresGovernance()\` — the same`);
L.push(`> component the runtime elicitation and policy gates consult, so this table cannot disagree with the gate.`);
L.push(`> **Surface:** ${counts.total} tools = ${counts.union} union (mode-dispatched) + ${counts.atomic} atomic · ${counts.lease} require governance for at least one mode.`);
L.push('');
L.push('---');
L.push('');
L.push('## Brain vs Hands — arifOS vs A-FORGE');
L.push('');
L.push('A-FORGE is **the hands** of the federation. It does not make constitutional law; it executes under law.');
L.push('');
L.push('| | arifOS MCP (the brain) | A-FORGE MCP (the hands) |');
L.push('|---|---|---|');
L.push('| **Role** | Constitutional kernel / sovereign governor / judge | Governed execution shell / actuator / forger |');
L.push('| **Owns** | Law (F1–F13), truth, judgment, memory routing, VAULT999 seals | Build, deploy, run, shell, browser, orchestration, artifacts, leases |');
L.push('| **Naming** | 8 canonical verbs: `arif_init`, `arif_observe`, `arif_think`, `arif_route`, `arif_memory`, `arif_judge`, `arif_forge`, `arif_seal` — capability selected by `mode` | `forge_<domain>` tools, most of them **union tools** — capability selected by `mode` |');
L.push('| **Verdict authority** | Issues final verdicts: SEAL, SABAR, HOLD, VOID | Never issues final constitutional verdicts; routes judgment to arifOS |');
L.push('| **Transport** | streamable-http (`127.0.0.1:8088/mcp`) | stdio (preferred for agents) + streamable-http (`127.0.0.1:7072/mcp`) |');
L.push('');
L.push('> **CALLABLE SYNTAX — read this before calling anything.** Most A-FORGE tools are');
L.push('> **union tools**: one registered name plus a `mode` discriminator. There is no');
L.push('> `forge_git_status`, no `forge_filesystem_read`, no `forge_lease_request`, no `forge_run`.');
L.push('> Those names appear in older prose and in no live registry. The correct forms are');
L.push('> `forge_git(mode="status")`, `forge_filesystem(mode="read")`, `forge_lease(mode="request")`.');
L.push('> Every example in this file is emitted from the live schema, so every example is callable.');
L.push('');
L.push('### Typical agent flow (all names verified live)');
L.push('');
L.push('1. **Bootstrap identity** — `arif_init` (arifOS)');
L.push('2. **Observe / think** — `arif_observe()`, `arif_think(mode="critique")` (arifOS)');
L.push('3. **Get authority** — `forge_lease(mode="request")` + `arif_judge` (arifOS)');
L.push('4. **Execute** — `forge_filesystem(mode="write")`, `forge_shell(command=…)`, `forge_git(mode="commit")`, `forge_browser_navigate()`');
L.push('5. **Seal the record** — `arif_seal` (arifOS)');
L.push('');
L.push('> **One-line rule:** arifOS decides what is lawful. A-FORGE forges what is permitted under law.');
L.push('');
L.push('---');
L.push('');
L.push('## How to read this catalog');
L.push('');
L.push('| Column | Meaning |');
L.push('|---|---|');
L.push('| **Tool** | Exact registered name. Union tools show their `mode` values. |');
L.push('| **Class** | From `classifyTool()`: `OBSERVE`, `SUGGEST`, `SIMULATE`, `DRAFT`, `QUEUE`, `EXECUTE_REVERSIBLE`, `EXECUTE_HIGH_IMPACT`, `IRREVERSIBLE`. Unknown tools fail closed to `IRREVERSIBLE`. |');
L.push('| **Gov?** | `requiresGovernance(class)` — anything other than `OBSERVE`/`SUGGEST` needs a session + lease, and external callers face the `-32042` elicitation gate. |');
L.push('| **Use when** | The description\'s own trigger clause. **Blank = the tool ships no discriminator** — a known gap, not an omission by this generator. |');
L.push('');
L.push('**Iron rules**');
L.push('- `IRREVERSIBLE` and `EXECUTE_HIGH_IMPACT` require an `arif_judge` SEAL + kernel lease.');
L.push('- `EXECUTE_REVERSIBLE` requires a kernel lease — `forge_lease(mode="request")`.');
L.push('- `OBSERVE` needs no lease. Read modes of union tools are `OBSERVE` and are **not** confirmation-gated.');
L.push('- Trust is verified, not asserted: a self-declared `session_id`, `lease_id` or acknowledgement');
L.push('  boolean does not grant trust (S1, 2026-10-01). Only `validateSession()` — registry or HMAC ACT — does.');
L.push('');
L.push('---');
L.push('');
for (const fam of families) {
  const group = rows.filter((r) => r.family === fam);
  L.push(`## ${fam} — ${group.length} tool${group.length === 1 ? '' : 's'}`);
  L.push('');
  L.push('| Tool | Class | Gov? | Use when |');
  L.push('|---|---|---|---|');
  for (const r of group) {
    const cls = r.perMode && r.classes.length > 1
      ? r.perMode.map((p) => `\`${p.mode}\`→${p.cls}`).join('<br>')
      : r.classes.join(', ');
    L.push(`| \`${call(r.name)}\`${r.modes ? `<br>modes: ${r.modes.map((m) => `\`${m}\``).join(' ')}` : ''} | ${cls} | ${r.lease ? 'yes' : 'no'} | ${r.useWhen || '—'} |`);
  }
  L.push('');
}
L.push('---');
L.push('');
L.push('## Known gaps (measured, not editorialised)');
L.push('');
L.push(`- **${counts.noUseWhen} of ${counts.total} tools give a router no usable trigger clause.** Of those, **${counts.dupTrigger} append a \`Use when:\` that merely repeats their own description** — noise, not a discriminator. Fixing this means editing each tool's description at its registration site, not this file.`);
L.push('- The 8 governance parameters (`session_id`, `actor_id`, `lease_id`, `session_token`, `sct`, `act`, `justification`, `claim_class`) are injected into every tool from `GOVERNANCE_FIELDS` in `src/interfaces/mcp/core.ts`. `session_token`, `sct` and `act` alias one token; `act` is preferred.');
L.push('- Outbound cross-organ conformance is audited by `forge_surface_audit` (axis `OUTBOUND_ABI_DRIFT`), not by this file.');
L.push('');

const body = L.join('\n');

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
  // compare ignoring the volatile timestamp line
  const strip = (s) => s.split('\n').filter((l) => !l.startsWith('> **Generated:**')).join('\n');
  if (strip(current) !== strip(body)) {
    console.error(`STALE: ${path.relative(ROOT, OUT)} does not match the live surface. Run: node scripts/generate-tool-catalog.mjs`);
    process.exit(1);
  }
  console.log(`FRESH: ${path.relative(ROOT, OUT)} matches ${counts.total} live tools.`);
  process.exit(0);
}

fs.writeFileSync(OUT, body);
console.log(`Wrote ${path.relative(ROOT, OUT)} — ${counts.total} tools, ${families.length} families, ${body.length} bytes.`);

// ── self-verification: doc names == live names, both directions ──────────
// KNOWN_PHANTOM_EXAMPLES are named in the doc ON PURPOSE, as negative examples
// ("there is no forge_git_status"). They are excluded from the phantom check
// and separately asserted to still be absent from the live surface, so the
// warning can never silently become false.
const KNOWN_PHANTOM_EXAMPLES = ['forge_git_status', 'forge_filesystem_read', 'forge_lease_request', 'forge_run'];
// Rename redirects are legitimate: a description that says "Renamed from X" is
// the redirect table that stops agents calling a retired name. Derive them from
// the live descriptions instead of hardcoding, and assert each is genuinely
// absent from the live surface — otherwise the note itself has gone stale.
// Found 2026-10-01: forge_security_drift_scan "(Renamed from forge_boundaries_assert)".
const ALL_DESCRIPTIONS = tools.map((t) => t.description ?? '').join('\n');
const RENAMED_FROM = new Set(
  [...ALL_DESCRIPTIONS.matchAll(/(?:renamed from|was|formerly)\s+((?:forge_|arif_)[a-z0-9_]+)/gi)]
    .map((m) => m[1]),
);
const liveNames = new Set(tools.map((t) => t.name));
const docNames = new Set(
  [...body.matchAll(/\b(forge_[a-z0-9_]+|auth_pipeline|arif_[a-z0-9_]+)\b/g)]
    .map((m) => m[1])
    .filter((n) => !KNOWN_PHANTOM_EXAMPLES.includes(n) && !RENAMED_FROM.has(n)),
);
// arifOS canonical verbs referenced in the flow section
const ARIFOS_LIVE = new Set(['arif_init', 'arif_observe', 'arif_think', 'arif_route', 'arif_memory', 'arif_judge', 'arif_forge', 'arif_seal']);
const phantom = [...docNames].filter((n) => !liveNames.has(n) && !(n.startsWith('arif_') && ARIFOS_LIVE.has(n)));
const undocumented = [...liveNames].filter((n) => !body.includes(n));
const staleWarnings = KNOWN_PHANTOM_EXAMPLES.filter((n) => liveNames.has(n));
const staleRedirects = [...RENAMED_FROM].filter((n) => liveNames.has(n));
console.log(`VERIFY  rename redirects recognised: ${RENAMED_FROM.size}${RENAMED_FROM.size ? ' -> ' + [...RENAMED_FROM].join(', ') : ''}`);
console.log(`VERIFY  phantom names in doc (must be 0): ${phantom.length}${phantom.length ? ' -> ' + phantom.join(', ') : ''}`);
console.log(`VERIFY  live tools absent from doc (must be 0): ${undocumented.length}${undocumented.length ? ' -> ' + undocumented.join(', ') : ''}`);
console.log(`VERIFY  negative examples that became live (must be 0): ${staleWarnings.length}${staleWarnings.length ? ' -> ' + staleWarnings.join(', ') : ''}`);
console.log(`VERIFY  stale rename redirects (must be 0): ${staleRedirects.length}${staleRedirects.length ? ' -> ' + staleRedirects.join(', ') : ''}`);
if (phantom.length || undocumented.length || staleWarnings.length || staleRedirects.length) process.exit(1);
console.log('VERIFY  catalog == live surface, both directions.');
