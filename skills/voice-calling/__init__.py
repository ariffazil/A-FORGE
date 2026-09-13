"""voice-calling skill package for A-FORGE.

Scaffold lane (Fasa 0): governed receipts, dry-run only unless Twilio
credentials are configured AND F13 sovereign approval is presented.
Reference: /root/forge_work/2026-09-13-hermes-voice (GREEN bridge).
"""
from .forge_phone_call import (  # noqa: F401
    ALLOWED_USE_CASES,
    F7_CONFIDENCE_CAP,
    STATUS_COMPLETED,
    STATUS_DRY_RUN,
    STATUS_FAILED,
    check_calendar_conflicts,
    forge_phone_call,
    main,
)

__version__ = "0.1.0"
