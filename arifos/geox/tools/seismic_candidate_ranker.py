"""
GEOX Seismic Candidate Ranker — v0.3.1
DITEMPA BUKAN DIBERI

Ranks structural interpretative candidates based on geometric consistency
and stability across contrast views (Contrast Canon stability score).
"""

from __future__ import annotations
from typing import List
from ..schemas.seismic_image import GEOX_FEATURE_SET, GEOX_STRUCTURAL_CANDIDATE

async def rank_structural_candidates(feature_sets: List[GEOX_FEATURE_SET]) -> List[GEOX_STRUCTURAL_CANDIDATE]:
    """Generate and rank structural candidates from image proxies."""
    
    # 1. Cluster features into potential structural families (extensional, compressional, etc.)
    # 2. Score geometric consistency (do the features form a valid fold? a fault plane?)
    # 3. Score stability: how many feature_sets (views) support this candidate?
    
    # Example mock candidates
    candidates = [
        GEOX_STRUCTURAL_CANDIDATE(
            candidate_id="inv_model_1",
            family="reverse_fault",
            faults=[{"polyline": [(10, 10), (100, 100)], "throw": 50}],
            horizons=[{"polyline": [(0, 100), (200, 100)]}],
            support_views=["v1_linear", "v2_clahe", "v4_inverted"],
            geometry_score=0.85,
            stability_score=0.90,  # persistence across views
            geology_score=0.75,
            warnings=["No out-of-plane data"]
        ),
        GEOX_STRUCTURAL_CANDIDATE(
            candidate_id="ext_model_2",
            family="normal_fault",
            faults=[{"polyline": [(10, 100), (100, 10)], "throw": 30}],
            horizons=[{"polyline": [(0, 50), (200, 50)]}],
            support_views=["v3_sobel"],
            geometry_score=0.60,
            stability_score=0.25,  # only seen in edge-enhanced view
            geology_score=0.40,
            warnings=["Weak feature stability across contrast views"]
        )
    ]
    
    return candidates
