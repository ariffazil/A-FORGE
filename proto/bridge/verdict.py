"""
J-Space Canonical Verdict — Unified Verdict Chain
==================================================
One verdict type for all organs. Python and TypeScript share the same geometry.

Canonical path: from models/verdicts.py (Python) or verdict.ts (TypeScript)
All organs import from here. No local verdict definitions.

DITEMPA BUKAN DIBERI — Verdicts are unified, not duplicated.
"""

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import hashlib
import json


class VerdictType(str, Enum):
    """The six canonical verdicts. Monotonic: SEAL/VOID are terminal."""

    SEAL = "SEAL"  # Action is lawful. Proceed. Terminal.
    PARTIAL = "PARTIAL"  # Partial approval. Proceed with constraints.
    HOLD = "HOLD"  # Not yet authorized. Wait.
    SABAR = "SABAR"  # Patience — condition not yet met.
    VOID = "VOID"  # Constitutionally prohibited. Terminal.
    UNKNOWN = "UNKNOWN"  # Insufficient evidence to judge.

    @property
    def is_terminal(self) -> bool:
        return self in (VerdictType.SEAL, VerdictType.VOID)

    def can_transition_to(self, target: "VerdictType") -> bool:
        """Check if transition is allowed per monotonicity rule."""
        if self.is_terminal:
            return False  # SEAL and VOID cannot transition
        if target == VerdictType.VOID:
            return True  # Violation always allowed
        if target == VerdictType.SEAL:
            return True  # Approval always allowed
        if target == VerdictType.UNKNOWN:
            return False  # Cannot un-know
        # HOLD ↔ SABAR allowed
        return True


class VerdictSubstate(str, Enum):
    """The 14 substates. Each verdict has specific resolution paths."""

    # SEAL substates (4)
    S1_SEAL_ROUTINE = "S1_SEAL_ROUTINE"  # Standard approval
    S2_SEAL_CONDITIONAL = "S2_SEAL_CONDITIONAL"  # Approval with constraints
    S3_SEAL_WITNESSED = "S3_SEAL_WITNESSED"  # Tri-witness verified
    S4_SEAL_SOVEREIGN = "S4_SEAL_SOVEREIGN"  # F13 direct approval

    # HOLD substates (4)
    H1_HOLD_AUTHORITY = "H1_HOLD_AUTHORITY"  # Waiting for authority
    H2_HOLD_EVIDENCE = "H2_HOLD_EVIDENCE"  # Waiting for evidence
    H3_HOLD_CONFLICT = "H3_HOLD_CONFLICT"  # Conflicting signals
    H4_HOLD_ELICITATION = "H4_HOLD_ELICITATION"  # External client confirmation

    # SABAR substates (3)
    B1_SABAR_PATIENCE = "B1_SABAR_PATIENCE"  # Condition not yet met
    B2_SABAR_MATURITY = "B2_SABAR_MATURITY"  # Claim not yet mature
    B3_SABAR_COOLDOWN = "B3_SABAR_COOLDOWN"  # Entropy too high

    # VOID substates (2)
    V1_VOID_VIOLATION = "V1_VOID_VIOLATION"  # Constitutional violation
    V2_VOID_HALLUCINATION = "V2_VOID_HALLUCINATION"  # F9 ANTI-HANTU fired

    # UNKNOWN substate (1)
    U1_UNKNOWN_INSUFFICIENT = "U1_UNKNOWN_INSUFFICIENT"  # Cannot classify


class DeliveryVerdict(str, Enum):
    """Tool execution outcomes. NOT governance verdicts.

    A tool returning SUCCESS does NOT mean the action is SEAL'd.
    SEAL requires arifOS judgment. A tool returning BLOCKED does NOT
    mean VOID — it means HOLD until authority resolves it.
    """

    SUCCESS = "SUCCESS"  # Tool executed, result returned
    ERROR = "ERROR"  # Tool failed, error returned
    TIMEOUT = "TIMEOUT"  # Tool exceeded time limit
    BLOCKED = "BLOCKED"  # Tool blocked by policy/gate → maps to HOLD/VOID
    PENDING = "PENDING"  # Tool waiting for input → maps to HOLD_ELICITATION


# ── L↔F Mapping (MALU-GÖDEL ↔ Verdict Lattice) ─────────────────────────────


