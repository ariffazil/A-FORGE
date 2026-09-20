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
import { createHash } from 'crypto';
import { join } from 'path';

import {
  getSurfaceGuardStore,
  SurfaceGuardRunner,
  type SurfaceGuardStore,
  type FederationDriftReport,
  type OrganConfig,
} from '../src/domain/governance/mcp-surface-guard.js';

// ─── Config ────────────────────────────────────────────────────────

const CONFIG_PATH = '/root/A-FORGE/config/mcp-surface-guard.json';
const LOG_DIR = '/var/log/surface-guard';
const SIG_PATH = join(LOG_DIR, '.last-signature');
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

// Volatile fields carry no governance content: they differ on every probe by
// construction. Strip them before hashing so the signature reflects STATE, not clock.
function substantiveSignature(report: FederationDriftReport): string {
  const strip = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(strip);
    if (o && typeof o === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o as Record<string, unknown>).sort()) {
        if (k === 'checked_at' || k === 'detected_at' || k === 'latency_ms') continue;
        out[k] = strip((o as Record<string, unknown>)[k]);
      }
      return out;
    }
    return o;
  };
  return createHash('sha256').update(JSON.stringify(strip(report))).digest('hex');
}

// STATE TRANSITION EMITTER (2026-09-20, F13-authorized).
// Writes an event file ONLY when the substantive state differs from the last
// persisted signature. Before this gate the daemon emitted drift-<ts>.json every
// probe: 38,282 files / 45 days, 100% HOLD, 46% byte-identical duplicates, and no
// reader on the box. Witness that cannot change a decision is archive, not governance.
// latest.json remains the single always-current state file (overwritten in place).
function writeReport(report: FederationDriftReport): boolean {
  ensureLogDir();
  const sig = substantiveSignature(report);
  const prev = existsSync(SIG_PATH) ? readFileSync(SIG_PATH, 'utf-8').trim() : '';
  if (sig === prev) return false;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(LOG_DIR, `drift-${ts}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  writeFileSync(SIG_PATH, sig + '\n');
  console.log(`[SurfaceGuard] STATE TRANSITION ${sig.slice(0, 12)} → report written: ${path}`);
  return true;
}

function writeLatest(report: FederationDriftReport): void {
  ensureLogDir();
  writeFileSync(join(LOG_DIR, 'latest.json'), JSON.stringify(report, null, 2));
}

function writeBaselineReceipt(store: SurfaceGuardStore, organs: OrganConfig[]): void {
  ensureLogDir();
  const load = store.getBaselineLoad();
  const pinned = organs.map(o => ({
    organ_id: o.id,
    reference_signature: store.getPinnedSignature(o.id) || null,
  }));
  const receipt = {
    schema: 'arifos.surface-guard.baseline-receipt.v1',
    ts: new Date().toISOString(),
    pid: process.pid,
    baseline_path: load.path,
    baseline_loaded: load.loaded,
    baseline_saved_at: load.saved_at ?? null,
    baseline_organ_count: load.organ_count ?? null,
    oldest_reference_at: load.oldest_snapshot_at ?? null,
    load_error: load.error ?? null,
    amnesty_granted: !load.loaded,
    amnesty_note: load.loaded
      ? 'reference loaded from disk — drift accumulated before this boot is still measured'
      : 'NO reference on disk — organs pinned at current state. Pre-boot drift is NOT reported by this process.',
    organs: pinned,
  };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(LOG_DIR, `baseline-${ts}.json`), JSON.stringify(receipt, null, 2));
  console.log(
    `[SurfaceGuard] BASELINE ${load.loaded ? 'LOADED' : 'ABSENT (amnesty)'} ` +
    `path=${load.path} organs=${pinned.length} saved_at=${load.saved_at ?? 'n/a'}`
  );
  for (const p of pinned) console.log(`[SurfaceGuard]   ref ${p.organ_id}: ${p.reference_signature ?? '(newly pinned)'}`);
}

// ─── NATS Alert ────────────────────────────────────────────────────

// A read that differed from the reference and then matched it on the
// confirmation probe is a transient (cold or flapping organ), not a change.
// It is reported — at warning level, in the journal, which is this watchdog's
// real alert surface — but it never becomes an event file and never moves the
// reference.
let transientsSeen = 0;
function noteTransients(runner: SurfaceGuardRunner): void {
  const t = runner.getTransients();
  for (let i = transientsSeen; i < t.length; i++) {
    console.warn(
      `[SurfaceGuard] TRANSIENT READ DISCARDED organ=${t[i].organ_id} differing=${t[i].tools_differing_on_first_read} — ${t[i].resolution}`
    );
  }
  transientsSeen = t.length;
}

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

  // ─── BASELINE RECEIPT (2026-09-20, F13-authorized) ────────────────
  // A restart must never be silent. If the reference was loaded from disk we
  // say what it is and how old it is. If it was absent, we say so explicitly:
  // the organs were pinned at their CURRENT state, which means any drift that
  // existed before this boot is NOT being reported. That is an amnesty, and an
  // amnesty that leaves no record is indistinguishable from a clean bill.
  writeBaselineReceipt(store, organs);

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

      noteTransients(runner);
      writeLatest(report); // latest.json is the single live state file — always current
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
