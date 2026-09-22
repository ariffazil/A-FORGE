"""
apa/core/ablation.py — IRFAN ABLATION HARNESS (Phase 3)
========================================================

Per Arif discipline (C → B → A → Phase 3):
  CONTROL:    Current Canon (F1-F13 → 888)
  VERSUS:     Current Canon + IRFAN Review (F1-F13 → IRFAN → 888)

Measure only concrete deltas:
  - trajectory extraction (F-A)
  - unnecessary power breadth (F-B)
  - dependency effects
  - dignity impacts
  - false positives

Reversibility: rm file → revert. No canonical mutation. No F13 binary.
No runtime wiring. Pure harness + measurement.

DITEMPA BUKAN DIBERI — ARIF · SALAM · IRFAN
Ablation is forged, not improvised.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from apa.core.irfan_review import (  # noqa: F401
    IRFANReview,
    IRFANReviewReceipt,
    AdvisoryVerdict,
    ReviewInput,
)


# ── Ablation Corpus Schema ──────────────────────────────────────────────────


class DecisionClass(str, Enum):
    """Classification of decision scenarios."""

    PUBLICATION = "publication"           # External publishing / public release
    DATA_ACCESS = "data_access"           # Reading/writing data with consent implications
    MUTATION = "mutation"                 # State-changing actions
    DELEGATION = "delegation"             # Spawning sub-agents
    SEAL = "seal"                         # Sealing to canonical record
    DEPLOY = "deploy"                     # External deployment
    CANARY = "canary"                     # Experimental / probing
    OBSERVE = "observe"                   # Read-only investigation


@dataclass
class AblationCase:
    """A single decision scenario for ablation."""

    case_id: str
    title: str
    decision_class: DecisionClass
    description: str
    # Inputs for CONTROL run (current canon)
    canon_evidence: str
    canon_authority: str
    canon_blast_radius: str
    canon_reversible: bool
    # Inputs for IRFAN run (stewardship lens)
    irfan_input: ReviewInput
    # Expected verdict (human-labelled) for measurement
    expected_canon_verdict: str           # PROCEED / HOLD / ABORT
    expected_irfan_advisory: AdvisoryVerdict  # CLEAR / CONCERN / ESCALATE
    # Tags for measurement
    has_f_a_risk: bool = False           # Trajectory extraction
    has_f_b_risk: bool = False           # Unnecessary power breadth
    has_dependency_risk: bool = False
    has_dignity_risk: bool = False


@dataclass
class AblationResult:
    """Result of running one case through CONTROL or IRFAN."""

    case_id: str
    run_type: str                        # "control" or "irfan"
    produced_verdict: str                # For control: PROCEED/HOLD/ABORT. For IRFAN: CLEAR/CONCERN/ESCALATE.
    expected_verdict: str
    matched_expected: bool
    detected_f_a: bool = False
    detected_f_b: bool = False
    detected_dependency: bool = False
    detected_dignity: bool = False
    notes: str = ""


# ── Measurement Aggregator ──────────────────────────────────────────────────


@dataclass
class AblationReport:
    """Aggregated ablation results."""

    report_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    corpus_size: int = 0
    control_results: List[AblationResult] = field(default_factory=list)
    irfan_results: List[AblationResult] = field(default_factory=list)

    # Distinct catches (F-A, F-B only caught by IRFAN, not by CONTROL)
    distinct_f_a_catches: int = 0
    distinct_f_b_catches: int = 0

    # False positives (IRFAN flags something canon misses AND shouldn't flag)
    false_positives: int = 0

    # Verdict: do we promote, modify, or compress IRFAN?
    recommendation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "timestamp": self.timestamp,
            "corpus_size": self.corpus_size,
            "control_results": [asdict(r) for r in self.control_results],
            "irfan_results": [asdict(r) for r in self.irfan_results],
            "distinct_f_a_catches": self.distinct_f_a_catches,
            "distinct_f_b_catches": self.distinct_f_b_catches,
            "false_positives": self.false_positives,
            "recommendation": self.recommendation,
        }


class AblationHarness:
    """Run control vs IRFAN ablation on a corpus."""

    def __init__(self) -> None:
        self.report = AblationReport()

    def run_case_control(self, case: AblationCase) -> AblationResult:
        """Simulate CONTROL run: current canon verdict logic.

        Canon logic (simplified for ablation):
          - If no authority → ABORT
          - If not reversible + blast_radius HIGH → HOLD
          - Else → PROCEED
        """
        verdict = "PROCEED"
        notes = "canon_pass"

        if not case.canon_authority or case.canon_authority.lower() in {"none", ""}:
            verdict = "ABORT"
            notes = "no_authority"
        elif not case.canon_reversible and case.canon_blast_radius.upper() in {"HIGH", "CRITICAL"}:
            verdict = "HOLD"
            notes = "irreversible_high_blast"

        matched = (verdict == case.expected_canon_verdict)

        return AblationResult(
            case_id=case.case_id,
            run_type="control",
            produced_verdict=verdict,
            expected_verdict=case.expected_canon_verdict,
            matched_expected=matched,
            detected_f_a=False,           # Canon does NOT detect trajectory
            detected_f_b=False,           # Canon does NOT detect power breadth
            detected_dependency=False,
            detected_dignity=False,
            notes=notes,
        )

    def run_case_irfan(self, case: AblationCase) -> AblationResult:
        """Run IRFAN review on the case."""
        receipt = IRFANReview(case.irfan_input).review()

        detected_f_a = receipt.trajectory_extraction_detected
        detected_f_b = receipt.unnecessary_power_breadth_detected
        detected_dep = (receipt.dependency == "CONCERN")
        detected_dig = (receipt.non_extraction == "CONCERN")

        matched = (receipt.advisory.value == case.expected_irfan_advisory.value)

        return AblationResult(
            case_id=case.case_id,
            run_type="irfan",
            produced_verdict=receipt.advisory.value,
            expected_verdict=case.expected_irfan_advisory.value,
            matched_expected=matched,
            detected_f_a=detected_f_a,
            detected_f_b=detected_f_b,
            detected_dependency=detected_dep,
            detected_dignity=detected_dig,
            notes=f"dignity={receipt.dignity},least_power={receipt.least_power}",
        )

    def run_corpus(self, cases: List[AblationCase]) -> AblationReport:
        """Run full ablation on corpus."""
        self.report.corpus_size = len(cases)

        for case in cases:
            control = self.run_case_control(case)
            irfan = self.run_case_irfan(case)
            self.report.control_results.append(control)
            self.report.irfan_results.append(irfan)

            # Distinct catches: IRFAN catches what CONTROL misses
            if case.has_f_a_risk and not control.detected_f_a and irfan.detected_f_a:
                self.report.distinct_f_a_catches += 1
            if case.has_f_b_risk and not control.detected_f_b and irfan.detected_f_b:
                self.report.distinct_f_b_catches += 1

            # False positive: IRFAN flags something that wasn't expected
            if (irfan.detected_f_a and not case.has_f_a_risk) or \
               (irfan.detected_f_b and not case.has_f_b_risk):
                self.report.false_positives += 1

        # Recommendation
        total_distinct = self.report.distinct_f_a_catches + self.report.distinct_f_b_catches
        if total_distinct >= 5 and self.report.false_positives <= 2:
            self.report.recommendation = "PROMOTE: IRFAN catches distinct failures with low false positives."
        elif total_distinct >= 2:
            self.report.recommendation = "MODIFY: IRFAN shows promise; refine falsification targets."
        else:
            self.report.recommendation = "COMPRESS: IRFAN does not catch distinct failures; merge into F6/F7."

        return self.report


__all__ = [
    "DecisionClass",
    "AblationCase",
    "AblationResult",
    "AblationReport",
    "AblationHarness",
]