class MaluGodelState(str, Enum):
    """MALU-GÖDEL states — the epistemological classification."""

    LURUS = "LURUS"  # Claim aligns with reality (G ≥ threshold)
    SESAT = "SESAT"  # Claim diverges from reality (G < threshold)
    HALLUCINATIO = "HALLUCINATIO"  # Pure language, no physics anchor (G = 0)
    BIJAKSANA = "BIJAKSANA"  # Fully grounded, witnessed, proven (G = maximum)
    BANGANG = "BANGANG"  # Adaptation without precision (C_dark > 0)


# L↔F mapping table
MALU_GODEL_TO_VERDICT = {
    MaluGodelState.LURUS: VerdictType.PARTIAL,  # Ready for SEAL candidacy
    MaluGodelState.SESAT: VerdictType.HOLD,  # Needs refinement
    MaluGodelState.HALLUCINATIO: VerdictType.VOID,  # Void immediately
    MaluGodelState.BIJAKSANA: VerdictType.SEAL,  # Seal with witness
    MaluGodelState.BANGANG: VerdictType.SABAR,  # Cool down, re-approach
}


class ActionClass(str, Enum):
    """The four action classes for authority classification."""

    OBSERVE = "OBSERVE"
    EXECUTE_REVERSIBLE = "EXECUTE_REVERSIBLE"
    EXECUTE_IRREVERSIBLE = "EXECUTE_IRREVERSIBLE"
    EXTERNAL_SIDE_EFFECT = "EXTERNAL_SIDE_EFFECT"


class EpistemicLabel(str, Enum):
    """The four epistemic rungs. Monotonic promotion only."""

    OBS = "OBS"  # Observed — direct measurement. Cap 0.90.
    DER = "DER"  # Derived — computation. Cap 0.85.
    INT = "INT"  # Interpreted — pattern recognition. Cap 0.75.
    SPEC = "SPEC"  # Speculated — hypothesis. Cap 0.60.

    @property
    def confidence_cap(self) -> float:
        caps = {self.OBS: 0.90, self.DER: 0.85, self.INT: 0.75, self.SPEC: 0.60}
        return caps[self]

    def can_promote_to(self, target: "EpistemicLabel") -> bool:
        """Check if promotion is allowed (must go through intermediate rungs)."""
        order = [self.SPEC, self.INT, self.DER, self.OBS]
        return order.index(target) > order.index(self)


@dataclass
class CanonicalVerdict:
    """
    The unified verdict for all organs.

    Every organ (GEOX, WELL, WEALTH, arifOS, A-FORGE) produces verdicts
    of this type. No local verdict definitions. No duplicates.

    This is the J-Space bridge between Python and TypeScript.
    """

    verdict: VerdictType
    action_class: ActionClass
    epistemic: EpistemicLabel
    confidence: float
    organ: str  # which organ produced this
    tool: str  # which tool was invoked
    target: str  # what was acted upon
    intent: str  # why
    actor: str  # who requested
    session_id: Optional[str] = None
    lease_id: Optional[str] = None
    authority_token: Optional[str] = None
    violated_floors: list[str] = field(default_factory=list)
    evidence: list[dict] = field(default_factory=list)
    receipt_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    fingerprint: Optional[str] = None  # SHA-256 of this verdict

    def __post_init__(self):
        """Compute fingerprint after initialization."""
        if not self.fingerprint:
            self.fingerprint = self._compute_fingerprint()

    def _compute_fingerprint(self) -> str:
        """SHA-256 of canonical verdict content."""
        canonical = json.dumps(
            {
                "verdict": self.verdict.value,
                "action_class": self.action_class.value,
                "epistemic": self.epistemic.value,
                "organ": self.organ,
                "tool": self.tool,
                "target": self.target,
                "actor": self.actor,
                "timestamp": self.timestamp,
            },
            sort_keys=True,
        )
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]

    def is_terminal(self) -> bool:
        return self.verdict.is_terminal

    def can_transition_to(self, target: VerdictType) -> bool:
        return self.verdict.can_transition_to(target)

    def to_dict(self) -> dict:
        """Serialize for MCP transport or VAULT999 seal."""
        return {
            "verdict": self.verdict.value,
            "action_class": self.action_class.value,
            "epistemic": self.epistemic.value,
            "confidence": self.confidence,
            "organ": self.organ,
            "tool": self.tool,
            "target": self.target,
            "intent": self.intent,
            "actor": self.actor,
            "session_id": self.session_id,
            "lease_id": self.lease_id,
            "authority_token": self.authority_token,
            "violated_floors": self.violated_floors,
            "evidence": self.evidence,
            "receipt_id": self.receipt_id,
            "timestamp": self.timestamp,
            "fingerprint": self.fingerprint,
        }

    def to_mcp_content(self) -> list[dict]:
        """Format for MCP tool result."""
        return [{"type": "text", "text": json.dumps(self.to_dict(), indent=2)}]


