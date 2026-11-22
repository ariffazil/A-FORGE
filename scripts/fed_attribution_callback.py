"""FED Attribution Contract — PR-FED-1 Canonical Attribution & Lineage Writer.

Single canonical attribution contract and write path for ``token_bank_spend``,
converging:
  * PR #120 P1.5-B precedence, GROUP_AGENT_MAP, vk-* alias handling, and
    fail-closed CONTRADICTION semantics;
  * KVM4 multi-column lineage contract & non-silent error handling;
  * PR-FED-1 provider taxonomy, explicit token/cost/acceptance semantics,
    PR-FED-2 deployment_id linkage, and microsecond UTC ISO-8601 timestamps.

Key invariants:
  * Claim vs Resolution separation:
      - ``actor_claimed`` records caller-supplied claims (headers, untrusted
        metadata, tags, caller-service). Caller-controlled fields NEVER become
        verified identity merely because the caller supplied them.
      - ``actor_resolved`` is derived ONLY from trusted sources in precedence:
          1. explicit_trusted_metadata (confidence 1.0)
          2. verified_credential / vk-* alias (confidence 0.95)
          3. approved_lane_group via GROUP_AGENT_MAP (confidence 0.80)
          4. explicit UNKNOWN (confidence 0.0)
      - Verified lower-precedence sources are NEVER silently overwritten by
        unverified higher-precedence claims.
      - Contradictions fail closed with explicit ``CONTRADICTION`` state.
  * Explicit token semantics:
      attempted / replayed / unique / accepted input & output tokens.
      Missing/unmeasurable values stay SQL NULL (never manufactured 0).
      HTTP 200 NEVER populates accepted tokens or accepted_by.
  * Acceptance separation:
      Inference callbacks record ``outcome_state='outcome_pending'`` and MUST
      NOT populate ``accepted_by``. Only ``record_downstream_acceptance()``
      may bind acceptance fields.
  * Cost semantics:
      CASH_COST | PLAN_INCLUDED_COST_ATTRIBUTED |
      PLAN_INCLUDED_COST_UNATTRIBUTED | QUOTA_COST | UNKNOWN_COST.
      Never labels prepaid usage as "free".
  * Idempotent writes & visible failures:
      Duplicate callback deliveries / retries with the same attempt ID do not
      create duplicate spend rows. DB failures are never silently swallowed.
  * Privacy boundary:
      Never inspects prompt text for identity; never stores secrets, auth
      headers, URL credentials, prompt bodies, or response bodies.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import yaml

try:
    from litellm.integrations.custom_logger import CustomLogger
except ImportError:  # host-side offline test mode
    CustomLogger = object  # type: ignore[misc,assignment]

CONFIG_PATH = os.environ.get("FED_CONFIG_PATH", "/app/config.yaml")
LOG_PATH = os.environ.get("FED_ATTRIBUTION_LOG_PATH", "/app/data/fed_attribution_log.jsonl")
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
_LAST_WRITE_ERROR: list[str] = [""]

# --- Canonical enums & taxonomies -------------------------------------------

VALID_TRANSPORT_PROTOCOLS = frozenset({"openai_compatible", "anthropic", "responses", "other"})
VALID_ENTRY_GATEWAYS = frozenset({"litellm_kvm8_4000", "litellm_kvm4_4000", "other"})
_ENTRY_GATEWAY_RE = re.compile(r"^litellm_[a-z0-9][a-z0-9_-]{0,31}_[0-9]{2,5}$")
VALID_ROUTING_INTERMEDIARIES = frozenset({"direct", "openrouter", "huggingface", "unknown"})
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
        "opencode",
        "openai",
        "local_ollama",
        "other",
        "UNKNOWN",
    }
)
VALID_COST_CLASSES = frozenset(
    {
        "CASH_COST",
        "PLAN_INCLUDED_COST_ATTRIBUTED",
        "PLAN_INCLUDED_COST_UNATTRIBUTED",
        "QUOTA_COST",
        "UNKNOWN_COST",
    }
)
VALID_COST_PROVENANCES = frozenset(
    {
        "PROVIDER_REPORTED",
        "LITELLM_CALCULATED",
        "PLAN_DECLARED",
        "QUOTA_DECLARED",
        "ESTIMATED",
        "UNKNOWN",
    }
)
VALID_CACHE_STATES = frozenset({"HIT", "MISS", "BYPASS", "UNKNOWN"})
VALID_ATTEMPT_LAYERS = frozenset(
    {
        "outer_agent_attempt",
        "fed_route_attempt",
        "litellm_transport_attempt",
        "provider_internal_attempt",
        "cache_replay",
        "accepted_task_outcome",
    }
)
VALID_VERIFICATION_STATES = frozenset(
    {
        "VERIFIED",
        "CLAIMED_UNVERIFIED",
        "CONTRADICTION",
        "UNKNOWN",
    }
)

# PR-FED-2 deployment_id format: {model_name_sanitized}-{index:03d}-{sha256[:12]}
# Also accepts explicit legacy/test safe identifiers matching ^[a-z0-9][a-z0-9._-]{2,127}$
# while rejecting whitespace, control chars, secrets, and empty/placeholder values.
PR_FED_2_DEPLOYMENT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,90}-[0-9]{3}-[0-9a-f]{12}$")
SAFE_DEPLOYMENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$")
ISO_UTC_MICROSECOND_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$")

# Verified direct API host -> canonical serving_provider (includes PR #120 HOST_MAP).
# Used ONLY when routing_intermediary == "direct".
VERIFIED_DIRECT_HOST_MAP: dict[str, str] = {
    "api.deepseek.com": "deepseek",
    "api.xiaomimimo.com": "xiaomi",
    "api.mimo.xiaomi.com": "xiaomi",
    "token-plan-sgp.xiaomimimo.com": "xiaomi",
    "api.sea-lion.ai": "aisingapore",
    "cf-api.sea-lion.ai": "aisingapore",
    "api.z.ai": "zai",
    "open.bigmodel.cn": "zai",
    "api.minimax.io": "minimax",
    "api.minimaxi.chat": "minimax",
    "api.minimax.chat": "minimax",
    "dashscope.aliyuncs.com": "qwen",
    "dashscope-intl.aliyuncs.com": "qwen",
    "token-plan.maas.qwencloudapi.com": "qwen",
    "token-plan.ap-southeast-1.maas.aliyuncs.com": "qwen",
    "api.moonshot.ai": "kimi",
    "api.moonshot.cn": "kimi",
    "api.kimi.com": "kimi",
    "opencode.ai": "opencode",
    "inference-api.nousresearch.com": "nous",
    "api.nousresearch.com": "nous",
    "api.mistral.ai": "mistral",
    "api.groq.com": "groq",
    "generativelanguage.googleapis.com": "google",
    "aiplatform.googleapis.com": "google",
    "api.cloudflare.com": "cloudflare",
    "gateway.ai.cloudflare.com": "cloudflare",
    "api.openai.com": "openai",
    "localhost": "local_ollama",
    "127.0.0.1": "local_ollama",
    "ollama": "local_ollama",
    "host.docker.internal": "local_ollama",
}

# Approved deterministic lane-group -> actor mapping (preserved from PR #120).
# Only dedicated governed lane groups belong here — never shared generic model aliases.
GROUP_AGENT_MAP: dict[str, str] = {
    "hermes-default": "hermes",
    "hermes-asi": "hermes-asi",
    "hermes-asi-vision": "hermes-asi",
    "agi-333": "agi-333",
    "asi-555": "asi-555",
    "apex-888": "apex-888",
    "forge-777": "forge-777",
    "forge-builder": "forge-builder",
    "forge-planner": "forge-planner",
    "forge-judge": "forge-judge",
    "forge-economy": "forge-economy",
    "forge-scout": "forge-scout",
    "forge-scout-pro": "forge-scout-pro",
    "opencode": "opencode",
    "openclaw": "openclaw",
    "i-arif": "i-arif",
    "fed/vision": "fed-vision",
    "fed/image-gen": "fed-image-gen",
    "fed/audio-voiceclone": "fed-audio-voiceclone",
    "fed/sealion": "fed-sealion",
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
    "opencode": "opencode",
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
    "openai": "openai",
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

_GENERIC_UNKNOWN_TOKENS = frozenset({"", "unknown", "none", "null", "n/a", "anonymous", "default"})

# Pattern guard so secret-looking strings are never persisted in metadata fields.
_SECRET_LIKE_RE = re.compile(
    r"(?i)(?:bearer\s+\S+|api[_-]?key\s*=|token\s*=|password\s*=|secret\s*=|"
    r"sk-[a-z0-9_-]{16,}|ghp_[a-z0-9]{20,}|gho_[a-z0-9]{20,}|akia[0-9a-z]{16}|"
    r"-----begin\s+)"
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
    ("actor_claimed", "TEXT"),
    ("actor_resolved", "TEXT"),
    ("actor_resolution_source", "TEXT"),
    ("actor_verification_state", "TEXT"),
    ("actor_contradiction_detail", "TEXT"),
    ("credential_id", "TEXT"),
    ("session_id", "TEXT"),
    ("task_id", "TEXT"),
    ("turn_id", "TEXT"),
    ("purpose", "TEXT"),
    ("trace_id", "TEXT"),
    ("capability_id", "TEXT"),
    ("task_class", "TEXT"),
    ("origin_node", "TEXT"),
    ("client", "TEXT"),
    ("requested_model_group", "TEXT"),
    ("requested_model", "TEXT"),
    ("served_model", "TEXT"),
    ("transport_protocol", "TEXT"),
    ("entry_gateway", "TEXT"),
    ("routing_intermediary", "TEXT"),
    ("serving_provider_confidence", "REAL"),
    ("api_base_host_redacted", "TEXT"),
    ("upstream_model_id", "TEXT"),
    ("failure_domain", "TEXT"),
    ("cost_evidence_class", "TEXT"),
    ("cost_provenance", "TEXT"),
    ("cache_state", "TEXT"),
    ("cache_replay", "INTEGER"),
    ("fallback_used", "INTEGER"),
    ("fallback_edge_id", "TEXT"),
    ("deployment_id", "TEXT"),
    ("deployment_id_valid", "INTEGER"),
    ("logical_request_id", "TEXT"),
    ("outer_attempt_id", "TEXT"),
    ("inner_attempt_id", "TEXT"),
    ("attempt_layer", "TEXT"),
    ("attempted_input_tokens", "INTEGER"),
    ("attempted_output_tokens", "INTEGER"),
    ("replayed_input_tokens", "INTEGER"),
    ("replayed_output_tokens", "INTEGER"),
    ("unique_input_tokens", "INTEGER"),
    ("unique_output_tokens", "INTEGER"),
    ("accepted_input_tokens", "INTEGER"),
    ("accepted_output_tokens", "INTEGER"),
    ("token_source_limitation", "TEXT"),
    ("response_status", "TEXT"),
    ("finish_reason", "TEXT"),
    ("latency_ms", "REAL"),
    ("outcome_state", "TEXT"),
    ("candidate_result_id", "TEXT"),
    ("accepted_by", "TEXT"),
    ("acceptance_timestamp", "TEXT"),
    ("acceptance_criteria_id", "TEXT"),
    ("accepted_outcome_id", "TEXT"),
]

_ALL_SPEND_COLUMNS: list[tuple[str, str]] = _LEGACY_COLUMNS + _PR_FED_1_COLUMNS

# KVM4 23-column / 32-column compatibility projection keys
KVM4_COMPAT_COLUMNS: tuple[str, ...] = (
    "provider_name",
    "model_id",
    "agent_id",
    "tokens_in",
    "tokens_out",
    "estimated_cost_usd",
    "called_at",
    "protocol",
    "api_base",
    "attribution_confidence",
    "call_id",
    "serving_provider",
    "serving_provider_source",
    "attempted_fallbacks",
    "actor_id",
    "actor_source",
    "session_id",
    "task_id",
    "turn_id",
    "purpose",
    "trace_id",
    "logical_request_id",
    "requested_model_group",
)


def ensure_attribution_schema(con: sqlite3.Connection) -> list[str]:
    """Idempotently ensure token_bank_spend exists and has all PR-FED-1 columns.

    Safe on legacy 7-column, 14-column, KVM4 23/32-column, and KVM8 34-column
    databases: only executes non-destructive ``ALTER TABLE ... ADD COLUMN``
    statements for missing columns and idempotent indexes.
    """
    col_defs = ", ".join(f"{name} {col_type}" for name, col_type in _ALL_SPEND_COLUMNS)
    con.execute(
        f"CREATE TABLE IF NOT EXISTS token_bank_spend ("
        f"id INTEGER PRIMARY KEY AUTOINCREMENT, {col_defs})"
    )
    existing = {
        row[1]
        for row in con.execute("PRAGMA table_info(token_bank_spend)").fetchall()
    }
    added: list[str] = []
    for col_name, col_type in _ALL_SPEND_COLUMNS:
        if col_name not in existing:
            con.execute(f"ALTER TABLE token_bank_spend ADD COLUMN {col_name} {col_type}")
            added.append(col_name)
    con.execute(
        "CREATE INDEX IF NOT EXISTS idx_spend_called_at ON token_bank_spend(called_at)"
    )
    con.execute(
        "CREATE INDEX IF NOT EXISTS idx_spend_trace ON token_bank_spend(trace_id)"
    )
    con.execute(
        "CREATE INDEX IF NOT EXISTS idx_spend_inner_attempt ON token_bank_spend(inner_attempt_id)"
    )
    return added


# --- Utilities & Timestamp Discipline ---------------------------------------


def _warn(msg: str) -> None:
    """Bounded visibility: first 5 and every 50th. Never silently swallows."""
    _FAILS[0] += 1
    _LAST_WRITE_ERROR[0] = msg
    if _FAILS[0] <= 5 or _FAILS[0] % 50 == 0:
        try:
            sys.stderr.write(f"[fed-attrib #{_FAILS[0]}] {msg}\n")
            sys.stderr.flush()
        except OSError:
            pass


def get_write_failure_stats() -> dict:
    """Expose bounded write-failure counters for diagnostics and tests."""
    return {"failure_count": _FAILS[0], "last_error": _LAST_WRITE_ERROR[0]}


def _utc_now_iso() -> str:
    """Valid UTC ISO-8601 timestamp with actual microseconds (zero literal %f)."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    validate_utc_timestamp(ts)
    return ts


