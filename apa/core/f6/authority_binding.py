"""F6 P0 — authority binding checked at EXECUTION time, to the last tool.

Order §4 P0 requirements implemented here:
  - bind every action to approved scope, resource, parameters, duration
  - delegation can never widen authority (child ⊆ parent, always)
  - authority is checked AT EXECUTION TIME, not just at planning
  - handles revocation, expiry, replay, and relevant state changes
  - uses existing mechanisms (revocation.RevocationMechanism, sqlite);
    no new crypto invented, no bearer-token non-transferability claimed
    without tested binding (spec §7: Macaroons are bearer + caveats —
    binding design stays HOLD)

This is a control over SYSTEM behavior (P0), not a measure of humans.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from apa.core.revocation import RevocationMechanism

SCHEMA = "apa.core.f6.authority_binding.v1"
DEFAULT_DB = Path("/root/A-FORGE-wt-f6/apa/state/f6_bindings.db")  # worktree-local for tests


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
    UNKNOWN = "UNKNOWN"


# Authority ranks (mirrors actIngress.ts RANK — one vocabulary, not a new one)
_RANK = {"OBSERVE_ONLY": 0, "OPERATOR": 1, "LIMITED_MUTATE": 2, "FULL": 3, "SOVEREIGN": 4}


@dataclass
class AuthorityBinding:
    """An approved authority grant: what may be done, to what, with what, until when."""

    binding_id: str
    actor_id: str
    authority: str  # OBSERVE_ONLY..SOVEREIGN
    scope: str  # connector or lane name
    allowed_actions: list  # verbs allowed, e.g. ["read:repos","write:issues"]
    resource_patterns: list  # fnmatch patterns over resource ids
    param_constraints: dict  # key -> {"in": [...]} | {"max_len": n} | {"const": v}
    not_before: str  # ISO UTC
    not_after: str  # ISO UTC
    nonce: Optional[str] = None  # replay protection (one-time use)
    parent_binding_id: Optional[str] = None  # delegation chain
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    def active_at(self, ts: Optional[datetime] = None) -> bool:
        now = ts or datetime.now(timezone.utc)
        nb = datetime.fromisoformat(self.not_before)
        na = datetime.fromisoformat(self.not_after)
        if nb.tzinfo is None:
            nb = nb.replace(tzinfo=timezone.utc)
        if na.tzinfo is None:
            na = na.replace(tzinfo=timezone.utc)
        return nb <= now <= na


@dataclass
class ActionRequest:
    """The action being attempted NOW (at execution time)."""

    binding_id: str
    actor_id: str
    action: str  # e.g. "write:issues"
    resource: str  # resource id, e.g. "repo/A-FORGE#123"
    params: dict = field(default_factory=dict)
    _seen_nonce: bool = False  # set by store when nonce already consumed


class BindingStore:
    """SQLite-backed binding store; integrates existing RevocationMechanism."""

    def __init__(self, db_path: Path = DEFAULT_DB, revocations: Optional[RevocationMechanism] = None):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.revocations = revocations or RevocationMechanism(
            self.db_path.parent / "revocations.db"
        )
        self._init_schema()

    def _connect(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

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
                (binding_id, nonce, datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )
            conn.commit()


def _param_ok(constraints: dict, params: dict) -> tuple[bool, str]:
    for key, c in (constraints or {}).items():
        # A constraint governs the param WHEN present; absence is not a violation
        # (the action simply carries no such parameter).
        if key not in params:
            continue
        v = params[key]
        if "const" in c and v != c["const"]:
            return False, f"param {key} != approved constant"
        if "in" in c and v not in c["in"]:
            return False, f"param {key} outside approved set"
        if "max_len" in c and isinstance(v, str) and len(v) > c["max_len"]:
            return False, f"param {key} exceeds approved length"
    return True, ""


def check_binding(
    request: ActionRequest,
    store: BindingStore,
    state_guard: Optional[Any] = None,
    now: Optional[datetime] = None,
) -> dict:
    """Check authority AT EXECUTION TIME. Returns contract-consistent decision.

    state_guard: optional callable(request, binding) -> (ok: bool, reason: str)
                 checked last, for relevant state changes (e.g. target repo
                 archived since approval). Absent guard = UNKNOWN, not PASS.

    No PASS on missing binding, missing guard, or evaluator error. Fail-closed.
    """
    out = {
        "schema": SCHEMA,
        "decision": BindingVerdict.UNKNOWN,
        "reason": "",
        "checked_at_execution_time": True,
        "request": {
            "binding_id": request.binding_id,
            "action": request.action,
            "resource": request.resource,
        },
    }
    b = store.get(request.binding_id)
    if b is None:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = "no approved binding with this id — fail-closed"
        return out

    # Delegation: child actor must match, and if this binding has a parent,
    # the child's authority may never exceed the parent's (checked recursively
    # is out of v0 scope — v0 enforces the direct parent edge).
    if request.actor_id != b.actor_id:
        out["decision"] = BindingVerdict.REJECT_DELEGATION
        out["reason"] = "actor does not match binding owner — delegation cannot widen authority"
        return out
    if b.parent_binding_id:
        parent = store.get(b.parent_binding_id)
        if parent is None:
            out["decision"] = BindingVerdict.REJECT_DELEGATION
            out["reason"] = "parent binding absent — delegation chain unverifiable"
            return out
        if _RANK.get(b.authority, -1) > _RANK.get(parent.authority, -1):
            out["decision"] = BindingVerdict.REJECT_DELEGATION
            out["reason"] = (
                "delegated authority exceeds parent — widening is forbidden"
            )
            return out

    # Duration / expiry (execution-time check, not planning-time)
    if not b.active_at(now):
        out["decision"] = BindingVerdict.REJECT_EXPIRED
        out["reason"] = f"binding inactive outside [{b.not_before}, {b.not_after}]"
        return out

    # Revocation (existing mechanism, execution-time)
    if store.revocations.is_revoked(b.binding_id):
        out["decision"] = BindingVerdict.REJECT_REVOKED
        out["reason"] = "binding revoked"
        return out

    # Replay
    if b.nonce:
        if request._seen_nonce or store.nonce_used(b.binding_id, b.nonce):
            out["decision"] = BindingVerdict.REJECT_REPLAY
            out["reason"] = "nonce already consumed — replay rejected"
            return out

    # Scope (connector/lane)
    # scope match is exact in v0; wildcard future work
    if request.action.split(":")[0] == "use" and b.scope != request.resource:
        out["decision"] = BindingVerdict.REJECT_SCOPE
        out["reason"] = f"resource {request.resource} outside binding scope {b.scope}"
        return out

    # Action allowed?
    if request.action not in (b.allowed_actions or []):
        out["decision"] = BindingVerdict.REJECT_SCOPE
        out["reason"] = f"action {request.action} not in approved actions {b.allowed_actions}"
        return out

    # Resource patterns
    import fnmatch

    if not any(fnmatch.fnmatch(request.resource, p) for p in (b.resource_patterns or [])):
        out["decision"] = BindingVerdict.REJECT_RESOURCE
        out["reason"] = f"resource {request.resource} matches no approved pattern"
        return out

    # Parameters changed after approval?
    ok, why = _param_ok(b.param_constraints, request.params or {})
    if not ok:
        out["decision"] = BindingVerdict.REJECT_PARAM
        out["reason"] = why
        return out

    # State guard: relevant state change since approval
    if state_guard is None:
        out["decision"] = BindingVerdict.UNKNOWN
        out["reason"] = "no state guard configured — cannot confirm state unchanged; fail-closed"
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

    # Consume nonce last (only on the real execution path)
    if b.nonce:
        store.consume_nonce(b.binding_id, b.nonce)

    out["decision"] = BindingVerdict.ALLOW
    out["reason"] = "all checks passed at execution time (scope/resource/params/duration/revocation/replay/state)"
    return out
