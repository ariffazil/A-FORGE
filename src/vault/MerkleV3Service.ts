/**
 * MerkleV3 — Cryptographically tamper-evident hash chain for VAULT999.
 *
 * Architecture:
 *   row_hash  = SHA-256(content_fields + prev_hash) — each row links to the previous
 *   prev_hash = prior row's row_hash (chain), or row_hash itself for row #1
 *   merkle_root = SHA-256(sorted(all row_hash values)) — daily aggregate
 *
 * Verification:
 *   Recompute row_hash for each row → verify prev_hash chain → recompute
 *   daily merkle_root → compare against stored root.
 *
 * F1/F11 compliant: append-only, tamper-evident, human-verifiable.
 */

import { createHash } from "node:crypto";
import { getPostgresVaultClient, type PostgresVaultClient } from "./index.js";
import type { VaultVerdict } from "./VaultClient.js";

export interface TelemetryRow {
  id: number;
  epoch: Date;
  session_id: string | null;
  agent_id: string | null;
  ds: number | null;
  peace2: number | null;
  kappa_r: number | null;
  shadow: number | null;
  confidence: number | null;
  psi_le: number | null;
  verdict: VaultVerdict;
  witness_human: number | null;
  witness_ai: number | null;
  witness_earth: number | null;
  qdf: number | null;
  prev_hash: string | null;
  row_hash: string | null;
}

export interface MerkleVerificationResult {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
  storedRoot: string | null;
  computedRoot: string | null;
  rowCount: number;
}

export class MerkleV3Service {
  constructor(private vault: PostgresVaultClient) {}

  /**
   * Compute SHA-256 hex digest of a telemetry row's content fields.
   * Does NOT include prev_hash or row_hash themselves.
   */
  computeRowHash(row: TelemetryRow): string {
    const content = [
      row.id,
      row.epoch.toISOString(),
      row.session_id ?? "",
      row.agent_id ?? "",
      String(row.ds ?? ""),
      String(row.peace2 ?? ""),
      String(row.kappa_r ?? ""),
      String(row.shadow ?? ""),
      String(row.confidence ?? ""),
      String(row.psi_le ?? ""),
      row.verdict,
      String(row.witness_human ?? ""),
      String(row.witness_ai ?? ""),
      String(row.witness_earth ?? ""),
      String(row.qdf ?? ""),
    ].join("|");
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Compute merkle root from an ordered list of row hashes.
   * Uses sorted-pair hashing (binary Merkle tree style).
   */
  computeMerkleRoot(rowHashes: string[]): string {
    if (rowHashes.length === 0) return createHash("sha256").update("EMPTY_DAY").digest("hex");
    if (rowHashes.length === 1) return rowHashes[0];

    const sorted = [...rowHashes].sort();
    const nextLevel: string[] = [];
    for (let i = 0; i < sorted.length; i += 2) {
      if (i + 1 < sorted.length) {
        nextLevel.push(createHash("sha256").update(sorted[i] + sorted[i + 1]).digest("hex"));
      } else {
        nextLevel.push(createHash("sha256").update(sorted[i] + sorted[i]).digest("hex"));
      }
    }
    return this.computeMerkleRoot(nextLevel);
  }

  /**
   * Load all telemetry rows for a given date, ordered by id.
   */
  async loadRowsForDate(date: Date): Promise<TelemetryRow[]> {
    const result = await this.vault.queryDb<TelemetryRow>(
      `SELECT id, epoch, session_id, agent_id, ds, peace2, kappa_r, shadow,
              confidence, psi_le, verdict, witness_human, witness_ai, witness_earth,
              qdf, prev_hash, row_hash
       FROM arifos.agent_telemetry
       WHERE DATE(epoch) = $1
       ORDER BY id`,
      [date.toISOString().split("T")[0]],
    );
    return result.rows;
  }

  /**
   * Populate row_hash and prev_hash for all un-hashed rows on a given date.
   * Row 1: prev_hash = row_hash (self-reference, chain seed)
   * Row N: prev_hash = row_hash of row N-1
   */
  async buildChainForDate(date: Date): Promise<{ updated: number }> {
    const rows = await this.loadRowsForDate(date);
    if (rows.length === 0) return { updated: 0 };

    let prevHash = rows[0].row_hash;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const computedRowHash = this.computeRowHash(row);

      if (i === 0) {
        prevHash = computedRowHash;
      } else {
        prevHash = rows[i - 1].row_hash ?? this.computeRowHash(rows[i - 1]);
      }

      await this.vault.queryDb(
        `UPDATE arifos.agent_telemetry
         SET row_hash = $1, prev_hash = $2
         WHERE id = $3 AND (row_hash IS NULL OR prev_hash IS NULL)`,
        [computedRowHash, i === 0 ? computedRowHash : prevHash, row.id],
      );
      updated++;
    }
    return { updated };
  }

