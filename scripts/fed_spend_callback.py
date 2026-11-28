"""FED Spend Callback — Thin Compatibility Adapter (PR-FED-1 Convergence).

CONVERGENCE NOTICE (PR-FED-1, 2026-11-22):
This module previously operated as an independent 7-column / 10-column writer
to ``token_bank_spend`` (and was updated in PR #120). To eliminate duplicate
writers and silent schema drift, all production spend writes now flow through
the single canonical writer: ``scripts/fed_attribution_callback.py``.

This adapter preserves:
  * ``FedSpendCallback`` / ``proxy_handler_instance`` (delegates directly to
    ``FedAttributionCallback`` with inner_attempt_id deduplication so even if
    both callbacks are accidentally wired, no duplicate row is created).
  * ``HOST_MAP``, ``GROUP_AGENT_MAP``, ``_resolve_provider``, ``_resolve_agent``
    compatibility helpers for PR #120 host-fixture readers.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_SCRIPT_DIR = str(Path(__file__).resolve().parent)
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

import fed_attribution_callback as _canonical

DB = _canonical.SPEND_DB
HOST_MAP = dict(_canonical.VERIFIED_DIRECT_HOST_MAP)
GROUP_AGENT_MAP = dict(_canonical.GROUP_AGENT_MAP)


def _resolve_provider(kwargs, hidden):
    """Compatibility wrapper delegating to canonical provider taxonomy."""
    class _ShimResp:
        _hidden_params = hidden or {}
        model = (kwargs or {}).get("model", "")

    tax = _canonical.resolve_provider_taxonomy(kwargs or {}, _ShimResp())
    return tax["serving_provider"], tax["api_base_host_redacted"]


def _resolve_agent(kwargs):
    """Compatibility wrapper delegating to canonical caller identity resolution."""
    res = _canonical.resolve_caller_identity(kwargs or {})
    return res["actor_id"]


class FedSpendCallback(_canonical.FedAttributionCallback):
    """Deprecated alias for FedAttributionCallback — single canonical writer."""

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        if os.environ.get("FED_TOKEN_BANK_DB"):
            _canonical.SPEND_DB = os.environ["FED_TOKEN_BANK_DB"]
        elif DB != _canonical.SPEND_DB:
            _canonical.SPEND_DB = DB
        return super().log_success_event(kwargs, response_obj, start_time, end_time)


proxy_handler_instance = FedSpendCallback()
