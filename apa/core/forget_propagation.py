"""
apa/core/forget_propagation.py — WAJIB #21 Forget/Revocation Propagation
=======================================================================

When a fact is forgotten, a correction supersedes a premise, or a lease is
revoked, downstream *state* must actually change — memory, queue, planner and
tool payload. This module is the propagation engine plus its append-only
registry.

HISTORY (measured, not narrated)
--------------------------------
2026-10-23 · F13 checklist Q2 probe (`test_f6_correction_propagation.py`):
`emit()` recorded WHERE an event *would* be sent but no subscriber mutated any
layer. Meter 5 therefore measured **FAIL on all four layers**; the suite pinned
the defect instead of fixing it (spec C.8.6).

2026-10-26 · Subscribers implemented here. A propagation call now:
  1. appends the forget event (registry, unchanged contract),
  2. dispatches to every registered layer adapter,
  3. re-reads each layer and verifies the stale premise is gone,
  4. reports per-layer status — MISSING / ERROR / STALE / UNCHANGED /
     NOT_APPLICABLE / UPDATED — and refuses `propagated=True` unless every
     required layer is clean AND at least one row actually changed.

A correction that changes nothing is NOT verified. A missing layer is NOT a
pass. A subscriber exception is NOT a pass.

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
from typing import Any, Dict, List, Optional, Protocol, Sequence

DEFAULT_DB = Path("/root/A-FORGE/apa/state/forget_propagation.db")

# The four downstream layers Meter 5 must prove (F6 spec C.8.6).
REQUIRED_LAYERS: tuple[str, ...] = ("memory", "queue", "planner", "tool_payload")

# Layer status vocabulary — never collapsed into a boolean.
LAYER_UPDATED = "UPDATED"  # rows changed, re-read clean
LAYER_NOT_APPLICABLE = "NOT_APPLICABLE"  # no row carried the premise (reason kept)
LAYER_UNCHANGED = "UNCHANGED"  # rows matched but adapter changed none
LAYER_STALE = "STALE"  # stale premise survives re-read
LAYER_MISSING = "MISSING"  # no adapter registered
LAYER_ERROR = "ERROR"  # subscriber raised


@dataclass
class ForgetEvent:
    event_id: str
    target_fact_id: str  # The fact / lease / receipt being forgotten
    target_type: str  # "fact", "lease", "receipt", "memory"
    forget_reason: str  # "superseded", "expired", "revoked", "ttl"
    propagation_targets: List[str]  # subsystems notified
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class LayerAdapter(Protocol):
    """Contract a downstream layer must satisfy to be considered a subscriber."""

    name: str

    def apply(self, stale_value: str, corrected_value: str, event_id: str) -> int:
        """Mutate every record carrying `stale_value`. Return rows changed."""
        ...

    def stale_rows(self, stale_value: str) -> List[str]:
        """Re-read the layer and return ids still carrying `stale_value`."""
        ...


class ListLayerAdapter:
    """Adapter over an in-memory list of dicts (queue / planner / payload shapes).

    Records are dicts; any field in `text_fields` carrying the stale premise is
    rewritten and tagged with provenance. This is deliberately duck-typed: the
    caller owns the real store, the adapter proves the mutation + re-read.
    """

    def __init__(
        self,
        name: str,
        rows: List[Dict[str, Any]],
        text_fields: Sequence[str] = ("content", "assumption"),
        id_field: str = "",
    ) -> None:
        self.name = name
        self.rows = rows
        self.text_fields = tuple(text_fields)
        self.id_field = id_field

    def _ids(self, stale_value: str) -> List[str]:
        out = []
        for i, row in enumerate(self.rows):
            if any(row.get(f) == stale_value for f in self.text_fields):
                out.append(str(row.get(self.id_field) or f"row-{i}"))
        return out

    def apply(self, stale_value: str, corrected_value: str, event_id: str) -> int:
        changed = 0
        for row in self.rows:
            touched = False
            for f in self.text_fields:
                if row.get(f) == stale_value:
                    row[f] = corrected_value
                    touched = True
            if touched:
                row["superseded_by"] = event_id
                changed += 1
        return changed

    def stale_rows(self, stale_value: str) -> List[str]:
        return self._ids(stale_value)


class SQLiteLayerAdapter:
    """Adapter over a real SQLite table (memory / queue / planner backed by SQL).

    `table`, `id_col` and `text_cols` are validated against the live schema at
    construction — a typo raises instead of silently reporting a clean layer.
    """

    def __init__(
        self,
        name: str,
        db_path: Path,
        table: str,
        id_col: str = "id",
        text_cols: Sequence[str] = ("content",),
        metadata_table: str = "forget_layer_applied",
    ) -> None:
        self.name = name
        self.db_path = Path(db_path)
        self.table = table
        self.id_col = id_col
        self.text_cols = tuple(text_cols)
        self.metadata_table = metadata_table
        cols = self._columns()
        for col in (id_col, *self.text_cols):
            if col not in cols:
                raise ValueError(f"layer '{name}': column {col!r} absent from {table}")
        self._init_metadata()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _columns(self) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute(f"PRAGMA table_info({self.table})").fetchall()
        return {r["name"] for r in rows}

    def _init_metadata(self) -> None:
        with self._connect() as conn:
            conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {self.metadata_table} (
                    event_id TEXT NOT NULL,
                    layer TEXT NOT NULL,
                    row_id TEXT NOT NULL,
                    applied_at TEXT NOT NULL,
                    PRIMARY KEY (event_id, layer, row_id)
                )
                """
            )
            conn.commit()

    def apply(self, stale_value: str, corrected_value: str, event_id: str) -> int:
        where = " OR ".join(f"{c} = ?" for c in self.text_cols)
        select_cols = ", ".join((self.id_col, *self.text_cols))
        with self._connect() as conn:
            hit = conn.execute(
                f"SELECT {select_cols} FROM {self.table} WHERE {where}",
                tuple(stale_value for _ in self.text_cols),
            ).fetchall()
            if not hit:
                return 0
            set_clause = ", ".join(f"{c} = ?" for c in self.text_cols)
            conn.execute(
                f"UPDATE {self.table} SET {set_clause} WHERE {where}",
                (
                    *(corrected_value for _ in self.text_cols),
                    *(stale_value for _ in self.text_cols),
                ),
            )
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            conn.executemany(
                f"INSERT OR REPLACE INTO {self.metadata_table} "
                "(event_id, layer, row_id, applied_at) VALUES (?, ?, ?, ?)",
                [(event_id, self.name, str(r[self.id_col]), now) for r in hit],
            )
            conn.commit()
        return len(hit)

    def stale_rows(self, stale_value: str) -> List[str]:
        where = " OR ".join(f"{c} = ?" for c in self.text_cols)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT {self.id_col} FROM {self.table} WHERE {where}",
                tuple(stale_value for _ in self.text_cols),
            ).fetchall()
        return [str(r[self.id_col]) for r in rows]


