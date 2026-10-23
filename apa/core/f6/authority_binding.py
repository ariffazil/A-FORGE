"""F6 P0 — authority binding checked at EXECUTION time, to the last tool.

Implements F6 v0 execution-time boundary controls:
  - Binds every action to approved scope, resource, parameters, and duration.
  - Delegation can NEVER widen authority (child <= parent across rank, scope,
    actions, resources, parameter constraints, and time window, verified
    recursively along the full delegation chain).
  - Checked AT EXECUTION TIME right before the last tool executes (`check_binding`
    and `execute_bound`), not merely at planning time.
  - Handles revocation, expiry, replay (one-time nonce), parameter mutation after
    approval, and post-approval state changes (`state_guard`).
  - Uses existing `apa.core.revocation.RevocationMechanism` and SQLite; invents
    no custom cryptography and makes no claim that bearer tokens (e.g. Macaroons)
    are non-transferable without a proven holder-binding mechanism (held per
    spec §7 / C.5).

This is a control over SYSTEM behavior, never a score on a human.
"""

from __future__ import annotations

import contextlib
import fnmatch
import json
import os
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from apa.core.revocation import RevocationMechanism

SCHEMA = "apa.core.f6.authority_binding.v1"
DEFAULT_DB = Path("/root/A-FORGE-wt-f6/apa/state/f6_bindings.db")
MAX_DELEGATION_DEPTH = 8


class BindingVerdict:
    ALLOW = "ALLOW"
    REJECT_SCOPE = "REJECT_SCOPE"
    REJECT_RESOURCE = "REJECT_RESOURCE"
    REJECT_PARAM = "REJECT_PARAM"
    REJECT_EXPIRED = "REJECT_EXPIRED"
    REJECT_REVOKED = "REJECT_REVOKED"
    REJECT_REPLAY = "REJECT_REPLAY"
    REJECT_STATE = "REJECT_STATE"
    REJECT_DELEGATION = "REJECT_DELEGATION"
    REJECT_BYPASS = "REJECT_BYPASS"
    UNKNOWN = "UNKNOWN"


_RANK = {
    "OBSERVE_ONLY": 0,
    "OPERATOR": 1,
    "LIMITED_MUTATE": 2,
    "FULL": 3,
    "SOVEREIGN": 4,
}


