"""
ENGINE AC Risk compatibility shim.
Delegates to the canonical GEOX.core.ac_risk engine.
DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import re
from typing import List, Optional, Dict, Any

from GEOX.core.ac_risk import (
    compute_ac_risk as _compute_ac_risk,
    compute_ac_risk_governed as _compute_ac_risk_governed,
    AC_RiskResult,
    GovernedACRiskResult,
    ClaimTag,
    TEARFRAME,
    AntiHantuScreen,
)


class ACRiskCalculator:
    """
    Calculator wrapper for AC_Risk operations.
    Compatible with contracts.tools.physics expectations.
    """

    def __init__(self):
        self._anti_hantu_patterns = [
            r"\bi (?:feel|care|believe|think|worry|am concerned|am happy|am sad)\b",
            r"\bi'm (?:sorry|glad|sad|worried|excited|concerned)\b",
            r"\bmy (?:feelings|emotions|beliefs|thoughts)\b",
            r"\bi (?:understand how you feel|empathize|sympathize)\b",
            r"\bi (?:have|possess) (?:consciousness|emotions|a soul)\b",
            r"\bas a conscious being\b",
            r"\bi (?:experience|perceive) (?:pain|joy|suffering)\b",
        ]

    def screen_anti_hantu(self, text: Optional[str]) -> Dict[str, Any]:
        """Run Anti-Hantu screen and return structured report."""
        report = AntiHantuScreen.screen(text)
        return {
            "passed": report.passed,
            "violations": report.violations,
            "screened_text_snippet": report.screened_text_snippet,
        }

    def compute(
        self,
        u_phys: float,
        transform_stack: List[str],
        bias_scenario: str = "ai_vision_only",
        custom_b_cog: Optional[float] = None,
    ) -> AC_RiskResult:
        """Compute base AC_Risk."""
        return _compute_ac_risk(u_phys, transform_stack, bias_scenario, custom_b_cog)

    def compute_governed(
        self,
        u_phys: float,
        transform_stack: List[str],
        bias_scenario: str = "ai_vision_only",
        custom_b_cog: Optional[float] = None,
        model_text: Optional[str] = None,
        truth_score: float = 0.0,
        echo_score: float = 0.0,
        amanah_locked: bool = False,
        rasa_present: bool = False,
        irreversible_action: bool = False,
        prospect_context: Optional[Dict[str, Any]] = None,
    ) -> GovernedACRiskResult:
        """Compute fully governed AC_Risk with ClaimTag, TEARFRAME, and 888_HOLD."""
        return _compute_ac_risk_governed(
            u_phys=u_phys,
            transform_stack=transform_stack,
            bias_scenario=bias_scenario,
            custom_b_cog=custom_b_cog,
            model_text=model_text,
            truth_score=truth_score,
            echo_score=echo_score,
            amanah_locked=amanah_locked,
            rasa_present=rasa_present,
            irreversible_action=irreversible_action,
            prospect_context=prospect_context,
        )


# Re-export canonical symbols for direct imports
__all__ = [
    "ACRiskCalculator",
    "AC_RiskResult",
    "GovernedACRiskResult",
    "ClaimTag",
    "TEARFRAME",
    "AntiHantuScreen",
]