def validate_utc_timestamp(ts: str) -> datetime:
    """Validate UTC ISO-8601 timestamp with microseconds and timezone meaning.

    Raises ValueError visibly on literal '%f', missing timezone, or invalid format.
    """
    if not isinstance(ts, str) or not ts.strip():
        raise ValueError(f"INVALID_TIMESTAMP: empty or non-string value {ts!r}")
    if "%f" in ts:
        raise ValueError(f"INVALID_TIMESTAMP: unexpanded literal '%f' in {ts!r}")
    if not ISO_UTC_MICROSECOND_RE.match(ts):
        raise ValueError(
            f"INVALID_TIMESTAMP: must match YYYY-MM-DDTHH:MM:SS.ffffffZ, got {ts!r}"
        )
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None or dt.utcoffset() != timezone.utc.utcoffset(dt):
        raise ValueError(f"INVALID_TIMESTAMP: missing UTC timezone in {ts!r}")
    return dt


def classify_legacy_timestamp(ts: str | None) -> str:
    """Classify a historical timestamp without rewriting production history."""
    if not isinstance(ts, str) or not ts.strip():
        return "LEGACY_INVALID"
    if "%f" in ts:
        return "LEGACY_MALFORMED_LITERAL_PERCENT_F"
    try:
        validate_utc_timestamp(ts)
        return "VALID_UTC_ISO8601"
    except ValueError:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                return "VALID_ISO8601_NON_MICROSECOND"
        except ValueError:
            pass
        return "LEGACY_INVALID"


