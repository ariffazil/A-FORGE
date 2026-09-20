/**
 * P1-7 — arifFLOW fallback SWEEPER (G-13 closure).
 *
 * DEFECT BEING CLOSED (G-13, recorded /root/AAA/reality-graph/FLOW_GAPS.md):
 * flowEmit.ts wrote a fallback line whenever arifFLOW :7073 was unreachable,
 * and the comment promised "a sweeper (future P1-7) can replay the fallback
 * when the plane returns". The sweeper did not exist. So the doctrine
 * "no silent drop" held only locally: receipts that landed in
 * ~/.agent-workbench/aforge-flow-fallback.jsonl were never replayed to the
 * canonical plane, and the witness chain had a permanent gap.
 *
 * DOCTRINE OBEYED
 *   - no delete   : replayed lines are APPENDED to a .replayed ledger, the
 *                   original file is atomically replaced by the un-replayed
 *                   remainder only after every line is accounted for.
 *   - no silent drop: a line that fails to replay stays in the fallback and is
 *                   counted as pending. Nothing is discarded on failure.
 *   - receipt authority is arifFLOW : a line is only "replayed" when /ingest
 *                   answers. Attempting is not replaying.
 *
 * IDEMPOTENCE
 *   Keyed on the original line's sha256. A line already present in the
 *   .replayed ledger is skipped, so re-running is safe.
 *
 * Usage:
 *   node dist/infrastructure/receipts/flowFallbackSweeper.js [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, appendFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emitReceipt, type EmitReceiptParams } from "./arifflowClient.js";

const FALLBACK_PATH =
  process.env.AF_FLOW_FALLBACK_PATH ??
  resolve(process.env.HOME ?? "/root", ".agent-workbench", "aforge-flow-fallback.jsonl");

const REPLAYED_PATH = `${FALLBACK_PATH}.replayed`;

export interface SweepReport {
  fallback_path: string;
  replayed_path: string;
  total_lines: number;
  parsed: number;
  unparsable: number;
  already_replayed: number;
  attempted: number;
  replayed: number;
  failed: number;
  remaining: number;
  dry_run: boolean;
  errors: string[];
}

const lineHash = (s: string) => createHash("sha256").update(s).digest("hex");

async function readLines(p: string): Promise<string[]> {
  if (!existsSync(p)) return [];
  const text = await readFile(p, "utf-8");
  return text.split("\n").filter((l) => l.trim().length > 0);
}

/**
 * Replay every un-replayed fallback line to arifFLOW /ingest.
 *
 * Returns a SweepReport. Never throws on a per-line failure: a failed line
 * stays pending and is reported, because discarding it would be the same
 * silent drop the fallback exists to prevent.
 */
export async function sweepFallback(dryRun = false): Promise<SweepReport> {
  const report: SweepReport = {
    fallback_path: FALLBACK_PATH,
    replayed_path: REPLAYED_PATH,
    total_lines: 0,
    parsed: 0,
    unparsable: 0,
    already_replayed: 0,
    attempted: 0,
    replayed: 0,
    failed: 0,
    remaining: 0,
    dry_run: dryRun,
    errors: [],
  };

  const lines = await readLines(FALLBACK_PATH);
  report.total_lines = lines.length;
  if (lines.length === 0) return report;

  const done = new Set((await readLines(REPLAYED_PATH)).map(lineHash));
  const pending: string[] = [];
  const newlyReplayed: string[] = [];

  for (const line of lines) {
    const h = lineHash(line);
    if (done.has(h)) {
      report.already_replayed++;
      continue;
    }
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
      report.parsed++;
    } catch {
      // Keep unparsable lines in place: they are evidence too.
      report.unparsable++;
      pending.push(line);
      continue;
    }

    if (entry.kind !== "flow_receipt_fallback" || !entry.params) {
      // Not ours to replay. Preserve it untouched and report it.
      pending.push(line);
      continue;
    }

    if (dryRun) {
      report.attempted++;
      pending.push(line);
      continue;
    }

    report.attempted++;
    try {
      const params = entry.params as EmitReceiptParams;
      await emitReceipt({ organ: "A-FORGE", ...params });
      report.replayed++;
      newlyReplayed.push(line);
    } catch (err) {
      // FAILED → stays pending. Not dropped.
      report.failed++;
      report.errors.push(`${h.slice(0, 12)}: ${err instanceof Error ? err.message : String(err)}`);
      pending.push(line);
    }
  }

  report.remaining = pending.length;

  if (dryRun) return report;

  // Commit: append the successes to the replayed ledger FIRST (so a crash
  // between the two writes can only duplicate, never lose), then rewrite the
  // fallback with the remainder.
  await mkdir(dirname(FALLBACK_PATH), { recursive: true });
  if (newlyReplayed.length > 0) {
    await appendFile(REPLAYED_PATH, newlyReplayed.join("\n") + "\n", "utf-8");
    const tmp = `${FALLBACK_PATH}.sweep-tmp`;
    await writeFile(tmp, pending.length > 0 ? pending.join("\n") + "\n" : "", "utf-8");
    await rename(tmp, FALLBACK_PATH);
  }

  return report;
}

const isMain = process.argv[1]?.endsWith("flowFallbackSweeper.js") ||
  process.argv[1]?.endsWith("flowFallbackSweeper.ts");

if (isMain) {
  const dry = process.argv.includes("--dry-run");
  sweepFallback(dry)
    .then((r) => {
      process.stdout.write(JSON.stringify(r, null, 2) + "\n");
      // Non-zero when work remains, so a caller can alert rather than assume.
      process.exit(r.failed > 0 || r.remaining > 0 ? 2 : 0);
    })
    .catch((e) => {
      process.stderr.write(String(e) + "\n");
      process.exit(1);
    });
}
