#!/usr/bin/env python3
"""FED Attribution Contract — PR-FED-1 Attribution and Lineage.

Enforces MODEL-ID invariants at the response surface and writes clean,
schema-migrated, lineage-complete spend rows to ``token_bank_spend``.

Key invariants:
  * Deterministic caller identity precedence:
      explicit governed request metadata -> authenticated key/team mapping ->
      request tags -> known caller-service identity -> explicit UNKNOWN.
    Never infers actor from prompt text. Never stores secrets, prompt bodies,
    or response bodies.
  * Strict provider taxonomy:
      transport_protocol, entry_gateway, routing_intermediary,
      serving_provider, serving_provider_source, serving_provider_confidence,
      api_base_host_redacted, upstream_model_id.
    Never overwrites serving_provider with LiteLLM's transport ("openai").
  * Explicit cost_evidence_class:
      PROVIDER_REPORTED | LITELLM_CALCULATED | PLAN_INCLUDED_COST_UNATTRIBUTED |
      ESTIMATED | UNKNOWN (never calls plan-covered usage "free").
  * Valid UTC ISO-8601 timestamps via datetime.now(timezone.utc) (zero literal %f).
  * Non-invasive: never mutates routing parameters (model, fallbacks, retries).
  * Never crashes the proxy: internal errors degrade safely to UNKNOWN (strict
    mode fails closed).
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import re
import sqlite3
import sys
from urllib.parse import urlsplit

import yaml
from litellm.integrations.custom_logger import CustomLogger

CONFIG_PATH = os.environ.get("FED_CONFIG_PATH", "/app/config.yaml")
LOG_PATH = os.environ.get(
    "FED_ATTRIBUTION_LOG_PATH", "/app/data/fed_attribution_log.jsonl"
)
SPEND_DB = os.environ.get("FED_TOKEN_BANK_DB", "/app/data/token_bank.db")
SPEND_PROTOCOL = "gateway-ledger"

STRICT_VALUES = {"strict", "1", "true", "require", "fail-closed", "fail_closed"}
STRICT_HEADER = "x-arifos-model-integrity"

_CALL_MODES: dict[str, str] = {}
_CALL_RECS: dict[str, dict] = {}
_CALL_CTX: dict[str, dict] = {}
_CALL_MODES_MAX = 2048

_SERVED_GROUP_HEADER = "x-litellm-model-group"
_FALLBACK_COUNT_HEADER = "x-litellm-attempted-fallbacks"

_FAILS = [0]

# --- Canonical enums & taxonomies -------------------------------------------

VALID_TRANSPORT_PROTOCOLS = frozenset(
    {"openai_compatible", "anthropic", "responses", "other"}
)
# Node registry (deploy/fed/nodes.json) is the SOT for gateway ids. Pattern
# acceptance lets any enrolled or future node stamp its own door instead of
# collapsing to "other" (PR-FED-1 review finding 1, 2026-11-22).
VALID_ENTRY_GATEWAYS = frozenset(
    {"litellm_kvm8_4000", "litellm_kvm4_4000", "litellm_kvm2_4000", "other"}
)
_ENTRY_GATEWAY_RE = re.compile(r"^litellm_[a-z0-9][a-z0-9-]{0,31}_\d{1,5}$")
VALID_ROUTING_INTERMEDIARIES = frozenset(
    {"direct", "openrouter", "huggingface", "unknown"}
)
VALID_SERVING_PROVIDERS = frozenset(
    {
        "xiaomi",
        "deepseek",
        "aisingapore",
        "zai",
        "minimax",
        "qwen",
        "kimi",
        "nous",
        "mistral",
        "groq",
        "google",
        "cloudflare",
        "local_ollama",
        "other",
        "UNKNOWN",
    }
)
VALID_COST_EVIDENCE_CLASSES = frozenset(
    {
        "PROVIDER_REPORTED",
        "LITELLM_CALCULATED",
        "PLAN_INCLUDED_COST_UNATTRIBUTED",
        "ESTIMATED",
        "UNKNOWN",
    }
)
VALID_CACHE_STATES = frozenset({"HIT", "MISS", "BYPASS", "UNKNOWN"})

# Verified direct API host -> canonical serving_provider.
# Used ONLY when routing_intermediary == "direct".
VERIFIED_DIRECT_HOST_MAP: dict[str, str] = {
    "api.deepseek.com": "deepseek",
    "api.xiaomimimo.com": "xiaomi",
    "api.mimo.xiaomi.com": "xiaomi",
    "api.sea-lion.ai": "aisingapore",
    "cf-api.sea-lion.ai": "aisingapore",
    "api.z.ai": "zai",
    "open.bigmodel.cn": "zai",
    "api.minimax.io": "minimax",
    "api.minimaxi.chat": "minimax",
    "api.minimax.chat": "minimax",
    "dashscope.aliyuncs.com": "qwen",
    "dashscope-intl.aliyuncs.com": "qwen",
    "api.moonshot.ai": "kimi",
    "api.moonshot.cn": "kimi",
    "inference-api.nousresearch.com": "nous",
    "api.nousresearch.com": "nous",
    "api.mistral.ai": "mistral",
    "api.groq.com": "groq",
    "generativelanguage.googleapis.com": "google",
    "aiplatform.googleapis.com": "google",
    "api.cloudflare.com": "cloudflare",
    "gateway.ai.cloudflare.com": "cloudflare",
    "localhost": "local_ollama",
    "127.0.0.1": "local_ollama",
    "ollama": "local_ollama",
    "host.docker.internal": "local_ollama",
}

# Canonical aliases for request-bound response provider strings.
_PROVIDER_NAME_ALIASES: dict[str, str] = {
    "xiaomi": "xiaomi",
    "mimo": "xiaomi",
    "xiaomimimo": "xiaomi",
    "deepseek": "deepseek",
    "aisingapore": "aisingapore",
    "ai singapore": "aisingapore",
    "sea-lion": "aisingapore",
    "sealion": "aisingapore",
    "zai": "zai",
    "z.ai": "zai",
    "zhipu": "zai",
    "zhipuai": "zai",
    "bigmodel": "zai",
    "minimax": "minimax",
    "qwen": "qwen",
    "alibaba": "qwen",
    "alibabacloud": "qwen",
    "dashscope": "qwen",
    "kimi": "kimi",
    "moonshot": "kimi",
    "moonshotai": "kimi",
    "nous": "nous",
    "nousresearch": "nous",
    "mistral": "mistral",
    "mistralai": "mistral",
    "groq": "groq",
    "google": "google",
    "google ai studio": "google",
    "google vertex": "google",
    "vertex": "google",
    "gemini": "google",
    "cloudflare": "cloudflare",
    "ollama": "local_ollama",
    "local_ollama": "local_ollama",
}

_KNOWN_SERVICE_UA_PREFIXES: dict[str, str] = {
    "hermes": "hermes",
    "a-forge": "a-forge",
    "aforge": "a-forge",
    "arif-flow": "arif-flow",
    "arifflow": "arif-flow",
    "arifos": "arifos",
    "geox": "geox",
    "wealth": "wealth",
    "well": "well",
    "chron": "chron",
    "frame": "frame",
    "openclaw": "openclaw",
    "opencode": "opencode",
    "claude-code": "claude-code",
    "qwen-code": "qwen-code",
    "codex": "codex",
    "kimi-code": "kimi-code",
    "agy": "agy",
    "fed-watchdog": "fed-watchdog",
    "fed-sentinel": "fed-sentinel",
}

_GENERIC_UNKNOWN_TOKENS = frozenset(
    {"", "unknown", "none", "null", "n/a", "anonymous", "default"}
)

# Pattern guard so secret-looking strings are never persisted in metadata fields.
_SECRET_LIKE_RE = re.compile(
    r"(?i)(?:bearer\s+\S+|api[_-]?key\s*=|token\s*=|password\s*=|secret\s*=|-----begin\s+)"
)

# --- Schema migration (idempotent, non-destructive) -------------------------

_LEGACY_COLUMNS: list[tuple[str, str]] = [
    ("provider_name", "TEXT"),
    ("model_id", "TEXT"),
    ("agent_id", "TEXT"),
    ("tokens_in", "INTEGER"),
    ("tokens_out", "INTEGER"),
    ("estimated_cost_usd", "REAL"),
    ("called_at", "TEXT"),
    ("protocol", "TEXT"),
    ("api_base", "TEXT"),
    ("attribution_confidence", "REAL"),
    ("call_id", "TEXT"),
    ("serving_provider", "TEXT"),
    ("serving_provider_source", "TEXT"),
    ("attempted_fallbacks", "INTEGER"),
]

_PR_FED_1_COLUMNS: list[tuple[str, str]] = [
    ("actor_id", "TEXT"),
    ("actor_source", "TEXT"),
    ("session_id", "TEXT"),
    ("task_id", "TEXT"),
    ("turn_id", "TEXT"),
    ("purpose", "TEXT"),
    ("trace_id", "TEXT"),
    ("requested_model_group", "TEXT"),
    ("transport_protocol", "TEXT"),
    ("entry_gateway", "TEXT"),
    ("routing_intermediary", "TEXT"),
    ("serving_provider_confidence", "REAL"),
    ("api_base_host_redacted", "TEXT"),
    ("upstream_model_id", "TEXT"),
    ("cost_evidence_class", "TEXT"),
    ("cache_state", "TEXT"),
    ("deployment_id", "TEXT"),
    ("logical_request_id", "TEXT"),
    ("response_status", "TEXT"),
]

_ALL_SPEND_COLUMNS: list[tuple[str, str]] = _LEGACY_COLUMNS + _PR_FED_1_COLUMNS


def ensure_attribution_schema(con: sqlite3.Connection) -> list[str]:
    """Idempotently ensure token_bank_spend exists and has all PR-FED-1 columns.

    Safe on legacy 7-column or 14-column databases: only executes non-destructive
    ``ALTER TABLE ... ADD COLUMN`` statements for missing columns.
    Returns the list of column names added during this call.
    """
    col_defs = ", ".join(f"{name} {col_type}" for name, col_type in _ALL_SPEND_COLUMNS)
    con.execute(
        f"CREATE TABLE IF NOT EXISTS token_bank_spend ("
        f"id INTEGER PRIMARY KEY AUTOINCREMENT, {col_defs})"
    )
    existing = {
        row[1] for row in con.execute("PRAGMA table_info(token_bank_spend)").fetchall()
    }
    added: list[str] = []
    for col_name, col_type in _ALL_SPEND_COLUMNS:
        if col_name not in existing:
            con.execute(
                f"ALTER TABLE token_bank_spend ADD COLUMN {col_name} {col_type}"
            )
            added.append(col_name)
    return added


# --- Utilities --------------------------------------------------------------


def _warn(msg: str) -> None:
    """Bounded visibility: first 5 and every 50th. Never crash the proxy."""
    _FAILS[0] += 1
    if _FAILS[0] <= 5 or _FAILS[0] % 50 == 0:
        try:
            sys.stderr.write(f"[fed-attrib #{_FAILS[0]}] {msg}\n")
            sys.stderr.flush()
        except Exception:
            pass


def _utc_now_iso() -> str:
    """Valid UTC ISO-8601 timestamp with microsecond precision (zero literal %f)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _clean_meta_str(val, max_len: int = 128) -> str:
    """Sanitize a metadata scalar: strip whitespace/control chars, reject secrets."""
    if val is None or isinstance(val, (dict, list, tuple, set, bytes)):
        return ""
    s = str(val).replace("\r", " ").replace("\n", " ").strip()
    if not s:
        return ""
    if _SECRET_LIKE_RE.search(s):
        return ""
    return s[:max_len]


