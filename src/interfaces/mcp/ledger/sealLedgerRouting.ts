/**
 * sealLedgerRouting — fail-closed ledger routing + ledger self-health (Workstream A).
 *
 * 2026-10-31 · 333-AGI · ARIFOS::AGENT_TO_AGENT_REALITY_COMPLETION::v1
 *
 * The defect this closes
 * ----------------------
 * `resolveSealLedgerPath()` in `shell/arifSeal.ts` (FS-immutable, sealed core)
 * falls back to `/root/A-FORGE/data/vault999_chain.jsonl` when
 * AFORGE_SEAL_LEDGER is unset. That path is chattr +i (frozen by design since
 * 2026-09-14, closed at seq 73 on 2026-10-29). So every environment-less launch
 * (stdio / CLI / direct spawn / recovery mode) resolved to a segment it could
 * never append to — a ledger that keeps the appearance of audit while evidence
 * stops.
 *
 * This module is the governed replacement surface. It lives OUTSIDE the sealed
 * core because the seal is F1-protected (chattr is blocked by the review gate)
 * and because a repair must not erase the evidence that repair was needed.
 *
 * Contract
 * --------
 *  - env override wins (explicit);
 *  - else the active segment, when it exists (explicit, labelled `active-default`);
 *  - else FAIL CLOSED with a precise error. Never the frozen archive.
 *
 * F1 AMANAH · F2 TRUTH · F11 AUDIT — the ledger states its own derivation.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

/** Frozen archive segment — readable, never a write target (chattr +i by design). */
export const FROZEN_ARCHIVE_SEGMENT_PATH = "/root/A-FORGE/data/vault999_chain.jsonl";

/** Active governed segment opened by the 2026-10-29 rotation. */
export const ACTIVE_SEGMENT_PATH = "/root/A-FORGE/data-active/vault999_chain.jsonl";

export const SEAL_GENESIS_SEED = "GENESIS_BLOCK_arifOS_FORGE_v1";

export type SealLedgerSource = "env" | "active-default" | "fail-closed";

const STALE_PROBE_TTL_MS = 30_000;

export class SealLedgerConfigError extends Error {
  readonly code = "SEAL_LEDGER_NO_ACTIVE_SEGMENT";
  constructor(detail?: string) {
    super(
      "SEAL_LEDGER_NO_ACTIVE_SEGMENT: AFORGE_SEAL_LEDGER is unset and no active segment " +
        `exists at ${ACTIVE_SEGMENT_PATH}. Refusing to fall back to the frozen archive ` +
        `(${FROZEN_ARCHIVE_SEGMENT_PATH}). Configure AFORGE_SEAL_LEDGER or rotate a new ` +
        `segment with a ROTATION sidecar.${detail ? " " + detail : ""}`,
    );
    this.name = "SealLedgerConfigError";
  }
}

/** Where the write target comes from, without resolving (never throws). */
export function sealLedgerResolutionSource(activeSegment: string = ACTIVE_SEGMENT_PATH): SealLedgerSource {
  if (process.env.AFORGE_SEAL_LEDGER?.trim()) return "env";
  return fs.existsSync(activeSegment) ? "active-default" : "fail-closed";
}

/** Resolve the write target: env → active segment → fail closed. */
export function resolveSealLedgerPath(opts: { activeSegment?: string } = {}): string {
  const override = process.env.AFORGE_SEAL_LEDGER?.trim();
  if (override) return override;
  const active = opts.activeSegment ?? ACTIVE_SEGMENT_PATH;
  if (fs.existsSync(active)) return active;
  throw new SealLedgerConfigError();
}

/**
 * Bind the routing decision into the process environment at boot, so every
 * downstream consumer of the sealed `shell/arifSeal.ts` resolver (which reads
 * AFORGE_SEAL_LEDGER) lands on the same segment. Called from every mutable
 * launch path. Throws SealLedgerConfigError when neither source exists.
 */
export function ensureSealLedgerRouting(): {
  path: string;
  source: SealLedgerSource;
  bound_env: boolean;
} {
  const source = sealLedgerResolutionSource();
  if (source === "fail-closed") throw new SealLedgerConfigError();
  const resolved = resolveSealLedgerPath();
  const bound_env = source === "active-default";
  if (bound_env) process.env.AFORGE_SEAL_LEDGER = resolved;
  return { path: resolved, source, bound_env };
}

// ── Mirror of the frozen canonical serializer ─────────────────────────────
// Mirrored from shell/arifSeal.ts (FS-immutable). If that formula drifts, the
// pinned fixture test fails loudly rather than silently blessing a bad chain.

export function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export function canonicalSerialize(record: Record<string, unknown>): string {
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
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(canonical).sort()) sorted[k] = canonical[k];
  return JSON.stringify(sorted);
}

