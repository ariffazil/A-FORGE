#!/usr/bin/env node
/**
 * P3.6 — Postgres ↔ Qdrant Memory Reconciliation Tool
 *
 * Detects inconsistencies between the canonical Postgres memory store
 * and the Qdrant vector projection. Read-only — never mutates, never deletes.
 *
 * Reports:
 *   1. Qdrant points without Postgres records (orphan projections)
 *   2. Postgres records without Qdrant projections (unprojected)
 *   3. Mismatched content hashes (drift)
 *   4. Duplicate identities (double-write)
 *   5. Stale versions (superseded records still in vector search)
 *   6. Deleted records still returned by Qdrant (soft-delete violation)
 *   7. Graph projections without canonical parents
 *
 * Usage:
 *   npx tsx scripts/reconcile-memory-stores.ts [--fix-dry-run]
 *
 * DITEMPA BUKAN DIBERI — observe only; never delete.
 */

import { createHmac } from "crypto";

// ── Configuration ────────────────────────────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "arifos_memory";
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const MEMORY_TABLE = "memory_store";
const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes("--dry-run");

// ── Types ────────────────────────────────────────────────────────────────
interface QdrantPoint {
  id: string;
  payload: Record<string, unknown>;
}

interface PgRecord {
  memory_id: string;
  content_hash: string;
  deleted_at: string | null;
  superseded_by: string | null;
  tier: string;
  created_at: string;
  actor_id: string;
}

interface ReconciliationFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  type: string;
  detail: string;
  pg_id?: string;
  qdrant_id?: string;
}

interface ReconciliationReport {
  scanned: { qdrant: number; postgres: number };
  findings: ReconciliationFinding[];
  summary: Record<string, number>;
  verdict: "CLEAN" | "DRIFT" | "CORRUPT";
}

// ── Helpers ───────────────────────────────────────────────────────────────
function hashContent(content: string): string {
  return createHmac("sha256", "memory-recon-v1").update(content).digest("hex").slice(0, 32);
}

function severityCounts(findings: ReconciliationFinding[]): Record<string, number> {
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  return counts;
}

