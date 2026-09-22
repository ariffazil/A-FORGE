"""
apa/core/revocation.py — WAJIB #7 Revocation Mechanism
========================================================

Authority to act expires. When expiry triggers, the revocation
mechanism must (a) prevent further actions under that lease,
(b) record the revocation event as an immutable receipt, and
(c) propagate to downstream subsystems.

This module is the substrate; enforcement happens at the APA gate.
Reversibility: rm the SQLite .db → revert.

DITEMPA BUKAN DIBERI — Revocation is forged, not improvised.
"""

from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional


DEFAULT_DB = Path("/root/A-FORGE/apa/state/revocations.db")


@dataclass
class Revocation:
    revocation_id: str
    lease_id: str
    actor_id: str
    reason: str
    revoked_at: str  # ISO UTC
    propagated_to: List[str]

    def to_dict(self) -> dict:
        return asdict(self)


class RevocationMechanism:
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
                CREATE TABLE IF NOT EXISTS revocations (
                    revocation_id TEXT PRIMARY KEY,
                    lease_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    revoked_at TEXT NOT NULL,
                    propagated_to_json TEXT DEFAULT '[]'
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_revocations_lease ON revocations(lease_id)"
            )
            conn.commit()

    def revoke(
        self,
        lease_id: str,
        actor_id: str,
        reason: str,
        propagated_to: Optional[List[str]] = None,
    ) -> Revocation:
        rev = Revocation(
            revocation_id=str(uuid.uuid4()),
            lease_id=lease_id,
            actor_id=actor_id,
            reason=reason,
            revoked_at=datetime.now(timezone.utc).isoformat(),
            propagated_to=propagated_to or [],
        )
        import json as _json
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO revocations
                (revocation_id, lease_id, actor_id, reason, revoked_at, propagated_to_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (rev.revocation_id, rev.lease_id, rev.actor_id, rev.reason,
                 rev.revoked_at, _json.dumps(rev.propagated_to)),
            )
            conn.commit()
        return rev

    def is_revoked(self, lease_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM revocations WHERE lease_id = ? LIMIT 1",
                (lease_id,),
            ).fetchone()
        return row is not None

    def get_for_lease(self, lease_id: str) -> Optional[Revocation]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM revocations WHERE lease_id = ? ORDER BY revoked_at DESC LIMIT 1",
                (lease_id,),
            ).fetchone()
        if row is None:
            return None
        import json as _json
        return Revocation(
            revocation_id=row["revocation_id"],
            lease_id=row["lease_id"],
            actor_id=row["actor_id"],
            reason=row["reason"],
            revoked_at=row["revoked_at"],
            propagated_to=_json.loads(row["propagated_to_json"] or "[]"),
        )

    def list_active(self) -> List[Revocation]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM revocations ORDER BY revoked_at DESC"
            ).fetchall()
        import json as _json
        return [
            Revocation(
                revocation_id=r["revocation_id"],
                lease_id=r["lease_id"],
                actor_id=r["actor_id"],
                reason=r["reason"],
                revoked_at=r["revoked_at"],
                propagated_to=_json.loads(r["propagated_to_json"] or "[]"),
            )
            for r in rows
        ]


__all__ = ["Revocation", "RevocationMechanism", "DEFAULT_DB"]
