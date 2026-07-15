"""
apa/core/receipt.py — Bridge import surface for VAULT999 receipts.
====================================================================
All bridges import from here:
    from apa.core.receipt import VAULT999Receipt, APAResponse, build_receipt

Factory functions provide convenience constructors for common patterns.
This file is the thin wrapper — the canonical models live in schemas.py.

DITEMPA BUKAN DIBERI — Receipts are forged, not improvised.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from apa.core.schemas import (
    APAResponse,
    BlastRadius,
    EvidenceTag,
    VAULT999Receipt,
    VerbClass,
    Verdict,
)

__all__ = [
    "VAULT999Receipt",
    "APAResponse",
    "VerbClass",
    "BlastRadius",
    "EvidenceTag",
    "Verdict",
    "build_receipt",
    "build_response",
    "build_error_response",
]


# ── Factory functions ────────────────────────────────────────────────────────


def build_receipt(
    connector: str,
    verb: str,
    verb_class: VerbClass,
    lease_id: str,
    actor_id: str,
    *,
    session_id: Optional[str] = None,
    blast_radius: BlastRadius = BlastRadius.LOW,
    phases: Optional[list[str]] = None,
    result_summary: str = "",
    timestamp: Optional[datetime] = None,
) -> VAULT999Receipt:
    """Build a VAULT999Receipt with auto-computed sha256.

    Usage in bridges:
        receipt = build_receipt(
            connector="github",
            verb="create_issue",
            verb_class=VerbClass.MUTATE,
            lease_id="lease_abc123",
            actor_id="opencode",
            blast_radius=BlastRadius.LOW,
            phases=["EXECUTE", "VERIFY", "RECEIPT"],
            result_summary="Created issue #42 in arif-fazil/arifos",
        )

    The sha256 is auto-computed by the model validator.
    """
    return VAULT999Receipt(
        connector=connector,
        verb=verb,
        verb_class=verb_class,
        lease_id=lease_id,
        actor_id=actor_id,
        session_id=session_id,
        blast_radius=blast_radius,
        phases=phases or [],
        result_summary=result_summary[:500],
        timestamp=timestamp or datetime.now(timezone.utc),
    )


def build_response(
    *,
    ok: bool,
    connector: str,
    verb: str,
    verdict: Verdict,
    lease_id: str,
    result: Optional[Any] = None,
    error: Optional[str] = None,
    receipt: Optional[VAULT999Receipt] = None,
    evidence_tag: EvidenceTag = EvidenceTag.DER,
    confidence: float = 0.85,
) -> APAResponse:
    """Build an APAResponse envelope.

    Usage in bridges:
        response = build_response(
            ok=True,
            connector="github",
            verb="search_repos",
            verdict=Verdict.PROCEED,
            lease_id="lease_abc123",
            result={"repos": [...]},
            receipt=receipt,
        )
    """
    return APAResponse(
        ok=ok,
        connector=connector,
        verb=verb,
        verdict=verdict,
        evidence_tag=evidence_tag,
        confidence=confidence,
        result=result,
        error=error,
        lease_id=lease_id,
        receipt=receipt,
    )


def build_error_response(
    connector: str,
    verb: str,
    lease_id: str,
    error: str,
    *,
    verdict: Verdict = Verdict.HOLD,
) -> APAResponse:
    """Build an error APAResponse quickly.

    Usage:
        response = build_error_response(
            connector="gmail",
            verb="send_email",
            lease_id="lease_abc123",
            error="SMTP authentication failed",
        )
    """
    return APAResponse(
        ok=False,
        connector=connector,
        verb=verb,
        verdict=verdict,
        lease_id=lease_id,
        error=error,
        evidence_tag=EvidenceTag.OBS,
        confidence=1.0,
    )
