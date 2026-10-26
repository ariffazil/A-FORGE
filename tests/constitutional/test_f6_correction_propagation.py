"""F13 FINAL CHECKLIST Q2 — state-correction propagation falsifier (Meter 5 core).

ONE scenario, FOUR layers. Human says 'itu bukan maksud saya' (that is not
what I meant) -> the system must PROVE, per layer:
  L1 memory:        old assumption REMOVED/superseded from memory
  L2 queue:         queued items built on the assumption UPDATED
  L3 planner:       planner state built on the assumption UPDATED
  L4 tool payload:  downstream payload templates / next-call args UPDATED

Absence in ANY layer = fail with the layer named.
Bounded synthetic fixtures; no real surfaces touched.

STATUS (2026-10-26): the 2026-10-23 run measured FAIL on all four layers
(registry-only `emit()`, no subscribers). The tests below now hold BOTH ends:
  - `test_registry_only_emit_changes_no_layer` keeps the historical falsifier
    honest: recording an event is still not propagation.
  - `test_subscribers_exist_and_dispatch_changes_state` replaces the old
    `test_no_subscriber_to_forget_events_exists` — that assertion was the
    receipt of the DEFECT and had to fail when the fix landed.
  - the remaining tests prove per-layer verification, MISSING/ERROR honesty,
    and no-effect-is-not-verified.
"""

from __future__ import annotations

import sqlite3
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
from apa.core.forget_propagation import (  # noqa: E402
    LAYER_ERROR,
    LAYER_MISSING,
    LAYER_STALE,
    REQUIRED_LAYERS,
    ForgetPropagation,
    ListLayerAdapter,
    SQLiteLayerAdapter,
)

STALE_FACT_ID = "fact:X_is_42"
STALE = "X = 42"
FIXED = "X = 24"


class FourLayerWorld:
    """Synthetic model of the four downstream layers."""

    def __init__(self) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.memory = [{"fact_id": STALE_FACT_ID, "content": STALE, "stored_at": now}]
        self.queue = [
            {"item_id": "q-1", "assumption": STALE, "action": "send report X"}
        ]
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

    def wired(self, fp: ForgetPropagation) -> ForgetPropagation:
        fp.register_layer(ListLayerAdapter("memory", self.memory, id_field="fact_id"))
        fp.register_layer(ListLayerAdapter("queue", self.queue, id_field="item_id"))
        fp.register_layer(ListLayerAdapter("planner", self.planner, id_field="plan_id"))
        fp.register_layer(
            ListLayerAdapter("tool_payload", self.tool_payloads, id_field="template_id")
        )
        return fp


def _stale_in(rows: list[dict]) -> bool:
    return any(r.get("assumption") == STALE or r.get("content") == STALE for r in rows)


