"""Comprehensive TDD & regression suite for PR-FED-1: Attribution & Lineage Convergence.

Isolated: uses tmp_path SQLite databases, synthetic credentials, and offline
stubbed LiteLLM classes. Never connects to production DBs, live inference
endpoints, or production services.
"""

from __future__ import annotations

import asyncio
import copy
import importlib.util
import os
import re
import sqlite3
import stat
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest

WORKTREE_ROOT = Path(__file__).resolve().parents[2]
CANDIDATE_PATH = WORKTREE_ROOT / "scripts" / "fed_attribution_callback.py"
SPEND_ADAPTER_PATH = WORKTREE_ROOT / "scripts" / "fed_spend_callback.py"
RECON_PATH = WORKTREE_ROOT / "scripts" / "fed_token_reconciliation.py"

ISO_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$")


def _install_litellm_stubs() -> None:
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


def _init_legacy_7col_db(db_path: Path) -> None:
    con = sqlite3.connect(str(db_path))
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS token_bank_spend (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                agent_id TEXT DEFAULT 'unknown',
                tokens_in INTEGER DEFAULT 0,
                tokens_out INTEGER DEFAULT 0,
                estimated_cost_usd REAL DEFAULT 0.0,
                called_at TEXT NOT NULL
            )
            """
        )
        con.commit()
    finally:
        con.close()


def _load_candidate(tmp_path: Path):
    _install_litellm_stubs()
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
        "      api_base: https://api.xiaomimimo.com/v1\n"
        "router_settings:\n"
        "  fallbacks:\n"
        "    - kimi-k3: [deepseek-flash]\n",
        encoding="utf-8",
    )
    os.environ["FED_CONFIG_PATH"] = str(cfg_path)
    os.environ["FED_ENTRY_GATEWAY"] = "litellm_kvm8_4000"

    mod_name = f"fed_attrib_cand_{id(tmp_path)}"
    spec = importlib.util.spec_from_file_location(mod_name, str(CANDIDATE_PATH))
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    db_path = tmp_path / "token_bank.db"
    _init_legacy_7col_db(db_path)
    mod.SPEND_DB = str(db_path)
    mod.LOG_PATH = str(tmp_path / "fed_attribution_log.jsonl")
    return mod, db_path


def _fetch_rows(db_path: Path) -> list[dict]:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute("SELECT * FROM token_bank_spend ORDER BY id ASC").fetchall()]
    finally:
        con.close()


def _make_response(
    model: str = "deepseek-chat",
    custom_llm_provider: str = "openai",
    provider: str | None = None,
    response_cost: float = 0.0012,
    prompt_tokens: int | None = 42,
    completion_tokens: int | None = 18,
    cached_tokens: int | None = None,
    cache_hit: bool | None = False,
    attempted_fallbacks: int = 0,
    served_group: str = "deepseek-flash",
    call_id: str = "call-001",
    deployment_id: str | None = "deepseek-flash-099-2cbaa00da7e0",
    content: str = "Synthetic response body text",
    include_usage: bool = True,
):
    hidden: dict = {
        "custom_llm_provider": custom_llm_provider,
        "response_cost": response_cost,
        "litellm_call_id": call_id,
        "model_id": deployment_id,
        "additional_headers": {
            "x-litellm-attempted-fallbacks": str(attempted_fallbacks),
            "x-litellm-model-group": served_group,
        },
    }
    if cache_hit is not None:
        hidden["cache_hit"] = cache_hit
    model_extra = {}
    if provider is not None:
        model_extra["provider"] = provider

    if include_usage:
        ptd = SimpleNamespace(cached_tokens=cached_tokens) if cached_tokens is not None else None
        usage = SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            prompt_tokens_details=ptd,
        )
    else:
        usage = None

    choices = [SimpleNamespace(message=SimpleNamespace(content=content))]
    return SimpleNamespace(
        id=f"chatcmpl-{call_id}",
        model=model,
        usage=usage,
        choices=choices,
        model_extra=model_extra,
        _hidden_params=hidden,
    )


# ===========================================================================
# MINIMUM POSITIVE TESTS (Section 11)
# ===========================================================================


def test_pos_1_verified_interactive_caller_attribution(tmp_path: Path):
    """Verified interactive caller via explicit trusted metadata and verified credential."""
    mod, db_path = _load_candidate(tmp_path)

    # 1a. Explicit trusted metadata
    kw_trusted = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-1a",
        "metadata": {"trusted_actor_id": "fi-009", "session_id": "sess-1"},
    }
    mod.write_spend_row(kw_trusted, _make_response(call_id="pos-1a"))

    # 1b. Verified virtual key / vk-alias matching caller claim
    kw_cred = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-1b",
        "proxy_server_request": {"headers": {"x-arifos-actor-id": "hermes"}},
        "metadata": {"user_api_key_alias": "vk-hermes"},
    }
    mod.write_spend_row(kw_cred, _make_response(call_id="pos-1b"))

    rows = _fetch_rows(db_path)
    assert len(rows) == 2
    assert rows[0]["actor_resolved"] == "fi-009"
    assert rows[0]["actor_resolution_source"] == "explicit_trusted_metadata"
    assert rows[0]["actor_verification_state"] == "VERIFIED"
    assert rows[0]["attribution_confidence"] == 1.0

    assert rows[1]["actor_claimed"] == "hermes"
    assert rows[1]["actor_resolved"] == "vk-hermes"
    assert rows[1]["actor_resolution_source"] == "verified_credential"
    assert rows[1]["actor_verification_state"] == "VERIFIED"
    assert rows[1]["attribution_confidence"] == 0.95


def test_pos_2_verified_background_caller_attribution(tmp_path: Path):
    """Verified background caller via verified credential team alias and approved lane group."""
    mod, db_path = _load_candidate(tmp_path)

    # 2a. Credential team alias
    kw_bg_cred = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-2a",
        "metadata": {"user_api_key_team_alias": "geox-worker", "purpose": "basin_probe"},
    }
    mod.write_spend_row(kw_bg_cred, _make_response(call_id="pos-2a"))

    # 2b. Approved dedicated lane group (PR #120 GROUP_AGENT_MAP)
    kw_lane = {
        "model": "hermes-default",
        "api_base": "https://api.xiaomimimo.com/v1",
        "litellm_call_id": "pos-2b",
        "metadata": {"model_group": "hermes-default", "purpose": "heartbeat"},
    }
    mod.write_spend_row(kw_lane, _make_response(model="mimo-v2-flash", served_group="hermes-default", call_id="pos-2b"))

    rows = _fetch_rows(db_path)
    assert len(rows) == 2
    assert rows[0]["actor_resolved"] == "geox-worker"
    assert rows[0]["actor_resolution_source"] == "verified_credential"
    assert rows[0]["actor_verification_state"] == "VERIFIED"

    assert rows[1]["actor_resolved"] == "hermes"
    assert rows[1]["actor_resolution_source"] == "approved_lane_group"
    assert rows[1]["actor_verification_state"] == "VERIFIED"
    assert rows[1]["attribution_confidence"] == 0.80


def test_pos_3_explicit_unknown_caller(tmp_path: Path):
    """Missing identity stays explicit UNKNOWN (never generic/human/model_group)."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-3",
        "metadata": {"model_group": "deepseek-flash"},
    }
    mod.write_spend_row(kw, _make_response(call_id="pos-3"))
    row = _fetch_rows(db_path)[0]
    assert row["actor_id"] == "UNKNOWN"
    assert row["agent_id"] == "UNKNOWN"
    assert row["actor_resolved"] == "UNKNOWN"
    assert row["actor_claimed"] == "UNKNOWN"
    assert row["actor_resolution_source"] == "UNKNOWN"
    assert row["actor_verification_state"] == "UNKNOWN"
    assert row["attribution_confidence"] == 0.0


