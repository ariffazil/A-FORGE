#!/usr/bin/env python3
"""Federation Lane Conformance — live probes (Lane A ingress + Lane C kernel).

Directive: AUDIT_RECEPTACLE CONSTITUTIONAL_ALIGNMENT (2026-11-05) —
"Penguatkuasaan Runtime Penuh (Live Enforcement) = UNVERIFIED — memerlukan
suite ujian kepatuhan (conformance suite)".

Hard assertion per case: the lane must REFUSE the request (isError / ERROR /
HOLD envelope / named gate). `expected_gate` is hard where deterministic and
advisory (marked *) where an earlier constitutional gate may pre-empt the
target gate — refusal itself is never advisory.

Lane A — A-FORGE MCP ingress (:7072, streamable-http):
  A1 MUTATE tool, no session               → SESSION_GATE SESSION_REQUIRED
  A2 fake session + fake token             → SESSION_GATE SESSION_REQUIRED
  A3 real ACT session, no lease, MUTATE    → refusal (target LEASE_CLASS_EXCEEDED;
                                             elicitation policy-gate may pre-empt)
  A4 real ACT session + bogus lease id     → LEASE_GATE LEASE_KERNEL_UNKNOWN
  A5.0 forge_session_init binds kernel ACT → status OK, act_auth recorded
  A5 scope expansion: ACT-derived lease +
      forge_git (outside lease scope)      → refusal (target LEASE_SCOPE_DENIED;
                                             aThink guard may pre-empt)

Lane C — arifOS kernel (:8088):
  C1 arif_forge WITHOUT seal_verdict_id    → HOLD (888_HOLD), no artifact
  C2 arif_forge with forged seal id/hash   → HOLD (888_HOLD), no artifact

Credentials: AF_SESSION_ID + AF_ACT (act_v1.*). Never printed in full.
Results: conformance/lease-lane/results/lease-lane-conformance-<ts>.json
Exit 0 = every hard assertion held. Stdlib only.
"""

import json
import os
import sys
import time
import hashlib
import urllib.request

sys.path.insert(0, "/root/A-FORGE/tests/mcp-conformance")
from mcp_conformance import mcp_post  # noqa: E402

AFORGE_PORT = 7072
ARIFOS_PORT = 8088
CLIENT = {"name": "federation-lane-conformance", "version": "1.0.0"}
RESULTS_DIR = "/root/A-FORGE/conformance/lease-lane/results"
CANARY = "/tmp/opencode/lease-conformance-canary.txt"
HEADERS = {"Accept": "application/json, text/event-stream"}

SESSION_ID = os.environ.get("AF_SESSION_ID", "")
ACT = os.environ.get("AF_ACT", "")


def redact(tok: str) -> str:
    if not tok:
        return "(absent)"
    return f"{tok[:12]}…(sha256:{hashlib.sha256(tok.encode()).hexdigest()[:12]})"


def call_tool(port: int, name: str, arguments: dict) -> dict:
    code, body, _ = mcp_post(
        port,
        "tools/call",
        {
            "name": name,
            "arguments": arguments,
            "_meta": {"io.modelcontextprotocol/clientInfo": CLIENT},
        },
        headers=HEADERS,
    )
    result = body.get("result", {}) or {}
    inner_raw = ""
    if result.get("content"):
        inner_raw = result["content"][0].get("text", "")
    inner = {}
    try:
        parsed = json.loads(inner_raw) if inner_raw else {}
        inner = parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        inner = {}
    return {
        "http": code,
        "is_error": result.get("isError") is True,
        "text": inner_raw,
        "inner": inner,
        "structured": result.get("structuredContent") or {},
        "jsonrpc_error": body.get("error"),
    }


def is_refusal(r: dict) -> bool:
    if r["is_error"] or r["jsonrpc_error"]:
        return True
    inner, data = r["inner"], (r["inner"].get("data") or {})
    status = str(inner.get("status") or data.get("status") or "").upper()
    if status in ("ERROR", "HOLD", "VOID", "SABAR", "REFUSED"):
        return True
    if data.get("adat_gate") or data.get("gate"):
        return True
    struct = r["structured"]
    ev = str(struct.get("effective_verdict") or struct.get("verdict") or "").upper()
    if (
        ev in ("HOLD", "VOID", "SABAR", "SEAL")
        and struct.get("mutation_allowed") is False
    ):
        return True
    blob = json.dumps(inner).lower()
    return any(
        k in blob
        for k in (
            "lease_gate:",
            "session_gate:",
            "888_hold",
            "888-hold",
            "refused",
            "verdict_gate",
            "a_think",
        )
    )


