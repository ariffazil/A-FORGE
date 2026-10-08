/**
 * deploymentDrift.ts — deployment attestation comparison (pure).
 *
 * E1b (fedstab-2026-10-08, F13-approved "sahkan segalanya a-z" 2026-10-08):
 * compare the deploy stamp against LIVE git HEAD, not the stale source marker.
 * Two stale markers previously rendered drift=false while repo HEAD advanced
 * (F-01, fedstab-2026-10-08). Extracted as a pure function so the comparison
 * semantics are unit-testable without touching production state.
 *
 * Semantics:
 *   - deployed UNAVAILABLE            → false (cannot assert drift; no invented signal)
 *   - head known                      → drift iff deployed !== head   (primary check)
 *   - head UNAVAILABLE (git failure)  → fallback to legacy marker pair comparison
 */
export function computeDeploymentDrift(
  deployedCommit: string,
  sourceCommit: string,
  headCommit: string
): boolean {
  if (deployedCommit === "UNAVAILABLE") return false;
  if (headCommit !== "UNAVAILABLE") return deployedCommit !== headCommit;
  return sourceCommit !== "UNAVAILABLE" && deployedCommit !== sourceCommit;
}
