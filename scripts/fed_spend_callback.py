#!/usr/bin/env python3
"""FED Spend Callback v2.3 — canonical attribution (P1→P1.5, executed 2026-10-14)

v1 defect (FI-008 2026-09-21): provider=custom_llm_provider -> "openai" for every
openai-compatible call (protocol label as provider identity); agent=unknown.
v2: HOST_MAP (api_base -> canonical provider) + GROUP_AGENT_MAP (model group ->
AAA lane) + protocol recorded separately + UNKNOWN preserved (never "openai").
v2.3 (FI-008, executes P1.5-B resolution order): actor identity read from
litellm_params.metadata (billing_agent_id/agent_id/actor_agent_id) and vk-*
virtual-key aliases BEFORE lane-group inference; key_actor != declared_actor ->
CONTRADICTION (fail-closed). Wire shape evidenced by
/root/.local/share/arifos/callback_shape_debug.json (2026-10-14T03:52+08).
Maps/resolvers are importable without litellm for host-side regression tests.
"""
import os
import sqlite3
import datetime

try:
    from litellm.integrations.custom_logger import CustomLogger
except ImportError:  # host-side test mode
    CustomLogger = object

DB = "/app/data/token_bank.db"

HOST_MAP = {
    "api.deepseek.com": "deepseek",
    "api.minimax.io": "minimax",
    "api.z.ai": "zai-coding-plan",
    "token-plan.maas.qwencloudapi.com": "qwen-token-plan-team",
    "token-plan.ap-southeast-1.maas.aliyuncs.com": "qwen-token-plan-legacy-aliyuncs",
    "token-plan-sgp.xiaomimimo.com": "mimo-token-plan",
    "api.xiaomimimo.com": "mimo-platform",
    "opencode.ai": "opencode-go",
    "dashscope-intl.aliyuncs.com": "dashscope-payg",
    "api.sea-lion.ai": "sea-lion",
    "api.mistral.ai": "mistral",
    "api.kimi.com": "kimi-moonshot",
    "generativelanguage.googleapis.com": "gemini",
    "api.openai.com": "openai",
}

GROUP_AGENT_MAP = {
    "hermes-default": "hermes", "hermes-asi": "hermes-asi", "hermes-asi-vision": "hermes-asi",
    "agi-333": "agi-333", "asi-555": "asi-555", "apex-888": "apex-888",
    "forge-777": "forge-777", "forge-builder": "forge-builder", "forge-planner": "forge-planner",
    "forge-judge": "forge-judge", "forge-economy": "forge-economy",
    "forge-scout": "forge-scout", "forge-scout-pro": "forge-scout-pro",
    "opencode": "opencode", "openclaw": "openclaw", "i-arif": "i-arif",
    "fed/vision": "fed-vision", "fed/image-gen": "fed-image-gen",
    "fed/audio-voiceclone": "fed-audio-voiceclone", "fed/sealion": "fed-sealion",
}


def _resolve_provider(kwargs, hidden):
    md = kwargs.get("litellm_params") or {}
    api_base = (
        md.get("api_base") or kwargs.get("api_base") or hidden.get("api_base") or ""
    )
    api_base_l = str(api_base).lower()
    for frag, canon in HOST_MAP.items():
        if frag in api_base_l:
            return canon, str(api_base)
    dp = hidden.get("model_info") or {}
    lp = dp.get("litellm_provider")
    if lp and lp not in ("openai",):
        return f"declared:{lp}", str(api_base)
    return "UNKNOWN", str(api_base)


def _resolve_agent(kwargs):
    """v2.3 — P1.5-B resolution order (wire shape: callback_shape_debug.json 2026-10-14T03:52+08).
    1) explicit actor metadata (billing_agent_id > agent_id > actor_agent_id)
    2) authenticated virtual-key alias (vk-* convention; shared master key ignored)
    3) governed lane group via GROUP_AGENT_MAP (lane-derived role identity)
    4) 'unknown' — fail-closed, never guessed.
    Conflict: key_actor != declared_actor -> CONTRADICTION (attribution rejected,
    no silent preference — P1.5-B conflict_policy).
    Invariant: model alias never determines actor; WHAT is never promoted to WHO."""
    lp = kwargs.get("litellm_params") or {}
    md = lp.get("metadata") or {}
    declared = None
    for f in ("billing_agent_id", "agent_id", "actor_agent_id"):
        v = md.get(f)
        v = str(v).strip() if v is not None else ""
        if v and v.lower() not in ("none", "null", "unknown"):
            declared = v
            break
    key_alias = md.get("user_api_key_alias")
    key_alias = str(key_alias).strip() if key_alias is not None else ""
    vk = key_alias if key_alias.startswith("vk-") else None
    if declared and vk and declared != vk and not vk.startswith("vk-" + declared):
        return "CONTRADICTION:%s!=%s" % (declared[:32], vk[:32])
    if declared:
        return declared
    if vk:
        return vk
    mam = lp.get("model_alias_map") or {}
    candidates = [
        md.get("model_group"),
        kwargs.get("model_group"),
        lp.get("model"),
        kwargs.get("model"),
    ] + [str(k) for k in mam.keys()]
    for grp, agent in GROUP_AGENT_MAP.items():
        for c in candidates:
            c = str(c or "")
            if c == grp or c.startswith(grp + "@"):
                return agent
    return "unknown"


class FedSpendCallback(CustomLogger):
    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            model = kwargs.get("model", "unknown") or "unknown"
            hidden = getattr(response_obj, "_hidden_params", {}) or {}
            provider, api_base = _resolve_provider(kwargs, hidden)
            agent_id = _resolve_agent(kwargs)
            protocol = "openai-compat"  # wire protocol, recorded separately from provider

            usage = getattr(response_obj, "usage", None)
            tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0) if usage else 0
            tokens_out = int(getattr(usage, "completion_tokens", 0) or 0) if usage else 0
            cost = float(hidden.get("response_cost", 0.0) or 0.0)
            called_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

            con = sqlite3.connect(DB, timeout=2.0)
            cols = {r[1] for r in con.execute("PRAGMA table_info(token_bank_spend)")}
            for add in ("protocol", "api_base", "attribution_confidence"):
                if add not in cols:
                    con.execute(f"ALTER TABLE token_bank_spend ADD COLUMN {add} TEXT")
            conf = "1.0" if provider != "UNKNOWN" else "0.0"
            con.execute(
                "INSERT INTO token_bank_spend "
                "(provider_name, model_id, agent_id, tokens_in, tokens_out, "
                " estimated_cost_usd, called_at, protocol, api_base, attribution_confidence) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (provider, model, agent_id, tokens_in, tokens_out, cost, called_at,
                 protocol, api_base, conf),
            )
            con.commit()
            con.close()
        except Exception as e:
            try:  # [WITNESS v2.2] surface silent callback failures (bounded) — never block lane
                with open("/app/data/callback_err.log", "a") as fh:
                    fh.write(f"{type(e).__name__}: {str(e)[:200]}\n")
            except Exception:
                pass

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        return self.log_success_event(kwargs, response_obj, start_time, end_time)


proxy_handler_instance = FedSpendCallback()
