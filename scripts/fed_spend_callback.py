#!/usr/bin/env python3
"""FED Spend Callback — writes per-call token bank to token_bank.db

Created 2026-09-21 FI-008 — closes token_bank_spend staleness (last entry
2026-08-30). Wired via litellm_settings.callbacks in litellm-config.yaml.

Hooks into LiteLLM proxy's log_success_event for every successful chat
completion. Writes per-call: provider, model, agent_id, tokens_in,
tokens_out, estimated_cost_usd, called_at.

Failures are silently caught so the proxy never crashes on a callback error
(F1: witness, not act; per-call accounting must never block the lane).
"""
import os
import sqlite3
import datetime

from litellm.integrations.custom_logger import CustomLogger

DB = "/app/data/token_bank.db"


class FedSpendCallback(CustomLogger):
    """LiteLLM success callback — persists per-call spend to token_bank.db.

    Must extend CustomLogger; LiteLLM rejects classes that don't.
    """

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            model = kwargs.get("model", "unknown") or "unknown"
            hidden = getattr(response_obj, "_hidden_params", {}) or {}
            provider = (
                hidden.get("custom_llm_provider")
                or kwargs.get("custom_llm_provider")
                or "unknown"
            )
            agent_id = (
                kwargs.get("user_api_key_user_id")
                or kwargs.get("user_id")
                or "unknown"
            )

            usage = getattr(response_obj, "usage", None)
            tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0) if usage else 0
            tokens_out = int(getattr(usage, "completion_tokens", 0) or 0) if usage else 0

            cost = float(hidden.get("response_cost", 0.0) or 0.0)

            called_at = datetime.datetime.utcnow().strftime(
                "%Y-%m-%dT%H:%M:%S.%fZ"
            )

            con = sqlite3.connect(DB, timeout=2.0)
            con.execute(
                "INSERT INTO token_bank_spend "
                "(provider_name, model_id, agent_id, tokens_in, tokens_out, "
                " estimated_cost_usd, called_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    provider,
                    model,
                    agent_id,
                    tokens_in,
                    tokens_out,
                    cost,
                    called_at,
                ),
            )
            con.commit()
            con.close()
        except Exception:
            # Never crash the proxy on callback error (F1 witness, not act).
            pass

    async def async_log_success_event(
        self, kwargs, response_obj, start_time, end_time
    ):
        # Async wrapper — proxy may call this for streaming responses.
        return self.log_success_event(
            kwargs, response_obj, start_time, end_time
        )


# LiteLLM callback loader requires an INSTANCE, not a class.
# Point callbacks config at this module-level instance.
# 2026-09-21 FI-008: litellm raises ValueError if class is passed instead.
proxy_handler_instance = FedSpendCallback()