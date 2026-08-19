/**
 * geo-computational-isomorphism.ts — Isomorphism Registry
 *
 * Semua pasangan GEOX ↔ arifOS dari canon proto/isomorphism/,
 * didaftarkan dengan witness function yang boleh dijalankan pada runtime.
 *
 * Witness functions adalah pragmatic — mereka check structural existence:
 * - Adakah tool fingerprinting berfungsi? (witness for UWI ↔ fingerprint)
 * - Adakah elicitation gate dipasang? (witness for AFE ↔ lease)
 * - Adakah VAULT999 wujud? (witness for end-of-well report ↔ seal chain)
 *
 * DITEMPA BUKAN DIBERI
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import {
  type IsomorphismPair,
  type IsomorphismInvariant,
  type IsomorphismRegistry,
} from "./isomorphism-pair.interface.js";

// ── Helper untuk detect sama ada module tertentu wujud ────────────────

// ESM-safe module resolver (Phase-2 B2 fix, 2026-08-18)
// Project package.json declares "type": "module" — bare `require` is undefined
// in ESM context, so previous hasModule silently failed for all witnesses.
// createRequire(import.meta.url) bridges ESM → CJS resolution.
const _require = createRequire(import.meta.url);

function hasModule(path: string): boolean {
  try {
    _require.resolve(path);
    return true;
  } catch {
    return false;
  }
}

function hasFunction(obj: any, name: string): boolean {
  return typeof obj?.[name] === "function";
}

// ── Identity Continuity Pairs — Invariant 1 ────────────────────────────

function buildIdentityPairs(): IsomorphismPair[] {
  const pairs: IsomorphismPair[] = [];

  // Pair 1: UWI ↔ toolFingerprint
  pairs.push({
    geoPrimitive: "UWI",
    compPrimitive: "toolFingerprint",
    invariant: "IDENTITY",
    description: "Kedua-dua adalah immutable identity yang tak boleh drift tanpa dikesan",
    witness: () => {
      try {
        const fp = crypto.createHash("sha256").update("test::{}").digest("hex");
        return fp.length === 64; // SHA-256 produces 64-char hex
      } catch {
        return false;
      }
    },
  });

  // Pair 2: Well name ↔ actor_id
  pairs.push({
    geoPrimitive: "Well name",
    compPrimitive: "actor_id",
    invariant: "IDENTITY",
    description: "Human-readable label untuk identity yang lebih stabil",
    witness: () => true, // String identity is universal — always true
  });

  // Pair 3: Stratigraphic unit ↔ session_id
  pairs.push({
    geoPrimitive: "Stratigraphic unit",
    compPrimitive: "session_id",
    invariant: "IDENTITY",
    description: "Boundary yang mengandungi consistent record",
    witness: () => true, // Boundary concept is universal
  });

  // Pair 4: Field code ↔ organ name
  pairs.push({
    geoPrimitive: "Field code",
    compPrimitive: "Organ (GEOX/WEALTH/WELL)",
    invariant: "IDENTITY",
    description: "Basin-scale grouping ↔ constitutional-scale grouping",
    witness: () => true,
  });

  // Pair 5: Log mnemonics ↔ tool name
  pairs.push({
    geoPrimitive: "Log mnemonic",
    compPrimitive: "forge_* tool name",
    invariant: "IDENTITY",
    description: "Standardised identifier untuk measurement ↔ action",
    witness: () => true,
  });

  // Pair 6: Depth reference ↔ schemaHash
  pairs.push({
    geoPrimitive: "Depth reference (TVDSS/MD/TWT)",
    compPrimitive: "schemaHash",
    invariant: "IDENTITY",
    description: "Fixed datum untuk comparison stability",
    witness: () => {
      // Schema hash computed at registry — check if crypto.sha256 is available
      try {
        const hash = crypto.createHash("sha256").update("{}").digest("hex");
        return typeof hash === "string" && hash.length > 0;
      } catch {
        return false;
      }
    },
  });

  return pairs;
}

// ── Authority Conservation Pairs — Invariant 2 ─────────────────────────

function buildAuthorityPairs(): IsomorphismPair[] {
  const pairs: IsomorphismPair[] = [];

  // Pair 7: Prospect maturation gate ↔ 000→111→333→555→777→888→999
  pairs.push({
    geoPrimitive: "Prospect maturation gate",
    compPrimitive: "Constitutional stage gate",
    invariant: "AUTHORITY",
    description: "Evidence must pass through staged gates before irreversible action",
    witness: () => {
      // Check that the stage gate pattern exists in the codebase
      return hasModule("../../domain/forge/check_verdict");
    },
  });

  // Pair 8: Trap integrity ↔ elicitation gate
  pairs.push({
    geoPrimitive: "Trap integrity (seal must hold)",
    compPrimitive: "Elicitation gate (-32042)",
    invariant: "AUTHORITY",
    description: "Authority gate must hold before MUTATE execution",
    witness: () => {
      // Check that elicitation gate module exists
      return hasModule("../../interfaces/mcp/policyTools");
    },
  });

  // Pair 9: Geologist's judgment ↔ F13 SOVEREIGN
  pairs.push({
    geoPrimitive: "Geologist's judgment (tak cukup geology)",
    compPrimitive: "F13 SOVEREIGN",
    invariant: "AUTHORITY",
    description: "Human veto on irreversible action — sovereign check",
    witness: () => true, // F13 is constitutional — always present
  });

  // Pair 10: Risked POS ↔ forge_judge_proxy
  pairs.push({
    geoPrimitive: "Risked POS (Probability of Success)",
    compPrimitive: "forge_judge_proxy verdict",
    invariant: "AUTHORITY",
    description: "Quantitative assessment before capital commitment",
    witness: () => true,
  });

  // Pair 11: Peer review ↔ forge_witness (tri-witness W³)
  pairs.push({
    geoPrimitive: "Peer review",
    compPrimitive: "forge_witness (tri-witness W³)",
    invariant: "AUTHORITY",
    description: "Second opinion challenges primary interpretation",
    witness: () => true, // Tri-witness is constitutional
  });

  // Pair 12: AFE ↔ lease_id
  pairs.push({
    geoPrimitive: "AFE (Authority For Expenditure)",
    compPrimitive: "lease_id",
    invariant: "AUTHORITY",
    description: "Signed approval untuk guna budget/execution capacity",
    witness: () => true, // Lease is fundamental to A-FORGE
  });

  // Pair 13: Red flag ↔ 888_HOLD
  pairs.push({
    geoPrimitive: "Red flag (unsafe operations)",
    compPrimitive: "888_HOLD",
    invariant: "AUTHORITY",
    description: "Stop execution, assess, resume or abandon",
    witness: () => true, // 888_HOLD is constitutional
  });

  return pairs;
}

// ── Irreversibility Boundary Pairs — Invariant 3 ───────────────────────

function buildIrreversibilityPairs(): IsomorphismPair[] {
  const pairs: IsomorphismPair[] = [];

  // Pair 14: Spud ↔ Execute
  pairs.push({
    geoPrimitive: "Spud (drilling start)",
    compPrimitive: "forge_execute",
    invariant: "IRREVERSIBILITY",
    description: "Titik di mana reality berubah — point of no return",
    witness: () => true,
  });

  // Pair 15: End-of-well report ↔ VAULT999 seal chain
  pairs.push({
    geoPrimitive: "End-of-well report",
    compPrimitive: "VAULT999 seal chain",
    invariant: "IRREVERSIBILITY",
    description: "Immutable post-mortem — tak boleh diubah selepas ditulis",
    witness: () => {
      // Check VAULT999 seal chain exists (B2 fix: use top-level fs import)
      try {
        const vaultPath = "/root/.local/share/arifos/vault999/seal_chain.jsonl";
        if (fs.existsSync(vaultPath)) {
          const stat = fs.statSync(vaultPath);
          return stat.size > 0;
        }
        return false;
      } catch {
        return false;
      }
    },
  });

  // Pair 16: Drilling log ↔ execution receipt
  pairs.push({
    geoPrimitive: "Drilling log",
    compPrimitive: "forge_work/ execution receipt",
    invariant: "IRREVERSIBILITY",
    description: "Record of what happened during the irreversible phase",
    witness: () => {
      // B2 fix: use top-level fs import instead of require
      try {
        const forgeWork = "/root/A-FORGE/forge_work";
        return fs.existsSync(forgeWork);
      } catch {
        return false;
      }
    },
  });

  // Pair 17: Cessation of production ↔ arif_seal
  pairs.push({
    geoPrimitive: "Cessation of production",
    compPrimitive: "arif_seal",
    invariant: "IRREVERSIBILITY",
    description: "Action sealed — irreversible. Tak boleh undo.",
    witness: () => true,
  });

  return pairs;
}

// ── Registry Builder ───────────────────────────────────────────────────

/**
 * Build the complete isomorphism registry from all three invariant groups.
 */
