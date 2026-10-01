#!/usr/bin/env node
/**
 * generate-tools-sot.mjs — S4 remainder (F13 SAH 2026-10-01)
 *
 * tools_sot.yaml declared itself DEPRECATED and listed 51 tools against a live
 * 122. It could NOT simply be deleted: yamlGovernanceValidator.ts:46 validates
 * it and AAA/scripts/generate_tool_census.py reads it. A stale file with live
 * consumers is worse than no file — the consumers trust it.
 *
 * So it is regenerated from the same live tools/list that feeds
 * MCP_TOOL_CATALOG.md. Same top-level keys as before, so the consumers' schema
 * expectations are unchanged.
 *
 * Usage: node scripts/generate-tools-sot.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools_sot.yaml');
const CHECK = process.argv.includes('--check');

const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(ROOT, 'dist/src/interfaces/mcp/cli.js'), 'serve', '--transport', 'stdio'],
  cwd: ROOT,
});
const client = new Client({ name: 'tools-sot-generator', version: '1.0.0' });
await client.connect(transport);
const { tools } = await client.listTools();
await client.close();

const q = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 300)}"`;
const now = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
const L = [
  '# GENERATED — do not edit by hand.',
  '# Source of truth: live tools/list from dist/src/interfaces/mcp/cli.js',
  `# Regenerate: node scripts/generate-tools-sot.mjs   (generated ${new Date().toISOString().slice(0, 10)})`,
  '#',
  '# This file previously declared itself DEPRECATED and listed 51 tools against a',
  '# live 122. It was NOT deleted because it has consumers:',
  '#   src/interfaces/mcp/yamlGovernanceValidator.ts:46',
  '#   /root/AAA/scripts/generate_tool_census.py',
  '# A stale file that live consumers trust is worse than no file, so it is now',
  '# generated from the same surface as docs/MCP_TOOL_CATALOG.md.',
  'organ: A-FORGE',
  `version: ${now}`,
  'sot_source: GENERATED_from_live_mcp_registry',
  'live_port: 7072',
  `tool_count: ${tools.length}`,
  'tools:',
];
for (const t of [...tools].sort((a, b) => a.name.localeCompare(b.name))) {
  L.push(`  - name: ${t.name}`);
  L.push(`    access: public`);
  L.push(`    description: ${q(t.description)}`);
  L.push(`    source: live-registry`);
}
const body = L.join('\n') + '\n';

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
  const strip = (s) => s.split('\n').filter((l) => !l.startsWith('#') && !l.startsWith('version:')).join('\n');
  if (strip(cur) !== strip(body)) {
    console.error(`STALE: tools_sot.yaml does not match the live surface. Run: node scripts/generate-tools-sot.mjs`);
    process.exit(1);
  }
  console.log(`FRESH: tools_sot.yaml matches ${tools.length} live tools.`);
  process.exit(0);
}
fs.writeFileSync(OUT, body);
console.log(`Wrote tools_sot.yaml — ${tools.length} tools (was 51 declared / self-DEPRECATED).`);
