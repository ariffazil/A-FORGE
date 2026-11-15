/**
 * x-geox-slice.ts — CLI harness executing an end-to-end witnessed GEOX selection cycle.
 *
 * Usage:
 *   node dist/src/domain/counterfactual/x-geox-slice.js <slice-dir> [--witness]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  verifyDiskEvidence,
  runWitnessedSelectionCycle,
  type WitnessOutcome,
} from "./witnessedLoop.js";
import type { CandidateInput } from "./admissibility.js";

const [sliceDir, flag] = process.argv.slice(2);
if (!sliceDir) {
  console.error("usage: x-geox-slice.js <slice-dir> [--witness]");
  process.exit(2);
}

const candidates: CandidateInput[] = JSON.parse(
  readFileSync(join(sliceDir, "candidates-round1.json"), "utf8"),
);
const prior: string[] = JSON.parse(
  readFileSync(join(sliceDir, "prior-round1.json"), "utf8"),
);
const refPaths: Record<string, string> = JSON.parse(
  readFileSync(join(sliceDir, "evidence-paths.json"), "utf8"),
);
const witnessFile: WitnessOutcome = JSON.parse(
  readFileSync(join(sliceDir, "witness-observation.json"), "utf8"),
);

const verification = verifyDiskEvidence(refPaths);
const report = runWitnessedSelectionCycle({
  round1Candidates: candidates,
  priorRanking: prior,
  evidenceVerification: verification,
  witness: witnessFile,
});

if (flag === "--witness") {
  console.log(report.deterministic_cycle_hash);
  process.exit(0);
}

const outPath = join(
  sliceDir,
  `geox-cycle-receipt-${report.generated_at.replace(/[:.]/g, "-")}.json`,
);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    receipt: outPath,
    verified_refs: Object.keys(verification.provenance).length,
    failed_refs: verification.failures,
    round1_selected: report.prior_selected,
    round2_selected: report.posterior_selected,
    selection_flipped: report.selection_flipped,
    changed_future_behavior: report.changed_future_behavior,
    converged_on_replay: report.converged_on_replay,
    prior_ranking: report.round1.receipt.posterior_ranking,
    posterior_ranking: report.round2.receipt.posterior_ranking,
    cycle_hash: report.deterministic_cycle_hash,
  }),
);
