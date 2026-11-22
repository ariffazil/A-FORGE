#!/usr/bin/env python3
"""PR-FED-3: Observability and Front-Door Hygiene module.

Implements four non-destructive observability & admission-control primitives
for ARIFOS::FED-ZEN-UPGRADE-PROGRAM::2026-11-22:

  - Lane A: Langfuse-to-LiteLLM misrouting guard & non-mutating env remediation
  - Lane B: Liveliness poll ownership inventory validator
  - Lane C: Admission-gated `fed_contrast_zen` route comparator
  - Lane D: `mcp-compressor` process ownership classifier (observability-only)
  - Plus strict HTTP access-log parser with ephemeral-port negative controls

This module NEVER mutates live `/root/.secrets`, HAProxy configs, or systemd
units, and NEVER terminates any `mcp-compressor` process.
"""

from __future__ import annotations

import difflib
import re
from typing import Any, Callable, Iterable, Mapping, Sequence
from urllib.parse import urlparse


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LITELLM_FRONT_DOOR_HOSTS = frozenset(
    {"localhost", "127.0.0.1", "::1", "0.0.0.0", "100.64.0.2", "100.64.0.5"}
)

INADMISSIBLE_STATES = frozenset(
    {"RATE_LIMITED", "QUOTA_EXHAUSTED", "AUTH_FAIL", "DEAD", "POLICY_INELIGIBLE"}
)

REQUIRED_POLLER_FIELDS = (
    "name",
    "owner",
    "interval_s",
    "timeout_s",
    "purpose",
    "consumer",
    "duplication",
    "safe_reduced_cadence_s",
)

MCP_CLASSIFICATIONS = frozenset(
    {"ACTIVE", "IDLE_EXPECTED", "ORPHAN", "DUPLICATE", "UNKNOWN"}
)

LANGFUSE_PATHS = ("/api/public/health", "/api/public/ingestion")

_HTTP_LOG_RE = re.compile(
    r'(?P<ip>(?:\d{1,3}\.){3}\d{1,3}|\[?[0-9a-fA-F:]+\]?):(?P<port>\d+)\s+-\s+'
    r'"(?P<method>[A-Z]+)\s+(?P<path>\S+)\s+HTTP/(?P<http_ver>\d\.\d)"\s+'
    r'(?P<status>\d{3})\b'
)

_SECRET_ENV_KEY_RE = re.compile(
    r"(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|BEARER|CREDENTIAL)", re.IGNORECASE
)

_ENV_ASSIGN_RE = re.compile(
    r"^(?P<export>export\s+)?(?P<key>[A-Za-z_][A-Za-z0-9_]*)=(?P<val>.*)$"
)


# ---------------------------------------------------------------------------
# Lane A: Langfuse Misrouting Guard & Remediation
# ---------------------------------------------------------------------------


def _parse_endpoint(raw_url: str) -> tuple[str | None, int | None]:
    """Extract normalized (hostname, port) from a URL string."""
    cleaned = raw_url.strip().strip('"').strip("'")
    if not cleaned:
        return None, None
    if "://" not in cleaned:
        cleaned = f"http://{cleaned}"
    parsed = urlparse(cleaned)
    host = parsed.hostname.lower() if parsed.hostname else None
    port = parsed.port
    if port is None and parsed.scheme in ("http", "https"):
        port = 80 if parsed.scheme == "http" else 443
    return host, port


