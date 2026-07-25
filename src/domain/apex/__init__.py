"""
A-FORGE domain.apex — DEAD for constitutional G (H2 2026-07-25).

Canonical G: arif_think(mode='apex') → arifosmcp.runtime.apex_canonical

Local shim: apex_c_dark.compute_apex only if AFORGE_LOCAL_G_OK=1.
"""

from .apex_c_dark import (
    CanonicalGRequired,
    LocalApexEstimate,
    compute_apex,
    compute_c_dark,
)

__all__ = [
    "CanonicalGRequired",
    "LocalApexEstimate",
    "compute_apex",
    "compute_c_dark",
]
