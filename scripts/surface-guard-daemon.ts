#!/usr/bin/env node
/**
 * MCP Surface Guard Daemon — Live Federation Drift Watchdog
 * 
 * Polls tools/list from all 6 organs every 60s.
 * Compares against pinned schema fingerprints.
 * On drift: writes report to /var/log/surface-guard/ + triggers NATS 888_HOLD.
 * 
 * Usage: node dist/scripts/surface-guard-daemon.js
 * 
 * FORGED: 2026-07-03
 * DITEMPA BUKAN DIBERI
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import {
  getSurfaceGuardStore,
  SurfaceGuardRunner,
  type FederationDriftReport,
  type OrganConfig,
} from '../src/domain/governance/mcp-surface-guard.js';

// ─── Config ────────────────────────────────────────────────────────

const CONFIG_PATH = '/root/A-FORGE/config/mcp-surface-guard.json';
const LOG_DIR = '/var/log/surface-guard';
const CHECK_INTERVAL_MS = 60_000; // 60 seconds
const NATS_URL = 'nats://127.0.0.1:4222';

function loadConfig(): OrganConfig[] {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.organs ?? [];
  } catch (err) {
    console.error(`[SurfaceGuard] Failed to load config: ${err}`);
    // Fallback to hardcoded
    return [
      { id: 'arifos', url: 'http://localhost:8088', required_tools: ['arif_init', 'arif_observe', 'arif_think', 'arif_route', 'arif_judge', 'arif_act', 'arif_seal'] },
      { id: 'aforge', url: 'http://localhost:7072', required_tools: ['forge_execute', 'forge_shell', 'forge_git', 'forge_docker'] },
      { id: 'geox', url: 'http://localhost:8081', required_tools: ['geox_well_ingest', 'geox_petrophysics', 'geox_seismic_compute', 'geox_basin'] },
      { id: 'wealth', url: 'http://localhost:18082', required_tools: ['wealth_compute_npv', 'wealth_compute_emv', 'wealth_monte_carlo_simulate'] },
      { id: 'well', url: 'http://localhost:18083', required_tools: ['well_readiness', 'well_validate_vitality', 'well_assess_homeostasis'] },
    ];
  }
}

// ─── Logging ───────────────────────────────────────────────────────

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeReport(report: FederationDriftReport): void {
  ensureLogDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(LOG_DIR, `drift-${ts}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`[SurfaceGuard] Report written: ${path}`);
}

function writeLatest(report: FederationDriftReport): void {
  ensureLogDir();
  writeFileSync(join(LOG_DIR, 'latest.json'), JSON.stringify(report, null, 2));
}

// ─── NATS Alert ────────────────────────────────────────────────────

async function publishHoldAlert(report: FederationDriftReport): Promise<void> {
  try {
    // Dynamic import — NATS may not be available
    const natsMod = await import('nats').catch(() => null);
    if (!natsMod) {
      console.warn(`[SurfaceGuard] NATS module not available — skipping alert`);
      return;
    }
    const nc = await natsMod.connect({ servers: NATS_URL });

    const alert = {
      type: '888_HOLD',
      reason: report.verdict_reason ?? 'MCP_TOOL_SURFACE_DRIFT',
      source: 'surface-guard',
      timestamp: new Date().toISOString(),
      details: {
        total_drifts: report.total_drifts,
        total_missing_required: report.total_missing_required,
        organs_drifted: report.organs
          .filter(o => o.status !== 'OK')
          .map(o => ({ id: o.organ_id, status: o.status, missing: o.required_tools_missing })),
      },
    };

    nc.publish('888_HOLD', JSON.stringify(alert));
    await nc.flush();
    await nc.close();
    console.log(`[SurfaceGuard] 888_HOLD alert published to NATS`);
  } catch (err) {
    // NATS may not be running — log but don't crash
    console.warn(`[SurfaceGuard] NATS publish failed (non-fatal): ${err}`);
  }
}

// ─── Main Loop ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const organs = loadConfig();
  const store = getSurfaceGuardStore();
  let lastReport: FederationDriftReport | null = null;
  let consecutiveDrifts = 0;

  const onDrift = async (report: FederationDriftReport) => {
    consecutiveDrifts++;
    console.error(`[SurfaceGuard] ⚠️  DRIFT DETECTED (consecutive: ${consecutiveDrifts})`);
    
    for (const organ of report.organs) {
      if (organ.status !== 'OK') {
        console.error(`  ${organ.status === 'DOWN' ? '❌' : '⚠️'} ${organ.organ_id}: ${organ.status}`);
        if (organ.required_tools_missing.length > 0) {
          console.error(`    Missing: ${organ.required_tools_missing.join(', ')}`);
        }
        for (const drift of organ.drift_events) {
          console.error(`    ${drift.drift_type}: ${drift.tool_name} (${drift.severity})`);
        }
      }
    }

    writeReport(report);
    writeLatest(report);

    // Only alert on CRITICAL or after 2 consecutive drifts
    if (report.status === 'HOLD' || consecutiveDrifts >= 2) {
      await publishHoldAlert(report);
    }
  };

  const runner = new SurfaceGuardRunner(store, organs, onDrift);

  console.log(`[SurfaceGuard] Starting federation drift watchdog`);
  console.log(`[SurfaceGuard] Monitoring ${organs.length} organs, interval ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`[SurfaceGuard] Organs: ${organs.map(o => o.id).join(', ')}`);

  // Initial check
  const initialReport = await runner.check();
  writeLatest(initialReport);
  
  if (initialReport.status === 'PASS') {
    console.log(`[SurfaceGuard] ✅ Initial check: PASS (${initialReport.organs.length} organs, 0 drifts)`);
    consecutiveDrifts = 0;
  } else {
    await onDrift(initialReport);
  }

  // Log tool counts per organ
  for (const organ of initialReport.organs) {
    const required = organs.find(o => o.id === organ.organ_id)?.required_tools?.length ?? 0;
    console.log(`[SurfaceGuard]   ${organ.organ_id}: ${organ.tool_count} tools (${required} required), ${organ.latency_ms}ms`);
  }

  // Continuous polling
  const interval = setInterval(async () => {
    try {
      const report = await runner.check();
      
      if (report.status === 'PASS') {
        if (lastReport?.status !== 'PASS') {
          console.log(`[SurfaceGuard] ✅ Recovered: all organs clear`);
        }
        consecutiveDrifts = 0;
      } else {
        await onDrift(report);
      }
      
      lastReport = report;
    } catch (err) {
      console.error(`[SurfaceGuard] Check failed: ${err}`);
    }
  }, CHECK_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = () => {
    console.log(`[SurfaceGuard] Shutting down...`);
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error(`[SurfaceGuard] Fatal: ${err}`);
  process.exit(1);
});