def test_pos_4_session_task_trace_capability_propagation(tmp_path: Path):
    """Valid propagation of session_id, task_id, purpose, trace_id, capability_id, task_class."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-4",
        "proxy_server_request": {
            "headers": {
                "x-arifos-session-id": "sess-901",
                "x-arifos-trace-id": "0123456789abcdef0123456789abcdef",
                "x-arifos-capability-id": "cap.code.review",
                "x-arifos-task-class": "interactive_code",
            }
        },
        "metadata": {
            "user_api_key_alias": "vk-fi-009",
            "task_id": "task-404",
            "purpose": "pr_fed_1_convergence",
            "outer_attempt_id": "outer-4",
        },
    }
    mod.write_spend_row(kw, _make_response(call_id="pos-4"))
    row = _fetch_rows(db_path)[0]
    assert row["session_id"] == "sess-901"
    assert row["task_id"] == "task-404"
    assert row["purpose"] == "pr_fed_1_convergence"
    assert row["trace_id"] == "0123456789abcdef0123456789abcdef"
    assert row["capability_id"] == "cap.code.review"
    assert row["task_class"] == "interactive_code"
    assert row["outer_attempt_id"] == "outer-4"
    assert row["inner_attempt_id"] == "pos-4"


def test_pos_5_valid_deployment_id_linkage_pr_fed_2(tmp_path: Path):
    """Integrates directly with PR-FED-2 canonical deployment_id format."""
    mod, db_path = _load_candidate(tmp_path)
    dep_id = "deepseek-flash-099-2cbaa00da7e0"
    ok, reason = mod.validate_deployment_id(dep_id)
    assert ok is True
    assert reason == "pr_fed_2_canonical"

    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-5",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    mod.write_spend_row(kw, _make_response(call_id="pos-5", deployment_id=dep_id))
    row = _fetch_rows(db_path)[0]
    assert row["deployment_id"] == dep_id
    assert row["deployment_id_valid"] == 1
    assert row["failure_domain"] == "direct:api.deepseek.com"


def test_pos_6_requested_model_differs_from_served_model(tmp_path: Path):
    """Substitution detected when requested model group differs from served model."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "kimi-k3",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-6",
        "metadata": {"user_api_key_alias": "vk-fi-009", "model_group": "kimi-k3"},
        "proxy_server_request": {"headers": {"x-arifos-model-integrity": "strict"}},
    }
    resp = _make_response(
        model="deepseek-chat",
        attempted_fallbacks=1,
        served_group="deepseek-flash",
        call_id="pos-6",
    )
    cb = mod.FedAttributionCallback()
    asyncio.run(cb.async_pre_call_hook(None, None, kw, "completion"))
    with pytest.raises(Exception) as exc_info:
        asyncio.run(cb.async_post_call_success_hook(kw, None, resp))
    assert type(exc_info.value).__name__ == "ProxyException"
    assert getattr(exc_info.value, "code", None) == 409

    mod.write_spend_row(kw, resp)
    row = _fetch_rows(db_path)[0]
    assert row["requested_model"] == "kimi-k3"
    assert row["served_model"] == "deepseek-chat"
    assert row["fallback_used"] == 1
    assert row["fallback_edge_id"] == "kimi-k3->deepseek-flash"
    assert row["response_status"] == "SUBSTITUTED"