def deterministic_row_sort_key(row: dict) -> tuple[str, int]:
    """Deterministic ordering key when timestamps are equal: (called_at, id)."""
    return (str(row.get("called_at") or ""), int(row.get("id") or 0))


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


def _load_config_maps(path: str = CONFIG_PATH) -> tuple[dict[str, set[str]], set[str]]:
    """Load requested group -> deployed model set AND declared fallback edges."""
    groups: dict[str, set[str]] = {}
    edges: set[str] = set()
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
            groups.setdefault(group, set()).add(_norm(model))
        rs = cfg.get("router_settings") or {}
        for item in rs.get("fallbacks") or []:
            if isinstance(item, dict):
                for src, targets in item.items():
                    if isinstance(targets, list):
                        for tgt in targets:
                            edges.add(f"{src}->{tgt}")
    except (OSError, yaml.YAMLError, TypeError, ValueError) as e:
        _warn(f"could not build config maps from {path}: {e}")
    return groups, edges


GROUP_MAP, DECLARED_FALLBACK_EDGES = _load_config_maps()


def _hidden(response) -> dict:
    try:
        return getattr(response, "_hidden_params", {}) or {}
    except (AttributeError, TypeError):
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
    except (AttributeError, TypeError):
        return {}
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


# --- Identity Resolution (PR #120 Precedence + Claim/Resolution Separation) -


def _normalize_actor_for_match(actor: str) -> str:
    """Normalize vk- prefix ONLY for equivalence checks between claimed and vk-* alias."""
    s = actor.strip().lower()
    if s.startswith("vk-"):
        return s[3:]
    return s


def _actors_compatible(actor_a: str, actor_b: str) -> bool:
    """Deterministic compatibility check (no fuzzy matching).

    Allows exact match OR PR #120 vk-<actor> convention (e.g. 'hermes' and 'vk-hermes'
    or 'vk-hermes-prod' only when exact or 'vk-' + declared).
    """
    a = actor_a.strip()
    b = actor_b.strip()
    if not a or not b:
        return True
    if a == b:
        return True
    return b.startswith("vk-" + a) or a.startswith("vk-" + b)


def _trusted_metadata_identity(data, md_dicts: list[dict], recalled_ctx=None) -> str:
    """Extract actor from explicit TRUSTED metadata (gateway/runtime attested).

    Free-form caller headers are NEVER read here.
    Supported trusted slots:
      - ``trusted_actor_id`` / ``verified_actor_id`` in metadata
      - PR #120 ``litellm_params.metadata`` ``billing_agent_id`` / ``agent_id`` /
        ``actor_agent_id`` when ``metadata_trust == 'trusted'`` or ``actor_verified == True``
      - ``recalled_ctx['trusted_actor']`` captured from authenticated pre-call context
    """
    if isinstance(recalled_ctx, dict):
        ta = _clean_meta_str(recalled_ctx.get("trusted_actor"))
        if ta and ta.lower() not in _GENERIC_UNKNOWN_TOKENS:
            return ta

    for md in md_dicts:
        for k in ("trusted_actor_id", "verified_actor_id"):
            val = _clean_meta_str(md.get(k))
            if val and val.lower() not in _GENERIC_UNKNOWN_TOKENS:
                return val
        if md.get("actor_verified") is True or str(md.get("metadata_trust") or "").lower() == "trusted":
            for k in ("billing_agent_id", "agent_id", "actor_agent_id", "actor_id", "arifos_actor_id"):
                val = _clean_meta_str(md.get(k))
                if val and val.lower() not in _GENERIC_UNKNOWN_TOKENS:
                    return val
    return ""


def _verified_credential_identity(
    data, md_dicts: list[dict], user_api_key_dict=None, recalled_ctx=None
) -> tuple[str, str]:
    """Extract (actor_resolved, credential_id) from authenticated credential / vk-alias."""
    if isinstance(recalled_ctx, dict) and recalled_ctx.get("auth_actor"):
        aa = _clean_meta_str(recalled_ctx["auth_actor"])
        cid = _clean_meta_str(recalled_ctx.get("credential_id")) or aa
        if aa and aa.lower() not in _GENERIC_UNKNOWN_TOKENS:
            return aa, cid

    if user_api_key_dict is not None:
        cred_id = ""
        for ck in ("credential_id", "key_id", "token_id", "key_alias"):
            v = (
                user_api_key_dict.get(ck)
                if isinstance(user_api_key_dict, dict)
                else getattr(user_api_key_dict, ck, None)
            )
            cleaned = _clean_meta_str(v)
            if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
                cred_id = cleaned
                break
        for attr in ("key_alias", "user_id", "team_alias", "team_id", "end_user_id"):
            val = (
                user_api_key_dict.get(attr)
                if isinstance(user_api_key_dict, dict)
                else getattr(user_api_key_dict, attr, None)
            )
            cleaned = _clean_meta_str(val)
            if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
                return cleaned, (cred_id or cleaned)

    auth_keys = (
        "user_api_key_alias",
        "user_api_key_user_id",
        "user_api_key_team_alias",
        "user_api_key_team_id",
        "user_api_key_end_user_id",
    )
    val = _first_meta(md_dicts, auth_keys)
    if val and val.lower() not in _GENERIC_UNKNOWN_TOKENS:
        return val, val
    if isinstance(data, dict):
        for k in auth_keys:
            cleaned = _clean_meta_str(data.get(k))
            if cleaned and cleaned.lower() not in _GENERIC_UNKNOWN_TOKENS:
                return cleaned, cleaned
    return "", ""


def _approved_lane_group_identity(data, md_dicts: list[dict]) -> str:
    """Resolve deterministic actor from approved dedicated lane groups (PR #120)."""
    candidates: list[str] = []
    for md in md_dicts:
        for k in ("model_group", "requested_model_group"):
            v = _clean_meta_str(md.get(k))
            if v:
                candidates.append(v)
    if isinstance(data, dict):
        for k in ("model_group", "model"):
            v = _clean_meta_str(data.get(k))
            if v:
                candidates.append(v)
        lp = data.get("litellm_params")
        if isinstance(lp, dict):
            v = _clean_meta_str(lp.get("model"))
            if v:
                candidates.append(v)
            mam = lp.get("model_alias_map")
            if isinstance(mam, dict):
                candidates.extend(str(k) for k in mam)

    for c in candidates:
        for grp, agent in GROUP_AGENT_MAP.items():
            if c == grp or c.startswith(grp + "@"):
                return agent
    return ""