def audit_langfuse_routing(
    env_map: Mapping[str, str | None],
    litellm_ports: Sequence[int] = (4000, 4013),
    verified_langfuse_endpoints: Sequence[str] | None = None,
    sender: str = "langfuse_sdk_clients",
) -> dict[str, Any]:
    """Detect Langfuse SDK URLs misrouted to the LiteLLM front-door.

    Never echoes secret values. Never recommends log suppression to hide 404s;
    emits a safe disable/repoint config patch instead.
    """
    tracing_flag = (env_map.get("LANGFUSE_TRACING_ENABLED") or "").strip().lower()
    raw_base = (env_map.get("LANGFUSE_BASE_URL") or "").strip()
    raw_host = (env_map.get("LANGFUSE_HOST") or "").strip()
    configured_url = raw_base or raw_host

    has_creds = bool(
        (env_map.get("LANGFUSE_PUBLIC_KEY") or "").strip()
        or (env_map.get("LANGFUSE_SECRET_KEY") or "").strip()
    )

    verified_set = {
        u.strip().rstrip("/") for u in (verified_langfuse_endpoints or ()) if u.strip()
    }

    if not configured_url:
        status = "DISABLED" if tracing_flag in ("false", "0", "no", "off") else "UNCONFIGURED"
        return {
            "misrouted": False,
            "status": status,
            "sender": sender,
            "expected_receiver": "langfuse_server",
            "actual_receiver": None,
            "actual_host": None,
            "actual_port": None,
            "retry_behavior": "none",
            "secret_exposure_risk": "NONE",
            "log_suppression_forbidden": True,
            "recommended_patch": {},
        }

    host, port = _parse_endpoint(configured_url)
    litellm_port_set = set(litellm_ports)
    is_litellm_misroute = (
        port in litellm_port_set
        and (host in LITELLM_FRONT_DOOR_HOSTS or host is None)
    )

    if is_litellm_misroute:
        if verified_set:
            target = sorted(verified_set)[0]
            patch: dict[str, str | None] = {
                "LANGFUSE_BASE_URL": target,
                "LANGFUSE_HOST": None,
            }
        else:
            patch = {
                "LANGFUSE_TRACING_ENABLED": "false",
                "LANGFUSE_BASE_URL": None,
                "LANGFUSE_HOST": None,
            }

        return {
            "misrouted": True,
            "status": "MISROUTED_TO_LITELLM",
            "sender": sender,
            "expected_receiver": "langfuse_server",
            "actual_receiver": "litellm_front_door",
            "actual_host": host,
            "actual_port": port,
            "retry_behavior": "periodic_health_and_ingestion_retry_404_loop",
            "secret_exposure_risk": (
                "HIGH_CREDENTIALS_SENT_TO_WRONG_RECEIVER"
                if has_creds
                else "LOW_NO_CREDENTIALS_IN_ENV"
            ),
            "log_suppression_forbidden": True,
            "recommended_patch": patch,
        }

    norm_url = configured_url.rstrip("/")
    if norm_url in verified_set:
        return {
            "misrouted": False,
            "status": "VERIFIED_LANGFUSE",
            "sender": sender,
            "expected_receiver": "langfuse_server",
            "actual_receiver": "langfuse_server",
            "actual_host": host,
            "actual_port": port,
            "retry_behavior": "normal_sdk_batch_flush",
            "secret_exposure_risk": "NONE",
            "log_suppression_forbidden": True,
            "recommended_patch": {},
        }

    return {
        "misrouted": False,
        "status": "UNVERIFIED_ENDPOINT",
        "sender": sender,
        "expected_receiver": "langfuse_server",
        "actual_receiver": "unverified_external_or_local",
        "actual_host": host,
        "actual_port": port,
        "retry_behavior": "unknown_verify_endpoint_before_enabling",
        "secret_exposure_risk": (
            "MEDIUM_CREDENTIALS_SENT_TO_UNVERIFIED_ENDPOINT"
            if has_creds
            else "LOW_NO_CREDENTIALS_IN_ENV"
        ),
        "log_suppression_forbidden": True,
        "recommended_patch": {},
    }


def apply_langfuse_remediation_to_env(
    env_map: Mapping[str, str],
    litellm_ports: Sequence[int] = (4000, 4013),
    verified_langfuse_url: str | None = None,
) -> dict[str, str]:
    """Return a NEW remediated copy of `env_map` without mutating input."""
    updated = dict(env_map)
    verified = (verified_langfuse_url,) if verified_langfuse_url else None
    audit = audit_langfuse_routing(
        updated,
        litellm_ports=litellm_ports,
        verified_langfuse_endpoints=verified,
    )
    if not audit["misrouted"]:
        return updated

    for key, val in audit["recommended_patch"].items():
        if val is None:
            updated.pop(key, None)
        else:
            updated[key] = val
    return updated