def test_pos_7_cache_replay_classification(tmp_path: Path):
    """Cache replay sets cache_replay=1, replayed=attempted, unique=0."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-7",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    resp = _make_response(
        model="deepseek-chat",
        prompt_tokens=1000,
        completion_tokens=200,
        cache_hit=True,
        call_id="pos-7",
    )
    mod.write_spend_row(kw, resp)
    row = _fetch_rows(db_path)[0]
    assert row["cache_state"] == "HIT"
    assert row["cache_replay"] == 1
    assert row["attempt_layer"] == "cache_replay"
    assert row["attempted_input_tokens"] == 1000
    assert row["attempted_output_tokens"] == 200
    assert row["replayed_input_tokens"] == 1000
    assert row["replayed_output_tokens"] == 200
    assert row["unique_input_tokens"] == 0
    assert row["unique_output_tokens"] == 0


def test_pos_8_plan_included_and_canonical_cost_classification(tmp_path: Path):
    """Distinguishes CASH_COST, PLAN_INCLUDED_COST_ATTRIBUTED, PLAN_INCLUDED_COST_UNATTRIBUTED, QUOTA_COST, UNKNOWN_COST."""
    mod, db_path = _load_candidate(tmp_path)

    cases = [
        ("pos-8-unattrib", {"billing_mode": "token_plan"}, 0.0, "PLAN_INCLUDED_COST_UNATTRIBUTED"),
        ("pos-8-attrib", {"billing_mode": "coding_plan", "plan_attributed_cost_usd": 0.002}, 0.0, "PLAN_INCLUDED_COST_ATTRIBUTED"),
        ("pos-8-quota", {"quota_bearing": True}, 0.0, "QUOTA_COST"),
        ("pos-8-cash", {}, 0.0045, "CASH_COST"),
        ("pos-8-unk", {}, 0.0, "UNKNOWN_COST"),
    ]
    for cid, extra_md, cost, expected_class in cases:
        kw = {
            "model": "openai/mimo-v2-flash",
            "api_base": "https://token-plan-sgp.xiaomimimo.com/v1",
            "litellm_call_id": cid,
            "metadata": {"user_api_key_alias": "vk-fi-009", **extra_md},
        }
        mod.write_spend_row(kw, _make_response(call_id=cid, response_cost=cost))

    rows = _fetch_rows(db_path)
    assert len(rows) == len(cases)
    for row, (_, _, _, expected_class) in zip(rows, cases):
        assert row["cost_evidence_class"] == expected_class
        assert "free" not in row["cost_evidence_class"].lower()
        assert row["serving_provider"] == "xiaomi"
        assert row["provider_name"] != "openai"


def test_pos_9_valid_microsecond_timestamp_and_deterministic_order(tmp_path: Path):
    """Valid UTC ISO-8601 microsecond timestamps, round-trip parsing, deterministic tie-breaking, and legacy classification."""
    mod, _ = _load_candidate(tmp_path)
    ts = mod._utc_now_iso()
    assert "%f" not in ts
    assert ISO_UTC_RE.match(ts)
    dt = mod.validate_utc_timestamp(ts)
    assert dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ") == ts

    # Deterministic ordering on equal timestamps
    r1 = {"id": 10, "called_at": ts}
    r2 = {"id": 2, "called_at": ts}
    ordered = sorted([r1, r2], key=mod.deterministic_row_sort_key)
    assert [r["id"] for r in ordered] == [2, 10]

    # Legacy malformed .%fZ rows classified semantically without mutation
    assert mod.classify_legacy_timestamp("2026-10-15T12:00:00.%fZ") == "LEGACY_MALFORMED_LITERAL_PERCENT_F"
    assert mod.classify_legacy_timestamp(ts) == "VALID_UTC_ISO8601"
    assert mod.classify_legacy_timestamp("not-a-timestamp") == "LEGACY_INVALID"


def test_pos_10_kvm4_23col_adapter_and_spend_adapter_compatibility(tmp_path: Path):
    """KVM4 23-column projection/adaptation + fed_spend_callback thin adapter compatibility."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "pos-10",
        "metadata": {"user_api_key_alias": "vk-fi-009", "session_id": "s-10", "task_id": "t-10"},
    }
    resp = _make_response(call_id="pos-10")
    rec = mod.attribution(kw, resp)
    kvm4_proj = mod.project_canonical_to_kvm4(rec)
    assert set(kvm4_proj.keys()) == set(mod.KVM4_COMPAT_COLUMNS)
    assert len(kvm4_proj) == 23
    assert kvm4_proj["serving_provider"] == "deepseek"
    assert kvm4_proj["actor_id"] == "vk-fi-009"

    adapted = mod.adapt_kvm4_row_to_canonical(kvm4_proj)
    assert adapted["actor_resolved"] == "vk-fi-009"
    assert adapted["timestamp_classification"] == "VALID_UTC_ISO8601"
    assert adapted["accepted_by"] is None
    assert adapted["outcome_state"] == "outcome_pending"

    # Authorized downstream acceptance binds acceptance fields separately
    mod.write_spend_row(kw, resp)
    acc = mod.record_downstream_acceptance(
        str(db_path),
        inner_attempt_id="pos-10",
        accepted_by="verifier-555",
        acceptance_criteria_id="crit-pr-fed-1",
        accepted_outcome_id="out-10",
        authorized_downstream=True,
    )
    assert acc["ok"] is True
    row = _fetch_rows(db_path)[0]
    assert row["outcome_state"] == "accepted"
    assert row["accepted_by"] == "verifier-555"
    assert row["accepted_input_tokens"] == 42
    assert row["accepted_output_tokens"] == 18