def _norm(model: str) -> str:
    """Normalize a model identifier for membership comparison."""
    if not model:
        return ""
    m = str(model).strip().lower()
    if "/" in m:
        m = m.rsplit("/", 1)[-1]
    return m.strip()


def _load_group_map(path: str = CONFIG_PATH) -> dict[str, set[str]]:
    """requested group -> set of normalized deployment models it declares."""
    out: dict[str, set[str]] = {}
    try:
        with open(path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        for entry in cfg.get("model_list") or []:
            if not isinstance(entry, dict):
                continue
            group = entry.get("model_name")
            params = entry.get("litellm_params") or {}
            model = params.get("model")
            if not group or not model:
                continue
            out.setdefault(group, set()).add(_norm(model))
    except Exception as e:
        _warn(f"could not build group map from {path}: {e}")
    return out


GROUP_MAP = _load_group_map()


def _hidden(response) -> dict:
    try:
        return getattr(response, "_hidden_params", {}) or {}
    except Exception:
        return {}


def _extra(response) -> dict:
    hp = _hidden(response)
    add = hp.get("additional_headers")
    return add if isinstance(add, dict) else {}


def _request_headers(data) -> dict[str, str]:
    """Recover inbound request headers (lowercased keys) from the proxy payload."""
    try:
        psr = (data or {}).get("proxy_server_request") or {}
        hdrs = psr.get("headers") or {}
        if isinstance(hdrs, dict):
            return {str(k).lower(): v for k, v in hdrs.items()}
    except Exception:
        pass
    return {}


def _merged_headers(data, request_headers=None, recalled_ctx=None) -> dict[str, str]:
    out: dict[str, str] = {}
    if isinstance(recalled_ctx, dict):
        for k, v in (recalled_ctx.get("headers") or {}).items():
            out[str(k).lower()] = v
    for k, v in _request_headers(data).items():
        out[str(k).lower()] = v
    if isinstance(request_headers, dict):
        for k, v in request_headers.items():
            out[str(k).lower()] = v
    return out


def _metadata_dicts(data, recalled_ctx=None) -> list[dict]:
    """Collect metadata dicts from supported LiteLLM surfaces (never messages/prompts)."""
    dicts: list[dict] = []
    if isinstance(data, dict):
        for candidate in (
            data.get("metadata"),
            (data.get("litellm_params") or {}).get("metadata")
            if isinstance(data.get("litellm_params"), dict)
            else None,
            data.get("litellm_metadata"),
            (data.get("extra_body") or {}).get("metadata")
            if isinstance(data.get("extra_body"), dict)
            else None,
        ):
            if isinstance(candidate, dict):
                dicts.append(candidate)
    if isinstance(recalled_ctx, dict):
        md = recalled_ctx.get("metadata")
        if isinstance(md, dict):
            dicts.append(md)
    return dicts


def _extract_tags(data, md_dicts: list[dict], headers: dict[str, str]) -> list[str]:
    """Extract request tags from metadata, top-level payload, or x-arifos-tags header."""
    raw_tags: list[str] = []
    if isinstance(data, dict) and isinstance(data.get("tags"), list):
        raw_tags.extend(str(t) for t in data["tags"] if t is not None)
    for md in md_dicts:
        tags = md.get("tags")
        if isinstance(tags, list):
            raw_tags.extend(str(t) for t in tags if t is not None)
        elif isinstance(tags, str) and tags.strip():
            raw_tags.extend(p.strip() for p in tags.split(",") if p.strip())
    hdr_tags = headers.get("x-arifos-tags") or headers.get("x-litellm-tags")
    if isinstance(hdr_tags, str) and hdr_tags.strip():
        raw_tags.extend(p.strip() for p in hdr_tags.split(",") if p.strip())
    return raw_tags


def _parse_kv_tags(tags: list[str]) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for raw in tags:
        s = _clean_meta_str(raw)
        if not s:
            continue
        for sep in (":", "="):
            if sep in s:
                k, v = s.split(sep, 1)
                k = k.strip().lower()
                v = _clean_meta_str(v)
                if k and v and k not in parsed:
                    parsed[k] = v
                break
    return parsed


def _first_meta(md_dicts: list[dict], keys: tuple[str, ...]) -> str:
    for md in md_dicts:
        for k in keys:
            val = _clean_meta_str(md.get(k))
            if val:
                return val
    return ""


def _first_header(headers: dict[str, str], keys: tuple[str, ...]) -> str:
    for k in keys:
        val = _clean_meta_str(headers.get(k))
        if val:
            return val
    return ""


def _auth_key_identity(
    data, md_dicts: list[dict], user_api_key_dict=None, recalled_ctx=None
) -> str:
    """Extract identity from authenticated virtual key / team mapping."""
    sources = []
    if user_api_key_dict is not None:
        sources.append(user_api_key_dict)
    if isinstance(recalled_ctx, dict) and recalled_ctx.get("auth_actor"):
        return _clean_meta_str(recalled_ctx["auth_actor"])

    for src in sources:
        for attr in ("key_alias", "user_id", "team_alias", "team_id", "end_user_id"):
            val = src.get(attr) if isinstance(src, dict) else getattr(src, attr, None)
            cleaned = _clean_meta_str(val)
            if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
                return cleaned

    auth_keys = (
        "user_api_key_alias",
        "user_api_key_user_id",
        "user_api_key_team_alias",
        "user_api_key_team_id",
        "user_api_key_end_user_id",
    )
    val = _first_meta(md_dicts, auth_keys)
    if val and val.lower() not in _GENERIC_UNKNOWN_TOKENS:
        return val
    if isinstance(data, dict):
        for k in auth_keys:
            cleaned = _clean_meta_str(data.get(k))
            if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
                return cleaned
    return ""


def _caller_service_identity(
    data, md_dicts: list[dict], headers: dict[str, str]
) -> str:
    """Extract known caller-service identity from headers, metadata, or user-agent."""
    from_hdr = _first_header(
        headers, ("x-caller-service", "x-service-name", "x-litellm-caller")
    )
    if from_hdr and from_hdr.lower() not in _GENERIC_UNKNOWN_TOKENS:
        return from_hdr

    from_md = _first_meta(md_dicts, ("caller_service", "service_name", "caller"))
    if from_md and from_md.lower() not in _GENERIC_UNKNOWN_TOKENS:
        return from_md

    if isinstance(data, dict):
        user_val = _clean_meta_str(data.get("user") or data.get("user_id"))
        if user_val and user_val.lower() not in _GENERIC_UNKNOWN_TOKENS:
            return user_val

    ua = _clean_meta_str(headers.get("user-agent")).lower()
    if ua:
        for prefix, canonical in _KNOWN_SERVICE_UA_PREFIXES.items():
            if ua.startswith(prefix) or f" {prefix}/" in ua or f"/{prefix}" in ua:
                return canonical
    return ""


def resolve_caller_identity(
    data,
    request_headers=None,
    user_api_key_dict=None,
    recalled_ctx=None,
) -> dict:
    """Deterministic caller identity resolution with typed source and confidence.

    Precedence:
      1. explicit governed request metadata (headers / metadata) -> 1.0
      2. authenticated key/team mapping                          -> 0.95
      3. request tags                                            -> 0.85
      4. known caller-service identity                           -> 0.75
      5. explicit UNKNOWN                                        -> 0.0

    Never inspects prompt/message/response content.
    """
    headers = _merged_headers(data, request_headers, recalled_ctx)
    md_dicts = _metadata_dicts(data, recalled_ctx)
    tags = _extract_tags(data, md_dicts, headers)
    kv_tags = _parse_kv_tags(tags)

    # 1. Explicit governed request metadata
    explicit_actor = _first_header(
        headers, ("x-arifos-actor-id", "x-arifos-actor", "x-fed-actor-id")
    ) or _first_meta(md_dicts, ("actor_id", "arifos_actor_id", "caller_actor_id"))

    if explicit_actor and explicit_actor.lower() not in _GENERIC_UNKNOWN_TOKENS:
        actor_id = explicit_actor
        actor_source = "explicit_metadata"
        attribution_confidence = 1.0
    else:
        # 2. Authenticated key/team mapping
        auth_actor = _auth_key_identity(data, md_dicts, user_api_key_dict, recalled_ctx)
        if auth_actor:
            actor_id = auth_actor
            actor_source = "auth_key_team"
            attribution_confidence = 0.95
        else:
            # 3. Request tags
            tag_actor = (
                kv_tags.get("actor_id")
                or kv_tags.get("actor")
                or kv_tags.get("agent")
                or kv_tags.get("caller")
                or ""
            )
            if tag_actor and tag_actor.lower() not in _GENERIC_UNKNOWN_TOKENS:
                actor_id = tag_actor
                actor_source = "request_tags"
                attribution_confidence = 0.85
            else:
                # 4. Known caller-service identity
                svc_actor = _caller_service_identity(data, md_dicts, headers)
                if svc_actor:
                    actor_id = svc_actor
                    actor_source = "caller_service"
                    attribution_confidence = 0.75
                else:
                    # 5. Explicit UNKNOWN (never silent lowercase "unknown")
                    actor_id = "UNKNOWN"
                    actor_source = "UNKNOWN"
                    attribution_confidence = 0.0

    session_id = (
        _first_header(headers, ("x-arifos-session-id", "x-session-id"))
        or _first_meta(md_dicts, ("session_id", "arifos_session_id"))
        or kv_tags.get("session_id")
        or kv_tags.get("session")
        or ""
    )
    task_id = (
        _first_header(headers, ("x-arifos-task-id", "x-task-id"))
        or _first_meta(md_dicts, ("task_id", "arifos_task_id"))
        or kv_tags.get("task_id")
        or kv_tags.get("task")
        or ""
    )
    turn_id = (
        _first_header(headers, ("x-arifos-turn-id", "x-turn-id"))
        or _first_meta(md_dicts, ("turn_id", "arifos_turn_id"))
        or kv_tags.get("turn_id")
        or kv_tags.get("turn")
        or ""
    )
    purpose = (
        _first_header(headers, ("x-arifos-purpose", "x-purpose"))
        or _first_meta(md_dicts, ("purpose", "arifos_purpose"))
        or kv_tags.get("purpose")
        or ""
    )
    trace_id = (
        _first_header(headers, ("x-arifos-trace-id", "x-trace-id"))
        or _first_meta(md_dicts, ("trace_id", "arifos_trace_id"))
        or kv_tags.get("trace_id")
        or kv_tags.get("trace")
        or ""
    )
    requested_model_group = (
        _first_header(headers, ("x-arifos-requested-model-group",))
        or _first_meta(md_dicts, ("requested_model_group", "model_group"))
        or kv_tags.get("model_group")
        or ""
    )
    logical_request_id = (
        _first_header(headers, ("x-arifos-logical-request-id", "x-request-id"))
        or _first_meta(md_dicts, ("logical_request_id", "request_id"))
        or kv_tags.get("logical_request_id")
        or ""
    )

    return {
        "actor_id": actor_id,
        "actor_source": actor_source,
        "attribution_confidence": attribution_confidence,
        "session_id": session_id,
        "task_id": task_id,
        "turn_id": turn_id,
        "purpose": purpose,
        "trace_id": trace_id,
        "requested_model_group": requested_model_group,
        "logical_request_id": logical_request_id,
    }


# --- Provider taxonomy & redaction -----------------------------------------


def redact_api_base_host(api_base: str | None) -> str:
    """Return hostname only (lowercased), stripping credentials, ports, paths, and query params."""
    if not api_base or not isinstance(api_base, str):
        return ""
    raw = api_base.strip()
    if not raw:
        return ""
    try:
        candidate = raw if "://" in raw else f"https://{raw}"
        parsed = urlsplit(candidate)
        host = (parsed.hostname or "").strip().lower()
        return host
    except Exception:
        return ""


def _extract_api_base(data, response=None) -> str:
    if isinstance(data, dict):
        direct = data.get("api_base")
        if isinstance(direct, str) and direct.strip():
            return direct.strip()
        lp = data.get("litellm_params")
        if isinstance(lp, dict):
            lp_base = lp.get("api_base")
            if isinstance(lp_base, str) and lp_base.strip():
                return lp_base.strip()
    hp = _hidden(response)
    hp_base = hp.get("api_base")
    if isinstance(hp_base, str) and hp_base.strip():
        return hp_base.strip()
    return ""


def _normalize_serving_provider(raw: str) -> str:
    s = _clean_meta_str(raw).lower()
    if not s or s in _GENERIC_UNKNOWN_TOKENS:
        return "UNKNOWN"
    if s in _PROVIDER_NAME_ALIASES:
        return _PROVIDER_NAME_ALIASES[s]
    # Try compact form without separators
    compact = re.sub(r"[^a-z0-9]", "", s)
    if compact in _PROVIDER_NAME_ALIASES:
        return _PROVIDER_NAME_ALIASES[compact]
    return "other"


def _extract_response_provider(response) -> tuple[str, str]:
    """Read request-bound serving provider from response fields/headers."""
    extra_hdrs = {str(k).lower(): v for k, v in _extra(response).items()}
    candidates = (
        ("model_extra", (getattr(response, "model_extra", None) or {}).get("provider")),
        ("attr", getattr(response, "provider", None)),
        ("hidden", _hidden(response).get("provider")),
        (
            "dict",
            (response.model_dump() or {}).get("provider")
            if hasattr(response, "model_dump")
            else None,
        ),
        (
            "header",
            extra_hdrs.get("x-openrouter-provider")
            or extra_hdrs.get("x-serving-provider"),
        ),
    )
    for slot, val in candidates:
        cleaned = _clean_meta_str(val)
        if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
            return cleaned, slot
    return "", "absent"


def _resolve_transport_protocol(data, response) -> str:
    call_type = ""
    if isinstance(data, dict):
        call_type = str(data.get("call_type") or "").strip().lower()
        psr = data.get("proxy_server_request") or {}
        url_path = str(psr.get("url") or "").strip().lower()
    else:
        url_path = ""

    if call_type in ("responses", "aresponses") or "/responses" in url_path:
        return "responses"

    custom_provider = (
        str(
            _hidden(response).get("custom_llm_provider")
            or (data.get("custom_llm_provider") if isinstance(data, dict) else "")
            or ""
        )
        .strip()
        .lower()
    )

    if custom_provider in ("anthropic", "bedrock_converse") or "/messages" in url_path:
        return "anthropic"

    model_str = str(data.get("model") if isinstance(data, dict) else "").strip().lower()
    if custom_provider in (
        "openai",
        "openrouter",
        "deepseek",
        "groq",
        "mistral",
        "together_ai",
        "fireworks_ai",
        "ollama",
        "ollama_chat",
        "huggingface",
        "dashscope",
        "zai",
        "minimax",
        "moonshot",
        "xai",
        "perplexity",
        "gemini",
        "vertex_ai",
        "cloudflare",
        "azure",
    ) or model_str.startswith(("openai/", "openrouter/", "huggingface/")):
        return "openai_compatible"

    return "other"


def _resolve_entry_gateway() -> str:
    val = os.environ.get("FED_ENTRY_GATEWAY", "litellm_kvm8_4000").strip()
    if val in VALID_ENTRY_GATEWAYS or _ENTRY_GATEWAY_RE.match(val):
        return val
    return "other"


def _resolve_routing_intermediary(host: str, data, response) -> str:
    custom_provider = (
        str(
            _hidden(response).get("custom_llm_provider")
            or (data.get("custom_llm_provider") if isinstance(data, dict) else "")
            or ""
        )
        .strip()
        .lower()
    )
    model_str = str(data.get("model") if isinstance(data, dict) else "").strip().lower()

    if (
        host == "openrouter.ai"
        or host.endswith(".openrouter.ai")
        or custom_provider == "openrouter"
        or model_str.startswith("openrouter/")
    ):
        return "openrouter"

    if (
        host == "huggingface.co"
        or host.endswith(".huggingface.co")
        or host == "hf.co"
        or host.endswith(".hf.co")
        or custom_provider == "huggingface"
        or model_str.startswith("huggingface/")
    ):
        return "huggingface"

    if host in VERIFIED_DIRECT_HOST_MAP:
        return "direct"

    return "unknown"


def resolve_provider_taxonomy(data, response) -> dict:
    """Resolve strict provider taxonomy without conflating transport with serving provider."""
    api_base_raw = _extract_api_base(data, response)
    host = redact_api_base_host(api_base_raw)
    transport_protocol = _resolve_transport_protocol(data, response)
    entry_gateway = _resolve_entry_gateway()
    routing_intermediary = _resolve_routing_intermediary(host, data, response)

    raw_resp_provider, resp_slot = _extract_response_provider(response)
    if raw_resp_provider:
        serving_provider = _normalize_serving_provider(raw_resp_provider)
        serving_provider_source = f"response_provider:{resp_slot}"
        serving_provider_confidence = 1.0
    elif routing_intermediary == "direct" and host in VERIFIED_DIRECT_HOST_MAP:
        serving_provider = VERIFIED_DIRECT_HOST_MAP[host]
        serving_provider_source = "direct_host_verified"
        serving_provider_confidence = 0.95
    else:
        serving_provider = "UNKNOWN"
        serving_provider_source = (
            "unverified_intermediary"
            if routing_intermediary in ("openrouter", "huggingface")
            else "absent"
        )
        serving_provider_confidence = 0.0

    upstream_model_id = _served_model(response)

    return {
        "transport_protocol": transport_protocol,
        "entry_gateway": entry_gateway,
        "routing_intermediary": routing_intermediary,
        "serving_provider": serving_provider,
        "serving_provider_source": serving_provider_source,
        "serving_provider_confidence": serving_provider_confidence,
        "api_base_host_redacted": host,
        "upstream_model_id": upstream_model_id,
    }


def _resolve_cost_evidence_class(data, response, cost: float) -> str:
    """Classify cost provenance honestly. Never call plan-covered usage 'free'."""
    hidden = _hidden(response)
    usage = getattr(response, "usage", None)
    model_extra = getattr(response, "model_extra", None) or {}
    md_dicts = _metadata_dicts(data)

    # 1. Explicit provider-reported cost
    usage_cost = getattr(usage, "cost", None) if usage is not None else None
    extra_usage = model_extra.get("usage") if isinstance(model_extra, dict) else None
    extra_cost = extra_usage.get("cost") if isinstance(extra_usage, dict) else None
    if (
        usage_cost is not None
        or extra_cost is not None
        or hidden.get("provider_cost") is not None
        or str(hidden.get("response_cost_source") or "").lower() == "provider"
    ):
        return "PROVIDER_REPORTED"

    # 2. Plan-covered / subscription usage (never "free")
    plan_markers = {
        "plan",
        "subscription",
        "coding_plan",
        "token_plan",
        "plan_included",
    }
    billing_mode = _first_meta(
        md_dicts, ("billing_mode", "cost_basis", "plan_type")
    ).lower()
    if billing_mode in plan_markers or any(
        bool(md.get("plan_covered")) for md in md_dicts
    ):
        return "PLAN_INCLUDED_COST_UNATTRIBUTED"

    # 3. Explicitly flagged estimate
    if hidden.get("cost_estimated") or any(
        bool(md.get("cost_estimated")) for md in md_dicts
    ):
        return "ESTIMATED"

    # 4. LiteLLM calculated positive cost
    if hidden.get("response_cost") is not None and cost > 0.0:
        return "LITELLM_CALCULATED"

    return "UNKNOWN"


def _resolve_cache_state(data, response) -> str:
    hidden = _hidden(response)
    extra = {str(k).lower(): v for k, v in _extra(response).items()}

    if isinstance(data, dict):
        cache_cfg = data.get("cache")
        if isinstance(cache_cfg, dict) and cache_cfg.get("no-cache"):
            return "BYPASS"

    cache_hdr = str(extra.get("x-litellm-cache-status") or "").strip().upper()
    if cache_hdr in VALID_CACHE_STATES:
        return cache_hdr

    if "cache_hit" in hidden:
        return "HIT" if bool(hidden.get("cache_hit")) else "MISS"

    return "UNKNOWN"


def _resolve_deployment_id(data, response) -> str:
    hidden = _hidden(response)
    if hidden.get("model_id"):
        return _clean_meta_str(hidden.get("model_id"))
    for md in _metadata_dicts(data):
        mi = md.get("model_info")
        if isinstance(mi, dict) and mi.get("id"):
            return _clean_meta_str(mi.get("id"))
        if md.get("deployment_id"):
            return _clean_meta_str(md.get("deployment_id"))
    if isinstance(data, dict):
        lp = data.get("litellm_params")
        if isinstance(lp, dict):
            mi = lp.get("model_info")
            if isinstance(mi, dict) and mi.get("id"):
                return _clean_meta_str(mi.get("id"))
    return ""


# --- Model-ID attribution core (preserved + extended) -----------------------


def _served_model(response) -> str:
    """The model that actually produced the tokens."""
    for candidate in (
        getattr(response, "model", None),
        _hidden(response).get("model_name"),
        _extra(response).get("x-litellm-model-name"),
    ):
        if candidate:
            return str(candidate)
    return ""


def _serving_provider(response) -> tuple[str, str]:
    """Legacy helper retained for backwards compatibility."""
    return _extract_response_provider(response)


def _requested_alias(data, response) -> str:
    """Data carries the requested group. Fall back to the served group header."""
    try:
        m = (data or {}).get("model")
        if m:
            return str(m)
    except Exception:
        pass
    return str(_extra(response).get(_SERVED_GROUP_HEADER) or "")


def _integrity_mode(request_headers) -> str:
    try:
        for k, v in (request_headers or {}).items():
            if str(k).lower() == STRICT_HEADER:
                return (
                    "strict"
                    if str(v).strip().lower() in STRICT_VALUES
                    else "availability"
                )
    except Exception:
        pass
    return "availability"


def _mode_key(data) -> str:
    """Stable per-request key across the pre-call and post-call hooks."""
    try:
        cid = (data or {}).get("litellm_call_id")
        if cid:
            return f"cid:{cid}"
    except Exception:
        pass
    return f"obj:{id(data)}"


def _remember_mode(data, mode: str) -> None:
    try:
        if len(_CALL_MODES) > _CALL_MODES_MAX:
            _CALL_MODES.clear()
        _CALL_MODES[_mode_key(data)] = mode
    except Exception:
        pass


def _recall_mode(data):
    try:
        return _CALL_MODES.get(_mode_key(data))
    except Exception:
        return None


def _forget_mode(data) -> None:
    try:
        _CALL_MODES.pop(_mode_key(data), None)
    except Exception:
        pass


def _remember_ctx(data, ctx: dict) -> None:
    try:
        if len(_CALL_CTX) > _CALL_MODES_MAX:
            _CALL_CTX.clear()
        _CALL_CTX[_mode_key(data)] = ctx
    except Exception:
        pass


def _recall_ctx(data):
    try:
        return _CALL_CTX.get(_mode_key(data))
    except Exception:
        return None


def _forget_ctx(data) -> None:
    try:
        _CALL_CTX.pop(_mode_key(data), None)
    except Exception:
        pass


def _remember_rec(data, rec: dict) -> None:
    try:
        if len(_CALL_RECS) > _CALL_MODES_MAX:
            _CALL_RECS.clear()
        _CALL_RECS[_mode_key(data)] = rec
    except Exception:
        pass


def _take_rec(data):
    try:
        return _CALL_RECS.pop(_mode_key(data), None)
    except Exception:
        return None


def _resolve_mode(data, request_headers=None, mode=None) -> str:
    """Who says what lane this request is in, in decreasing authority."""
    if mode:
        return mode
    from_headers = _integrity_mode(request_headers)
    if from_headers == "strict":
        return "strict"
    recalled = _recall_mode(data)
    if recalled:
        return recalled
    return from_headers


def _extract_call_id(data, response) -> str | None:
    _md = (
        (data.get("litellm_params") or {}).get("metadata")
        if isinstance(data, dict) and isinstance(data.get("litellm_params"), dict)
        else None
    )
    return (
        (_md.get("litellm_call_id") if isinstance(_md, dict) else None)
        or (data.get("litellm_call_id") if isinstance(data, dict) else None)
        or _hidden(response).get("litellm_call_id")
        or None
    )


def attribution(
    data,
    response,
    request_headers=None,
    mode=None,
    user_api_key_dict=None,
) -> dict:
    """Compute the full attribution record. Pure; no side effects."""
    recalled_ctx = _recall_ctx(data)
    requested = _requested_alias(data, response)
    served = _served_model(response)
    call_id = _extract_call_id(data, response)

    caller = resolve_caller_identity(
        data,
        request_headers=request_headers,
        user_api_key_dict=user_api_key_dict,
        recalled_ctx=recalled_ctx,
    )
    taxonomy = resolve_provider_taxonomy(data, response)

    served_norm = _norm(served)
    req_norm = _norm(requested)

    extra = _extra(response)
    try:
        attempted_fallbacks = int(extra.get(_FALLBACK_COUNT_HEADER) or 0)
    except (TypeError, ValueError):
        attempted_fallbacks = 0
    served_group = str(extra.get(_SERVED_GROUP_HEADER) or "")
    cache_state = _resolve_cache_state(data, response)
    cache_hit = cache_state == "HIT"

    requested_model_group = caller["requested_model_group"] or requested
    declared = GROUP_MAP.get(requested_model_group) or GROUP_MAP.get(requested)
    if declared is None and req_norm:
        for g, models in GROUP_MAP.items():
            if _norm(g) == req_norm:
                declared = models
                break

    reason = None
    if not served_norm:
        status = "UNKNOWN"
        substituted = None
        reason = "served_identity_unavailable"
    elif declared is None:
        substituted = bool(attempted_fallbacks)
        status = (
            "SUBSTITUTED"
            if substituted
            else ("CACHE_REPLAY" if cache_hit else "UNVERIFIED")
        )
        reason = (
            "requested_group_not_in_config" if not substituted else "fallback_counter"
        )
    elif served_norm in declared:
        substituted = False
        status = "CACHE_REPLAY" if cache_hit else "DIRECT"
        reason = "none"
    elif served_norm == req_norm:
        substituted = None
        status = "UNRESOLVED"
        reason = "group_name_echoed_as_served_model"
    else:
        substituted = True
        status = "SUBSTITUTED"
        if attempted_fallbacks:
            reason = "fallback_counter"
        elif cache_hit:
            reason = "cache_replay_of_fallback"
        else:
            reason = "served_model_not_in_requested_group"

    if substituted is not None and attempted_fallbacks and not reason:
        reason = "fallback_counter"

    hidden = _hidden(response)
    cost = float(hidden.get("response_cost", 0.0) or 0.0)
    cost_evidence_class = _resolve_cost_evidence_class(data, response, cost)
    deployment_id = _resolve_deployment_id(data, response)
    logical_request_id = caller["logical_request_id"] or (call_id or "")
    response_status = (
        "SUBSTITUTED"
        if substituted is True
        else ("UNKNOWN" if status == "UNKNOWN" else "OK")
    )

    return {
        "requested_alias": requested,
        "requested_model_group": requested_model_group,
        "served_model": served,
        "upstream_model_id": taxonomy["upstream_model_id"],
        "served_group": served_group,
        "substituted": substituted,
        "attempted_fallbacks": attempted_fallbacks,
        "fallback_reason": reason or "UNKNOWN",
        "cache_replay": cache_hit,
        "cache_state": cache_state,
        "attribution_status": status,
        "response_status": response_status,
        "transport_protocol": taxonomy["transport_protocol"],
        "entry_gateway": taxonomy["entry_gateway"],
        "routing_intermediary": taxonomy["routing_intermediary"],
        "serving_provider": taxonomy["serving_provider"],
        "serving_provider_source": taxonomy["serving_provider_source"],
        "serving_provider_confidence": taxonomy["serving_provider_confidence"],
        "api_base_host_redacted": taxonomy["api_base_host_redacted"],
        "actor_id": caller["actor_id"],
        "actor_source": caller["actor_source"],
        "attribution_confidence": caller["attribution_confidence"],
        "session_id": caller["session_id"],
        "task_id": caller["task_id"],
        "turn_id": caller["turn_id"],
        "purpose": caller["purpose"],
        "trace_id": caller["trace_id"],
        "deployment_id": deployment_id,
        "logical_request_id": logical_request_id,
        "cost_evidence_class": cost_evidence_class,
        "call_id": call_id,
        "integrity_mode": _resolve_mode(data, request_headers, mode),
        "timestamp_utc": _utc_now_iso(),
    }


def _headers_for(rec: dict) -> dict[str, str]:
    return {
        "x-arifos-requested-alias": str(rec["requested_alias"] or ""),
        "x-arifos-served-model": str(rec["served_model"] or ""),
        "x-arifos-model-substituted": "unknown"
        if rec["substituted"] is None
        else str(bool(rec["substituted"])).lower(),
        "x-arifos-fallback-reason": str(rec["fallback_reason"]),
        "x-arifos-attempted-fallbacks": str(rec["attempted_fallbacks"]),
        "x-arifos-attribution-status": str(rec["attribution_status"]),
        "x-arifos-serving-provider": str(rec.get("serving_provider") or "UNKNOWN"),
        "x-arifos-cache-replay": str(bool(rec["cache_replay"])).lower(),
        "x-arifos-model-integrity-mode": str(rec["integrity_mode"]),
        "x-arifos-actor-id": str(rec.get("actor_id") or "UNKNOWN"),
        "x-arifos-routing-intermediary": str(
            rec.get("routing_intermediary") or "unknown"
        ),
    }


def _log(rec: dict) -> None:
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, default=str) + "\n")
    except Exception:
        pass