  /**
   * Compute and upsert the daily Merkle root into daily_roots.
   * Uses sorted pairwise hashing over all row_hash values for the day.
   */
  async computeAndAnchorRoot(date: Date): Promise<string> {
    const rows = await this.loadRowsForDate(date);
    const hashCounts = rows.filter((r) => r.row_hash !== null);
    if (hashCounts.length === 0) throw new Error(`No hashed rows for ${date.toISOString().split("T")[0]}`);

    const rowHashes = hashCounts.map((r) => r.row_hash!);
    const merkleRoot = this.computeMerkleRoot(rowHashes);

    await this.vault.queryDb(
      `INSERT INTO arifos.daily_roots (root_date, row_count, merkle_root, anchored, created_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (root_date) DO UPDATE
       SET row_count = $2, merkle_root = $3, anchored = true`,
      [date.toISOString().split("T")[0], rowHashes.length, merkleRoot],
    );
    return merkleRoot;
  }

  /**
   * Verify the full Merkle chain for a given date.
   * Checks: row_hash integrity → prev_hash chain → merkle_root match.
   */
  async verifyChain(date: Date): Promise<MerkleVerificationResult> {
    const rows = await this.loadRowsForDate(date);
    if (rows.length === 0) {
      return { valid: false, reason: "No rows for date", storedRoot: null, computedRoot: null, rowCount: 0 };
    }

    const storedRootRow = await this.vault.queryDb(
      `SELECT merkle_root FROM arifos.daily_roots WHERE root_date = $1`,
      [date.toISOString().split("T")[0]],
    );
    const storedRoot = (storedRootRow.rows[0]?.merkle_root as string | null | undefined) ?? null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const expectedRowHash = this.computeRowHash(row);

      if (row.row_hash === null || row.row_hash !== expectedRowHash) {
        return {
          valid: false,
          brokenAt: row.id,
          reason: `Row ${row.id}: row_hash mismatch (expected ${expectedRowHash.slice(0, 16)}...)`,
          storedRoot,
          computedRoot: null,
          rowCount: rows.length,
        };
      }

      if (i === 0) {
        if (row.prev_hash !== row.row_hash) {
          return {
            valid: false,
            brokenAt: row.id,
            reason: `Row ${row.id}: first row prev_hash should equal row_hash (chain seed)`,
            storedRoot,
            computedRoot: null,
            rowCount: rows.length,
          };
        }
      } else {
        const expectedPrevHash = rows[i - 1].row_hash;
        if (row.prev_hash !== expectedPrevHash) {
          return {
            valid: false,
            brokenAt: row.id,
            reason: `Row ${row.id}: prev_hash should be ${(expectedPrevHash ?? "").slice(0, 16)}...`,
            storedRoot,
            computedRoot: null,
            rowCount: rows.length,
          };
        }
      }
    }

    const computedRoot = this.computeMerkleRoot(rows.map((r) => r.row_hash as string));
    if (storedRoot && computedRoot !== storedRoot) {
      return {
        valid: false,
        reason: `Merkle root mismatch: stored=${(storedRoot as string).slice(0, 16)}..., computed=${computedRoot.slice(0, 16)}...`,
        storedRoot: storedRoot as string | null,
        computedRoot,
        rowCount: rows.length,
      };
    }

    return {
      valid: true,
      storedRoot: storedRoot as string | null,
      computedRoot,
      rowCount: rows.length,
    };
  }

  /**
   * Full daily cycle: build chain + anchor root + verify.
   * Call this once per day (e.g., end-of-day cron).
   */
  async dailySeal(date: Date = new Date()): Promise<MerkleVerificationResult> {
    const { updated } = await this.buildChainForDate(date);
    if (updated > 0) {
      process.stderr.write(`[MerkleV3] Chain built: ${updated} rows updated for ${date.toISOString().split("T")[0]}\n`);
    }
    await this.computeAndAnchorRoot(date);
    return this.verifyChain(date);
  }
}
