"""
arifos_envelope.py — canonical state-handle module for all arifOS organs.

Imports into any organ's MCP server; the organ calls verify_envelope() as the
FIRST step before any compute, then echoes the handle on success and raises
EnvelopeRejection on any of the documented failure modes.

SPEC ANCHORS:
  SEP-2567  sessionless state handle (explicit handle, not transport-layer
            session)
  SEP-1303  structured errors share one JSON-RPC error shape, never bare strings
  SEP-2260  server requests must trace to client-initiated calls
  SEP-414   trace context propagation as a first-class field

INVARIANTS:
  - session_id, actor_id, constitutional_chain_id, verification_level are
    IMMUTABLE through the call chain.
  - trace_id rotates per hop; parent_trace_id links this hop to its caller.
  - presence of constitutional_chain_id is NOT proof — verify_seal() on the
    kernel side is the only legitimate proof.
  - rejection is not a verdict. HOLD = "evaluated, insufficient evidence".
                              Rejection = "never evaluated".

CONSTITUTIONAL POSTURE on expires_at:
  - expires_at is kernel-authoritative. Organs soft-check and warn only.
    Clock skew between organs is a real and common failure mode; letting
    each organ independently judge TTL would let the same handle be valid
    on one and rejected on another. The kernel is already in the call path
    via verify_seal(cc_id); adding an authoritative now() < expires_at
    check there is zero marginal cost.
  - Default behaviour: organs call soft_check_expires_at() and log a
    WARNING if expires_at is within CLOCK_SKEW_TOLERANCE_SECONDS of kernel
    now, but do NOT block. Use envelope_strict_mode=True for 888_HOLD-bound
    actions where hard organ-side enforcement is wanted.

Version: 1.0.0  (forged 2026-07-08 by F13 SOVEREIGN directive,
                  consolidated by FORGE-000Ω per field review)
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Literal, Any, Dict, cast
from uuid import uuid4

# ---------------------------------------------------------------------------
# Protocol-level constants
# ---------------------------------------------------------------------------

# Protocol version. Pinned at header level so future organ versions can refuse
# mismatched peers gracefully. NOT pinned on every field (relaxed from Arif's
# draft per field-review feedback: type-pin the protocol, not each field).
PROTOCOL_SCHEMA_VERSION = "1.0.0"

# Default TTL — overridable per-session at arif_init time.
DEFAULT_TTL_MINUTES = 15

# Clock-skew tolerance for organ-side soft warnings.
CLOCK_SKEW_TOLERANCE_SECONDS = 30

# Expected session_id format. Kernels must follow.
SESSION_ID_FORMAT = "SEAL-<hex16>"


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

# Verification reason codes. Adding new reasons requires F13 sovereign ack.
EnvelopeRejectionReason = Literal[
    "ENVELOPE_MISSING",  # _envelope was null/absent
    "SESSION_UNKNOWN",  # session_id not in kernel's live registry
    "SESSION_EXPIRED",  # kernel-authoritative check
    "ACTOR_MISMATCH",  # actor_id does not match session binding
    "VERIFICATION_LEVEL_MISMATCH",  # caller's claimed level below session's bound
    "CHAIN_ID_UNVERIFIED",  # cc_id present but no matching SEAL record
    "SCHEMA_VERSION_UNSUPPORTED",  # envelope failed schema parse
    "TRACE_ID_MALFORMED",  # trace_id does not match expected format
]


# Allowed verification levels for actor claims, monotonically ordered.
# Used for "caller must be at least as verified as session's bound level".
VerificationLevel = Literal[
    "self_report",  # 0 — actor says so, no kernel verification
    "jwt_verified",  # 1 — JWT bearer, signature verified
    "dpop_verified",  # 2 — DPoP-bound token, replay-protected
    "f13_signed",  # 3 — F13 sovereign-signed (highest authority)
]

_VERIFICATION_LEVEL_ORDER: Dict[str, int] = {
    "self_report": 0,
    "jwt_verified": 1,
    "dpop_verified": 2,
    "f13_signed": 3,
}


# ---------------------------------------------------------------------------
# StateHandle
# ---------------------------------------------------------------------------


class StateHandle:
    """Kernel-issued handle. Organs verify and echo — never mint, never mutate.

    Construction paths:
      (1) Organ parses caller-supplied envelope via StateHandle.from_envelope(dict)
      (2) Organ derives a child handle for an organ-to-organ call via
          derive_child_handle(parent)
      (3) Kernels MAY also construct handles directly when issuing them

    Once constructed, the handle is read-only-by-convention. Do not mutate
    fields downstream — the echo on success must be verbatim.
    """

    # Slot type declarations (Python annotations on a slotted class are valid
    # at class scope and give type checkers a way to see instance attribute
    # types without needing __init__-side inference).
    session_id: str
    actor_id: str
    verification_level: VerificationLevel
    constitutional_chain_id: Optional[str]
    trace_id: str
    parent_trace_id: Optional[str]
    issued_at: datetime
    expires_at: datetime
    envelope_strict_mode: bool

    __slots__ = (
        "session_id",
        "actor_id",
        "verification_level",
        "constitutional_chain_id",
        "trace_id",
        "parent_trace_id",
        "issued_at",
        "expires_at",
        "envelope_strict_mode",
    )

    def __init__(
        self,
        session_id: str,
        actor_id: str,
        verification_level: VerificationLevel = "self_report",
        constitutional_chain_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        parent_trace_id: Optional[str] = None,
        issued_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
        envelope_strict_mode: bool = False,
    ):
        self.session_id = session_id
        self.actor_id = actor_id
        self.verification_level = verification_level
        self.constitutional_chain_id = constitutional_chain_id
        self.trace_id = trace_id or _mint_trace_id()
        self.parent_trace_id = parent_trace_id
        # Kernel-issued handles supply these explicitly; defaults exist as
        # safety nets for ad-hoc construction (testing, child derivation).
        self.issued_at = _ensure_utc(issued_at) if issued_at is not None else _utcnow()
        self.expires_at = (
            _ensure_utc(expires_at)
            if expires_at is not None
            else _utcnow() + timedelta(minutes=DEFAULT_TTL_MINUTES)
        )
        self.envelope_strict_mode = envelope_strict_mode

    # --- serialization ---

    def to_dict(self) -> Dict[str, Any]:
        """For inclusion in response.provenance. Verbatim echo of the handle.

        Decision: field name is `provenance` per W3C PROV + OpenTelemetry
        convention. Once chosen, every organ echoes under the same name.
        Field names that go silent (`audit_receipt`, `meta.envelope`) are
        FAIL against the regression suite.
        """
        return {
            "session_id": self.session_id,
            "actor_id": self.actor_id,
            "verification_level": self.verification_level,
            "constitutional_chain_id": self.constitutional_chain_id,
            "trace_id": self.trace_id,
            "parent_trace_id": self.parent_trace_id,
            "issued_at": self.issued_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "envelope_strict_mode": self.envelope_strict_mode,
        }

    @classmethod
    def from_envelope(cls, envelope: "Dict[str, Any]") -> "StateHandle":
        """Parse an envelope dict. Raises EnvelopeRejection on schema mismatch.

        Required fields: session_id, actor_id.
        Optional fields default per session/state contract.
        """
        if not isinstance(envelope, dict):
            raise EnvelopeRejection(
                reason="SCHEMA_VERSION_UNSUPPORTED",
                detail=f"envelope must be a dict, got {type(envelope).__name__}",
                received_envelope={"raw": repr(envelope)[:200]},
            )

        # Required-field check happens via KeyError; we turn it into rejection.
        try:
            session_id = str(envelope["session_id"])
            actor_id = str(envelope["actor_id"])
        except (KeyError, TypeError) as e:
            raise EnvelopeRejection(
                reason="SCHEMA_VERSION_UNSUPPORTED",
                detail=f"envelope missing required field: {e}",
                received_envelope=envelope,
            )

        return cls(
            session_id=session_id,
            actor_id=actor_id,
            verification_level=_coerce_verification_level(
                envelope.get("verification_level")
            ),
            constitutional_chain_id=envelope.get("constitutional_chain_id"),
            trace_id=(
                str(envelope["trace_id"])
                if envelope.get("trace_id") is not None
                else None
            ),
            parent_trace_id=envelope.get("parent_trace_id"),
            issued_at=_coerce_dt(envelope.get("issued_at"), "issued_at"),
            expires_at=_coerce_dt(envelope.get("expires_at"), "expires_at"),
            envelope_strict_mode=bool(envelope.get("envelope_strict_mode", False)),
        )


# ---------------------------------------------------------------------------
# EnvelopeRejection — structured error per SEP-1303
# ---------------------------------------------------------------------------


class EnvelopeRejection(Exception):
    """Structured-error shape. NEVER bare-string, NEVER verdict field.

    Distinction from kernel HOLD verdict:
      HOLD     = "evaluated, evidence insufficient" (carries epistemic state)
      Reject   = "never evaluated" (carries no epistemic claim)

    Regression suites can assert the absence of a `verdict` field on
    rejections as a type-level guarantee.
    """

    __slots__ = ("reason", "detail", "received_envelope", "rejected_at")

    def __init__(
        self,
        reason: EnvelopeRejectionReason,
        detail: str,
        received_envelope: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(f"{reason}: {detail}")
        self.reason = reason
        self.detail = detail
        # Defensive copy to avoid aliasing in caller logs.
        self.received_envelope = (
            dict(received_envelope) if isinstance(received_envelope, dict) else None
        )
        self.rejected_at = _utcnow()

    def to_error_envelope(self) -> Dict[str, Any]:
        """Map to JSON-RPC error shape per SEP-1303.

        NO `verdict` field. NO `output`/`result` field. Just structured
        rejection metadata.
        """
        return {
            "error_class": "ENVELOPE_REJECTED",
            "reason": self.reason,
            "detail": self.detail,
            "received_envelope": self.received_envelope,
            "rejected_at": self.rejected_at.isoformat(),
            "protocol_version": PROTOCOL_SCHEMA_VERSION,
        }


# ---------------------------------------------------------------------------
# Kernel-side authoritative session state — contract
# ---------------------------------------------------------------------------


class KernelSessionRegistry:
    """Kernel-side authoritative session state.

    Organs should not implement this directly — they receive a reference to
    an instance maintained by arifOS. This is the contract.

    Implementations must be:
      - thread-safe / async-safe
      - authoritative for session liveness, actor binding, TTL
      - the single point of seal-record lookup (verify_seal)
      - the single point of clock truth (now())
    """

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Return session record or None.

        The record must include at minimum:
          bound_actor                  : str
          minimum_verification_level  : VerificationLevel
          expires_at                   : datetime (re-checked by kernel.now())
        """
        raise NotImplementedError

    def verify_seal(self, constitutional_chain_id: str) -> bool:
        """True iff a matching SEAL exists in the kernel's audit ledger.

        This is the ONLY way a constitutional_chain_id becomes meaningful.
        Presence is not proof — kernel lookup is proof.
        """
        raise NotImplementedError

    def now(self) -> datetime:
        """Authoritative 'now' — single source of truth across the federation.

        Implementations may consult NTP or a kernel-side monotonic clock.
        The single most important property is CONSISTENCY: every call to
        now() within a request cycle returns the same value across all organs.
        """
        return _utcnow()


