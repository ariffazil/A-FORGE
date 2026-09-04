"""
paths_resolver.py — Single source of organ-path truth.

Forged: 2026-09-04 (zen-naming-hardening mission).
Doctrine: AAA/canon/CANONICAL_GLOSSARY.md §NODES + §PATHS (added by Patch 6).

This module exists so that runtime code (paradox-engine, scripts, kernels)
NEVER hardcodes `/root/<organ>` literals. Every sys.path.insert and
every fs path lookup for a federation organ should resolve through here.

K-invariants satisfied:
  K-1 — Observation Must Be Config-Independent (paths derived from disk truth, not config)
  K-3 — Annotations Are the External Legibility Contract (one canonical name → one path)
  K-8 — Migration-as-F1 (additive; if a path moves, update this table once)

DITEMPA BUKAN DIBERI — Forged, not given.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, List


# ── Canonical organ paths (single source of truth) ─────────────────
# Order matters: first live path wins.
# Update this table when an organ migrates; runtime auto-resolves.

CANON_ORG_PATHS: dict[str, List[str]] = {
    "A-FORGE":   ["/root/A-FORGE",        "/opt/af-forge"],          # af-forge symlinks to /root
    "arifOS":    ["/root/arifOS",         "/opt/arifos"],            # kernel source + runtime deploy
    "AAA":       ["/root/AAA"],
    "GEOX":      ["/root/GEOX",           "/opt/geox"],
    "WEALTH":    ["/root/WEALTH",         "/opt/wealth"],
    "WELL":      ["/root/WELL",           "/opt/well"],
    "HERMES":    ["/root/.hermes"],                              # case-sensitive canon
    "arifFlow":  ["/root/arifFlow",       "/opt/arifflow"],
    "VAULT999":  ["/root/VAULT999",       "/root/arifOS/VAULT999"], # VAULT999 symlinks to arifOS/VAULT999
    "forge_work":["/root/forge_work"],                            # sketchpad, never execute
    "BACKUPS":   ["/root/BACKUPS"],
}


def org_path(name: str, must_exist: bool = True) -> Path:
    """
    Resolve a canonical organ name → first live on-disk path.

    F2 (TRUTH): probes disk before claiming. K-1: config-independent.
    Per the doctrine of naming ("Naming is the first act of creation"),
    write canonical (alias), never alias alone. This function enforces
    that by deriving truth from disk, not from declared config.

    Args:
        name: Canonical organ name from CANONICAL_GLOSSARY §NODES.
              Must match exactly (A-FORGE not AForge or a-forge).
        must_exist: If True (default), raises if no live path found.

    Returns:
        Path: First live path that exists on disk.

    Raises:
        KeyError: If name is not in CANON_ORG_PATHS.
        FileNotFoundError: If must_exist and no candidate path exists.

    Example:
        >>> org_path("A-FORGE")
        PosixPath('/root/A-FORGE')
        >>> org_path("arifOS")
        PosixPath('/root/arifOS')
    """
    if name not in CANON_ORG_PATHS:
        raise KeyError(
            f"Unknown organ {name!r}. Known: {sorted(CANON_ORG_PATHS.keys())}. "
            "Update CANONICAL_GLOSSARY.md and this table together."
        )

    candidates = CANON_ORG_PATHS[name]
    for candidate in candidates:
        # Symlinks resolve fine — Path.exists() handles them
        if Path(candidate).exists():
            return Path(candidate)

    if must_exist:
        raise FileNotFoundError(
            f"No live path for organ {name!r}. "
            f"Tried: {candidates}. "
            "Check disk + rerun, or update CANON_ORG_PATHS if migrated."
        )

    # Caller said "don't care if it exists" — return first declared.
    return Path(candidates[0])


def org_import_root(name: str) -> str:
    """
    Convenience: returns str(org_path(name)) for sys.path.insert.

    Example:
        >>> sys.path.insert(0, org_import_root("A-FORGE") + "/paradox-engine")
        # resolves to: sys.path.insert(0, "/root/A-FORGE/paradox-engine")
    """
    return str(org_path(name))


def all_org_paths(name: str) -> List[Path]:
    """All declared candidates for an organ (live or not). For audit."""
    return [Path(p) for p in CANON_ORG_PATHS[name]]


def live_org_paths(name: str) -> List[Path]:
    """Only the live candidates. For migration audit."""
    return [p for p in all_org_paths(name) if p.exists()]


def audit_federation() -> dict:
    """
    Walk all known organs, report live count + anomalies.
    For use in health checks and CI.
    """
    out = {}
    for name in sorted(CANON_ORG_PATHS.keys()):
        live = live_org_paths(name)
        all_paths = all_org_paths(name)
        out[name] = {
            "live_count": len(live),
            "declared_count": len(all_paths),
            "live": [str(p) for p in live],
            "missing": [str(p) for p in all_paths if not p.exists()],
        }
    return out


# ── CLI: standalone audit ─────────────────────────────────────────
if __name__ == "__main__":
    import json
    print(json.dumps(audit_federation(), indent=2))
