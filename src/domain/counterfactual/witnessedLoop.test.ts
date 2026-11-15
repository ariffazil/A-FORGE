/**
 * witnessedLoop.test.ts — negative, positive, tamper, and behavioral-flip tests
 * for verified disk evidence + witnessed GEOX consequence selection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  verifyDiskEvidence,
  preCollapseGuard,
  runWitnessedSelectionCycle,
  type WitnessOutcome,
} from "./witnessedLoop.js";
import type { CandidateInput } from "./admissibility.js";

function sha256Text(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function makeFixtureDir() {
  const dir = mkdtempSync(join(tmpdir(), "aforge-witness-loop-"));
  const p1 = join(dir, "ev1.json");
  const p2 = join(dir, "ev2.json");
  const pw = join(dir, "witness.json");
  writeFileSync(p1, JSON.stringify({ claim: "bathy", min_m: -2924.5 }));
  writeFileSync(p2, JSON.stringify({ claim: "oct", rho: 2600 }));
  const witnessBody = JSON.stringify({ id: "w-1", refutes: "H-1" });
  writeFileSync(pw, witnessBody);
  return {
    dir,
    paths: { "ev.1": p1, "ev.2": p2, "ev.witness": pw },
    witnessSha: sha256Text(witnessBody),
  };
}

const CAND_1: CandidateInput = {
  id: "H-1",
  claims: ["Mature oceanic crust model predicting >=3900m bathymetry"],
  evidence_refs: ["ev.1"],
  contradictions: [],
  falsifier: "Observed trough depth < 3500m refutes mature oceanic floor",
  unknowns: ["bouguer_gravity"],
};

const CAND_2: CandidateInput = {
  id: "H-2",
  claims: ["Hyperextended OCT thin crust model consistent with ~2925m floor"],
  evidence_refs: ["ev.2"],
  contradictions: [],
  falsifier: "Observed trough depth > 3900m refutes thin buoyant OCT crust",
  unknowns: ["seismic_moho_twt"],
};

test("negative: missing disk file or sha256 mismatch fails evidence_bound closed", () => {
  const fx = makeFixtureDir();
  try {
    const vMissing = verifyDiskEvidence({ ...fx.paths, "ev.missing": join(fx.dir, "nope.json") });
    assert.ok(vMissing.failures["ev.missing"]);
    assert.equal(vMissing.registry["ev.missing"], undefined);

    const vTampered = verifyDiskEvidence(fx.paths, { "ev.1": "0".repeat(64) });
    assert.match(vTampered.failures["ev.1"], /sha256_mismatch/);
    assert.equal(vTampered.registry["ev.1"], undefined);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("negative: forged/unverified witness hash throws WITNESS_UNVERIFIED without mutating inputs", () => {
  const fx = makeFixtureDir();
  try {
    const verification = verifyDiskEvidence(fx.paths);
    const badWitness: WitnessOutcome = {
      witnessId: "w-bad",
      witnessArtifactRef: "ev.witness",
      witnessSha256: "f".repeat(64),
      observedAt: "2026-11-15T00:00:00.000Z",
      refutations: [
        { candidateId: "H-1", contradiction: "depth < 3500m", evidenceRef: "ev.witness" },
      ],
    };
    assert.throws(
      () =>
        runWitnessedSelectionCycle({
          round1Candidates: [CAND_1, CAND_2],
          priorRanking: ["H-1", "H-2"],
          evidenceVerification: verification,
          witness: badWitness,
        }),
      /WITNESS_UNVERIFIED/,
    );
    assert.deepEqual(CAND_1.contradictions, []);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("behavioral update: Round 1 selects H-1 -> witness refutes H-1 -> Round 2 flips to H-2 -> Round 3 converges", () => {
  const fx = makeFixtureDir();
  try {
    const verification = verifyDiskEvidence(fx.paths);
    const witness: WitnessOutcome = {
      witnessId: "w-gebco-trough",
      witnessArtifactRef: "ev.witness",
      witnessSha256: fx.witnessSha,
      observedAt: "2026-11-15T03:35:00.000Z",
      refutations: [
        {
          candidateId: "H-1",
          contradiction: "Measured max trough depth 2924.5m < 3500m oceanic threshold",
          evidenceRef: "ev.witness",
        },
      ],
    };

    const rep1 = runWitnessedSelectionCycle({
      round1Candidates: [CAND_1, CAND_2],
      priorRanking: ["H-1", "H-2"],
      evidenceVerification: verification,
      witness,
      now: () => "2026-11-15T03:35:00.000Z",
    });

    assert.equal(rep1.prior_selected, "H-1");
    assert.equal(rep1.posterior_selected, "H-2");
    assert.equal(rep1.selection_flipped, true);
    assert.equal(rep1.changed_future_behavior, true);
    assert.equal(rep1.converged_on_replay, true);
    assert.equal(rep1.round1.guard.allowed, true);
    assert.equal(rep1.round2.guard.allowed, true);
    assert.equal(rep1.round2.guard.selectedCandidateId, "H-2");
    assert.deepEqual(CAND_1.contradictions, []); // original object never mutated

    // Timestamp-independent deterministic cycle hash
    const rep2 = runWitnessedSelectionCycle({
      round1Candidates: [CAND_1, CAND_2],
      priorRanking: ["H-1", "H-2"],
      evidenceVerification: verification,
      witness,
      now: () => "2027-01-01T00:00:00.000Z",
    });
    assert.equal(rep1.deterministic_cycle_hash, rep2.deterministic_cycle_hash);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("fail-closed: if witness refutes all admissible candidates, Round 2 flips to HOLD and guard blocks", () => {
  const fx = makeFixtureDir();
  try {
    const verification = verifyDiskEvidence(fx.paths);
    const witnessAll: WitnessOutcome = {
      witnessId: "w-all-fail",
      witnessArtifactRef: "ev.witness",
      witnessSha256: fx.witnessSha,
      observedAt: "2026-11-15T03:35:00.000Z",
      refutations: [
        { candidateId: "H-1", contradiction: "refuted-1", evidenceRef: "ev.witness" },
        { candidateId: "H-2", contradiction: "refuted-2", evidenceRef: "ev.witness" },
      ],
    };

    const rep = runWitnessedSelectionCycle({
      round1Candidates: [CAND_1, CAND_2],
      priorRanking: ["H-1", "H-2"],
      evidenceVerification: verification,
      witness: witnessAll,
      now: () => "2026-11-15T03:35:00.000Z",
    });

    assert.equal(rep.prior_selected, "H-1");
    assert.equal(rep.posterior_selected, null);
    assert.equal(rep.round2.receipt.selection.status, "HOLD");
    assert.equal(rep.round2.guard.allowed, false);
    assert.match(rep.round2.guard.reason, /^HOLD:/);
    assert.equal(preCollapseGuard(rep.round2.receipt).allowed, false);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});
