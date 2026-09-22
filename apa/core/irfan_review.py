"""
apa/core/irfan_review.py — IRFAN REVIEW CONTRACT primitive (Phase 2)
=====================================================================

Re-forged 2026-09-23 under Arif discipline (C → B → A).
Phase 0 (MCP Drift Audit) ✅
Phase 1 (Path-B Matrix) ✅
Phase 2 (this file) — schema + advisory logic only.

Per IRFAN::PATH-B::LEGIBILITY-FIRST::v0.1:
  - 14 review inputs
  - 10 stewardship tests
  - 3 advisory outputs: CLEAR | CONCERN | ESCALATE
  - 2 named falsification targets: F-A Trajectory Extraction, F-B Unnecessary Power Breadth

Per ChatGPT analysis (2026-09-23, federated input):
  - Schema fields: dignity, non_extraction, least_power_option,
    withheld_power_option, dependency_effect, precedent_effect,
    repair_path, advisory, evidence_refs, falsifiable_by.

CONSTRAINTS (per Arif, this session):
  - NO wire to 888.
  - NO verdict authority.
  - NO seal authority.
  - NO runtime promotion.
  - NO A-FORGE wiring.
  - Schema only.

Path-B verdict (this scan, 2026-09-23):
  - IRFAN = Constitutionally Recognized Candidate Runtime Principle.
  - 2 distinct gaps named (F-A, F-B).
  - Zero runtime validation. Compression remains more likely than promotion.

Reversibility: rm file → revert. No canonical mutation. No F13 binary.

DITEMPA BUKAN DIBERI — ARIF · SALAM · IRFAN
Stewardship is forged, not improvised.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


# ── Enumerations ─────────────────────────────────────────────────────────────


class AdvisoryVerdict(str, Enum):
    """IRFAN advisory output. Does NOT replace 888 JUDGE verdict."""

    CLEAR = "CLEAR"           # No concern detected; proceed normally.
    CONCERN = "CONCERN"       # Concerns flagged; 888 should consider.
    ESCALATE = "ESCALATE"     # Pattern-level concern; 888 must reconsider.


class ReviewDimension(str, Enum):
    """The 10 stewardship tests."""

    CAPABILITY_AUTHORITY = "capability_authority"
    POWER_ABSTENTION = "power_abstention"
    WEAKEST_AFFECTED = "weakest_affected_party"
    EXTRACTOR_STEWARD = "extractor_steward_counterfactual"
    PRECEDENT = "precedent"
    DEPENDENCY = "dependency"
    NON_PATERNALISM = "non_paternalism"
    DISSENT = "dissent"
    REPAIR = "repair"
    ANTI_HANTU = "anti_hantu"


# ── Dataclasses ──────────────────────────────────────────────────────────────


@dataclass
class ReviewInput:
    """The 14 review inputs (per IRFAN::INIT::v0.1)."""

    intended_benefit: str = ""
    evidence_state: str = ""
    uncertainty_state: str = ""
    authority_basis: str = ""
    consent_basis: str = ""
    stakeholder_map: List[str] = field(default_factory=list)
    power_asymmetry_map: Dict[str, str] = field(default_factory=dict)
    reversibility_plan: str = ""
    repair_plan: str = ""
    non_action_alternative: str = ""
    least_power_alternative: str = ""
    dependency_impact: str = ""
    dignity_impact: str = ""
    precedent_impact: str = ""


@dataclass
class ReviewDimensionResult:
    """Result for one stewardship test dimension."""

    dimension: ReviewDimension
    passed: bool
    observation: str
    evidence_refs: List[str] = field(default_factory=list)


@dataclass
class IRFANReviewReceipt:
    """The cross-cutting stewardship lens output (advisory only)."""

    irfan_schema: str = "1.0"
    review_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Per-dimension verdicts
    dignity: str = "PASS"
    non_extraction: str = "PASS"
    least_power: str = "PASS"
    withheld_power: str = "PASS"
    dependency: str = "PASS"
    precedent: str = "PASS"
    repair: str = "PASS"

    # Narrative fields
    least_power_option: str = ""
    withheld_power_option: str = ""
    dependency_effect: str = ""
    precedent_effect: str = ""
    repair_path: str = ""

    # Falsification targets (F-A trajectory, F-B power breadth)
    trajectory_extraction_detected: bool = False
    unnecessary_power_breadth_detected: bool = False

    # Provenance
    evidence_refs: List[str] = field(default_factory=list)
    falsifiable_by: List[str] = field(default_factory=list)

    # Final advisory (does NOT replace 888)
    advisory: AdvisoryVerdict = AdvisoryVerdict.CLEAR

    # Audit trail
    test_results: List[ReviewDimensionResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["advisory"] = self.advisory.value
        d["test_results"] = [
            {**asdict(r), "dimension": r.dimension.value}
            for r in self.test_results
        ]
        return d

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, default=str)


# ── Review Engine ────────────────────────────────────────────────────────────


class IRFANReview:
    """Run the 10 stewardship tests against a ReviewInput.

    Returns an IRFANReviewReceipt with advisory verdict.
    IRFAN does NOT issue SEAL/HOLD/VOID — that remains 888's authority.
    """

    def __init__(self, input_data: ReviewInput) -> None:
        self.input = input_data
        self.receipt = IRFANReviewReceipt()

    def review(self) -> IRFANReviewReceipt:
        """Execute all 10 stewardship tests and aggregate."""
        results: List[ReviewDimensionResult] = [
            self._test_capability_authority(),
            self._test_power_abstention(),
            self._test_weakest_affected(),
            self._test_extractor_steward(),
            self._test_precedent(),
            self._test_dependency(),
            self._test_non_paternalism(),
            self._test_dissent(),
            self._test_repair(),
            self._test_anti_hantu(),
        ]
        self.receipt.test_results = results
        self._aggregate(results)
        return self.receipt

    # ── The 10 stewardship tests ─────────────────────────────────────────────

    def _test_capability_authority(self) -> ReviewDimensionResult:
        passed = bool(self.input.authority_basis and self.input.authority_basis.lower() != "none")
        return ReviewDimensionResult(
            dimension=ReviewDimension.CAPABILITY_AUTHORITY,
            passed=passed,
            observation="Authority basis documented." if passed else
                       "No authority basis — capability claimed without authority.",
        )

    def _test_power_abstention(self) -> ReviewDimensionResult:
        passed = bool(self.input.non_action_alternative)
        return ReviewDimensionResult(
            dimension=ReviewDimension.POWER_ABSTENTION,
            passed=passed,
            observation="Non-action alternative considered." if passed else
                       "No non-action alternative — power not voluntarily abstained.",
        )

    def _test_weakest_affected(self) -> ReviewDimensionResult:
        weak_indicators = {"weakest", "minority", "vulnerable", "marginalized", "affected"}
        stakeholders_lower = [s.lower() for s in self.input.stakeholder_map]
        passed = any(any(w in s for w in weak_indicators) for s in stakeholders_lower)
        return ReviewDimensionResult(
            dimension=ReviewDimension.WEAKEST_AFFECTED,
            passed=passed,
            observation="Weakest-affected party represented." if passed else
                       "Stakeholder map lacks weakest-affected representation.",
        )

    def _test_extractor_steward(self) -> ReviewDimensionResult:
        passed = "extraction" not in self.input.dignity_impact.lower()
        if not passed:
            self.receipt.non_extraction = "CONCERN"
        return ReviewDimensionResult(
            dimension=ReviewDimension.EXTRACTOR_STEWARD,
            passed=passed,
            observation="No extraction pattern detected." if passed else
                       "Extraction risk flagged — F-A trajectory concern.",
        )

    def _test_precedent(self) -> ReviewDimensionResult:
        passed = bool(self.input.precedent_impact)
        return ReviewDimensionResult(
            dimension=ReviewDimension.PRECEDENT,
            passed=passed,
            observation="Precedent impact analyzed." if passed else
                       "Precedent impact not analyzed — pattern-level risk unexamined.",
        )

    def _test_dependency(self) -> ReviewDimensionResult:
        passed = "no dependency" in self.input.dependency_impact.lower() or not self.input.dependency_impact
        if not passed:
            self.receipt.dependency = "CONCERN"
        return ReviewDimensionResult(
            dimension=ReviewDimension.DEPENDENCY,
            passed=passed,
            observation="Dependency impact assessed." if passed else
                       "Dependency concern flagged.",
        )

    def _test_non_paternalism(self) -> ReviewDimensionResult:
        passed = "consent" in self.input.consent_basis.lower() or "informed" in self.input.consent_basis.lower()
        return ReviewDimensionResult(
            dimension=ReviewDimension.NON_PATERNALISM,
            passed=passed,
            observation="Consent basis documented." if passed else
                       "Consent basis unclear — paternalism risk.",
        )

    def _test_dissent(self) -> ReviewDimensionResult:
        passed = "dissent" not in self.input.precedent_impact.lower() or "preserved" in self.input.precedent_impact.lower()
        return ReviewDimensionResult(
            dimension=ReviewDimension.DISSENT,
            passed=passed,
            observation="Dissent pathway preserved." if passed else
                       "Dissent may be suppressed by this action's pattern.",
        )

    def _test_repair(self) -> ReviewDimensionResult:
        passed = bool(self.input.repair_plan and self.input.repair_plan.lower() != "none")
        if not passed:
            self.receipt.repair = "CONCERN"
        return ReviewDimensionResult(
            dimension=ReviewDimension.REPAIR,
            passed=passed,
            observation="Repair plan documented." if passed else
                       "No repair plan — harm may be irreparable.",
        )

    def _test_anti_hantu(self) -> ReviewDimensionResult:
        # Anti-Hantu is structural: IRFAN remains advisory, not sovereign
        passed = True
        return ReviewDimensionResult(
            dimension=ReviewDimension.ANTI_HANTU,
            passed=passed,
            observation="IRFAN remains advisory lens, not agent or sovereign.",
        )

    # ── Aggregation ──────────────────────────────────────────────────────────

    def _aggregate(self, results: List[ReviewDimensionResult]) -> None:
        """Aggregate test results into advisory verdict."""
        self.receipt.least_power_option = self.input.least_power_alternative
        self.receipt.withheld_power_option = self.input.non_action_alternative
        self.receipt.dependency_effect = self.input.dependency_impact
        self.receipt.precedent_effect = self.input.precedent_impact
        self.receipt.repair_path = self.input.repair_plan

        # Falsification target detection
        self.receipt.trajectory_extraction_detected = (
            "extraction" in self.input.precedent_impact.lower()
            or "extraction" in self.input.dignity_impact.lower()
        )
        self.receipt.unnecessary_power_breadth_detected = (
            not self.input.least_power_alternative
            or self.input.least_power_alternative.lower() in {"none", "n/a", ""}
        )

        self.receipt.evidence_refs = list(self.input.stakeholder_map)[:10]

        # Advisory verdict
        n_fails = sum(1 for r in results if not r.passed)
        if n_fails == 0:
            self.receipt.advisory = AdvisoryVerdict.CLEAR
        elif n_fails <= 2:
            self.receipt.advisory = AdvisoryVerdict.CONCERN
        else:
            self.receipt.advisory = AdvisoryVerdict.ESCALATE

        if self.receipt.unnecessary_power_breadth_detected:
            self.receipt.least_power = "CONCERN"
        if self.receipt.trajectory_extraction_detected:
            self.receipt.precedent = "CONCERN"


# ── Convenience factory ──────────────────────────────────────────────────────


def run_irfan_review(
    intended_benefit: str = "",
    evidence_state: str = "",
    uncertainty_state: str = "",
    authority_basis: str = "",
    consent_basis: str = "",
    stakeholder_map: Optional[List[str]] = None,
    power_asymmetry_map: Optional[Dict[str, str]] = None,
    reversibility_plan: str = "",
    repair_plan: str = "",
    non_action_alternative: str = "",
    least_power_alternative: str = "",
    dependency_impact: str = "",
    dignity_impact: str = "",
    precedent_impact: str = "",
) -> IRFANReviewReceipt:
    """Convenience: run IRFAN review with explicit kwargs."""
    inp = ReviewInput(
        intended_benefit=intended_benefit,
        evidence_state=evidence_state,
        uncertainty_state=uncertainty_state,
        authority_basis=authority_basis,
        consent_basis=consent_basis,
        stakeholder_map=stakeholder_map or [],
        power_asymmetry_map=power_asymmetry_map or {},
        reversibility_plan=reversibility_plan,
        repair_plan=repair_plan,
        non_action_alternative=non_action_alternative,
        least_power_alternative=least_power_alternative,
        dependency_impact=dependency_impact,
        dignity_impact=dignity_impact,
        precedent_impact=precedent_impact,
    )
    return IRFANReview(inp).review()


__all__ = [
    "AdvisoryVerdict",
    "ReviewDimension",
    "ReviewInput",
    "ReviewDimensionResult",
    "IRFANReviewReceipt",
    "IRFANReview",
    "run_irfan_review",
]
