"""
agent_clarity_gate — Pydantic schema for clarity contract validation.

DRAFT — pending sovereign ratification. Validation only, not enforcement.
Reference: /root/VAULT999/inbox/CLARITY-CANON-DRAFT-2026-07-08/DOCTRINE.md §3 + §9
"""
from __future__ import annotations
from enum import Enum
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class EvidenceLayer(str, Enum):
    L1 = "L1"   # sealed ground truth
    L2 = "L2"   # live verified state
    L3 = "L3"   # cached state
    L4 = "L4"   # inference only


class AuthorityBand(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED = "RED"
    BLACK = "BLACK"


class Reversibility(str, Enum):
    FULL = "FULL"
    PARTIAL = "PARTIAL"
    LOW = "LOW"
    IRREVERSIBLE = "IRREVERSIBLE"


class BlastRadius(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RouteOwner(str, Enum):
    AAA = "AAA"
    ARIFOS = "arifOS"
    A_FORGE = "A-FORGE"
    GEOX = "GEOX"
    WEALTH = "WEALTH"
    WELL = "WELL"
    VAULT999 = "VAULT999"
    ARIF = "ARIF"   # F13 sovereign


class Verdict(str, Enum):
    PROCEED = "PROCEED"
    HOLD = "HOLD"
    VOID = "VOID"
    DRAFT_ONLY = "DRAFT_ONLY"


class ClarityContract(BaseModel):
    """Minimum contract for any agent action."""
    actor: str
    session_id: str
    intent: str
    evidence_layer: EvidenceLayer
    timestamp: datetime
    authority_band: AuthorityBand
    reversibility: Reversibility
    route_owner: RouteOwner
    proposed_action: str
    expected_receipt: str
    stop_condition: str

    # Optional but recommended
    success_criteria: Optional[str] = None
    contradiction_check: Optional[str] = None
    receipt_plan: Optional[List[str]] = None

    @field_validator("actor")
    @classmethod
    def actor_not_empty(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("actor is required (F10/F11)")
        return v

    @field_validator("intent")
    @classmethod
    def intent_not_empty(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("intent is required (chaos source #1: intent fog)")
        return v


class ClarityGateResult(BaseModel):
    """Result of clarity gate evaluation."""
    contract: ClarityContract
    verdict: Verdict
    hard_blocks: List[str] = Field(default_factory=list)
    chaos_sources_flagged: List[int] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


def evaluate_gate(contract: ClarityContract) -> ClarityGateResult:
    """
    Evaluate a clarity contract against hard-blocks.
    DRAFT: validation only. Does NOT enforce — just surfaces gaps.
    """
    hard_blocks: List[str] = []
    chaos_flagged: List[int] = []

    # F11 / identity fog
    if not contract.actor or contract.actor == "unknown":
        hard_blocks.append("missing_actor")
        chaos_flagged.append(10)  # agent identity fog

    if not contract.session_id:
        hard_blocks.append("missing_session")
        chaos_flagged.append(10)

    # F2 / evidence fog
    if contract.evidence_layer == EvidenceLayer.L4 and contract.reversibility != Reversibility.FULL:
        hard_blocks.append("L4_cannot_command_non_FULL_action")
        chaos_flagged.append(2)

    # F1 / reversibility fog
    if contract.reversibility == Reversibility.IRREVERSIBLE and contract.authority_band not in (AuthorityBand.RED, AuthorityBand.BLACK):
        hard_blocks.append("mutation_without_authority_for_irreversible")
        chaos_flagged.append(7)

    # F13 / authority fog
    if contract.reversibility == Reversibility.IRREVERSIBLE and contract.route_owner != RouteOwner.ARIF:
        hard_blocks.append("irreversible_requires_ARIF_route")
        chaos_flagged.append(3)

    # Seal fog — propose_action contains SEAL but route_owner != VAULT999
    if "seal" in contract.proposed_action.lower() and contract.route_owner not in (RouteOwner.VAULT999, RouteOwner.ARIFOS):
        hard_blocks.append("seal_without_vault999")
        chaos_flagged.append(6)

    # Time fog
    if contract.timestamp > datetime.utcnow():
        hard_blocks.append("timestamp_in_future")
        chaos_flagged.append(5)

    # Verdict logic
    if hard_blocks:
        verdict = Verdict.VOID if any("IRREVERSIBLE" in b or "without_authority" in b or "without_vault999" in b for b in hard_blocks) else Verdict.HOLD
    elif contract.evidence_layer == EvidenceLayer.L4:
        verdict = Verdict.DRAFT_ONLY
    else:
        verdict = Verdict.PROCEED

    return ClarityGateResult(
        contract=contract,
        verdict=verdict,
        hard_blocks=hard_blocks,
        chaos_sources_flagged=sorted(set(chaos_flagged)),
        notes=[f"chaos sources flagged: {sorted(set(chaos_flagged))}"] if chaos_flagged else [],
    )


if __name__ == "__main__":
    # Self-test
    sample = ClarityContract(
        actor="FORGE",
        session_id="test-session-001",
        intent="validate clarity gate schema",
        evidence_layer=EvidenceLayer.L4,
        timestamp=datetime.utcnow(),
        authority_band=AuthorityBand.YELLOW,
        reversibility=Reversibility.FULL,
        route_owner=RouteOwner.A_FORGE,
        proposed_action="dry-run gate evaluation",
        expected_receipt="gate result JSON",
        stop_condition="any hard_block",
    )
    result = evaluate_gate(sample)
    print(result.model_dump_json(indent=2))
