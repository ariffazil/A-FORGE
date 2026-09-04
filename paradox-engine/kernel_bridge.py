"""
arifOS Kernel — Somatic Paradox Bridge
Connects A-FORGE Paradox Engine into arifOS kernel governance.

This is the WIRING layer. Not a new engine. Not a new model.
It connects:
  A-FORGE Paradox Engine (somatic motif state)
    → arifOS Constitutional Paradox (circuit breakers, governance)
    → Agent context (what the LLM reads)

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import sys
import os
import json
import time
from typing import Any, Optional
from pathlib import Path

import numpy as np

from paths_resolver import org_import_root
sys.path.insert(0, org_import_root("A-FORGE") + "/paradox-engine")

from models import MotifState, ParadoxState, SomaticSnapshot, SOMATIC_DIM
from registry import MotifRegistry
from engine import ParadoxEngine, EmergenceEvent
from api import SomaticStateAPI


# ── Kernel Integration ────────────────────────────────────────────


class SomaticParadoxKernel:
    """
    Bridge between A-FORGE Paradox Engine and arifOS kernel.

    Exposes:
      - somatic_state(): current SomaticSnapshot
      - agent_context(): text for LLM
      - gate_output(candidate): check if output resolves paradox
      - paradox_score(): aggregate tension
      - feed_motif(motif_id, intensity): inject from any source
      - feed_text(text): inject from text analysis
      - constitutional_bridge(): map somatic state → constitutional paradox
    """

    def __init__(self):
        self.registry = MotifRegistry()
        self.engine = ParadoxEngine(
            self.registry,
            maturation_threshold=16,  # shorter for real-time use
            resolution_block_ratio=2.0,
            emergence_callback=self._on_emergence,
        )
        self.api = SomaticStateAPI(self.registry, self.engine)
        self._emergence_log: list[dict] = []
        self._tick_count: int = 0

    def _on_emergence(self, event: EmergenceEvent):
        """Log emergence events for governance."""
        self._emergence_log.append(
            {
                "paradox": event.paradox_id,
                "tick": event.tick,
                "tension": round(event.tension_at_emergence, 3),
                "duration": event.duration_at_emergence,
                "description": event.description,
            }
        )

    # ── Agent-Facing API ─────────────────────────────────────────

    def feed_motif(self, motif_id: str, intensity: float = 0.5) -> dict:
        """Feed a motif activation from any source (DSP, text, direct)."""
        try:
            motif = self.api.activate_motif(motif_id, intensity)
            return {
                "status": "activated",
                "motif": motif_id,
                "intensity": intensity,
                "label": motif.label,
                "cultural_origin": motif.cultural_origin,
            }
        except KeyError:
            return {
                "status": "error",
                "message": f"Unknown motif: {motif_id}",
                "available": self.registry.list_motifs(),
            }

    def feed_text(self, text: str) -> list[dict]:
        """Feed text analysis — activates motifs found in text."""
        activated = self.api.inject_from_text(text)
        return [
            {"motif": m.id, "intensity": m.intensity, "label": m.label}
            for m in activated
        ]

    def tick(self) -> dict:
        """Advance one clock cycle. Returns snapshot summary. Auto-exports state for arifOS."""
        snapshot = self.api.tick()
        self._tick_count += 1

        # Auto-export state for cross-organ wiring (arifOS paradox_gate)
        try:
            self.export_state_to_disk()
        except Exception:
            pass  # non-fatal

        return {
            "tick": snapshot.tick,
            "active_motifs": len(snapshot.active_motifs),
            "active_paradoxes": len(snapshot.active_paradoxes),
            "paradox_score": round(snapshot.paradox_score, 3),
            "dominant_motif": snapshot.dominant_motif,
            "emergence_candidates": snapshot.emergence_candidates,
            "emergence_events": len(self._emergence_log),
        }

    def agent_context(self) -> str:
        """Get text context for LLM — what the agent 'knows' somatically."""
        return self.api.get_context_for_agent()

    def gate_output(self, candidate: str) -> dict:
        """Check if candidate output resolves any active paradox."""
        return self.api.gate_output(candidate)

    def paradox_score(self) -> float:
        """Aggregate paradox score."""
        return self.api.get_paradox_score()

    def get_state(self) -> dict:
        """Full state export for debugging."""
        return self.api.get_full_state()

    # ── Cross-Organ State Export ──────────────────────────────────

    _STATE_PATH = "/tmp/paradox_engine_state.json"

    def export_state_to_disk(self) -> str:
        """
        Write current paradox state to disk for arifOS paradox_gate.py.

        This is the cross-organ wiring surface:
          A-FORGE engine → /tmp/paradox_engine_state.json → arifOS paradox_gate

        Called automatically after each tick(). Can also be called manually.
        """
        state = self.get_state()
        # Transform to the format paradox_gate.py expects
        export = {
            "timestamp": time.time(),
            "tick": state.get("engine", {}).get("tick", 0),
            "paradox_score": state.get("engine", {}).get("paradox_score", 0.0),
            "active_paradoxes": {},
        }

        for pid, pdata in state.get("engine", {}).get("active_paradoxes", {}).items():
            # Find the actual paradox objects for label info
            paradox_obj = None
            for p in self.engine.active_paradoxes.values():
                if p.id == pid:
                    paradox_obj = p
                    break

            if paradox_obj:
                export["active_paradoxes"][pid] = {
                    "motif_a": {
                        "id": paradox_obj.motif_a.id,
                        "label": paradox_obj.motif_a.label,
                        "intensity": round(paradox_obj.motif_a.intensity, 3),
                    },
                    "motif_b": {
                        "id": paradox_obj.motif_b.id,
                        "label": paradox_obj.motif_b.label,
                        "intensity": round(paradox_obj.motif_b.intensity, 3),
                    },
                    "tension": round(pdata.get("tension", 0), 3),
                    "duration": pdata.get("duration", 0),
                    "resolution_blocked": pdata.get("resolution_blocked", False),
                    "matured": pdata.get("maturation_candidate", False),
                    "emerged": pdata.get("emerged", False),
                }

        Path(self._STATE_PATH).write_text(json.dumps(export, indent=2))
        return self._STATE_PATH

    def get_emergence_log(self) -> list[dict]:
        """All emergence events."""
        return self._emergence_log

    # ── Constitutional Bridge ─────────────────────────────────────

    def constitutional_bridge(self) -> dict:
        """
        Map somatic paradox state → constitutional paradox signals.

        This bridges the TWO paradox systems:
          - Somatic: motif tension, cultural contradictions, emergence
          - Constitutional: circuit breakers, anchor injection, governance

        The bridge produces signals that the constitutional system can consume:
          - High paradox score → potential CB3 (Cheap Truth) trigger
          - Emergence event → potential new paradox anchor
          - Resolution blocked → AMANAH gate activation
        """
        score = self.paradox_score()
        paradoxes = self.api.get_active_paradoxes()
        emergences = self.get_emergence_log()

        signals = []

        # High tension → constitutional signal
        if score > 0.5:
            signals.append(
                {
                    "type": "TENSION_HIGH",
                    "source": "somatic_paradox",
                    "score": round(score, 3),
                    "paradox_count": len(paradoxes),
                    "recommendation": "HOLD — sustained somatic tension before judgment",
                }
            )

        # Emergence → new anchor candidate
        if emergences:
            latest = emergences[-1]
            signals.append(
                {
                    "type": "EMERGENCE_CANDIDATE",
                    "source": "somatic_paradox",
                    "paradox": latest["paradox"],
                    "tension": latest["tension"],
                    "recommendation": "Consider new paradox anchor from emergence",
                }
            )

        # Resolution blocked → AMANAH signal
        blocked = [p for p in paradoxes if p.get("blocked")]
        if blocked:
            signals.append(
                {
                    "type": "RESOLUTION_BLOCKED",
                    "source": "somatic_paradox",
                    "blocked_paradoxes": [p["id"] for p in blocked],
                    "recommendation": "Paradox persistence enforced — do not collapse",
                }
            )

        return {
            "somatic_score": round(score, 3),
            "paradox_count": len(paradoxes),
            "emergence_count": len(emergences),
            "signals": signals,
            "constitutional_verdict": "STABLE" if not signals else "ATTENTION",
        }

    # ── Motif Exploration ─────────────────────────────────────────

    def list_motifs(self) -> list[dict]:
        """List all available motifs."""
        return self.api.list_available_motifs()

    def get_relation(self, a: str, b: str) -> dict:
        """Get relationship between two motifs."""
        return self.api.get_relation(a, b)

    def find_contradictions(self, motif_id: str) -> list[str]:
        """Find motifs that contradict the given motif."""
        return self.registry.find_contradictions(motif_id)

    def find_complementary(self, motif_id: str) -> list[str]:
        """Find motifs complementary to the given motif."""
        return self.registry.find_complementary(motif_id)


# ── Singleton for kernel use ──────────────────────────────────────

_kernel_instance: Optional[SomaticParadoxKernel] = None


def get_somatic_kernel() -> SomaticParadoxKernel:
    """Get or create the singleton somatic paradox kernel."""
    global _kernel_instance
    if _kernel_instance is None:
        _kernel_instance = SomaticParadoxKernel()
    return _kernel_instance
