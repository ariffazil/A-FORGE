"""
⚠️ DEAD DUAL PATH (2026-07-25 H2 entropy kill)
═══════════════════════════════════════════════════════════════════════════════

This file previously re-implemented G = A·P·E·X·Φ inside A-FORGE.
That is illegal for constitutional G.

CANONICAL G-FOLD (V3 sealed 2026-07-28, F13 SOVEREIGN):
  arif_think(mode='apex') → arifosmcp.runtime.apex_canonical.compute_apex
  Formula: G = (A × P × E × X)^(1/4)  ← four-dial geometric mean
  Φ is a separate scar-gate dimension (H·AI·Ext tri-witness), NOT a 5th dial.
  Reference: /root/arifOS/docs/APEX_MATH_CANON.md (F13 RATIFIED 2026-07-28).

CROSS-ORGAN DRIFT NOTICE (2026-07-31, FI-008 surfaced):
  arifOS arifosmcp/runtime/apex_canonical.py still computes
  G = A · P · E · X · Φ (5-factor, pre-V3 seal 2026-07-13). This is stale
  relative to the F13 V3 seal. AWAITING SOVEREIGN RATIFICATION on which
  side of the federation gets updated. P0.1 confines A-FORGE local
  estimates to the V3 four-dial geometric mean; constitutional G remains
  in arifOS until the cross-organ sync lands.

This module remains as a **compatibility shim** that:
  - documents the kill
  - raises RuntimeError if used for constitutional G
  - provides offline local estimates only when AFORGE_LOCAL_G_OK=1
  - its own G = A·P·E·X·Φ computation is the PRE-V3 form, not V3-canonical
    — it is kept for backward compatibility only and will be deprecated
    once arifOS apex_canonical is updated to V3

Do not import for new code. Prefer GovernanceBridge → arifOS.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import os
import warnings
from dataclasses import dataclass
from typing import Any


class CanonicalGRequired(RuntimeError):
    """Raised when A-FORGE tries to mint constitutional G locally."""


def _allow_local() -> bool:
    return os.environ.get("AFORGE_LOCAL_G_OK", "").strip() in ("1", "true", "yes")


@dataclass
class LocalApexEstimate:
    """Non-constitutional local estimate — never authority."""

    G: float
    C_dark: float
    A: float
    P: float
    E: float
    X: float
    Phi: float
    g_authority: str = "local_estimate"
    g_canonical_source: str = "arif_think.mode=apex"
    invent_g: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "G": self.G,
            "C_dark": self.C_dark,
            "A": self.A,
            "P": self.P,
            "E": self.E,
            "X": self.X,
            "Phi": self.Phi,
            "g_authority": self.g_authority,
            "g_canonical_source": self.g_canonical_source,
            "invent_g": self.invent_g,
            "warning": "LOCAL ONLY — not constitutional G",
        }


def compute_apex(
    A: float = 0.0,
    P: float = 0.0,
    E: float = 0.0,
    X: float = 0.0,
    Phi: float = 0.0,
    **_: Any,
) -> LocalApexEstimate:
    """Deprecated local product. Not constitutional G.

    Set AFORGE_LOCAL_G_OK=1 to allow offline estimates.
    Otherwise raises CanonicalGRequired.
    """
    warnings.warn(
        "A-FORGE domain.apex.compute_apex is DEAD for constitutional G. "
        "Use arif_think(mode='apex') → apex_canonical.",
        DeprecationWarning,
        stacklevel=2,
    )
    if not _allow_local():
        raise CanonicalGRequired(
            "Constitutional G lives in arifOS arif_think(mode='apex'). "
            "Set AFORGE_LOCAL_G_OK=1 only for offline local estimates."
        )
    G = float(A) * float(P) * float(E) * float(X) * float(Phi)
    C_dark = float(A) * (1.0 - float(P)) * (1.0 - float(X))
    return LocalApexEstimate(
        G=max(0.0, min(1.0, G)),
        C_dark=max(0.0, min(1.0, C_dark)),
        A=float(A),
        P=float(P),
        E=float(E),
        X=float(X),
        Phi=float(Phi),
    )


def compute_c_dark(A: float, P: float, X: float) -> float:
    """Local C_dark estimate only — same authority rules as compute_apex."""
    if not _allow_local():
        raise CanonicalGRequired(
            "C_dark for constitutional use comes from arif_think(mode='apex')."
        )
    return max(0.0, min(1.0, float(A) * (1.0 - float(P)) * (1.0 - float(X))))


__all__ = [
    "CanonicalGRequired",
    "LocalApexEstimate",
    "compute_apex",
    "compute_c_dark",
]