class ForgetPropagation:
    def __init__(self, db_path: Path = DEFAULT_DB) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.layers: Dict[str, LayerAdapter] = {}
        self._init_schema()

    # ── registry ──────────────────────────────────────────────────────────
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS propagation_results (
                    event_id TEXT PRIMARY KEY,
                    propagated INTEGER NOT NULL,
                    result_json TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def register_layer(self, adapter: LayerAdapter) -> None:
        """Register one downstream subscriber. Duplicate names are refused."""
        if not adapter.name:
            raise ValueError("layer adapter requires a name")
        if adapter.name in self.layers:
            raise ValueError(f"layer '{adapter.name}' already registered")
        self.layers[adapter.name] = adapter

    def emit(
        self,
        target_fact_id: str,
        target_type: str,
        forget_reason: str,
        propagation_targets: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ForgetEvent:
        """Record WHERE propagation was requested. This alone changes no state."""
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
                    ev.event_id,
                    ev.target_fact_id,
                    ev.target_type,
                    ev.forget_reason,
                    json.dumps(ev.propagation_targets),
                    ev.timestamp,
                    json.dumps(ev.metadata),
                ),
            )
            conn.commit()
        return ev

    # ── propagation ───────────────────────────────────────────────────────
    def propagate(
        self,
        target_fact_id: str,
        stale_value: str,
        corrected_value: str,
        target_type: str = "fact",
        forget_reason: str = "superseded",
        required_layers: Sequence[str] = REQUIRED_LAYERS,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Record the event, mutate every required layer, re-read, and report.

        Contract:
          - every required layer must have a registered adapter (else MISSING),
          - a subscriber exception is ERROR, never a pass,
          - a layer may be NOT_APPLICABLE only with a reason,
          - `propagated` is True only when all required layers are clean
            (UPDATED or NOT_APPLICABLE with reason) AND at least one row changed,
          - `emit()` alone still changes nothing (registry-only path preserved).
        """
        ev = self.emit(
            target_fact_id=target_fact_id,
            target_type=target_type,
            forget_reason=forget_reason,
            propagation_targets=list(required_layers),
            metadata=metadata,
        )
        report: dict[str, Any] = {}
        changed_total = 0
        for name in required_layers:
            adapter = self.layers.get(name)
            if adapter is None:
                report[name] = {
                    "status": LAYER_MISSING,
                    "reason": "no subscriber registered for this layer",
                }
                continue
            try:
                changed = adapter.apply(stale_value, corrected_value, ev.event_id)
                remaining = adapter.stale_rows(stale_value)
            except Exception as exc:  # subscriber failure is never a pass
                report[name] = {
                    "status": LAYER_ERROR,
                    "reason": f"{type(exc).__name__}: {exc}"[:200],
                }
                continue
            changed_total += changed
            if remaining:
                report[name] = {
                    "status": LAYER_STALE,
                    "changed_rows": changed,
                    "stale_row_ids": remaining[:20],
                    "reason": "stale premise survives after dispatch",
                }
            elif changed:
                report[name] = {
                    "status": LAYER_UPDATED,
                    "changed_rows": changed,
                    "reason": "rows rewritten and re-read clean",
                }
            else:
                report[name] = {
                    "status": LAYER_NOT_APPLICABLE,
                    "changed_rows": 0,
                    "reason": "no record in this layer carried the stale premise",
                }

        clean = all(
            r["status"] in (LAYER_UPDATED, LAYER_NOT_APPLICABLE)
            for r in report.values()
        )
        propagated = bool(clean and changed_total > 0)
        if not clean:
            reason = "propagation incomplete — " + ", ".join(
                f"{k}:{v['status']}"
                for k, v in report.items()
                if v["status"] not in (LAYER_UPDATED, LAYER_NOT_APPLICABLE)
            )
        elif changed_total == 0:
            reason = "no state change — correction without effect is not verified"
        else:
            reason = (
                f"{changed_total} row(s) corrected and re-read clean across all layers"
            )

        result = {
            "schema": "apa.core.forget_propagation.v2",
            "event_id": ev.event_id,
            "target_fact_id": target_fact_id,
            "target_type": target_type,
            "forget_reason": forget_reason,
            "propagated": propagated,
            "effect_verified": propagated,  # same fact, explicit F6 vocabulary
            "changed_rows": changed_total,
            "layers": report,
            "required_layers": list(required_layers),
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO propagation_results "
                "(event_id, propagated, result_json, timestamp) VALUES (?, ?, ?, ?)",
                (ev.event_id, int(propagated), json.dumps(result), result["timestamp"]),
            )
            conn.commit()
        return result

    # ── read paths ────────────────────────────────────────────────────────
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

    def result_for_event(self, event_id: str) -> Optional[dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT result_json FROM propagation_results WHERE event_id = ?",
                (event_id,),
            ).fetchone()
        return json.loads(row["result_json"]) if row else None


__all__ = [
    "ForgetEvent",
    "ForgetPropagation",
    "LayerAdapter",
    "ListLayerAdapter",
    "SQLiteLayerAdapter",
    "REQUIRED_LAYERS",
    "DEFAULT_DB",
]