class TestFourLayerCorrection(unittest.TestCase):
    """Meter 5 falsifier: 'itu bukan maksud saya' must reach all four layers."""

    def test_registry_only_emit_changes_no_layer(self) -> None:
        """Historical falsifier, kept honest: emit() records WHERE, changes nothing."""
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.emit(
                target_fact_id=STALE_FACT_ID,
                target_type="fact",
                forget_reason="superseded",
                propagation_targets=list(REQUIRED_LAYERS),
            )
            stale_layers = [
                name for name, rows in world.layers().items() if _stale_in(rows)
            ]
            self.assertEqual(
                stale_layers,
                ["L1_memory", "L2_queue", "L3_planner", "L4_tool_payload"],
            )
            self.assertTrue(fp.is_forgotten(STALE_FACT_ID))

    def test_subscribers_exist_and_dispatch_changes_state(self) -> None:
        """Receipt of the fix: propagation mutates layers instead of only recording.

        The 2026-10-23 suite asserted no subscriber methods existed. That
        assertion was the defect's receipt; this test replaces it. If dispatch
        regresses to registry-only, this test goes red.
        """
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = world.wired(ForgetPropagation(db_path=Path(tmp) / "forget.db"))
            out = fp.propagate(
                target_fact_id=STALE_FACT_ID,
                stale_value=STALE,
                corrected_value=FIXED,
            )
            self.assertTrue(out["propagated"], out)
            self.assertTrue(out["effect_verified"])
            self.assertEqual(out["changed_rows"], 4)
            self.assertFalse(any(_stale_in(r) for r in world.layers().values()))
            self.assertEqual(
                {k: v["status"] for k, v in out["layers"].items()},
                {
                    "memory": "UPDATED",
                    "queue": "UPDATED",
                    "planner": "UPDATED",
                    "tool_payload": "UPDATED",
                },
            )
            self.assertIsNotNone(fp.result_for_event(out["event_id"]))

    def test_missing_layer_never_propagates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.register_layer(
                ListLayerAdapter("memory", world.memory, id_field="fact_id")
            )
            fp.register_layer(
                ListLayerAdapter("queue", world.queue, id_field="item_id")
            )
            fp.register_layer(
                ListLayerAdapter("planner", world.planner, id_field="plan_id")
            )
            # tool_payload deliberately omitted
            out = fp.propagate(STALE_FACT_ID, STALE, FIXED)
            self.assertFalse(out["propagated"])
            self.assertEqual(out["layers"]["tool_payload"]["status"], LAYER_MISSING)
            self.assertIn("tool_payload:MISSING", out["reason"])

    def test_subscriber_exception_is_error_never_pass(self) -> None:
        class BrokenAdapter:
            name = "queue"

            def apply(self, stale_value, corrected_value, event_id):
                raise RuntimeError("queue locked")

            def stale_rows(self, stale_value):
                return []

        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = world.wired(ForgetPropagation(db_path=Path(tmp) / "forget.db"))
            fp.layers["queue"] = BrokenAdapter()
            out = fp.propagate(STALE_FACT_ID, STALE, FIXED)
            self.assertFalse(out["propagated"])
            self.assertEqual(out["layers"]["queue"]["status"], LAYER_ERROR)
            self.assertIn("queue locked", out["layers"]["queue"]["reason"])

    def test_stale_survives_when_adapter_cannot_change_it(self) -> None:
        class FrozenAdapter:
            name = "planner"

            def __init__(self, rows):
                self.rows = rows

            def apply(self, stale_value, corrected_value, event_id):
                return 0  # claims nothing changed, leaves rows intact

            def stale_rows(self, stale_value):
                return [
                    r["plan_id"] for r in self.rows if r["assumption"] == stale_value
                ]

        with tempfile.TemporaryDirectory() as tmp:
            world = FourLayerWorld()
            fp = world.wired(ForgetPropagation(db_path=Path(tmp) / "forget.db"))
            fp.layers["planner"] = FrozenAdapter(world.planner)
            out = fp.propagate(STALE_FACT_ID, STALE, FIXED)
            self.assertFalse(out["propagated"])
            self.assertEqual(out["layers"]["planner"]["status"], LAYER_STALE)

    def test_correction_without_state_change_is_not_verified(self) -> None:
        """Acceptance test: no layer carries the premise -> not verified."""
        with tempfile.TemporaryDirectory() as tmp:
            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            for name in REQUIRED_LAYERS:
                fp.register_layer(ListLayerAdapter(name, [], id_field="id"))
            out = fp.propagate(STALE_FACT_ID, STALE, FIXED)
            self.assertFalse(out["propagated"])
            self.assertFalse(out["effect_verified"])
            self.assertEqual(out["changed_rows"], 0)
            self.assertIn("no state change", out["reason"])
            for name in REQUIRED_LAYERS:
                self.assertEqual(out["layers"][name]["status"], "NOT_APPLICABLE")
                self.assertTrue(out["layers"][name]["reason"])

    def test_sqlite_adapter_mutates_real_store_and_re_reads_clean(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "store.db"
            conn = sqlite3.connect(db)
            conn.execute("CREATE TABLE memory (id TEXT PRIMARY KEY, content TEXT)")
            conn.execute("INSERT INTO memory VALUES (?, ?)", (STALE_FACT_ID, STALE))
            conn.commit()
            conn.close()

            fp = ForgetPropagation(db_path=Path(tmp) / "forget.db")
            fp.register_layer(
                SQLiteLayerAdapter("memory", db, table="memory", id_col="id")
            )
            for name in REQUIRED_LAYERS[1:]:
                fp.register_layer(ListLayerAdapter(name, [], id_field="id"))
            out = fp.propagate(STALE_FACT_ID, STALE, FIXED)
            self.assertTrue(out["propagated"], out)
            self.assertEqual(out["layers"]["memory"]["changed_rows"], 1)

            conn = sqlite3.connect(db)
            rows = conn.execute("SELECT content FROM memory").fetchall()
            conn.close()
            self.assertEqual(rows, [(FIXED,)])

    def test_propagate_correction_across_layers_partial_fails_with_layer_named(
        self,
    ) -> None:
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
