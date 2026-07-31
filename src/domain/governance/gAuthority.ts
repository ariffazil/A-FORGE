/**
 * gAuthority.ts — Single source of G-fold authority labels (Ω/Ψ planes)
 *
 * Constitutional G is computed ONLY in arifOS:
 *   arif_think(mode='apex') → arifosmcp.runtime.apex_canonical
 *
 * Every A-FORGE local product (evaluate, apexDials, taskJacobian,
 * APEXRuntimeReceipt) MUST attach these labels so agents never treat
 * actuator/wire scores as kernel G.
 *
 * @module governance/gAuthority
 * @constitutional F2 TRUTH · F8 GENIUS · F11 AUDIT
 */

/** Canonical G-fold path — sole constitutional source */
export const CANONICAL_G_SOURCE = "arif_think.mode=apex" as const;

/** Canonical module on the Δ plane */
export const CANONICAL_G_MODULE = "arifosmcp.runtime.apex_canonical" as const;

/**
 * Constitutional formula (V3 sealed in apex_canonical 2026-07-28).
 * G is the geometric mean of the four canonical dials (A, P, E, X).
 * Φ is a separate scar-gate dimension, not a 5th dial — see T6 theorem
 * in arifOS/docs/APEX_MATH_CANON.md. Older five-factor explanations
 * (G = A·P·E·X·Φ) are *removed* from the canonical source. Local
 * displays may still show legacy strings, but the truth lives here.
 */
export const CANONICAL_G_EQUATION = "G = (A × P × E × X)^(1/4)" as const;

/** Canonical dial labels (length 4; Φ is excluded). */
export const CANONICAL_G_DIALS = ["A", "P", "E", "X"] as const;
export type CanonicalGDial = typeof CANONICAL_G_DIALS[number];

/** Number of canonical dials — pinned for arifOS parity tests. */
export const CANONICAL_G_DIAL_COUNT = 4 as const;

/** Geometric mean is the canonical aggregator (no weighted Φ term). */
export const CANONICAL_G_IS_GEOMETRIC_MEAN = true as const;

export type GAuthority =
  | "arif_think.mode=apex" // only this is constitutional
  | "local_estimate" // actuator / Jacobian heuristic
  | "wire_estimate_not_canonical" // A2A / cockpit display
  | "application_local" // UI/workflow scores
  | "none";

/** Stamp for any local G product */
export function localGStamp(kind: Exclude<GAuthority, "arif_think.mode=apex" | "none"> = "local_estimate") {
  return {
    g_authority: kind,
    g_canonical_source: CANONICAL_G_SOURCE,
    g_canonical_module: CANONICAL_G_MODULE,
    invent_g: false as const,
    derived_local: true as const,
  };
}
