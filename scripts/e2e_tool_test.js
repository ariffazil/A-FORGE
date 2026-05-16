#!/usr/bin/env node
/**
 * E2E Tool Test — A-FORGE
 * Budget: ~50 tool calls across 4 tiers
 * Tiers:
 *   1. Safe: read_file, list_files, grep_text (no blast radius)
 *   2. Guarded: GEOX + WEALTH tools (moderate thermodynamic cost)
 *   3. Dangerous: run_command, apply_patches (high/medium band, limited)
 */

import { tmpdir } from 'os';

const BASE = '/root/dist/src/tools';
const ctx = { sessionId: 'e2e', workingDirectory: tmpdir(), modeName: 'internal_mode' };

const load = (mod, sub = '') => import(mod + sub);

// ── Tier 1: Safe (4 calls, cost ~0.4 ops) ────────────────────────────────────
async function testSafeTools() {
  const { ReadFileTool } = await load(BASE, '/FileTools.js');
  const { ListFilesTool } = await load(BASE, '/FileTools.js').then(m => m.ListFilesTool ? m : { ListFilesTool: m.ReadFileTool });
  const { GrepTextTool } = await load(BASE, '/SearchTools.js');

  const tests = [
    { tool: new ReadFileTool(), args: { path: '/root/package.json' }, label: 'read_file' },
    { tool: new (await load(BASE, '/FileTools.js')).ListFilesTool, args: { path: '/root/src' }, label: 'list_files' },
    { tool: new GrepTextTool(), args: { pattern: 'GEOX', path: '/root/src' }, label: 'grep_text' },
  ];

  for (const { tool, args, label } of tests) {
    if (!tool) { console.log('⚠️  SKIP: ' + label); continue; }
    const start = Date.now();
    const result = await tool.run(args, ctx).catch(e => ({ ok: false, output: e.message }));
    const ms = Date.now() - start;
    console.log(`${result.ok ? '✅' : '❌'} ${label} (${ms}ms): ${result.ok ? 'PASS' : 'FAIL'} — ${String(result.output ?? '').slice(0,60)}`);
  }
}

// ── Tier 2: GEOX (12 calls, cost ~6 ops) ─────────────────────────────────────
async function testGEOXTools() {
  const mod = await load(BASE, '/GEOXTools.js');
  const GEOX_TOOLS = mod.GEOX_TOOLS;
  const cases = [
    [0, { location: 'Sumatra', hazard_types: ['seismic'] }, 'GEOX_check_hazard'],
    [0, { latitude: 55, longitude: -3, hazard_types: ['flood'] }, 'GEOX_check_hazard (low-risk)'],
    [1, { location: 'North Sea', scenario: 'extraction' }, 'GEOX_subsurface_model'],
    [2, { line_id: 'MY-2026-SEISMIC-01', horizon: 'TopFrio' }, 'GEOX_seismic_interpret'],
    [3, { prospect_id: 'PROSPECT_ALPHA', trap_ma: 50, charge_ma: 60 }, 'GEOX_prospect_score'],
    [4, { operation: 'extraction', pressure_bar: 250, temperature_c: 120 }, 'GEOX_physical_constraint'],
    [5, {}, 'GEOX_uncertainty_tag'],
    [6, { observation: 'GR spike at 2500m', methods: ['wireline', 'core', 'test'] }, 'GEOX_witness_triad'],
    [7, { target: 'Porosity > 20%', test_data: { type: 'core', value: 22.5 } }, 'GEOX_ground_truth'],
    [8, { location: 'North Sea', operationType: 'extraction', distance_km: 50, population_density: 200 }, 'GEOX_maraoh_impact'],
    [9, { location: 'North Sea', max_depth_m: 3500 }, 'GEOX_extraction_limits'],
    [10, { operation: 'co2_storage', volume_mt: 1.5 }, 'GEOX_climate_bounds'],
  ];
  for (const [idx, args, label] of cases) {
    const ToolClass = GEOX_TOOLS[idx];
    if (!ToolClass) { console.log('⚠️  SKIP: ' + label); continue; }
    const tool = new ToolClass();
    const start = Date.now();
    const result = await tool.run(args, ctx).catch(e => ({ ok: false, output: e.message }));
    const ms = Date.now() - start;
    console.log(`${result.ok ? '✅' : '❌'} ${label} (${ms}ms)${!result.ok ? ' — ' + String(result.output ?? '').slice(0,40) : ''}`);
  }
}