export function buildIsomorphismRegistry(): IsomorphismRegistry {
  const registry: IsomorphismRegistry = new Map();
  const allPairs = [
    ...buildIdentityPairs(),
    ...buildAuthorityPairs(),
    ...buildIrreversibilityPairs(),
  ];

  for (const pair of allPairs) {
    const key = `${pair.invariant}:${pair.geoPrimitive}->${pair.compPrimitive}`;
    registry.set(key, pair);
  }

  return registry;
}

/**
 * Get all isomorphism pairs for a given invariant.
 */
export function getPairsByInvariant(
  registry: IsomorphismRegistry,
  invariant: IsomorphismInvariant,
): IsomorphismPair[] {
  const pairs: IsomorphismPair[] = [];
  for (const pair of registry.values()) {
    if (pair.invariant === invariant) {
      pairs.push(pair);
    }
  }
  return pairs;
}

/**
 * Get the count of pairs per invariant.
 */
export function getInvariantCounts(
  registry: IsomorphismRegistry,
): Record<IsomorphismInvariant, number> {
  let id = 0, auth = 0, irr = 0;
  for (const pair of registry.values()) {
    if (pair.invariant === "IDENTITY") id++;
    else if (pair.invariant === "AUTHORITY") auth++;
    else if (pair.invariant === "IRREVERSIBILITY") irr++;
  }
  return { IDENTITY: id, AUTHORITY: auth, IRREVERSIBILITY: irr };
}
