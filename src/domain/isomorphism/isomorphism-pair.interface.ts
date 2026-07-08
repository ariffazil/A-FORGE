/**
 * isomorphism-pair.interface.ts — Executable Isomorphism Type
 *
 * Jalan B: Jadikan canon J‑space sebagai executable interface.
 *
 * Setiap IsomorphismPair mewakili hubungan antara GEOX primitive
 * dan arifOS computational twin, dengan witness function yang
 * membuktikan hubungan itu masih sepadan pada runtime.
 *
 * Tiga invariant:
 *   IDENTITY   — identity continuity (F1)
 *   AUTHORITY  — authority conservation (F11/F13)
 *   IRREVERSIBILITY — irreversibility boundary (VAULT999)
 *
 * DITEMPA BUKAN DIBERI
 */

export type IsomorphismInvariant = "IDENTITY" | "AUTHORITY" | "IRREVERSIBILITY";

export interface IsomorphismPair {
  /** GEOX-side primitive name, e.g. "UWI", "AFE", "End-of-well report" */
  readonly geoPrimitive: string;

  /** arifOS-side twin name, e.g. "toolFingerprint", "lease_id", "VAULT999" */
  readonly compPrimitive: string;

  /** Which of the three J‑space invariants this pair serves */
  readonly invariant: IsomorphismInvariant;

  /** Human-readable description of the isomorphism */
  readonly description: string;

  /**
   * Witness function — returns true if the isomorphism is still valid.
   * Called at runtime to prove the pair still matches.
   * Must be synchronous and side-effect-free.
   */
  readonly witness: () => boolean;
}

export interface IsomorphismCheckResult {
  readonly checkedAt: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly pairs: Array<{
    geoPrimitive: string;
    compPrimitive: string;
    invariant: IsomorphismInvariant;
    status: "PASS" | "FAIL";
    error?: string;
  }>;
  readonly verdict: "SEAL" | "MANIFOLD_DRIFT";
  readonly stableInvariants: IsomorphismInvariant[];
  readonly failedInvariants: IsomorphismInvariant[];
}

export type IsomorphismRegistry = Map<string, IsomorphismPair>;