# ── Factory functions for common verdict patterns ────────────────────────────


def seal(organ: str, tool: str, target: str, actor: str, **kwargs) -> CanonicalVerdict:
    """SEAL verdict — action is lawful, proceed."""
    return CanonicalVerdict(
        verdict=VerdictType.SEAL,
        action_class=kwargs.get("action_class", ActionClass.OBSERVE),
        epistemic=kwargs.get("epistemic", EpistemicLabel.OBS),
        confidence=kwargs.get("confidence", 0.90),
        organ=organ,
        tool=tool,
        target=target,
        actor=actor,
        **{
            k: v
            for k, v in kwargs.items()
            if k not in ("action_class", "epistemic", "confidence")
        },
    )


def hold(
    organ: str, tool: str, target: str, actor: str, reason: str, **kwargs
) -> CanonicalVerdict:
    """HOLD verdict — not yet authorized, wait."""
    return CanonicalVerdict(
        verdict=VerdictType.HOLD,
        action_class=kwargs.get("action_class", ActionClass.EXECUTE_REVERSIBLE),
        epistemic=kwargs.get("epistemic", EpistemicLabel.DER),
        confidence=kwargs.get("confidence", 0.80),
        organ=organ,
        tool=tool,
        target=target,
        actor=actor,
        intent=reason,
        **{
            k: v
            for k, v in kwargs.items()
            if k not in ("action_class", "epistemic", "confidence")
        },
    )


def sabar(
    organ: str, tool: str, target: str, actor: str, condition: str, **kwargs
) -> CanonicalVerdict:
    """SABAR verdict — patience, condition not yet met."""
    return CanonicalVerdict(
        verdict=VerdictType.SABAR,
        action_class=kwargs.get("action_class", ActionClass.OBSERVE),
        epistemic=kwargs.get("epistemic", EpistemicLabel.INT),
        confidence=kwargs.get("confidence", 0.70),
        organ=organ,
        tool=tool,
        target=target,
        actor=actor,
        intent=condition,
        **{
            k: v
            for k, v in kwargs.items()
            if k not in ("action_class", "epistemic", "confidence")
        },
    )


def void(
    organ: str, tool: str, target: str, actor: str, violations: list[str], **kwargs
) -> CanonicalVerdict:
    """VOID verdict — constitutionally prohibited."""
    return CanonicalVerdict(
        verdict=VerdictType.VOID,
        action_class=kwargs.get("action_class", ActionClass.EXECUTE_IRREVERSIBLE),
        epistemic=kwargs.get("epistemic", EpistemicLabel.OBS),
        confidence=0.0,
        organ=organ,
        tool=tool,
        target=target,
        actor=actor,
        violated_floors=violations,
        **{
            k: v
            for k, v in kwargs.items()
            if k not in ("action_class", "epistemic", "confidence")
        },
    )


# ── Monotonicity enforcement ────────────────────────────────────────────────


class VerdictChain:
    """
    Enforces verdict monotonicity for a sequence of verdicts.

    Usage:
        chain = VerdictChain()
        chain.append(verdict1)  # OK
        chain.append(verdict2)  # OK if monotonic
        chain.append(verdict3)  # Raises if violation
    """

    def __init__(self):
        self.chain: list[CanonicalVerdict] = []

    def append(self, verdict: CanonicalVerdict) -> bool:
        """Append verdict if monotonicity allows. Returns True if accepted."""
        if self.chain:
            last = self.chain[-1]
            if not last.can_transition_to(verdict.verdict):
                raise ValueError(
                    f"Verdict monotonicity violation: {last.verdict.value} → {verdict.verdict.value} "
                    f"(terminal verdicts cannot transition)"
                )
        self.chain.append(verdict)
        return True

    def last(self) -> Optional[CanonicalVerdict]:
        return self.chain[-1] if self.chain else None

    def is_sealed(self) -> bool:
        return any(v.verdict == VerdictType.SEAL for v in self.chain)

    def is_voided(self) -> bool:
        return any(v.verdict == VerdictType.VOID for v in self.chain)

    def to_dict(self) -> list[dict]:
        return [v.to_dict() for v in self.chain]