export interface SealChainSummary {
  exists: boolean;
  records: number;
  malformed: number;
  last_sequence: number | null;
  last_hash: string | null;
  last_append_at: string | null;
  first_prev_hash: string | null;
  error: string | null;
}

/** Read a segment's tail state without mutating it. */
export async function readSealChainSummary(ledgerPath: string): Promise<SealChainSummary> {
  const empty: SealChainSummary = {
    exists: false,
    records: 0,
    malformed: 0,
    last_sequence: null,
    last_hash: null,
    last_append_at: null,
    first_prev_hash: null,
    error: null,
  };
  let content: string;
  try {
    content = await fsp.readFile(ledgerPath, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return empty;
    return { ...empty, error: err?.code ?? err?.message ?? String(err) };
  }
  const lines = content.split("\n").filter((l) => l.trim());
  let malformed = 0;
  let last: any = null;
  let firstPrev: string | null = null;
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      if (firstPrev === null && typeof rec?.prev_hash === "string") firstPrev = rec.prev_hash;
      last = rec;
    } catch {
      malformed++;
    }
  }
  return {
    exists: true,
    records: lines.length,
    malformed,
    last_sequence: typeof last?.seq === "number" ? last.seq : null,
    last_hash: typeof last?.hash === "string" ? last.hash : null,
    last_append_at: typeof last?.ts === "string" ? last.ts : null,
    first_prev_hash: firstPrev,
    error: null,
  };
}

/**
 * Verify a segment from an external anchor. The active segment is a fresh
 * genesis whose first prev_hash is the CLOSED segment's tail hash, so verifying
 * against the genesis seed alone always reports invalid — the anchor comes from
 * the rotation sidecar.
 */
export async function verifySealChainFrom(
  ledgerPath: string,
  anchorPrevHash: string = sha256Hex(SEAL_GENESIS_SEED),
): Promise<{ verified: boolean | null; records: number | null; errors: string[] }> {
  let content: string;
  try {
    content = await fsp.readFile(ledgerPath, "utf-8");
  } catch (err: any) {
    return { verified: null, records: null, errors: [`unreadable: ${err?.code ?? err?.message ?? String(err)}`] };
  }
  const lines = content.split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  let prevHash = anchorPrevHash;
  for (let i = 0; i < lines.length; i++) {
    let record: any;
    try {
      record = JSON.parse(lines[i] as string);
    } catch {
      errors.push(`line ${i + 1}: malformed JSON`);
      continue;
    }
    if (record.prev_hash !== prevHash) errors.push(`record ${record.seq} (line ${i + 1}): prev_hash mismatch`);
    const { hash: _ignored, ...rest } = record;
    if (sha256Hex(canonicalSerialize(rest)) !== record.hash) {
      errors.push(`record ${record.seq} (line ${i + 1}): self-hash mismatch`);
    }
    prevHash = record.hash;
  }
  return { verified: errors.length === 0, records: lines.length, errors };
}

interface RotationSidecar {
  previous_segment?: string;
  previous_seq?: number;
  previous_tail_hash?: string;
  new_segment?: string;
  rotated_utc?: string;
}

/** Find the rotation sidecar that opened this segment, if any (newest wins). */
export function findRotationSidecar(ledgerPath: string): { path: string; sidecar: RotationSidecar } | null {
  const dir = path.dirname(ledgerPath);
  const base = path.basename(ledgerPath);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const candidates = entries.filter((f) => /^ROTATION-.*\.json$/.test(f)).sort().reverse();
  for (const f of candidates) {
    const full = path.join(dir, f);
    try {
      const sidecar = JSON.parse(fs.readFileSync(full, "utf-8")) as RotationSidecar;
      if (path.basename(sidecar.new_segment ?? "") === base) return { path: full, sidecar };
    } catch {
      // unreadable sidecar — keep looking
    }
  }
  return null;
}

let _writerFdCache: { path: string; at: number; open: boolean | null } | null = null;

/**
 * Is a live process holding the ledger open? Distinguishes "no appends because
 * nothing happened" from "no appends because the writer is gone".
 */
export function ledgerWriterFdOpen(ledgerPath: string, ttlMs = STALE_PROBE_TTL_MS): boolean | null {
  const now = Date.now();
  if (_writerFdCache && _writerFdCache.path === ledgerPath && now - _writerFdCache.at < ttlMs) {
    return _writerFdCache.open;
  }
  let open: boolean | null = null;
  try {
    const target = fs.realpathSync(ledgerPath);
    let found = false;
    for (const pid of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(pid)) continue;
      let fds: string[];
      try {
        fds = fs.readdirSync(`/proc/${pid}/fd`);
      } catch {
        continue;
      }
      for (const fd of fds) {
        try {
          if (fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === target) {
            found = true;
            break;
          }
        } catch {
          // fd closed between readdir and readlink
        }
      }
      if (found) break;
    }
    open = found;
  } catch {
    open = null;
  }
  _writerFdCache = { path: ledgerPath, at: now, open };
  return open;
}

