/**
 * chain-state.ts — THE ONE canonical chain-heartbeat computer (R5).
 *
 * REPAIR R5 — ghost heartbeat closure.
 *
 * ROOT CAUSE (measured 2026-10-22): three different silence numbers for one
 * canonical chain circulated in production — 94.8h (computed from the
 * SEALED_EVENTS.jsonl head, REAL), 147.6h and 189.2h (computed by shadow
 * compilers reading a derived head file). The derived head declared
 * "head seq 72" but ZERO rows in the canonical chain carry a `seq` field —
 * the heartbeat computer keyed on a field the canonical writer never emits
 * (phantom seq). Multiple verdict/state computers = multiple truths.
 *
 * LAW (F2 TRUTH / F9 ANTI-HANTU)
 *  - The ONLY heartbeat source is the canonical chain file itself, walked
 *    line-by-line at read time. Derived head files (seal_chain_head.json and
 *    friends) are DECLARED metadata — they inform provenance, never the math.
 *  - hours_since is computed from the newest observable timestamp IN the chain.
 *  - `seq` is read only from rows that actually carry it, and its absence is
 *    reported as a measured fact, never filled with a head-file claim.
 *  - Every output field is evidence-class-tagged: OBS (measured from chain
 *    bytes) or DER (derived by arithmetic). Unmeasurable → UNMEASURED, not 0.
 *  - READ-ONLY: this module never writes to any chain.
 *
 * DITEMPA BUKAN DIBERI.
 */

import { existsSync, readFileSync, statSync } from "node:fs";

/** Canonical chain locations, in precedence order. First readable wins; the
 *  rest are reported as alternates so duplicate-chain confusion is visible. */
export const CHAIN_CANDIDATES = [
  "/root/arifOS/VAULT999/SEALED_EVENTS.jsonl", // canonical sealed events (symlink target of vault999)
  "/root/.local/share/arifos/vault999/seal_chain.jsonl", // receipt chain (same underlying file via symlink)
] as const;

export type EvidenceClass = "OBS" | "DER" | "UNMEASURED";

export interface ChainHeartbeat {
  /** THE verdict on chain liveness. Only field consumers should branch on. */
  status: "LIVE" | "SILENT" | "STALE" | "UNMEASURED";
  /** Hours since newest record in the canonical chain (OBS+DER). */
  hours_since_newest: number | null;
  evidence_class_hours: EvidenceClass;
  /** Absolute time of the newest record in the chain (ISO-8601). */
  newest_record_at: string | null;
  /** Total data rows in the chain file (OBS). */
  row_count: number;
  /** Rows carrying a real `seq` field (OBS). Phantom-seq detector: if a head
   *  file claims seq N but this is 0, the head is lying. */
  rows_with_seq: number;
  /** Highest seq actually present in chain rows (OBS), not from any head file. */
  max_seq_observed: number | null;
  /** Head-file declarations, kept for divergence reporting ONLY — never math. */
  declared: {
    path: string | null;
    seq: number | null;
    timestamp: string | null;
    divergent_from_observed: boolean;
  };
  /** Which chain file supplied the numbers. */
  source: string | null;
  /** Timestamp of this computation (DER). */
  computed_at: string;
  /** Phantom-seq / stale-head finding, when present. */
  findings: string[];
  warnings: string[];
}

interface TimestampedRow {
  ts: Date | null;
  seq: number | null;
}

function parseTimestamps(row: any): TimestampedRow {
  let ts: Date | null = null;
  for (const key of ["recorded_at", "timestamp", "epoch", "ts", "created_at"]) {
    const raw = row[key];
    if (typeof raw === "string" && raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        ts = d;
        break;
      }
    }
  }
  let seq: number | null = null;
  // Only trust an explicit, actually-present seq field on the row itself.
  if (Object.prototype.hasOwnProperty.call(row, "seq")) {
    const n = Number(row.seq);
    if (Number.isFinite(n)) seq = n;
  }
  return { ts, seq };
}

/** Read the declared head file (for divergence reporting only). */
function readDeclaredHead(): { path: string | null; seq: number | null; timestamp: string | null } {
  const headPath = "/root/.local/share/arifos/vault999/seal_chain_head.json";
  try {
    if (!existsSync(headPath)) return { path: null, seq: null, timestamp: null };
    const head = JSON.parse(readFileSync(headPath, "utf-8"));
    return {
      path: headPath,
      seq: Number.isFinite(Number(head.seq)) ? Number(head.seq) : null,
      timestamp: typeof head.timestamp === "string" ? head.timestamp : null,
    };
  } catch {
    return { path: null, seq: null, timestamp: null };
  }
}

export interface ChainHeartbeatOptions {
  /** SILENCE threshold in hours — beyond this the chain is STALE (default 72). */
  stale_threshold_h?: number;
  /** Beyond this the chain is SILENT — the kernel witness oracle is not breathing. */
  silent_threshold_h?: number;
  /** Inject "now" for deterministic tests. */
  now?: Date;
}

/**
 * THE heartbeat computer. Walks the canonical chain file itself.
 * Never reads a derived head file for the math — head data is reported
 * side-by-side only so declared-vs-observed divergence is visible.
 */
