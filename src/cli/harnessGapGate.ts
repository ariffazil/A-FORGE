#!/usr/bin/env node
/**
 * harnessGapGate.ts — CLI door for the Harness Adaptation Gap gate (G_t).
 *
 * WHY THIS EXISTS
 *   Self-improvement loops (DSPy/GEPA skill candidates, dream-engine promotions,
 *   self-modifying agent code) and pre-deploy checks need one executable way to
 *   ask: "did this revision actually generalize, or did it only improve on the
 *   traces it was tuned on?"
 *
 * USAGE
 *   node dist/src/cli/harnessGapGate.js --evidence <file.json> [--receipt <out.json>]
 *
 * EVIDENCE SHAPES ACCEPTED
 *   { ...GeneralizationEvidence }
 *   { generalization: { ...GeneralizationEvidence } }
 *   { revision_kind: "harness_revision", generalization: { ... } }
 *
 * EXIT CODES
 *   0  GENERALIZES   — promotable (proposal only; sealing stays with F13/888)
 *   2  blocked       — UNPROVEN | OVERFIT | REGRESSION | COST_CUT_REGRESSION | UNMEASURED
 *   1  usage / IO error
 *
 * @module cli/harnessGapGate
 * @constitutional F1 AMANAH · F2 TRUTH · F7 HUMILITY
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  evaluateGeneralization,
  unmeasuredAssessment,
  type GeneralizationEvidence,
} from "../domain/governance/GeneralizationGate.js";

type CliArgs = { evidencePath: string | null; receiptPath: string | null };

function parseArgs(argv: readonly string[]): CliArgs {
  let evidencePath: string | null = null;
  let receiptPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--evidence") {
      evidencePath = argv[++i] ?? null;
    } else if (a.startsWith("--evidence=")) {
      evidencePath = a.slice("--evidence=".length);
    } else if (a === "--receipt") {
      receiptPath = argv[++i] ?? null;
    } else if (a.startsWith("--receipt=")) {
      receiptPath = a.slice("--receipt=".length);
    } else if (a === "--help" || a === "-h") {
      evidencePath = null;
      receiptPath = null;
      break;
    }
  }
  return { evidencePath, receiptPath };
}

function extractEvidence(raw: unknown): GeneralizationEvidence | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const candidate = obj.generalization ?? obj.evidence ?? obj;
  if (typeof candidate !== "object" || candidate === null) return null;
  const ev = candidate as Partial<GeneralizationEvidence>;
  if (!Array.isArray(ev.dev_scores_before) || !Array.isArray(ev.dev_scores_after)) return null;
  if (!Array.isArray(ev.heldout_scores_before) || !Array.isArray(ev.heldout_scores_after)) return null;
  return ev as GeneralizationEvidence;
}

function main(): number {
  const { evidencePath, receiptPath } = parseArgs(process.argv.slice(2));

  if (!evidencePath) {
    console.error(
      "usage: harnessGapGate --evidence <file.json> [--receipt <out.json>]\n" +
        "  G_t = ΔJ_dev − ΔJ_test. Exit 0 = GENERALIZES, 2 = blocked, 1 = usage/IO.",
    );
    return 1;
  }

  let rawText: string;
  try {
    rawText = readFileSync(evidencePath, "utf8");
  } catch (err) {
    console.error(`cannot read evidence file: ${(err as Error).message}`);
    return 1;
  }

  const inputSha256 = createHash("sha256").update(rawText).digest("hex");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error(`evidence is not valid JSON: ${(err as Error).message}`);
    return 1;
  }

  const evidence = extractEvidence(parsed);
  const assessment = evidence
    ? evaluateGeneralization(evidence)
    : unmeasuredAssessment(
        "evidence file has no usable generalization block (need dev_scores_before/after + heldout_scores_before/after)",
      );

  const receipt = {
    gate: "harness_adaptation_gap",
    gate_version: "1.0.0",
    reference: "arXiv:2610.30499 (Lehmann & Vahdati, 21 Oct 2026)",
    ts: new Date().toISOString(),
    evidence_path: evidencePath,
    evidence_sha256: inputSha256,
    ...assessment,
    proposal_only: true,
    sealing_authority: "F13 / 888-APEX (this gate never seals)",
  };

  process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");

  if (receiptPath) {
    try {
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
    } catch (err) {
      console.error(`cannot write receipt: ${(err as Error).message}`);
      return 1;
    }
  }

  return assessment.promotable ? 0 : 2;
}

process.exitCode = main();