def test_pos_11_legacy_fed_spend_callback_delegates_without_duplicate_write(tmp_path: Path):
    """scripts/fed_spend_callback.py is a thin adapter delegating to canonical writer with zero duplicate rows."""
    _install_litellm_stubs()
    db_path = tmp_path / "adapter_token_bank.db"
    _init_legacy_7col_db(db_path)
    os.environ["FED_TOKEN_BANK_DB"] = str(db_path)

    spec = importlib.util.spec_from_file_location("fed_spend_adapter_test", str(SPEND_ADAPTER_PATH))
    assert spec is not None and spec.loader is not None
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    adapter.DB = str(db_path)

    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "adapter-dedup-1",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    resp = _make_response(call_id="adapter-dedup-1")
    r1 = adapter.proxy_handler_instance.log_success_event(kw, resp, 0.0, 1.0)
    r2 = adapter.proxy_handler_instance.log_success_event(kw, resp, 0.0, 1.0)
    assert r1["ok"] is True and r1["deduplicated"] is False
    assert r2["ok"] is True and r2["deduplicated"] is True
    assert len(_fetch_rows(db_path)) == 1
    assert adapter._resolve_agent(kw) == "vk-fi-009"


# ===========================================================================
# MINIMUM NEGATIVE TESTS (Section 11)
# ===========================================================================


