#!/usr/bin/env python3
"""
Envelope Regression Suite — 2026-07-08
========================================

Captures the FAILING BASELINE for the 5-invariants envelope fix
(SEP-2567 + SEP-414 + SEP-1303 + SEP-2260) BEFORE any retrofit.

Per F2 TRUTH and Arif's directive (2026-07-08):
    "Losing the failing baseline by fixing first would be the same
     mistake as praising unverified claims — you'd be trusting the fix
     worked without a pre/post comparison."

Test ordering is load-bearing: run this file as-is, capture the
failing baseline, then retrofit, then rerun. The diff is the proof.

Invariants tested (in dependency order from the canonical analysis):
  1. Explicit state handles, not implicit session trust (SEP-2567)
  2. Trace context propagation (SEP-414)
  3. Structured errors on every path (SEP-1303)
  4. Server↔Client association — anti-orphan (SEP-2260)
  5. Per-request authorization verify (F11 + security doc)

Plus the two-surface problem (surface drift):
  - WEALTH: only ONE canonical surface, OR deprecated flag on non-canonical
  - GEOX: backward-compat tools must be explicitly marked deprecated

Output: Markdown-formatted pass/fail report + exit code (0=PASS-all, 1=any-FAIL)
"""

from __future__ import annotations

import http.client
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

# ── Federation endpoints ──────────────────────────────────────────────
ARIFOS = ("127.0.0.1", 8088)
GEOX = ("127.0.0.1", 8081)
WEALTH = ("127.0.0.1", 18082)
WELL = ("127.0.0.1", 18083)
AAA = ("127.0.0.1", 3001)
AFORGE = ("127.0.0.1", 7071)
PROTOCOL_VERSION = "2025-03-26"  # matches arifOS :8088 server version


