#!/usr/bin/env python3
"""FED Attribution Client — arifos.fed-attribution.v1.

Purpose
-------
Make every first-party inference call attributable at the caller edge, so the
FED attribution callback can persist actor → task → route → provider lineage
without inspecting prompt content.

This module is stdlib-only and never stores secrets, prompts or responses.

Contract
--------
Every request carries, at minimum:

    actor_id      who is acting                (required for first-party)
    client        harness name/version         (e.g. opencode/2.1)
    origin_node   machine where the call began (kvm8 | kvm4 | kvm2 | ...)
    session_id    session/thread identity
    task_id       task identity
    turn_id       turn identity
    purpose       coarse intent class
    trace_id      32-hex correlation id
    requested_model_group

Two transmission lanes are supported, because not every gateway preserves
headers:

    1. HTTP headers   x-arifos-* (preferred)
    2. Body metadata  {"metadata": {...}} (LiteLLM forwards this to callbacks)

The receiving gateway stamps entry_gateway itself. Callers must NOT claim an
entry gateway they did not enter through.

Usage
-----
    from fed_attribution_client import Attribution, post_chat

    attr = Attribution.from_env(actor_id="opencode", client="opencode/2.1",
                                purpose="interactive")
    result = post_chat("http://127.0.0.1:4000/v1", api_key, "agi-333",
                       [{"role": "user", "content": "..."}], attr)

DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, MutableMapping, Sequence

CONTRACT = "arifos.fed-attribution.v1"
MAX_FIELD_LEN = 128

# Field -> canonical HTTP header. Keep in sync with
# fed_attribution_callback.resolve_caller_identity().
HEADER_NAMES = {
    "actor_id": "x-arifos-actor-id",
    "client": "x-arifos-client",
    "origin_node": "x-arifos-node-id",
    "session_id": "x-arifos-session-id",
    "task_id": "x-arifos-task-id",
    "turn_id": "x-arifos-turn-id",
    "purpose": "x-arifos-purpose",
    "trace_id": "x-arifos-trace-id",
    "requested_model_group": "x-arifos-requested-model-group",
    "contract": "x-arifos-attribution-contract",
}

# Metadata keys the callback reads at the TOP LEVEL of a metadata dict.
METADATA_KEYS = (
    "actor_id",
    "session_id",
    "task_id",
    "turn_id",
    "purpose",
    "trace_id",
    "requested_model_group",
    "origin_node",
    "client",
    "attribution_contract",
)

_TRACE_RE = re.compile(r"^[0-9a-f]{32}$")
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._:@+\-]{0,127}$")
_TOKEN_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@+\-/]{0,127}$")
_PURPOSE_RE = re.compile(r"^[a-z0-9][a-z0-9._:\-]{0,63}$")

_DEFAULT_REGISTRY = (
    Path(__file__).resolve().parent.parent / "deploy" / "fed" / "nodes.json"
)
_LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1", "0.0.0.0"}


# ---------------------------------------------------------------------------
# Registry + node resolution
# ---------------------------------------------------------------------------


def load_registry(path: str | os.PathLike[str] | None = None) -> dict:
    """Load the node registry. Env override: FED_NODES_REGISTRY."""
    chosen = Path(path or os.environ.get("FED_NODES_REGISTRY") or _DEFAULT_REGISTRY)
    with chosen.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("contract") != CONTRACT:
        raise ValueError(
            f"registry contract mismatch: {data.get('contract')!r} != {CONTRACT!r}"
        )
    return data


def _normalise_node(value: str) -> str:
    return re.sub(r"[^a-z0-9\-]", "", (value or "").strip().lower())[:32]


def resolve_origin_node(
    explicit: str | None = None, registry: dict | None = None
) -> str:
    """Resolve the machine that originates the request.

    Precedence: explicit → ARIFOS_NODE_ID → hostname match → "unknown".
    """
    if explicit:
        return _normalise_node(explicit)
    env = os.environ.get("ARIFOS_NODE_ID")
    if env:
        return _normalise_node(env)
    reg = registry or load_registry()
    host = socket.gethostname().strip().lower()
    for node, meta in (reg.get("nodes") or {}).items():
        for candidate in meta.get("hostnames") or []:
            c = str(candidate).lower()
            if host == c or host.startswith(c + "-") or host.startswith(c):
                return _normalise_node(node)
    return "unknown"


def _split_host_port(url: str) -> tuple[str, int]:
    raw = (url or "").strip()
    if "://" not in raw:
        raw = "http://" + raw
    scheme, _, rest = raw.partition("://")
    hostport = rest.split("/", 1)[0]
    if hostport.startswith("["):  # ipv6
        host, _, tail = hostport.partition("]")
        host = host.lstrip("[")
        port = (
            int(tail.lstrip(":"))
            if tail.lstrip(":").isdigit()
            else (443 if scheme == "https" else 80)
        )
        return host, port
    if ":" in hostport:
        host, _, port_s = hostport.rpartition(":")
        if port_s.isdigit():
            return host, int(port_s)
    return hostport, (443 if scheme == "https" else 80)


def gateway_id_for_url(
    base_url: str,
    origin_node: str | None = None,
    registry: dict | None = None,
) -> str:
    """Return the gateway id request will physically enter.

    The server stamps the authoritative value; this helper exists so probes and
    tests can assert topology without guessing.
    """
    env = os.environ.get("FED_ENTRY_GATEWAY")
    if env:
        return env.strip()
    reg = registry or load_registry()
    host, port = _split_host_port(base_url)
    origin = (
        _normalise_node(origin_node)
        if origin_node
        else resolve_origin_node(registry=reg)
    )

    # Exact listen match (remote front door).
    for node, meta in (reg.get("nodes") or {}).items():
        inf = meta.get("inference") or {}
        for listen in inf.get("listen") or []:
            try:
                l_host, l_port = _split_host_port("http://" + str(listen))
            except Exception:
                continue
            if l_port == port and l_host == host and l_host not in _LOCAL_HOSTS:
                return meta.get("loopback_gateway") or f"litellm_{node}_{port}"

    # Loopback: origin node's own (or tunnel target's) gateway.
    if host in _LOCAL_HOSTS:
        meta = (reg.get("nodes") or {}).get(origin) or {}
        gid = meta.get("loopback_gateway")
        if gid:
            return str(gid)
        return f"litellm_{origin}_{port}"

    return "other"


# ---------------------------------------------------------------------------
# Identity object
# ---------------------------------------------------------------------------


def generate_trace_id() -> str:
    return secrets.token_hex(16)


def trace_id_for(*parts: Any) -> str:
    """Deterministic 32-hex trace id — used for replay tests and idempotent probes."""
    h = hashlib.sha256()
    for p in parts:
        h.update(str(p).encode("utf-8", "replace"))
        h.update(b"\x1f")
    return h.hexdigest()[:32]


def _clean_token(value: Any, field: str, *, required: bool = False) -> str:
    v = "" if value is None else str(value).strip()
    if "\r" in v or "\n" in v or "\x00" in v:
        raise ValueError(f"{field}: control characters are forbidden")
    if len(v) > MAX_FIELD_LEN:
        raise ValueError(f"{field}: exceeds {MAX_FIELD_LEN} chars")
    if required and not v:
        raise ValueError(f"{field}: required")
    if v and not _TOKEN_RE.match(v):
        raise ValueError(f"{field}: must match {_TOKEN_RE.pattern}")
    return v


def _clean_actor(value: Any) -> str:
    v = "" if value is None else str(value).strip().lower()
    if not v:
        raise ValueError("actor_id: required")
    if not _SLUG_RE.match(v):
        raise ValueError(f"actor_id: must match {_SLUG_RE.pattern}")
    return v


def _clean_purpose(value: Any) -> str:
    v = "" if value is None else str(value).strip().lower()
    if not v:
        raise ValueError("purpose: required")
    if not _PURPOSE_RE.match(v):
        raise ValueError(f"purpose: must match {_PURPOSE_RE.pattern}")
    return v


def _clean_trace(value: Any) -> str:
    v = "" if value is None else str(value).strip().lower()
    if not v:
        return generate_trace_id()
    if not _TRACE_RE.match(v):
        raise ValueError("trace_id: must be 32 lowercase hex characters")
    return v


@dataclass(frozen=True)
class Attribution:
    """Validated attribution context for one request."""

    actor_id: str
    client: str = "unknown"
    origin_node: str = ""
    session_id: str = ""
    task_id: str = ""
    turn_id: str = ""
    purpose: str = "unspecified"
    trace_id: str = ""
    requested_model_group: str = ""
    contract: str = CONTRACT

    def __post_init__(self) -> None:
        object.__setattr__(self, "actor_id", _clean_actor(self.actor_id))
        object.__setattr__(
            self,
            "client",
            _clean_token(self.client or "unknown", "client", required=True),
        )
        object.__setattr__(
            self,
            "origin_node",
            _normalise_node(self.origin_node or resolve_origin_node()),
        )
        object.__setattr__(
            self, "session_id", _clean_token(self.session_id, "session_id")
        )
        object.__setattr__(self, "task_id", _clean_token(self.task_id, "task_id"))
        object.__setattr__(self, "turn_id", _clean_token(self.turn_id, "turn_id"))
        object.__setattr__(self, "purpose", _clean_purpose(self.purpose))
        object.__setattr__(self, "trace_id", _clean_trace(self.trace_id))
        object.__setattr__(
            self,
            "requested_model_group",
            _clean_token(self.requested_model_group, "requested_model_group"),
        )
        if self.contract != CONTRACT:
            raise ValueError(f"contract must be {CONTRACT!r}")

    # -- constructors -------------------------------------------------------
    @classmethod
    def from_env(
        cls,
        actor_id: str,
        client: str,
        *,
        purpose: str = "unspecified",
        session_id: str | None = None,
        task_id: str | None = None,
        turn_id: str | None = None,
        trace_id: str | None = None,
        origin_node: str | None = None,
        requested_model_group: str = "",
    ) -> "Attribution":
        return cls(
            actor_id=actor_id,
            client=client,
            purpose=purpose,
            session_id=session_id
            if session_id is not None
            else os.environ.get("ARIFOS_SESSION_ID", ""),
            task_id=task_id
            if task_id is not None
            else os.environ.get("ARIFOS_TASK_ID", ""),
            turn_id=turn_id
            if turn_id is not None
            else os.environ.get("ARIFOS_TURN_ID", ""),
            trace_id=trace_id
            if trace_id is not None
            else os.environ.get("ARIFOS_TRACE_ID", ""),
            origin_node=origin_node
            if origin_node is not None
            else os.environ.get("ARIFOS_NODE_ID", ""),
            requested_model_group=requested_model_group,
        )

    # -- serialisation ------------------------------------------------------
    def headers(self) -> dict[str, str]:
        return {
            HEADER_NAMES["actor_id"]: self.actor_id,
            HEADER_NAMES["client"]: self.client,
            HEADER_NAMES["origin_node"]: self.origin_node,
            HEADER_NAMES["session_id"]: self.session_id,
            HEADER_NAMES["task_id"]: self.task_id,
            HEADER_NAMES["turn_id"]: self.turn_id,
            HEADER_NAMES["purpose"]: self.purpose,
            HEADER_NAMES["trace_id"]: self.trace_id,
            HEADER_NAMES["requested_model_group"]: self.requested_model_group,
            HEADER_NAMES["contract"]: self.contract,
        }

    def metadata(self) -> dict[str, str]:
        return {
            "actor_id": self.actor_id,
            "session_id": self.session_id,
            "task_id": self.task_id,
            "turn_id": self.turn_id,
            "purpose": self.purpose,
            "trace_id": self.trace_id,
            "requested_model_group": self.requested_model_group,
            "origin_node": self.origin_node,
            "client": self.client,
            "attribution_contract": self.contract,
        }

    def apply(
        self,
        headers: Mapping[str, str] | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> tuple[dict[str, str], dict[str, Any]]:
        """Merge attribution into request headers/body without overwriting caller values."""
        out_headers: dict[str, str] = dict(headers or {})
        lowered = {k.lower() for k in out_headers}
        for k, v in self.headers().items():
            if k.lower() not in lowered:
                out_headers[k] = v

        out_body: dict[str, Any] = dict(body or {})
        existing = out_body.get("metadata")
        merged: dict[str, Any] = (
            dict(existing) if isinstance(existing, MutableMapping) else {}
        )
        for k, v in self.metadata().items():
            merged.setdefault(k, v)
        out_body["metadata"] = merged
        return out_headers, out_body


# ---------------------------------------------------------------------------
# Transport
# ---------------------------------------------------------------------------


def post_chat(
    base_url: str,
    api_key: str,
    model: str,
    messages: Sequence[Mapping[str, Any]],
    attribution: Attribution,
    *,
    max_tokens: int | None = None,
    timeout: float = 60.0,
    extra_headers: Mapping[str, str] | None = None,
    extra_body: Mapping[str, Any] | None = None,
) -> dict:
    """POST /chat/completions with attribution. Never logs secrets or prompt content."""
    if not api_key:
        raise ValueError("api_key: required")
    url = base_url.rstrip("/") + "/chat/completions"
    body: dict[str, Any] = {"model": model, "messages": list(messages)}
    if max_tokens is not None:
        body["max_tokens"] = int(max_tokens)
    if extra_body:
        body.update(extra_body)
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    if extra_headers:
        headers.update(extra_headers)
    headers, body = attribution.apply(headers, body)

    req = urllib.request.Request(
        url,
        data=json.dumps(body, separators=(",", ":")).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            status = resp.status
            resp_headers = {
                k.lower(): v
                for k, v in resp.headers.items()
                if k.lower()
                in {
                    "x-litellm-call-id",
                    "x-litellm-model-id",
                    "x-litellm-model-api-base",
                    "x-litellm-attempted-fallbacks",
                    "x-arifos-model-integrity",
                    "x-request-id",
                    "server",
                }
            }
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        return {
            "ok": False,
            "status": exc.code,
            "error": raw[:800],
            "attribution": attribution.metadata(),
            "response_headers": {},
        }
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    choices = payload.get("choices") or []
    message = (choices[0] or {}).get("message") if choices else {}
    return {
        "ok": status < 400,
        "status": status,
        "requested_model_group": model,
        "served_model": payload.get("model"),
        "content": (message or {}).get("content"),
        "finish_reason": (choices[0] or {}).get("finish_reason") if choices else None,
        "usage": payload.get("usage"),
        "attribution": attribution.metadata(),
        "response_headers": resp_headers,
    }


def is_valid_attribution(mapping: Mapping[str, Any]) -> tuple[bool, list[str]]:
    """Validate an attribution dict emitted by this module or an adapter."""
    errors: list[str] = []
    required = (
        "actor_id",
        "client",
        "origin_node",
        "purpose",
        "trace_id",
        "attribution_contract",
    )
    for key in required:
        if not str(mapping.get(key) or "").strip():
            errors.append(f"missing:{key}")
    actor = str(mapping.get("actor_id") or "")
    if actor and not _SLUG_RE.match(actor):
        errors.append("bad:actor_id")
    trace = str(mapping.get("trace_id") or "")
    if trace and not _TRACE_RE.match(trace):
        errors.append("bad:trace_id")
    if mapping.get("attribution_contract") not in (None, CONTRACT):
        errors.append("bad:contract")
    return (not errors, errors)


# ---------------------------------------------------------------------------
# CLI — emit the context a shell wrapper can inject
# ---------------------------------------------------------------------------


def _main(argv: Iterable[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(
        description="Emit FED attribution headers/metadata JSON"
    )
    ap.add_argument("--actor", required=True)
    ap.add_argument("--client", default="unknown")
    ap.add_argument("--purpose", default="unspecified")
    ap.add_argument("--session-id", default=None)
    ap.add_argument("--task-id", default=None)
    ap.add_argument("--turn-id", default=None)
    ap.add_argument("--trace-id", default=None)
    ap.add_argument("--node", default=None)
    ap.add_argument("--model-group", default="")
    ap.add_argument("--base-url", default="http://127.0.0.1:4000/v1")
    args = ap.parse_args(list(argv) if argv is not None else None)

    attr = Attribution.from_env(
        args.actor,
        args.client,
        purpose=args.purpose,
        session_id=args.session_id,
        task_id=args.task_id,
        turn_id=args.turn_id,
        trace_id=args.trace_id,
        origin_node=args.node,
        requested_model_group=args.model_group,
    )
    out = {
        "contract": CONTRACT,
        "entry_gateway_expected": gateway_id_for_url(args.base_url, attr.origin_node),
        "headers": attr.headers(),
        "metadata": attr.metadata(),
    }
    print(json.dumps(out, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
