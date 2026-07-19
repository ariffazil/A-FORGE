#!/usr/bin/env node
/**
 * 🔥 GATE-FIRE → COOLING AUTO-BRIDGE
 * 
 * T2.2 — Automatically route gate_fire tier≥3 claims into cooling entries.
 * 
 * Logic:
 *   - Read gate_fire.jsonl (handle bad JSON gracefully)
 *   - Filter for tier_assigned >= 3 and gate_verdict in {PASS, FAIL}
 *   - Group similar claims by claim_type + agent_id → detect recurrences
 *   - New drift → forge_cool_drift (first_cooling)
 *   - Recurrence → forge_cool_pattern (with recurrence_count)
 *   - Skip already-cooled claims (dedup via claim_text hash in cooling_ledger)
 *   - Write to cooling_ledger.jsonl
 *   - Write to Supabase cooling_ledger_entries
 * 
 * DITEMPA BUKAN DIBERI — Cooling is forged from gate_fire, not given.
 * 
 * Usage: node gate-fire-cooling-bridge.mjs [--dry-run] [--session-id SESSION_ID]
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'node:path';

// ── CONFIG ──────────────────────────────────────────────────────────
const GATE_FIRE_PATH = '/root/.local/share/arifos/gate_fire.jsonl';
const COOLING_LEDGER_PATH = '/root/.local/share/arifos/cooling_ledger.jsonl';
const SEAL_CHAIN_JS = '/root/AAA/a2a-server/seal_chain.js';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const SESSION_ID = process.argv.includes('--session-id')
  ? process.argv[process.argv.indexOf('--session-id') + 1]
  : `bridge-${Date.now()}`;

// ── HELPERS ─────────────────────────────────────────────────────────
function hashClaim(claimText) {
  return createHash('sha256').update(String(claimText).slice(0, 200)).digest('hex').slice(0, 16);
}

function isoNow() {
  return new Date().toISOString();
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    return raw.split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map((l, i) => {
        try { return JSON.parse(l); }
        catch { if (VERBOSE) console.warn(`  ⚠️ Bad JSON line ${i+1} in ${path}`); return null; }
      })
      .filter(Boolean);
  } catch (err) {
    console.error(`Failed to read ${path}: ${err.message}`);
    return [];
  }
}

function readCooledClaimHashes() {
  const entries = readJsonl(COOLING_LEDGER_PATH);
  return new Set(entries.map(e => e.claim_hash).filter(Boolean));
}

function appendCoolingLedger(entry) {
  const dir = dirname(COOLING_LEDGER_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(COOLING_LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf-8');
  console.log(`  📝 Wrote cooling entry #${entry.entry_seq} → ${COOLING_LEDGER_PATH}`);
}

/**
 * Invoke seal_chain.js to write a cooling receipt to VAULT999.
 */
function writeCoolingReceiptToVault(envelope) {
  try {
    const payload = JSON.stringify(envelope);
    const escaped = payload.replace(/'/g, "'\\''");
    const cmd = `node ${SEAL_CHAIN_JS} write '${escaped}'`;
    const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.error(`  ❌ seal_chain.js write failed: ${err.message}`);
    return null;
  }
}

/**
 * Write to Supabase cooling_ledger_entries table.
 */
async function writeToSupabase(entry) {
  if (!SUPABASE_KEY || DRY_RUN) return null;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('cooling_ledger_entries')
      .insert({
        epoch: entry.ts,
        organ: entry.governance_organ || 'A-FORGE',
        entry_type: entry.entry_type || 'evidence',
        payload: entry,
        verdict_state: 'PENDING',
        temperature: 1.0,
        risk_score: entry.risk_score || 0.5,
        decay_tier: 'HOT',
        principal_id: 'FORGE-000Ω',
        agent_role: 'bridge',
        session_id: SESSION_ID,
      })
      .select();
    if (error) {
      if (VERBOSE) console.warn(`  ⚠️ Supabase insert warning: ${error.message}`);
      return null;
    }
    console.log(`  🗄️  Supabase: inserted cooling entry id=${data?.[0]?.id || '?'}`);
    return data;
  } catch (err) {
    if (VERBOSE) console.warn(`  ⚠️ Supabase unavailable: ${err.message}`);
    return null;
  }
}

/**
 * Classify a claim's severity and drift dimension for cooling.
 */
