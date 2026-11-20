"""F6 Amendment 01 item 4 — linkage-attack tests.

Removing human_id is NOT anonymity. These tests probe whether F6 outputs and
ledgers can be re-linked to a human through side channels:
  1. timestamp correlation  — F6 event times vs external activity times
  2. domain/workflow fingerprint — rare workflow combos identify an operator
  3. stylometric linkage — free-text fields carry writing style
  4. cross-ledger joinability — F6 rows joinable to other ledgers by shared keys

Each test either (a) demonstrates a bounded mitigation or (b) is reported on
the 'cannot be tested' list in the spec. Synthetic data only.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

FORGE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(FORGE_ROOT))

from apa.core.f6.correction_effect import record_correction, load_corrections  # noqa: E402
from apa.core.f6.meters import evaluate_all  # noqa: E402

FORBIDDEN_KEYS = ("human_id", "user_id", "actor_human", "operator_name", "email")


class TestTimestampCorrelation(unittest.TestCase):
    def test_correction_timestamps_are_second_precision_utc_only(self):
        """Timestamps must be coarse (seconds, UTC) — not millisecond unique
        fingerprints joinable to shell/HTTP logs. Bounded mitigation."""
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            record_correction("d1", "v1", "c", "k", ledger_path=led)
            row = load_corrections(led)[0]
            ts = row["created_at"]
            self.assertRegex(ts, r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$")
            # no sub-second component -> bounded joinability
            self.assertNotIn(".", ts.split("+")[0])

    def test_no_millisecond_or_monotonic_clock_fields_in_f6_output(self):
        meters = evaluate_all()
        blob = json.dumps(meters)
        self.assertNotIn("_monotonic", blob)
        for m in meters["meters"]:
            self.assertNotIn("duration_ms", json.dumps(m.get("extras", {})))


class TestDomainWorkflowFingerprint(unittest.TestCase):
    def test_f6_output_contains_no_actor_identity_fields(self):
        meters = evaluate_all()
        blob = json.dumps(meters)
        for k in FORBIDDEN_KEYS:
            self.assertNotIn(k, blob)
        # decision_id present is fine (decision-scoped), but binding actor ids
        # must never ride F6 telemetry
        self.assertNotIn('"actor_id"', blob)

    def test_correction_rows_carry_agent_version_not_operator_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            record_correction("d1", "agent-v9", "c", "k", ledger_path=led)
            row = load_corrections(led)[0]
            self.assertIn("agent_version", row)
            for k in FORBIDDEN_KEYS:
                self.assertNotIn(k, json.dumps(row))


class TestStylometricLinkage(unittest.TestCase):
    def test_free_text_fields_are_truncated_bounded(self):
        """Long free text = stylometric surface. v0 bounds at 500 chars and
        callers must redact; this test pins the module-side bound."""
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            rec = record_correction(
                "d1", "v1", "x" * 5000, "y" * 5000, ledger_path=led
            )
            row = load_corrections(led)[0]
            self.assertLessEqual(len(row["claim"]), 500)
            self.assertLessEqual(len(row["correction"]), 500)

    def test_untruncated_long_text_rejected_in_effect_evidence(self):
        # _truncate in correction_effect bounds evidence dict values at 200
        from apa.core.f6 import correction_effect as ce
        big = {"k": "z" * 10000}
        out = ce._truncate(big)
        self.assertLessEqual(len(out["k"]), 200)


class TestCrossLedgerJoinability(unittest.TestCase):
    def test_f6_ledger_keys_are_decision_scoped_not_person_scoped(self):
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "c.jsonl"
            record_correction("dec-1", "v1", "c1", "k1", ledger_path=led)
            row = load_corrections(led)[0]
            # join key candidates: decision_id, correction_id — never person keys
            self.assertIn("decision_id", row)
            self.assertNotIn("human_id", row)

    def test_cannot_bound_paths_documented(self):
        """These linkage paths are UNBOUNDED in v0 and listed in the spec's
        'cannot be tested' section — asserting the spec documents them."""
        spec = Path("/root/AAA/forge_work/specs/f6-maruah-spec-v0-draft.md")
        if not spec.exists():
            self.skipTest("spec not present in this environment")
            return
        text = spec.read_text()
        self.assertIn("TIDAK BOLEH DIUJI", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
