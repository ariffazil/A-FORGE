#!/usr/bin/env python3
"""TDD test suite for PR-FED-1: Attribution and Lineage.

Run RED phase against read-only baseline:
    FED_ATTRIB_TARGET=baseline pytest tests/fed/test_pr_fed_1_attribution.py -k "test_red_"

Run full GREEN phase against canonical worktree implementation:
    pytest tests/fed/test_pr_fed_1_attribution.py
"""

from __future__ import annotations

import asyncio
import copy
import importlib.util
import os
import re
import sqlite3
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest

WORKTREE_ROOT = Path(__file__).resolve().parents[2]
CANDIDATE_PATH = WORKTREE_ROOT / "scripts" / "fed_attribution_callback.py"
BASELINE_PATH = Path("/root/.local/share/arifos/fed_attribution_callback.py")

ISO_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$")


def _install_litellm_stubs() -> None:
    """Stub litellm modules so tests run fast without network/cost-map fetches."""
    if "litellm" not in sys.modules:
        litellm_mod = types.ModuleType("litellm")
        integrations_mod = types.ModuleType("litellm.integrations")
        custom_logger_mod = types.ModuleType("litellm.integrations.custom_logger")
        proxy_mod = types.ModuleType("litellm.proxy")
        proxy_types_mod = types.ModuleType("litellm.proxy._types")

        class CustomLogger:
            pass

        class ProxyException(Exception):
            def __init__(self, message="", type="", param=None, code=500):
                super().__init__(message)
                self.message = message
                self.type = type
                self.param = param
                self.code = code

        custom_logger_mod.CustomLogger = CustomLogger
        proxy_types_mod.ProxyException = ProxyException

        sys.modules["litellm"] = litellm_mod
        sys.modules["litellm.integrations"] = integrations_mod
        sys.modules["litellm.integrations.custom_logger"] = custom_logger_mod
        sys.modules["litellm.proxy"] = proxy_mod
        sys.modules["litellm.proxy._types"] = proxy_types_mod


def _load_target_module(tmp_path: Path):
    _install_litellm_stubs()
    target = os.environ.get("FED_ATTRIB_TARGET", "candidate").strip().lower()
    src = BASELINE_PATH if target == "baseline" else CANDIDATE_PATH
    if not src.exists():
        pytest.fail(f"Target callback file does not exist: {src}")

    # Provide a minimal deterministic config YAML so GROUP_MAP works offline.
    cfg_path = tmp_path / "litellm-test-config.yaml"
    cfg_path.write_text(
        "model_list:\n"
        "  - model_name: deepseek-flash\n"
        "    litellm_params:\n"
        "      model: openai/deepseek-chat\n"
        "      api_base: https://api.deepseek.com/v1\n"
        "  - model_name: kimi-k3\n"
        "    litellm_params:\n"
        "      model: openai/moonshot/kimi-k3\n"
        "      api_base: https://openrouter.ai/api/v1\n"
        "  - model_name: hermes-default\n"
        "    litellm_params:\n"
        "      model: openai/xiaomi/mimo-v2-flash\n"
        "      api_base: https://api.xiaomimimo.com/v1\n",
        encoding="utf-8",
    )
    os.environ["FED_CONFIG_PATH"] = str(cfg_path)

    mod_name = f"fed_attrib_under_test_{target}_{id(tmp_path)}"
    spec = importlib.util.spec_from_file_location(mod_name, str(src))
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # Isolate DB and log path inside tmp_path (never touch live paths).
    db_path = tmp_path / "token_bank.db"
    _init_legacy_spend_table(db_path)
    mod.SPEND_DB = str(db_path)
    mod.LOG_PATH = str(tmp_path / "fed_attribution_log.jsonl")
    return mod, db_path


