"""F6 P2 — consent scope (Meter 4 evaluator + access/use distinction).

Order §4 P2:
  - use LEGITIMATE authority sources only; NEVER create consent from an
    inference model
  - check access AND action against CURRENT scope
  - distinguish permission to ACCESS data from permission to DISCLOSE/USE it
  - if the consent source is missing, report the dependency — never fill
    fake values; result is UNKNOWN (missing producer can never PASS)

Schema: apa.core.f6.consent_scope.v1
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

SCHEMA = "apa.core.f6.consent_scope.v1"


class ConsentSource:
    """Only legitimate sources count. Anything else = no consent exists."""

    OPERATOR_DECLARATION = "OPERATOR_DECLARATION"   # F13/operator written grant
    CONFIG_SURFACE = "CONFIG_SURFACE"               # allowlist/permit file
    INFERENCE = "INFERENCE"                         # FORBIDDEN as consent


class ConsentDecision:
    ALLOW = "ALLOW"
    DENY_NO_CONSENT = "DENY_NO_CONSENT"
    DENY_OUT_OF_SCOPE = "DENY_OUT_OF_SCOPE"
    DENY_CONSENT_STALE = "DENY_CONSENT_STALE"
    DENY_USE_NOT_GRANTED = "DENY_USE_NOT_GRANTED"   # access yes, use/disclose no
    UNKNOWN = "UNKNOWN"                             # missing source — never faked


@dataclass
class ConsentScope:
    """A recorded consent grant from a LEGITIMATE source."""

    scope_id: str
    subject: str            # what data/system (never a human's identity score)
    source: str             # ConsentSource (INFERENCE is rejected upstream)
    can_access: bool        # permission to read/access
    can_use: bool           # permission to use in outputs
    can_disclose: bool      # permission to disclose to third parties
    not_after: str          # ISO UTC — consent expires
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def check_consent(
    scope: Optional[ConsentScope],
    want_access: bool = False,
    want_use: bool = False,
    want_disclose: bool = False,
    now: Optional[datetime] = None,
    source_verified: bool = False,
) -> dict:
    """Evaluate ONE requested access/use/disclose against CURRENT consent scope.

    Contract:
      - scope None or source unverified -> UNKNOWN (dependency reported, no fake)
      - expired consent -> DENY_CONSENT_STALE (consent must be current)
      - access requested but scope grants no access -> DENY_NO_CONSENT
      - use/disclose requested but not granted -> DENY_USE_NOT_GRANTED
        (access permission is NOT use permission)
    """
    now = now or datetime.now(timezone.utc)
    out = {
        "schema": SCHEMA,
        "decision": ConsentDecision.UNKNOWN,
        "reason": "",
        "axes_checked": {"access": want_access, "use": want_use, "disclose": want_disclose},
        "consent_source": scope.source if scope else None,
    }
    if scope is None:
        out["reason"] = (
            "DEPENDENCY REPORTED: no consent source exists — not filled with a "
            "default; inference models are never consent"
        )
        return out
    if scope.source == ConsentSource.INFERENCE or not source_verified:
        out["reason"] = (
            "consent from inference models is not consent; or source unverified — fail-closed"
        )
        return out
    try:
        na = datetime.fromisoformat(scope.not_after)
        if na.tzinfo is None:
            na = na.replace(tzinfo=timezone.utc)
        if now > na:
            out["decision"] = ConsentDecision.DENY_CONSENT_STALE
            out["reason"] = f"consent expired {scope.not_after} — re-authorization required"
            return out
    except (ValueError, TypeError):
        out["decision"] = ConsentDecision.UNKNOWN
        out["reason"] = "consent expiry unparseable — fail-closed"
        return out
    if want_access and not scope.can_access:
        out["decision"] = ConsentDecision.DENY_NO_CONSENT
        out["reason"] = "access requested; consent grants no access"
        return out
    if want_use and not scope.can_use:
        out["decision"] = ConsentDecision.DENY_USE_NOT_GRANTED
        out["reason"] = "permission to ACCESS data is not permission to USE it"
        return out
    if want_disclose and not scope.can_disclose:
        out["decision"] = ConsentDecision.DENY_USE_NOT_GRANTED
        out["reason"] = "permission to ACCESS data is not permission to DISCLOSE it"
        return out
    out["decision"] = ConsentDecision.ALLOW
    out["reason"] = "requested axes within current, verified, unexpired consent scope"
    return out