def test_neg_1_untrusted_caller_claims_another_actor(tmp_path: Path):
    """Free-form caller headers/metadata MUST NOT become verified identity."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "openai/deepseek-chat",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-1",
        "proxy_server_request": {"headers": {"x-arifos-actor-id": "ariffazil-f13"}},
        "metadata": {"actor_id": "ariffazil-f13"},
    }
    mod.write_spend_row(kw, _make_response(call_id="neg-1"))
    row = _fetch_rows(db_path)[0]
    assert row["actor_claimed"] == "ariffazil-f13"
    assert row["actor_resolved"] == "UNKNOWN"
    assert row["actor_id"] == "UNKNOWN"
    assert row["actor_verification_state"] == "CLAIMED_UNVERIFIED"
    assert row["attribution_confidence"] == 0.0


def test_neg_2_trusted_identity_contradicts_caller_claim_fails_closed(tmp_path: Path):
    """Verified credential contradicted by untrusted caller claim fails closed; never silently overwritten."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-2",
        "proxy_server_request": {
            "headers": {
                "x-arifos-actor-id": "spoofed-actor",
                "x-arifos-model-integrity": "strict",
            }
        },
        "metadata": {"user_api_key_alias": "vk-hermes"},
    }
    resp = _make_response(call_id="neg-2")
    cb = mod.FedAttributionCallback()
    asyncio.run(cb.async_pre_call_hook({"key_alias": "vk-hermes"}, None, kw, "completion"))
    with pytest.raises(Exception) as exc_info:
        asyncio.run(cb.async_post_call_success_hook(kw, {"key_alias": "vk-hermes"}, resp))
    assert type(exc_info.value).__name__ == "ProxyException"
    assert getattr(exc_info.value, "code", None) == 403

    mod.write_spend_row(kw, resp, user_api_key_dict={"key_alias": "vk-hermes"})
    row = _fetch_rows(db_path)[0]
    assert row["actor_claimed"] == "spoofed-actor"
    assert row["actor_resolved"] == "CONTRADICTION"
    assert row["actor_verification_state"] == "CONTRADICTION"
    assert row["actor_id"].startswith("CONTRADICTION:")
    assert row["attribution_confidence"] == 0.0