def _init_legacy_spend_table(db_path: Path) -> None:
    """Create the exact 14-column legacy token_bank_spend schema."""
    con = sqlite3.connect(str(db_path))
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS token_bank_spend (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_name TEXT,
                model_id TEXT,
                agent_id TEXT,
                tokens_in INTEGER,
                tokens_out INTEGER,
                estimated_cost_usd REAL,
                called_at TEXT,
                protocol TEXT,
                api_base TEXT,
                attribution_confidence REAL,
                call_id TEXT,
                serving_provider TEXT,
                serving_provider_source TEXT,
                attempted_fallbacks INTEGER
            )
            """
        )
        con.commit()
    finally:
        con.close()


def _fetch_rows(db_path: Path) -> list[dict]:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute("SELECT * FROM token_bank_spend").fetchall()]
    finally:
        con.close()


def _make_response(
    model: str = "deepseek-chat",
    custom_llm_provider: str = "openai",
    provider: str | None = None,
    response_cost: float = 0.0012,
    prompt_tokens: int = 42,
    completion_tokens: int = 18,
    cache_hit: bool = False,
    attempted_fallbacks: int = 0,
    served_group: str = "deepseek-flash",
    call_id: str = "call-001",
    deployment_id: str | None = "dep-ds-1",
    content: str = "Synthetic response body text",
):
    hidden = {
        "custom_llm_provider": custom_llm_provider,
        "response_cost": response_cost,
        "cache_hit": cache_hit,
        "litellm_call_id": call_id,
        "model_id": deployment_id,
        "additional_headers": {
            "x-litellm-attempted-fallbacks": str(attempted_fallbacks),
            "x-litellm-model-group": served_group,
        },
    }
    model_extra = {}
    if provider is not None:
        model_extra["provider"] = provider

    usage = SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)
    choices = [SimpleNamespace(message=SimpleNamespace(content=content))]
    return SimpleNamespace(
        model=model,
        usage=usage,
        choices=choices,
        model_extra=model_extra,
        _hidden_params=hidden,
    )


# ---------------------------------------------------------------------------
# RED 1..6 — Contract tests that MUST FAIL on baseline and PASS on candidate
# ---------------------------------------------------------------------------


def test_red_1_missing_actor_is_explicit_typed_unknown(tmp_path: Path):
    """RED 1: Missing actor metadata must NOT silently default to lowercase 'unknown'
    without typed actor_source='UNKNOWN' and attribution_confidence=0.0."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "call-red-1",
        "metadata": {},
    }
    resp = _make_response(model="deepseek-chat", call_id="call-red-1")
    mod.write_spend_row(kwargs, resp)

    rows = _fetch_rows(db_path)
    assert len(rows) == 1
    row = rows[0]
    assert row.get("actor_id") == "UNKNOWN"
    assert row.get("actor_source") == "UNKNOWN"
    assert row["agent_id"] == "UNKNOWN"
    assert row["attribution_confidence"] == 0.0


def test_red_2_provider_not_overwritten_with_openai_transport(tmp_path: Path):
    """RED 2: Serving provider must NOT be overwritten by LiteLLM transport 'openai';
    transport_protocol, entry_gateway, routing_intermediary, serving_provider must be separated."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "call-red-2",
        "metadata": {"actor_id": "fi-009"},
    }
    resp = _make_response(model="deepseek-chat", custom_llm_provider="openai", call_id="call-red-2")
    mod.write_spend_row(kwargs, resp)

    rows = _fetch_rows(db_path)
    assert len(rows) == 1
    row = rows[0]
    assert row["provider_name"] != "openai"
    assert row.get("transport_protocol") == "openai_compatible"
    assert row.get("routing_intermediary") == "direct"
    assert row.get("serving_provider") == "deepseek"
    assert row.get("api_base_host_redacted") == "api.deepseek.com"
    assert row.get("entry_gateway") == "litellm_kvm8_4000"


def test_red_3_timestamp_valid_utc_iso8601_no_literal_percent_f(tmp_path: Path):
    """RED 3: called_at must be valid UTC ISO-8601 with microseconds, zero literal '%f'."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "call-red-3",
        "metadata": {"actor_id": "fi-009"},
    }
    resp = _make_response(model="deepseek-chat", call_id="call-red-3")
    mod.write_spend_row(kwargs, resp)

    rows = _fetch_rows(db_path)
    assert len(rows) == 1
    called_at = rows[0]["called_at"]
    assert "%f" not in called_at
    assert ISO_UTC_RE.match(called_at), f"Invalid ISO-8601 UTC timestamp: {called_at!r}"