def _caller_service_claim(data, md_dicts: list[dict], headers: dict[str, str]) -> str:
    """Extract UNTRUSTED caller-service claim from headers, metadata, or user-agent."""
    from_hdr = _first_header(headers, ("x-caller-service", "x-service-name", "x-litellm-caller"))
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
    """Deterministic caller identity resolution separating claim from verification.

    Trusted precedence (PR #120 compatibility baseline):
      1. explicit_trusted_metadata -> 1.0 (VERIFIED)
      2. verified_credential / vk-* alias -> 0.95 (VERIFIED)
      3. approved_lane_group (GROUP_AGENT_MAP) -> 0.80 (VERIFIED)
      4. explicit UNKNOWN -> 0.0 (UNKNOWN or CLAIMED_UNVERIFIED)

    Contradictions fail closed:
      * trusted_metadata != verified_credential -> CONTRADICTION
      * untrusted caller claim != verified_credential/trusted_metadata -> CONTRADICTION
        (unverified claim NEVER silently overwrites a verified source).

    Never inspects prompt/message/response content.
    """
    headers = _merged_headers(data, request_headers, recalled_ctx)
    md_dicts = _metadata_dicts(data, recalled_ctx)
    tags = _extract_tags(data, md_dicts, headers)
    kv_tags = _parse_kv_tags(tags)

    # --- Untrusted caller-supplied claims ---
    header_claim = _first_header(
        headers, ("x-arifos-actor-id", "x-arifos-actor", "x-fed-actor-id")
    )
    meta_claim = _first_meta(
        md_dicts,
        ("actor_id", "billing_agent_id", "agent_id", "actor_agent_id", "arifos_actor_id", "caller_actor_id"),
    )
    tag_claim = (
        kv_tags.get("actor_id")
        or kv_tags.get("actor")
        or kv_tags.get("agent")
        or kv_tags.get("caller")
        or ""
    )
    svc_claim = _caller_service_claim(data, md_dicts, headers)

    actor_claimed = ""
    for candidate in (header_claim, meta_claim, tag_claim, svc_claim):
        if candidate and candidate.lower() not in _GENERIC_UNKNOWN_TOKENS:
            actor_claimed = candidate
            break

    # --- Trusted identity sources (strict precedence) ---
    trusted_meta_actor = _trusted_metadata_identity(data, md_dicts, recalled_ctx)
    cred_actor, credential_id = _verified_credential_identity(
        data, md_dicts, user_api_key_dict, recalled_ctx
    )
    lane_group_actor = _approved_lane_group_identity(data, md_dicts)

    # --- Contradiction detection (fail-closed) ---
    contradiction_detail = ""
    if trusted_meta_actor and cred_actor and not _actors_compatible(trusted_meta_actor, cred_actor):
        contradiction_detail = f"trusted_metadata:{trusted_meta_actor[:32]}!=verified_credential:{cred_actor[:32]}"
    elif trusted_meta_actor and actor_claimed and not _actors_compatible(actor_claimed, trusted_meta_actor):
        contradiction_detail = f"claimed:{actor_claimed[:32]}!=trusted_metadata:{trusted_meta_actor[:32]}"
    elif cred_actor and actor_claimed and not _actors_compatible(actor_claimed, cred_actor):
        contradiction_detail = f"claimed:{actor_claimed[:32]}!=verified_credential:{cred_actor[:32]}"

    if contradiction_detail:
        actor_resolved = "CONTRADICTION"
        actor_resolution_source = "CONTRADICTION"
        actor_verification_state = "CONTRADICTION"
        actor_id = f"CONTRADICTION:{contradiction_detail}"
        actor_source = "CONTRADICTION"
        attribution_confidence = 0.0
    elif trusted_meta_actor:
        actor_resolved = trusted_meta_actor
        actor_resolution_source = "explicit_trusted_metadata"
        actor_verification_state = "VERIFIED"
        actor_id = trusted_meta_actor
        actor_source = "explicit_trusted_metadata"
        attribution_confidence = 1.0
    elif cred_actor:
        actor_resolved = cred_actor
        actor_resolution_source = "verified_credential"
        actor_verification_state = "VERIFIED"
        actor_id = cred_actor
        actor_source = "verified_credential"
        attribution_confidence = 0.95
    elif lane_group_actor:
        actor_resolved = lane_group_actor
        actor_resolution_source = "approved_lane_group"
        actor_verification_state = "VERIFIED"
        actor_id = lane_group_actor
        actor_source = "approved_lane_group"
        attribution_confidence = 0.80
    else:
        actor_resolved = "UNKNOWN"
        actor_resolution_source = "UNKNOWN"
        actor_verification_state = "CLAIMED_UNVERIFIED" if actor_claimed else "UNKNOWN"
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
    capability_id = (
        _first_header(headers, ("x-arifos-capability-id", "x-capability-id"))
        or _first_meta(md_dicts, ("capability_id", "arifos_capability_id"))
        or kv_tags.get("capability_id")
        or ""
    )
    task_class = (
        _first_header(headers, ("x-arifos-task-class", "x-task-class"))
        or _first_meta(md_dicts, ("task_class", "arifos_task_class"))
        or kv_tags.get("task_class")
        or ""
    )
    origin_node = (
        _first_header(headers, ("x-arifos-node-id", "x-origin-node"))
        or _first_meta(md_dicts, ("origin_node", "node_id"))
        or kv_tags.get("origin_node")
        or ""
    )
    client = (
        _first_header(headers, ("x-arifos-client",))
        or _first_meta(md_dicts, ("client",))
        or kv_tags.get("client")
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
    outer_attempt_id = (
        _first_header(headers, ("x-arifos-outer-attempt-id",))
        or _first_meta(md_dicts, ("outer_attempt_id",))
        or logical_request_id
        or ""
    )

    return {
        "actor_id": actor_id,
        "actor_source": actor_source,
        "actor_claimed": actor_claimed or "UNKNOWN",
        "actor_resolved": actor_resolved,
        "actor_resolution_source": actor_resolution_source,
        "actor_verification_state": actor_verification_state,
        "actor_contradiction_detail": contradiction_detail,
        "attribution_confidence": attribution_confidence,
        "credential_id": credential_id,
        "session_id": session_id,
        "task_id": task_id,
        "turn_id": turn_id,
        "purpose": purpose,
        "trace_id": trace_id,
        "capability_id": capability_id,
        "task_class": task_class,
        "origin_node": origin_node,
        "client": client,
        "requested_model_group": requested_model_group,
        "logical_request_id": logical_request_id,
        "outer_attempt_id": outer_attempt_id,
    }


# --- Provider taxonomy, failure domain & redaction --------------------------


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
    except ValueError:
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
    extra_hdrs = {str(k).lower(): v for k, v in _extra(response).items()}
    hdr_base = extra_hdrs.get("x-litellm-model-api-base") or extra_hdrs.get("x-litellm-api-base")
    if isinstance(hdr_base, str) and hdr_base.strip():
        return hdr_base.strip()
    return ""


def _normalize_serving_provider(raw: str) -> str:
    s = _clean_meta_str(raw).lower()
    if not s or s in _GENERIC_UNKNOWN_TOKENS:
        return "UNKNOWN"
    if s in _PROVIDER_NAME_ALIASES:
        return _PROVIDER_NAME_ALIASES[s]
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
        ("header", extra_hdrs.get("x-openrouter-provider") or extra_hdrs.get("x-serving-provider")),
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

    custom_provider = str(
        _hidden(response).get("custom_llm_provider")
        or (data.get("custom_llm_provider") if isinstance(data, dict) else "")
        or ""
    ).strip().lower()

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
    custom_provider = str(
        _hidden(response).get("custom_llm_provider")
        or (data.get("custom_llm_provider") if isinstance(data, dict) else "")
        or ""
    ).strip().lower()
    model_str = str(data.get("model") if isinstance(data, dict) else "").strip().lower()

    if (
        host == "openrouter.ai"
        or host.endswith(".openrouter.ai")
        or custom_provider == "openrouter"
        or model_str.startswith("openrouter/")
    ):
        return "openrouter"

    if (
        host in ("huggingface.co", "hf.co")
        or host.endswith((".huggingface.co", ".hf.co"))
        or custom_provider == "huggingface"
        or model_str.startswith("huggingface/")
    ):
        return "huggingface"

    if host in VERIFIED_DIRECT_HOST_MAP:
        return "direct"

    return "unknown"


def _classify_failure_domain(routing_intermediary: str, host: str) -> str:
    """Physical failure-domain classification (host/intermediary boundary)."""
    if routing_intermediary in ("openrouter", "huggingface"):
        return f"intermediary:{routing_intermediary}"
    if host in ("localhost", "127.0.0.1", "ollama", "host.docker.internal"):
        return "local:ollama"
    if host:
        return f"direct:{host}"
    return "UNKNOWN"


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
    failure_domain = _classify_failure_domain(routing_intermediary, host)

    return {
        "transport_protocol": transport_protocol,
        "entry_gateway": entry_gateway,
        "routing_intermediary": routing_intermediary,
        "serving_provider": serving_provider,
        "serving_provider_source": serving_provider_source,
        "serving_provider_confidence": serving_provider_confidence,
        "api_base_host_redacted": host,
        "upstream_model_id": upstream_model_id,
        "failure_domain": failure_domain,
    }


# --- Cost & Token Semantics -------------------------------------------------


def _resolve_cost_classification(data, response, cost: float) -> tuple[str, str]:
    """Return (cost_evidence_class, cost_provenance).

    Canonical cost classes:
      CASH_COST | PLAN_INCLUDED_COST_ATTRIBUTED |
      PLAN_INCLUDED_COST_UNATTRIBUTED | QUOTA_COST | UNKNOWN_COST.
    Never labels prepaid usage as "free".
    """
    hidden = _hidden(response)
    usage = getattr(response, "usage", None)
    model_extra = getattr(response, "model_extra", None) or {}
    md_dicts = _metadata_dicts(data)

    # 1. Plan-covered / subscription usage (check before zero-cash fallback)
    plan_markers = {"plan", "subscription", "coding_plan", "token_plan", "plan_included"}
    billing_mode = _first_meta(md_dicts, ("billing_mode", "cost_basis", "plan_type")).lower()
    is_plan = billing_mode in plan_markers or any(bool(md.get("plan_covered")) for md in md_dicts)
    if is_plan:
        has_attributed_plan_cost = (
            any(md.get("plan_attributed_cost_usd") is not None for md in md_dicts)
            or hidden.get("plan_attributed_cost_usd") is not None
        )
        if has_attributed_plan_cost:
            return "PLAN_INCLUDED_COST_ATTRIBUTED", "PLAN_DECLARED"
        return "PLAN_INCLUDED_COST_UNATTRIBUTED", "PLAN_DECLARED"

    # 2. Quota-bearing non-cash usage
    if billing_mode in {"quota", "quota_bearing"} or any(bool(md.get("quota_bearing")) for md in md_dicts):
        return "QUOTA_COST", "QUOTA_DECLARED"

    # 3. Explicit provider-reported cash cost
    usage_cost = getattr(usage, "cost", None) if usage is not None else None
    extra_usage = model_extra.get("usage") if isinstance(model_extra, dict) else None
    extra_cost = extra_usage.get("cost") if isinstance(extra_usage, dict) else None
    if (
        usage_cost is not None
        or extra_cost is not None
        or hidden.get("provider_cost") is not None
        or str(hidden.get("response_cost_source") or "").lower() == "provider"
    ):
        return "CASH_COST", "PROVIDER_REPORTED"

    # 4. Explicitly flagged estimate
    if hidden.get("cost_estimated") or any(bool(md.get("cost_estimated")) for md in md_dicts):
        return ("CASH_COST" if cost > 0.0 else "UNKNOWN_COST"), "ESTIMATED"

    # 5. LiteLLM calculated positive cash cost
    if hidden.get("response_cost") is not None and cost > 0.0:
        return "CASH_COST", "LITELLM_CALCULATED"

    return "UNKNOWN_COST", "UNKNOWN"


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

    if "cache_hit" in hidden and hidden.get("cache_hit") is not None:
        return "HIT" if bool(hidden.get("cache_hit")) else "MISS"

    return "UNKNOWN"


def _int_or_none(val) -> int | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        iv = int(val)
        return iv if iv >= 0 else None
    except (TypeError, ValueError):
        return None


def resolve_token_semantics(response, cache_state: str) -> dict:
    """Compute explicit token semantics without manufacturing zero or conflating replay/unique.

    accepted_input_tokens and accepted_output_tokens are ALWAYS None at inference time
    (never inferred from HTTP 200).
    """
    usage = getattr(response, "usage", None)
    limitations: list[str] = []

    if usage is None:
        return {
            "attempted_input_tokens": None,
            "attempted_output_tokens": None,
            "replayed_input_tokens": None,
            "replayed_output_tokens": None,
            "unique_input_tokens": None,
            "unique_output_tokens": None,
            "accepted_input_tokens": None,
            "accepted_output_tokens": None,
            "token_source_limitation": "usage_absent;acceptance_pending",
        }

    attempted_in = _int_or_none(getattr(usage, "prompt_tokens", None))
    attempted_out = _int_or_none(getattr(usage, "completion_tokens", None))
    if attempted_in is None:
        limitations.append("prompt_tokens_absent")
    if attempted_out is None:
        limitations.append("completion_tokens_absent")

    # Provider prompt-cache read tokens (e.g. prompt_tokens_details.cached_tokens or cache_read_input_tokens)
    cached_in = _int_or_none(getattr(usage, "cache_read_input_tokens", None))
    if cached_in is None:
        ptd = getattr(usage, "prompt_tokens_details", None)
        if isinstance(ptd, dict):
            cached_in = _int_or_none(ptd.get("cached_tokens"))
        elif ptd is not None:
            cached_in = _int_or_none(getattr(ptd, "cached_tokens", None))

    replayed_in: int | None
    replayed_out: int | None
    unique_in: int | None
    unique_out: int | None

    if cache_state == "HIT":
        # Full cache replay: zero fresh unique computation.
        replayed_in = attempted_in
        replayed_out = attempted_out
        unique_in = 0 if attempted_in is not None else None
        unique_out = 0 if attempted_out is not None else None
    elif cache_state in ("MISS", "BYPASS"):
        replayed_in = cached_in if cached_in is not None else 0
        replayed_out = 0 if attempted_out is not None else None
        if attempted_in is not None:
            unique_in = max(0, attempted_in - replayed_in)
        else:
            unique_in = None
        unique_out = attempted_out
    else:
        # Cache state UNKNOWN: do NOT manufacture zero for replayed or assume all tokens are unique.
        limitations.append("cache_state_unknown")
        replayed_in = cached_in
        replayed_out = None
        unique_in = None
        unique_out = None

    limitations.append("acceptance_pending")
    return {
        "attempted_input_tokens": attempted_in,
        "attempted_output_tokens": attempted_out,
        "replayed_input_tokens": replayed_in,
        "replayed_output_tokens": replayed_out,
        "unique_input_tokens": unique_in,
        "unique_output_tokens": unique_out,
        "accepted_input_tokens": None,
        "accepted_output_tokens": None,
        "token_source_limitation": ";".join(limitations),
    }


def validate_deployment_id(deployment_id: str | None) -> tuple[bool, str]:
    """Validate deployment_id against PR-FED-2 or safe deterministic ID rules."""
    if not deployment_id or not isinstance(deployment_id, str):
        return False, "absent"
    raw = deployment_id.strip()
    if not raw or raw.lower() in _GENERIC_UNKNOWN_TOKENS:
        return False, "placeholder"
    if _SECRET_LIKE_RE.search(raw):
        return False, "secret_rejected"
    if PR_FED_2_DEPLOYMENT_ID_RE.match(raw):
        return True, "pr_fed_2_canonical"
    if SAFE_DEPLOYMENT_ID_RE.match(raw):
        return True, "safe_identifier"
    return False, "invalid_format"


def _resolve_deployment_id(data, response) -> tuple[str, bool, str]:
    hidden = _hidden(response)
    raw = ""
    if hidden.get("model_id"):
        raw = str(hidden.get("model_id"))
    if not raw:
        for md in _metadata_dicts(data):
            mi = md.get("model_info")
            if isinstance(mi, dict) and mi.get("id"):
                raw = str(mi.get("id"))
                break
            if md.get("deployment_id"):
                raw = str(md.get("deployment_id"))
                break
    if not raw and isinstance(data, dict):
        lp = data.get("litellm_params")
        if isinstance(lp, dict):
            mi = lp.get("model_info")
            if isinstance(mi, dict) and mi.get("id"):
                raw = str(mi.get("id"))

    raw = raw.strip()
    if not raw:
        return "", False, "absent"
    valid, reason = validate_deployment_id(raw)
    if not valid:
        return "INVALID_DEPLOYMENT_ID", False, reason
    return raw, True, reason


# --- Model-ID attribution core ----------------------------------------------


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
    if isinstance(data, dict):
        m = data.get("model")
        if m:
            return str(m)
    return str(_extra(response).get(_SERVED_GROUP_HEADER) or "")


def _integrity_mode(request_headers) -> str:
    if isinstance(request_headers, dict):
        for k, v in request_headers.items():
            if str(k).lower() == STRICT_HEADER:
                return (
                    "strict"
                    if str(v).strip().lower() in STRICT_VALUES
                    else "availability"
                )
    return "availability"


def _mode_key(data) -> str:
    """Stable per-request key across the pre-call and post-call hooks."""
    if isinstance(data, dict):
        cid = data.get("litellm_call_id")
        if cid:
            return f"cid:{cid}"
    return f"obj:{id(data)}"


def _remember_mode(data, mode: str) -> None:
    if len(_CALL_MODES) > _CALL_MODES_MAX:
        _CALL_MODES.clear()
    _CALL_MODES[_mode_key(data)] = mode


def _recall_mode(data):
    return _CALL_MODES.get(_mode_key(data))


def _forget_mode(data) -> None:
    _CALL_MODES.pop(_mode_key(data), None)


def _remember_ctx(data, ctx: dict) -> None:
    if len(_CALL_CTX) > _CALL_MODES_MAX:
        _CALL_CTX.clear()
    _CALL_CTX[_mode_key(data)] = ctx


def _recall_ctx(data):
    return _CALL_CTX.get(_mode_key(data))


def _forget_ctx(data) -> None:
    _CALL_CTX.pop(_mode_key(data), None)


def _remember_rec(data, rec: dict) -> None:
    if len(_CALL_RECS) > _CALL_MODES_MAX:
        _CALL_RECS.clear()
    _CALL_RECS[_mode_key(data)] = rec


def _take_rec(data):
    return _CALL_RECS.pop(_mode_key(data), None)


def _resolve_mode(data, request_headers=None, mode=None) -> str:
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


def _detect_producer_acceptance_attempt(data, request_headers=None) -> bool:
    """Detect if the inference producer/caller attempted to populate accepted_by."""
    hdrs = _merged_headers(data, request_headers)
    if hdrs.get("x-arifos-accepted-by") or hdrs.get("x-accepted-by"):
        return True
    for md in _metadata_dicts(data):
        if md.get("accepted_by") or md.get("acceptance_timestamp") or md.get("accepted_outcome_id"):
            return True
    return bool(isinstance(data, dict) and data.get("accepted_by"))


def _resolve_fallback_edge(
    requested_group: str, served_group: str, substituted: bool | None, attempted_fallbacks: int
) -> str:
    """Resolve fallback_edge_id and flag unknown fallback edges visibly."""
    if not substituted and attempted_fallbacks == 0:
        return ""
    if not requested_group or not served_group:
        return "UNKNOWN_FALLBACK_EDGE"
    edge = f"{requested_group}->{served_group}"
    if DECLARED_FALLBACK_EDGES and edge not in DECLARED_FALLBACK_EDGES and requested_group != served_group:
        return f"UNKNOWN_EDGE:{edge}"
    return edge


def _extract_finish_reason(response) -> str:
    """Extract completion finish_reason (BBB/CCC/DDD receipt parity) without reading content."""
    choices = getattr(response, "choices", None)
    if isinstance(choices, (list, tuple)) and choices:
        fr = getattr(choices[0], "finish_reason", None)
        cleaned = _clean_meta_str(fr, max_len=64)
        if cleaned:
            return cleaned
    return ""


def _compute_latency_ms(start_time, end_time) -> float | None:
    """Compute elapsed latency in ms from callback start_time/end_time (datetime or float)."""
    if start_time is None or end_time is None:
        return None
    try:
        if isinstance(start_time, datetime) and isinstance(end_time, datetime):
            delta = (end_time - start_time).total_seconds() * 1000.0
        else:
            delta = (float(end_time) - float(start_time)) * 1000.0
        return round(delta, 3) if delta >= 0.0 else None
    except (TypeError, ValueError):
        return None


def attribution(
    data,
    response,
    request_headers=None,
    mode=None,
    user_api_key_dict=None,
    start_time=None,
    end_time=None,
) -> dict:
    """Compute the full canonical attribution record. Pure; no side effects."""
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
    cost_evidence_class, cost_provenance = _resolve_cost_classification(data, response, cost)
    deployment_id, deployment_id_valid, deployment_id_reason = _resolve_deployment_id(data, response)
    logical_request_id = caller["logical_request_id"] or (call_id or "")
    outer_attempt_id = caller["outer_attempt_id"] or logical_request_id
    inner_attempt_id = call_id or logical_request_id
    fallback_used = bool(substituted is True or attempted_fallbacks > 0)
    fallback_edge_id = _resolve_fallback_edge(
        requested_model_group, served_group, substituted, attempted_fallbacks
    )
    response_status = (
        "SUBSTITUTED"
        if substituted is True
        else ("UNKNOWN" if status == "UNKNOWN" else "OK")
    )
    token_sem = resolve_token_semantics(response, cache_state)
    attempt_layer = "cache_replay" if cache_hit else "litellm_transport_attempt"
    candidate_result_id = _clean_meta_str(getattr(response, "id", None)) or (call_id or "")

    # Producer MUST NOT set accepted_by — strip & flag if attempted.
    producer_acceptance_blocked = _detect_producer_acceptance_attempt(data, request_headers)
    if producer_acceptance_blocked:
        _warn("producer attempted to populate accepted_by — stripped (downstream-only field)")

    return {
        "requested_alias": requested,
        "requested_model": requested,
        "requested_model_group": requested_model_group,
        "served_model": served,
        "upstream_model_id": taxonomy["upstream_model_id"],
        "served_group": served_group,
        "substituted": substituted,
        "fallback_used": fallback_used,
        "fallback_edge_id": fallback_edge_id,
        "attempted_fallbacks": attempted_fallbacks,
        "fallback_reason": reason or "UNKNOWN",
        "cache_replay": cache_hit,
        "cache_state": cache_state,
        "attribution_status": status,
        "response_status": response_status,
        "finish_reason": _extract_finish_reason(response),
        "latency_ms": _compute_latency_ms(start_time, end_time),
        "transport_protocol": taxonomy["transport_protocol"],
        "entry_gateway": taxonomy["entry_gateway"],
        "routing_intermediary": taxonomy["routing_intermediary"],
        "serving_provider": taxonomy["serving_provider"],
        "serving_provider_source": taxonomy["serving_provider_source"],
        "serving_provider_confidence": taxonomy["serving_provider_confidence"],
        "api_base_host_redacted": taxonomy["api_base_host_redacted"],
        "failure_domain": taxonomy["failure_domain"],
        "actor_id": caller["actor_id"],
        "actor_source": caller["actor_source"],
        "actor_claimed": caller["actor_claimed"],
        "actor_resolved": caller["actor_resolved"],
        "actor_resolution_source": caller["actor_resolution_source"],
        "actor_verification_state": caller["actor_verification_state"],
        "actor_contradiction_detail": caller["actor_contradiction_detail"],
        "attribution_confidence": caller["attribution_confidence"],
        "credential_id": caller["credential_id"],
        "session_id": caller["session_id"],
        "task_id": caller["task_id"],
        "turn_id": caller["turn_id"],
        "purpose": caller["purpose"],
        "trace_id": caller["trace_id"],
        "capability_id": caller["capability_id"],
        "task_class": caller["task_class"],
        "origin_node": caller["origin_node"],
        "client": caller["client"],
        "deployment_id": deployment_id,
        "deployment_id_valid": deployment_id_valid,
        "deployment_id_reason": deployment_id_reason,
        "logical_request_id": logical_request_id,
        "outer_attempt_id": outer_attempt_id,
        "inner_attempt_id": inner_attempt_id,
        "attempt_layer": attempt_layer,
        "cost_evidence_class": cost_evidence_class,
        "cost_provenance": cost_provenance,
        "call_id": call_id,
        "integrity_mode": _resolve_mode(data, request_headers, mode),
        "timestamp_utc": _utc_now_iso(),
        # Explicit token semantics
        **token_sem,
        # Outcome & acceptance (downstream-only; NEVER populated by inference producer)
        "outcome_state": "outcome_pending",
        "candidate_result_id": candidate_result_id,
        "accepted_by": None,
        "acceptance_timestamp": None,
        "acceptance_criteria_id": None,
        "accepted_outcome_id": None,
        "producer_acceptance_blocked": producer_acceptance_blocked,
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
        "x-arifos-actor-verification": str(rec.get("actor_verification_state") or "UNKNOWN"),
        "x-arifos-routing-intermediary": str(rec.get("routing_intermediary") or "unknown"),
    }


def _log(rec: dict) -> None:
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, default=str) + "\n")
    except OSError as e:
        _warn(f"attribution log write failed ({LOG_PATH}): {e}")