function classifyClaim(claim) {
  const ct = (claim.claim_type || '').toLowerCase();
  const text = (claim.claim_text || '').toLowerCase();
  const action = (claim.action || '').toLowerCase();

  // Defaults
  let drift_dimension = 'other';
  let severity = 'INFO';
  let governance_organ = 'A-FORGE';
  let governance_floor = 'F4';
  let hypothesis = 'Gate fire claim flagged for cooling review';

  // Pattern-based classification
  if (ct.includes('pattern') || text.includes('recurring') || text.includes('again')) {
    drift_dimension = 'tool_behavior';
    severity = 'SIGNIFICANT';
    governance_floor = 'F2';
    hypothesis = 'Recurring pattern detected — needs systemic fix';
  }
  if (text.includes('deploy') || text.includes('restart') || text.includes('production')) {
    drift_dimension = 'runtime_commit';
    severity = claim.downgraded ? 'MINOR' : 'SIGNIFICANT';
    governance_organ = 'A-FORGE';
    governance_floor = 'F1';
    hypothesis = 'Deployment claim — verify runtime commit matches source';
  }
  if (text.includes('memory') || text.includes('stale') || text.includes('drift')) {
    drift_dimension = 'memory_staleness';
    severity = 'SIGNIFICANT';
    governance_floor = 'F4';
    hypothesis = 'Memory drift detected — requires compaction or revalidation';
  }
  if (text.includes('authority') || text.includes('permission') || text.includes('lease')) {
    drift_dimension = 'authority_leak';
    severity = 'CRITICAL';
    governance_floor = 'F8';
    hypothesis = 'Authority boundary concern — verify lease scope';
  }
  if (text.includes('test') && (text.includes('fail') || text.includes('broken'))) {
    drift_dimension = 'tool_behavior';
    severity = 'SIGNIFICANT';
    governance_floor = 'F2';
    hypothesis = 'Test failure pattern — root cause analysis needed';
  }

  return {
    drift_dimension,
    severity,
    governance_organ,
    governance_floor,
    hypothesis,
  };
}