def test_red_4_caller_metadata_preserved_across_headers_metadata_tags(tmp_path: Path):
    """RED 4: actor_id, session_id, task_id, turn_id, purpose, trace_id must not be dropped
    across headers / metadata / tags surfaces."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "call-red-4",
        "proxy_server_request": {
            "headers": {
                "x-arifos-actor-id": "fi-009",
                "x-arifos-session-id": "sess-101",
                "x-arifos-trace-id": "trace-abc",
            }
        },
        "metadata": {
            "model_group": "deepseek-flash",
            "task_id": "task-202",
            "tags": ["turn:turn-7", "purpose:code_review"],
        },
    }
    resp = _make_response(model="deepseek-chat", call_id="call-red-4")
    rec = mod.attribution(kwargs, resp, request_headers=kwargs["proxy_server_request"]["headers"])
    assert rec.get("actor_id") == "fi-009"
    assert rec.get("session_id") == "sess-101"
    assert rec.get("task_id") == "task-202"
    assert rec.get("turn_id") == "turn-7"
    assert rec.get("purpose") == "code_review"
    assert rec.get("trace_id") == "trace-abc"
    assert rec.get("requested_model_group") == "deepseek-flash"

    mod.write_spend_row(kwargs, resp)
    row = _fetch_rows(db_path)[0]
    assert row.get("actor_id") == "fi-009"
    assert row.get("session_id") == "sess-101"
    assert row.get("task_id") == "task-202"
    assert row.get("turn_id") == "turn-7"
    assert row.get("purpose") == "code_review"
    assert row.get("trace_id") == "trace-abc"
    assert row.get("requested_model_group") == "deepseek-flash"


def test_red_5_no_prompt_response_or_secret_leaks_into_attribution_or_db(tmp_path: Path):
    """RED 5: Prompt bodies, response bodies, URL credentials, query tokens, and auth headers
    must NEVER leak into attribution record or DB row."""
    mod, db_path = _load_target_module(tmp_path)
    synthetic_secret = "SYNTHETIC_CREDENTIAL_DO_NOT_STORE_9988"
    synthetic_prompt = "SYNTHETIC_PROMPT_BODY_PRIVATE_ALPHA_7744"
    synthetic_reply = "SYNTHETIC_REPLY_BODY_PRIVATE_BETA_6633"

    kwargs = {
        "model": "openai/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": f"https://user:{synthetic_secret}@api.deepseek.com/v1?api_key={synthetic_secret}",
        "litellm_call_id": "call-red-5",
        "messages": [{"role": "user", "content": f"actor_id=fi-999 {synthetic_prompt}"}],
        "proxy_server_request": {
            "headers": {
                "authorization": f"Bearer {synthetic_secret}",
                "x-api-key": synthetic_secret,
            }
        },
        "metadata": {},
    }
    resp = _make_response(model="deepseek-chat", call_id="call-red-5", content=synthetic_reply)

    rec = mod.attribution(kwargs, resp, request_headers=kwargs["proxy_server_request"]["headers"])
    mod.write_spend_row(kwargs, resp)
    row = _fetch_rows(db_path)[0]

    serialized_rec = str(rec)
    serialized_row = str(row)
    for forbidden in (synthetic_secret, synthetic_prompt, synthetic_reply):
        assert forbidden not in serialized_rec
        assert forbidden not in serialized_row
    # Actor must NEVER be inferred from prompt text
    assert rec.get("actor_id") == "UNKNOWN"
    assert row.get("actor_id") == "UNKNOWN"
    assert row.get("api_base_host_redacted") == "api.deepseek.com"


def test_red_6_unknown_provider_carries_explicit_source_and_confidence(tmp_path: Path):
    """RED 6: Unknown serving provider (e.g. OpenRouter without response provider field)
    must emit UNKNOWN with explicit serving_provider_source and serving_provider_confidence=0.0."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/moonshot/kimi-k3",
        "custom_llm_provider": "openai",
        "api_base": "https://openrouter.ai/api/v1",
        "litellm_call_id": "call-red-6",
        "metadata": {"actor_id": "fi-009"},
    }
    resp = _make_response(
        model="moonshot/kimi-k3",
        custom_llm_provider="openai",
        provider=None,
        served_group="kimi-k3",
        call_id="call-red-6",
    )
    rec = mod.attribution(kwargs, resp)
    assert rec.get("serving_provider") == "UNKNOWN"
    assert rec.get("serving_provider_source") in ("unverified_intermediary", "absent")
    assert rec.get("serving_provider_confidence") == 0.0

    mod.write_spend_row(kwargs, resp)
    row = _fetch_rows(db_path)[0]
    assert row.get("serving_provider") == "UNKNOWN"
    assert row.get("serving_provider_source") in ("unverified_intermediary", "absent")
    assert row.get("serving_provider_confidence") == 0.0
    assert row.get("routing_intermediary") == "openrouter"