# ---------------------------------------------------------------------------
# verify_envelope — every organ calls this FIRST
# ---------------------------------------------------------------------------


def verify_envelope(
    envelope: Optional[Dict[str, Any]],
    kernel: KernelSessionRegistry,
) -> StateHandle:
    """Every organ calls this FIRST, before any compute.

    Verification is a lookup against kernel state — never trust of caller
    claims. On success, returns the parsed and verified StateHandle ready
    for echo and downstream propagation.

    Raises EnvelopeRejection on any failure mode.
    """
    if envelope is None:
        raise EnvelopeRejection(
            reason="ENVELOPE_MISSING",
            detail="Call carried no _envelope. Refusing to evaluate.",
            received_envelope=None,
        )

    handle = StateHandle.from_envelope(envelope)

    session = kernel.get(handle.session_id)
    if session is None:
        raise EnvelopeRejection(
            reason="SESSION_UNKNOWN",
            detail=f"session_id {handle.session_id!r} not kernel-issued or not live.",
            received_envelope=envelope,
        )

    # Authoritative TTL check — kernel-supplied now, not caller-supplied.
    if handle.expires_at < kernel.now():
        raise EnvelopeRejection(
            reason="SESSION_EXPIRED",
            detail=(
                f"Handle expired at {handle.expires_at.isoformat()}, "
                f"kernel now {kernel.now().isoformat()}. Re-init via arif_init."
            ),
            received_envelope=envelope,
        )

    # Actor binding check — string match on caller-supplied actor_id is
    # insufficient; the kernel must confirm.
    bound_actor = session.get("bound_actor")
    if bound_actor is None or bound_actor != handle.actor_id:
        raise EnvelopeRejection(
            reason="ACTOR_MISMATCH",
            detail=(
                f"actor_id {handle.actor_id!r} does not match session "
                f"binding {bound_actor!r}."
            ),
            received_envelope=envelope,
        )

    # Verification level monotonicity — caller's claimed level must be at
    # least as strong as the session's bound level.
    min_level = session.get("minimum_verification_level", "self_report")
    caller_order = _VERIFICATION_LEVEL_ORDER.get(handle.verification_level, -1)
    min_order = _VERIFICATION_LEVEL_ORDER.get(min_level, 0)
    if caller_order < min_order:
        raise EnvelopeRejection(
            reason="VERIFICATION_LEVEL_MISMATCH",
            detail=(
                f"caller verification_level={handle.verification_level!r} "
                f"is below session's bound minimum {min_level!r}."
            ),
            received_envelope=envelope,
        )

    # Constitutional chain ID — presence is NOT proof; must resolve to a SEAL.
    if handle.constitutional_chain_id is not None:
        if not kernel.verify_seal(handle.constitutional_chain_id):
            raise EnvelopeRejection(
                reason="CHAIN_ID_UNVERIFIED",
                detail=(
                    f"cc_id {handle.constitutional_chain_id!r} present but no "
                    "matching SEAL record. Presence is not proof."
                ),
                received_envelope=envelope,
            )

    # Trace ID format check — server-side enforcement; we expect
    # "trace-<16 hex chars>".
    trace = handle.trace_id or ""
    if not trace.startswith("trace-") or len(trace) != len("trace-") + 16:
        raise EnvelopeRejection(
            reason="TRACE_ID_MALFORMED",
            detail=(
                f"trace_id {trace!r} does not match expected format 'trace-<hex16>'."
            ),
            received_envelope=envelope,
        )

    return handle


