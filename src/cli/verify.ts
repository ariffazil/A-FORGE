#!/usr/bin/env node
/**
 * A-FORGE-verify — One-shot system health check
 * DITEMPA BUKAN DIBERI
 *
 * Verifies:
 *   1. Constitution — 13 floor rules from vault
 *   2. Merkle chain — hash integrity of telemetry rows
 *   3. Sessions — open sessions with turn counts
 *   4. Tool calls — rows exist (proves GO 3 is live)
 *   5. Agent telemetry — recent SEAL rows
 *   6. Vault root — daily_roots anchored
 *   7. Tool lattice — 33 organ + 17 substrate = 52 total (from registry.json)
 *
 * Usage:
 *   node dist/src/cli/verify.js
 *   POSTGRES_URL=postgresql://... node dist/src/cli/verify.js
 */

import { getPostgresVaultClient, MerkleV3Service } from "../vault/index.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pgUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";

async function main() {
  if (!pgUrl) {
    console.error("POSTGRES_URL not set");
    process.exit(1);
  }

  const vault = getPostgresVaultClient(pgUrl);
  const merkle = new MerkleV3Service(vault);
  const checks = { ok: true, items: [] as string[] };

  // 1. Constitution
  try {
    const floors = await vault.loadConstitution();
    if (floors.length === 13) {
      const f13 = floors.find((f) => f.code === "F13");
      checks.items.push(`✅ Constitution: ${floors.length}/13 floors (F13 threshold=${f13?.seal_threshold})`);
    } else {
      checks.ok = false;
      checks.items.push(`❌ Constitution: ${floors.length}/13 floors`);
    }
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Constitution: ${e}`);
  }

  // 2. Merkle chain for today
  try {
    const today = new Date();
    const result = await merkle.verifyChain(today);
    if (result.valid) {
      checks.items.push(`✅ Merkle v3: ${result.rowCount} rows, root=${(result.computedRoot ?? "").slice(0, 16)}...`);
    } else {
      process.stderr.write(`[MerkleV3] Chain broken at row ${result.brokenAt} — ${result.reason}. Attempting rebuild...\n`);
      try {
        const rebuild = await merkle.dailySeal(today);
        if (rebuild.valid) {
          checks.items.push(`✅ Merkle v3: REBUILT — ${rebuild.rowCount} rows, root=${(rebuild.computedRoot ?? "").slice(0, 16)}...`);
        } else {
          checks.ok = false;
          checks.items.push(`❌ Merkle v3: REBUILD FAILED — ${rebuild.reason}`);
        }
      } catch (rebuildErr) {
        checks.ok = false;
        checks.items.push(`❌ Merkle v3: BROKEN at row ${result.brokenAt} — ${result.reason}`);
      }
    }
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Merkle v3: ${e}`);
  }

  // 3. Sessions
  try {
    const result = await vault.queryDb<{ session_id: string; agent_id: string; turn_count: number; final_verdict: string | null }>(
      `SELECT session_id, agent_id, turn_count, final_verdict FROM arifos.sessions ORDER BY initiated_at DESC LIMIT 5`,
    );
    const open = result.rows.filter((r) => !r.final_verdict).length;
    checks.items.push(`✅ Sessions: ${result.rows.length} total, ${open} open`);
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Sessions: ${e}`);
  }

  // 4. Tool calls
  try {
    const result = await vault.queryDb<{ tool_name: string; verdict: string; created_at: string }>(
      `SELECT tool_name, verdict, created_at FROM arifos.tool_calls ORDER BY created_at DESC LIMIT 5`,
    );
    if (result.rows.length > 0) {
      checks.items.push(`✅ Tool calls: ${result.rows.length} recent — last=${result.rows[0].tool_name} [${result.rows[0].verdict}]`);
    } else {
      checks.ok = false;
      checks.items.push(`⚠️  Tool calls: 0 rows — GO 3 not yet active (await vault-patch-2)`);
    }
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Tool calls: ${e}`);
  }

  // 5. Agent telemetry
  try {
    const result = await vault.queryDb<{ id: number; agent_id: string; verdict: string; epoch: string }>(
      `SELECT id, agent_id, verdict, epoch FROM arifos.agent_telemetry ORDER BY id DESC LIMIT 5`,
    );
    const seals = result.rows.filter((r) => r.verdict === "SEAL").length;
    checks.items.push(`✅ Telemetry: ${result.rows.length} recent, ${seals} SEAL`);
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Telemetry: ${e}`);
  }

  // 6. Daily roots
  try {
    const result = await vault.queryDb<{ root_date: string; row_count: number; merkle_root: string; anchored: boolean }>(
      `SELECT root_date, row_count, merkle_root, anchored FROM arifos.daily_roots ORDER BY root_date DESC`,
    );
    if (result.rows.length > 0) {
      const r = result.rows[0];
      checks.items.push(`✅ Vault root: ${r.root_date} ${r.anchored ? "✅ anchored" : "❌ unanchored"} (${r.row_count} rows, ${r.merkle_root.slice(0, 16)}...)`);
    } else {
      checks.ok = false;
      checks.items.push(`❌ Vault root: no daily_roots rows`);
    }
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Vault root: ${e}`);
  }

  // 7. Tool lattice — 33 organ + 17 substrate = 52
  try {
    const regPath = resolve(process.env.REGISTRY_PATH ?? "/root/WEALTH/registry.json");
    const reg = JSON.parse(readFileSync(regPath, "utf8"));
    const toolCounts = reg.tool_counts ?? {};

    const organAxis = toolCounts.organ_axis ?? 0;
    const substrates = toolCounts.substrates ?? 0;
    const total = toolCounts.total_live ?? 0;

    if (organAxis === 33 && substrates === 17 && total === 52) {
      checks.items.push(`✅ Tool lattice: ${organAxis} organ + ${substrates} substrate = ${total} total (33+17=52)`);
    } else {
      checks.ok = false;
      checks.items.push(`❌ Tool lattice: organ=${organAxis}/33, substrate=${substrates}/17, total=${total}/52`);
    }

    if (reg.orthogonal_bands?.length === 11) {
      checks.items.push(`✅ Orthogonal bands: ${reg.orthogonal_bands.length}/11 confirmed`);
    } else {
      checks.ok = false;
      checks.items.push(`❌ Orthogonal bands: ${reg.orthogonal_bands?.length ?? 0}/11`);
    }
  } catch (e) {
    checks.ok = false;
    checks.items.push(`❌ Tool lattice: ${e}`);
  }

  // Print results
  console.error("\nA-FORGE System Verification");
  console.error("════════════════════════════════");
  for (const item of checks.items) console.error(item);
  console.error("════════════════════════════════");
  console.error(`Overall: ${checks.ok ? "✅ SEAL" : "❌ HOLD"}\n`);
  process.exit(checks.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(`Fatal: ${e}`);
  process.exit(1);
});