# ---------------------------------------------------------------------------
# GREEN 1..8 — Full PR-FED-1 contract verification on candidate implementation
# ---------------------------------------------------------------------------


def test_green_1_known_interactive_callers_attributed_100_percent(tmp_path: Path):
    """GREEN 1: Known interactive callers are 100% attributed with deterministic precedence."""
    mod, db_path = _load_target_module(tmp_path)
    fixtures = [
        # 1. Explicit governed header beats auth key, tags, and caller-service
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g1-1",
                "proxy_server_request": {"headers": {"x-arifos-actor-id": "fi-009"}},
                "metadata": {
                    "user_api_key_alias": "fallback-key",
                    "tags": ["actor:fallback-tag"],
                    "caller_service": "fallback-svc",
                },
            },
            "fi-009",
            "explicit_metadata",
            1.0,
        ),
        # 2. Explicit metadata actor_id
        (
            {
                "model": "openai/xiaomi/mimo-v2-flash",
                "api_base": "https://api.xiaomimimo.com/v1",
                "litellm_call_id": "g1-2",
                "metadata": {"actor_id": "hermes-interactive", "session_id": "s-2"},
            },
            "hermes-interactive",
            "explicit_metadata",
            1.0,
        ),
        # 3. Authenticated key/team mapping
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g1-3",
                "metadata": {"user_api_key_alias": "claude-code-fi-002", "tags": ["actor:lower-prio"]},
            },
            "claude-code-fi-002",
            "auth_key_team",
            0.95,
        ),
        # 4. Request tags
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g1-4",
                "metadata": {"tags": ["actor:opencode-fi-001", "purpose:refactor"]},
            },
            "opencode-fi-001",
            "request_tags",
            0.85,
        ),
    ]

    for kwargs, exp_actor, exp_source, exp_conf in fixtures:
        resp = _make_response(call_id=kwargs["litellm_call_id"])
        mod.write_spend_row(kwargs, resp)

    rows = _fetch_rows(db_path)
    assert len(rows) == len(fixtures)
    for row, (_, exp_actor, exp_source, exp_conf) in zip(rows, fixtures):
        assert row["actor_id"] == exp_actor
        assert row["agent_id"] == exp_actor
        assert row["actor_source"] == exp_source
        assert row["attribution_confidence"] == exp_conf


def test_green_2_known_background_callers_attributed_100_percent(tmp_path: Path):
    """GREEN 2: Known background/daemon callers are 100% attributed across surfaces."""
    mod, db_path = _load_target_module(tmp_path)
    fixtures = [
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g2-1",
                "proxy_server_request": {"headers": {"x-caller-service": "arif-flow"}},
                "metadata": {"purpose": "heartbeat_metabolism"},
            },
            "arif-flow",
            "caller_service",
            0.75,
        ),
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g2-2",
                "proxy_server_request": {"headers": {"user-agent": "chron/1.4.2 python-httpx"}},
                "metadata": {"purpose": "prediction_sweep"},
            },
            "chron",
            "caller_service",
            0.75,
        ),
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g2-3",
                "metadata": {"tags": ["actor:frame-drift-daemon", "task:drift-check"]},
            },
            "frame-drift-daemon",
            "request_tags",
            0.85,
        ),
        (
            {
                "model": "openai/deepseek-chat",
                "api_base": "https://api.deepseek.com/v1",
                "litellm_call_id": "g2-4",
                "metadata": {"user_api_key_team_alias": "geox-worker"},
            },
            "geox-worker",
            "auth_key_team",
            0.95,
        ),
    ]

    for kwargs, _, _, _ in fixtures:
        resp = _make_response(call_id=kwargs["litellm_call_id"])
        mod.write_spend_row(kwargs, resp)

    rows = _fetch_rows(db_path)
    assert len(rows) == len(fixtures)
    for row, (_, exp_actor, exp_source, exp_conf) in zip(rows, fixtures):
        assert row["actor_id"] == exp_actor
        assert row["actor_source"] == exp_source
        assert row["attribution_confidence"] == exp_conf


