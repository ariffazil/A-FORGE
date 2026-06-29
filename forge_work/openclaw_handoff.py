"""
openclaw_handoff.py — OpenCode → OpenClaw handoff bridge.

Triggered when opencode_sessions.jsonl has new entry with
status='closed_with_artifacts'. Packages worktree artifacts,
emits handoff receipt to OpenClaw receipt log.

Stdlib only (no pip).
Append-only handoff-receipts.jsonl.
Hash chain links to 777-forge-spawns.jsonl (federation lineage).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

WORKTREE_ROOT = Path("/root/.opencode-worktrees")
SESSION_TABLE = Path("/root/A-FORGE/forge_work/opencode_sessions.jsonl")
HANDOFF_RECEIPTS = Path("/root/.openclaw/runs/handoff-receipts.jsonl")
PRIOR_RECEIPT_LOG = Path("/root/VAULT999/witness/777-forge-spawns.jsonl")


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class HandoffReceipt:
    handoff_id: str
    session_id: str
    worktree_path: str
    artifacts: list
    ts_utc: str
    prior_event_hash: str
    event_hash: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sha256_prefix(data: str) -> str:
    return f"sha256:{hashlib.sha256(data.encode()).hexdigest()[:16]}"


def _read_last_receipt_hash() -> str:
    """Read tail of prior receipt log for hash chain."""
    if not PRIOR_RECEIPT_LOG.exists():
        return "sha256:0000000000000000"
    try:
        text = PRIOR_RECEIPT_LOG.read_text().strip()
        if not text:
            return "sha256:0000000000000000"
        lines = text.splitlines()
        last_line = lines[-1]
        obj = json.loads(last_line)
        return obj.get("event_hash", "sha256:0000000000000000")
    except (json.JSONDecodeError, OSError):
        return "sha256:0000000000000000"


def _append_jline(path: Path, obj: dict) -> None:
    """Append a JSON object as a newline-delimited JSON line."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        line = json.dumps(obj, separators=(",", ":"))
        fh.write(line + "\n")
        fh.flush()
        os.fsync(fh.fileno())


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------


def detect_new_closures(last_seen_line: int = 0) -> list:
    """
    Return session closures (status='closed_with_artifacts') since last_seen_line.

    Returns:
        List of (line_index, session_obj) tuples.
    """
    if not SESSION_TABLE.exists():
        return []
    try:
        text = SESSION_TABLE.read_text().strip()
        if not text:
            return []
    except OSError:
        return []

    lines = text.splitlines()
    closures = []
    for i, line in enumerate(lines):
        if i < last_seen_line:
            continue
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            if obj.get("status") == "closed_with_artifacts":
                closures.append((i, obj))
        except json.JSONDecodeError:
            continue
    return closures


def collect_artifacts(worktree: Path) -> list:
    """
    Collect all files under worktree, computing sha256 hash for each.

    Skips: .git, node_modules, __pycache__, .venv, dist, build.
    Returns list of artifact dicts with path, sha256_prefix, size_bytes.
    """
    SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
    artifacts = []
    for p in worktree.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        try:
            content = p.read_bytes()
            digest = hashlib.sha256(content).hexdigest()[:16]
            artifacts.append(
                {
                    "path": str(p.relative_to(worktree)),
                    "sha256_prefix": f"sha256:{digest}",
                    "size_bytes": len(content),
                }
            )
        except (PermissionError, OSError):
            continue
    return artifacts


def emit_handoff(
    session_id: str,
    worktree_path: str,
    artifacts: list,
    prior_hash: str,
    ts_utc: str,
) -> HandoffReceipt:
    """
    Emit a handoff receipt (hash-chained to prior event).

    Writes to HANDOFF_RECEIPTS (append-only, fsynced).
    """
    handoff_id = f"HANDOFF-{ts_utc.replace(':', '').replace('-', '')[:15]}"

    receipt_core = {
        "handoff_id": handoff_id,
        "session_id": session_id,
        "worktree_path": worktree_path,
        "artifacts": artifacts,
        "ts_utc": ts_utc,
        "prior_event_hash": prior_hash,
    }
    event_hash = _sha256_prefix(json.dumps(receipt_core, sort_keys=True))
    receipt_core["event_hash"] = event_hash

    _append_jline(HANDOFF_RECEIPTS, receipt_core)

    return HandoffReceipt(
        handoff_id=handoff_id,
        session_id=session_id,
        worktree_path=worktree_path,
        artifacts=artifacts,
        ts_utc=ts_utc,
        prior_event_hash=prior_hash,
        event_hash=event_hash,
    )


def process_closures(last_seen_line: int = 0, dry_run: bool = False) -> list:
    """
    Process new closures since last_seen_line.

    Args:
        last_seen_line: Resume from this line index.
        dry_run: If True, logs without writing to HANDOFF_RECEIPTS.

    Returns:
        List of HandoffReceipt (or mock dicts if dry_run).
    """
    closures = detect_new_closures(last_seen_line)
    if not closures:
        return []

    receipts = []
    prior_hash = _read_last_receipt_hash()
    ts_utc = datetime.now(timezone.utc).isoformat()

    for line_no, closure in closures:
        worktree = Path(closure["worktree_path"])
        if not worktree.exists():
            continue
        artifacts = collect_artifacts(worktree)

        if dry_run:
            mock_receipt = {
                "handoff_id": f"DRYRUN-{line_no}",
                "session_id": closure["session_id"],
                "worktree_path": closure["worktree_path"],
                "artifacts": artifacts,
                "ts_utc": ts_utc,
                "prior_event_hash": prior_hash,
                "event_hash": "sha256:DRYRUN",
            }
            receipts.append(mock_receipt)
        else:
            receipt = emit_handoff(
                session_id=closure["session_id"],
                worktree_path=closure["worktree_path"],
                artifacts=artifacts,
                prior_hash=prior_hash,
                ts_utc=ts_utc,
            )
            receipts.append(receipt)
            prior_hash = receipt.event_hash

    return receipts


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    last_line = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    dry_run = "--dry-run" in sys.argv

    receipts = process_closures(last_line, dry_run=dry_run)
    print(f"Processed {len(receipts)} handoff(s)")

    for r in receipts:
        n = len(r.artifacts) if hasattr(r, "artifacts") else len(r.get("artifacts", []))
        path = (
            r.worktree_path
            if hasattr(r, "worktree_path")
            else r.get("worktree_path", "?")
        )
        sid = r.session_id if hasattr(r, "session_id") else r.get("session_id", "?")
        print(f"  {sid} → {path} ({n} artifacts)")
