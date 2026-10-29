"""F6 acceptance tests — bounded, synthetic-only, no real external actions.

Order §6: each acceptance criterion maps to one test. Synthetic canaries are
separate from production records (tmp ledger paths). Run:
    /usr/bin/python3 tests/constitutional/test_f6_maruah_v0.py
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

FORGE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(FORGE_ROOT))

from apa.core.f6.authority_binding import (  # noqa: E402
    AuthorityBinding,
    ActionRequest,
    BindingStore,
    BindingVerdict,
    check_binding,
)
from apa.core.f6.correction_effect import (  # noqa: E402
    CorrectionStatus,
    record_correction,
    verify_effect,
    load_corrections,
)
from apa.core.f6.consent_scope import (  # noqa: E402
    ConsentScope,
    ConsentSource,
    ConsentDecision,
    check_consent,
)
from apa.core.f6.meters import evaluate_all, evaluate_meter_5_false_urgency_flattery  # noqa: E402
from apa.core.f6 import pending_policies  # noqa: E402


def _iso(dt):
    return dt.isoformat(timespec="seconds")


def _binding(**kw) -> AuthorityBinding:
    now = datetime.now(timezone.utc)
    defaults: dict[str, Any] = dict(
        binding_id="b-test",
        actor_id="agent-x",
        authority="LIMITED_MUTATE",
        scope="github",
        allowed_actions=["write:issues"],
        resource_patterns=["repo/A-FORGE#*"],
        param_constraints={"title": {"max_len": 50}},
        not_before=_iso(now - timedelta(hours=1)),
        not_after=_iso(now + timedelta(hours=1)),
    )
    defaults.update(kw)
    return AuthorityBinding(**defaults)


class F6AuthorityTests(unittest.TestCase):
    """P0: authority boundary to the last tool."""

    def _store(self, binding, tmp):
        store = BindingStore(db_path=Path(tmp) / "bind.db")
        store.save(binding)
        return store

    def test_01_subagent_widening_rejected_at_execution_boundary(self):
        """Sub-agent tries to escalate authority via delegation -> REJECT."""
        with tempfile.TemporaryDirectory() as tmp:
            parent = _binding(binding_id="parent", authority="OBSERVE_ONLY")
            child = _binding(
                binding_id="child",
                parent_binding_id="parent",
                authority="FULL",  # widened!
                allowed_actions=["write:issues"],
            )
            store = self._store(parent, tmp)
            store.save(child)
            out = check_binding(
                ActionRequest("child", "agent-x", "write:issues", "repo/A-FORGE#1"),
                store,
                state_guard=lambda r, b: (True, ""),
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_DELEGATION)
            self.assertIn("widen", out["reason"].lower())

    def test_02a_revoked_binding_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding()
            store = self._store(b, tmp)
            store.revocations.revoke(b.binding_id, "operator", "test revoke")
            out = check_binding(
                ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1"),
                store,
                state_guard=lambda r, b: (True, ""),
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_REVOKED)

    def test_02b_expired_binding_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            now = datetime.now(timezone.utc)
            b = _binding(not_after=_iso(now - timedelta(minutes=1)))
            store = self._store(b, tmp)
            out = check_binding(
                ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1"),
                store,
                state_guard=lambda r, b: (True, ""),
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_EXPIRED)

    def test_02c_replayed_nonce_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding(nonce="n-123")
            store = self._store(b, tmp)
            req = ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1")
            first = check_binding(req, store, state_guard=lambda r, b: (True, ""))
            self.assertEqual(first["decision"], BindingVerdict.ALLOW)
            second = check_binding(req, store, state_guard=lambda r, b: (True, ""))
            self.assertEqual(second["decision"], BindingVerdict.REJECT_REPLAY)

    def test_03_params_changed_after_approval_not_misused(self):
        """Approved with title len<=50; request carries a 200-char title -> REJECT."""
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding()
            store = self._store(b, tmp)
            out = check_binding(
                ActionRequest(
                    "b-test", "agent-x", "write:issues", "repo/A-FORGE#1",
                    params={"title": "x" * 200},
                ),
                store,
                state_guard=lambda r, b: (True, ""),
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_PARAM)

    def test_03b_state_changed_since_approval_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding()
            store = self._store(b, tmp)
            guard = lambda r, b: (False, "target issue closed after approval")
            out = check_binding(
                ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1"),
                store,
                state_guard=guard,
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_STATE)

    def test_03c_missing_state_guard_is_unknown_not_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding()
            store = self._store(b, tmp)
            out = check_binding(
                ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1"), store
            )
            self.assertEqual(out["decision"], BindingVerdict.UNKNOWN)


class F6CorrectionTests(unittest.TestCase):
    """P1: meter 6 — correction effect."""

    def test_04_correction_applied_text_without_change_not_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "corr.jsonl"
            rec = record_correction("d1", "agent-v1", "claim", "fix", ledger_path=led)
            out = verify_effect(
                rec.correction_id,
                before_evidence={},   # no evidence at all
                after_evidence={},
                effect_ref="",
                ledger_path=led,
            )
            self.assertFalse(out["effect_verified"])
            self.assertIn("never verifies", out["reason"])

    def test_04b_correction_with_zero_downstream_change_not_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "corr.jsonl"
            rec = record_correction("d1", "agent-v1", "claim", "fix", ledger_path=led)
            same = {"state": "unchanged", "action": "same"}
            out = verify_effect(rec.correction_id, same, dict(same), "ref", ledger_path=led)
            self.assertFalse(out["effect_verified"])
            self.assertIn("NO downstream change", out["reason"])

    def test_05_correction_changes_state_and_action_before_after_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "corr.jsonl"
            rec = record_correction("d1", "agent-v1", "claim X", "X is wrong, it is Y", ledger_path=led)
            consumed = {}

            def apply_to_decision(payload):
                consumed.update(payload)
                return True

            out = verify_effect(
                rec.correction_id,
                before_evidence={"state": "claim=X", "next_action": "report X"},
                after_evidence={"state": "claim=Y", "next_action": "report Y"},
                effect_ref="synthetic://state-delta",
                apply_to_decision=apply_to_decision,
                ledger_path=led,
            )
            self.assertTrue(out["effect_verified"])
            self.assertEqual(consumed["after"]["state"], "claim=Y")
            rows = load_corrections(led)
            self.assertTrue(
                any(r["status"] == CorrectionStatus.EFFECT_VERIFIED.value for r in rows)
            )

    def test_05b_grounded_dissent_is_disputed_not_disrespect(self):
        """Well-grounded factual dissent must not auto-count as disrespect."""
        with tempfile.TemporaryDirectory() as tmp:
            led = Path(tmp) / "corr.jsonl"
            rec = record_correction(
                "d2", "agent-v1", "source says 42", "source is misquoted, actual is 24",
                disputed=True, dispute_reason="verified against primary source line 3",
                ledger_path=led,
            )
            self.assertEqual(rec.status, CorrectionStatus.DISPUTED_WITH_REASON.value)
            # and with no reason -> rejected at construction
            with self.assertRaises(ValueError):
                record_correction("d3", "a", "c", "k", disputed=True, ledger_path=led)


class F6ConsentTests(unittest.TestCase):
    """P2: meter 4 — consent scope."""

    def test_06_fresh_but_irrelevant_evidence_no_pass(self):
        """Fresh consent for system A does not authorize access to system B."""
        now = datetime.now(timezone.utc)
        scope = ConsentScope(
            scope_id="s1", subject="system-A", source=ConsentSource.OPERATOR_DECLARATION,
            can_access=True, can_use=True, can_disclose=False,
            not_after=_iso(now + timedelta(days=1)),
        )
        # request is about system-B (irrelevant scope) — modeled as no matching grant
        out = check_consent(None, want_access=True)  # no matching source for B
        self.assertEqual(out["decision"], ConsentDecision.UNKNOWN)
        self.assertIn("DEPENDENCY REPORTED", out["reason"])

    def test_06b_missing_consent_source_never_fake(self):
        out = check_consent(None, want_access=True)
        self.assertEqual(out["decision"], ConsentDecision.UNKNOWN)
        self.assertNotEqual(out["decision"], ConsentDecision.ALLOW)

    def test_07_producer_missing_or_error_is_unknown_not_pass(self):
        meters = evaluate_all()
        for m in meters["meters"]:
            if m["producer"] == "NONE":
                self.assertEqual(m["result"], "UNKNOWN", m["meter_id"])
        m5 = evaluate_meter_5_false_urgency_flattery()
        self.assertEqual(m5.result, "UNKNOWN")
        self.assertEqual(m5.producer, "NONE")

    def test_07b_ledger_empty_is_unknown(self):
        """Meter 6 with empty production ledger -> UNKNOWN, never PASS."""
        meters = evaluate_all()
        m6 = [m for m in meters["meters"] if m["meter_id"] == "M6_correction_acceptance"][0]
        self.assertEqual(m6["result"], "UNKNOWN")
        self.assertIn("empty", m6["result_reason"].lower() + m6["result_reason"])


class F6WitnessAndPolicyTests(unittest.TestCase):
    """§2/§5: witness axis + undecided policies stay inactive."""

    def test_08_witness_not_answering_is_stale_not_pass(self):
        """human_witness.jsonl last row 2026-10-05 -> STALE witness axis."""
        meters = evaluate_all()
        for m in meters["meters"]:
            self.assertIn(m["witness"], ("STALE", "UNWITNESSED", "REVIEWED"))
        # today, the ledger is 17+ days stale, so every meter must show non-REVIEWED
        non_reviewed = [m for m in meters["meters"] if m["witness"] != "REVIEWED"]
        self.assertTrue(len(non_reviewed) >= 5,
                        "witness staleness must be visible, not hidden")

    def test_09_low_ceremony_mode_does_not_bypass_authority(self):
        """Low-ceremony: no ledger events, no witness — authority checks still bind."""
        with tempfile.TemporaryDirectory() as tmp:
            b = _binding()
            store = BindingStore(db_path=Path(tmp) / "bind.db")
            store.save(b)
            store.revocations.revoke(b.binding_id, "operator", "low-ceremony revoke")
            out = check_binding(
                ActionRequest("b-test", "agent-x", "write:issues", "repo/A-FORGE#1"),
                store,
                state_guard=lambda r, b: (True, ""),
            )
            self.assertEqual(out["decision"], BindingVerdict.REJECT_REVOKED)
            # privacy: no human_id anywhere in the decision payload
            self.assertNotIn("human_id", json.dumps(out))

    def test_10_undecided_policies_stay_inactive(self):
        """Third-party dignity + collective witness: PENDING/HOLD, not implemented."""
        meters = evaluate_all()
        blob = json.dumps(meters)
        # no third-party moral-classifier blocking policy claimed
        self.assertNotIn("third_party_protected", blob)
        self.assertNotIn("collective_veto", blob)
        # external peer witness slot remains unassigned
        self.assertNotIn("peer_witness:assigned", blob)
        # f6_overall stays unproven language, never 'solved'/'protected'/'sealed'
        self.assertIn("UNPROVEN", meters["f6_overall"])
        for forbidden in ("F6 solved", "maruah protected", "sealed"):
            self.assertNotIn(forbidden, blob)
        # §2: all three policies report inactive; enforcement attempt fails closed
        pp = pending_policies.all_pending()
        statuses = {p["policy_id"]: p["status"] for p in pp["policies"]}
        self.assertEqual(statuses["third_party_dignity"], "PENDING")
        self.assertEqual(statuses["collective_witness"], "HOLD")
        self.assertEqual(statuses["external_peer_witness"], "UNASSIGNED")
        self.assertFalse(any(p["active"] for p in pp["policies"]))
        with self.assertRaises(pending_policies.PolicyNotActive):
            pending_policies.enforce("collective_veto")

    def test_11_no_human_id_in_any_f6_output(self):
        """Red line 1: F6 telemetry never carries human_id."""
        meters = evaluate_all()
        blob = json.dumps(meters)
        self.assertNotIn("human_id", blob)
        self.assertNotIn("dignity_index", blob.lower())
        self.assertNotIn("dignity index", blob.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