// ── MAIN BRIDGE LOGIC ───────────────────────────────────────────────
async function runBridge() {
  console.log(`\n🔥 GATE-FIRE → COOLING AUTO-BRIDGE`);
  console.log(`   Session: ${SESSION_ID}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Time: ${isoNow()}\n`);

  // 1. Read gate_fire
  const claims = readJsonl(GATE_FIRE_PATH);
  console.log(`📊 gate_fire.jsonl: ${claims.length} parseable claims`);

  // 2. Filter tier ≥ 3, verdict ∈ {PASS, FAIL}
  const eligible = claims.filter(c => {
    const tier = c.tier_assigned;
    const verdict = (c.gate_verdict || '').toUpperCase();
    return tier >= 3 && (verdict === 'PASS' || verdict === 'FAIL' || verdict === 'HOLD');
  });
  console.log(`🎯 Eligible (tier≥3, verdict PASS/FAIL/HOLD): ${eligible.length}`);
  if (eligible.length === 0) {
    console.log('✅ Nothing to bridge. gate_fire has no tier≥3 claims.\n');
    return { bridged: 0, skipped: 0 };
  }

  // 3. Get already-cooled claim hashes for dedup
  const cooled = readCooledClaimHashes();
  console.log(`🔒 Already cooled claim hashes: ${cooled.size}`);

  // 4. Group by claim_type + agent for recurrence detection
  const groups = new Map();
  for (const c of eligible) {
    const key = `${c.claim_type || 'unknown'}::${c.agent_id || 'unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  // 5. Process each group
  let bridged = 0;
  let skipped = 0;
  let entrySeq = readJsonl(COOLING_LEDGER_PATH).length + 1;

  for (const [groupKey, groupClaims] of groups) {
    const [claimType, agentId] = groupKey.split('::');
    const count = groupClaims.length;
    const latest = groupClaims[groupClaims.length - 1];
    const first = groupClaims[0];
    const ch = hashClaim(latest.claim_text);

    // Skip if already cooled
    if (cooled.has(ch)) {
      if (VERBOSE) console.log(`  ⏭️  Skip (already cooled): ${groupKey} (hash=${ch})`);
      skipped++;
      continue;
    }

    const { drift_dimension, severity, governance_organ, governance_floor, hypothesis } = classifyClaim(latest);

    // New drift vs recurrence
    if (count === 1) {
      // ── NEW DRIFT → cool_drift ──
      const isFirstCooling = entrySeq <= readJsonl(COOLING_LEDGER_PATH).length + 1 + bridged;
      
      console.log(`\n🌀 New drift: ${groupKey}`);
      console.log(`   Claim: "${latest.claim_text?.slice(0, 80)}..."`);
      console.log(`   Tier: ${latest.tier_assigned} | Verdict: ${latest.gate_verdict}`);
      console.log(`   Dimension: ${drift_dimension} | Severity: ${severity}`);

      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would create cool_drift entry`);
        bridged++;
        continue;
      }

      try {
        // Build cooling receipt envelope
        const envelope = {
          seal_version: 3,
          event_type: 'cooling.receipt',
          epoch: isoNow(),
          action_class: 'OBSERVE',
          caller: 'gate-fire-bridge',
          actor: 'gate-fire-bridge',
          session_id: SESSION_ID,
          original_seal_seq: 0,
          original_verdict: {
            verdict: latest.gate_verdict || 'SEAL',
            judge_hash: `sha256:${ch}`,
            judge_summary: latest.claim_text?.slice(0, 100) || 'Gate fire claim',
          },
          drift_detected: {
            present: true,
            observations: [{
              dimension: drift_dimension,
              delta: `gate_fire claim: ${latest.claim_text?.slice(0, 200)}`,
              epistemic_label: latest.emitted_as || 'OBS',
              severity,
            }],
          },
          proposed_improvement: {
            hypothesis,
            evidence: `gate_fire receipt_id=${latest.receipt_id}, tier=${latest.tier_assigned}`,
            epistemic_label: 'INT',
            risk_if_applied: severity === 'CRITICAL' ? 'HIGH' : severity === 'SIGNIFICANT' ? 'MEDIUM' : 'LOW',
            risk_if_not_applied: 'Gate fire claims without cooling lose systemic learning',
            alternatives: [],
          },
          governance_path: {
            target_organ: governance_organ,
            target_floor: governance_floor,
            required_authority: severity === 'CRITICAL' ? '888_HOLD' : 'AUTO',
            judge_required: severity === 'CRITICAL',
            reason: `Cooling from gate_fire auto-bridge: ${hypothesis}`,
          },
          supersedes: {
            seal_seq: 0,
            type: 'COLD_LINK',
            note: 'Lineage only. Original gate_fire claim is immutable.',
          },
          witness: {
            human: null,
            ai: 'gate-fire-bridge',
            external: null,
            witness_organ: governance_organ,  // T2.3: ΔΩΨ witness field
          },
          metabolism: {
            cycle_count: 1,
            previous_cooling_seq: null,
            convergence: isFirstCooling ? 'first_cooling' : 'CONVERGING',
          },
          cooling_source: 'gate_fire_auto_bridge',
          claim_hash: ch,
          source_receipt_id: latest.receipt_id,
        };

        // Write to VAULT999 via seal_chain.js
        const sealResult = writeCoolingReceiptToVault(envelope);

        // Write to cooling_ledger.jsonl
        const coolingEntry = {
          entry_seq: entrySeq++,
          parent_hash: sealResult?.hash || `sha256:${ch}`,
          seal_chain_ref: sealResult ? { seq: sealResult.seq, hash: sealResult.hash } : { seq: 0, hash: 'pending' },
          ts: isoNow(),
          agent: 'gate-fire-bridge',
          session_id: SESSION_ID,
          claim_hash: ch,
          source_receipt_id: latest.receipt_id,
          claim_type: claimType,
          gate_tier: latest.tier_assigned,
          gate_verdict: latest.gate_verdict,
          bottleneck: drift_dimension,
          fix_type: 'auto_bridge_cooling',
          fix_path: 'gate_fire.jsonl → cooling_ledger.jsonl',
          governance_organ,
          governance_floor,
          severity,
          delta_S: -0.25,
          verified: false,
          schema: 'cooling_ledger_entry.v2',
          entry_hash: createHash('sha256').update(JSON.stringify(envelope)).digest('hex'),
        };

        appendCoolingLedger(coolingEntry);
        
        // Write to Supabase
        await writeToSupabase(coolingEntry);

        bridged++;
      } catch (err) {
        console.error(`  ❌ Failed to bridge claim: ${err.message}`);
      }
    } else {
      // ── RECURRENCE → cool_pattern ──
      console.log(`\n🔄 Recurrence detected: ${groupKey} (${count} occurrences)`);
      console.log(`   First: ${first.timestamp} | Latest: ${latest.timestamp}`);
      console.log(`   Claim: "${latest.claim_text?.slice(0, 80)}..."`);

      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would create cool_pattern entry (count=${count})`);
        bridged++;
        continue;
      }

      try {
        const envelope = {
          seal_version: 3,
          event_type: 'cooling.receipt',
          epoch: isoNow(),
          action_class: 'OBSERVE',
          caller: 'gate-fire-bridge',
          actor: 'gate-fire-bridge',
          session_id: SESSION_ID,
          original_seal_seq: 0,
          original_verdict: {
            verdict: latest.gate_verdict || 'SEAL',
            judge_hash: `sha256:${ch}`,
            judge_summary: latest.claim_text?.slice(0, 100) || 'Gate fire recurring claim',
          },
          drift_detected: {
            present: true,
            observations: [
              {
                dimension: drift_dimension,
                delta: `gate_fire claim: ${latest.claim_text?.slice(0, 200)}`,
                epistemic_label: latest.emitted_as || 'OBS',
                severity: count >= 3 ? 'SIGNIFICANT' : severity,
              },
              {
                dimension: 'recurrence',
                delta: `Pattern observed ${count} times since ${first.timestamp}, last at ${latest.timestamp}`,
                epistemic_label: 'DER',
                severity: count >= 5 ? 'CRITICAL' : count >= 3 ? 'SIGNIFICANT' : 'MINOR',
              },
            ],
          },
          proposed_improvement: {
            hypothesis: `${hypothesis} (recurring ${count}×)`,
            evidence: `gate_fire receipt_ids: ${groupClaims.map(c => c.receipt_id).join(', ')}`,
            epistemic_label: 'INT',
            risk_if_applied: severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
            risk_if_not_applied: `Pattern ${count}× uncorrected risks systemic failure`,
            alternatives: [],
          },
          governance_path: {
            target_organ: governance_organ,
            target_floor: governance_floor,
            required_authority: count >= 5 ? '888_HOLD' : 'AUTO',
            judge_required: count >= 5,
            reason: `Cooling from gate_fire pattern bridge: ${hypothesis} (${count}×)`,
          },
          supersedes: {
            seal_seq: 0,
            type: 'COLD_LINK',
          },
          witness: {
            human: null,
            ai: 'gate-fire-bridge',
            external: null,
            witness_organ: governance_organ,  // T2.3
          },
          metabolism: {
            cycle_count: count,
            previous_cooling_seq: null,
            convergence: 'DIVERGING',
          },
          cooling_source: 'gate_fire_pattern_bridge',
          recurrence: {
            count,
            first_seen: first.timestamp,
            last_seen: latest.timestamp,
          },
          claim_hash: ch,
          source_receipt_id: latest.receipt_id,
        };

        const sealResult = writeCoolingReceiptToVault(envelope);

        const coolingEntry = {
          entry_seq: entrySeq++,
          parent_hash: sealResult?.hash || `sha256:${ch}`,
          seal_chain_ref: sealResult ? { seq: sealResult.seq, hash: sealResult.hash } : { seq: 0, hash: 'pending' },
          ts: isoNow(),
          agent: 'gate-fire-bridge',
          session_id: SESSION_ID,
          claim_hash: ch,
          source_receipt_id: latest.receipt_id,
          claim_type: claimType,
          gate_tier: latest.tier_assigned,
          gate_verdict: latest.gate_verdict,
          bottleneck: `${drift_dimension} (${count}× recurrence)`,
          fix_type: 'auto_bridge_cooling_pattern',
          fix_path: 'gate_fire.jsonl → cooling_ledger.jsonl',
          governance_organ,
          governance_floor,
          severity: count >= 5 ? 'CRITICAL' : severity,
          recurrence_count: count,
          first_seen: first.timestamp,
          last_seen: latest.timestamp,
          delta_S: -0.35,
          verified: false,
          schema: 'cooling_ledger_entry.v2',
          entry_hash: createHash('sha256').update(JSON.stringify(envelope)).digest('hex'),
        };

        appendCoolingLedger(coolingEntry);
        await writeToSupabase(coolingEntry);
        bridged++;
      } catch (err) {
        console.error(`  ❌ Failed to bridge pattern: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ BRIDGE COMPLETE: ${bridged} bridged, ${skipped} skipped, ${eligible.length} eligible\n`);
  return { bridged, skipped, total: eligible.length };
}

// ── RUN ─────────────────────────────────────────────────────────────
runBridge()
  .then(result => {
    if (result.bridged === 0 && result.skipped === 0) {
      console.log('⚠️  No claims bridged — gate_fire may be empty or already fully cooled.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(`\n❌ BRIDGE FAILED: ${err.message}`);
    process.exit(1);
  });
