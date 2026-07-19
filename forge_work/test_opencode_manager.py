"""
test_opencode_manager.py — Smoke tests for OpenCodeManager
Run with: python3 -m pytest test_opencode_manager.py -v
         OR: python3 test_opencode_manager.py

Uses dry_run=True for all spawn tests to avoid actually invoking opencode CLI.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Import the module under test
sys.path.insert(0, str(Path(__file__).parent))
from opencode_manager import (
    OpenCodeManager,
    SpawnReceipt,
    Session,
    KillReceipt,
    SpawnError,
    WorktreeError,
    KillError,
    _compute_event_hash,
    _append_jline,
)


class TestComputeEventHash(unittest.TestCase):
    """Test the hash computation helper."""

    def test_hash_is_deterministic(self):
        event = {"a": 1, "b": 2, "ts_utc": "2026-06-29T00:00:00Z"}
        h1 = _compute_event_hash(event)
        h2 = _compute_event_hash(event)
        self.assertEqual(h1, h2)
        self.assertTrue(h1.startswith("sha256:"))

    def test_hash_changes_on_different_input(self):
        e1 = {"a": 1}
        e2 = {"a": 2}
        self.assertNotEqual(_compute_event_hash(e1), _compute_event_hash(e2))


class TestSpawnCreatesWorktreeAndWitnessReceipt(unittest.TestCase):
    """Test 1: spawn creates worktree and witness receipt."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-test-")
        w = tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False)
        self.witness_path = w.name
        w.close()
        self.session_table = tempfile.mktemp(suffix=".jsonl")
        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )

    def tearDown(self):
        # Clean up worktree dir
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        if os.path.exists(self.witness_path):
            os.unlink(self.witness_path)
        if os.path.exists(self.session_table):
            os.unlink(self.session_table)

    def test_spawn_dryRun_creates_worktree(self):
        receipt = self.mgr.spawn(
            task="Test task for entropy reduction",
            actor="test-suite",
            authority_class="OPERATOR",
            dry_run=True,
        )
        self.assertIsInstance(receipt, SpawnReceipt)
        self.assertTrue(receipt.worktree_path.startswith(self.worktree_root))
        self.assertIn(receipt.verdict, ("SPAWNED", "DRY_RUN"))
        self.assertIn("forge-", receipt.session_id)

    def test_spawn_dryRun_creates_witness_receipt(self):
        receipt = self.mgr.spawn(
            task="Verify witness emission",
            actor="test-suite",
            dry_run=True,
        )
        with open(self.witness_path) as f:
            lines = [json.loads(l) for l in f if l.strip()]
        self.assertGreaterEqual(len(lines), 1)
        last = lines[-1]
        self.assertEqual(last["actor"], "test-suite")
        self.assertEqual(last["verdict"], "DRY_RUN")
        self.assertIn("event_hash", last)
        self.assertTrue(last["event_hash"].startswith("sha256:"))


class TestWitnessChainLinksToPriorEvent(unittest.TestCase):
    """Test 2: witness chain properly links to prior event hash."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-chain-")
        self.witness_path = tempfile.mktemp(suffix=".jsonl")
        self.session_table = tempfile.mktemp(suffix=".jsonl")

        # Pre-populate with a prior event
        prior_event = {
            "event_id": "FORGE-TEST-PRIOR-001",
            "actor": "prior-actor",
            "ts_utc": "2026-06-28T00:00:00Z",
            "session_id": "prior-session",
            "task": "prior task",
            "scope": "/tmp/prior",
            "authority_class": "OPERATOR",
            "verdict": "PRIOR",
            "f1_f13_status": "intact",
            "prior_event_hash": None,
        }
        prior_event["event_hash"] = _compute_event_hash(prior_event)
        with open(self.witness_path, "w") as f:
            f.write(json.dumps(prior_event, separators=(",", ":")) + "\n")

        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        for p in [self.witness_path, self.session_table]:
            if os.path.exists(p):
                os.unlink(p)

    def test_witness_chain_links_to_prior(self):
        receipt = self.mgr.spawn(
            task="Chain test",
            actor="chain-test",
            dry_run=True,
        )
        prior = receipt.prior_event_hash
        assert isinstance(prior, str), f"Expected str, got {type(prior)}"
        self.assertTrue(prior.startswith("sha256:"))

        with open(self.witness_path) as f:
            lines = [json.loads(l) for l in f if l.strip()]
        last = lines[-1]
        # prior_event_hash should link to the event_hash of the prior (first) entry
        self.assertEqual(last["prior_event_hash"], lines[0]["event_hash"])

    def test_first_entry_has_no_prior_hash(self):
        # Create fresh manager with empty ledger
        fresh_witness = tempfile.mktemp(suffix=".jsonl")
        fresh_session = tempfile.mktemp(suffix=".jsonl")
        fresh_worktree = tempfile.mkdtemp(prefix="forge-fresh-")
        mgr = OpenCodeManager(
            witness_path=fresh_witness,
            session_table=fresh_session,
            default_worktree_root=fresh_worktree,
        )
        receipt = mgr.spawn(task="First entry", actor="first-test", dry_run=True)
        self.assertIsNone(receipt.prior_event_hash)
        import shutil

        shutil.rmtree(fresh_worktree, ignore_errors=True)
        for p in [fresh_witness, fresh_session]:
            if os.path.exists(p):
                os.unlink(p)


class TestKillEmitsWitnessReceipt(unittest.TestCase):
    """Test 3: kill emits witness receipt."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-kill-")
        self.witness_path = tempfile.mktemp(suffix=".jsonl")
        self.session_table = tempfile.mktemp(suffix=".jsonl")
        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )
        # Spawn a dry_run session first
        self.spawn_receipt = self.mgr.spawn(
            task="Session to kill",
            actor="kill-test",
            dry_run=True,
        )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        for p in [self.witness_path, self.session_table]:
            if os.path.exists(p):
                os.unlink(p)

    def test_kill_emits_receipt(self):
        kill_receipt = self.mgr.kill(self.spawn_receipt.session_id, sig_name="SIGTERM")
        self.assertIsInstance(kill_receipt, KillReceipt)
        self.assertEqual(kill_receipt.session_id, self.spawn_receipt.session_id)
        self.assertEqual(kill_receipt.verdict, "KILLED")

        # Check the witness ledger
        with open(self.witness_path) as f:
            lines = [json.loads(l) for l in f if l.strip()]
        kill_entries = [l for l in lines if l.get("verdict") == "KILLED"]
        self.assertGreaterEqual(len(kill_entries), 1)
        last_kill = kill_entries[-1]
        self.assertIn("event_hash", last_kill)
        self.assertEqual(last_kill["signal_sent"], "SIGTERM")


class TestListSessionsFiltersDeadProcesses(unittest.TestCase):
    """Test 4: list_sessions filters dead processes correctly."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-list-")
        self.witness_path = tempfile.mktemp(suffix=".jsonl")
        self.session_table = tempfile.mktemp(suffix=".jsonl")
        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        for p in [self.witness_path, self.session_table]:
            if os.path.exists(p):
                os.unlink(p)

    def test_list_sessions_returns_all(self):
        # Spawn two sessions
        r1 = self.mgr.spawn(task="Session 1", actor="list-test", dry_run=True)
        r2 = self.mgr.spawn(task="Session 2", actor="list-test", dry_run=True)
        sessions = self.mgr.list_sessions()
        self.assertEqual(len(sessions), 2)

    def test_list_sessions_active_only_filters_dead(self):
        r1 = self.mgr.spawn(task="Real PID", actor="active-test", dry_run=True)
        sessions = self.mgr.list_sessions(active_only=True)
        # dry_run sessions have pid=0 so they should be filtered out
        # (our _is_process_alive(0) returns False since /proc/0 doesn't exist)
        self.assertEqual(len(sessions), 0)


class TestCivilizationClassRequiresHold(unittest.TestCase):
    """Test 5: CIVILIZATION class spawn requires 888_HOLD."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-civ-")
        self.witness_path = tempfile.mktemp(suffix=".jsonl")
        self.session_table = tempfile.mktemp(suffix=".jsonl")
        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        for p in [self.witness_path, self.session_table]:
            if os.path.exists(p):
                os.unlink(p)

    def test_civilization_without_hold_token_raises(self):
        with self.assertRaises(SpawnError) as ctx:
            self.mgr.spawn(
                task="Civilization class mission",
                actor="test",
                authority_class="CIVILIZATION",
                dry_run=True,
            )
        self.assertIn("888_HOLD", str(ctx.exception))

    def test_civilization_with_hold_token_succeeds(self):
        receipt = self.mgr.spawn(
            task="Civilization class mission",
            actor="test",
            authority_class="CIVILIZATION",
            extra_context={"hold_token": "stg_888_APPROVED"},
            dry_run=True,
        )
        self.assertIsInstance(receipt, SpawnReceipt)
        self.assertEqual(receipt.authority_class, "CIVILIZATION")


class TestSessionTableAppendOnly(unittest.TestCase):
    """Verify session table is append-only (no overwrite, no delete)."""

    def setUp(self):
        self.worktree_root = tempfile.mkdtemp(prefix="forge-append-")
        self.witness_path = tempfile.mktemp(suffix=".jsonl")
        self.session_table = tempfile.mktemp(suffix=".jsonl")
        self.mgr = OpenCodeManager(
            witness_path=self.witness_path,
            session_table=self.session_table,
            default_worktree_root=self.worktree_root,
        )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.worktree_root, ignore_errors=True)
        for p in [self.witness_path, self.session_table]:
            if os.path.exists(p):
                os.unlink(p)

    def test_session_table_grows(self):
        r1 = self.mgr.spawn(task="First", actor="append-test", dry_run=True)
        r2 = self.mgr.spawn(task="Second", actor="append-test", dry_run=True)
        self.mgr.kill(r1.session_id)
        with open(self.session_table) as f:
            lines = [l for l in f if l.strip()]
        # Should have: spawn, spawn, kill = 3 entries
        self.assertEqual(len(lines), 3)
        # Verify no line is ever deleted or overwritten
        # (reading twice should yield same count)
        with open(self.session_table) as f:
            lines2 = [l for l in f if l.strip()]
        self.assertEqual(lines, lines2)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Try pytest first
    try:
        import pytest

        sys.exit(pytest.main([__file__, "-v"]))
    except ImportError:
        # Fall back to unittest
        unittest.main(argv=[__file__], exit=False, verbosity=2)