# --- KVM4 Compatibility Adapters --------------------------------------------


def project_canonical_to_kvm4(rec: dict) -> dict:
    """Project a canonical PR-FED-1 record onto KVM4's 23-column compatibility view."""
    return {
        "provider_name": rec.get("serving_provider") or "UNKNOWN",
        "model_id": rec.get("requested_model") or "UNKNOWN",
        "agent_id": rec.get("actor_id") or "UNKNOWN",
        "tokens_in": rec.get("attempted_input_tokens"),
        "tokens_out": rec.get("attempted_output_tokens"),
        "estimated_cost_usd": rec.get("estimated_cost_usd", 0.0),
        "called_at": rec.get("timestamp_utc") or rec.get("called_at"),
        "protocol": SPEND_PROTOCOL,
        "api_base": rec.get("api_base_host_redacted") or "",
        "attribution_confidence": rec.get("attribution_confidence", 0.0),
        "call_id": rec.get("call_id"),
        "serving_provider": rec.get("serving_provider") or "UNKNOWN",
        "serving_provider_source": rec.get("serving_provider_source") or "absent",
        "attempted_fallbacks": rec.get("attempted_fallbacks", 0),
        "actor_id": rec.get("actor_id") or "UNKNOWN",
        "actor_source": rec.get("actor_source") or "UNKNOWN",
        "session_id": rec.get("session_id") or "",
        "task_id": rec.get("task_id") or "",
        "turn_id": rec.get("turn_id") or "",
        "purpose": rec.get("purpose") or "",
        "trace_id": rec.get("trace_id") or "",
        "logical_request_id": rec.get("logical_request_id") or "",
        "requested_model_group": rec.get("requested_model_group") or "",
    }