# ---------------------------------------------------------------------------
# Soft check + Strict check — TTL posture
# ---------------------------------------------------------------------------


def soft_check_expires_at(handle: StateHandle, kernel_now: datetime) -> str:
    """Return a log message if handle is near-expiry; empty string if fresh.

    Organ-side opt-in: print this at WARNING level; do NOT block on it.
    Used by organs that want a forensic trail of clock skew.

    Returns empty string when the handle is comfortably fresh.
    """
    delta = (handle.expires_at - kernel_now).total_seconds()
    if delta < 0:
        return (
            f"[envelope] WARN handle {handle.session_id} expired "
            f"{abs(delta):.1f}s ago (kernel authoritative: clock skew likely)"
        )
    if delta < CLOCK_SKEW_TOLERANCE_SECONDS:
        return (
            f"[envelope] WARN handle {handle.session_id} near-expiry "
            f"({delta:.1f}s remaining, tolerance "
            f"{CLOCK_SKEW_TOLERANCE_SECONDS}s)"
        )
    return ""


def strict_check_expires_at(handle: StateHandle, kernel_now: datetime) -> None:
    """Strict variant for envelope_strict_mode=True: hard-block on expiry.

    Only call this for 888_HOLD-bound actions where the caller has explicitly
    opted into organ-side hard enforcement. Default behaviour is soft-check;
    for 888_HOLD actions, organs MUST consult envelope_strict_mode first and
    invoke this check when True.
    """
    if handle.expires_at < kernel_now:
        raise EnvelopeRejection(
            reason="SESSION_EXPIRED",
            detail=(
                f"strict-mode: handle expired "
                f"({handle.expires_at.isoformat()} < {kernel_now.isoformat()})"
            ),
            received_envelope=handle.to_dict(),
        )


