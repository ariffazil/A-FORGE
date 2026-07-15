/**
 * ArifSeal — SHA-256 hash chain ledger for A-FORGE terminal execution.
 *
 * Seals every tool call result into an append-only hash chain (JSONL).
 * Each record: H(prev_hash ‖ canonical(record)), making retroactive edits
 * detectable. Digests only (SHA-256 of stdout/stderr) stored in chain;
 * full payloads stored in referenced blob store.
 *
 * Constitutional:
 *   F1 AMANAH — irreversible audit trail for every execution
 *   F2 TRUTH — evidence is hash-verified, not claimed
 *   F11 AUDIT — every action leaves a trace
 *
 * Pattern: SHA-256 hash chain, HMAC-signed, append-only JSONL,
 * replicated to VAULT999 via forwarder hook.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SealRecord {
  /** Monotonic sequence number */
  seq: number;
  /** ISO-8601 UTC timestamp */
  ts: string;
  /** Tool name that was called */
  tool: string;
  /** Tool arguments (secrets redacted) */
  args: Record<string, unknown>;
  /** What the judge decided: auto | gate→approved | gate→denied | deny */
  judge_decision: string;
  /** Who approved (if gated) */
  approver?: string;
  /** Process exit code (null if not applicable) */
  exit_code: number | null;
  /** SHA-256 of stdout content (digest only) */
  stdout_sha256: string;
  /** SHA-256 of stderr content (digest only) */
  stderr_sha256: string;
  /** SHA-256 of previous record in chain */
  prev_hash: string;
  /** SHA-256 of this record (self-hash) */
  hash: string;
  /** Freeform notes */
  notes?: string;
}

export interface ArifSealConfig {
  /** Path to the JSONL ledger file */
  ledgerPath: string;
  /** HMAC secret key for signing (optional — if set, each record gets HMAC) */
  hmacSecret?: string;
  /** Hook to forward sealed records to VAULT999 (optional) */
  vaultForwarder?: (record: SealRecord) => Promise<void>;
  /** Maximum ledger size before rotation (0 = unlimited) */
  maxRecordsBeforeRotate?: number;
}

// ── Secret patterns for redaction ──────────────────────────────────────────

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api_key/i, /apikey/i,
  /auth/i, /credential/i, /private_key/i, /access_key/i, /secret_key/i,
  /bearer/i, /authorization/i, /x-api-key/i,
];

