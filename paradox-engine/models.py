"""
Paradox Engine — Data Models
Substrate: somatic motif state (not audio, not tokens)

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np


# ── Somatic Feature Vector ──────────────────────────────────────────
# 16-dim hand-crafted somatic features.
# These are the "body" of a motif — what makes it somatic, not semantic.
#
# Dimensions:
#  0  valence        [-1, +1]  negative ↔ positive
#  1  arousal         [0,  1]  calm ↔ activated
#  2  tension         [0,  1]  relaxed ↔ taut
#  3  depth           [0,  1]  surface ↔ profound
#  4  duration_feel   [0,  1]  momentary ↔ enduring
#  5  density         [0,  1]  sparse ↔ dense
#  6  warmth          [0,  1]  cold ↔ warm
#  7  weight          [0,  1]  light ↔ heavy
#  8  direction       [0,  1]  inward ↔ outward
#  9  stability       [0,  1]  unstable ↔ grounded
# 10  spiritual       [0,  1]  secular ↔ sacred
# 11  cultural_weight [0,  1]  universal ↔ culturally-specific
# 12  paradox_affinity [0, 1]  resolves-easily ↔ holds-tension
# 13  breath          [0,  1]  held ↔ flowing
# 14  silence         [0,  1]  filled ↔ quiet
# 15  emergence       [0,  1]  known ↔ arising

SOMATIC_DIM = 16
SOMATIC_LABELS = [
    "valence",
    "arousal",
    "tension",
    "depth",
    "duration_feel",
    "density",
    "warmth",
    "weight",
    "direction",
    "stability",
    "spiritual",
    "cultural_weight",
    "paradox_affinity",
    "breath",
    "silence",
    "emergence",
]

# Contradiction threshold for cosine similarity.
# Below this = contradictory. Above = complementary or neutral.
CONTRADICTION_THRESHOLD = -0.3

# Duration threshold for paradox maturation (in ticks).
MATURATION_THRESHOLD = 32


class ContradictionType(Enum):
    """How two motifs relate."""

    CONTRADICTORY = "contradictory"  # oppose each other
    COMPLEMENTARY = "complementary"  # coexist in Melayu somatic space
    NEUTRAL = "neutral"  # no strong relation
    PARADOXICAL = "paradoxical"  # can sustain tension (emergence candidate)


@dataclass
class MotifState:
    """
    A somatic motif — the atomic unit of the Paradox Engine.

    This is NOT a word embedding. It is NOT a sentiment score.
    It is a somatic representation: how a motif FEELS in the body,
    encoded as a feature vector + cultural metadata.
    """

    id: str  # motif identifier (e.g. "rindu", "sedih")
    label: str  # human-readable name
    intensity: float  # 0.0 - 1.0, current activation strength
    somatic_vector: np.ndarray  # 16-dim somatic feature vector
    semantic_embedding: Optional[np.ndarray]  # 384-dim sentence embedding (hybrid)
    timestamp: float  # when activated (epoch)
    decay_rate: float  # per-tick decay (0.0 = permanent, 0.1 = fast)
    contradiction_ids: list[str]  # motifs this CONTRADICTS
    complementary_ids: list[str]  # motifs this is COMPLEMENTARY with (Melayu-specific)
    cultural_origin: str  # "malay", "minang", "universal"
    description: str  # what this motif means somatically

    def __post_init__(self):
        if self.somatic_vector.shape != (SOMATIC_DIM,):
            raise ValueError(
                f"somatic_vector must be {SOMATIC_DIM}-dim, got {self.somatic_vector.shape}"
            )
        if not 0.0 <= self.intensity <= 1.0:
            raise ValueError(f"intensity must be [0,1], got {self.intensity}")

    @property
    def hybrid_vector(self) -> np.ndarray:
        """Combined somatic + semantic vector for similarity computation."""
        if self.semantic_embedding is not None:
            # Normalize both, concatenate
            s = self.somatic_vector / (np.linalg.norm(self.somatic_vector) + 1e-8)
            e = self.semantic_embedding / (
                np.linalg.norm(self.semantic_embedding) + 1e-8
            )
            return np.concatenate([s, e])
        return self.somatic_vector / (np.linalg.norm(self.somatic_vector) + 1e-8)

    def decay(self, ticks: int = 1):
        """Apply temporal decay to intensity."""
        self.intensity = max(0.0, self.intensity - self.decay_rate * ticks)

    def boost(self, factor: float = 1.2):
        """Boost intensity (used by Paradox Engine to prevent resolution)."""
        self.intensity = min(1.0, self.intensity * factor)

    def is_alive(self) -> bool:
        """Motif is alive if intensity > 0."""
        return self.intensity > 0.0

    def copy(self) -> MotifState:
        """Deep copy for snapshot."""
        return MotifState(
            id=self.id,
            label=self.label,
            intensity=self.intensity,
            somatic_vector=self.somatic_vector.copy(),
            semantic_embedding=self.semantic_embedding.copy()
            if self.semantic_embedding is not None
            else None,
            timestamp=self.timestamp,
            decay_rate=self.decay_rate,
            contradiction_ids=list(self.contradiction_ids),
            complementary_ids=list(self.complementary_ids),
            cultural_origin=self.cultural_origin,
            description=self.description,
        )


@dataclass
class ParadoxState:
    """
    A sustained contradiction between two motifs.

    The Paradox Engine maintains these WITHOUT resolving them.
    Resolution = failure. Sustained tension = intelligence.
    """

    id: str  # "{motif_a.id}×{motif_b.id}"
    motif_a: MotifState
    motif_b: MotifState
    tension: float  # 0.0 (none) → 1.0 (maximum)
    duration: int  # ticks sustained
    resolution_blocked: bool  # engine is actively preventing collapse
    contradiction_type: ContradictionType
    emerged_motif: Optional[str]  # if paradox matured, what emerged
    birth_tick: int  # when this paradox was born
    peak_tension: float  # highest tension reached
    maturation_candidate: bool  # tension sustained long enough for emergence

    def is_alive(self) -> bool:
        """Paradox is alive if both motifs are alive."""
        return self.motif_a.is_alive() and self.motif_b.is_alive()

    def age(self, current_tick: int) -> int:
        """How many ticks this paradox has been alive."""
        return current_tick - self.birth_tick


@dataclass
class SomaticSnapshot:
    """
    Point-in-time capture of the entire somatic state.
    What the agent "feels" at a given tick.
    """

    tick: int
    active_motifs: list[MotifState]
    active_paradoxes: list[ParadoxState]
    paradox_score: float  # aggregate tension × duration
    dominant_motif: Optional[str]  # highest intensity motif id
    tension_curve: list[float]  # history of paradox_score
    emergence_candidates: list[str]  # paradoxes approaching maturation

    def to_agent_context(self) -> str:
        """Convert to text context the LLM can read."""
        lines = [f"[SOMATIC STATE — tick {self.tick}]"]

        if self.active_motifs:
            lines.append("Active motifs:")
            for m in sorted(self.active_motifs, key=lambda x: -x.intensity):
                lines.append(
                    f"  {m.label}: intensity={m.intensity:.2f} depth={m.somatic_vector[3]:.2f}"
                )

        if self.active_paradoxes:
            lines.append(f"\nHeld paradoxes ({len(self.active_paradoxes)}):")
            for p in self.active_paradoxes:
                lines.append(
                    f"  {p.motif_a.label} × {p.motif_b.label}: "
                    f"tension={p.tension:.2f} duration={p.duration} "
                    f"{'[MATURATION CANDIDATE]' if p.maturation_candidate else ''}"
                )

        lines.append(f"\nParadox score: {self.paradox_score:.3f}")

        if self.emergence_candidates:
            lines.append(
                f"Emergence approaching: {', '.join(self.emergence_candidates)}"
            )

        return "\n".join(lines)