def adapt_kvm4_row_to_canonical(row: dict) -> dict:
    """Adapt a legacy KVM4 23/32-column DB row into canonical PR-FED-1 read shape."""
    ts = row.get("called_at")
    ts_class = classify_legacy_timestamp(ts)
    actor = row.get("actor_id") or row.get("agent_id") or "UNKNOWN"
    if str(actor).strip().lower() in _GENERIC_UNKNOWN_TOKENS:
        actor = "UNKNOWN"
    return {
        "provider_name": row.get("serving_provider") or row.get("provider_name") or "UNKNOWN",
        "serving_provider": row.get("serving_provider") or "UNKNOWN",
        "requested_model": row.get("model_id") or "UNKNOWN",
        "requested_model_group": row.get("requested_model_group") or row.get("model_id") or "",
        "actor_id": actor,
        "actor_claimed": row.get("actor_claimed") or "UNKNOWN",
        "actor_resolved": row.get("actor_resolved") or actor,
        "actor_resolution_source": row.get("actor_resolution_source") or row.get("actor_source") or "UNKNOWN",
        "actor_verification_state": row.get("actor_verification_state") or "UNKNOWN",
        "session_id": row.get("session_id") or "",
        "task_id": row.get("task_id") or "",
        "turn_id": row.get("turn_id") or "",
        "purpose": row.get("purpose") or "",
        "trace_id": row.get("trace_id") or "",
        "logical_request_id": row.get("logical_request_id") or row.get("call_id") or "",
        "attempted_input_tokens": row.get("tokens_in"),
        "attempted_output_tokens": row.get("tokens_out"),
        "accepted_input_tokens": row.get("accepted_input_tokens"),
        "accepted_output_tokens": row.get("accepted_output_tokens"),
        "called_at": ts,
        "timestamp_classification": ts_class,
        "outcome_state": row.get("outcome_state") or "outcome_pending",
        "accepted_by": row.get("accepted_by"),
    }