export function computeChainHeartbeat(opts: ChainHeartbeatOptions = {}): ChainHeartbeat {
  const staleH = opts.stale_threshold_h ?? 72;
  const silentH = opts.silent_threshold_h ?? 168; // 1 week
  const now = opts.now ?? new Date();
  const findings: string[] = [];
  const warnings: string[] = [];

  let source: string | null = null;
  let rowCount = 0;
  let rowsWithSeq = 0;
  let maxSeq: number | null = null;
  let newest: Date | null = null;
  let parseErrors = 0;

  for (const candidate of CHAIN_CANDIDATES) {
    try {
      if (!existsSync(candidate)) continue;
      const st = statSync(candidate);
      if (!st.isFile() || st.size === 0) continue;

      const text = readFileSync(candidate, "utf-8");
      const lines = text.split("\n");
      let candRows = 0;
      let candWithSeq = 0;
      let candMaxSeq: number | null = null;
      let candNewest: Date | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row: any;
        try {
          row = JSON.parse(trimmed);
        } catch {
          parseErrors++;
          continue;
        }
        if (!row || typeof row !== "object") continue;
        candRows++;
        const { ts, seq } = parseTimestamps(row);
        if (seq !== null) {
          candWithSeq++;
          if (candMaxSeq === null || seq > candMaxSeq) candMaxSeq = seq;
        }
        if (ts && (!candNewest || ts > candNewest)) candNewest = ts;
      }

      // Prefer the candidate with the most rows carrying real timestamps —
      // the freshest observable data wins, ties go to the first candidate.
      if (candRows > 0 && (source === null || candNewest)) {
        const candIsBetter =
          source === null ||
          (candNewest !== null && (newest === null || candNewest > newest)) ||
          (candNewest === null && newest === null && candRows > rowCount);
        if (candIsBetter) {
          source = candidate;
          rowCount = candRows;
          rowsWithSeq = candWithSeq;
          maxSeq = candMaxSeq;
          newest = candNewest;
        }
      }
      if (source === candidate && rowCount === candRows) {
        // First readable candidate with data wins outright.
        break;
      }
    } catch {
      continue;
    }
  }

  const declared = readDeclaredHead();

  // ── Phantom-seq check: head declares seq but no row carries one. ──
  if (declared.seq !== null && rowsWithSeq === 0) {
    findings.push(
      `PHANTOM_SEQ: declared head claims seq=${declared.seq} but 0 of ${rowCount} canonical rows carry a 'seq' field — head file is derived metadata, not chain truth`,
    );
  }
  if (declared.seq !== null && maxSeq !== null && declared.seq > maxSeq) {
    findings.push(
      `SEQ_DRIFT: declared head seq=${declared.seq} exceeds max seq observed in chain (${maxSeq})`,
    );
  }
  if (parseErrors > 0) {
    warnings.push(`${parseErrors} unparseable line(s) skipped in chain file`);
  }

  // ── The heartbeat number: computed from chain bytes only. ──
  let hoursSince: number | null = null;
  let evidenceClass: EvidenceClass = "UNMEASURED";
  if (newest) {
    hoursSince = Math.round(((now.getTime() - newest.getTime()) / 3_600_000) * 10) / 10;
    evidenceClass = "OBS"; // timestamp measured from chain; the subtraction is DER arithmetic
  }

  // ── Declared-vs-observed divergence (the ghost heartbeat finding). ──
  let divergent = false;
  if (declared.timestamp && newest) {
    const declaredDt = new Date(declared.timestamp);
    if (!Number.isNaN(declaredDt.getTime())) {
      const declaredHours =
        Math.round(((now.getTime() - declaredDt.getTime()) / 3_600_000) * 10) / 10;
      if (Math.abs(declaredHours - hoursSince!) > 1.0) {
        divergent = true;
        findings.push(
          `HEAD_DIVERGENCE: declared head timestamp gives ${declaredHours}h silence but canonical chain newest record gives ${hoursSince}h — chain bytes win (F2 TRUTH)`,
        );
      }
    }
  }
  if (declared.path && !divergent && hoursSince !== null) {
    // Head file agrees (or was unreadable) — nothing to add.
  }

  let status: ChainHeartbeat["status"];
  if (hoursSince === null) {
    status = "UNMEASURED";
    warnings.push("chain file empty or unreadable — silence is UNMEASURED, not 0 (F9)");
  } else if (hoursSince >= silentH) {
    status = "SILENT";
  } else if (hoursSince >= staleH) {
    status = "STALE";
  } else {
    status = "LIVE";
  }

  return {
    status,
    hours_since_newest: hoursSince,
    evidence_class_hours: evidenceClass,
    newest_record_at: newest ? newest.toISOString() : null,
    row_count: rowCount,
    rows_with_seq: rowsWithSeq,
    max_seq_observed: maxSeq,
    declared: {
      path: declared.path,
      seq: declared.seq,
      timestamp: declared.timestamp,
      divergent_from_observed: divergent,
    },
    source,
    computed_at: now.toISOString(),
    findings,
    warnings,
  };
}
