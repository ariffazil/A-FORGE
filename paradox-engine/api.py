"""
Paradox Engine — Somatic State API
Agent-facing interface. This is how the LLM reads and writes somatic state.

The agent doesn't "feel" — it operates upon somatic representation.
This API is the membrane between linguistic intelligence and somatic state.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from models import MotifState, SomaticSnapshot, ContradictionType
from registry import MotifRegistry
from engine import ParadoxEngine, EmergenceEvent


class SomaticStateAPI:
    """
    The interface between the LLM agent and the Paradox Engine.

    Agent workflow:
        1. Perceive: receive motif activations (from DSP, text, or direct injection)
        2. Read: get current somatic snapshot
        3. Generate: produce candidate output
        4. Gate: check if output resolves active paradoxes
        5. Act: emit output or regenerate

    The agent is TEXT-BASED. It does not process audio.
    It operates upon somatic motif state that has been abstracted
    from audio, text, gesture, or other sources.
    """

    def __init__(
        self,
        registry: Optional[MotifRegistry] = None,
        engine: Optional[ParadoxEngine] = None,
    ):
        self.registry = registry or MotifRegistry()
        self.engine = engine or ParadoxEngine(self.registry)
        self._active_motifs: dict[str, MotifState] = {}

    # ── Perceive ─────────────────────────────────────────────────

    def activate_motif(
        self,
        motif_id: str,
        intensity: float = 0.5,
        semantic_embedding: Optional[np.ndarray] = None,
    ) -> MotifState:
        """
        Activate a motif in the somatic state.
        Called when audio analysis, text analysis, or direct injection
        identifies a motif.

        Args:
            motif_id: taxonomy ID (e.g. "rindu", "sedih")
            intensity: activation strength [0, 1]
            semantic_embedding: optional hybrid embedding

        Returns:
            The activated MotifState
        """
        motif = self.registry.activate(motif_id, intensity, semantic_embedding)
        self._active_motifs[motif_id] = motif
        return motif

    def set_intensity(self, motif_id: str, intensity: float):
        """Update intensity of an already-active motif."""
        if motif_id not in self._active_motifs:
            raise KeyError(
                f"Motif {motif_id} is not active. Use activate_motif() first."
            )
        self._active_motifs[motif_id].intensity = max(0.0, min(1.0, intensity))

    def deactivate_motif(self, motif_id: str):
        """Remove a motif from active state."""
        self._active_motifs.pop(motif_id, None)

    def inject_from_text(self, text: str) -> list[MotifState]:
        """
        Simple text→motif injection. Scans text for motif labels
        and activates them with heuristic intensity.

        This is a PLACEHOLDER for proper NLP extraction.
        In production, this would use a classifier or embedding similarity.
        """
        activated = []
        text_lower = text.lower()

        # Simple keyword matching (placeholder)
        keyword_map = {
            "rindu": ["rindu", "merindui", "teringat", "terkenang"],
            "sedih": ["sedih", "duka", "pilu", "air mata", "menangis"],
            "syukur": ["syukur", "bersyukur", "alhamdulillah", "terima kasih"],
            "redha": ["redha", "ikhlas", "pasrah", "terima"],
            "marah": ["marah", "geram", "benci", "bengang"],
            "malu": ["malu", "segan", "tersipu"],
            "sabar": ["sabar", "bertahan", "tabah", "tawakkal"],
            "harap": ["harap", "berharap", "mengharap", "impian"],
            "pasrah": ["pasrah", "menyerah", "pasrah pada ALLAH"],
            "takut": ["takut", "gerun", "gentar", "ngeri"],
            "bangga": ["bangga", "megah", "mulia"],
            "gembira": ["gembira", "suka", "riang", "ketawa"],
            "gelisah": ["gelisah", "resah", "gundah", "cemas"],
            "putus_asa": ["putus asa", "kecewa", "hampa"],
            "sayang": ["sayang", "cinta", "kasih", "cintakan"],
            "benci": ["benci", "meluat", "menjijikkan"],
            "berani": ["berani", "gagah", "tabah"],
            "hiba": ["hiba", "terharu", "sebak", "meruntun"],
            "sebak": ["sebak", "hiba", "tersentuh"],
            "geram": ["geram", "geram sangat"],
            "luluh": ["luluh", "cair", "lembut"],
            "puas": ["puas", "puas hati", "lega"],
            "merantau_rindu": ["merantau", "perantau", "tanah tumpah darah"],
            "resah": ["resah", "tidak tenang", "serba salah"],
        }

        for motif_id, keywords in keyword_map.items():
            for kw in keywords:
                if kw in text_lower:
                    # Heuristic intensity based on keyword strength
                    intensity = 0.7 if len(kw) > 4 else 0.5
                    motif = self.activate_motif(motif_id, intensity)
                    activated.append(motif)
                    break  # one activation per motif

        return activated

    # ── Read ─────────────────────────────────────────────────────

    def tick(self) -> SomaticSnapshot:
        """
        Advance one clock cycle. The engine processes current motifs,
        detects contradictions, maintains paradoxes, checks emergence.

        Returns:
            SomaticSnapshot: complete state for this tick
        """
        motifs = list(self._active_motifs.values())
        snapshot = self.engine.tick(motifs)

        # Clean up dead motifs from our tracking
        dead = [m.id for m in motifs if not m.is_alive()]
        for mid in dead:
            self._active_motifs.pop(mid, None)

        return snapshot

    def get_snapshot(self) -> SomaticSnapshot:
        """Get current state without advancing tick."""
        motifs = list(self._active_motifs.values())
        return self.engine._build_snapshot(motifs)

    def get_context_for_agent(self) -> str:
        """
        Get a text representation of current somatic state.
        This is what the LLM reads to "know" its somatic condition.
        """
        snapshot = self.get_snapshot()
        return snapshot.to_agent_context()

    def get_paradox_score(self) -> float:
        """Current aggregate paradox score."""
        return self.engine.get_paradox_score()

    def get_tension_curve(self, window: int = 32) -> list[float]:
        """Recent tension history."""
        return self.engine.get_tension_curve(window)

    def get_active_paradoxes(self) -> list[dict]:
        """List active paradoxes as dicts for inspection."""
        result = []
        for pid, p in self.engine.active_paradoxes.items():
            if p.motif_a.is_alive() and p.motif_b.is_alive():
                result.append(
                    {
                        "id": pid,
                        "motif_a": p.motif_a.label,
                        "motif_b": p.motif_b.label,
                        "tension": round(p.tension, 3),
                        "duration": p.duration,
                        "blocked": p.resolution_blocked,
                        "maturation": p.maturation_candidate,
                        "emerged": p.emerged_motif is not None,
                    }
                )
        return result

    # ── Gate ─────────────────────────────────────────────────────

    def gate_output(self, candidate_output: str) -> dict:
        """
        Check if candidate output would resolve any active paradox.

        Returns:
            {
                "safe": bool,           # True if output doesn't resolve paradoxes
                "flagged": list,        # (candidate, paradox_id, reason) tuples
                "action": str,          # "PASS" or "REGENERATE"
            }
        """
        motifs = list(self._active_motifs.values())
        flagged = self.engine.check_output_resolution(candidate_output, motifs)

        return {
            "safe": len(flagged) == 0,
            "flagged": [
                {"paradox_id": pid, "reason": reason} for _, pid, reason in flagged
            ],
            "action": "PASS" if not flagged else "REGENERATE",
        }

    # ── Motif Exploration ────────────────────────────────────────

    def list_available_motifs(self) -> list[dict]:
        """List all motifs in the taxonomy with their somatic profiles."""
        result = []
        for mid in self.registry.list_motifs():
            tpl = self.registry.get_template(mid)
            result.append(
                {
                    "id": mid,
                    "label": tpl["label"],
                    "description": tpl["description"],
                    "cultural_origin": tpl["cultural_origin"],
                    "contradicts": tpl["contradicts"],
                    "complementary": tpl["complementary"],
                }
            )
        return result

    def get_relation(self, motif_a: str, motif_b: str) -> dict:
        """Get the relationship between two motifs."""
        rel_type, reason = self.registry.get_relation(motif_a, motif_b)
        return {
            "motif_a": motif_a,
            "motif_b": motif_b,
            "type": rel_type.value,
            "reason": reason,
        }

    # ── Emergence ────────────────────────────────────────────────

    def get_emergence_log(self) -> list[dict]:
        """List all emergence events."""
        return [
            {
                "paradox": e.paradox_id,
                "tick": e.tick,
                "tension": round(e.tension_at_emergence, 3),
                "duration": e.duration_at_emergence,
                "description": e.description,
                "properties": {
                    k: round(v, 3) if isinstance(v, float) else v
                    for k, v in e.emergent_properties.items()
                    if k != "emergent_somatic_vector"
                },
            }
            for e in self.engine.emergence_log
        ]

    # ── State Export ─────────────────────────────────────────────

    def get_full_state(self) -> dict:
        """Export complete state for debugging/persistence."""
        return {
            "active_motifs": {
                mid: {
                    "label": m.label,
                    "intensity": round(m.intensity, 3),
                    "cultural_origin": m.cultural_origin,
                }
                for mid, m in self._active_motifs.items()
            },
            "engine": self.engine.get_state_dict(),
            "emergence_log": self.get_emergence_log(),
        }