# --- Spend attribution (single canonical writer of token_bank_spend) --------


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


_INSERT_COLUMNS: tuple[str, ...] = tuple(name for name, _ in _ALL_SPEND_COLUMNS)
_INSERT_SQL = (
    f"INSERT INTO token_bank_spend ({', '.join(_INSERT_COLUMNS)}) "
    f"VALUES ({', '.join('?' for _ in _INSERT_COLUMNS)})"
)


def write_spend_row(
    kwargs,
    response_obj,
    *,
    user_api_key_dict=None,
    request_headers=None,
    start_time=None,
    end_time=None,
    max_retries: int = 2,
) -> dict:
    """Write ONE lineage-complete spend row. Idempotent on inner_attempt_id / call_id.

    Raises sqlite3.Error visibly on unwritable/read-only DB; retries are bounded
    to transient SQLITE_BUSY/locked errors only and never create duplicate rows.
    """
    rec = attribution(
        kwargs,
        response_obj,
        request_headers=request_headers,
        user_api_key_dict=user_api_key_dict,
        start_time=start_time,
        end_time=end_time,
    )
    model = (kwargs.get("model") if isinstance(kwargs, dict) else None) or "UNKNOWN"
    hidden = _spend_hidden(response_obj)
    cost = float(hidden.get("response_cost", 0.0) or 0.0)
    called_at = rec["timestamp_utc"]
    validate_utc_timestamp(called_at)

    provider_name = rec["serving_provider"]
    api_base_redacted = rec["api_base_host_redacted"]
    lane = _spend_lane(kwargs) or rec["requested_model_group"]
    inner_attempt_id = rec["inner_attempt_id"] or None

    row_values = (
        provider_name,
        model,
        rec["actor_id"],
        rec["attempted_input_tokens"],
        rec["attempted_output_tokens"],
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
        rec["actor_claimed"],
        rec["actor_resolved"],
        rec["actor_resolution_source"],
        rec["actor_verification_state"],
        rec["actor_contradiction_detail"],
        rec["credential_id"],
        rec["session_id"],
        rec["task_id"],
        rec["turn_id"],
        rec["purpose"],
        rec["trace_id"],
        rec["capability_id"],
        rec["task_class"],
        rec["origin_node"],
        rec["client"],
        lane,
        rec["requested_model"],
        rec["served_model"],
        rec["transport_protocol"],
        rec["entry_gateway"],
        rec["routing_intermediary"],
        rec["serving_provider_confidence"],
        api_base_redacted,
        rec["upstream_model_id"],
        rec["failure_domain"],
        rec["cost_evidence_class"],
        rec["cost_provenance"],
        rec["cache_state"],
        1 if rec["cache_replay"] else 0,
        1 if rec["fallback_used"] else 0,
        rec["fallback_edge_id"],
        rec["deployment_id"],
        1 if rec["deployment_id_valid"] else 0,
        rec["logical_request_id"],
        rec["outer_attempt_id"],
        inner_attempt_id,
        rec["attempt_layer"],
        rec["attempted_input_tokens"],
        rec["attempted_output_tokens"],
        rec["replayed_input_tokens"],
        rec["replayed_output_tokens"],
        rec["unique_input_tokens"],
        rec["unique_output_tokens"],
        None,  # accepted_input_tokens — downstream only
        None,  # accepted_output_tokens — downstream only
        rec["token_source_limitation"],
        rec["response_status"],
        rec["finish_reason"],
        rec["latency_ms"],
        "outcome_pending",  # outcome_state
        rec["candidate_result_id"],
        None,  # accepted_by — downstream only
        None,  # acceptance_timestamp — downstream only
        None,  # acceptance_criteria_id — downstream only
        None,  # accepted_outcome_id — downstream only
    )
    assert len(row_values) == len(_INSERT_COLUMNS), (
        f"column/value count mismatch: {len(row_values)} != {len(_INSERT_COLUMNS)}"
    )

    last_exc: Exception | None = None
    attempts = max(1, int(max_retries) + 1)
    for attempt in range(attempts):
        con = sqlite3.connect(SPEND_DB, timeout=5.0)
        try:
            con.execute("PRAGMA journal_mode=WAL")
            con.execute("PRAGMA busy_timeout=5000")
            ensure_attribution_schema(con)

            # Idempotent deduplication on inner_attempt_id / call_id so duplicate
            # callback delivery or retries never create duplicate inference rows.
            if inner_attempt_id:
                existing = con.execute(
                    "SELECT id FROM token_bank_spend WHERE inner_attempt_id = ? OR call_id = ? LIMIT 1",
                    (inner_attempt_id, inner_attempt_id),
                ).fetchone()
                if existing is not None:
                    return {
                        "ok": True,
                        "deduplicated": True,
                        "existing_row_id": existing[0],
                        "lane": lane,
                        "actor_id": rec["actor_id"],
                        "actor_resolved": rec["actor_resolved"],
                        "actor_verification_state": rec["actor_verification_state"],
                        "model": model,
                        "serving_provider": rec["serving_provider"],
                        "cost_usd": cost,
                        "cost_evidence_class": rec["cost_evidence_class"],
                        "called_at": called_at,
                    }

            con.execute(_INSERT_SQL, row_values)
            con.commit()
            return {
                "ok": True,
                "deduplicated": False,
                "lane": lane,
                "actor_id": rec["actor_id"],
                "actor_source": rec["actor_source"],
                "actor_claimed": rec["actor_claimed"],
                "actor_resolved": rec["actor_resolved"],
                "actor_verification_state": rec["actor_verification_state"],
                "model": model,
                "serving_provider": rec["serving_provider"],
                "cost_usd": cost,
                "cost_evidence_class": rec["cost_evidence_class"],
                "tokens_in": rec["attempted_input_tokens"],
                "tokens_out": rec["attempted_output_tokens"],
                "called_at": called_at,
            }
        except sqlite3.OperationalError as e:
            last_exc = e
            msg = str(e).lower()
            if ("locked" in msg or "busy" in msg) and attempt + 1 < attempts:
                time.sleep(0.05 * (attempt + 1))
                continue
            raise
        finally:
            con.close()

    assert last_exc is not None
    raise last_exc


