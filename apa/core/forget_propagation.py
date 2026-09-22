"""
apa/core/forget_propagation.py — WAJIB #21 Forget/Revocation Propagation
=======================================================================

When a fact is forgotten or a lease is revoked, downstream memory,
cache, and reasoning surfaces must be notified. This module is the
propagation registry — it records WHERE forget-events were sent, so
auditors can verify no zombie state persists.

Storage: SQLite at /root/A-FORGE/apa/state/forget_propagation.db
Reversibility: rm .db → revert.

DITEMPA BUKAN DIBERI — Forgetting is forged, not improvised.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_DB = Path("/root/A-FORGE/apa/state/forget_propagation.db")


@dataclass
class ForgetEvent:
    event_id: str
    target_fact_id: str           # The fact / lease / receipt being forgotten
    target_type: str              # "fact", "lease", "receipt", "memory"
    forget_reason: str            # "superseded", "expired", "revoked", "ttl"
    propagation_targets: List[str]  # subsystems notified
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class ForgetPropagation:
    def __init__(self, db_path: Path = DEFAULT_DB) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS forget_events (
                    event_id TEXT PRIMARY KEY,
                    target_fact_id TEXT NOT NULL,
                    target_type TEXT NOT NULL,
                    forget_reason TEXT NOT NULL,
                    propagation_targets_json TEXT DEFAULT '[]',
                    timestamp TEXT NOT NULL,
                    metadata_json TEXT DEFAULT '{}'
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_forget_target ON forget_events(target_fact_id)"
            )
            conn.commit()

    def emit(
        self,
        target_fact_id: str,
        target_type: str,
        forget_reason: str,
        propagation_targets: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ForgetEvent:
        ev = ForgetEvent(
            event_id=str(uuid.uuid4()),
            target_fact_id=target_fact_id,
            target_type=target_type,
            forget_reason=forget_reason,
            propagation_targets=propagation_targets or [],
            timestamp=datetime.now(timezone.utc).isoformat(),
            metadata=metadata or {},
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO forget_events
                (event_id, target_fact_id, target_type, forget_reason,
                 propagation_targets_json, timestamp, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    ev.event_id, ev.target_fact_id, ev.target_type,
                    ev.forget_reason, json.dumps(ev.propagation_targets),
                    ev.timestamp, json.dumps(ev.metadata),
                ),
            )
            conn.commit()
        return ev

    def history_for_target(self, target_fact_id: str) -> List[ForgetEvent]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM forget_events WHERE target_fact_id = ? ORDER BY timestamp",
                (target_fact_id,),
            ).fetchall()
        return [
            ForgetEvent(
                event_id=r["event_id"],
                target_fact_id=r["target_fact_id"],
                target_type=r["target_type"],
                forget_reason=r["forget_reason"],
                propagation_targets=json.loads(r["propagation_targets_json"] or "[]"),
                timestamp=r["timestamp"],
                metadata=json.loads(r["metadata_json"] or "{}"),
            )
            for r in rows
        ]

    def is_forgotten(self, target_fact_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM forget_events WHERE target_fact_id = ? LIMIT 1",
                (target_fact_id,),
            ).fetchone()
        return row is not None


__all__ = ["ForgetEvent", "ForgetPropagation", "DEFAULT_DB"]
