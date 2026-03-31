"""
GEOX Single-Line Image Interpreter — Phase 2 Perception v0.3.1
DITEMPA BUKAN DIBERI

Orchestrator for image-only seismic interpretation.
Enforces Contrast Canon strictly: LLM sees only the final governed JSON,
never the raw image (to avoid conceptual hallucination).

References:
  Bond et al. (2007): "What do you think this is? 'Conceptual bias' in 
  geoscientific interpretation"
"""

from __future__ import annotations

from typing import List

from .contrast_wrapper import contrast_governed_tool
from ..schemas.seismic_image import (
    GEOX_FEATURE_SET,
    GEOX_INTERPRETATION_RESULT,
    GEOX_SEISMIC_IMAGE_INPUT,
    GEOX_SEISMIC_VIEW,
)
from .seismic_candidate_ranker import rank_structural_candidates
from .seismic_contrast_views import generate_contrast_views
from .seismic_feature_extract import extract_image_features
from .seismic_image_ingest import ingest_seismic_image
from .seismic_structure_rules import apply_geological_rules


@contrast_governed_tool(
    physical_axes=["perceptual_lineaments", "structural_geometry"],
    is_meta_attribute=True,  # orchestrator involves complex logic
)
async def geox_interpret_single_line(inputs: dict) -> GEOX_INTERPRETATION_RESULT:
    """
    GEOX single-line image interpreter orchestrator.
    
    Implements a 6-stage governed interpretation pipeline.
    """
    # Stage 1: Ingest + normalize
    image_input = GEOX_SEISMIC_IMAGE_INPUT.model_validate(inputs)
    normalized = await ingest_seismic_image(image_input)

    # Stage 2: Contrast Canon views (exposes display bias)
    views: List[GEOX_SEISMIC_VIEW] = await generate_contrast_views(normalized)

    # Stage 3: Vision attributes (proxies only)
    feature_sets: List[GEOX_FEATURE_SET] = []
    for view in views:
        features = await extract_image_features(view)
        feature_sets.append(features)

    # Stage 4 + 5: Candidates + geological rule engine
    candidates = await rank_structural_candidates(feature_sets)
    validated_candidates = await apply_geological_rules(candidates, image_input)

    if not validated_candidates:
        # Fallback if no candidates found
        return GEOX_INTERPRETATION_RESULT(
            line_id=image_input.line_id,
            best_candidate_id="none",
            alternatives=[],
            confidence=0.03,
            summary="No structural candidates identified with sufficient confidence.",
            verdict="HOLD"
        )

    # Stage 6: Synthesis (LLM writes summary only after this)
    best = max(
        validated_candidates, 
        key=lambda c: c.geometry_score * c.stability_score * c.geology_score
    )
    
    result = GEOX_INTERPRETATION_RESULT(
        line_id=image_input.line_id,
        best_candidate_id=best.candidate_id,
        alternatives=validated_candidates,
        confidence=0.11,  # default F7 range
        bias_audit={
            "display_sensitivity": "high" if len(validated_candidates) > 3 else "medium",
            "notes": [
                f"Candidate persistence: seen in {len(best.support_views)}/{len(views)} contrast views",
                (
                    "Bond et al. (2007) shows 79 % of experts mis-interpreted similar "
                    "synthetic data due to conceptual bias. GEOX enforces stability "
                    "check to mitigate this."
                )
            ]
        },
        missing_information=[
            "No trace data → these are image proxies only",
            "No well ties or velocity model",
            "2D only — out-of-plane effects likely",
            "Stratigraphic vs structural ambiguity high in single line"
        ],
        summary="",  # LLM to fill this later based on result JSON
        telemetry={
            "agent": "@GEOX",
            "version": "0.3.1-single-line-image",
            "pipeline": "222_REFLECT",
            "floors": ["F1", "F4", "F7", "F9"],
            "seal": "DITEMPA BUKAN DIBERI",
            "contrast_canon": True,
            "orchestrated": True
        }
    )

    return result
