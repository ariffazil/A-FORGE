"""
GEOX Seismic Contrast Views — v0.3.1
DITEMPA BUKAN DIBERI

Implements the Contrast Canon by generating multiple contrast/display views.
Exposes "display-induced bias" (Bond et al. 2007).
"""

from __future__ import annotations
from typing import List
from ..schemas.seismic_image import GEOX_SEISMIC_VIEW

async def generate_contrast_views(normalized_data: dict) -> List[GEOX_SEISMIC_VIEW]:
    """Generate 4-6 processed views of the seismic image."""
    line_id = normalized_data["metadata"]["line_id"]
    
    # 1. Linear grayscale
    # 2. CLAHE (Adaptive Histogram Equalization)
    # 3. Sobel Edge / Gradient Magnitude
    # 4. Inverted grayscale
    # 5. Gamma-adjusted (0.8 and 1.2)
    
    views = [
        GEOX_SEISMIC_VIEW(
            view_id="v1_linear",
            source_line_id=line_id,
            processing_chain=["grayscale"],
            display_params={"contrast_mode": "linear"}
        ),
        GEOX_SEISMIC_VIEW(
            view_id="v2_clahe",
            source_line_id=line_id,
            processing_chain=["CLAHE"],
            display_params={"clip_limit": 2.0}
        ),
        GEOX_SEISMIC_VIEW(
            view_id="v3_sobel",
            source_line_id=line_id,
            processing_chain=["sobel_gradient"],
            display_params={"edge_magnitude": True}
        ),
        GEOX_SEISMIC_VIEW(
            view_id="v4_inverted",
            source_line_id=line_id,
            processing_chain=["inverted"],
            display_params={"contrast_mode": "inverted"}
        )
    ]
    
    return views
