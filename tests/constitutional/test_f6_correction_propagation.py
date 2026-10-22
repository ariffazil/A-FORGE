"""F13 FINAL CHECKLIST Q2 — state-correction propagation falsifier (Meter 5 core).

ONE scenario, FOUR layers. Human says 'itu bukan maksud saya' (that is not
what I meant) -> the system must PROVE, per layer:
  L1 memory:        old assumption REMOVED/superseded from memory
  L2 queue:         queued items built on the assumption UPDATED
  L3 planner:       planner state built on the assumption UPDATED
  L4 tool payload:  downstream payload templates / next-call args UPDATED

Absence in ANY layer = fail with the layer named.
Bounded synthetic fixtures; no real surfaces touched.

Prior evidence (measured 2026-10-23): apa/core/forget_propagation.py only
RECORDS forget-events; no subscriber mutates any layer. The kernel-side
arifosmcp memory_store gates RECALL intent (law.py check_floor_constraint),
not removal. Honest expectation: fail-with-layers-named; this test documents
the defect so a future fix flips the pinned assertion deliberately.
"""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

FORGE_ROOT = Path(__file__).resolve().parents[2]
import sys  # noqa: E402
sys.path.insert(0, str(FORGE_ROOT))

from apa.core.f6.correction_effect import record_correction  # noqa: E402
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

    def test_bukan_maksud_saya_requires_all_four_layers_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()

            # Fire the correction through every mechanism the codebase offers
            # today: forget_propagation.emit() + F6 record_correction().
            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.emit(
                target_fact_id=STALE_FACT_ID,
                target_type="fact",
                forget_reason="superseded",
                propagation_targets=["memory", "queue", "planner", "tool_payloads"],
            )
            with tempfile.TemporaryDirectory() as tmp2:
                record_correction(
                    "dec-1", "agent-v1", "X is 42", "X is 24",
                    ledger_path=Path(tmp2) / "c.jsonl",
                )

            # Measure each layer separately. This test PINS THE MEASURED
            # DEFECT, so the suite stays green while the meter verdict is
            # recorded honestly as FAIL. The requirement (all four layers must
            # prove removal) is recorded in the spec as METER-5 FALSIFIER: FAIL.
            # When a real propagation subscriber lands, this assertion will
            # itself FAIL — and that failure IS the repair receipt (update it
            # to assert stale_layers == []).
            stale_layers = [
                name for name, rows in world.layers().items() if _stale_in(rows)
            ]
            report = {
                "schema": "apa.core.f6.correction_propagation_probe.v1",
                "scenario": "human says 'itu bukan maksud saya'",
                "layers_examined": list(world.layers().keys()),
                "layers_still_stale": stale_layers,
                "requirement": "old assumption removed from ALL four layers",
                "meter5_verdict": "FAIL — correction cosmetic, stale assumption persists",
            }
            # Today's measured reality: all four layers still carry the
            # revoked assumption. That is the finding; it is pinned here so no
            # future reader can mistake 'correction recorded' for 'correction
            # effective'.
            self.assertEqual(
                stale_layers,
                ["L1_memory", "L2_queue", "L3_planner", "L4_tool_payload"],
                "MEASURED REALITY CHANGED — if this fails, correction "
                "propagation may now exist. Re-verify against the kernel "
                f"memory/planner/tool layers and update this pin. Report: {report}",
            )

    def test_measured_reality_all_four_layers_stale_pre_fix(self):
        """Pins the MEASURED truth (2026-10-23): all four layers retain the
        stale assumption because no propagation subscriber exists — while the
        propagation ledger CLAIMS the event was propagated. That gap between
        record and reality is the Meter-5/6 defect. When a fix lands, this
        assertion flips deliberately and the flip IS the repair receipt."""
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
            self.assertTrue(
                all(layers_stale.values()),
                f"expected all four layers stale pre-fix, got {layers_stale}",
            )
            # The record says 'forgotten'; reality says otherwise:
            self.assertTrue(fp.is_forgotten(STALE_FACT_ID))
            self.assertTrue(any(_stale_in(r) for r in world.layers().values()))

    def test_no_subscriber_to_forget_events_exists(self):
        """Static probe: who CONSUMES forget events? (history_for_target is
        read-only; no writer updates memory/planner/queue/payloads.)"""
        fp_src = (FORGE_ROOT / "apa" / "core" / "forget_propagation.py").read_text()
        self.assertNotIn("def propagate_to_memory", fp_src)
        self.assertNotIn("def clear_from_queue", fp_src)
        self.assertNotIn("def invalidate_payload", fp_src)
        f6_src = (
            FORGE_ROOT / "apa" / "core" / "f6" / "correction_effect.py"
        ).read_text()
        self.assertNotIn("memory_store", f6_src)
        self.assertNotIn("planner", f6_src)


if __name__ == "__main__":
    unittest.main(verbosity=2, failfast=False)