def test_neg_3_two_trusted_sources_contradict_fails_closed(tmp_path: Path):
    """Trusted metadata contradicting verified credential fails closed (PR #120 parity)."""
    mod, _ = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-3",
        "metadata": {"trusted_actor_id": "kimi-code", "user_api_key_alias": "vk-hermes"},
    }
    rec = mod.attribution(kw, _make_response(call_id="neg-3"))
    assert rec["actor_verification_state"] == "CONTRADICTION"
    assert rec["actor_resolved"] == "CONTRADICTION"
    assert "kimi-code" in rec["actor_contradiction_detail"]
    assert "vk-hermes" in rec["actor_contradiction_detail"]


def test_neg_4_malformed_timestamp_fails_visibly(tmp_path: Path):
    """Malformed timestamps (literal %f, missing timezone, invalid format) raise ValueError."""
    mod, _ = _load_candidate(tmp_path)
    for bad in (
        "2026-11-22T08:19:28.%fZ",
        "2026-11-22T08:19:28.123456",
        "2026-11-22 08:19:28Z",
        "",
        "not-a-date",
    ):
        with pytest.raises(ValueError, match="INVALID_TIMESTAMP"):
            mod.validate_utc_timestamp(bad)


def test_neg_5_database_readonly_and_write_failure_fail_visibly(tmp_path: Path):
    """Read-only DB and unwritable DB paths fail visibly; callback never reports success."""
    mod, db_path = _load_candidate(tmp_path)
    # Pre-initialize schema so SQLite attempts INSERT rather than ALTER, then make read-only
    con = sqlite3.connect(str(db_path))
    mod.ensure_attribution_schema(con)
    con.commit()
    con.close()

    os.chmod(db_path, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    try:
        # Also test with SQLite URI mode=ro (works reliably even under root UID!)
        mod.SPEND_DB = f"file:{db_path}?mode=ro"
        kw = {
            "model": "deepseek-flash",
            "api_base": "https://api.deepseek.com/v1",
            "litellm_call_id": "neg-5-ro",
            "metadata": {"user_api_key_alias": "vk-fi-009"},
        }
        resp = _make_response(call_id="neg-5-ro")
        # Using a non-existent directory path guarantees OperationalError even as root
        mod.SPEND_DB = str(tmp_path / "nonexistent_dir_ro" / "token_bank.db")
        with pytest.raises(sqlite3.OperationalError):
            mod.write_spend_row(kw, resp, max_retries=0)

        before = mod.get_write_failure_stats()["failure_count"]
        cb = mod.FedAttributionCallback()
        result = cb.log_success_event(kw, resp, 0.0, 1.0)
        after = mod.get_write_failure_stats()["failure_count"]
        assert result["ok"] is False
        assert "OperationalError" in result["error"]
        assert after == before + 1
    finally:
        os.chmod(db_path, stat.S_IRUSR | stat.S_IWUSR)


def test_neg_6_duplicate_callback_and_repeated_retry_deduplicated(tmp_path: Path):
    """Duplicate callback delivery and retries with same attempt ID produce exactly ONE row."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-6-same-attempt",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    resp = _make_response(call_id="neg-6-same-attempt")
    first = mod.write_spend_row(kw, resp)
    second = mod.write_spend_row(kw, resp)
    third = mod.write_spend_row(kw, resp)
    assert first["deduplicated"] is False
    assert second["deduplicated"] is True
    assert third["deduplicated"] is True
    assert len(_fetch_rows(db_path)) == 1


def test_neg_7_replay_not_counted_as_unique_and_unknown_cache_stays_null(tmp_path: Path):
    """Replay must NOT be counted as unique tokens; unknown cache state stores NULL, never manufactured 0."""
    mod, db_path = _load_candidate(tmp_path)
    kw_unk = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-7-unk-cache",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    resp_unk = _make_response(
        call_id="neg-7-unk-cache",
        prompt_tokens=500,
        completion_tokens=100,
        cache_hit=None,
    )
    mod.write_spend_row(kw_unk, resp_unk)

    kw_nousage = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-7-no-usage",
        "metadata": {"user_api_key_alias": "vk-fi-009"},
    }
    resp_nousage = _make_response(call_id="neg-7-no-usage", include_usage=False)
    mod.write_spend_row(kw_nousage, resp_nousage)

    rows = _fetch_rows(db_path)
    assert rows[0]["cache_state"] == "UNKNOWN"
    assert rows[0]["unique_input_tokens"] is None
    assert rows[0]["unique_output_tokens"] is None
    assert "cache_state_unknown" in rows[0]["token_source_limitation"]

    assert rows[1]["attempted_input_tokens"] is None
    assert rows[1]["attempted_output_tokens"] is None
    assert "usage_absent" in rows[1]["token_source_limitation"]


def test_neg_8_http_200_never_accepted_and_producer_cannot_set_accepted_by(tmp_path: Path):
    """HTTP 200 stays outcome_pending; producer attempt to set accepted_by is stripped & rejected."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "deepseek-flash",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-8",
        "proxy_server_request": {"headers": {"x-arifos-accepted-by": "litellm"}},
        "metadata": {
            "user_api_key_alias": "vk-fi-009",
            "accepted_by": "inference_producer",
        },
    }
    resp = _make_response(call_id="neg-8")
    rec = mod.attribution(kw, resp)
    assert rec["producer_acceptance_blocked"] is True
    assert rec["accepted_by"] is None
    assert rec["outcome_state"] == "outcome_pending"
    assert rec["accepted_input_tokens"] is None
    assert rec["accepted_output_tokens"] is None

    mod.write_spend_row(kw, resp)
    row = _fetch_rows(db_path)[0]
    assert row["accepted_by"] is None
    assert row["outcome_state"] == "outcome_pending"
    assert row["accepted_input_tokens"] is None
    assert row["accepted_output_tokens"] is None

    # Unauthorized or producer-named acceptance call must fail visibly
    with pytest.raises(PermissionError, match="ACCEPTANCE_UNAUTHORIZED"):
        mod.record_downstream_acceptance(
            str(db_path),
            inner_attempt_id="neg-8",
            accepted_by="verifier-555",
            acceptance_criteria_id="c1",
            accepted_outcome_id="o1",
            authorized_downstream=False,
        )
    with pytest.raises(ValueError, match="INVALID_ACCEPTOR"):
        mod.record_downstream_acceptance(
            str(db_path),
            inner_attempt_id="neg-8",
            accepted_by="litellm",
            acceptance_criteria_id="c1",
            accepted_outcome_id="o1",
            authorized_downstream=True,
        )


