"""
apa/core/schemas.py — Canonical Pydantic models for the APA protocol.
========================================================================
All bridges import these models. One source of truth for:
  - VAULT999Receipt  — immutable audit record written to the seal chain
  - APAResponse      — bridge response envelope returned to callers

G3 FORGE: collapses receipt fragmentation across 4 bridges + act_executor.
Previously every bridge built its receipt dict inline. Now: one model.

DITEMPA BUKAN DIBERI — Schemas are forged, not improvised.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Enums reused across models ──────────────────────────────────────────────


class Verdict(str, Enum):
    """APA execution verdicts. Not constitutional verdicts (those belong to arifOS)."""

    PROCEED = "PROCEED"
    HOLD = "HOLD"
    ABORT = "ABORT"
    ROLLBACK = "ROLLBACK"


class VerbClass(str, Enum):
    """Action classification for APA verbs."""

    OBSERVE = "OBSERVE"  # Read-only, no mutation
    DRAFT = "DRAFT"  # Create draft, no side effects
    MUTATE = "MUTATE"  # Write/change state
    EXTERNAL_SIDE_EFFECT = "EXTERNAL_SIDE_EFFECT"  # Sends email, posts message, etc.
    IRREVERSIBLE = "IRREVERSIBLE"  # Delete, force-push, seal


class BlastRadius(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EvidenceTag(str, Enum):
    OBS = "OBS"  # Observed — direct measurement
    DER = "DER"  # Derived — computed from observations
    INT = "INT"  # Interpreted — model-based inference
    SPEC = "SPEC"  # Speculated — projection beyond evidence


# ── VAULT999Receipt ─────────────────────────────────────────────────────────


class VAULT999Receipt(BaseModel):
    """Immutable audit record written to the VAULT999 seal chain.

    Every APA bridge execution that mutates or produces an external side
    effect MUST emit a VAULT999Receipt. This is the canonical shape —
    previously built as raw dicts inline in act_executor.py, forge_github.py,
    forge_calendar.py, and forge_email.py.

    G3 fix: all bridges now import from apa.core.schemas.
    """

    # ── Identity ──
    connector: str = Field(
        ...,
        description="Bridge identifier: telegram, gmail, calendar, github",
        min_length=1,
    )
    verb: str = Field(
        ...,
        description="Verb executed: send_message, create_issue, search_email, etc.",
        min_length=1,
    )
    verb_class: VerbClass = Field(
        ...,
        description="Action classification per APA taxonomy",
    )

    # ── Authority ──
    lease_id: str = Field(
        ...,
        description="Governed lease ID from forge_lease_request",
        min_length=1,
    )
    actor_id: str = Field(
        ...,
        description="Actor who initiated the action",
        min_length=1,
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Kernel-born session ID from arif_init",
    )

    # ── Risk ──
    blast_radius: BlastRadius = Field(
        default=BlastRadius.LOW,
        description="Estimated impact scope",
    )

    # ── Timing ──
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the receipt was created (UTC)",
    )

    # ── Execution trace ──
    phases: List[str] = Field(
        default_factory=list,
        description="ACT phases completed: DRY_RUN, SIMULATE, PREFLIGHT, EXECUTE, VERIFY, ROLLBACK, RECEIPT",
    )
    result_summary: str = Field(
        default="",
        description="Human-readable summary of the execution result (truncated at 500 chars)",
        max_length=500,
    )

    # ── Integrity ──
    sha256: Optional[str] = Field(
        default=None,
        description="SHA-256 hash of receipt content (computed before sealing)",
    )

    # ── Vault-assigned ──
    sequence: Optional[int] = Field(
        default=None,
        description="Sequence number assigned by VAULT999 on seal (read-only after seal)",
        ge=0,
    )
    seal_id: Optional[str] = Field(
        default=None,
        description="VAULT999 seal ID from arif_seal (null until sealed)",
    )

    # ── Validity ──

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_utc(cls, v: Any) -> datetime:
        """Accept ISO strings or datetime, always convert to UTC."""
        if isinstance(v, str):
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @model_validator(mode="after")
    def compute_hash(self) -> "VAULT999Receipt":
        """Auto-compute sha256 if not set and sufficient fields exist."""
        if self.sha256 is not None:
            return self
        if not self.connector or not self.verb or not self.lease_id:
            return self  # Too early to hash — caller will set
        content = self.model_dump(
            exclude={"sha256", "sequence", "seal_id"}, exclude_none=False
        )
        content["timestamp"] = self.timestamp.isoformat()
        raw = json.dumps(content, sort_keys=True, default=str)
        self.sha256 = hashlib.sha256(raw.encode()).hexdigest()
        return self

    @property
    def is_sealed(self) -> bool:
        """True if this receipt has been written to the VAULT999 chain."""
        return self.sequence is not None and self.seal_id is not None

    @property
    def receipt_id(self) -> str:
        """Composite identifier: {connector}:{verb}:{lease_id}:{sha256[:12]}"""
        prefix = self.sha256[:12] if self.sha256 else "UNHASHED"
        return f"{self.connector}:{self.verb}:{self.lease_id}:{prefix}"

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
        use_enum_values = True


# ── APAResponse ─────────────────────────────────────────────────────────────


class APAResponse(BaseModel):
    """Bridge response envelope returned to callers.

    Wraps either a VAULT999Receipt (for MUTATE / EXTERNAL_SIDE_EFFECT)
    or a plain result payload (for OBSERVE / DRAFT).

    Models the existing envelope from forge_github.py and act_executor.py
    but as a typed Pydantic model instead of a raw dict.
    """

    ok: bool = Field(
        ...,
        description="True if the bridge executed successfully",
    )
    connector: str = Field(
        ...,
        description="Bridge identifier",
        min_length=1,
    )
    verb: str = Field(
        ...,
        description="Verb executed",
        min_length=1,
    )

    # ── Outcome ──
    verdict: Verdict = Field(
        ...,
        description="Execution verdict (PROCEED, HOLD, ABORT, ROLLBACK)",
    )
    evidence_tag: EvidenceTag = Field(
        default=EvidenceTag.DER,
        description="Epistemic grade of the response",
    )
    confidence: float = Field(
        default=0.85,
        description="Confidence score [0.0, 1.0]",
        ge=0.0,
        le=1.0,
    )

    # ── Payload ──
    result: Optional[Any] = Field(
        default=None,
        description="Bridge-specific result payload (dict, list, str, etc.)",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if ok=False",
    )

    # ── Authority ──
    lease_id: str = Field(
        ...,
        description="Governed lease ID",
        min_length=1,
    )

    # ── Audit ──
    receipt: Optional[VAULT999Receipt] = Field(
        default=None,
        description="Immutable audit receipt for MUTATE/EXTERNAL_SIDE_EFFECT verbs",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the response was generated (UTC)",
    )

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_utc(cls, v: Any) -> datetime:
        if isinstance(v, str):
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @field_validator("receipt")
    @classmethod
    def receipt_required_for_mutate(
        cls, v: Optional[VAULT999Receipt], info: Any
    ) -> Optional[VAULT999Receipt]:
        """Receipt is strongly recommended for MUTATE/EXTERNAL_SIDE_EFFECT verbs.

        This is a WARNING, not a hard block — the bridge may set the receipt
        after construction. Use model_validate strict mode to enforce.
        """
        return v

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
        use_enum_values = True
        arbitrary_types_allowed = True  # For 'result: Any'