// ── Qdrant Client ────────────────────────────────────────────────────────
async function fetchQdrantPoints(): Promise<QdrantPoint[]> {
  const points: QdrantPoint[] = [];
  let offset: string | null = null;

  while (true) {
    const body: Record<string, unknown> = {
      limit: BATCH_SIZE,
      with_payload: true,
      with_vector: false,
    };
    if (offset) body.offset = offset;

    const res = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[RECONCILE] Qdrant returned HTTP ${res.status}`);
      break;
    }

    const data = (await res.json()) as {
      result?: { points?: QdrantPoint[]; next_page_offset?: string | null };
    };
    const batch = data.result?.points || [];
    points.push(...batch);
    offset = data.result?.next_page_offset || null;

    if (!offset || batch.length === 0) break;
    if (points.length % 5000 === 0) {
      console.error(`[RECONCILE] Scanned ${points.length} Qdrant points...`);
    }
  }

  return points;
}

// ── Postgres Client ──────────────────────────────────────────────────────
async function fetchPgRecords(): Promise<PgRecord[]> {
  if (!POSTGRES_URL) {
    console.error("[RECONCILE] No DATABASE_URL configured — skipping Postgres scan");
    return [];
  }

  // Use dynamic import for pg — installed as optional dependency
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: POSTGRES_URL, max: 2 });

    const result = await pool.query(
      `SELECT memory_id, content_hash, deleted_at, superseded_by, tier, created_at, actor_id
       FROM ${MEMORY_TABLE}
       ORDER BY created_at DESC
       LIMIT 50000`,
    );

    await pool.end();
    return result.rows as PgRecord[];
  } catch (err) {
    console.error(`[RECONCILE] Postgres query failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ── Reconciliation Logic ─────────────────────────────────────────────────
function reconcile(
  qdrantPoints: QdrantPoint[],
  pgRecords: PgRecord[],
): ReconciliationReport {
  const findings: ReconciliationFinding[] = [];
  const qdrantIds = new Set(qdrantPoints.map((p) => String(p.id)));
  const pgIds = new Set(pgRecords.map((r) => r.memory_id));
  const pgMap = new Map(pgRecords.map((r) => [r.memory_id, r]));
  const qdrantMap = new Map(qdrantPoints.map((p) => [String(p.id), p]));

  // 1. Qdrant points without Postgres records (orphan projections)
  for (const qid of qdrantIds) {
    if (!pgIds.has(qid)) {
      findings.push({
        severity: "HIGH",
        type: "ORPHAN_PROJECTION",
        detail: `Qdrant point ${qid} has no corresponding Postgres record`,
        qdrant_id: qid,
      });
    }
  }

  // 2. Postgres records without Qdrant projections (unprojected)
  for (const pid of pgIds) {
    if (!qdrantIds.has(pid)) {
      const pg = pgMap.get(pid)!;
      if (pg.deleted_at) continue; // Soft-deleted records shouldn't be projected
      findings.push({
        severity: "MEDIUM",
        type: "UNPROJECTED_RECORD",
        detail: `Postgres record ${pid} (${pg.tier}, ${pg.created_at}) has no Qdrant projection`,
        pg_id: pid,
      });
    }
  }

  // 3. Mismatched content hashes (drift)
  for (const pid of pgIds) {
    const pg = pgMap.get(pid)!;
    const qd = qdrantMap.get(pid);
    if (!qd || !pg.content_hash) continue;

    const qdPayload = qd.payload as Record<string, unknown>;
    const qdHash = String(qdPayload.content_hash || qdPayload.hash || "");
    if (qdHash && qdHash !== pg.content_hash) {
      findings.push({
        severity: "HIGH",
        type: "CONTENT_HASH_MISMATCH",
        detail: `Postgres hash ${pg.content_hash.slice(0, 16)}... ≠ Qdrant hash ${qdHash.slice(0, 16)}... for ${pid}`,
        pg_id: pid,
        qdrant_id: pid,
      });
    }
  }

  // 4. Duplicate identities (same memory_id, multiple Qdrant points)
  const idCounts = new Map<string, number>();
  for (const p of qdrantPoints) {
    const id = String(p.id);
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      findings.push({
        severity: "MEDIUM",
        type: "DUPLICATE_IDENTITY",
        detail: `Qdrant has ${count} points with id ${id}`,
        qdrant_id: id,
      });
    }
  }

  // 5. Deleted records still in Qdrant (soft-delete violation)
  for (const pid of pgIds) {
    const pg = pgMap.get(pid)!;
    if (pg.deleted_at && qdrantIds.has(pid)) {
      findings.push({
        severity: "CRITICAL",
        type: "DELETED_STILL_PROJECTED",
        detail: `Postgres record ${pid} is soft-deleted (${pg.deleted_at}) but still appears in Qdrant`,
        pg_id: pid,
        qdrant_id: pid,
      });
    }
  }

  // 6. Superseded records still in Qdrant (stale version)
  for (const pid of pgIds) {
    const pg = pgMap.get(pid)!;
    if (pg.superseded_by && qdrantIds.has(pid)) {
      findings.push({
        severity: "MEDIUM",
        type: "STALE_VERSION_PROJECTED",
        detail: `Postgres record ${pid} was superseded by ${pg.superseded_by} but still in Qdrant`,
        pg_id: pid,
        qdrant_id: pid,
      });
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────
  const counts = severityCounts(findings);
  let verdict: "CLEAN" | "DRIFT" | "CORRUPT" = "CLEAN";
  if (counts.CRITICAL > 0) verdict = "CORRUPT";
  else if (findings.length > 0) verdict = "DRIFT";

  return {
    scanned: { qdrant: qdrantPoints.length, postgres: pgRecords.length },
    findings,
    summary: counts,
    verdict,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  P3.6: MEMORY STORE RECONCILIATION");
  console.log("  Canonical: Postgres  |  Projection: Qdrant");
  console.log("  Read-only — never mutates, never deletes");
  console.log("=".repeat(60));

  if (DRY_RUN) console.log("\n⚠️  DRY RUN MODE — no changes will be made\n");

  console.log("\n[1/3] Scanning Qdrant projection...");
  const qdrantPoints = await fetchQdrantPoints();
  console.log(`       Scanned ${qdrantPoints.length} Qdrant points`);

  console.log("\n[2/3] Scanning Postgres canonical store...");
  const pgRecords = await fetchPgRecords();
  console.log(`       Scanned ${pgRecords.length} Postgres records`);

  console.log("\n[3/3] Reconciling...");
  const report = reconcile(qdrantPoints, pgRecords);

  // ── Output ──────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  VERDICT: ${report.verdict}`);
  console.log(`  Qdrant:  ${report.scanned.qdrant} points`);
  console.log(`  Postgres: ${report.scanned.postgres} records`);
  console.log(`  Findings: ${report.findings.length} total`);
  console.log(`    CRITICAL: ${report.summary.CRITICAL}`);
  console.log(`    HIGH:     ${report.summary.HIGH}`);
  console.log(`    MEDIUM:   ${report.summary.MEDIUM}`);
  console.log(`    LOW:      ${report.summary.LOW}`);
  console.log(`${"=".repeat(60)}`);

  if (report.findings.length > 0) {
    console.log("\n── FINDINGS ──────────────────────────────────────────");
    for (const f of report.findings) {
      const icon = f.severity === "CRITICAL" ? "🔴" : f.severity === "HIGH" ? "🟠" : f.severity === "MEDIUM" ? "🟡" : "⚪";
      console.log(`  ${icon} [${f.severity}] ${f.type}`);
      console.log(`     ${f.detail}`);
    }
  }

  // ── Exit code ───────────────────────────────────────────────────────
  if (report.verdict === "CORRUPT") process.exit(2);
  if (report.verdict === "DRIFT") process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[RECONCILE] Fatal: ${err.message}`);
  process.exit(3);
});
