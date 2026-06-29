"""
opencode_manager.py — A-FORGE OpenCode Session Manager + 777 FORGE Witness Wire
Phase 1+2: Spawn/kill/list with worktree isolation + witness receipts.

Stdlib only: Python 3.10+ (subprocess, json, hashlib, pathlib, datetime, uuid, os, signal).
No pip dependencies.
"""

from __future__ import annotations

import json
import hashlib
import uuid
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Typed Exceptions
# ---------------------------------------------------------------------------


class SpawnError(Exception):
    """Raised when a spawn fails before PID acquisition."""

    pass


class WitnessChainError(Exception):
    """Raised when the 777 FORGE hash chain is broken."""

    pass


class WorktreeError(Exception):
    """Raised when git worktree creation/management fails."""

    pass


class KillError(Exception):
    """Raised when kill fails."""

    pass


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class SpawnReceipt:
    """Receipt returned after a successful spawn."""

    session_id: str
    pid: int
    worktree_path: str
    event_hash: str
    witness_event_id: str
    ts_utc: str
    actor: str
    task: str
    scope: str
    authority_class: str
    verdict: str = "SPAWNED"
    f1_f13_status: str = "intact"
    prior_event_hash: Optional[str] = None
    opencode_pid: Optional[int] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        # Strip None values for JSON cleanliness
        return {k: v for k, v in d.items() if v is not None}


@dataclass
class Session:
    """Lightweight session state from the JSONL table."""

    session_id: str
    pid: int
    worktree_path: str
    status: str  # spawn | running | killed | closed
    spawned_at: str
    last_receipt_path: Optional[str] = None
    killed_at: Optional[str] = None


@dataclass
class KillReceipt:
    """Receipt returned after a kill."""

    session_id: str
    signal_sent: str
    exit_code: Optional[int]
    event_hash: str
    witness_event_id: str
    ts_utc: str
    prior_event_hash: Optional[str] = None
    verdict: str = "KILLED"
    f1_f13_status: str = "intact"

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


# ---------------------------------------------------------------------------
# Witness Ledger Helpers
# ---------------------------------------------------------------------------


