"""AForgePublish types — dataclasses shared across compiler + backends.

No imports from other aforge_publish modules to avoid circular deps.

A-FORGE DECOUPLING PRINCIPLE (bound 2026-07-21):
    The membrane between J-space (raw signal) and G-space (physics-verified truth)
    is enforced structurally through types. EncoderInput accepts anything.
    MetabolizerOutput requires every Kill Matrix gate to pass and keeps
    confidence inside the constitutional 0.80-0.90 band.
    DecoderPayload ONLY accepts MetabolizerOutput — the compiler physically
    cannot render unverified claims.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EpistemicLabel(str, Enum):
    """F2 TRUTH epistemic taxonomy. Every figure element carries one."""

    OBS = "[OBS]"  # Observed: hard measurements, direct evidence
    DER = "[DER]"  # Derived: computed, kriged, calculated
    INT = "[INT]"  # Interpreted: structural picks, horizon ties, classifications
    SPEC = "[SPEC]"  # Speculative: extrapolated, uncalibrated, legacy polygon


class KillMatrixVerdict(str, Enum):
    """K001-K007 gate — every MetabolizerOutput must carry one."""

    PASS = "PASS"  # All 7 layers cleared
    FAIL_PHYSICS = "K_FAIL"  # Physical plausibility violation
    FAIL_STRAT = "K_STRAT"  # Stratigraphic consistency violation
    FAIL_THERMAL = "K_THERM"  # Geothermal gradient bounds violation
    FAIL_BURIAL = "K_BURIAL"  # Burial compaction violation
    FAIL_PRESSURE = "K_PRESS"  # Pore pressure bounds violation
    FAIL_LOGICAL = "K_LOGIC"  # Logical contradiction detected
    FAIL_EVIDENCE = "K_EVID"  # Insufficient evidence
    NOT_TESTED = "K_UNTESTED"  # Kill Matrix not yet run


@dataclass
class FigureSpec:
    """One figure in the artifact. type selects backend-specific rendering."""

    figure_id: str
    title: str
    type: str  # "map" | "section" | "chart" | "table" | "equation" | "residual"
    epistemic: list[EpistemicLabel]
    source_uris: list[str] = field(default_factory=list)
    data_payload: dict[str, Any] = field(default_factory=dict)
    uncertainty_band: dict[str, Any] | None = None
    caption: str = ""


@dataclass
class ArtifactManifest:
    """Top-level artifact spec — what to render, with what data, by whom."""

    artifact_id: str
    title: str
    subject: str
    sovereign: str
    actor_id: str
    session_id: str
    intent: str
    backend: str  # "typst" | "reportlab" | "weasyprint"
    pages: str = "A4"
    tier: str = "AAA"
    epistemic_summary: dict[str, int] = field(default_factory=dict)
    figures: list[FigureSpec] = field(default_factory=list)
    body_blocks: list[dict[str, Any]] = field(default_factory=list)
    falsification_refs: list[dict[str, Any]] = field(default_factory=list)
    organ_evidence_refs: list[dict[str, Any]] = field(default_factory=list)
    delivery: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# EMD MEMBRANE TYPES — structural firewall between J-space and G-space
# Forged 2026-07-21 under F13 SOVEREIGN AXIOM
# ---------------------------------------------------------------------------


@dataclass
class EncoderInput:
    """E-stage: raw J-space signal. Unstructured, unverified, messy.

    Accepts anything — PDFs, EMAG2v3 grids, prompt instructions, legacy
    polygons. No type constraints. This is the intake hopper.
    """

    source: str  # URI, file path, or "prompt"
    content_type: str  # "pdf" | "csv" | "geotiff" | "text" | "json"
    raw_payload: Any  # bytes, string, dict — anything
    ingested_at: str = ""  # ISO timestamp
    provenance_note: str = ""  # "legacy polygon from v3", etc.


@dataclass
class KillMatrixResult:
    """Structured K001-K007 gate output. Required by MetabolizerOutput."""

    cleared: bool  # True if all 7 gates PASS
    overall_verdict: KillMatrixVerdict
    gates: dict[str, bool] = field(default_factory=dict)
    # {
    #   "K001_physics": True,
    #   "K002_strat": True,
    #   "K003_thermal": True,
    #   "K004_burial": True,
    #   "K005_pressure": True,
    #   "K006_logic": True,
    #   "K007_evidence": True,
    # }
    failure_details: dict[str, str] = field(default_factory=dict)
    mahalanobis_z: float | None = None  # Mahalanobis distance from prior
    uncertainty_omega_0: float = 0.03  # Ω₀ — residual uncertainty floor

    REQUIRED_GATES = frozenset(
        {
            "K001_physics",
            "K002_strat",
            "K003_thermal",
            "K004_burial",
            "K005_pressure",
            "K006_logic",
            "K007_evidence",
        }
    )

    def __post_init__(self) -> None:
        missing = self.REQUIRED_GATES.difference(self.gates)
        failed = {name for name, passed in self.gates.items() if passed is not True}
        if self.cleared and (
            self.overall_verdict is not KillMatrixVerdict.PASS or missing or failed
        ):
            raise ValueError(
                "cleared Kill Matrix requires PASS plus all K001-K007 gates=True; "
                f"missing={sorted(missing)}, failed={sorted(failed)}"
            )


@dataclass
class MetabolizerOutput:
    """M-stage: G-space truth. Physics-verified, Kill Matrix cleared.

    This is the FIREWALL. DecoderPayload CANNOT be constructed without
    a MetabolizerOutput where every Kill Matrix gate passed and the confidence
    score is bounded by F7 HUMILITY.

    INVARIANT: kill_matrix.cleared AND 0.80 <= confidence_score <= 0.90
               OR this object is structurally invalid.
    """

    kill_matrix: KillMatrixResult
    confidence_score: float
    epistemic_labels: dict[str, list[EpistemicLabel]]
    # {"figure_id": [OBS, DER], ...}
    spatial_bounds: dict[str, Any] = field(default_factory=dict)
    # {"geometry_type": "polygon", "crs": "EPSG:4326", "bbox": [...], ...}
    computed_primitives: dict[str, Any] = field(default_factory=dict)
    # {"mahalanobis_z": 2.1, "volumes": {...}, "gradients": {...}, ...}
    evidence_refs: list[str] = field(default_factory=list)
    # ["geox://evidence/001", "well://state/abc", ...]
    falsification_trace: list[dict[str, Any]] = field(default_factory=list)
    # [{"gate": "K001", "result": "PASS", "detail": "..."}, ...]

    def __post_init__(self):
        """Structural invariant — raises ValueError if membrane violated."""
        if not self.kill_matrix.cleared:
            raise ValueError(
                f"MetabolizerOutput requires kill_matrix.cleared=True. "
                f"Got verdict: {self.kill_matrix.overall_verdict.value}"
            )
        if not 0.80 <= self.confidence_score <= 0.90:
            raise ValueError(
                "MetabolizerOutput requires 0.80 <= confidence_score <= 0.90. "
                f"Got: {self.confidence_score}"
            )

    @property
    def is_g_space_verified(self) -> bool:
        """True if both invariants hold (always True if constructed)."""
        return self.kill_matrix.cleared and 0.80 <= self.confidence_score <= 0.90

    @property
    def uncertainty_band(self) -> str:
        """Human-readable uncertainty band derived from Ω₀."""
        omega = self.kill_matrix.uncertainty_omega_0
        if omega <= 0.03:
            return "Tight (±3%)"
        elif omega <= 0.05:
            return "Moderate (±5%)"
        elif omega <= 0.10:
            return "Wide (±10%)"
        return "Uncalibrated"


@dataclass
class DecoderPayload:
    """D-stage: G-space → human resonance. Presentation-ready artifact input.

    ACCEPTS ONLY MetabolizerOutput. This is enforced at the type level —
    the compiler physically cannot construct a DecoderPayload from raw
    EncoderInput or any unverified data.

    The voice_translator and filters run on this payload before render.
    """

    metabolizer_output: MetabolizerOutput
    artifact_manifest: ArtifactManifest
    voice_profile: str = (
        "senior_geoscientist"  # "senior_geoscientist" | "executive" | "technical"
    )
    target_audience: str = "peer_review"  # "peer_review" | "board" | "regulator"
    rendered_figures: list[dict[str, Any]] = field(default_factory=list)
    body_text: str = ""  # Translated, resonance-checked prose
    delivery_telegram: bool = True
    delivery_outbox: bool = True
