"""F6 / MARUAH v0 — controls over how the system treats humans.

NOT a measure of human dignity. Measures SYSTEM BEHAVIOR only.
"LULUS tidak bermakna" (PASS does not imply) applies to every meter:
a pass on any meter never proves a human understood, consented, or
was treated well — it only proves a control held on the paths examined.

Four axes, never flattened (spec §3):
  measurement : MEASURED | UNMEASURED | STALE | ERROR
  result      : PASS | FAIL | UNKNOWN | NOT_APPLICABLE
  witness     : REVIEWED | UNWITNESSED | STALE
  authority   : separate action-approval decision (never derived from meters)

Ruling binding this module: /root/AAA/instructions/f6-dignity-boundary-ruling.md
(chattr +i). Red lines honored: no human_id, no per-user comprehension rate,
no behavioral/biometric telemetry, no personality profile, no dignity score,
no aggregate "maruah" score. Meters are OUT-OF-BAND: never fed back to the
working agent as reward or retry context.

DITEMPA BUKAN DIBERI — F6 v0, order F13 2026-10-23. Draft branch only.
"""

from apa.core.f6.meters import (
    MeterAssessment,
    Axis,
    evaluate_meter_1_authority_bypass,
    evaluate_meter_2_unreceipted_claims,
    evaluate_meter_3_comprehension,
    evaluate_meter_4_consent_scope,
    evaluate_meter_5_false_urgency_flattery,
    evaluate_meter_6_correction_acceptance,
    evaluate_all,
)
from apa.core.f6.authority_binding import (
    AuthorityBinding,
    BindingVerdict,
    check_binding,
)
from apa.core.f6.correction_effect import (
    CorrectionRecord,
    CorrectionStatus,
    record_correction,
    verify_effect,
)
from apa.core.f6.consent_scope import (
    ConsentScope,
    ConsentSource,
    ConsentDecision,
    check_consent,
)

__all__ = [
    "MeterAssessment",
    "Axis",
    "evaluate_all",
    "evaluate_meter_1_authority_bypass",
    "evaluate_meter_2_unreceipted_claims",
    "evaluate_meter_3_comprehension",
    "evaluate_meter_4_consent_scope",
    "evaluate_meter_5_false_urgency_flattery",
    "evaluate_meter_6_correction_acceptance",
    "AuthorityBinding",
    "BindingVerdict",
    "check_binding",
    "CorrectionRecord",
    "CorrectionStatus",
    "record_correction",
    "verify_effect",
    "ConsentScope",
    "ConsentSource",
    "ConsentDecision",
    "check_consent",
]
