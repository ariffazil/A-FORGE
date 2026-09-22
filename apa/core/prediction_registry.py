"""
apa/core/prediction_registry.py — WAJIB #52 Prediction Registry
================================================================

For every consequential action, record the EXPECTED outcome BEFORE execution.
Compare to the OBSERVED outcome AFTER. This is the substrate for
WAJIB #53 (calibration loop) and the Wisdom equation's Calibration term.

Storage: SQLite at /root/A-FORGE/apa/state/prediction_registry.db
Reversibility: rm the .db file → revert (schema is reproducible from this module).

DITEMPA BUKAN DIBERI — Predictions are forged, not improvised.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_DB_PATH = Path("/root/A-FORGE/apa/state/prediction_registry.db")


@dataclass
class Prediction:
    """An expectation recorded BEFORE a consequential action."""

    prediction_id: str
    task_id: str
    action_description: str
    expected_outcome: str
    confidence_declared: float  # 0.0-1.0
    timestamp_created: str  # ISO UTC
    timestamp_resolved: Optional[str] = None
    observed_outcome: Optional[str] = None
    outcome_verdict: Optional[str] = None  # MATCH / MISMATCH / PARTIAL / STALE
    receipt_id: Optional[str] = None  # Links to VAULT999Receipt
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PredictionRegistry:
    """SQLite-backed prediction registry. Thread-safe via connection-per-call."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
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
                CREATE TABLE IF NOT EXISTS predictions (
                    prediction_id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    action_description TEXT NOT NULL,
                    expected_outcome TEXT NOT NULL,
                    confidence_declared REAL NOT NULL CHECK (confidence_declared BETWEEN 0.0 AND 1.0),
                    timestamp_created TEXT NOT NULL,
                    timestamp_resolved TEXT,
                    observed_outcome TEXT,
                    outcome_verdict TEXT CHECK (outcome_verdict IN ('MATCH','MISMATCH','PARTIAL','STALE') OR outcome_verdict IS NULL),
                    receipt_id TEXT,
                    metadata_json TEXT DEFAULT '{}'
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_predictions_task ON predictions(task_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_predictions_verdict ON predictions(outcome_verdict)"
            )
            conn.commit()

    def record(
        self,
        task_id: str,
        action_description: str,
        expected_outcome: str,
        confidence_declared: float,
        receipt_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Prediction:
        """Record a prediction BEFORE action. Returns the stored Prediction."""
        if not 0.0 <= confidence_declared <= 1.0:
            raise ValueError("confidence_declared must be in [0.0, 1.0]")
        pred = Prediction(
            prediction_id=str(uuid.uuid4()),
            task_id=task_id,
            action_description=action_description,
            expected_outcome=expected_outcome,
            confidence_declared=confidence_declared,
            timestamp_created=datetime.now(timezone.utc).isoformat(),
            receipt_id=receipt_id,
            metadata=metadata or {},
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO predictions
                (prediction_id, task_id, action_description, expected_outcome,
                 confidence_declared, timestamp_created, receipt_id, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pred.prediction_id,
                    pred.task_id,
                    pred.action_description,
                    pred.expected_outcome,
                    pred.confidence_declared,
                    pred.timestamp_created,
                    pred.receipt_id,
                    json.dumps(pred.metadata),
                ),
            )
            conn.commit()
        return pred

    def resolve(
        self,
        prediction_id: str,
        observed_outcome: str,
        outcome_verdict: str,
    ) -> Optional[Prediction]:
        """Record the OBSERVED outcome AFTER action. Verdict ∈ {MATCH, MISMATCH, PARTIAL, STALE}."""
        if outcome_verdict not in {"MATCH", "MISMATCH", "PARTIAL", "STALE"}:
            raise ValueError(f"Invalid verdict: {outcome_verdict}")
        ts = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE predictions
                SET observed_outcome = ?, outcome_verdict = ?, timestamp_resolved = ?
                WHERE prediction_id = ?
                """,
                (observed_outcome, outcome_verdict, ts, prediction_id),
            )
            conn.commit()
            if cur.rowcount == 0:
                return None
        return self.get(prediction_id)

    def get(self, prediction_id: str) -> Optional[Prediction]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM predictions WHERE prediction_id = ?", (prediction_id,)
            ).fetchone()
        if row is None:
            return None
        return self._row_to_prediction(row)

    def list_unresolved(self, limit: int = 100) -> List[Prediction]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM predictions WHERE outcome_verdict IS NULL ORDER BY timestamp_created DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [self._row_to_prediction(r) for r in rows]

    def list_for_task(self, task_id: str) -> List[Prediction]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM predictions WHERE task_id = ? ORDER BY timestamp_created",
                (task_id,),
            ).fetchall()
        return [self._row_to_prediction(r) for r in rows]

    def _row_to_prediction(self, row: sqlite3.Row) -> Prediction:
        return Prediction(
            prediction_id=row["prediction_id"],
            task_id=row["task_id"],
            action_description=row["action_description"],
            expected_outcome=row["expected_outcome"],
            confidence_declared=row["confidence_declared"],
            timestamp_created=row["timestamp_created"],
            timestamp_resolved=row["timestamp_resolved"],
            observed_outcome=row["observed_outcome"],
            outcome_verdict=row["outcome_verdict"],
            receipt_id=row["receipt_id"],
            metadata=json.loads(row["metadata_json"] or "{}"),
        )


__all__ = ["Prediction", "PredictionRegistry", "DEFAULT_DB_PATH"]