def _redact_env_line(line: str) -> str:
    """Redact secret values in env lines so diffs never leak credentials."""
    m = _ENV_ASSIGN_RE.match(line.rstrip("\n"))
    if not m:
        return line
    key = m.group("key")
    if _SECRET_ENV_KEY_RE.search(key):
        prefix = m.group("export") or ""
        nl = "\n" if line.endswith("\n") else ""
        return f"{prefix}{key}=<REDACTED>{nl}"
    return line


def generate_env_remediation_diff(
    file_path: str,
    lines: Sequence[str],
    litellm_ports: Sequence[int] = (4000, 4013),
    verified_langfuse_url: str | None = None,
) -> dict[str, Any]:
    """Generate a non-mutating unified diff for an env file with Langfuse misrouting.

    Does NOT write to disk. Redacts any secret-bearing lines before diffing.
    """
    redacted_before = [_redact_env_line(ln) for ln in lines]
    after: list[str] = []
    changed = False
    has_tracing_enabled_line = False
    litellm_port_set = set(litellm_ports)

    for orig, safe_line in zip(lines, redacted_before):
        m = _ENV_ASSIGN_RE.match(orig.rstrip("\n"))
        if not m:
            after.append(safe_line)
            continue

        prefix = m.group("export") or ""
        key = m.group("key")
        val = m.group("val")

        if key == "LANGFUSE_TRACING_ENABLED":
            has_tracing_enabled_line = True
            if verified_langfuse_url is None:
                after.append(f"{prefix}LANGFUSE_TRACING_ENABLED=false\n")
                if orig.rstrip("\n") != f"{prefix}LANGFUSE_TRACING_ENABLED=false":
                    changed = True
                continue

        if key in ("LANGFUSE_BASE_URL", "LANGFUSE_HOST"):
            host, port = _parse_endpoint(val)
            if port in litellm_port_set and (
                host in LITELLM_FRONT_DOOR_HOSTS or host is None
            ):
                changed = True
                if verified_langfuse_url:
                    after.append(f"{prefix}{key}={verified_langfuse_url}\n")
                else:
                    after.append(
                        f"# [PR-FED-3 disabled misrouted LiteLLM URL] {safe_line}"
                    )
                continue

        after.append(safe_line)

    if changed and verified_langfuse_url is None and not has_tracing_enabled_line:
        after.append("LANGFUSE_TRACING_ENABLED=false\n")

    diff_text = "".join(
        difflib.unified_diff(
            redacted_before,
            after,
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
        )
    )
    return {
        "file_path": file_path,
        "changed": changed,
        "diff": diff_text,
        "mutated_disk": False,
    }


# ---------------------------------------------------------------------------
# Lane B: Liveliness Poll Ownership Inventory & Validator
# ---------------------------------------------------------------------------


def _is_named_owner(owner: Any) -> bool:
    if not isinstance(owner, str):
        return False
    cleaned = owner.strip()
    return bool(cleaned) and cleaned.upper() != "UNKNOWN"


