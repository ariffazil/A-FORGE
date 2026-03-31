"""
GEOX — Geospatial World-Model Agent for arifOS
DITEMPA BUKAN DIBERI

Theory of Anomalous Contrast (ToAC) — The Core Principle:

    Visual contrast is NOT physical reality.
    Every pixel you see has been transformed:
        Physical Signal → Processing → Display Encoding → Perception

    GEOX prevents conflation (confusion between visual and physical) by:
        1. Computing PHYSICAL attributes FIRST
        2. Documenting EVERY transform in the chain
        3. AUDITING for anomalous contrast (display >> physical)
        4. REQUIRING human review when risk is high

Architecture: THEORY → ENGINE → TOOLS → GOVERNANCE

    THEORY: ContrastTaxonomy, DataSource, VisualTransform, ProxyStrategy
    ENGINE: ContrastSpace, TransformRegistry, AnomalyDetector
    TOOLS: SeismicSingleLineTool, ContrastGovernedTool, VisualizationAuditor
    GOVERNANCE: FloorEnforcer, AuditLogger, VerdictRenderer

Bond et al. (2007) Anti-Bias:

    79% of expert geoscientists failed on simple synthetic seismic
    because conceptual bias dominated over data. GEOX fixes this by:
        - NEVER showing raw seismic to LLM first
        - Computing physical attributes BEFORE interpretation
        - Running explicit bias audit with historical failure rates
        - Documenting 3+ alternative interpretations
"""

__version__ = "0.4.0"
__author__ = "arifOS"

# THEORY Layer — Core principles
from .THEORY import (
    # Taxonomy
    ContrastTaxonomy,
    DataSource,
    VisualTransform,
    ProxyStrategy,
    # Verdicts
    ContrastVerdict,
    GeoxVerdict,
    # Factory
    create_seismic_taxonomy,
    # Functions
    assess_conflation_risk,
    check_floor_compliance,
    # Constants
    GEOX_SEAL,
    GEOX_SABAR,
    GEOX_PARTIAL,
    GEOX_REVIEW,
    GEOX_HOLD,
    GEOX_BLOCK,
    GEOX_VOID,
)

# ENGINE Layer — Processing core
from .ENGINE import (
    ContrastSpace,
    ContrastFeature,
    TransformRegistry,
    get_registry,
    AnomalyDetector,
    ConflationAlert,
)

# TOOLS Layer — Generic tools
from .TOOLS.generic import (
    ContrastGovernedTool,
    ToolResult,
    AttributePipeline,
    PipelineStage,
    VisualizationAuditor,
    VisualizationAuditResult,
)

# TOOLS Layer — Seismic tools
from .TOOLS.seismic import (
    SeismicSingleLineTool,
    SeismicAttributeCalculator,
    SeismicInterpretationProtocol,
    AttributeResult,
    InterpretationStep,
    InterpretationCheckpoint,
    compute_semblance,
    compute_dip_steered_coherence,
)

# GOVERNANCE Layer — Compliance
from .GOVERNANCE import (
    FloorEnforcer,
    FloorCheckResult,
    AuditLogger,
    AuditEntry,
    VerdictRenderer,
    RenderedVerdict,
    ConflationReport,
    generate_conflation_report,
)

__all__ = [
    # Version
    "__version__",
    
    # THEORY
    "ContrastTaxonomy",
    "DataSource",
    "VisualTransform",
    "ProxyStrategy",
    "ContrastVerdict",
    "GeoxVerdict",
    "create_seismic_taxonomy",
    "assess_conflation_risk",
    "check_floor_compliance",
    "GEOX_SEAL",
    "GEOX_SABAR",
    "GEOX_PARTIAL",
    "GEOX_REVIEW",
    "GEOX_HOLD",
    "GEOX_BLOCK",
    "GEOX_VOID",
    
    # ENGINE
    "ContrastSpace",
    "ContrastFeature",
    "TransformRegistry",
    "get_registry",
    "AnomalyDetector",
    "ConflationAlert",
    
    # TOOLS (Generic)
    "ContrastGovernedTool",
    "ToolResult",
    "AttributePipeline",
    "PipelineStage",
    "VisualizationAuditor",
    "VisualizationAuditResult",
    
    # TOOLS (Seismic)
    "SeismicSingleLineTool",
    "SeismicAttributeCalculator",
    "SeismicInterpretationProtocol",
    "AttributeResult",
    "InterpretationStep",
    "InterpretationCheckpoint",
    "compute_semblance",
    "compute_dip_steered_coherence",
    
    # GOVERNANCE
    "FloorEnforcer",
    "FloorCheckResult",
    "AuditLogger",
    "AuditEntry",
    "VerdictRenderer",
    "RenderedVerdict",
    "ConflationReport",
    "generate_conflation_report",
]


def get_geox_info() -> dict:
    """Get information about the GEOX installation."""
    return {
        "version": __version__,
        "theory": "Theory of Anomalous Contrast (ToAC)",
        "layers": ["THEORY", "ENGINE", "TOOLS", "GOVERNANCE"],
        "domains": ["seismic", "generic (extensible)"],
        "constitutional_floors": ["F1", "F4", "F7", "F9", "F13"],
    }