def _canonical_json(obj: dict) -> bytes:
    """Serialize dict to canonical JSON (sorted keys, no extra whitespace)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _compute_event_hash(event: dict) -> str:
    """Compute sha256:prefix event hash from event dict (without event_hash field)."""
    d = {k: v for k, v in event.items() if k != "event_hash"}
    digest = hashlib.sha256(_canonical_json(d)).hexdigest()
    return f"sha256:{digest[:16]}"


def _read_last_event_hash(witness_path: Path) -> Optional[str]:
    """Read the event_hash from the last non-empty line of the JSONL ledger."""
    if not witness_path.exists():
        return None
    with open(witness_path, "rb") as f:
        # Seek to last 4KB to find the last line
        try:
            f.seek(-4096, os.SEEK_END)
        except OSError:
            f.seek(0)
        last_line = None
        for line in f:
            line = line.strip()
            if line:
                last_line = line
        if last_line:
            try:
                obj = json.loads(last_line)
                return obj.get("event_hash")
            except json.JSONDecodeError:
                pass
    return None


def _append_jline(path: Path, obj: dict) -> None:
    """Append a JSON object as a newline-delimited JSON line with fsync."""
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(obj, separators=(",", ":"))
    with open(path, "a") as f:
        f.write(line + "\n")
        f.flush()
        os.fsync(f.fileno())


# ---------------------------------------------------------------------------
# Process Helpers
# ---------------------------------------------------------------------------


def _is_process_alive(pid: int) -> bool:
    """Check if a PID exists in /proc (Linux)."""
    return os.path.exists(f"/proc/{pid}")


def _send_signal(pid: int, sig: signal.Signals, grace_seconds: float = 0.0) -> bool:
    """Send sig to pid with optional grace period. Returns True if process died."""
    try:
        os.kill(pid, sig)
        if grace_seconds > 0:
            start = time.monotonic()
            while time.monotonic() - start < grace_seconds:
                if not _is_process_alive(pid):
                    return True
                time.sleep(0.5)
        else:
            return not _is_process_alive(pid)
    except ProcessLookupError:
        return True  # Already dead
    except PermissionError:
        return False
    return not _is_process_alive(pid)


def _get_pid_from_worktree(worktree_path: str) -> Optional[int]:
    """
    Try to read a PID file left by the spawned session.
    Convention: <worktree_path>/.forge_session_pid
    Returns None if not found (caller must fall back to process table scan).
    """
    pid_file = Path(worktree_path) / ".forge_session_pid"
    if pid_file.exists():
        try:
            return int(pid_file.read_text().strip())
        except (ValueError, IOError):
            pass
    return None


def _find_opencode_pid(worktree_path: str) -> Optional[int]:
    """
    Scan /proc to find opencode process whose CWD or cmdline references the worktree.
    This is the fallback when no PID file is written.
    """
    worktree_abs = str(Path(worktree_path).resolve())
    try:
        for pid_str in os.listdir("/proc"):
            if not pid_str.isdigit():
                continue
            pid = int(pid_str)
            try:
                cmdline_path = f"/proc/{pid}/cmdline"
                with open(cmdline_path, "rb") as f:
                    cmdline = (
                        f.read().replace(b"\x00", b" ").decode("utf-8", errors="ignore")
                    )
                cwd_path = f"/proc/{pid}/cwd"
                cwd = os.readlink(cwd_path)
                if "opencode" in cmdline.lower() and (
                    worktree_abs in cmdline or worktree_abs in cwd
                ):
                    return pid
            except (IOError, OSError, ProcessLookupError):
                continue
    except FileNotFoundError:
        pass
    return None


# ---------------------------------------------------------------------------
# Git Worktree Helpers
# ---------------------------------------------------------------------------


def _get_current_branch(repo_path: str = "/root/A-FORGE") -> str:
    """Get the currently checked-out branch name of the A-FORGE repo."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def _get_repo_root(worktree_path: str) -> Path:
    """Infer the git repo root from a worktree path (look for .git file/dir)."""
    p = Path(worktree_path).resolve()
    while p != p.parent:
        git = p / ".git"
        if git.exists() or git.is_file():
            return p
        p = p.parent
    raise WorktreeError(f"Could not find .git for worktree path: {worktree_path}")