def validate_poller_ownership(
    pollers: Sequence[Mapping[str, Any]],
    proposed_changes: Mapping[str, int | float] | None = None,
) -> dict[str, Any]:
    """Validate that every poller and every cadence change has a named owner.

    Also flags duplicate polling of the same target endpoint.
    """
    errors: list[str] = []
    by_name: dict[str, Mapping[str, Any]] = {}
    by_target: dict[str, list[str]] = {}

    for idx, poller in enumerate(pollers):
        name = str(poller.get("name") or f"poller[{idx}]")
        for req in REQUIRED_POLLER_FIELDS:
            if req not in poller or poller[req] is None:
                errors.append(f"{name}: missing required field '{req}'")

        if not _is_named_owner(poller.get("owner")):
            errors.append(
                f"{name}: owner must be a non-empty named owner (got {poller.get('owner')!r})"
            )

        interval_s = poller.get("interval_s")
        safe_s = poller.get("safe_reduced_cadence_s")
        if isinstance(interval_s, (int, float)) and interval_s <= 0:
            errors.append(f"{name}: interval_s must be > 0")
        if isinstance(safe_s, (int, float)) and safe_s <= 0:
            errors.append(f"{name}: safe_reduced_cadence_s must be > 0")

        by_name[name] = poller
        target = poller.get("target")
        if isinstance(target, str) and target.strip():
            by_target.setdefault(target.strip(), []).append(name)

    if proposed_changes:
        for poller_name, new_interval in proposed_changes.items():
            if poller_name not in by_name:
                errors.append(
                    f"proposed change rejected: '{poller_name}' is not in ownership inventory"
                )
                continue
            poller = by_name[poller_name]
            if not _is_named_owner(poller.get("owner")):
                errors.append(
                    f"proposed change rejected: '{poller_name}' lacks a named owner"
                )
            if not isinstance(new_interval, (int, float)) or new_interval <= 0:
                errors.append(
                    f"proposed change rejected: '{poller_name}' new interval must be > 0"
                )

    duplicates = [
        {"target": tgt, "pollers": names, "count": len(names)}
        for tgt, names in sorted(by_target.items())
        if len(names) > 1
    ]

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "duplicates": duplicates,
        "validated_count": len(pollers),
    }


# ---------------------------------------------------------------------------
# Lane C: fed_contrast Admission-Gated Implementation
# ---------------------------------------------------------------------------


def _normalize_policy_result(raw: Any) -> tuple[bool, str | None]:
    if isinstance(raw, bool):
        return raw, None if raw else "POLICY_INELIGIBLE"
    if isinstance(raw, tuple) and len(raw) >= 1:
        ok = bool(raw[0])
        reason = str(raw[1]) if len(raw) > 1 and raw[1] else (None if ok else "POLICY_INELIGIBLE")
        return ok, reason
    if isinstance(raw, Mapping):
        ok = bool(raw.get("eligible", True))
        reason = raw.get("reason")
        return ok, (str(reason) if reason else (None if ok else "POLICY_INELIGIBLE"))
    return True, None


def _evaluate_route_for_contrast(
    route: str,
    route_health_lookup: Callable[[str], Mapping[str, Any] | None],
    latency_lookup: Callable[[str], Mapping[str, Any] | None],
    balance_lookup: Callable[[str], Mapping[str, Any] | None],
    policy_check: Callable[[str], Any],
) -> dict[str, Any]:
    health = route_health_lookup(route) or {}
    latency = latency_lookup(route) or {}
    balance = balance_lookup(route) or {}
    policy_ok, policy_reason = _normalize_policy_result(policy_check(route))

    raw_health_state = str(health.get("state") or "UNKNOWN").upper()
    deployment_id = str(health.get("deployment_id") or route)

    exclusion_reasons: list[str] = []
    if not policy_ok:
        exclusion_reasons.append(policy_reason or "POLICY_INELIGIBLE")
    if raw_health_state in INADMISSIBLE_STATES:
        exclusion_reasons.append(f"route_health={raw_health_state}")

    effective_health_state = (
        "POLICY_INELIGIBLE"
        if (not policy_ok and raw_health_state not in INADMISSIBLE_STATES)
        else raw_health_state
    )

    if exclusion_reasons:
        admission_state = "INADMISSIBLE"
        exclusion_reason: str | None = "; ".join(exclusion_reasons)
    else:
        admission_state = "ADMITTED"
        exclusion_reason = None

    return {
        "route": route,
        "deployment_id": deployment_id,
        "admission_state": admission_state,
        "route_health_state": effective_health_state,
        "p50_latency_ms": latency.get("p50_ms"),
        "p95_latency_ms": latency.get("p95_ms"),
        "sample_count": latency.get("sample_count", 0),
        "sample_window": latency.get("sample_window", "UNKNOWN"),
        "last_sample_time": latency.get("last_sample_time"),
        "freshness": latency.get("freshness", "UNKNOWN"),
        "confidence": latency.get("confidence", "UNKNOWN"),
        "cost_evidence_class": balance.get("cost_evidence_class", "UNKNOWN"),
        "balance_freshness": balance.get("balance_freshness", "UNKNOWN"),
        "exclusion_reason": exclusion_reason,
    }