// ── Tier 3: WEALTH (6 calls, cost ~2 ops) ──────────────────────────────────────
async function testWEALTHTools() {
  const mod = await load(BASE, '/WealthTools.js');
  const WEALTH_TOOLS = mod.WEALTH_TOOLS;
  const cases = [
    [0, { investment: 1000000, return: 1500000, risk: 0.3, domain: 'CODE' }, 'wealth_evaluate_ROI'],
    [1, { scenarios: [{ name: 'A', probability: 0.6, cashFlows: [{period:1,amount:500000,probability:1}], initialInvestment: 200000, discountRate: 0.1 }] }, 'wealth_compute_EMV'],
    [2, { tool: 'read_file', joules: 50 }, 'wealth_thermodynamic_scan'],
    [3, { totalBudget: 10000000, riskTolerance: 0.4, domain: 'GEOX' }, 'wealth_portfolio_optimize'],
    [4, { totalEntropy: 0.7, budget: 1000 }, 'wealth_entropy_budget'],
    [5, { scenarios: [{ name: 'A', probability: 0.7, cashFlows: [{period:1,amount:300000,probability:1}], initialInvestment: 100000, discountRate: 0.08 }] }, 'wealth_objective_compute'],
  ];
  for (const [idx, args, label] of cases) {
    const ToolClass = WEALTH_TOOLS[idx];
    if (!ToolClass) { console.log('⚠️  SKIP: ' + label); continue; }
    const tool = new ToolClass();
    const start = Date.now();
    const result = await tool.run(args, ctx).catch(e => ({ ok: false, output: e.message }));
    const ms = Date.now() - start;
    console.log(`${result.ok ? '✅' : '❌'} ${label} (${ms}ms)${!result.ok ? ' — ' + String(result.output ?? '').slice(0,40) : ''}`);
  }
}

// ── Bonus: GEOXLogInterpreterTool (1 call, cost ~1 ops) ────────────────────────
async function testLogInterpreter() {
  const { GEOXLogInterpreterTool } = await load('/root/dist/src', '/domains/geophysics/logInterpreter.js');
  const n = 30;
  const tool = new GEOXLogInterpreterTool();
  const start = Date.now();
  const result = await tool.run({
    GR: Array.from({length: n}, (_, i) => 20 + (80 * i / (n-1))),
    RT: Array.from({length: n}, (_, i) => Math.pow(10, Math.log10(1) + (2) * i / (n-1))),
    RHOB: Array.from({length: n}, () => 2.45 - Math.random() * 0.3),
    NPHI: Array.from({length: n}, () => 0.05 + Math.random() * 0.35),
    GR_clean: 20, GR_shale: 120, RW: 0.055, matrix: 'limestone',
  }, ctx).catch(e => ({ ok: false, output: e.message }));
  const ms = Date.now() - start;
  if (result.ok) {
    const p = JSON.parse(result.output);
    console.log(`✅ GEOX_log_interpreter (${ms}ms) → Vsh:${p.Vsh?.length} PHIE:${p.PHIE?.length} SW:${p.SW?.length} composite:${p.anomalyContrast?.compositeAnomaly} fluidFlags:${p.fluidFlag?.filter(f=>f!=='INDETERMINATE').length}`);
  } else {
    console.log(`❌ GEOX_log_interpreter (${ms}ms): ${String(result.output ?? '').slice(0,80)}`);
  }
}

// ── Tier 4: Shell safe (1 call) ────────────────────────────────────────────────
async function testShellSafe() {
  const { RunTestsTool } = await load(BASE, '/ShellTools.js');
  const tool = new RunTestsTool();
  const start = Date.now();
  const result = await tool.run({ command: 'echo "AF_FORGE_E2E"' }, ctx).catch(e => ({ ok: false, output: e.message }));
  const ms = Date.now() - start;
  console.log(`${result.ok ? '✅' : '❌'} run_tests echo (${ms}ms): ${String(result.output ?? '').slice(0,60)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const budget = parseInt(process.argv[2] ?? '50');
  console.log('\n═══ A-FORGE E2E Tool Test ═══');
  console.log(`Budget: ${budget} calls | internal_mode | e2e session\n`);

  console.log('─── Tier 1: Safe ───');
  await testSafeTools();

  console.log('\n─── Tier 2: GEOX ───');
  await testGEOXTools();

  console.log('\n─── Tier 3: WEALTH ───');
  await testWEALTHTools();

  console.log('\n─── Bonus: GEOXLogInterpreterTool ───');
  await testLogInterpreter();

  console.log('\n─── Tier 4: Shell Safe ───');
  await testShellSafe();

  console.log('\n═══ E2E Complete ═══\n');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });


