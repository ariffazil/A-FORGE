"""
test_openclaw_handoff.py — Smoke tests for openclaw_handoff.py.
Run: python3 /root/A-FORGE/forge_work/test_openclaw_handoff.py

Tests use tempfile isolation — no live session_table touched.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "/root/A-FORGE/forge_work")
import openclaw_handoff


def test_collect_artifacts_skips_dot_git():
    """Artifact collector skips .git, node_modules, __pycache__."""
    with tempfile.TemporaryDirectory() as tmp:
        wt = Path(tmp)
        (wt / "src").mkdir()
        (wt / "src" / "main.py").write_text("print('hi')")
        (wt / ".git").mkdir()
        (wt / ".git" / "config").write_text("should be skipped")
        (wt / "__pycache__").mkdir()
        (wt / "__pycache__" / "byte.pyc").write_bytes(b"bytecode")
        artifacts = openclaw_handoff.collect_artifacts(wt)
        paths = [a["path"] for a in artifacts]
        assert "src/main.py" in paths, f"main.py missing: {paths}"
        assert not any(".git" in p for p in paths), ".git leaked into artifacts"
        assert not any("__pycache__" in p for p in paths), "__pycache__ leaked"
    print("\u2713 test_collect_artifacts_skips_dot_git")


def test_handoff_receipt_hash_chained():
    """Handoff receipts are hash-chained: receipt2.prior = receipt1.event_hash."""
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_receipt = Path(f.name)
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_prior = Path(f.name)

    try:
        # Pre-populate prior log with a fake event
        prior_event = {
            "event_id": "FORGE-PRIOR-001",
            "ts_utc": "2026-06-28T00:00:00Z",
            "event_hash": "sha256:abcdef0123456789",
        }
        tmp_prior.write_text(json.dumps(prior_event) + "\n")

        # Monkey-patch paths
        orig_receipts = openclaw_handoff.HANDOFF_RECEIPTS
        orig_prior = openclaw_handoff.PRIOR_RECEIPT_LOG
        openclaw_handoff.HANDOFF_RECEIPTS = tmp_receipt
        openclaw_handoff.PRIOR_RECEIPT_LOG = tmp_prior

        r1 = openclaw_handoff.emit_handoff(
            session_id="s1",
            worktree_path="/tmp/wt1",
            artifacts=[{"path": "a.py", "sha256_prefix": "sha256:abc"}],
            prior_hash="sha256:abcdef0123456789",
            ts_utc="2026-06-29T10:00:00Z",
        )
        assert r1.event_hash.startswith("sha256:")
        assert r1.prior_event_hash == "sha256:abcdef0123456789"

        r2 = openclaw_handoff.emit_handoff(
            session_id="s2",
            worktree_path="/tmp/wt2",
            artifacts=[],
            prior_hash=r1.event_hash,
            ts_utc="2026-06-29T10:01:00Z",
        )
        assert r2.prior_event_hash == r1.event_hash

        # Verify the chain is written to the receipt log
        lines = tmp_receipt.read_text().strip().splitlines()
        assert len(lines) == 2
        obj1, obj2 = [json.loads(l) for l in lines]
        assert obj2["prior_event_hash"] == obj1["event_hash"]

        openclaw_handoff.HANDOFF_RECEIPTS = orig_receipts
        openclaw_handoff.PRIOR_RECEIPT_LOG = orig_prior
    finally:
        tmp_receipt.unlink(missing_ok=True)
        tmp_prior.unlink(missing_ok=True)

    print("\u2713 test_handoff_receipt_hash_chained")


def test_detect_new_closures_filters_correctly():
    """Only status='closed_with_artifacts' entries are detected."""
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_session = Path(f.name)

    try:
        tmp_session.write_text(
            '{"session_id": "s1", "status": "running"}\n'
            '{"session_id": "s2", "status": "closed"}\n'
            '{"session_id": "s3", "status": "closed_with_artifacts", "worktree_path": "/tmp/wt3"}\n'
        )

        orig_table = openclaw_handoff.SESSION_TABLE
        openclaw_handoff.SESSION_TABLE = tmp_session

        closures = openclaw_handoff.detect_new_closures(0)
        assert len(closures) == 1, f"Expected 1 closure, got {len(closures)}"
        assert closures[0][1]["session_id"] == "s3"

        openclaw_handoff.SESSION_TABLE = orig_table
    finally:
        tmp_session.unlink(missing_ok=True)

    print("\u2713 test_detect_new_closures_filters_correctly")


def test_process_closures_dry_run_no_write():
    """dry_run=True does not write to HANDOFF_RECEIPTS."""
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_session = Path(f.name)
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_receipt = Path(f.name)
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        tmp_prior = Path(f.name)

    try:
        tmp_session.write_text(
            '{"session_id": "dry1", "status": "closed_with_artifacts", "worktree_path": "/tmp"}'
            + "\n"
        )
        tmp_prior.write_text(
            '{"event_id": "x", "event_hash": "sha256:0000000000000000"}\n'
        )

        orig_table = openclaw_handoff.SESSION_TABLE
        orig_receipts = openclaw_handoff.HANDOFF_RECEIPTS
        orig_prior = openclaw_handoff.PRIOR_RECEIPT_LOG
        openclaw_handoff.SESSION_TABLE = tmp_session
        openclaw_handoff.HANDOFF_RECEIPTS = tmp_receipt
        openclaw_handoff.PRIOR_RECEIPT_LOG = tmp_prior

        receipts = openclaw_handoff.process_closures(0, dry_run=True)
        assert len(receipts) == 1
        assert receipts[0]["handoff_id"].startswith("DRYRUN")

        # Verify NOTHING was appended to the receipt log
        content = tmp_receipt.read_text()
        assert content.strip() == "", f"dry_run wrote to receipt log: {content}"

        openclaw_handoff.SESSION_TABLE = orig_table
        openclaw_handoff.HANDOFF_RECEIPTS = orig_receipts
        openclaw_handoff.PRIOR_RECEIPT_LOG = orig_prior
    finally:
        for p in [tmp_session, tmp_receipt, tmp_prior]:
            p.unlink(missing_ok=True)

    print("\u2713 test_process_closures_dry_run_no_write")


if __name__ == "__main__":
    test_collect_artifacts_skips_dot_git()
    test_handoff_receipt_hash_chained()
    test_detect_new_closures_filters_correctly()
    test_process_closures_dry_run_no_write()
    print("\n4/4 PASS")
