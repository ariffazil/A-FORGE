"""AForgePublish — Tier 3 compiler sidecar (Python package)."""

from .compiler import AForgePublishCompiler
from .types import (
    ArtifactManifest,
    DecoderPayload,
    EncoderInput,
    FigureSpec,
    EpistemicLabel,
    KillMatrixResult,
    KillMatrixVerdict,
    MetabolizerOutput,
)

__all__ = [
    "AForgePublishCompiler",
    "ArtifactManifest",
    "FigureSpec",
    "EpistemicLabel",
    "DecoderPayload",
    "EncoderInput",
    "KillMatrixResult",
    "KillMatrixVerdict",
    "MetabolizerOutput",
]
__version__ = "1.0.0"
