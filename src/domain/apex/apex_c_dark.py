"""
⚠️ DEAD DUAL PATH (2026-07-25 H2 entropy kill)

This file previously re-implemented G = A·P·E·X·Φ inside A-FORGE.
That is illegal for constitutional G.

CANONICAL G-FOLD (Δ plane only):
  arif_think(mode='apex') → arifosmcp.runtime.apex_canonical.compute_apex

This module remains as a **compatibility shim** that:
  - documents the kill
  - raises RuntimeError if used for constitutional G
  - provides offline local estimates only when AFORGE_LOCAL_G_OK=1

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