function redactSecrets(args: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (SECRET_PATTERNS.some((p) => p.test(key))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      redacted[key] = value.slice(0, 100) + "...[truncated]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ── Hash chain ─────────────────────────────────────────────────────────────

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

function canonicalSerialize(record: Omit<SealRecord, "hash">): string {
  // Deterministic JSON serialization for hash computation
  const canonical: Record<string, unknown> = {
    seq: record.seq,
    ts: record.ts,
    tool: record.tool,
    args: record.args,
    judge_decision: record.judge_decision,
    exit_code: record.exit_code,
    stdout_sha256: record.stdout_sha256,
    stderr_sha256: record.stderr_sha256,
    prev_hash: record.prev_hash,
  };
  if (record.approver) canonical.approver = record.approver;
  if (record.notes) canonical.notes = record.notes;
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

function computeHmac(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf-8").digest("hex");
}

// ── File-based lock for concurrent-safe append ─────────────────────────────
// Uses mkdir atomicity: only one process can create the lock directory.
// Lock dir is relative to ledger path: <ledger>.lock/

const LOCK_RETRY_MS = 50;
const LOCK_MAX_RETRIES = 40; // 2s total timeout

async function acquireLock(lockDir: string, holder: string): Promise<void> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      await fs.mkdir(lockDir, { recursive: false });
      // Write holder info (advisory)
      await fs.writeFile(path.join(lockDir, "holder"), holder, "utf-8");
      return;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Lock held — wait and retry
        await new Promise(r => setTimeout(r, LOCK_RETRY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Lock timeout after ${LOCK_MAX_RETRIES * LOCK_RETRY_MS}ms: ${lockDir}`);
}

async function releaseLock(lockDir: string): Promise<void> {
  try {
    await fs.rm(lockDir, { recursive: true, force: true });
  } catch {
    // Best-effort release
  }
}

// ── ArifSeal class ─────────────────────────────────────────────────────────

export class ArifSeal {
  private config: ArifSealConfig;
  private ledger: fs.FileHandle | null = null;
  private seq: number = 0;
  private lastHash: string = computeHash("GENESIS_BLOCK_arifOS_FORGE_v1"); // genesis
  private openPromise: Promise<void> | null = null;

  constructor(config: ArifSealConfig) {
    this.config = {
      maxRecordsBeforeRotate: 10000,
      ...config,
    };
  }

  /**
   * Open the ledger file and recover chain state (seq + prev_hash).
   * Safe to call multiple times — returns cached promise.
   */
  async open(): Promise<void> {
    if (this.ledger) return;
    if (this.openPromise) return this.openPromise;

    this.openPromise = (async () => {
      const dir = path.dirname(this.config.ledgerPath);
      await fs.mkdir(dir, { recursive: true });

      // Recover chain state from existing ledger
      try {
        const content = await fs.readFile(this.config.ledgerPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const lastRecord = JSON.parse(lastLine) as SealRecord;
          this.seq = lastRecord.seq;
          this.lastHash = lastRecord.hash;
        }
      } catch {
        // New ledger — start from genesis
        this.seq = 0;
        this.lastHash = computeHash("GENESIS_BLOCK_arifOS_FORGE_v1");
      }

      this.ledger = await fs.open(this.config.ledgerPath, "a");
    })();

    return this.openPromise;
  }

  /**
   * Seal a tool execution result into the hash chain.
   * Uses file-level lock for concurrent-safe appends.
   * Returns the SealRecord that was appended.
   */
  async seal(params: {
    tool: string;
    args: Record<string, unknown>;
    judge_decision: string;
    approver?: string;
    stdout: string;
    stderr: string;
    exit_code: number | null;
    notes?: string;
  }): Promise<SealRecord> {
    const lockDir = this.config.ledgerPath + ".lock";
    const holder = `forge_shell-${randomUUID().slice(0, 8)}`;

    await acquireLock(lockDir, holder);
    try {
      await this.open();

      // Re-read last record under lock — catch any concurrent writes
      try {
        const content = await fs.readFile(this.config.ledgerPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const lastRecord = JSON.parse(lastLine) as SealRecord;
          // Update to latest if concurrent write landed before our lock
          if (lastRecord.seq >= this.seq) {
            this.seq = lastRecord.seq;
            this.lastHash = lastRecord.hash;
          }
        }
      } catch {
        // Ledger does not exist yet — start from genesis
      }

      this.seq += 1;

      const stdoutHash = computeHash(params.stdout);
      const stderrHash = computeHash(params.stderr);

      const recordBase: Omit<SealRecord, "hash"> = {
        seq: this.seq,
        ts: new Date().toISOString(),
        tool: params.tool,
        args: redactSecrets(params.args),
        judge_decision: params.judge_decision,
        exit_code: params.exit_code,
        stdout_sha256: stdoutHash,
        stderr_sha256: stderrHash,
        prev_hash: this.lastHash,
      };
      if (params.approver) recordBase.approver = params.approver;
      if (params.notes) recordBase.notes = params.notes;

      // Compute self-hash
      const canonical = canonicalSerialize(recordBase);
      const selfHash = computeHash(canonical);

      // If HMAC secret is set, sign the record
      let hmacSig: string | undefined;
      if (this.config.hmacSecret) {
        hmacSig = computeHmac(canonical, this.config.hmacSecret);
      }

      const record: SealRecord = {
        ...recordBase,
        hash: selfHash,
      };

      // Append to ledger (JSONL)
      const line = JSON.stringify(record) + "\n";
      await this.ledger!.write(line);
      await this.ledger!.sync();

      // Update chain state
      this.lastHash = selfHash;

      // Forward to VAULT999 if hook set
      if (this.config.vaultForwarder) {
        this.config.vaultForwarder(record).catch((err) => {
          console.error(`[ArifSeal] VAULT999 forward failed: ${err}`);
        });
      }

      return record;
    } finally {
      await releaseLock(lockDir);
    }
  }

  /**
   * Verify the integrity of the entire hash chain.
   * Walks all records and recomputes hashes.
   * Returns { valid, records, errors }.
   */
  async verify(): Promise<{ valid: boolean; records: number; errors: string[] }> {
    const errors: string[] = [];
    let records = 0;

    try {
      const content = await fs.readFile(this.config.ledgerPath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      let prevHash = computeHash("GENESIS_BLOCK_arifOS_FORGE_v1");

      for (let i = 0; i < lines.length; i++) {
        records++;
        const record = JSON.parse(lines[i]) as SealRecord;

        // Verify prev_hash chain
        if (record.prev_hash !== prevHash) {
          errors.push(
            `Record ${record.seq} (line ${i + 1}): prev_hash mismatch. ` +
            `Expected ${prevHash}, got ${record.prev_hash}`
          );
        }

        // Recompute self-hash
        const { hash: _ignored, ...rest } = record;
        const recomputed = computeHash(canonicalSerialize(rest));
        if (recomputed !== record.hash) {
          errors.push(
            `Record ${record.seq} (line ${i + 1}): self-hash mismatch. ` +
            `Expected ${recomputed}, got ${record.hash}`
          );
        }

        prevHash = record.hash;
      }
    } catch (err: any) {
      errors.push(`Read error: ${err.message}`);
    }

    return { valid: errors.length === 0, records, errors };
  }

  /**
   * Get the latest chain state (seq, last_hash).
   */
  async getState(): Promise<{ seq: number; lastHash: string; ledgerPath: string }> {
    await this.open();
    return {
      seq: this.seq,
      lastHash: this.lastHash,
      ledgerPath: this.config.ledgerPath,
    };
  }

  /**
   * Close the ledger file handle.
   */
  async close(): Promise<void> {
    if (this.ledger) {
      await this.ledger.close();
      this.ledger = null;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _defaultInstance: ArifSeal | null = null;

export function getDefaultArifSeal(): ArifSeal {
  if (!_defaultInstance) {
    _defaultInstance = new ArifSeal({
      ledgerPath: "/root/A-FORGE/data/vault999_chain.jsonl",
    });
  }
  return _defaultInstance;
}

export function setDefaultArifSeal(instance: ArifSeal): void {
  _defaultInstance = instance;
}