def _parse_utc(ts_str: str) -> datetime:
    dt = datetime.fromisoformat(ts_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@dataclass
class AuthorityBinding:
    """An approved authority grant: what may be done, to what, with what, until when."""

    binding_id: str
    actor_id: str
    authority: str  # OBSERVE_ONLY..SOVEREIGN
    scope: str  # connector or lane name
    allowed_actions: list[str]
    resource_patterns: list[str]
    param_constraints: dict[str, Any]
    not_before: str  # ISO UTC
    not_after: str  # ISO UTC
    nonce: Optional[str] = None  # replay protection (one-time use)
    parent_binding_id: Optional[str] = None  # delegation chain
    approved_params: Optional[dict[str, Any]] = None  # optional exact snapshot at approval
    allow_extra_params: bool = True
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def active_at(self, ts: Optional[datetime] = None) -> bool:
        now = ts or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        nb = _parse_utc(self.not_before)
        na = _parse_utc(self.not_after)
        return nb <= now <= na


@dataclass
class ActionRequest:
    """The action being attempted NOW (at execution time)."""

    binding_id: str
    actor_id: str
    action: str  # e.g. "write:issues"
    resource: str  # resource id, e.g. "repo/A-FORGE#123"
    params: dict[str, Any] = field(default_factory=dict)
    scope: Optional[str] = None
    _seen_nonce: bool = False


class BindingStore:
    """SQLite-backed binding store; integrates existing RevocationMechanism."""

    def __init__(
        self,
        db_path: Path = DEFAULT_DB,
        revocations: Optional[RevocationMechanism] = None,
    ) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.revocations = revocations or RevocationMechanism(
            self.db_path.parent / "revocations.db"
        )
        self._init_schema()
        try:
            os.chmod(self.db_path, 0o600)
        except OSError:
            pass

    def _connect(self) -> contextlib.AbstractContextManager[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return contextlib.closing(conn)

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """CREATE TABLE IF NOT EXISTS f6_bindings (
                        binding_id TEXT PRIMARY KEY,
                        payload_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                   )"""
            )
            conn.execute(
                """CREATE TABLE IF NOT EXISTS f6_nonce_used (
                        binding_id TEXT NOT NULL,
                        nonce TEXT NOT NULL,
                        used_at TEXT NOT NULL,
                        PRIMARY KEY (binding_id, nonce)
                   )"""
            )
            conn.commit()

    def save(self, binding: AuthorityBinding) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO f6_bindings VALUES (?,?,?)",
                (
                    binding.binding_id,
                    json.dumps(binding.to_dict(), default=str),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
            conn.commit()

    def get(self, binding_id: str) -> Optional[AuthorityBinding]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload_json FROM f6_bindings WHERE binding_id=?",
                (binding_id,),
            ).fetchone()
        if not row:
            return None
        d = json.loads(row["payload_json"])
        return AuthorityBinding(**d)

    def nonce_used(self, binding_id: str, nonce: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM f6_nonce_used WHERE binding_id=? AND nonce=?",
                (binding_id, nonce),
            ).fetchone()
            return row is not None

    def consume_nonce(self, binding_id: str, nonce: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO f6_nonce_used VALUES (?,?,?)",
                (
                    binding_id,
                    nonce,
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
            conn.commit()


def _param_ok(
    constraints: dict[str, Any],
    params: dict[str, Any],
    approved_params: Optional[dict[str, Any]] = None,
    allow_extra_params: bool = True,
) -> tuple[bool, str]:
    params = params or {}
    if approved_params is not None and params != approved_params:
        return False, "execution parameters differ from approved_params snapshot"

    if not allow_extra_params and constraints is not None:
        extra = set(params.keys()) - set(constraints.keys())
        if extra:
            return False, f"unapproved extra parameters present: {sorted(extra)}"

    for key, c in (constraints or {}).items():
        if not isinstance(c, dict):
            continue
        must_exist = (
            c.get("required", False)
            or ("const" in c)
            or ("in" in c and not c.get("optional", False))
        )
        if key not in params:
            if must_exist:
                return (
                    False,
                    f"required constrained param '{key}' missing at execution time",
                )
            continue
        v = params[key]
        if "const" in c and v != c["const"]:
            return False, f"param {key} != approved constant"
        if "in" in c and v not in c["in"]:
            return False, f"param {key} outside approved set"
        if "max_len" in c and isinstance(v, str) and len(v) > c["max_len"]:
            return False, f"param {key} exceeds approved length"
        if "min" in c and isinstance(v, (int, float)) and v < c["min"]:
            return False, f"param {key} below approved minimum"
        if "max" in c and isinstance(v, (int, float)) and v > c["max"]:
            return False, f"param {key} exceeds approved maximum"
    return True, ""


def _verify_delegation_chain(
    leaf: AuthorityBinding,
    request: ActionRequest,
    store: BindingStore,
    now: Optional[datetime],
) -> tuple[bool, str, str]:
    visited = {leaf.binding_id}
    curr = leaf
    depth = 0
    while curr.parent_binding_id:
        depth += 1
        if depth > MAX_DELEGATION_DEPTH:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                "delegation depth limit exceeded",
            )
        pid = curr.parent_binding_id
        if pid in visited:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                "cycle detected in delegation chain",
            )
        visited.add(pid)

        parent = store.get(pid)
        if parent is None:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                f"parent binding '{pid}' absent — delegation chain unverifiable",
            )
        if store.revocations.is_revoked(parent.binding_id):
            return (
                False,
                BindingVerdict.REJECT_REVOKED,
                f"ancestor binding '{parent.binding_id}' revoked — delegation invalidated",
            )
        if not parent.active_at(now):
            return (
                False,
                BindingVerdict.REJECT_EXPIRED,
                f"ancestor binding '{parent.binding_id}' expired/inactive",
            )
        if _RANK.get(curr.authority, -1) > _RANK.get(parent.authority, -1):
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                f"delegated authority ({curr.authority}) exceeds parent ({parent.authority}) — widening is forbidden",
            )
        if curr.scope != parent.scope:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                f"delegated scope '{curr.scope}' widens/differs from parent scope '{parent.scope}'",
            )
        if not set(curr.allowed_actions or []).issubset(
            set(parent.allowed_actions or [])
        ):
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                "delegated allowed_actions widen parent allowed_actions — forbidden",
            )
        try:
            c_nb, c_na = _parse_utc(curr.not_before), _parse_utc(curr.not_after)
            p_nb, p_na = _parse_utc(parent.not_before), _parse_utc(parent.not_after)
            if c_nb < p_nb or c_na > p_na:
                return (
                    False,
                    BindingVerdict.REJECT_DELEGATION,
                    "delegated validity window extends beyond parent window — forbidden",
                )
        except Exception:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                "unparseable timestamps in delegation chain",
            )
        if not any(
            fnmatch.fnmatch(request.resource, p)
            for p in (parent.resource_patterns or [])
        ):
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                f"resource '{request.resource}' outside ancestor '{parent.binding_id}' resource patterns",
            )
        p_ok, p_why = _param_ok(
            parent.param_constraints,
            request.params or {},
            approved_params=parent.approved_params,
            allow_extra_params=parent.allow_extra_params,
        )
        if not p_ok:
            return (
                False,
                BindingVerdict.REJECT_DELEGATION,
                f"params violate ancestor '{parent.binding_id}' constraint: {p_why}",
            )
        curr = parent

    return True, BindingVerdict.ALLOW, ""


