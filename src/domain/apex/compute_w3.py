"""
compute_w3.py — W³ = ∛(H × AI × Ext) — Nash geometric mean
═══════════════════════════════════════════════════════════

MEMBRANE-01: This computation belongs to A-FORGE (actuator), not the kernel.
The kernel reads W3 from MeasurementPacket; it never recomputes.

Copied from /root/arifOS/core/intelligence.py (Phase 2 migration).
Kernel copy marked MEMBRANE_DEPRECATED.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations


def compute_w3(human_score: float, ai_score: float, earth_score: float) -> float:
    """W³ = ∛(H × AI × Ext) — Nash (1950) geometric mean.

    Zero in any channel collapses W³ to 0.
    Arithmetic mean is WRONG — it loses the Nash collapse property.
    See: /root/A-FORGE/forge_work/2026-07-06/apex-theory-validation/FORMULA_REALITY_REPORT.md
    """
    if human_score <= 0 or ai_score <= 0 or earth_score <= 0:
        return 0.0
    return round((human_score * ai_score * earth_score) ** (1 / 3), 3)