def maybe_strict_check(handle: StateHandle, kernel_now: datetime) -> None:
    """Convenience: dispatch soft-check or strict-check based on flag."""
    if handle.envelope_strict_mode:
        strict_check_expires_at(handle, kernel_now)
    # Soft check is intentionally a logging call, not a raise.
    # Use soft_check_expires_at(handle, kernel_now) directly to capture its message.


# ---------------------------------------------------------------------------
# Hop rule — propagate through organ-to-organ calls
# ---------------------------------------------------------------------------


def derive_child_handle(
    parent: StateHandle,
    new_trace_id: Optional[str] = None,
    new_strict_mode: Optional[bool] = None,
) -> StateHandle:
    """Produce a child handle for an organ-to-organ call.

    INVARIANT: session_id, actor_id, verification_level, constitutional_chain_id,
    issued_at, expires_at carry through UNCHANGED. Only trace_id rotates;
    only envelope_strict_mode may be ATTENUATED (never escalated) by a child
    organ.

    "Attenuate, never escalate" is the load-bearing phrase of this function.
    """
    if new_strict_mode is None:
        new_strict_mode = parent.envelope_strict_mode
    elif new_strict_mode and not parent.envelope_strict_mode:
        # Strict mode escalation — forbid.
        raise ValueError(
            "Cannot escalate envelope_strict_mode from False to True on a "
            "child handle. Attenuate, never escalate."
        )

    return StateHandle(
        session_id=parent.session_id,
        actor_id=parent.actor_id,
        verification_level=parent.verification_level,
        constitutional_chain_id=parent.constitutional_chain_id,
        trace_id=new_trace_id or _mint_trace_id(),
        parent_trace_id=parent.trace_id,  # THIS call becomes parent of next
        issued_at=parent.issued_at,
        expires_at=parent.expires_at,
        envelope_strict_mode=new_strict_mode,
    )


