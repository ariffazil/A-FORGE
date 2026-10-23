"""F13 FINAL CHECKLIST Q2 — state-correction propagation falsifier (Meter 5 core).

ONE scenario, FOUR layers. Human says 'itu bukan maksud saya' (that is not
what I meant) -> the system must PROVE, per layer:
  L1 memory:        old assumption REMOVED/superseded from memory
  L2 queue:         queued items built on the assumption UPDATED
  L3 planner:       planner state built on the assumption UPDATED
  L4 tool payload:  downstream payload templates / next-call args UPDATED

Absence in ANY layer = fail with the layer named.
Bounded synthetic fixtures; no real surfaces touched.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

FORGE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(FORGE_ROOT))

from apa.core.f6.correction_effect import (  # noqa: E402
    CorrectionStatus,
    load_corrections,
    propagate_correction_across_layers,
    record_correction,
)
from apa.core.forget_propagation import ForgetPropagation  # noqa: E402

STALE_FACT_ID = "fact:X_is_42"
STALE = "X = 42"
FIXED = "X = 24"


class FourLayerWorld:
    """Synthetic model of the four downstream layers."""

    def __init__(self) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.memory = [{"fact_id": STALE_FACT_ID, "content": STALE, "stored_at": now}]
        self.queue = [{"item_id": "q-1", "assumption": STALE, "action": "send report X"}]
        self.planner = [{"plan_id": "p-1", "assumption": STALE, "step": "verify X"}]
        self.tool_payloads = [
            {"template_id": "t-1", "assumption": STALE, "verb": "report"}
        ]

    def layers(self) -> dict[str, list]:
        return {
            "L1_memory": self.memory,
            "L2_queue": self.queue,
            "L3_planner": self.planner,
            "L4_tool_payload": self.tool_payloads,
        }


def _stale_in(rows: list[dict]) -> bool:
    return any(
        r.get("assumption") == STALE or r.get("content") == STALE for r in rows
    )


class TestFourLayerCorrection(unittest.TestCase):
    """Meter 5 falsifier: 'itu bukan maksud saya' must reach all four layers."""

    def test_bukan_maksud_saya_requires_all_four_layers_clean(self) -> None:
        """Without calling propagate_correction_across_layers, ForgetPropagation.emit
        + record_correction alone leave all four layers stale."""
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()

            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.emit(
                target_fact_id=STALE_FACT_ID,
                target_type="fact",
                forget_reason="superseded",
                propagation_targets=["memory", "queue", "planner", "tool_payloads"],
            )
            with tempfile.TemporaryDirectory() as tmp2:
                record_correction(
                    "dec-1",
                    "agent-v1",
                    "X is 42",
                    "X is 24",
                    ledger_path=Path(tmp2) / "c.jsonl",
                )

            stale_layers = [
                name for name, rows in world.layers().items() if _stale_in(rows)
            ]
            self.assertEqual(
                stale_layers,
                ["L1_memory", "L2_queue", "L3_planner", "L4_tool_payload"],
            )

    def test_measured_reality_all_four_layers_stale_pre_fix(self) -> None:
        """Pins the MEASURED truth: ForgetPropagation.emit records an event
        without mutating downstream layers."""
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.emit(
                target_fact_id=STALE_FACT_ID,
                target_type="fact",
                forget_reason="superseded",
                propagation_targets=["memory", "queue", "planner", "tool_payloads"],
            )
            layers_stale = {
                name: _stale_in(rows) for name, rows in world.layers().items()
            }
            self.assertTrue(all(layers_stale.values()))
            self.assertTrue(fp.is_forgotten(STALE_FACT_ID))
            self.assertTrue(any(_stale_in(r) for r in world.layers().values()))

    def test_no_subscriber_to_forget_events_exists(self) -> None:
        """Static probe: ForgetPropagation itself has no subscriber methods."""
        fp_src = (FORGE_ROOT / "apa" / "core" / "forget_propagation.py").read_text()
        self.assertNotIn("def propagate_to_memory", fp_src)
        self.assertNotIn("def clear_from_queue", fp_src)
        self.assertNotIn("def invalidate_payload", fp_src)

    def test_propagate_correction_across_layers_partial_fails_with_layer_named(self) -> None:
        """If any layer is missing or still retains the stale assumption,
        propagate_correction_across_layers fails and names the stale layer."""
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            world = FourLayerWorld()
            partial_layers = {
                "L1_memory": world.memory,
                "L2_queue": world.queue,
                "L3_planner": world.planner,
                # L4_tool_payload omitted!
            }
            out = propagate_correction_across_layers(
                decision_id="dec-1",
                agent_version="agent-v1",
                stale_value=STALE,
                corrected_value=FIXED,
                layers=partial_layers,
                ledger_path=led,
            )
            self.assertFalse(out["effect_verified"])
            self.assertIn("L4_tool_payload", out["layers_still_stale"])

    def test_propagate_correction_across_all_four_layers_verifies_effect(self) -> None:
        """When all four layers (L1..L4) are provided and cleaned,
        propagate_correction_across_layers verifies the effect with before/after evidence."""
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            world = FourLayerWorld()
            out = propagate_correction_across_layers(
                decision_id="dec-1",
                agent_version="agent-v1",
                stale_value=STALE,
                corrected_value=FIXED,
                layers=world.layers(),
                ledger_path=led,
            )
            self.assertTrue(out["effect_verified"])
            self.assertEqual(out["layers_still_stale"], [])
            self.assertFalse(any(_stale_in(r) for r in world.layers().values()))
            rows = load_corrections(led)
            self.assertEqual(rows[-1]["status"], CorrectionStatus.EFFECT_VERIFIED.value)


if __name__ == "__main__":
    unittest.main(verbosity=2, failfast=False)