def fed_contrast_zen(
    route_a: str,
    route_b: str,
    route_health_lookup: Callable[[str], Mapping[str, Any] | None],
    latency_lookup: Callable[[str], Mapping[str, Any] | None],
    balance_lookup: Callable[[str], Mapping[str, Any] | None],
    policy_check: Callable[[str], Any],
) -> dict[str, Any]:
    """Admission-gated side-by-side route contrast.

    Eliminates inadmissible routes (RATE_LIMITED, QUOTA_EXHAUSTED, AUTH_FAIL,
    DEAD, POLICY_INELIGIBLE) BEFORE latency or cost optimization. An
    inadmissible route NEVER wins recommendation regardless of recorded latency.
    """
    eval_a = _evaluate_route_for_contrast(
        route_a, route_health_lookup, latency_lookup, balance_lookup, policy_check
    )
    eval_b = _evaluate_route_for_contrast(
        route_b, route_health_lookup, latency_lookup, balance_lookup, policy_check
    )

    admitted = [r for r in (eval_a, eval_b) if r["admission_state"] == "ADMITTED"]

    def _rank_key(item: dict[str, Any]) -> tuple[float, float, str]:
        p50 = item["p50_latency_ms"]
        p95 = item["p95_latency_ms"]
        return (
            float(p50) if p50 is not None else float("inf"),
            float(p95) if p95 is not None else float("inf"),
            item["deployment_id"],
        )

    admitted_sorted = sorted(admitted, key=_rank_key)
    ranking = [r["route"] for r in admitted_sorted]
    recommended = ranking[0] if ranking else None
    recommendation_state = "RECOMMENDED" if recommended else "NO_ADMITTED_ROUTE"

    return {
        "route_a": eval_a,
        "route_b": eval_b,
        "recommended": recommended,
        "recommendation_state": recommendation_state,
        "ranking": ranking,
        "excluded": [
            r["route"]
            for r in (eval_a, eval_b)
            if r["admission_state"] != "ADMITTED"
        ],
    }


# ---------------------------------------------------------------------------
# Lane D: mcp-compressor Ownership Classifier (Observability-Only)
# ---------------------------------------------------------------------------


