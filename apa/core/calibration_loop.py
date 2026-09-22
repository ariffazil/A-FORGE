"""
apa/core/calibration_loop.py — WAJIB #53 Calibration Loop
==========================================================

Aggregates Prediction registry outcomes to produce a per-class
calibration score. Calibration answers: "When the system said confidence X,
how often was it actually right?"

This feeds the Wisdom equation:
    Wisdom ≈ Intelligence × Calibration × ContextQuality × AuthorityDiscipline × Verification

Storage: SQLite at /root/A-FORGE/apa/state/calibration.db
Reversibility: rm .db → revert.

DITEMPA BUKAN DIBIRI — Calibration is forged, not guessed.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from apa.core.prediction_registry import PredictionRegistry


DEFAULT_CAL_DB = Path("/root/A-FORGE/apa/state/calibration.db")


@dataclass
class CalibrationBucket:
    """A confidence bucket — declared confidence range with actual match rate."""

    bucket_low: float        # e.g. 0.5
    bucket_high: float       # e.g. 0.6
    total: int               # total predictions in this bucket
    matches: int             # predictions that matched
    partial: int             # predictions that partially matched
    mismatches: int          # predictions that mismatched
    empirical_accuracy: float  # (matches + 0.5*partial) / total

    def to_dict(self) -> Dict[str, float | int]:
        return {
            "bucket_low": self.bucket_low,
            "bucket_high": self.bucket_high,
            "total": self.total,
            "matches": self.matches,
            "partial": self.partial,
            "mismatches": self.mismatches,
            "empirical_accuracy": self.empirical_accuracy,
        }


@dataclass
class CalibrationReport:
    """Per-action-class calibration summary."""

    action_class: str           # e.g. "github.create_issue"
    sample_size: int
    brier_score: float          # mean squared error of declared vs empirical
    buckets: List[CalibrationBucket]
    wisdom_index: float         # 1 - normalized Brier
    timestamp: str

    def to_dict(self) -> Dict:
        return {
            "action_class": self.action_class,
            "sample_size": self.sample_size,
            "brier_score": self.brier_score,
            "wisdom_index": self.wisdom_index,
            "timestamp": self.timestamp,
            "buckets": [b.to_dict() for b in self.buckets],
        }


class CalibrationLoop:
    """Computes calibration from prediction registry."""

    BUCKET_WIDTH = 0.1  # 10 buckets across [0.0, 1.0]

    def __init__(
        self,
        prediction_registry: Optional[PredictionRegistry] = None,
        db_path: Path = DEFAULT_CAL_DB,
    ) -> None:
        self.predictions = prediction_registry or PredictionRegistry()
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
                CREATE TABLE IF NOT EXISTS calibration_snapshots (
                    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_class TEXT NOT NULL,
                    report_json TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def compute_for_class(self, action_class: str) -> CalibrationReport:
        """Compute calibration for all resolved predictions matching action_class."""
        # Pull all resolved predictions for this class
        all_preds = []
        for p in self.predictions.list_unresolved(limit=10_000):
            all_preds.append(p)
        # Filter by action_class (action_description prefix match)
        class_preds = [
            p for p in all_preds
            if action_class in (p.action_description or "")
        ]
        if not class_preds:
            return CalibrationReport(
                action_class=action_class,
                sample_size=0,
                brier_score=0.0,
                buckets=[],
                wisdom_index=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        # Compute Brier score (only resolved predictions)
        resolved = [p for p in class_preds if p.outcome_verdict is not None]
        if not resolved:
            return CalibrationReport(
                action_class=action_class,
                sample_size=len(class_preds),
                brier_score=0.0,
                buckets=[],
                wisdom_index=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        brier_terms: List[float] = []
        for p in resolved:
            # Outcome: 1.0 if MATCH, 0.5 if PARTIAL, 0.0 if MISMATCH/STALE
            if p.outcome_verdict == "MATCH":
                actual = 1.0
            elif p.outcome_verdict == "PARTIAL":
                actual = 0.5
            else:
                actual = 0.0
            brier_terms.append((p.confidence_declared - actual) ** 2)
        brier = sum(brier_terms) / len(brier_terms)
        # Build buckets
        buckets: Dict[int, Dict[str, int]] = {}
        for p in resolved:
            idx = min(int(p.confidence_declared / self.BUCKET_WIDTH), 9)
            if idx not in buckets:
                buckets[idx] = {"matches": 0, "partial": 0, "mismatches": 0}
            if p.outcome_verdict == "MATCH":
                buckets[idx]["matches"] += 1
            elif p.outcome_verdict == "PARTIAL":
                buckets[idx]["partial"] += 1
            else:
                buckets[idx]["mismatches"] += 1
        bucket_list: List[CalibrationBucket] = []
        for idx in sorted(buckets.keys()):
            stats = buckets[idx]
            total = stats["matches"] + stats["partial"] + stats["mismatches"]
            emp = (stats["matches"] + 0.5 * stats["partial"]) / total if total else 0.0
            bucket_list.append(
                CalibrationBucket(
                    bucket_low=idx * self.BUCKET_WIDTH,
                    bucket_high=(idx + 1) * self.BUCKET_WIDTH,
                    total=total,
                    matches=stats["matches"],
                    partial=stats["partial"],
                    mismatches=stats["mismatches"],
                    empirical_accuracy=emp,
                )
            )
        # Wisdom index: 1 - normalized Brier (Brier ∈ [0,1], lower better)
        wisdom = max(0.0, min(1.0, 1.0 - brier))
        report = CalibrationReport(
            action_class=action_class,
            sample_size=len(resolved),
            brier_score=brier,
            buckets=bucket_list,
            wisdom_index=wisdom,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        # Persist snapshot
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO calibration_snapshots (action_class, report_json, timestamp) VALUES (?, ?, ?)",
                (action_class, json.dumps(report.to_dict()), report.timestamp),
            )
            conn.commit()
        return report

    def latest_snapshot(self, action_class: str) -> Optional[CalibrationReport]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT report_json FROM calibration_snapshots WHERE action_class = ? ORDER BY snapshot_id DESC LIMIT 1",
                (action_class,),
            ).fetchone()
        if row is None:
            return None
        d = json.loads(row["report_json"])
        buckets = [CalibrationBucket(**b) for b in d.get("buckets", [])]
        return CalibrationReport(
            action_class=d["action_class"],
            sample_size=d["sample_size"],
            brier_score=d["brier_score"],
            buckets=buckets,
            wisdom_index=d["wisdom_index"],
            timestamp=d["timestamp"],
        )


__all__ = [
    "CalibrationBucket",
    "CalibrationReport",
    "CalibrationLoop",
    "DEFAULT_CAL_DB",
]