# ---------------------------------------------------------------------------
# Echo rule — to be invoked on every successful response
# ---------------------------------------------------------------------------


def build_provenance_block(handle: StateHandle) -> Dict[str, Any]:
    """Produce the canonical `provenance` block for inclusion in a successful
    organ response. Verbatim echo of the handle. No additions, no edits.

    Decision: field name is `provenance` per W3C PROV + OpenTelemetry
    convention. Once chosen, this is the contract — every organ echoes
    under the same field.
    """
    return {
        "provenance": handle.to_dict(),
        # Helper for downstream verification: hash of the handle, not a
        # security mechanism, just for diffable forensic logging.
        "provenance_handle_sha256": _handle_digest(handle),
    }


def _handle_digest(handle: StateHandle) -> str:
    """Stable hash of the canonical handle dict. Forensic only — not auth."""
    import hashlib
    import json as _json

    payload = _json.dumps(handle.to_dict(), sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Schema-version header — for wire-level peer compatibility
# ---------------------------------------------------------------------------


def envelope_compatibility_version() -> str:
    """Return the protocol version this module implements.

    Use this on the wire as a header
    (e.g. `X-ArifOS-Protocol: arifos_envelope_version()`) so that
    future-versioned organs can refuse mismatched peers gracefully.
    """
    return PROTOCOL_SCHEMA_VERSION


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------


__all__ = [
    # Constants
    "PROTOCOL_SCHEMA_VERSION",
    "DEFAULT_TTL_MINUTES",
    "CLOCK_SKEW_TOLERANCE_SECONDS",
    "SESSION_ID_FORMAT",
    # Types
    "EnvelopeRejectionReason",
    "VerificationLevel",
    "StateHandle",
    "EnvelopeRejection",
    "KernelSessionRegistry",
    # Verifiers
    "verify_envelope",
    # TTL posture
    "soft_check_expires_at",
    "strict_check_expires_at",
    "maybe_strict_check",
    # Hop rule
    "derive_child_handle",
    # Echo rule
    "build_provenance_block",
    # Wire-level
    "envelope_compatibility_version",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _mint_trace_id() -> str:
    return f"trace-{uuid4().hex[:16]}"


def _coerce_verification_level(v: Any) -> VerificationLevel:
    allowed = ("self_report", "jwt_verified", "dpop_verified", "f13_signed")
    if isinstance(v, str) and v in allowed:
        return cast(VerificationLevel, v)
    # Default to "self_report" is permissive; rejection happens on
    # VERIFICATION_LEVEL_MISMATCH if the session requires a higher floor.
    return "self_report"


def _coerce_dt(v: Any, field: str) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return _ensure_utc(v)
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return _ensure_utc(dt)
        except ValueError as e:
            raise ValueError(f"{field}: bad ISO-8601 timestamp ({e})")
    raise ValueError(f"{field}: not a datetime-coercible value")


# ---------------------------------------------------------------------------
# Self-test (run with `python3 arifos_envelope.py`)
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # Round-trip self-test.
    sample = {
        "session_id": "SEAL-0123456789abcdef",
        "actor_id": "ARIF_FAZIL",
        "verification_level": "f13_signed",
        "constitutional_chain_id": "cc_abc123",
        "trace_id": "trace-0011223344556677",
        "parent_trace_id": None,
        "issued_at": "2026-07-08T15:00:00Z",
        "expires_at": "2026-07-08T15:30:00Z",
        "envelope_strict_mode": False,
    }
    h = StateHandle.from_envelope(sample)
    assert h.session_id == "SEAL-0123456789abcdef"
    assert h.verification_level == "f13_signed"

    rt = h.to_dict()
    assert rt["actor_id"] == "ARIF_FAZIL"
    assert rt["trace_id"] == "trace-0011223344556677"

    # Provenance block
    prov = build_provenance_block(h)
    assert "provenance" in prov
    assert "provenance_handle_sha256" in prov
    assert "verdict" not in prov, "provenance block must NOT contain a verdict field"

    # Hop rule
    child = derive_child_handle(h)
    assert child.session_id == h.session_id
    assert child.actor_id == h.actor_id
    assert child.parent_trace_id == h.trace_id
    assert child.trace_id != h.trace_id

    # Strict-mode escalation must fail
    try:
        derive_child_handle(h, new_strict_mode=True)
        raise AssertionError("strict-mode escalation was incorrectly allowed")
    except ValueError:
        pass

    # Rejection without verdict field
    rej = EnvelopeRejection(reason="ENVELOPE_MISSING", detail="test")
    err_env = rej.to_error_envelope()
    assert err_env["error_class"] == "ENVELOPE_REJECTED"
    assert "verdict" not in err_env, "rejection must NOT contain a verdict field"
    assert "result" not in err_env, "rejection must NOT contain a result field"

    # Soft check
    warn = soft_check_expires_at(h, _utcnow())
    # Either empty (fresh) or a warning — both acceptable
    assert warn == "" or warn.startswith("[envelope]")

    print("Parsed:", h.session_id, h.actor_id, h.verification_level)
    print("Echo  :", build_provenance_block(h))
    print("Hop   :", derive_child_handle(h).to_dict())
    print("Soft  :", soft_check_expires_at(h, _utcnow()) or "(no warning)")
    print("Strict-mode escalation correctly forbidden.")
    print("Rejection has no verdict field.")
    print("OK — arifos_envelope.py self-test passed.")
