/**
 * World Model Trajectory Logger — Mini VAULT999 for WM
 *
 * ⚠️ DEPRECATED (2026-07-21): This file is superseded by the richer
 * governance-layer implementation at src/domain/governance/worldModelLogger.ts.
 * Still imported by ShellTools.ts — migrate ShellTools to governance imports
 * when Phase 2 infra refactor is approved.
 *
 * Append-only, hash-chained JSONL log of action→observation pairs.
 * Each record links to the previous one via sha256 hash chain.
 * This is the raw material for future ECHO/PaW training.
 *
 * Path: /root/.local/share/arifos/world-model/trajectories.jsonl
 *
 * F11 AUDIT: Every trajectory logged; every prediction traced.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { WorldModelObservation } from "./WorldModelTypes.js";

const WM_DIR = "/root/.local/share/arifos/world-model";
const TRAJECTORIES_FILE = join(WM_DIR, "trajectories.jsonl");
const HEAD_FILE = join(WM_DIR, "chain_head.json");
const META_FILE = join(WM_DIR, "metadata.json");

interface ChainHead {
  last_hash: string;
  total_records: number;
  last_timestamp: string;
  updated_at: string;
}

interface WMMetadata {
  created_at: string;
  records_by_priority: Record<string, number>;
  records_eligible: number;
}

// ── Initialization ────────────────────────────

async function ensureDir(): Promise<void> {
  if (!existsSync(WM_DIR)) {
    await mkdir(WM_DIR, { recursive: true });
  }
}

async function readChainHead(): Promise<ChainHead> {
  try {
    const raw = await readFile(HEAD_FILE, "utf-8");
    return JSON.parse(raw) as ChainHead;
  } catch {
    return {
      last_hash: "0".repeat(64),
      total_records: 0,
      last_timestamp: "",
      updated_at: new Date().toISOString(),
    };
  }
}

async function writeChainHead(head: ChainHead): Promise<void> {
  await ensureDir();
  // Atomic-ish: write to .tmp then rename
  const tmpFile = HEAD_FILE + ".tmp";
  const { writeFile, rename } = await import("node:fs/promises");
  await writeFile(tmpFile, JSON.stringify(head, null, 2) + "\n", "utf-8");
  await rename(tmpFile, HEAD_FILE);
}

async function readMetadata(): Promise<WMMetadata> {
  try {
    const raw = await readFile(META_FILE, "utf-8");
    return JSON.parse(raw) as WMMetadata;
  } catch {
    return {
      created_at: new Date().toISOString(),
      records_by_priority: { P0: 0, P1: 0, P2: 0 },
      records_eligible: 0,
    };
  }
}

async function writeMetadata(meta: WMMetadata): Promise<void> {
  await ensureDir();
  const tmpFile = META_FILE + ".tmp";
  const { writeFile, rename } = await import("node:fs/promises");
  await writeFile(tmpFile, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  await rename(tmpFile, META_FILE);
}

// ── Record Hash ───────────────────────────────

function hashRecord(record: Omit<WorldModelObservation, "record_hash">): string {
  const payload = JSON.stringify({
    timestamp: record.timestamp,
    session_id: record.session_id,
    tool_name: record.tool_name,
    args: record.args,
    wm: record.wm,
    observation: record.observation,
    ok: record.ok,
    duration_ms: record.duration_ms,
    prev_hash: record.prev_hash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ── Append ────────────────────────────────────

export async function appendTrajectory(
  observation: Omit<WorldModelObservation, "prev_hash" | "record_hash">,
): Promise<WorldModelObservation> {
  await ensureDir();

  const head = await readChainHead();

  // Build full record with hash chain
  const fullRecord: WorldModelObservation = {
    ...observation,
    prev_hash: head.last_hash,
    record_hash: "",
  };
  fullRecord.record_hash = hashRecord(fullRecord);

  // Append to JSONL
  await appendFile(TRAJECTORIES_FILE, JSON.stringify(fullRecord) + "\n", "utf-8");

  // Update chain head
  head.last_hash = fullRecord.record_hash;
  head.total_records += 1;
  head.last_timestamp = fullRecord.timestamp;
  head.updated_at = new Date().toISOString();
  await writeChainHead(head);

  // Update metadata
  const meta = await readMetadata();
  const prioKey = `P${observation.wm.tool_priority}`;
  meta.records_by_priority[prioKey] = (meta.records_by_priority[prioKey] ?? 0) + 1;
  if (observation.wm.wm_eligible) {
    meta.records_eligible += 1;
  }
  await writeMetadata(meta);

  return fullRecord;
}

// ── Query ─────────────────────────────────────

export async function getChainHead(): Promise<ChainHead> {
  await ensureDir();
  return readChainHead();
}

export async function getMetadata(): Promise<WMMetadata> {
  await ensureDir();
  return readMetadata();
}

export async function getTrajectoryCount(): Promise<number> {
  const head = await readChainHead();
  return head.total_records;
}