_FORBIDDEN_PRODUCER_ACCEPTORS = frozenset(
    {"litellm", "fed_attribution_callback", "fed_spend_callback", "inference_producer", "http_200"}
)


def record_downstream_acceptance(
    db_path: str,
    *,
    inner_attempt_id: str,
    accepted_by: str,
    acceptance_criteria_id: str,
    accepted_outcome_id: str,
    authorized_downstream: bool = False,
    accepted_input_tokens: int | None = None,
    accepted_output_tokens: int | None = None,
) -> dict:
    """Authorized downstream acceptance event linking acceptance to a pending spend row.

    Refuses to run if not authorized_downstream or if accepted_by names an
    inference producer.
    """
    if not authorized_downstream:
        raise PermissionError("ACCEPTANCE_UNAUTHORIZED: only an authorized downstream event may set accepted_by")
    acceptor = _clean_meta_str(accepted_by)
    if not acceptor or acceptor.lower() in _GENERIC_UNKNOWN_TOKENS or acceptor.lower() in _FORBIDDEN_PRODUCER_ACCEPTORS:
        raise ValueError(f"INVALID_ACCEPTOR: {accepted_by!r} may not populate accepted_by")
    criteria = _clean_meta_str(acceptance_criteria_id)
    outcome_id = _clean_meta_str(accepted_outcome_id)
    if not criteria or not outcome_id:
        raise ValueError("ACCEPTANCE_INCOMPLETE: acceptance_criteria_id and accepted_outcome_id are required")

    ts = _utc_now_iso()
    con = sqlite3.connect(db_path, timeout=5.0)
    try:
        ensure_attribution_schema(con)
        cur = con.execute(
            "UPDATE token_bank_spend "
            "SET outcome_state = 'accepted', "
            "    accepted_by = ?, "
            "    acceptance_timestamp = ?, "
            "    acceptance_criteria_id = ?, "
            "    accepted_outcome_id = ?, "
            "    accepted_input_tokens = COALESCE(?, attempted_input_tokens), "
            "    accepted_output_tokens = COALESCE(?, attempted_output_tokens) "
            "WHERE inner_attempt_id = ? OR call_id = ?",
            (
                acceptor,
                ts,
                criteria,
                outcome_id,
                accepted_input_tokens,
                accepted_output_tokens,
                inner_attempt_id,
                inner_attempt_id,
            ),
        )
        con.commit()
        if cur.rowcount == 0:
            raise LookupError(f"ATTEMPT_NOT_FOUND: {inner_attempt_id!r}")
        return {
            "ok": True,
            "updated_rows": cur.rowcount,
            "accepted_by": acceptor,
            "acceptance_timestamp": ts,
            "acceptance_criteria_id": criteria,
            "accepted_outcome_id": outcome_id,
        }
    finally:
        con.close()


class FedAttributionCallback(CustomLogger):
    """Stamps model & caller lineage on every response; fails closed in strict mode."""

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        """Spend write with full attribution (single canonical writer of token_bank_spend)."""
        try:
            return write_spend_row(
                kwargs, response_obj, start_time=start_time, end_time=end_time
            )
        except Exception as e:  # noqa: BLE001 — bounded visibility; never report success on failure
            _warn(f"spend write failed: {type(e).__name__}: {e}")
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}
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
                "x-arifos-capability-id",
                "x-capability-id",
                "x-arifos-task-class",
                "x-task-class",
                "x-arifos-node-id",
                "x-origin-node",
                "x-arifos-client",
                "x-arifos-requested-model-group",
                "x-arifos-logical-request-id",
                "x-arifos-outer-attempt-id",
                "x-request-id",
                "x-arifos-tags",
                "x-litellm-tags",
                "x-caller-service",
                "x-service-name",
                "x-litellm-caller",
                "user-agent",
            )
            safe_hdrs = {k: hdrs[k] for k in safe_hdr_keys if k in hdrs}
            md_dicts = _metadata_dicts(data)
            trusted_actor = _trusted_metadata_identity(data, md_dicts)
            auth_actor, cred_id = _verified_credential_identity(data, md_dicts, user_api_key_dict)
            _remember_ctx(
                data,
                {
                    "headers": safe_hdrs,
                    "trusted_actor": trusted_actor,
                    "auth_actor": auth_actor,
                    "credential_id": cred_id,
                },
            )
        except Exception as e:  # noqa: BLE001 — bounded stderr visibility; never crash proxy
            _warn(f"pre-call capture failed: {e}")
        return data

    async def async_post_call_success_hook(self, data, user_api_key_dict, response):
        """Strict lane: withhold substituted or contradictory output before client delivery."""
        try:
            rec = attribution(data, response, user_api_key_dict=user_api_key_dict)
            _log(rec)
            _remember_rec(data, rec)
            if rec["integrity_mode"] != "strict":
                return response

            from litellm.proxy._types import ProxyException

            if rec["actor_verification_state"] == "CONTRADICTION":
                raise ProxyException(
                    message=(
                        f"ACTOR_IDENTITY_CONTRADICTION: {rec['actor_contradiction_detail']}; "
                        f"identity-strict lane refuses to release output."
                    ),
                    type="actor_identity_contradiction",
                    param=None,
                    code=403,
                )

            if rec["substituted"] is False:
                return response

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
        except Exception as e:  # noqa: BLE001 — bounded stderr visibility; never crash proxy
            _warn(f"header stamping failed: {e}")
            return {
                "x-arifos-attribution-status": "UNKNOWN",
                "x-arifos-model-substituted": "unknown",
            }


proxy_handler_instance = FedAttributionCallback()
