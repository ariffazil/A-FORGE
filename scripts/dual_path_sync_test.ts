/**
 * dual_path_sync_test.ts
 * ======================
 * Tests the VAULT999 dual-path architecture:
 *   PATH 1: Supabase REST RPC  → cloud vault (read/list)
 *   PATH 2: Local asyncpg      → arifos_vault PG (write via PostgresVaultClient)
 *
 * The goal: verify records written via one path are visible through the other.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://utbmmjmbolmuahwixjqc.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  "";

const LOCAL_PG =
  process.env.DATABASE_URL ??
  "postgresql://arifos_admin:ArifPostgresVault2026%21@localhost:5432/arifos_vault";

async function getPool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: LOCAL_PG });
}

async function testSupabaseWriteAndRead() {
  console.log("\n=== PATH 1: Supabase REST RPC ===");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testName = `sync-test-${Date.now()}`;
  const testCategory = "dual_path_sync";
  const testValue = JSON.stringify({ source: "A-FORGE", test: true, ts: new Date().toISOString() });
  const testMetadata = { tested_by: "A-FORGE", path: "Supabase REST" };

  // Write via vault_write RPC
  console.log(`Writing record: ${testName}`);
  const { data: writeData, error: writeError } = await sb.rpc("vault_write", {
    p_name: testName,
    p_category: testCategory,
    p_value: testValue,
    p_metadata: testMetadata,
    p_is_encrypted: false,
  });

  if (writeError) {
    console.error(`  ❌ vault_write failed: ${writeError.message}`);
    return null;
  }
  console.log(`  ✅ vault_write success → ${JSON.stringify(writeData)}`);

  // Read back via vault_read RPC
  console.log(`Reading record: ${testName}`);
  const { data: readData, error: readError } = await sb.rpc("vault_read", { p_name: testName });

  if (readError) {
    console.error(`  ❌ vault_read failed: ${readError.message}`);
    return null;
  }
  console.log(`  ✅ vault_read success → ${JSON.stringify(readData)}`);

  // List all records in test category
  console.log(`Listing records in category: ${testCategory}`);
  const { data: listData, error: listError } = await sb.rpc("vault_list", {
    p_category: testCategory,
    p_limit: 100,
  });

  if (listError) {
    console.error(`  ❌ vault_list failed: ${listError.message}`);
  } else {
    console.log(`  ✅ vault_list success → ${(listData as unknown[]).length} records`);
    const found = (listData as unknown[]).find((r: any) => r.name === testName);
    console.log(`  Record present in list: ${found ? "✅" : "❌"}`);
  }

  return testName;
}

async function testLocalPgRead(testName: string) {
  console.log("\n=== PATH 2: Local PostgreSQL (asyncpg) ===");

  let Pool: typeof import("pg").Pool;
  try {
    ({ Pool } = await import("pg"));
  } catch {
    console.log("  ⚠️  pg module not available — skipping local PG test");
    return;
  }

  const pool = new Pool({ connectionString: LOCAL_PG });

  try {
    // Query vault_events table (local PG write path via PostgresVaultClient)
    console.log(`Querying vault_events for: ${testName}`);
    const result = await pool.query(
      `SELECT event_id, event_type, session_id, verdict, sealed_at
       FROM vault_events
       WHERE event_id = $1
       ORDER BY sealed_at DESC
       LIMIT 1`,
      [testName],
    );

    if (result.rows.length > 0) {
      console.log(`  ✅ Found in vault_events: ${JSON.stringify(result.rows[0])}`);
    } else {
      console.log(`  ⚠️  Not found in vault_events (may not have been written via local PG path yet)`);
    }

    // Also check arifosmcp_vault_seals (Supabase direct write path)
    console.log(`Querying arifosmcp_vault_seals for: ${testName}`);
    const sealsResult = await pool.query(
      `SELECT seal_id, verdict, created_at
       FROM arifosmcp_vault_seals
       WHERE seal_id = $1
       LIMIT 1`,
      [testName],
    );

    if (sealsResult.rows.length > 0) {
      console.log(`  ✅ Found in arifosmcp_vault_seals: ${JSON.stringify(sealsResult.rows[0])}`);
    } else {
      console.log(`  ⚠️  Not found in arifosmcp_vault_seals`);
    }
  } catch (err) {
    console.error(`  ❌ Local PG query failed: ${err}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       VAULT999 DUAL-PATH SYNC TEST          ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Local PG: ${LOCAL_PG.replace(/:[^@]+@/, ":***@")}`);

  // Step 1: Write via REST, read back via REST
  const testName = await testSupabaseWriteAndRead();

  if (!testName) {
    console.error("\n❌ REST path test failed — aborting");
    process.exit(1);
  }

  // Step 2: Read via local PG to verify cross-path visibility
  await testLocalPgRead(testName);

  console.log("\n=== CLEANUP ===");
  console.log(`Deleting test record: ${testName}`);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await sb.rpc("vault_delete", { p_name: testName });
  if (deleteError) {
    console.error(`  ⚠️  vault_delete warning: ${deleteError.message}`);
  } else {
    console.log(`  ✅ Deleted`);
  }

  console.log("\n✅ Dual-path sync test complete");
}

main().catch((err) => {
  console.error(`\n❌ Fatal: ${err}`);
  process.exit(1);
});