# --- Spend attribution (single writer of token_bank_spend) ------------------


def _spend_lane(kwargs) -> str:
    """Lane alias (model_group) as the router stamped it; '' when absent."""
    if not isinstance(kwargs, dict):
        return ""
    for holder in (
        kwargs.get("metadata"),
        (kwargs.get("litellm_params") or {}).get("metadata")
        if isinstance(kwargs.get("litellm_params"), dict)
        else None,
        kwargs.get("litellm_metadata"),
        kwargs,
    ):
        if isinstance(holder, dict):
            mg = holder.get("model_group")
            if isinstance(mg, str) and mg.strip():
                return mg.strip()
    return ""


def _spend_hidden(response_obj) -> dict:
    return _hidden(response_obj)


def write_spend_row(kwargs, response_obj) -> dict:
    """Write ONE lineage-complete spend row. Never leaks secrets or prompts."""
    rec = attribution(kwargs, response_obj)
    model = (kwargs.get("model") if isinstance(kwargs, dict) else None) or "UNKNOWN"
    hidden = _spend_hidden(response_obj)
    usage = getattr(response_obj, "usage", None)
    tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0) if usage else 0
    tokens_out = int(getattr(usage, "completion_tokens", 0) or 0) if usage else 0
    cost = float(hidden.get("response_cost", 0.0) or 0.0)
    called_at = _utc_now_iso()

    # Legacy provider_name must NOT be overwritten with LiteLLM transport "openai";
    # use resolved serving_provider (explicit UNKNOWN when unresolved).
    provider_name = rec["serving_provider"]
    # Legacy api_base stores redacted hostname only so credentials/query params never persist.
    api_base_redacted = rec["api_base_host_redacted"]
    lane = _spend_lane(kwargs) or rec["requested_model_group"]

    con = sqlite3.connect(SPEND_DB, timeout=5.0)
    try:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA busy_timeout=5000")
        ensure_attribution_schema(con)
        con.execute(
            "INSERT INTO token_bank_spend ("
            "provider_name, model_id, agent_id, tokens_in, tokens_out, "
            "estimated_cost_usd, called_at, protocol, api_base, attribution_confidence, "
            "call_id, serving_provider, serving_provider_source, attempted_fallbacks, "
            "actor_id, actor_source, session_id, task_id, turn_id, purpose, trace_id, "
            "requested_model_group, transport_protocol, entry_gateway, routing_intermediary, "
            "serving_provider_confidence, api_base_host_redacted, upstream_model_id, "
            "cost_evidence_class, cache_state, deployment_id, logical_request_id, response_status"
            ") VALUES ("
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
            ")",
            (
                provider_name,
                model,
                rec["actor_id"],
                tokens_in,
                tokens_out,
                cost,
                called_at,
                SPEND_PROTOCOL,
                api_base_redacted,
                rec["attribution_confidence"],
                rec["call_id"],
                rec["serving_provider"],
                rec["serving_provider_source"],
                rec["attempted_fallbacks"],
                rec["actor_id"],
                rec["actor_source"],
                rec["session_id"],
                rec["task_id"],
                rec["turn_id"],
                rec["purpose"],
                rec["trace_id"],
                lane,
                rec["transport_protocol"],
                rec["entry_gateway"],
                rec["routing_intermediary"],
                rec["serving_provider_confidence"],
                api_base_redacted,
                rec["upstream_model_id"],
                rec["cost_evidence_class"],
                rec["cache_state"],
                rec["deployment_id"],
                rec["logical_request_id"],
                rec["response_status"],
            ),
        )
        con.commit()
    finally:
        con.close()

    return {
        "lane": lane,
        "actor_id": rec["actor_id"],
        "actor_source": rec["actor_source"],
        "model": model,
        "serving_provider": rec["serving_provider"],
        "cost_usd": cost,
        "cost_evidence_class": rec["cost_evidence_class"],
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "called_at": called_at,
    }