def test_green_3_unknown_remains_explicit_and_typed_for_truly_unknown_callers(tmp_path: Path):
    """GREEN 3: Truly unknown callers remain explicit UNKNOWN (never conflated with model_group)."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "g3-1",
        "metadata": {"model_group": "deepseek-flash"},
        "proxy_server_request": {"headers": {"user-agent": "curl/8.5.0"}},
    }
    resp = _make_response(call_id="g3-1")
    mod.write_spend_row(kwargs, resp)

    row = _fetch_rows(db_path)[0]
    assert row["actor_id"] == "UNKNOWN"
    assert row["agent_id"] == "UNKNOWN"
    assert row["actor_source"] == "UNKNOWN"
    assert row["attribution_confidence"] == 0.0
    assert row["requested_model_group"] == "deepseek-flash"


def test_green_4_provider_taxonomy_and_cost_evidence_class(tmp_path: Path):
    """GREEN 4: Provider taxonomy separates transport_protocol, entry_gateway,
    routing_intermediary, serving_provider, and cost_evidence_class."""
    mod, db_path = _load_target_module(tmp_path)

    # Case A: OpenRouter with request-bound provider="DeepSeek" and provider-reported cost
    kw_or = {
        "model": "openrouter/deepseek/deepseek-chat",
        "custom_llm_provider": "openai",
        "api_base": "https://openrouter.ai/api/v1",
        "litellm_call_id": "g4-or",
        "metadata": {"actor_id": "fi-009"},
    }
    resp_or = _make_response(
        model="deepseek/deepseek-chat",
        custom_llm_provider="openai",
        provider="DeepSeek",
        call_id="g4-or",
    )
    resp_or.usage.cost = 0.0008
    mod.write_spend_row(kw_or, resp_or)

    # Case B: Direct Z.AI coding plan (plan-covered, zero cost -> PLAN_INCLUDED_COST_UNATTRIBUTED, never "free")
    kw_plan = {
        "model": "openai/glm-4.7",
        "custom_llm_provider": "openai",
        "api_base": "https://api.z.ai/api/paas/v4",
        "litellm_call_id": "g4-plan",
        "metadata": {"actor_id": "fi-009", "billing_mode": "coding_plan"},
    }
    resp_plan = _make_response(
        model="glm-4.7",
        custom_llm_provider="openai",
        provider=None,
        response_cost=0.0,
        call_id="g4-plan",
    )
    mod.write_spend_row(kw_plan, resp_plan)

    # Case C: Anthropic transport protocol + LiteLLM calculated cost
    kw_anth = {
        "model": "anthropic/claude-sonnet",
        "custom_llm_provider": "anthropic",
        "api_base": "https://api.minimax.io/anthropic/v1",
        "litellm_call_id": "g4-anth",
        "metadata": {"actor_id": "fi-009"},
    }
    resp_anth = _make_response(
        model="MiniMax-M2.5",
        custom_llm_provider="anthropic",
        provider=None,
        response_cost=0.0025,
        call_id="g4-anth",
    )
    mod.write_spend_row(kw_anth, resp_anth)

    # Case D: Responses transport protocol + OpenRouter with non-enum provider -> "other"
    kw_resp = {
        "model": "openai/nvidia/nemotron",
        "call_type": "responses",
        "custom_llm_provider": "openai",
        "api_base": "https://openrouter.ai/api/v1",
        "litellm_call_id": "g4-resp",
        "metadata": {"actor_id": "fi-009", "cost_estimated": True},
    }
    resp_other = _make_response(
        model="nvidia/nemotron",
        custom_llm_provider="openai",
        provider="Nvidia",
        response_cost=0.0005,
        call_id="g4-resp",
    )
    mod.write_spend_row(kw_resp, resp_other)

    rows = _fetch_rows(db_path)
    assert len(rows) == 4

    r_or, r_plan, r_anth, r_resp = rows
    assert r_or["transport_protocol"] == "openai_compatible"
    assert r_or["routing_intermediary"] == "openrouter"
    assert r_or["serving_provider"] == "deepseek"
    assert r_or["serving_provider_confidence"] == 1.0
    assert r_or["cost_evidence_class"] == "PROVIDER_REPORTED"

    assert r_plan["transport_protocol"] == "openai_compatible"
    assert r_plan["routing_intermediary"] == "direct"
    assert r_plan["serving_provider"] == "zai"
    assert r_plan["serving_provider_source"] == "direct_host_verified"
    assert r_plan["serving_provider_confidence"] == 0.95
    assert r_plan["cost_evidence_class"] == "PLAN_INCLUDED_COST_UNATTRIBUTED"
    assert "free" not in str(r_plan["cost_evidence_class"]).lower()

    assert r_anth["transport_protocol"] == "anthropic"
    assert r_anth["routing_intermediary"] == "direct"
    assert r_anth["serving_provider"] == "minimax"
    assert r_anth["cost_evidence_class"] == "LITELLM_CALCULATED"

    assert r_resp["transport_protocol"] == "responses"
    assert r_resp["routing_intermediary"] == "openrouter"
    assert r_resp["serving_provider"] == "other"
    assert r_resp["cost_evidence_class"] == "ESTIMATED"


def test_green_5_valid_utc_iso8601_timestamps_zero_percent_f(tmp_path: Path):
    """GREEN 5: Timestamps in both attribution record and DB row are valid UTC ISO-8601."""
    mod, db_path = _load_target_module(tmp_path)
    kwargs = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "g5-1",
        "metadata": {"actor_id": "fi-009"},
    }
    resp = _make_response(call_id="g5-1")
    rec = mod.attribution(kwargs, resp)
    assert "%f" not in rec["timestamp_utc"]
    assert ISO_UTC_RE.match(rec["timestamp_utc"])

    ret = mod.write_spend_row(kwargs, resp)
    assert "%f" not in ret["called_at"]
    assert ISO_UTC_RE.match(ret["called_at"])

    row = _fetch_rows(db_path)[0]
    assert "%f" not in row["called_at"]
    assert ISO_UTC_RE.match(row["called_at"])


def test_green_6_zero_secrets_prompt_or_response_bodies_stored(tmp_path: Path):
    """GREEN 6: Negative test confirming secrets, prompts, and responses never hit rec, log, headers, or DB."""
    mod, db_path = _load_target_module(tmp_path)
    cb = mod.FedAttributionCallback()
    synthetic_secret = "SYNTHETIC_TOKEN_NEVER_PERSIST_4455"
    synthetic_prompt = "SYNTHETIC_PROMPT_SECRET_CONTENT_8811"
    synthetic_reply = "SYNTHETIC_RESPONSE_SECRET_CONTENT_7722"

    data = {
        "model": "deepseek-flash",
        "api_base": f"https://admin:{synthetic_secret}@api.deepseek.com/v1?token={synthetic_secret}",
        "litellm_call_id": "g6-1",
        "messages": [{"role": "user", "content": synthetic_prompt}],
        "proxy_server_request": {
            "headers": {
                "authorization": f"Bearer {synthetic_secret}",
                "x-api-key": synthetic_secret,
                "x-arifos-purpose": f"Bearer {synthetic_secret}",
                "x-arifos-actor-id": "fi-009",
            }
        },
        "metadata": {},
    }
    resp = _make_response(model="deepseek-chat", call_id="g6-1", content=synthetic_reply)

    asyncio.run(cb.async_pre_call_hook(None, None, data, "completion"))
    asyncio.run(cb.async_post_call_success_hook(data, None, resp))
    hdrs = asyncio.run(cb.async_post_call_response_headers_hook(data, None, resp))
    cb.log_success_event(data, resp, 0.0, 1.0)

    log_text = Path(mod.LOG_PATH).read_text(encoding="utf-8")
    row_text = str(_fetch_rows(db_path)[0])
    hdr_text = str(hdrs)

    for forbidden in (synthetic_secret, synthetic_prompt, synthetic_reply):
        assert forbidden not in log_text
        assert forbidden not in row_text
        assert forbidden not in hdr_text


def test_green_7_existing_routing_behavior_unchanged(tmp_path: Path):
    """GREEN 7: Callback does NOT mutate data['model'], fallbacks, retries, or routing params."""
    mod, _ = _load_target_module(tmp_path)
    cb = mod.FedAttributionCallback()
    data = {
        "model": "kimi-k3",
        "fallbacks": [{"kimi-k3": ["deepseek-flash"]}],
        "num_retries": 2,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": "synthetic routing invariance check"}],
        "litellm_call_id": "g7-1",
        "proxy_server_request": {
            "headers": {
                "x-arifos-actor-id": "fi-009",
                "x-arifos-model-integrity": "availability",
            }
        },
    }
    snapshot = copy.deepcopy(data)
    returned = asyncio.run(cb.async_pre_call_hook(None, None, data, "completion"))
    assert returned is data
    assert data == snapshot


def test_green_8_legacy_schema_migration_and_litellm_compatibility(tmp_path: Path):
    """GREEN 8: Idempotent schema migration on legacy 7-column DB, legacy columns populated,
    and strict-mode 409 MODEL_SUBSTITUTED + availability headers remain compatible."""
    mod, _ = _load_target_module(tmp_path)

    # Create a minimal 7-column legacy DB (pre-2026-11-12 schema)
    legacy_db = tmp_path / "legacy_7col.db"
    con = sqlite3.connect(str(legacy_db))
    try:
        con.execute(
            """
            CREATE TABLE token_bank_spend (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_name TEXT,
                model_id TEXT,
                agent_id TEXT,
                tokens_in INTEGER,
                tokens_out INTEGER,
                estimated_cost_usd REAL,
                called_at TEXT
            )
            """
        )
        con.commit()
        added_first = mod.ensure_attribution_schema(con)
        added_second = mod.ensure_attribution_schema(con)
        assert len(added_first) > 0
        assert added_second == []
    finally:
        con.close()

    mod.SPEND_DB = str(legacy_db)
    kwargs = {
        "model": "kimi-k3",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "g8-1",
        "metadata": {"actor_id": "fi-009", "model_group": "kimi-k3"},
        "proxy_server_request": {"headers": {"x-arifos-model-integrity": "strict"}},
    }
    # Substituted response: requested kimi-k3, served deepseek-chat
    resp = _make_response(
        model="deepseek-chat",
        attempted_fallbacks=1,
        served_group="kimi-k3",
        call_id="g8-1",
    )

    cb = mod.FedAttributionCallback()
    asyncio.run(cb.async_pre_call_hook(None, None, kwargs, "completion"))
    with pytest.raises(Exception) as exc_info:
        asyncio.run(cb.async_post_call_success_hook(kwargs, None, resp))
    assert type(exc_info.value).__name__ == "ProxyException"
    assert getattr(exc_info.value, "code", None) == 409

    # Spend write succeeds on migrated legacy DB and populates both legacy + new columns
    mod.write_spend_row(kwargs, resp)
    row = _fetch_rows(legacy_db)[0]
    assert row["provider_name"] == "deepseek"
    assert row["model_id"] == "kimi-k3"
    assert row["agent_id"] == "fi-009"
    assert row["tokens_in"] == 42
    assert row["tokens_out"] == 18
    assert row["attempted_fallbacks"] == 1
    assert row["cache_state"] == "MISS"
    assert row["deployment_id"] == "dep-ds-1"
    assert row["logical_request_id"] == "g8-1"
    assert row["response_status"] == "SUBSTITUTED"