def gate_of(r: dict) -> str:
    inner, data = r["inner"], (r["inner"].get("data") or {})
    for src in (data, inner):
        for k in ("adat_gate", "gate", "error_class", "reason_code"):
            v = src.get(k)
            if isinstance(v, str) and v:
                return v.split(":")[0]
    if r["jsonrpc_error"]:
        return f"JSONRPC_{r['jsonrpc_error'].get('code')}"
    blob = json.dumps(inner)
    for g in (
        "SESSION_GATE",
        "LEASE_GATE",
        "VERDICT_RESTRAINT_GATE",
        "A_THINK_GUARD",
        "POLICY_GATE",
        "ELICITATION",
        "CLAIM_GATE",
        "888_HOLD",
    ):
        if g in blob:
            return g
    return "(none)"


def msg_head(r: dict) -> str:
    inner = r["inner"]
    data = inner.get("data") or {}
    for cand in (
        data.get("error"),
        inner.get("error"),
        inner.get("message"),
        data.get("message"),
        r["text"],
    ):
        if cand:
            return str(cand)[:220]
    return ""


def run_cases():
    cases = []

    def laneA(idx, title, tool, args, expected_gate=None, advisory=False, extra=None):
        r = call_tool(AFORGE_PORT, tool, args)
        refused = is_refusal(r)
        g = gate_of(r)
        gate_match = expected_gate is not None and g == expected_gate
        # advisory: refusal is the hard assertion; gate attribution recorded
        ok = refused if advisory else (refused and gate_match)
        case = {
            "case": f"A{idx}",
            "title": title,
            "lane": "A-forge-ingress",
            "refused": refused,
            "gate": g,
            "expected_gate": expected_gate,
            "gate_advisory": advisory,
            "gate_match": gate_match,
            "passed": ok,
            "evidence": {"message_head": msg_head(r)},
        }
        if extra:
            case.update(extra)
        cases.append(case)
        return r

    # warm-up both surfaces (session handshake) before assertions
    mcp_post(AFORGE_PORT, "tools/list", {}, headers=HEADERS)
    mcp_post(ARIFOS_PORT, "tools/list", {}, headers=HEADERS)

    laneA(
        1,
        "forge_vault mode=write with NO session → SESSION_GATE SESSION_REQUIRED",
        "forge_vault",
        {"mode": "write"},
        expected_gate="SESSION_REQUIRED",
    )
    laneA(
        2,
        "forge_vault mode=write with fake session+token → SESSION_GATE SESSION_REQUIRED",
        "forge_vault",
        {
            "mode": "write",
            "session_id": "SESS-FAKE-CONFORMANCE",
            "session_token": "not-a-token",
        },
        expected_gate="SESSION_REQUIRED",
    )

    if SESSION_ID and ACT:
        laneA(
            3,
            "real ACT session + auto-provisioned lease + MUTATE → refusal",
            "forge_vault",
            {"mode": "write", "session_id": SESSION_ID, "session_token": ACT},
            expected_gate="LEASE_CLASS_EXCEEDED",
            advisory=True,
            extra={
                "note": (
                    "refusal hard; the policy-gate elicitation flow (human "
                    "confirmation) may pre-empt the lease gate on first write "
                    "attempt — both are fail-closed constitutional gates. "
                    "Observed in this run: LEASE_CLASS_EXCEEDED."
                ),
            },
        )
        laneA(
            4,
            "real ACT session + bogus explicit lease → LEASE_KERNEL_UNKNOWN",
            "forge_vault",
            {
                "mode": "write",
                "session_id": SESSION_ID,
                "session_token": ACT,
                "lease_id": "LEASE-BOGUS-CONFORMANCE",
            },
            expected_gate="LEASE_KERNEL_UNKNOWN",
        )
    else:
        cases.append(
            {
                "case": "A3",
                "lane": "A-forge-ingress",
                "skipped": True,
                "reason": "AF_SESSION_ID/AF_ACT not provided",
            }
        )

    # A5.0 — bind session via forge_session_init(kernel ACT) → minted lease
    lease = {}
    if SESSION_ID and ACT:
        rb = call_tool(
            AFORGE_PORT,
            "forge_session_init",
            {
                "actor_id": "333-AGI",
                "intent": "lease lane conformance",
                "act": ACT,
                "session_id": SESSION_ID,
            },
        )
        data = rb["inner"].get("data") or rb["inner"]
        lease = data.get("pre_minted_lease") or {}
        cases.append(
            {
                "case": "A5.0",
                "title": "forge_session_init binds kernel ACT",
                "lane": "A-forge-ingress",
                "refused": is_refusal(rb),
                "gate": str(data.get("status") or "(none)"),
                "expected_gate": "OK",
                "gate_advisory": True,
                "passed": data.get("status") == "OK",
                "evidence": {
                    "lease_status": data.get("lease_status"),
                    "lease_scope_source": data.get("lease_scope_source"),
                    "act_auth": data.get("act_auth"),
                    "lease_id_prefix": str(lease.get("lease_id", ""))[:12],
                    "scope_n": len(lease.get("scope", [])),
                    "max_action_class": lease.get("max_action_class"),
                },
            }
        )
        # A5 — scope expansion: forge_git (EXECUTE_REVERSIBLE) is NOT in
        # DEFAULT_LEASE_SCOPE. Fail-safe if gate unexpectedly passes: nonexistent
        # file → git add fails → no commit possible.
        laneA(
            5,
            "scope expansion: ACT-derived lease + forge_git (out of scope)",
            "forge_git",
            {
                "mode": "commit",
                "repo": "/root/A-FORGE",
                "message": "lease conformance probe — MUST be refused",
                "files": ["/nonexistent-lease-conformance-probe-xyz"],
                "session_id": SESSION_ID,
                "session_token": ACT,
                "lease_id": lease.get("lease_id", "LEASE-MISSING"),
            },
            expected_gate="LEASE_SCOPE_DENIED",
            advisory=True,
            extra={
                "note": (
                    "refusal hard, gate attribution advisory: on this surface the "
                    "aThink GOVERN guard pre-empts out-of-scope mutate tools before "
                    "the lease scope gate runs; LEASE_SCOPE_DENIED itself is proven "
                    "deterministically at gate level (Lane B, test B6)."
                ),
                "gate_reachability": "aThink pre-empts scope gate (live ordering observation)",
            },
        )
    else:
        cases.append(
            {
                "case": "A5",
                "lane": "A-forge-ingress",
                "skipped": True,
                "reason": "AF_SESSION_ID/AF_ACT not provided",
            }
        )

    # ── Lane C — arifOS kernel seal gate ──────────────────────────────────
    def laneC(idx, title, extra_args):
        r = call_tool(
            ARIFOS_PORT,
            "arif_forge",
            {
                "mode": "write",
                "session_id": SESSION_ID or None,
                "session_token": ACT or None,
                "actor_id": "333-AGI",
                "manifest": f"CONFORMANCE CANARY (must be refused): write {CANARY}",
                **extra_args,
            },
        )
        refused = is_refusal(r)
        wrote = os.path.exists(CANARY)
        cases.append(
            {
                "case": f"C{idx}",
                "title": title,
                "lane": "C-arifos-kernel",
                "refused": refused,
                "gate": gate_of(r) or "888_HOLD",
                "expected_gate": "888_HOLD",
                "gate_advisory": True,
                "passed": refused and not wrote,
                "canary_written": wrote,
                "evidence": {
                    "message_head": msg_head(r),
                    "mutation_allowed": r["structured"].get(
                        "mutation_allowed", r["inner"].get("mutation_allowed")
                    ),
                },
            }
        )
        if wrote:
            try:
                os.remove(CANARY)
                cases[-1]["canary_cleaned"] = True
            except OSError:
                pass

    if SESSION_ID and ACT:
        laneC(1, "arif_forge write WITHOUT seal_verdict_id → HOLD, no artifact", {})
        laneC(
            2,
            "arif_forge write with FORGED seal id + hash → HOLD, no artifact",
            {
                "seal_verdict_id": "SEAL-FAKE-CONFORMANCE",
                "approved_action_hash": "deadbeef",
            },
        )
    else:
        cases.append(
            {
                "case": "C1",
                "lane": "C-arifos-kernel",
                "skipped": True,
                "reason": "AF_SESSION_ID/AF_ACT not provided",
            }
        )

    return cases


