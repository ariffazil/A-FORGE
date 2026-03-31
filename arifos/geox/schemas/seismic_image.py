"""
GEOX Seismic Image Schemas — Perception Layer v0.3.1
DITEMPA BUKAN DIBERI

Governed data models for seismic image interpretation (Plane 2).
Enforces Contrast Canon and Plane 2 Perception Bridge floors.
"""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from .geox_schemas import ProvenanceRecord


class GEOX_SEISMIC_IMAGE_INPUT(BaseModel):
    """Input for a single seismic image line."""
    image_path: str = Field(..., description="Path to the seismic image file (PNG, JPG, etc.)")
    line_id: str = Field(..., description="User-supplied identifier for the line")
    domain: Literal["time", "depth", "unknown"] = "unknown"
    polarity: Literal["normal", "reverse", "unknown"] = "unknown"
    vertical_exaggeration: Optional[float] = Field(default=None, description="Visual scale exaggerated factor")
    scale_known: bool = Field(default=False, description="Whether horizontal/vertical scale is verified")
    notes: Optional[str] = None
    provenance: ProvenanceRecord = Field(..., description="Mandatory audit trail for the input")


class GEOX_SEISMIC_VIEW(BaseModel):
    """A processed view of a seismic image (contrast-governed)."""
    view_id: str
    source_line_id: str
    processing_chain: List[str] = Field(..., description="List of filters applied (e.g. ['CLAHE', 'Sobel'])")
    display_params: dict[str, Any] = Field(default_factory=dict)
    image_ref: str | None = Field(default=None, description="Path to the generated view image")


class GEOX_FEATURE_SET(BaseModel):
    """Image-derived proxies (perceptual lineaments). NOT geological truth."""
    view_id: str
    lineaments: List[dict] = Field(default_factory=list, description="Extracted lines (x1, y1, x2, y2, strength)")
    discontinuities: List[dict] = Field(default_factory=list, description="Potential breaks in reflectors")
    dip_field: List[dict] = Field(default_factory=list, description="Local dip estimates from texture")
    continuity_map_ref: Optional[str] = None
    chaos_map_ref: Optional[str] = None


class GEOX_STRUCTURAL_CANDIDATE(BaseModel):
    """A potential structural interpretation candidate."""
    candidate_id: str
    family: Literal["normal_fault", "reverse_fault", "fold", "duplex", "stratigraphic", "flower", "other"]
    faults: List[dict] = Field(default_factory=list, description="Polylines representing fault planes")
    horizons: List[dict] = Field(default_factory=list, description="Polylines representing stratigraphy")
    support_views: List[str] = Field(default_factory=list, description="IDs of views where this is visible")
    geometry_score: float = Field(ge=0.0, le=1.0, description="Geometric consistency (length, spacing)")
    stability_score: float = Field(ge=0.0, le=1.0, description="Persistence across contrast views")
    geology_score: float = Field(ge=0.0, le=1.0, description="Compliance with geological rules")
    warnings: List[str] = Field(default_factory=list)


class GEOX_INTERPRETATION_RESULT(BaseModel):
    """Final governed interpretation result for a single seismic line."""
    line_id: str
    best_candidate_id: str
    alternatives: List[GEOX_STRUCTURAL_CANDIDATE]
    confidence: float = Field(ge=0.03, le=0.15, description="F7 Humility (Perception floor)")
    bias_audit: dict = Field(
        default_factory=lambda: {"display_sensitivity": "medium", "notes": []},
        description="Audit of how contrast/display affected the result"
    )
    missing_information: List[str] = Field(default_factory=list)
    summary: str = Field("", description="Human-readable synthesis (LLM generated)")
    verdict: Literal["PASS", "QUALIFY", "HOLD", "GEOX_BLOCK"] = "QUALIFY"
    telemetry: dict = Field(
        default_factory=dict,
        description="GEOX pipeline metadata (seal, version, floors)"
    )