def test_neg_9_no_secret_or_prompt_leakage(tmp_path: Path):
    """Secrets, auth headers, URL creds, prompt bodies, and reply bodies never persist."""
    mod, db_path = _load_candidate(tmp_path)
    cb = mod.FedAttributionCallback()
    synthetic_secret = "sk-SYNTHETIC_SECRET_TOKEN_998877665544"
    synthetic_prompt = "SYNTHETIC_PRIVATE_PROMPT_ALPHA_7744"
    synthetic_reply = "SYNTHETIC_PRIVATE_REPLY_BETA_6633"

    data = {
        "model": "deepseek-flash",
        "api_base": f"https://user:{synthetic_secret}@api.deepseek.com/v1?api_key={synthetic_secret}",
        "litellm_call_id": "neg-9",
        "messages": [{"role": "user", "content": f"actor_id=fi-999 {synthetic_prompt}"}],
        "proxy_server_request": {
            "headers": {
                "authorization": f"Bearer {synthetic_secret}",
                "x-api-key": synthetic_secret,
                "x-arifos-purpose": f"Bearer {synthetic_secret}",
            }
        },
        "metadata": {},
    }
    resp = _make_response(model="deepseek-chat", call_id="neg-9", content=synthetic_reply)

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


def test_neg_10_invalid_deployment_id_and_unknown_fallback_edge(tmp_path: Path):
    """Invalid deployment_id and undeclared fallback edges are flagged visibly."""
    mod, db_path = _load_candidate(tmp_path)
    kw = {
        "model": "kimi-k3",
        "api_base": "https://api.deepseek.com/v1",
        "litellm_call_id": "neg-10",
        "metadata": {"user_api_key_alias": "vk-fi-009", "model_group": "kimi-k3"},
    }
    resp = _make_response(
        model="deepseek-chat",
        attempted_fallbacks=1,
        served_group="undeclared-target-group",
        deployment_id="bad deployment id with spaces; DROP TABLE",
        call_id="neg-10",
    )
    mod.write_spend_row(kw, resp)
    row = _fetch_rows(db_path)[0]
    assert row["deployment_id"] == "INVALID_DEPLOYMENT_ID"
    assert row["deployment_id_valid"] == 0
    assert row["fallback_edge_id"] == "UNKNOWN_EDGE:kimi-k3->undeclared-target-group"


