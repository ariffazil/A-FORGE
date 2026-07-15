"""
Paradox Engine — Core
Maintains contradiction without resolution. Blocks collapse. Tracks emergence.

The load-bearing module. Everything else is support.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from itertools import combinations
from typing import Optional, Callable

import numpy as np

from models import (
    MotifState,
    ParadoxState,
    SomaticSnapshot,
    ContradictionType,
    SOMATIC_DIM,
    CONTRADICTION_THRESHOLD,
    MATURATION_THRESHOLD,
)
from registry import MotifRegistry


# ── Emergence Event ─────────────────────────────────────────────────


@dataclass
class EmergenceEvent:
    """
    When a paradox sustains long enough, it transforms into something new.
    This is NOT resolution — it is emergence. The contradiction creates
    a third thing that didn't exist before.
    """

    paradox_id: str
    tick: int
    tension_at_emergence: float
    duration_at_emergence: int
    motif_a_id: str
    motif_b_id: str
    description: str
    emergent_properties: dict  # what the new state carries from each parent


# ── Resolution Attempt Log ─────────────────────────────────────────


@dataclass
class ResolutionAttempt:
    """Logged when the engine blocks an output that would resolve a paradox."""

    paradox_id: str
    tick: int
    candidate_output: str
    reason: str
    blocked: bool


# ── Paradox Engine ──────────────────────────────────────────────────


class ParadoxEngine:
    """
    The core engine. Receives motif states each tick, detects contradictions,
    maintains paradoxes, blocks resolution, tracks emergence.

    Architecture:
        LLM generates candidate outputs
            ↓
        Paradox Engine checks: "Does this resolve an active paradox?"
            ↓
        If yes → flag, boost weaker motif, regenerate
        If no  → pass through to governance (AMANAH)

    Key invariant: A paradox is alive as long as BOTH motifs are alive.
    Resolution = one motif dominating → engine boosts the weaker one.
    Emergence = paradox sustained long enough → transforms into new state.
    """

    def __init__(
        self,
        registry: MotifRegistry,
        contradiction_threshold: float = CONTRADICTION_THRESHOLD,
        maturation_threshold: int = MATURATION_THRESHOLD,
        resolution_block_ratio: float = 2.0,
        emergence_callback: Optional[Callable[[EmergenceEvent], None]] = None,
    ):
        self.registry = registry
        self.contradiction_threshold = contradiction_threshold
        self.maturation_threshold = maturation_threshold
        self.resolution_block_ratio = resolution_block_ratio
        self.emergence_callback = emergence_callback

        # State
        self.active_paradoxes: dict[str, ParadoxState] = {}
        self.tension_history: list[float] = []  # paradox_score per tick
        self.tick_count: int = 0
        self.emergence_log: list[EmergenceEvent] = []
        self.resolution_log: list[ResolutionAttempt] = []

        # For tracking motif intensity history (used by tension curves)
        self._motif_intensity_history: dict[str, list[float]] = defaultdict(list)

    # ── Main Loop ────────────────────────────────────────────────

    def tick(self, active_motifs: list[MotifState]) -> SomaticSnapshot:
        """
        One clock tick. Called every cycle.

        1. Decay all motifs
        2. Detect new contradictions
        3. Update existing paradoxes
        4. Block resolution where needed
        5. Check for emergence
        6. Record tension
        7. Return snapshot

        Args:
            active_motifs: currently alive motifs (from registry or external source)

        Returns:
            SomaticSnapshot: complete state at this tick
        """
        self.tick_count += 1

        # 1. Decay
        for m in active_motifs:
            m.decay(ticks=1)
        # Remove dead motifs
        active_motifs = [m for m in active_motifs if m.is_alive()]

        # Track intensity history
        for m in active_motifs:
            self._motif_intensity_history[m.id].append(m.intensity)

        # 2. Detect new contradictions
        self._detect_new_paradoxes(active_motifs)

        # 3. Update existing paradoxes
        self._update_paradoxes(active_motifs)

        # 4. Block resolution
        self._enforce_paradox_persistence()

        # 5. Check emergence
        self._check_emergence()

        # 6. Clean dead paradoxes
        self._clean_dead_paradoxes()

        # 7. Record tension
        score = self.get_paradox_score()
        self.tension_history.append(score)

        # 8. Build snapshot
        return self._build_snapshot(active_motifs)

    # ── Detection ────────────────────────────────────────────────

    def _detect_new_paradoxes(self, motifs: list[MotifState]):
        """Find new contradictory pairs and create paradoxes."""
        for m_a, m_b in combinations(motifs, 2):
            paradox_id = self._paradox_id(m_a.id, m_b.id)

            # Skip if already tracked
            if paradox_id in self.active_paradoxes:
                continue

            # Check relationship
            rel_type, reason = self.registry.get_relation(m_a.id, m_b.id)

            if rel_type == ContradictionType.CONTRADICTORY:
                # Only create paradox if both motifs have sufficient intensity
                if m_a.intensity > 0.1 and m_b.intensity > 0.1:
                    tension = self._compute_tension(m_a, m_b)
                    self.active_paradoxes[paradox_id] = ParadoxState(
                        id=paradox_id,
                        motif_a=m_a.copy(),
                        motif_b=m_b.copy(),
                        tension=tension,
                        duration=0,
                        resolution_blocked=True,
                        contradiction_type=ContradictionType.CONTRADICTORY,
                        emerged_motif=None,
                        birth_tick=self.tick_count,
                        peak_tension=tension,
                        maturation_candidate=False,
                    )

    # ── Update ───────────────────────────────────────────────────

    def _update_paradoxes(self, motifs: list[MotifState]):
        """Update tension and duration for existing paradoxes."""
        # Build lookup for current motif intensities
        motif_lookup = {m.id: m for m in motifs}

        for pid, p in self.active_paradoxes.items():
            # Update motif states from current tick
            if p.motif_a.id in motif_lookup:
                p.motif_a = motif_lookup[p.motif_a.id].copy()
            else:
                # Motif not in active set — apply decay
                p.motif_a.decay(ticks=1)

            if p.motif_b.id in motif_lookup:
                p.motif_b = motif_lookup[p.motif_b.id].copy()
            else:
                p.motif_b.decay(ticks=1)

            # Update tension
            if p.motif_a.is_alive() and p.motif_b.is_alive():
                p.tension = self._compute_tension(p.motif_a, p.motif_b)
                p.duration += 1
                p.peak_tension = max(p.peak_tension, p.tension)

                # Check maturation
                if p.duration >= self.maturation_threshold and p.tension > 0.2:
                    p.maturation_candidate = True

    # ── Resolution Blocking ──────────────────────────────────────

    def _enforce_paradox_persistence(self):
        """
        Core invariant: if one motif starts dominating, boost the weaker one.
        This prevents collapse — the paradox MUST hold.
        """
        for pid, p in self.active_paradoxes.items():
            if not (p.motif_a.is_alive() and p.motif_b.is_alive()):
                continue

            ratio = p.motif_a.intensity / (p.motif_b.intensity + 1e-8)

            if ratio > self.resolution_block_ratio:
                # A is dominating — boost B
                boost_factor = min(1.5, ratio * 0.6)
                p.motif_b.boost(boost_factor)
                p.resolution_blocked = True
            elif (1.0 / ratio) > self.resolution_block_ratio:
                # B is dominating — boost A
                boost_factor = min(1.5, (1.0 / ratio) * 0.6)
                p.motif_a.boost(boost_factor)
                p.resolution_blocked = True
            else:
                p.resolution_blocked = False

    # ── Emergence ────────────────────────────────────────────────

    def _check_emergence(self):
        """
        When a paradox has been sustained long enough at high tension,
        it doesn't resolve — it TRANSFORMS. The contradiction creates
        a new state that carries properties from both parents.

        This is governed emergence, not spontaneous collapse.
        """
        for pid, p in self.active_paradoxes.items():
            if not p.maturation_candidate:
                continue
            if p.emerged_motif is not None:
                continue  # already emerged

            # Emergence conditions:
            # 1. Duration >= threshold
            # 2. Tension sustained above 0.2 (accounting for motif decay)
            # 3. Both motifs still alive
            if (
                p.duration >= self.maturation_threshold
                and p.tension > 0.2
                and p.motif_a.is_alive()
                and p.motif_b.is_alive()
            ):
                event = EmergenceEvent(
                    paradox_id=pid,
                    tick=self.tick_count,
                    tension_at_emergence=p.tension,
                    duration_at_emergence=p.duration,
                    motif_a_id=p.motif_a.id,
                    motif_b_id=p.motif_b.id,
                    description=self._describe_emergence(p),
                    emergent_properties=self._compute_emergent_properties(p),
                )

                p.emerged_motif = event.description
                self.emergence_log.append(event)

                if self.emergence_callback:
                    self.emergence_callback(event)

    def _describe_emergence(self, p: ParadoxState) -> str:
        """Generate a description of what emerged from the paradox."""
        a_label = p.motif_a.label
        b_label = p.motif_b.label
        return (
            f"Emergence from {a_label}×{b_label}: "
            f"a state that carries the weight of {a_label} "
            f"and the tension of {b_label}, "
            f"sustained for {p.duration} ticks at peak tension {p.peak_tension:.2f}"
        )

    def _compute_emergent_properties(self, p: ParadoxState) -> dict:
        """
        What the emergent state carries from each parent.
        This is the "third thing" — not A, not B, but something new.
        """
        a = p.motif_a
        b = p.motif_b

        # Emergent somatic vector = weighted blend biased toward tension
        blend_weight = 0.5 + (p.tension * 0.2)  # tension pushes blend
        emergent_somatic = a.somatic_vector * blend_weight + b.somatic_vector * (
            1 - blend_weight
        )

        return {
            "emergent_somatic_vector": emergent_somatic.tolist(),
            "parent_a_intensity": a.intensity,
            "parent_b_intensity": b.intensity,
            "tension_at_emergence": p.tension,
            "duration": p.duration,
            "inherited_depth": max(a.somatic_vector[3], b.somatic_vector[3]),
            "inherited_warmth": (a.somatic_vector[6] + b.somatic_vector[6]) / 2,
            "inherited_spiritual": max(a.somatic_vector[10], b.somatic_vector[10]),
            "inherited_paradox_affinity": max(
                a.somatic_vector[12], b.somatic_vector[12]
            ),
        }

    # ── Resolution Check (for LLM output gating) ─────────────────

    def check_output_resolution(
        self, candidate_output: str, active_motifs: list[MotifState]
    ) -> list[tuple[str, str, str]]:
        """
        Before agent commits to output:
        Check if any candidate RESOLVES an active paradox.
        If yes, flag it for governance.

        Returns list of (candidate, paradox_id, reason) tuples.
        """
        flagged = []

        # Simple heuristic: if output strongly references one motif
        # but not its paradox partner, it may be resolving
        for pid, p in self.active_paradoxes.items():
            if not (p.motif_a.is_alive() and p.motif_b.is_alive()):
                continue

            a_in_output = p.motif_a.label.lower() in candidate_output.lower()
            b_in_output = p.motif_b.label.lower() in candidate_output.lower()

            if a_in_output and not b_in_output:
                reason = (
                    f"Output references {p.motif_a.label} but not {p.motif_b.label}. "
                    f"This may resolve the {pid} paradox."
                )
                flagged.append((candidate_output, pid, reason))
                self.resolution_log.append(
                    ResolutionAttempt(
                        paradox_id=pid,
                        tick=self.tick_count,
                        candidate_output=candidate_output,
                        reason=reason,
                        blocked=True,
                    )
                )
            elif b_in_output and not a_in_output:
                reason = (
                    f"Output references {p.motif_b.label} but not {p.motif_a.label}. "
                    f"This may resolve the {pid} paradox."
                )
                flagged.append((candidate_output, pid, reason))
                self.resolution_log.append(
                    ResolutionAttempt(
                        paradox_id=pid,
                        tick=self.tick_count,
                        candidate_output=candidate_output,
                        reason=reason,
                        blocked=True,
                    )
                )

        return flagged

    # ── Scoring ──────────────────────────────────────────────────

    def get_paradox_score(self) -> float:
        """
        Aggregate paradox score. High = agent is holding meaningful contradiction.
        Low = agent has resolved or avoided paradox.

        score = mean(tension × duration) across active paradoxes
        """
        if not self.active_paradoxes:
            return 0.0

        scores = []
        for p in self.active_paradoxes.values():
            if p.motif_a.is_alive() and p.motif_b.is_alive():
                scores.append(p.tension * min(p.duration, self.maturation_threshold))

        return float(np.mean(scores)) if scores else 0.0

    def get_tension_curve(self, window: int = 32) -> list[float]:
        """Return recent tension history."""
        return self.tension_history[-window:]

    def get_active_paradox_count(self) -> int:
        """Number of currently active paradoxes."""
        return sum(
            1
            for p in self.active_paradoxes.values()
            if p.motif_a.is_alive() and p.motif_b.is_alive()
        )

    def get_emergence_count(self) -> int:
        """Number of emergence events that have occurred."""
        return len(self.emergence_log)

    # ── Snapshot ─────────────────────────────────────────────────

    def _build_snapshot(self, active_motifs: list[MotifState]) -> SomaticSnapshot:
        """Build a complete snapshot of the current somatic state."""
        alive_paradoxes = [
            p
            for p in self.active_paradoxes.values()
            if p.motif_a.is_alive() and p.motif_b.is_alive()
        ]

        dominant = None
        if active_motifs:
            dominant = max(active_motifs, key=lambda m: m.intensity).id

        emergence_candidates = [p.id for p in alive_paradoxes if p.maturation_candidate]

        return SomaticSnapshot(
            tick=self.tick_count,
            active_motifs=active_motifs,
            active_paradoxes=alive_paradoxes,
            paradox_score=self.get_paradox_score(),
            dominant_motif=dominant,
            tension_curve=self.get_tension_curve(),
            emergence_candidates=emergence_candidates,
        )

    # ── Helpers ──────────────────────────────────────────────────

    def _paradox_id(self, a_id: str, b_id: str) -> str:
        """Canonical paradox ID (order-independent)."""
        return "×".join(sorted([a_id, b_id]))

    def _compute_tension(self, a: MotifState, b: MotifState) -> float:
        """
        Tension = f(contradiction_strength, intensity_product, duration_factor)

        contradiction_strength: how opposed the somatic vectors are
        intensity_product: both motifs at high intensity = more tension
        duration_factor: longer sustained = more tension (up to threshold)

        Cultural override: if the registry declares two motifs contradictory,
        tension is boosted to at least CULTURAL_MIN_TENSION regardless of
        cosine similarity. This ensures cultural contradictions hold even
        when somatic vectors are similar.
        """
        # Cosine similarity on somatic vectors
        cos_sim = np.dot(a.somatic_vector, b.somatic_vector) / (
            np.linalg.norm(a.somatic_vector) * np.linalg.norm(b.somatic_vector) + 1e-8
        )
        contradiction_strength = max(0.0, 1.0 - cos_sim)  # 0=similar, 2=opposed

        # Cultural override: declared contradictions get maximum contradiction strength.
        # Cultural declaration IS the contradiction — vectors are secondary.
        CULTURAL_MIN_TENSION = 1.0
        rel_type, _ = self.registry.get_relation(a.id, b.id)
        if rel_type == ContradictionType.CONTRADICTORY:
            contradiction_strength = max(contradiction_strength, CULTURAL_MIN_TENSION)

        intensity_product = a.intensity * b.intensity

        # Duration factor — find the paradox this belongs to
        pid = self._paradox_id(a.id, b.id)
        if pid in self.active_paradoxes:
            dur = self.active_paradoxes[pid].duration
        else:
            dur = 0
        duration_factor = min(1.0, dur / self.maturation_threshold)

        tension = (
            contradiction_strength * intensity_product * (0.5 + 0.5 * duration_factor)
        )
        return min(1.0, tension)

    def _clean_dead_paradoxes(self):
        """Remove paradoxes where both motifs have died."""
        dead = [
            pid
            for pid, p in self.active_paradoxes.items()
            if not p.motif_a.is_alive() and not p.motif_b.is_alive()
        ]
        for pid in dead:
            del self.active_paradoxes[pid]

    # ── State Export ─────────────────────────────────────────────

    def get_state_dict(self) -> dict:
        """Export engine state for persistence/debugging."""
        return {
            "tick": self.tick_count,
            "paradox_count": self.get_active_paradox_count(),
            "paradox_score": self.get_paradox_score(),
            "emergence_count": self.get_emergence_count(),
            "tension_history_len": len(self.tension_history),
            "active_paradoxes": {
                pid: {
                    "motif_a": p.motif_a.id,
                    "motif_b": p.motif_b.id,
                    "tension": round(p.tension, 3),
                    "duration": p.duration,
                    "resolution_blocked": p.resolution_blocked,
                    "maturation_candidate": p.maturation_candidate,
                    "emerged": p.emerged_motif is not None,
                }
                for pid, p in self.active_paradoxes.items()
            },
        }