export interface SealLedgerHealth {
  observed_at: string;
  configured_path: string | null;
  resolved_path: string | null;
  resolution_source: SealLedgerSource;
  segment_id: string | null;
  writable: boolean | null;
  error: string | null;
  error_class: string | null;
  records: number | null;
  malformed: number | null;
  last_sequence: number | null;
  last_append_at: string | null;
  stale_seconds: number | null;
  continuity: {
    status: "held-by-hash-link" | "metadata-only" | "mismatch" | "no-predecessor" | "unverifiable";
    anchor_prev_hash: string | null;
    source: string | null;
    previous_segment: string | null;
    previous_seq: number | null;
  };
  chain: { verified: boolean | null; errors: string[] };
  writer_fd_open: boolean | null;
}

/**
 * Truthful self-report. A green `writable:true` means "appendable", never
 * "being written" (see writer_fd_open) and never "chain intact" (see chain).
 */
export async function sealLedgerHealth(opts: { activeSegment?: string } = {}): Promise<SealLedgerHealth> {
  const observed_at = new Date().toISOString();
  const configured_path = process.env.AFORGE_SEAL_LEDGER?.trim() || null;
  const resolution_source = sealLedgerResolutionSource(opts.activeSegment);

  const base: SealLedgerHealth = {
    observed_at,
    configured_path,
    resolved_path: null,
    resolution_source,
    segment_id: null,
    writable: null,
    error: null,
    error_class: null,
    records: null,
    malformed: null,
    last_sequence: null,
    last_append_at: null,
    stale_seconds: null,
    continuity: {
      status: "unverifiable",
      anchor_prev_hash: null,
      source: null,
      previous_segment: null,
      previous_seq: null,
    },
    chain: { verified: null, errors: [] },
    writer_fd_open: null,
  };

  let ledgerPath: string;
  try {
    ledgerPath = resolveSealLedgerPath(opts);
  } catch (err: any) {
    return {
      ...base,
      writable: false,
      error: err?.message ?? String(err),
      error_class: err?.code ?? "SEAL_LEDGER_CONFIG",
    };
  }

  const summary = await readSealChainSummary(ledgerPath);
  const rotation = findRotationSidecar(ledgerPath);
  const genesisHash = sha256Hex(SEAL_GENESIS_SEED);
  const claimed = rotation?.sidecar.previous_tail_hash ?? null;

  // 2026-10-31 self-correction: a rotated segment may be a FRESH GENESIS whose
  // sidecar carries continuity as metadata only. Verifying it against the
  // sidecar's claimed tail hash then reports a false "invalid chain". Anchor the
  // chain at the hash the first record actually points to; judge the sidecar
  // claim separately.
  const chainAnchoredByHashLink = claimed !== null && summary.first_prev_hash === claimed;
  const chain = await verifySealChainFrom(ledgerPath, chainAnchoredByHashLink ? (claimed as string) : genesisHash);

  let continuity = base.continuity;
  if (claimed) {
    const status: SealLedgerHealth["continuity"]["status"] = chainAnchoredByHashLink
      ? "held-by-hash-link"
      : summary.first_prev_hash === genesisHash
        ? "metadata-only"
        : "mismatch";
    continuity = {
      status,
      anchor_prev_hash: claimed,
      source: rotation?.path ?? null,
      previous_segment: rotation?.sidecar.previous_segment ?? null,
      previous_seq: rotation?.sidecar.previous_seq ?? null,
    };
  } else if (summary.first_prev_hash === genesisHash) {
    continuity = { ...continuity, status: "no-predecessor" };
  }

  let writable: boolean | null = null;
  let error: string | null = summary.error;
  let error_class: string | null = summary.error ? "SEAL_LEDGER_READ" : null;
  if (!summary.error) {
    try {
      await fsp.appendFile(ledgerPath, "");
      writable = true;
    } catch (err: any) {
      writable = false;
      error = err?.code ?? err?.message ?? String(err);
      error_class = err?.code === "EPERM" ? "SEAL_LEDGER_FROZEN" : "SEAL_LEDGER_UNWRITABLE";
    }
  }

  const stale_seconds =
    summary.last_append_at && !Number.isNaN(Date.parse(summary.last_append_at))
      ? Math.max(0, Math.round((Date.parse(observed_at) - Date.parse(summary.last_append_at)) / 1000))
      : null;

  return {
    ...base,
    resolved_path: ledgerPath,
    segment_id: path.basename(ledgerPath),
    writable,
    error,
    error_class,
    records: summary.records,
    malformed: summary.malformed,
    last_sequence: summary.last_sequence,
    last_append_at: summary.last_append_at,
    stale_seconds,
    continuity,
    chain: { verified: chain.verified, errors: chain.errors },
    writer_fd_open: ledgerWriterFdOpen(ledgerPath),
  };
}