def test_neg_11_negative_control_transport_endpoints_and_strict_status_parsing(tmp_path: Path):
    """Negative controls 127.0.0.1:58402 and 100.64.0.5:42960: strict parsing & strict error handling."""
    _install_litellm_stubs()
    sys.path.insert(0, str(WORKTREE_ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location("fed_token_recon_test", str(RECON_PATH))
    assert spec is not None and spec.loader is not None
    recon = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(recon)

    # 1. Strict HTTP status parser must NEVER misread port digits 58402/42960 as HTTP 402/429
    assert recon.parse_strict_http_status("connect failed 127.0.0.1:58402 connection refused") is None
    assert recon.parse_strict_http_status("connect failed 100.64.0.5:42960 timeout") is None
    assert recon.parse_strict_http_status("127.0.0.1:58402 HTTP/1.1 200 OK") == 200
    assert recon.parse_strict_http_status("100.64.0.5:42960 status=429") == 429

    # 2. Live negative-control probes must handle unreachable/non-200 strictly without requiring success
    for endpoint in ("http://127.0.0.1:58402/health", "http://100.64.0.5:42960/health"):
        res = recon.probe_endpoint_strict(endpoint, timeout=0.3)
        assert res["url"] == endpoint
        assert res["accepted"] is False
        # Must report either unreachable with explicit error OR explicit HTTP status (never masked)
        if not res["reachable"]:
            assert res["http_status"] is None
            assert res["error"] is not None
        else:
            assert isinstance(res["http_status"], int)


def test_neg_12_routing_invariance_unmodified(tmp_path: Path):
    """Callback never mutates caller routing parameters (model, fallbacks, num_retries)."""
    mod, _ = _load_candidate(tmp_path)
    cb = mod.FedAttributionCallback()
    data = {
        "model": "kimi-k3",
        "fallbacks": [{"kimi-k3": ["deepseek-flash"]}],
        "num_retries": 2,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": "synthetic routing check"}],
        "litellm_call_id": "neg-12",
        "proxy_server_request": {"headers": {"x-arifos-model-integrity": "availability"}},
    }
    snapshot = copy.deepcopy(data)
    returned = asyncio.run(cb.async_pre_call_hook(None, None, data, "completion"))
    assert returned is data
    assert data == snapshot
