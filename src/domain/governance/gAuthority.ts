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

/** Constitutional formula (V2 sealed in apex_canonical) */
export const CANONICAL_G_EQUATION = "G = A · P · E · X · Φ" as const;

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
