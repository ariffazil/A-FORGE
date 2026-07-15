"""
FastMCP Prototype: GEOX Organ — Claim Lifecycle
================================================
Prototypes for GEOX geological claim management.
Hot-reload: fastmcp dev claim_lifecycle.py

Maps to production GEOX tools: geox_govern(mode=claim), geox_claim, geox_evidence.

DITEMPA BUKAN DIBERI — Prototype fast, harden later.
"""

from fastmcp import FastMCP, Context
import json
from datetime import datetime
from enum import Enum

server = FastMCP("geox-claim-proto")


class ClaimStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    CHALLENGED = "CHALLENGED"
    SEALED = "SEALED"
    VOIDED = "VOIDED"


class EpistemicLabel(str, Enum):
    OBS = "OBS"  # Observed
    DER = "DER"  # Derived
    INT = "INT"  # Interpreted
    SPEC = "SPEC"  # Speculated


@server.tool()
def geox_claim_create(
    basin: str,
    claim_text: str,
    evidence_for: str,
    evidence_against: str = "",
    epistemic: str = "INT",
    ctx: Context = None,
) -> str:
    """Create a geological claim with evidence_for and evidence_against.

    Args:
        basin: Basin name (e.g., "Malay Basin")
        claim_text: The geological claim being made
        evidence_for: Supporting evidence
        evidence_against: Contradicting evidence (empty if none)
        epistemic: Epistemic label (OBS/DER/INT/SPEC)

    Returns:
        Claim record with ID, status, and evidence structure.
    """
    claim_id = f"claim_{datetime.now().strftime('%Y%m%d%H%M%S')}_{basin.lower().replace(' ', '_')[:10]}"

    claim = {
        "claim_id": claim_id,
        "basin": basin,
        "claim": claim_text,
        "evidence": {
            "for": evidence_for,
            "against": evidence_against if evidence_against else "None provided",
        },
        "epistemic": epistemic,
        "confidence_cap": {"OBS": 0.90, "DER": 0.85, "INT": 0.75, "SPEC": 0.60}.get(
            epistemic, 0.60
        ),
        "status": ClaimStatus.DRAFT.value,
        "created_at": datetime.now().isoformat(),
        "created_by": "prototype",
        "challenge_count": 0,
        "seal_count": 0,
    }

    if ctx:
        ctx.info(f"Created claim {claim_id} for {basin}")

    return json.dumps(claim, indent=2)


@server.tool()
def geox_claim_validate(claim_id: str, ctx: Context = None) -> str:
    """Validate a claim — check evidence structure and epistemic label.

    Args:
        claim_id: The claim to validate

    Returns:
        Validation result with issues found.
    """
    # Prototype: simulate validation
    issues = []

    # Check claim ID format
    if not claim_id.startswith("claim_"):
        issues.append("Invalid claim ID format")

    # In production: check against GEOX knowledge graph
    # For prototype: always pass

    result = {
        "claim_id": claim_id,
        "validated": len(issues) == 0,
        "issues": issues,
        "next_status": ClaimStatus.VALIDATED.value
        if len(issues) == 0
        else ClaimStatus.DRAFT.value,
        "timestamp": datetime.now().isoformat(),
    }

    if ctx:
        ctx.info(f"Validated {claim_id}: {'PASS' if result['validated'] else 'FAIL'}")

    return json.dumps(result, indent=2)


@server.tool()
def geox_claim_challenge(
    claim_id: str,
    challenge_text: str,
    counter_evidence: str,
    ctx: Context = None,
) -> str:
    """Challenge an existing claim with counter-evidence.

    Args:
        claim_id: The claim to challenge
        challenge_text: Why the claim may be wrong
        counter_evidence: Evidence against the claim

    Returns:
        Challenge record.
    """
    challenge = {
        "claim_id": claim_id,
        "challenge": challenge_text,
        "counter_evidence": counter_evidence,
        "status": "CHALLENGED",
        "challenged_at": datetime.now().isoformat(),
        "effect": "Claim status promoted to CHALLENGED. Requires resolution before SEAL.",
    }

    if ctx:
        ctx.warning(f"Claim {claim_id} challenged: {challenge_text[:50]}...")

    return json.dumps(challenge, indent=2)


@server.tool()
def geox_claim_seal(claim_id: str, ctx: Context = None) -> str:
    """Seal a claim — makes it immutable. IRREVERSIBLE.

    Args:
        claim_id: The claim to seal

    Returns:
        Seal record with hash chain reference.
    """
    # Prototype: simulate sealing
    seal = {
        "claim_id": claim_id,
        "status": ClaimStatus.SEALED.value,
        "sealed_at": datetime.now().isoformat(),
        "irreversible": True,
        "vault_entry": f"vault999://claims/{claim_id}",
        "hash_chain_ref": f"seal_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "warning": "This claim is now immutable. No further modifications allowed.",
    }

    if ctx:
        ctx.info(f"Sealed claim {claim_id} — IRREVERSIBLE")

    return json.dumps(seal, indent=2)


@server.tool()
def geox_claim_list(basin: str = "", status: str = "", ctx: Context = None) -> str:
    """List claims, optionally filtered by basin or status.

    Args:
        basin: Filter by basin name (empty = all)
        status: Filter by status (empty = all)
    """
    # Prototype: return mock data
    claims = [
        {
            "claim_id": "claim_20260707_malay_001",
            "basin": "Malay Basin",
            "status": "SEALED",
            "epistemic": "OBS",
        },
        {
            "claim_id": "claim_20260707_sarawak_002",
            "basin": "Sarawak Basin",
            "status": "CHALLENGED",
            "epistemic": "INT",
        },
        {
            "claim_id": "claim_20260707_malay_003",
            "basin": "Malay Basin",
            "status": "DRAFT",
            "epistemic": "SPEC",
        },
    ]

    filtered = claims
    if basin:
        filtered = [c for c in filtered if basin.lower() in c["basin"].lower()]
    if status:
        filtered = [c for c in filtered if c["status"] == status.upper()]

    return json.dumps(
        {
            "claims": filtered,
            "total": len(filtered),
            "filters": {"basin": basin, "status": status},
        }
    )


if __name__ == "__main__":
    server.run()