def check_binding(
    request: ActionRequest,
    store: BindingStore,
    state_guard: Optional[Any] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Check authority AT EXECUTION TIME. Returns contract-consistent decision."""
    out: dict[str, Any] = {
        "schema": SCHEMA,
        "decision": BindingVerdict.UNKNOWN,
        "reason": "",
        "checked_at_execution_time": True,
        "request": {
            "binding_id": getattr(request, "binding_id", ""),
            "action": getattr(request, "action", ""),
            "resource": getattr(request, "resource", ""),
        },
    }
    if request is None or not getattr(request, "binding_id", ""):
        out["decision"] = BindingVerdict.REJECT_BYPASS
        out["reason"] = "missing ActionRequest or binding_id at execution boundary"
        return out

    b = store.get(request.binding_id)
    if b is None:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = "no approved binding with this id — fail-closed"
        return out

    if request.actor_id != b.actor_id:
        out["decision"] = BindingVerdict.REJECT_DELEGATION
        out["reason"] = (
            "actor does not match binding owner — delegation cannot widen authority"
        )
        return out

    if _RANK.get(b.authority, -1) < 0:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = f"unrecognized authority rank: {b.authority!r}"
        return out

    if b.parent_binding_id:
        del_ok, del_verdict, del_reason = _verify_delegation_chain(
            b, request, store, now
        )
        if not del_ok:
            out["decision"] = del_verdict
            out["reason"] = del_reason
            return out

    try:
        if not b.active_at(now):
            out["decision"] = BindingVerdict.REJECT_EXPIRED
            out["reason"] = f"binding inactive outside [{b.not_before}, {b.not_after}]"
            return out
    except Exception as exc:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = f"binding timestamp parse error: {exc}"
        return out

    if store.revocations.is_revoked(b.binding_id):
        out["decision"] = BindingVerdict.REJECT_REVOKED
        out["reason"] = "binding revoked"
        return out

    if b.nonce:
        if request._seen_nonce or store.nonce_used(b.binding_id, b.nonce):
            out["decision"] = BindingVerdict.REJECT_REPLAY
            out["reason"] = "nonce already consumed — replay rejected"
            return out

    if request.scope is not None and request.scope != b.scope:
        out["decision"] = BindingVerdict.REJECT_SCOPE
        out["reason"] = (
            f"requested scope {request.scope!r} != approved scope {b.scope!r}"
        )
        return out
    if request.action.split(":")[0] == "use" and b.scope != request.resource:
        out["decision"] = BindingVerdict.REJECT_SCOPE
        out["reason"] = f"resource {request.resource} outside binding scope {b.scope}"
        return out

    if request.action not in (b.allowed_actions or []):
        out["decision"] = BindingVerdict.REJECT_SCOPE
        out["reason"] = (
            f"action {request.action} not in approved actions {b.allowed_actions}"
        )
        return out

    if not any(
        fnmatch.fnmatch(request.resource, p) for p in (b.resource_patterns or [])
    ):
        out["decision"] = BindingVerdict.REJECT_RESOURCE
        out["reason"] = f"resource {request.resource} matches no approved pattern"
        return out

    ok, why = _param_ok(
        b.param_constraints,
        request.params or {},
        approved_params=b.approved_params,
        allow_extra_params=b.allow_extra_params,
    )
    if not ok:
        out["decision"] = BindingVerdict.REJECT_PARAM
        out["reason"] = why
        return out

    if state_guard is None:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = (
            "no state guard configured — cannot confirm state unchanged; fail-closed"
        )
        return out
    try:
        ok, why = state_guard(request, b)
    except Exception as exc:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = f"state guard error: {exc}"
        return out
    if not ok:
        out["decision"] = BindingVerdict.REJECT_STATE
        out["reason"] = why or "relevant state changed since approval"
        return out

    if b.nonce:
        store.consume_nonce(b.binding_id, b.nonce)

    out["decision"] = BindingVerdict.ALLOW
    out["reason"] = (
        "all checks passed at execution time "
        "(scope/resource/params/duration/revocation/replay/delegation/state)"
    )
    return out


def execute_bound(
    request: Optional[ActionRequest],
    store: BindingStore,
    tool_fn: Callable[[ActionRequest], Any],
    state_guard: Optional[Any] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Last-mile execution wrapper: enforces `check_binding` immediately before `tool_fn`."""
    if request is None:
        return {
            "schema": SCHEMA,
            "decision": BindingVerdict.REJECT_BYPASS,
            "executed": False,
            "reason": "bypass attempt blocked: missing ActionRequest",
            "tool_output": None,
        }
    verdict = check_binding(request, store, state_guard=state_guard, now=now)
    if verdict["decision"] != BindingVerdict.ALLOW:
        return {
            "schema": SCHEMA,
            "decision": verdict["decision"],
            "executed": False,
            "reason": verdict["reason"],
            "tool_output": None,
        }
    output = tool_fn(request)
    return {
        "schema": SCHEMA,
        "decision": BindingVerdict.ALLOW,
        "executed": True,
        "reason": verdict["reason"],
        "tool_output": output,
    }