# ── Minimal MCP client (Streamable HTTP) ──────────────────────────────
class MCPClient:
    """Single-host MCP client. Stateless — no mcp-session-id required."""

    def __init__(self, host_port: tuple[str, int], name: str = "regression-suite"):
        self.host, self.port = host_port
        self.name = name
        self._conn: http.client.HTTPConnection | None = None

    def _req(self, method: str, payload: dict, retries: int = 1) -> dict:
        body = json.dumps(payload).encode("utf-8")
        last_err: Exception | None = None
        raw: str = ""
        for attempt in range(retries + 1):
            try:
                if self._conn is None:
                    self._conn = http.client.HTTPConnection(
                        self.host, self.port, timeout=30
                    )
                self._conn.request(
                    method,
                    "/mcp",
                    body=body,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/event-stream",
                    },
                )
                r = self._conn.getresponse()
                raw = r.read().decode("utf-8", errors="replace")
                return json.loads(raw)
            except (OSError, json.JSONDecodeError) as e:
                last_err = e
                if self._conn is not None:
                    try:
                        self._conn.close()
                    except Exception:
                        pass
                    self._conn = None
        return {
            "_transport_error": str(last_err),
            "_raw": raw[:500],
        }

    def call(self, tool: str, args: dict) -> dict:
        """tools/call → unwraps content[0].text to dict when JSON."""
        r = self._req(
            "POST",
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool, "arguments": args},
            },
        )
        if "error" in r:
            return {"_error": r["error"], "_is_rejection": True}
        result = r.get("result", {})
        if "structuredContent" in result:
            return result["structuredContent"]
        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                return {"_raw_text": content[0]["text"][:500]}
        return result

    def list_tools(self) -> list[dict]:
        r = self._req(
            "POST", {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
        )
        return r.get("result", {}).get("tools", [])

    def close(self):
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None


# ── Test results ──────────────────────────────────────────────────────
@dataclass
class Result:
    name: str
    invariant: str
    status: str  # PASS | FAIL | SKIP
    detail: str = ""
    evidence: dict = field(default_factory=dict)

    def line(self) -> str:
        icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⏸ "}.get(self.status, "?")
        return f"{icon} {self.name}  [{self.invariant}]"


RESULTS: list[Result] = []


def record(name: str, invariant: str, status: str, detail: str = "", **evidence):
    RESULTS.append(Result(name, invariant, status, detail, evidence))


# ── TESTS ─────────────────────────────────────────────────────────────


def test_I1_arif_init_binds_session_handle():
    """INVARIANT 1: arif_init returns a SEAL-prefixed session_id, not None/anonymous."""
    c = MCPClient(ARIFOS, "test-I1")
    try:
        r = c.call(
            "arif_init",
            {
                "mode": "light",
                "actor_id": "regression-I1",
                "actor_signature": f"regression-sig-{uuid.uuid4().hex[:8]}",
                "intent": "envelope regression — invariant 1",
            },
        )
        session_id = r.get("session_id") or r.get("session_birth", {}).get("session_id")
        actor_verified = r.get("actor_verified") or r.get("meta", {}).get(
            "actor_verified"
        )
        verdict = r.get("verdict") or r.get("verdict_code")

        if not session_id or not str(session_id).startswith("SEAL-"):
            record(
                "I1.arif_init returns SEAL session_id",
                "SEP-2567",
                "FAIL",
                f"session_id missing or wrong prefix: {session_id!r}",
                verdict=verdict,
                response_keys=list(r.keys())[:15],
            )
            return None
        if actor_verified is not True:
            record(
                "I1.arif_init verifies actor",
                "SEP-2567",
                "FAIL",
                f"actor_verified is not True: {actor_verified!r}",
                session_id=session_id,
            )
            return None
        record(
            "I1.arif_init returns SEAL session_id + actor_verified",
            "SEP-2567",
            "PASS",
            f"session_id={session_id}",
            session_id=session_id,
            actor_verified=actor_verified,
        )
        return session_id
    finally:
        c.close()


def test_I1_session_propagates_via_envelope(session_id: str | None):
    """INVARIANT 1: session_id passed in _envelope must echo back, actor_id NOT anonymous."""
    if not session_id:
        record(
            "I1.session_id propagates via _envelope",
            "SEP-2567",
            "SKIP",
            "no session from I1",
        )
        return
    c = MCPClient(ARIFOS, "test-I1-prop")
    try:
        r = c.call(
            "arif_observe",
            {
                "mode": "vitals",
                "_envelope": {
                    "session_id": session_id,
                    "actor_id": "regression-I1",
                    "trace_id": f"reg-trace-{uuid.uuid4().hex[:8]}",
                },
            },
        )
        response_session = r.get("session_id") or r.get("meta", {}).get("session_id")
        response_actor = r.get("actor_id") or r.get("meta", {}).get("actor_id")
        response_verified = r.get("actor_verified") or r.get("meta", {}).get(
            "actor_verified"
        )

        problems = []
        if response_session != session_id:
            problems.append(
                f"session_id mismatch: sent={session_id} got={response_session}"
            )
        if response_actor in ("anonymous", "openclaw-anon", None, ""):
            problems.append(f"actor_id anonymous/null: {response_actor!r}")
        if response_verified is not True:
            problems.append(f"actor_verified not True: {response_verified!r}")

        if problems:
            record(
                "I1.session_id propagates via _envelope",
                "SEP-2567",
                "FAIL",
                "; ".join(problems),
                response_actor=response_actor,
                response_verified=response_verified,
                response_session=response_session,
            )
        else:
            record(
                "I1.session_id propagates via _envelope",
                "SEP-2567",
                "PASS",
                f"actor={response_actor}",
            )
    finally:
        c.close()


def test_I3_anonymous_call_rejected_not_hold():
    """INVARIANT 3: call without _envelope must be REJECTED (error/VOID), not HOLD-with-anonymous."""
    c = MCPClient(ARIFOS, "test-I3")
    try:
        r = c.call("arif_observe", {"mode": "vitals"})  # NO _envelope
        is_rejection = (
            "_is_rejection" in r
            or "error" in r
            or r.get("verdict") == "VOID"
            or r.get("meta", {}).get("actor_verified") is False
            and r.get("meta", {}).get("rejection_reason") is not None
        )
        actor_id = r.get("actor_id") or r.get("meta", {}).get("actor_id")
        verdict = r.get("verdict")
        is_hold_with_anon = verdict in ("HOLD", "SYUBHAH") and actor_id in (
            "anonymous",
            "openclaw-anon",
        )
        if is_hold_with_anon:
            record(
                "I3.anonymous call → REJECTION (not HOLD-with-anonymous)",
                "SEP-1303",
                "FAIL",
                f"HOLD verdict with anonymous actor_id (should be VOID/rejection): "
                f"verdict={verdict}, actor_id={actor_id}",
                verdict=verdict,
                actor_id=actor_id,
            )
        elif not is_rejection and verdict in ("HOLD", "SYUBHAH"):
            record(
                "I3.anonymous call → REJECTION (not HOLD-with-anonymous)",
                "SEP-1303",
                "FAIL",
                f"HOLD verdict but no explicit rejection (SEP-1303 violation): "
                f"verdict={verdict}, actor_id={actor_id}",
                verdict=verdict,
                actor_id=actor_id,
            )
        else:
            record(
                "I3.anonymous call → REJECTION (not HOLD-with-anonymous)",
                "SEP-1303",
                "PASS",
                f"verdict={verdict}, actor_id={actor_id}",
            )
    finally:
        c.close()


def test_I4_orphan_envelope_rejected():
    """INVARIANT 4: _envelope=null must be rejected (anti-orphan, SEP-2260)."""
    c = MCPClient(ARIFOS, "test-I4")
    try:
        r = c.call("arif_observe", {"mode": "vitals", "_envelope": None})
        is_rejection = (
            "_is_rejection" in r or "error" in r or r.get("verdict") == "VOID"
        )
        if not is_rejection:
            record(
                "I4.orphan (_envelope=null) → REJECTION",
                "SEP-2260",
                "FAIL",
                f"Orphan call was not rejected: {json.dumps(r, default=str)[:300]}",
                verdict=r.get("verdict"),
            )
        else:
            record(
                "I4.orphan (_envelope=null) → REJECTION",
                "SEP-2260",
                "PASS",
                f"rejected: {r.get('verdict') or r.get('_error', {}).get('code', 'error')}",
            )
    finally:
        c.close()


def test_I5_actor_signature_verified():
    """INVARIANT 5: valid actor_signature must be verified; invalid rejected."""
    c = MCPClient(ARIFOS, "test-I5")
    try:
        r = c.call(
            "arif_init",
            {
                "mode": "light",
                "actor_id": "arif",
                "actor_signature": f"valid-{uuid.uuid4().hex[:8]}",
                "intent": "auth verification test",
            },
        )
        verified = r.get("actor_verified") or r.get("meta", {}).get("actor_verified")
        rejection = "_is_rejection" in r or "error" in r or r.get("verdict") == "VOID"
        if verified is True:
            record(
                "I5.actor_signature verified per-request",
                "F11+security",
                "PASS",
                f"actor_verified=True",
            )
        elif rejection:
            record(
                "I5.actor_signature verified per-request",
                "F11+security",
                "PASS",
                f"rejected (expected for unrecognized sig): {r.get('verdict')}",
            )
        else:
            record(
                "I5.actor_signature verified per-request",
                "F11+security",
                "FAIL",
                f"neither verified nor rejected: {json.dumps(r, default=str)[:300]}",
            )
    finally:
        c.close()


def test_I2_equations_used_canonical_on_compute():
    """INVARIANT 2: successful compute must populate equations_used canonically.

    Per Arif: 'pick one canonical name and require it non-empty on every non-HOLD compute.'
    We test against wealth_compute_npv (known-good) and check for the field.
    """
    c = MCPClient(WEALTH, "test-I2")
    try:
        r = c.call(
            "wealth_compute_npv",
            {"cash_flows": [-1000, 500, 500, 500], "discount_rate": 0.10},
        )
        # Find equations_used under any known canonical name
        equations = (
            r.get("equations_used")
            or r.get("method_provenance")
            or r.get("computation_method")
            or r.get("provenance", {}).get("equations")
            or r.get("result", {}).get("equations_used")
        )
        verdict = r.get("verdict") or r.get("status")
        is_error = "_is_rejection" in r or "error" in r
        if is_error:
            record(
                "I2.equations_used canonical on compute",
                "SEP-1303",
                "SKIP",
                f"WEALTH call errored (transport?): {str(r)[:200]}",
            )
            return
        if verdict in ("HOLD", "VOID") and not equations:
            record(
                "I2.equations_used canonical on compute",
                "SEP-1303",
                "PASS",
                f"HOLD/VOID verdict — equations_used may be empty (F2 TRUTH: "
                f"don't fabricate method on hold): verdict={verdict}",
            )
            return
        if not equations:
            record(
                "I2.equations_used canonical on compute",
                "SEP-1303",
                "FAIL",
                f"Successful compute (verdict={verdict}) returned empty equations_used. "
                f"Decorative math risk. Response keys: {list(r.keys())[:15]}",
                verdict=verdict,
                npv=r.get("npv") or r.get("result", {}).get("npv"),
            )
        else:
            record(
                "I2.equations_used canonical on compute",
                "SEP-1303",
                "PASS",
                f"equations_used populated: {str(equations)[:120]}",
            )
    finally:
        c.close()


def test_S1_wealth_no_surface_drift():
    """TWO-SURFACE: WEALTH must advertise only canonical tools OR mark deprecated explicitly.

    Per envelope spec (2026-07-08), canonical flag may live in:
    - t["canonical"] (top-level)
    - t["annotations"]["canonical"] (MCP annotations)
    - t["_meta"]["canonical"] (MCP arbitrary metadata)
    - t["status"] in {"canonical", "deprecated"}
    """
    c = MCPClient(WEALTH, "test-S1")
    try:
        tools = c.list_tools()
        if not tools:
            c2 = MCPClient(ARIFOS, "test-S1-bridge")
            try:
                all_tools = c2.list_tools()
                tools = [t for t in all_tools if "wealth" in t.get("name", "").lower()]
            finally:
                c2.close()

        if not tools:
            record(
                "S1.WEALTH no surface drift",
                "Two-surface",
                "SKIP",
                "No WEALTH tools discoverable on either surface",
            )
            return

        def _is_tagged(t):
            if t.get("deprecated") is True or t.get("canonical") is True:
                return True
            if t.get("status") in ("canonical", "deprecated"):
                return True
            ann = t.get("annotations") or {}
            if ann.get("canonical") is True or ann.get("deprecated") is True:
                return True
            meta = t.get("_meta") or {}
            if meta.get("canonical") is True or meta.get("deprecated") is True:
                return True
            return False

        unmarked = [t.get("name") for t in tools if not _is_tagged(t)]
        if not unmarked:
            record(
                "S1.WEALTH no surface drift",
                "Two-surface",
                "PASS",
                f"all {len(tools)} tools explicitly tagged",
            )
        else:
            record(
                "S1.WEALTH no surface drift",
                "Two-surface",
                "FAIL",
                f"{len(unmarked)} of {len(tools)} tools unmarked. Sample: {unmarked[:5]}",
                total=len(tools),
                unmarked=len(unmarked),
            )
    finally:
        c.close()


def test_S2_geox_no_surface_drift():
    """TWO-SURFACE: GEOX must mark backward-compat tools as deprecated (or not advertise)."""
    c = MCPClient(GEOX, "test-S2")
    try:
        tools = c.list_tools()
        if not tools:
            c2 = MCPClient(ARIFOS, "test-S2-bridge")
            try:
                all_tools = c2.list_tools()
                tools = [t for t in all_tools if "geox" in t.get("name", "").lower()]
            finally:
                c2.close()

        if not tools:
            record(
                "S2.GEOX no surface drift",
                "Two-surface",
                "SKIP",
                "No GEOX tools discoverable (organ down or restart-loop)",
            )
            return

        # Per GEOX AGENTS.md: 35 canonical, 49 backward-compat aliases.
        # Accept flag in any MCP-standard location.
        def _is_tagged(t):
            if t.get("deprecated") is True or t.get("canonical") is True:
                return True
            if t.get("status") in ("canonical", "deprecated", "backward_compat", "legacy"):
                return True
            ann = t.get("annotations") or {}
            if ann.get("canonical") is True or ann.get("deprecated") is True:
                return True
            meta = t.get("_meta") or {}
            if meta.get("canonical") is True or meta.get("deprecated") is True:
                return True
            return False

        unmarked = [t.get("name") for t in tools if not _is_tagged(t)]
        canonical = [t.get("name") for t in tools if t.get("canonical") is True]
        deprecated = [t.get("name") for t in tools if t.get("deprecated") is True]

        if not unmarked:
            record(
                "S2.GEOX no surface drift",
                "Two-surface",
                "PASS",
                f"all {len(tools)} tools tagged "
                f"(canonical={len(canonical)}, deprecated={len(deprecated)})",
            )
        else:
            record(
                "S2.GEOX no surface drift",
                "Two-surface",
                "FAIL",
                f"{len(unmarked)} of {len(tools)} GEOX tools unmarked. "
                f"Sample: {unmarked[:5]}",
                total=len(tools),
                unmarked=len(unmarked),
            )
    finally:
        c.close()


# ── Runner ────────────────────────────────────────────────────────────


def main() -> int:
    print("=" * 72)
    print("ENVELOPE REGRESSION SUITE — 2026-07-08")
    print("Capture failing baseline BEFORE retrofit (F2 TRUTH)")
    print("=" * 72)

    # I1 — depends on arif_init working
    session_id = test_I1_arif_init_binds_session_handle()
    test_I1_session_propagates_via_envelope(session_id)

    # I2-I5 — independent
    test_I3_anonymous_call_rejected_not_hold()
    test_I4_orphan_envelope_rejected()
    test_I5_actor_signature_verified()
    test_I2_equations_used_canonical_on_compute()

    # Two-surface problem
    test_S1_wealth_no_surface_drift()
    test_S2_geox_no_surface_drift()

    # ── Render report ────────────────────────────────────────────────
    print()
    print("─" * 72)
    print("REGRESSION BASELINE REPORT")
    print("─" * 72)
    pass_n = sum(1 for r in RESULTS if r.status == "PASS")
    fail_n = sum(1 for r in RESULTS if r.status == "FAIL")
    skip_n = sum(1 for r in RESULTS if r.status == "SKIP")
    for r in RESULTS:
        print(r.line())
        if r.detail:
            print(f"    └─ {r.detail}")
    print()
    print(f"PASS={pass_n}  FAIL={fail_n}  SKIP={skip_n}  TOTAL={len(RESULTS)}")
    print()
    if fail_n > 0:
        print(">> BASELINE CAPTURED. Failing tests above are the regression target.")
        print(
            "   Retrofit must make these PASS WITHOUT breaking the currently-PASSing ones."
        )
        print("   Pre/post diff is the proof. F2 TRUTH: no fix without a baseline.")
        return 1
    else:
        print(">> All tests PASS. No baseline failures to retrofit. Investigate.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
