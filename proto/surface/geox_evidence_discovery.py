"""
FastMCP Prototype: GEOX Organ — Evidence Discovery
===================================================
Prototypes for GEOX evidence synthesis and contradiction detection.
Hot-reload: fastmcp dev evidence_discovery.py

Maps to production: geox_evidence(mode=synthesize/contradict), geox_compute, geox_interpret.

DITEMPA BUKAN DIBERI — Evidence is forged, not assumed.
"""

from fastmcp import FastMCP, Context
import json
from datetime import datetime

server = FastMCP("geox-evidence-proto")


@server.tool()
def geox_evidence_synthesize(
    query: str,
    basin: str = "",
    scale: str = "parasequence",
    ctx: Context = None,
) -> str:
    """Synthesize evidence from multiple GEOX data sources.

    Args:
        query: What evidence to look for (e.g., "reservoir presence", "source rock maturity")
        basin: Basin to search in
        scale: Geological scale (parasequence, sequence, basin)

    Returns:
        Synthesized evidence with epistemic labels.
    """
    if ctx:
        ctx.info(f"Synthesizing evidence: {query} (basin={basin}, scale={scale})")

    # Prototype: structured evidence synthesis
    evidence = {
        "query": query,
        "basin": basin or "All basins",
        "scale": scale,
        "sources": [
            {
                "source": "well_log",
                "data": f"Well log analysis for {query}",
                "epistemic": "OBS",
                "confidence": 0.88,
                "location": {"lat": 5.5, "lon": 105.0},
            },
            {
                "source": "seismic",
                "data": f"Seismic interpretation for {query}",
                "epistemic": "INT",
                "confidence": 0.72,
                "location": {"lat": 5.5, "lon": 105.0},
            },
            {
                "source": "literature",
                "data": f"Published studies on {query}",
                "epistemic": "DER",
                "confidence": 0.80,
            },
        ],
        "synthesis": {
            "convergent": True,
            "epistemic": "DER",
            "confidence": 0.82,
            "note": "Multiple sources converge on this evidence.",
        },
        "timestamp": datetime.now().isoformat(),
    }

    return json.dumps(evidence, indent=2)


@server.tool()
def geox_evidence_contradict(
    claim_id: str,
    evidence_refs: str = "",
    ctx: Context = None,
) -> str:
    """Detect contradictions in evidence for a claim.

    Args:
        claim_id: The claim to check for contradictions
        evidence_refs: Comma-separated evidence IDs to compare

    Returns:
        Contradiction report with conflicting evidence.
    """
    if ctx:
        ctx.warning(f"Checking contradictions for {claim_id}")

    # Prototype: simulate contradiction detection
    report = {
        "claim_id": claim_id,
        "contradictions_found": True,
        "contradictions": [
            {
                "evidence_a": {
                    "source": "well_log",
                    "epistemic": "OBS",
                    "confidence": 0.88,
                },
                "evidence_b": {
                    "source": "seismic",
                    "epistemic": "INT",
                    "confidence": 0.72,
                },
                "conflict": "Well log shows 15m sand, seismic suggests 8m. Possible tuning effect.",
                "resolution": "Require checkshot/VSP for time-depth conversion.",
                "severity": "MEDIUM",
            }
        ],
        "recommendation": "Do not SEAL until contradiction resolved. Promote to CHALLENGED.",
        "timestamp": datetime.now().isoformat(),
    }

    return json.dumps(report, indent=2)


@server.tool()
def geox_prospect_evaluate(
    prospect_name: str,
    basin: str,
    p10: float,
    p50: float,
    p90: float,
    chance_of_success: float,
    well_cost_musd: float,
    ctx: Context = None,
) -> str:
    """Evaluate a petroleum prospect — volumetrics, POS, EVOI.

    Args:
        prospect_name: Name of the prospect
        basin: Basin location
        p10: P10 recoverable volume (MMbbl)
        p50: P50 recoverable volume (MMbbl)
        p90: P90 recoverable volume (MMbbl)
        chance_of_success: Probability of success (0-1)
        well_cost_musd: Exploration well cost (MUSD)

    Returns:
        Prospect evaluation with EMV, EVOI, and risk metrics.
    """
    if ctx:
        ctx.info(f"Evaluating prospect {prospect_name} in {basin}")

    # Simple EMV calculation
    # EMV = COS × P50_value - (1-COS) × well_cost
    oil_price = 80  # USD/bbl
    p50_value = p50 * oil_price * 1e6 / 1e6  # MUSD
    emv = chance_of_success * p50_value - (1 - chance_of_success) * well_cost_musd

    # EVOI (simplified)
    # EVOI = value of perfect information
    evoi = (p10 - p90) * oil_price * chance_of_success * 0.1  # simplified

    evaluation = {
        "prospect": prospect_name,
        "basin": basin,
        "volumetrics": {
            "p10_mbbl": p10,
            "p50_mbbl": p50,
            "p90_mbbl": p90,
            "spread": p10 - p90,
        },
        "economics": {
            "oil_price_usd": oil_price,
            "well_cost_musd": well_cost_musd,
            "p50_value_musd": round(p50_value, 1),
            "emv_musd": round(emv, 1),
            "evoi_musd": round(evoi, 1),
        },
        "risk": {
            "chance_of_success": chance_of_success,
            "chance_of_failure": round(1 - chance_of_success, 2),
            "breakeven_cos": round(well_cost_musd / p50_value, 3)
            if p50_value > 0
            else None,
        },
        "verdict": {
            "action": "DRILL" if emv > 0 else "DO_NOT_DRILL",
            "confidence": "DER",
            "note": f"EMV = ${emv:.1f}M. {'Positive' if emv > 0 else 'Negative'} expected value.",
        },
        "timestamp": datetime.now().isoformat(),
    }

    return json.dumps(evaluation, indent=2)


if __name__ == "__main__":
    server.run()
