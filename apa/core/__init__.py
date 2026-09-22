"""
apa/core — APA execution core
==============================
Shared models, receipt logic, and the ACT execution engine.

Import surface:
  from apa.core.schemas import VAULT999Receipt, APAResponse
  from apa.core.receipt import build_receipt, build_response
  from apa.core.act_executor import act, ACTExecutor

DITEMPA BUKAN DIBERI — ARIF · SALAM · IRFAN
Exports are forged, not improvised.
"""

from apa.core.schemas import VAULT999Receipt, APAResponse
from apa.core.receipt import build_receipt, build_response, build_error_response
from apa.core.act_executor import (
    ACTExecutor,
    ACTContext,
    ACTResult,
    Phase,
    PhaseResult,
    Verdict,
)
from apa.core.prediction_registry import Prediction, PredictionRegistry
from apa.core.calibration_loop import CalibrationBucket, CalibrationReport, CalibrationLoop
from apa.core.revocation import Revocation, RevocationMechanism
from apa.core.forget_propagation import ForgetEvent, ForgetPropagation
from apa.core.irfan_review import (  # noqa: F401
    AdvisoryVerdict,
    ReviewDimension,
    ReviewInput,
    ReviewDimensionResult,
    IRFANReviewReceipt,
    IRFANReview,
    run_irfan_review,
)
from apa.core.ablation import (  # noqa: F401
    DecisionClass,
    AblationCase,
    AblationResult,
    AblationReport,
    AblationHarness,
)

__all__ = [
    # schemas
    "VAULT999Receipt", "APAResponse",
    # receipt
    "build_receipt", "build_response", "build_error_response",
    # act_executor
    "ACTExecutor", "ACTContext", "ACTResult", "Phase", "PhaseResult", "Verdict",
    # prediction_registry (WAJIB #52)
    "Prediction", "PredictionRegistry",
    # calibration_loop (WAJIB #53)
    "CalibrationBucket", "CalibrationReport", "CalibrationLoop",
    # revocation (WAJIB #7)
    "Revocation", "RevocationMechanism",
    # forget_propagation (WAJIB #21)
    "ForgetEvent", "ForgetPropagation",
    # IRFAN review (candidate runtime principle, Phase 2)
    "AdvisoryVerdict", "ReviewDimension",
    "ReviewInput", "ReviewDimensionResult", "IRFANReviewReceipt",
    "IRFANReview", "run_irfan_review",
    # ablation (Phase 3 harness)
    "DecisionClass", "AblationCase", "AblationResult", "AblationReport",
    "AblationHarness",
]
