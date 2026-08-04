"""
LiteLLM Callback: Strip Responses API state features unsupported by FED gateway.

LiteLLM 1.90.2's FED gateway does NOT support these Responses API features:
  1. `store=true` — requires gateway-managed response state (planned phase 2)
  2. `web_search` tool — Responses API built-in tool (planned phase 2)

Codex CLI v0.146 sends these by default in every Responses API call.

This module exposes:
  - StripResponsesState class extending CustomLogger
  - Module-level singleton `StripResponsesState` so LiteLLM's dotted reference
    `litellm_callbacks.strip_responses_state.StripResponsesState` resolves to
    the INSTANCE (not the class), preserving `self` binding.

Hooks implemented (LiteLLM 1.90.2 signatures):
  - async_pre_request_hook  — preferred pre-call hook (returns modified kwargs)
  - log_pre_api_call        — sync pre-call (mutates kwargs in place)
  - async_log_pre_api_call  — async pre-call (mutates kwargs in place)
  - async_post_call_success_hook — has correct (data, user_api_key_dict, response) signature
  - async_log_success_event / async_log_failure_event — no-op

Author: kimi-code/FI-008 (warga AAA)
Sovereign: F13 (Muhammad Arif bin Fazil)
Date: 2026-08-04T15
Doctrine: DITEMPA BUKAN DIBERI
"""

import logging
import sys
from typing import Any, Dict, List, Optional

_LOG = logging.getLogger("litellm.strip_responses_state")
if not _LOG.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("[STRIP-RESP] %(levelname)s %(message)s"))
    _LOG.addHandler(handler)
    _LOG.setLevel(logging.INFO)


def _strip_in_place(kwargs: Dict[str, Any], phase: str, model: str = "?") -> List[str]:
    """Mutate kwargs to strip unsupported Responses features. Returns list of mutations."""
    # AGGRESSIVE: log EVERY invocation, even if no mutation happens
    _LOG.info("FIRE phase=%s model=%s kwargs_keys=%s", phase, model, sorted(kwargs.keys())[:8])
    mutated: List[str] = []
    try:
        if kwargs.get("store") is True:
            kwargs["store"] = False
            mutated.append("store:true->false")

        tools = kwargs.get("tools")
        if tools and isinstance(tools, list):
            filtered: List[Any] = []
            for t in tools:
                if isinstance(t, dict) and t.get("type") == "web_search":
                    mutated.append("web_search_tool:dropped")
                    continue
                filtered.append(t)
            if len(filtered) != len(tools):
                kwargs["tools"] = filtered
    except Exception as exc:
        _LOG.warning("strip in-place failed (non-fatal): %s", exc)

    if mutated:
        _LOG.info("phase=%s model=%s mutations=%s", phase, model, "+".join(mutated))
    return mutated


class StripResponsesState:
    """LiteLLM callback. Implements hooks with correct signatures."""

    def log_pre_api_call(self, model: str, messages, kwargs: Dict[str, Any]) -> None:
        _strip_in_place(kwargs, phase="sync_pre", model=model)

    async def async_log_pre_api_call(self, model: str, messages, kwargs: Dict[str, Any]) -> None:
        _strip_in_place(kwargs, phase="async_pre", model=model)

    async def async_pre_request_hook(
        self,
        model: str,
        messages: List,
        kwargs: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """LiteLLM 1.90.2 pre-request hook. Returns modified kwargs or None."""
        _strip_in_place(kwargs, phase="async_pre_request", model=model)
        return None

    def log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:
        pass

    def log_failure_event(self, kwargs, response_obj, start_time, end_time) -> None:
        pass

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:
        pass

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time) -> None:
        pass

    async def async_post_call_success_hook(
        self,
        data: Dict[str, Any],
        user_api_key_dict: Any,
        response: Any,
    ) -> Any:
        return None

    async def async_post_call_failure_hook(
        self,
        request_data: Dict[str, Any],
        original_exception: Exception,
        user_api_key_dict: Any,
        traceback_str: Optional[str] = None,
    ) -> Optional[Any]:
        return None


# Module-level singleton with the SAME NAME as the class so that the dotted
# reference `litellm_callbacks.strip_responses_state.StripResponsesState`
# resolves to an INSTANCE (not the class), preserving `self` binding.
StripResponsesState = StripResponsesState()