def classify_mcp_compressor(
    proc_record: Mapping[str, Any],
    all_records: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Classify an `mcp-compressor` process for observability inventory ONLY.

    Categories: ACTIVE | IDLE_EXPECTED | ORPHAN | DUPLICATE | UNKNOWN.
    Never kills or signals any process.
    """
    pid = int(proc_record["pid"])
    ppid = int(proc_record.get("ppid", proc_record.get("parent", 0)))
    parent_alive = proc_record.get("parent_alive", True)
    owner_client = (proc_record.get("owner_client") or "").strip()
    target_server = (proc_record.get("target_server") or "").strip()
    start_time = proc_record.get("start_time")
    rss_kb = proc_record.get("rss_kb")
    active_connection = proc_record.get("active_connection")
    last_request = proc_record.get("last_request")
    in_flight_work = proc_record.get("in_flight_work")

    # Determine duplicate status within same (ppid, target_server)
    is_duplicate = bool(proc_record.get("is_duplicate", False))
    if not is_duplicate and all_records and owner_client and target_server:
        siblings = sorted(
            int(r["pid"])
            for r in all_records
            if int(r.get("ppid", r.get("parent", -1))) == ppid
            and (r.get("target_server") or "").strip() == target_server
        )
        if len(siblings) > 1 and pid != siblings[0]:
            is_duplicate = True

    if parent_alive is False or (ppid == 1 and owner_client not in ("1mcp", "systemd")):
        classification = "ORPHAN"
        reason = "Parent process is dead or reparented to init (PID 1)"
    elif (
        not owner_client
        or owner_client.upper() == "UNKNOWN"
        or not target_server
        or target_server.upper() == "UNKNOWN"
        or (active_connection is None and in_flight_work is None)
    ):
        classification = "UNKNOWN"
        reason = "Missing owner_client, target_server, or connection/work telemetry"
    elif is_duplicate and not in_flight_work:
        classification = "DUPLICATE"
        reason = f"Duplicate mcp-compressor for parent={ppid} target={target_server} with no in-flight work"
    elif in_flight_work or active_connection:
        classification = "ACTIVE"
        reason = "Active connection or in-flight MCP work observed"
    else:
        classification = "IDLE_EXPECTED"
        reason = "Owned by live client/daemon with no active in-flight work"

    return {
        "pid": pid,
        "parent": ppid,
        "owner_client": owner_client or "UNKNOWN",
        "target_server": target_server or "UNKNOWN",
        "start_time": start_time,
        "rss_kb": rss_kb,
        "active_connection": active_connection,
        "last_request": last_request,
        "in_flight_work": in_flight_work,
        "classification": classification,
        "reason": reason,
        "termination_action": "NONE_OBSERVABILITY_ONLY",
    }


# ---------------------------------------------------------------------------
# Strict LiteLLM HTTP Log Parser (with Ephemeral-Port Negative Controls)
# ---------------------------------------------------------------------------


def parse_litellm_http_log_line(line: str) -> dict[str, Any] | None:
    """Parse a LiteLLM/uvicorn HTTP access log line strictly.

    Extracts HTTP status ONLY from the anchored `HTTP/x.y" <status>` field,
    preventing ephemeral client ports such as `127.0.0.1:58402` or
    `100.64.0.5:42960` from being miscounted as HTTP 402 or 429 errors.
    """
    m = _HTTP_LOG_RE.search(line)
    if not m:
        return None

    status_code = int(m.group("status"))
    path = m.group("path")
    return {
        "client_ip": m.group("ip"),
        "client_port": int(m.group("port")),
        "method": m.group("method"),
        "path": path,
        "http_version": m.group("http_ver"),
        "status_code": status_code,
        "is_402": status_code == 402,
        "is_429": status_code == 429,
        "is_liveliness": path == "/health/liveliness",
        "is_langfuse_404": status_code == 404 and path in LANGFUSE_PATHS,
    }


def summarize_litellm_logs(lines: Iterable[str]) -> dict[str, Any]:
    """Summarize parsed HTTP requests from LiteLLM journal lines."""
    total_lines = 0
    parsed_count = 0
    liveliness_polls = 0
    langfuse_404s = 0
    status_402_count = 0
    status_429_count = 0

    for line in lines:
        total_lines += 1
        rec = parse_litellm_http_log_line(line)
        if rec is None:
            continue
        parsed_count += 1
        if rec["is_liveliness"]:
            liveliness_polls += 1
        if rec["is_langfuse_404"]:
            langfuse_404s += 1
        if rec["is_402"]:
            status_402_count += 1
        if rec["is_429"]:
            status_429_count += 1

    return {
        "total_lines": total_lines,
        "http_requests_parsed": parsed_count,
        "liveliness_polls": liveliness_polls,
        "liveliness_share": (
            round(liveliness_polls / parsed_count, 6) if parsed_count else 0.0
        ),
        "langfuse_404s": langfuse_404s,
        "status_402_count": status_402_count,
        "status_429_count": status_429_count,
    }
