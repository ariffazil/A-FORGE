/**
 * ACT → lease-scope resolution for forge_session_init.
 *
 * Why this module exists (2026-10-31): the ACT_DERIVED lease path intersected the
 * ACT's `allowed` list against A-FORGE's tool vocabulary by name:
 *
 *     const allowed = (claims?.allowed ?? []).filter((t) => leaseScope.includes(t));
 *     const scope = allowed.length ? allowed : leaseScope;
 *
 * A kernel-minted ACT speaks KERNEL-VERB vocabulary (arif_init, arif_judge,
 * arif_seal, ...). A-FORGE speaks forge_* vocabulary (forge_filesystem,
 * forge_vault, forge_shell, ...). The two lists share exactly ONE token —
 * "arif_seal" — so a valid FULL-band ACT was silently reduced to a lease scoped
 * to ["arif_seal"], and every forge_* call then failed the lease check while the
 * session still reported lease_status: "ACT_DERIVED". A name intersection across
 * two vocabularies is not a scope restriction; it is a coincidence.
 *
 * Rule used here (least authority preserved, no silent widening):
 *   - ACT names at least one forge_* tool  -> honour the intersection (a real,
 *     intentionally narrowed grant).
 *   - ACT names NO forge_* tool at all      -> the vocabulary does not address
 *     this organ's tools; the ACT speaks to the actor's BAND, so the band default
 *     applies. This is the same default the empty-allowed path already used.
 *   - Intersection empty but forge_* named  -> band default, source recorded.
 * Every branch returns a `source` string so the caller can report WHY the scope
 * is what it is instead of presenting a derived scope as an explicit grant.
 */

export interface ActLeaseScopeResolution {
  scope: string[];
  source:
    | "act_named_forge_tools"
    | "act_named_shared_token_only"
    | "band_default_act_vocabulary_mismatch"
    | "band_default_no_forge_match";
  /** Tokens in the ACT that matched this organ's vocabulary (diagnostic). */
  matched: string[];
}

/**
 * A-FORGE lease band. Single owner: `forge_session_init` imports this instead of
 * re-declaring the list inline, so the ACT-resolution branches and the tests can
 * never drift from the scope the session actually mints.
 */
export const DEFAULT_LEASE_SCOPE: readonly string[] = [
  "forge_filesystem",
  "forge_vault",
  "forge_shell",
  "forge_shell_dryrun",
  "forge_seal",
  "arif_seal",
  "forge_session_init",
  "forge_health_check",
  "forge_ephemeral",
  "forge_reality_loop",
];

export function resolveActLeaseScope(
  allowed: readonly string[] | null | undefined,
  leaseScope: readonly string[],
): ActLeaseScopeResolution {
  const tokens = (allowed ?? []).map(String);
  const matched = tokens.filter((t) => leaseScope.includes(t));
  const namesForgeTool = tokens.some((t) => t.startsWith("forge_"));

  if (!namesForgeTool) {
    if (tokens.length === 1 && matched.length === 1) {
      return {
        scope: matched,
        source: "act_named_shared_token_only",
        matched,
      };
    }
    // Kernel-verb vocabulary (or empty): the ACT does not address this organ's
    // tools by name. Band default — exactly what the historic empty-allowed
    // branch did, so no capability is granted that the band did not already carry.
    return {
      scope: [...leaseScope],
      source: matched.length ? "band_default_act_vocabulary_mismatch" : "band_default_no_forge_match",
      matched,
    };
  }

  if (matched.length) {
    return { scope: matched, source: "act_named_forge_tools", matched };
  }

  return { scope: [...leaseScope], source: "band_default_no_forge_match", matched };
}