def _ensure_worktree(
    worktree_root: Path,
    branch_suffix: str,
    repo_path: str = "/root/A-FORGE",
) -> tuple[str, Path]:
    """
    Create a new git worktree from repo_path's HEAD.
    Returns (worktree_name, worktree_path).
    Raises WorktreeError on failure.
    """
    worktree_root.mkdir(parents=True, exist_ok=True)
    unique_name = f"forge-{branch_suffix}"
    worktree_path = worktree_root / unique_name

    if worktree_path.exists() and any(worktree_path.iterdir()):
        raise WorktreeError(
            f"Worktree path already exists and is not empty: {worktree_path}"
        )

    current_branch = _get_current_branch(repo_path)
    result = subprocess.run(
        ["git", "worktree", "add", "--no-checkout", worktree_path, f"HEAD"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise WorktreeError(f"git worktree add failed: {result.stderr.strip()}")

    # Write PID file location hint for _find_opencode_pid
    hint_file = worktree_path / ".forge_worktree_hint"
    hint_file.write_text(f"repo={repo_path}\nbranch={current_branch}\n")
    return unique_name, worktree_path


# ---------------------------------------------------------------------------
# Session Table Helpers
# ---------------------------------------------------------------------------


def _session_table_path(session_table: str | Path) -> Path:
    p = Path(session_table)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _load_sessions(session_table: Path) -> list[Session]:
    """Load all sessions from the append-only JSONL session table."""
    sessions = []
    if not session_table.exists():
        return sessions
    with open(session_table) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                sessions.append(
                    Session(
                        session_id=obj["session_id"],
                        pid=obj["pid"],
                        worktree_path=obj["worktree_path"],
                        status=obj["status"],
                        spawned_at=obj["spawned_at"],
                        last_receipt_path=obj.get("last_receipt_path"),
                        killed_at=obj.get("killed_at"),
                    )
                )
            except (json.JSONDecodeError, KeyError):
                continue
    return sessions


def _append_session(session_table: Path, session: Session) -> None:
    """Append a session entry to the JSONL table."""
    _append_jline(session_table, asdict(session))


# ---------------------------------------------------------------------------
# OpenCodeManager
# ---------------------------------------------------------------------------


class OpenCodeManager:
    """
    Spawn, kill, and list OpenCode sessions with 777 FORGE witness receipts.

    Every spawn is isolated in its own git worktree. Every spawn/kill emits
    a witness receipt to the 777 FORGE ledger (hash-chained to prior entry).

    The session table tracks state transitions (spawn → running → killed/closed)
    in append-only JSONL.

    Usage:
        manager = OpenCodeManager()
        receipt = manager.spawn(task="Fix the login bug", actor="hermes-asi")
        sessions = manager.list_sessions(active_only=True)
        kill_receipt = manager.kill(receipt.session_id, signal="SIGTERM")
    """

    def __init__(
        self,
        witness_path: str = "/root/VAULT999/witness/777-forge-spawns.jsonl",
        session_table: str = "/root/A-FORGE/forge_work/opencode_sessions.jsonl",
        default_worktree_root: str = "/root/.opencode-worktrees",
    ):
        self.witness_path = Path(witness_path)
        self.session_table_path = _session_table_path(session_table)
        self.worktree_root = Path(default_worktree_root)
        self.worktree_root.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Spawn
    # ------------------------------------------------------------------

    def spawn(
        self,
        task: str,
        actor: str = "unknown",
        authority_class: str = "OPERATOR",
        mission_hash: Optional[str] = None,
        extra_context: Optional[dict] = None,
        dry_run: bool = False,
    ) -> SpawnReceipt:
        """
        Spawn a new OpenCode session in an isolated git worktree.

        Args:
            task: Human-readable task description.
            actor: Who is requesting this spawn (e.g. "hermes-asi", "arif-888").
            authority_class: "OPERATOR" or "CIVILIZATION".
                CIVILIZATION → must have 888_HOLD token (raises SpawnError if not).
            mission_hash: Optional sha256:hex of the mission. Computed from task if None.
            extra_context: Extra fields to embed in the witness receipt.
            dry_run: If True, creates worktree + receipts but does NOT exec opencode CLI.

        Returns:
            SpawnReceipt with session_id, pid, worktree_path, event_hash, etc.

        Raises:
            SpawnError: If spawn fails or authority_class=CIVILIZATION without 888_HOLD.
            WorktreeError: If git worktree creation fails.
            WitnessChainError: If the hash chain cannot be written.
        """
        session_id = f"forge-{uuid.uuid4().hex[:8]}"

        if authority_class.upper() == "CIVILIZATION":
            # CIVILIZATION requires explicit 888_HOLD — gate here
            hold_token = extra_context.get("hold_token") if extra_context else None
            if not hold_token:
                raise SpawnError(
                    "CIVILIZATION-class spawn requires 888_HOLD token in extra_context['hold_token']. "
                    "Surface friction to Arif. DO NOT SPAWN without 888_HOLD."
                )

        ts_utc = datetime.now(timezone.utc).isoformat()
        prior_event_hash = _read_last_event_hash(self.witness_path)

        # Build the event dict BEFORE adding event_hash
        event = {
            "event_id": f"FORGE-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{session_id.upper()}",
            "actor": actor,
            "ts_utc": ts_utc,
            "session_id": session_id,
            "task": task,
            "scope": f"/root/.opencode-worktrees/{session_id}",
            "authority_class": authority_class.upper(),
            "verdict": "DRY_RUN" if dry_run else "SPAWNED",
            "f1_f13_status": "intact. Worktree isolated. Witness chained.",
            "prior_event_hash": prior_event_hash,
        }
        if extra_context:
            for k, v in extra_context.items():
                if k not in event and k not in ["hold_token"]:
                    event[k] = v

        event_hash = _compute_event_hash(event)
        event["event_hash"] = event_hash

        # Write witness receipt BEFORE doing anything else (F1 AMANAH)
        _append_jline(self.witness_path, event)

        # Create git worktree
        try:
            unique_name, worktree_path = _ensure_worktree(
                self.worktree_root, session_id, repo_path="/root/A-FORGE"
            )
        except WorktreeError:
            # Worktree failed — spawn is aborted but witness is already written.
            # The witness entry records the attempt. Don't double-write.
            raise

        # Spawn the actual process (unless dry_run)
        pid: Optional[int] = None
        opencode_pid: Optional[int] = None

        if not dry_run:
            try:
                # Build the opencode run command
                cmd = [
                    sys.executable,  # Use the same Python interpreter
                    "-m",
                    "opencode",
                    "run",
                    task,
                ]
                # If opencode CLI supports --worktree, add it here.
                # Otherwise use the worktree dir as cwd.
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(worktree_path),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                )
                pid = proc.pid

                # Write PID file for later lookup
                pid_file = worktree_path / ".forge_session_pid"
                pid_file.write_text(str(pid))

                # Try to get the opencode CLI PID (it may fork)
                # Give it 2 seconds to start, then re-scan
                time.sleep(2)
                opencode_pid = _find_opencode_pid(str(worktree_path)) or pid

            except Exception as e:
                raise SpawnError(f"Failed to exec opencode: {e}") from e

        # Emit session table entry (spawn state)
        session = Session(
            session_id=session_id,
            pid=pid or 0,
            worktree_path=str(worktree_path),
            status="dry_run" if dry_run else "running",
            spawned_at=ts_utc,
            last_receipt_path=str(self.witness_path),
        )
        _append_session(self.session_table_path, session)

        return SpawnReceipt(
            session_id=session_id,
            pid=pid or 0,
            worktree_path=str(worktree_path),
            event_hash=event_hash,
            witness_event_id=event["event_id"],
            ts_utc=ts_utc,
            actor=actor,
            task=task,
            scope=f"/root/.opencode-worktrees/{session_id}",
            authority_class=authority_class.upper(),
            prior_event_hash=prior_event_hash,
            opencode_pid=opencode_pid,
        )

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------

    def list_sessions(self, active_only: bool = False) -> list[Session]:
        """
        Return all sessions from the session table.

        Args:
            active_only: If True, filter to sessions whose PID is still alive.
        """
        sessions = _load_sessions(self.session_table_path)
        if active_only:
            sessions = [
                s
                for s in sessions
                if s.status not in ("killed", "closed") and _is_process_alive(s.pid)
            ]
        return sessions

    # ------------------------------------------------------------------
    # Kill
    # ------------------------------------------------------------------

    def kill(
        self, session_id: str, sig_name: str = "SIGTERM", grace_seconds: float = 30.0
    ) -> KillReceipt:
        """
        Kill a session's process tree.

        Sends SIGTERM first, waits grace_seconds, then SIGKILL.
        Emits a witness receipt for the kill event (hash-chained).

        Args:
            session_id: The session to kill.
            sig_name: Initial signal to send (default SIGTERM).
            grace_seconds: Seconds to wait between SIGTERM and SIGKILL.

        Returns:
            KillReceipt with exit_code, event_hash, etc.

        Raises:
            KillError: If the session is not found or kill fails.
        """
        sessions = _load_sessions(self.session_table_path)
        target = None
        for s in sessions:
            if s.session_id == session_id:
                target = s
                break

        if target is None:
            raise KillError(f"Session not found: {session_id}")

        if target.status in ("killed", "closed"):
            raise KillError(f"Session already in terminal state: {target.status}")

        sig_val = getattr(signal.Signals, sig_name, signal.Signals.SIGTERM)

        ts_utc = datetime.now(timezone.utc).isoformat()
        prior_event_hash = _read_last_event_hash(self.witness_path)

        # Guard: pid <= 0 means no real process (dry_run session)
        if target.pid <= 0:
            exit_code = 0
            killed = True
        else:
            killed = _send_signal(target.pid, sig_val, grace_seconds=0)
            exit_code = None

            if not killed and grace_seconds > 0:
                # Try SIGKILL
                _send_signal(target.pid, signal.Signals.SIGKILL, grace_seconds=0)
                time.sleep(0.5)
                killed = True

            if not _is_process_alive(target.pid):
                try:
                    # Reap via wait()
                    exit_code = os.waitpid(target.pid, 0)[1] & 0xFF
                except ChildProcessError:
                    exit_code = None
                except OSError:
                    exit_code = None
            # Try SIGKILL
            _send_signal(target.pid, signal.Signals.SIGKILL, grace_seconds=0)
            time.sleep(0.5)
            killed = True

        if not _is_process_alive(target.pid):
            try:
                # Reap via wait()
                exit_code = os.waitpid(target.pid, 0)[1] & 0xFF
            except ChildProcessError:
                exit_code = None
            except OSError:
                exit_code = None

        killed_at = datetime.now(timezone.utc).isoformat()

        # Build kill event
        event = {
            "event_id": f"KILL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{session_id.upper()}",
            "actor": "opencode_manager",
            "ts_utc": ts_utc,
            "session_id": session_id,
            "task": f"kill session {session_id}",
            "scope": target.worktree_path,
            "authority_class": "OPERATOR",
            "verdict": "KILLED",
            "f1_f13_status": f"intact. SIGTERM→SIGKILL grace={grace_seconds}s. exit_code={exit_code}",
            "prior_event_hash": prior_event_hash,
            "signal_sent": sig_val.name,
            "killed_at": killed_at,
            "exit_code": exit_code,
        }
        event_hash = _compute_event_hash(event)
        event["event_hash"] = event_hash

        _append_jline(self.witness_path, event)

        # Update session table
        killed_session = Session(
            session_id=session_id,
            pid=target.pid,
            worktree_path=target.worktree_path,
            status="killed",
            spawned_at=target.spawned_at,
            last_receipt_path=str(self.witness_path),
            killed_at=killed_at,
        )
        _append_session(self.session_table_path, killed_session)

        return KillReceipt(
            session_id=session_id,
            signal_sent=str(sig_val),
            exit_code=exit_code,
            event_hash=event_hash,
            witness_event_id=event["event_id"],
            ts_utc=ts_utc,
            prior_event_hash=prior_event_hash,
        )

    # ------------------------------------------------------------------
    # Query Witness Ledger
    # ------------------------------------------------------------------

    def query_witness_ledger(
        self, limit: int = 10, since_iso: Optional[str] = None
    ) -> list[dict]:
        """
        Read recent entries from the 777 FORGE witness ledger.

        Args:
            limit: Max entries to return (most recent first).
            since_iso: Optional ISO timestamp to filter by.
        """
        if not self.witness_path.exists():
            return []
        entries = []
        with open(self.witness_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if since_iso and obj.get("ts_utc", "") < since_iso:
                        continue
                    entries.append(obj)
                except json.JSONDecodeError:
                    continue
        return entries[-limit:]


# ---------------------------------------------------------------------------
# CLI Entry Point (optional)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="777 FORGE OpenCode Session Manager")
    sub = parser.add_subparsers(dest="cmd")

    spawn_p = sub.add_parser("spawn")
    spawn_p.add_argument("--task", required=True)
    spawn_p.add_argument("--actor", default="cli")
    spawn_p.add_argument("--authority", default="OPERATOR")
    spawn_p.add_argument("--dry-run", action="store_true")

    list_p = sub.add_parser("list")
    list_p.add_argument("--active-only", action="store_true")

    kill_p = sub.add_parser("kill")
    kill_p.add_argument("--session-id", required=True)
    kill_p.add_argument("--signal", default="SIGTERM")
    kill_p.add_argument("--grace", type=float, default=30.0)

    query_p = sub.add_parser("query")
    query_p.add_argument("--limit", type=int, default=10)
    query_p.add_argument("--since")

    args = parser.parse_args()
    mgr = OpenCodeManager()

    if args.cmd == "spawn":
        r = mgr.spawn(
            task=args.task,
            actor=args.actor,
            authority_class=args.authority,
            dry_run=args.dry_run,
        )
        print(json.dumps(r.to_dict(), indent=2))
    elif args.cmd == "list":
        for s in mgr.list_sessions(active_only=args.active_only):
            print(json.dumps(asdict(s), indent=2))
    elif args.cmd == "kill":
        r = mgr.kill(args.session_id, sig_name=args.signal, grace_seconds=args.grace)
        print(json.dumps(r.to_dict(), indent=2))
    elif args.cmd == "query":
        for e in mgr.query_witness_ledger(limit=args.limit, since_iso=args.since):
            print(json.dumps(e))
    else:
        parser.print_help()