class FedAttributionCallback(CustomLogger):
    """Stamps model & caller lineage on every response; fails closed in strict mode."""

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        """Spend write with full attribution (single writer of token_bank_spend)."""
        try:
            write_spend_row(kwargs, response_obj)
        except Exception as e:  # noqa: BLE001 — accounting must never break the lane
            _warn(f"spend write failed: {e}")
        finally:
            _forget_ctx(kwargs)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        """Async mirror of log_success_event."""
        return self.log_success_event(kwargs, response_obj, start_time, end_time)

    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        """Capture integrity mode and non-secret caller context without mutating data."""
        try:
            hdrs = _request_headers(data)
            mode = _integrity_mode(hdrs)
            _remember_mode(data, mode)

            # Stash only safe, non-secret headers & auth identity for post-call hooks.
            safe_hdr_keys = (
                "x-arifos-actor-id",
                "x-arifos-actor",
                "x-fed-actor-id",
                "x-arifos-session-id",
                "x-session-id",
                "x-arifos-task-id",
                "x-task-id",
                "x-arifos-turn-id",
                "x-turn-id",
                "x-arifos-purpose",
                "x-purpose",
                "x-arifos-trace-id",
                "x-trace-id",
                "x-arifos-requested-model-group",
                "x-arifos-logical-request-id",
                "x-request-id",
                "x-arifos-tags",
                "x-litellm-tags",
                "x-caller-service",
                "x-service-name",
                "x-litellm-caller",
                "user-agent",
            )
            safe_hdrs = {k: hdrs[k] for k in safe_hdr_keys if k in hdrs}
            auth_actor = _auth_key_identity(
                data, _metadata_dicts(data), user_api_key_dict
            )
            _remember_ctx(data, {"headers": safe_hdrs, "auth_actor": auth_actor})
        except Exception as e:
            _warn(f"pre-call capture failed: {e}")
        return data

    async def async_post_call_success_hook(self, data, user_api_key_dict, response):
        """Strict lane: withhold substituted output before it reaches the client."""
        try:
            rec = attribution(data, response, user_api_key_dict=user_api_key_dict)
            _log(rec)
            _remember_rec(data, rec)
            if rec["integrity_mode"] != "strict":
                return response
            if rec["substituted"] is False:
                return response

            from litellm.proxy._types import ProxyException

            if rec["attribution_status"] in ("UNKNOWN", "UNRESOLVED"):
                raise ProxyException(
                    message=(
                        f"MODEL_IDENTITY_UNKNOWN: served model could not be established for "
                        f"requested alias '{rec['requested_alias']}' "
                        f"(reason={rec['fallback_reason']}); identity-strict lane refuses to release output."
                    ),
                    type="model_identity_unknown",
                    param=None,
                    code=502,
                )
            raise ProxyException(
                message=(
                    f"MODEL_SUBSTITUTED: requested '{rec['requested_alias']}' but served "
                    f"'{rec['served_model']}' (reason={rec['fallback_reason']}). "
                    f"Identity-strict lane refuses to release substituted output as the requested model."
                ),
                type="model_substituted",
                param=None,
                code=409,
            )
        except Exception as e:
            if type(e).__name__ == "ProxyException":
                raise
            _warn(f"strict-lane evaluation failed: {e}")
            return response

    async def async_post_call_response_headers_hook(
        self,
        data,
        user_api_key_dict,
        response,
        request_headers=None,
        litellm_call_info=None,
    ):
        """Availability lane: stamp lineage on headers. Never raises."""
        try:
            rec = _take_rec(data)
            if rec is None:
                rec = attribution(
                    data,
                    response,
                    request_headers=request_headers,
                    user_api_key_dict=user_api_key_dict,
                )
            _forget_mode(data)
            return _headers_for(rec)
        except Exception as e:
            _warn(f"header stamping failed: {e}")
            return {
                "x-arifos-attribution-status": "UNKNOWN",
                "x-arifos-model-substituted": "unknown",
            }


proxy_handler_instance = FedAttributionCallback()
