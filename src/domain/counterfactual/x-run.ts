/**
 * x-run.ts — CLI harness for the predicate choke point (2026-11-15).
 * Usage:
 *   node dist/src/domain/counterfactual/x-run.js <candidates.json> <evidence.json> <prior.json|-> <outdir> [--witness]
 * Emits EvaluationReceipt to <outdir>/receipt-<utc>.json and prints a summary line.
 * --witness : recompute + print deterministic_core_hash only (independent re-run).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateCandidate,
  selectAdmissibleCandidates,
  emitReceipt,
  type CandidateInput,
  type EvidenceRegistry,
} from "./admissibility.js";

const [candsPath, evPath, priorPath, outDir, flag] = process.argv.slice(2);
if (!candsPath || !evPath || !priorPath || !outDir) {
  console.error("usage: x-run.js <candidates.json> <evidence.json> <prior.json|-> <outdir> [--witness]");
  process.exit(2);
}
const candidates: CandidateInput[] = JSON.parse(readFileSync(candsPath, "utf8"));
const evidence: EvidenceRegistry = JSON.parse(readFileSync(evPath, "utf8"));
const prior: string[] = priorPath === "-" ? [] : JSON.parse(readFileSync(priorPath, "utf8"));

const evaluations = candidates.map((c) => evaluateCandidate(c, evidence));
const selection = selectAdmissibleCandidates(evaluations, prior);
const receipt = emitReceipt(evaluations, selection, prior);

if (flag === "--witness") {
  // Witness mode: emit only the deterministic core hash (two independent runs must agree).
  console.log(receipt.deterministic_core_hash);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const out = join(outDir, `receipt-${receipt.emitted_at.replace(/[:.]/g, "-")}.json`);
writeFileSync(out, JSON.stringify(receipt, null, 2));
console.log(
  JSON.stringify({
    receipt: out,
    evaluated: receipt.evaluated_count,
    admissible: receipt.admissible_count,
    status: receipt.selection.status,
    selected: receipt.selection.selected,
    changed_future_behavior: receipt.changed_future_behavior,
    core_hash: receipt.deterministic_core_hash,
  }),
);
