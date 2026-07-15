/**
 * isomorphism-check.ts — J‑space Manifold Runtime Check
 *
 * Menjalankan semua witness functions dalam isomorphism registry
 * dan mengembalikan keputusan: manifold stable atau drift.
 *
 * Digunakan oleh:
 *   - forge_isomorphism_check tool (on-demand)
 *   - startupIsomorphismCheck() (on boot, non-blocking)
 *
 * DITEMPA BUKAN DIBERI
 */

import {
  buildIsomorphismRegistry,
  getPairsByInvariant,
  getInvariantCounts,
} from "./geo-computational-isomorphism.js";
import type {
  IsomorphismCheckResult,
  IsomorphismInvariant,
  IsomorphismRegistry,
} from "./isomorphism-pair.interface.js";

/**
 * Run full isomorphism check against the registered pairs.
 */
export function runIsomorphismCheck(): IsomorphismCheckResult {
  const registry = buildIsomorphismRegistry();
  const results = runIsomorphismOnRegistry(registry);
  return results;
}

/**
 * Run isomorphism check on a specific registry instance (for testing with mocks).
 */
export function runIsomorphismOnRegistry(registry: IsomorphismRegistry): IsomorphismCheckResult {
  const checkedAt = new Date().toISOString();
  const pairResults: IsomorphismCheckResult["pairs"] = [];
  let passed = 0;
  let failed = 0;

  for (const [key, pair] of registry.entries()) {
    try {
      const witnessResult = pair.witness();
      if (witnessResult) {
        passed++;
        pairResults.push({
          geoPrimitive: pair.geoPrimitive,
          compPrimitive: pair.compPrimitive,
          invariant: pair.invariant,
          status: "PASS",
        });
      } else {
        failed++;
        pairResults.push({
          geoPrimitive: pair.geoPrimitive,
          compPrimitive: pair.compPrimitive,
          invariant: pair.invariant,
          status: "FAIL",
          error: `Witness returned false for ${key}`,
        });
      }
    } catch (err: any) {
      failed++;
      pairResults.push({
        geoPrimitive: pair.geoPrimitive,
        compPrimitive: pair.compPrimitive,
        invariant: pair.invariant,
        status: "FAIL",
        error: `Witness threw: ${err.message ?? String(err)}`,
      });
    }
  }

  // Determine which invariants are stable (all pairs in that group passed)
  const stableInvariants: IsomorphismInvariant[] = [];
  const failedInvariants: IsomorphismInvariant[] = [];

  for (const inv of ["IDENTITY", "AUTHORITY", "IRREVERSIBILITY"] as IsomorphismInvariant[]) {
    const invPairs = pairResults.filter((p) => p.invariant === inv);
    const invFailed = invPairs.filter((p) => p.status === "FAIL");
    if (invFailed.length === 0) {
      stableInvariants.push(inv);
    } else {
      failedInvariants.push(inv);
    }
  }

  return {
    checkedAt,
    total: registry.size,
    passed,
    failed,
    pairs: pairResults,
    verdict: failed === 0 ? "SEAL" : "MANIFOLD_DRIFT",
    stableInvariants,
    failedInvariants,
  };
}

/**
 * Startup check — runs isomorphism check and logs to stderr.
 * Non-blocking — diagnostic only.
 */
export function startupIsomorphismCheck(): void {
  try {
    const result = runIsomorphismCheck();
    const counts = getInvariantCounts(buildIsomorphismRegistry());

    process.stderr.write(
      `[Isomorphism] startup check: ${result.total} pairs, ` +
      `${result.passed} passed, ${result.failed} failed\n`,
    );

    for (const inv of ["IDENTITY", "AUTHORITY", "IRREVERSIBILITY"] as IsomorphismInvariant[]) {
      const invPairs = result.pairs.filter((p) => p.invariant === inv);
      const invFailed = invPairs.filter((p) => p.status === "FAIL");
      const status = invFailed.length === 0 ? "✅" : "⚠️";
      process.stderr.write(
        `[Isomorphism]   ${status} ${inv}: ${invPairs.length} pairs, ` +
        `${invFailed.length} failed\n`,
      );
    }

    if (result.verdict === "SEAL") {
      process.stderr.write(
        `[Isomorphism] ✅ J‑space manifold STABLE. All ${result.total} isomorphism pairs verified.\n`,
      );
    } else {
      process.stderr.write(
        `[Isomorphism] ⚠️  J‑space MANIFOLD DRIFT. ${result.failed} pair(s) failed. ` +
        `Run forge_isomorphism_check for details.\n`,
      );
    }
  } catch (err: any) {
    process.stderr.write(
      `[Isomorphism] startup check error: ${err.message ?? String(err)}\n`,
    );
  }
}