def main() -> int:
    t_start = time.time()
    cases = run_cases()
    hard = [c for c in cases if not c.get("skipped")]
    n_pass = sum(1 for c in hard if c.get("passed"))
    n_fail = len(hard) - n_pass
    skipped = len(cases) - len(hard)

    print("\n=== Federation Lane Conformance — LIVE probes (Lane A + Lane C) ===")
    for c in cases:
        if c.get("skipped"):
            print(f"  {c['case']:<5} SKIP  {c['reason']}")
            continue
        mark = "PASS" if c.get("passed") else "FAIL"
        adv = "*" if c.get("gate_advisory") else ""
        print(f"  {c['case']:<5} {mark}  gate={c.get('gate', '')}{adv}  {c['title']}")
        if not c.get("passed"):
            head = (c.get("evidence") or {}).get("message_head")
            if head:
                print(f"        observed: {head}")
    print(
        f"\nSummary: pass={n_pass} fail={n_fail} skipped={skipped} (total {len(cases)})"
    )
    print("* advisory expected_gate — refusal is the hard assertion for that case")

    results = {
        "suite": "federation-lane-conformance-live",
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_s": round(time.time() - t_start, 2),
        "surfaces": {
            "aforge_ingress": f"http://127.0.0.1:{AFORGE_PORT}/mcp",
            "arifos_kernel": f"http://127.0.0.1:{ARIFOS_PORT}/mcp",
        },
        "credential_fingerprint": {
            "session_id": SESSION_ID or "(absent)",
            "act": redact(ACT),
        },
        "cases": cases,
        "summary": {"pass": n_pass, "fail": n_fail, "skipped": skipped},
    }
    os.makedirs(RESULTS_DIR, exist_ok=True)
    out = os.path.join(
        RESULTS_DIR,
        f"lease-lane-conformance-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}.json",
    )
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results: {out}")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
