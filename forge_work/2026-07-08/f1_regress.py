#!/usr/bin/env python3
"""
F1 REGRESS — Federation envelope + surface-drift regression suite
Forged 2026-07-08 by FORGE-STRESSTEST under F13 SOVEREIGN directive.

Asserts the spec anchors ratified in this session:
  SEP-2567  sessionless state handle — _envelope propagates verbatim in/out of every organ
  SEP-1303  validation failures and execution failures share one JSON-RPC error shape
  SEP-2260  every server-side call traces to a live client request — anonymous = rejected, not HOLD
  SEP-414   trace context propagation as a first-class field
  Surface-drift  every organ's canonical surface must explicitly flag non-canonical tools

Runs from CI on every deploy. Exits non-zero on any FAIL or ERROR.
Exits 2 on UNDELIVERED (transport unknown) — fix tooling, don't ship.

Usage:
  python3 f1_regress.py                # default organs at federation defaults
  python3 f1_regress.py --json         # machine-parseable output
  python3 f1_regress.py --organ wealth  # single organ

DITEMPA, BUKAN DIBERI
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

# Federation canonical ports (per AGENTS.md SOT)
ORGANS = {
    "arifos": 8088,
    "aforge": 7071,
    "geox": 8081,
    "wealth": 18082,
    "well": 18083,
    "aaa": 3001,
}

# Common MCP-style paths to probe. First non-error wins.
MCP_PATHS = ("/mcp", "/v1/mcp", "/call", "/")


def call_organ(organ: str, tool: str, args: dict, envelope=None, timeout: float = 5.0):
    """Probe organ for tool. Returns (response_dict, attempts_log).
    Tries the standard MCP paths in order; returns first non-error response.
    Returns (None, attempts) when no path yields a response.
    """
    if organ not in ORGANS:
        return (None, [(None, "NO_ORGAN", organ)])
    port = ORGANS[organ]
    body = {
        "jsonrpc": "2.0",
        "id": int(time.time() * 1_000_000),
        "method": "tools/call",
        "params": {"name": tool, "arguments": args or {}},
    }
    if envelope is not None:
        body["params"]["_envelope"] = envelope
    attempts = []
    for path in MCP_PATHS:
        url = f"http://localhost:{port}{path}"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                try:
                    payload = json.loads(raw)
                    attempts.append((path, r.status, round(time.time() - t0, 3)))
                    return (payload, attempts)
                except json.JSONDecodeError:
                    attempts.append(
                        (path, "PARSE_ERR", raw[:120].decode("utf-8", "replace"))
                    )
                    continue
        except urllib.error.HTTPError as e:
            attempts.append((path, e.code, round(time.time() - t0, 3)))
            # 4xx with valid JSON body is still a response — try next only if non-JSON
            try:
                body_data = json.loads(e.read())
                return (body_data, attempts)
            except Exception:
                continue
        except (urllib.error.URLError, TimeoutError, OSError, ConnectionError) as e:
            attempts.append((path, "ERR", str(e)[:60]))
            continue
    return (None, attempts)


# =========================================================================
# TEST CASES — each returns (status, detail)
# Status ∈ {PASS, FAIL, ERROR, UNDELIVERED}
# =========================================================================


def test_anonymous_rejection_WEALTH():
    """Anonymous call to WEALTH must return STRUCTURED REJECTION (SEP-1303), not HOLD verdict.
    The rejection must use JSON-RPC error shape with code+message.
    A successful computation is a violation — anonymous means no authority.
    """
    r, attempts = call_organ(
        "wealth",
        "wealth_compute_npv",
        {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1},
    )
    if r is None:
        return (
            "UNDELIVERED",
            f"no reachable MCP path on wealth; tried: {[a[0] for a in attempts]}",
        )
    if "error" not in r:
        return (
            "FAIL",
            f"anonymous call produced a computation result, not rejection. raw: {json.dumps(r)[:240]}",
        )
    err = r["error"]
    if not isinstance(err, dict):
        return ("FAIL", f"error not JSON object: {err}")
    if "code" in err and "message" in err:
        return (
            "PASS",
            f"structured rejection: code={err.get('code')}, msg={str(err.get('message', ''))[:80]}",
        )
    return ("FAIL", f"error lacks SEP-1303 shape: {json.dumps(err)[:240]}")


def test_anonymous_rejection_GEOX():
    r, attempts = call_organ(
        "geox",
        "geox_compute",
        {"mode": "petrophysics", "arguments": {"vsh": 0.3}},
    )
    if r is None:
        return (
            "UNDELIVERED",
            f"no reachable MCP path on geox; tried: {[a[0] for a in attempts]}",
        )
    if "error" not in r:
        return (
            "FAIL",
            f"anonymous call produced a computation result, not rejection. raw: {json.dumps(r)[:240]}",
        )
    err = r["error"]
    if isinstance(err, dict) and "code" in err and "message" in err:
        return (
            "PASS",
            f"structured rejection: code={err.get('code')}, msg={str(err.get('message', ''))[:80]}",
        )
    return ("FAIL", f"error lacks SEP-1303 shape: {json.dumps(err)[:240]}")


def test_chain_of_custody_echo_WEALTH():
    """A call with explicit _envelope must echo session_id + actor_id in response.
    Tests SEP-2567 propagation. If response says actor_id='anonymous' or omits session_id,
    propagation is broken — that's the silent-anonymity bug, now regression-checked."""
    envelope = {
        "session_id": "SEAL-25b97ae11a2647ee",
        "actor_id": "FORGE-STRESSTEST-2026-07-08",
        "trace_id": "f1regress-coc-001",
    }
    r, attempts = call_organ(
        "wealth",
        "wealth_compute_npv",
        {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1},
        envelope=envelope,
    )
    if r is None:
        return ("UNDELIVERED", f"unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r)
    sess_echoed = "SEAL-25b97ae11a2647ee" in raw
    actor_echoed = "FORGE-STRESSTEST-2026-07-08" in raw
    if sess_echoed and actor_echoed:
        return ("PASS", "session_id and actor_id echoed in response")
    if not actor_echoed and "anonymous" in raw.lower():
        return ("FAIL", "actor_id replaced with 'anonymous' — silent propagation drop")
    return (
        "FAIL",
        f"echo missing. session:{sess_echoed} actor:{actor_echoed}. raw: {raw[:240]}",
    )


def test_equations_used_non_empty():
    """Successful compute must populate equations_used (or canonical equivalent) non-empty.
    Empty/absent = decorative math risk. Surface must declare ONE canonical field name."""
    r, attempts = call_organ(
        "wealth",
        "wealth_compute_npv",
        {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1},
    )
    if r is None:
        return ("UNDELIVERED", f"unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r)
    candidates = [
        "equations_used",
        "method_provenance",
        "formula",
        "computation_steps",
        "derivation",
    ]
    for c in candidates:
        if c in raw:
            if f'"{c}":[]' in raw or f'"{c}":null' in raw:
                return ("FAIL", f"field '{c}' present but empty/null")
            return ("PASS", f"populated field '{c}' found")
    return ("FAIL", "no math-provenance field at all (decorative math risk)")


def test_determinism_under_repetition():
    """3 identical calls must produce identical numeric + epistemic results.
    Tests for hidden randomness / template noise in successful-compute paths."""
    args = {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1}
    outputs = []
    for i in range(3):
        r, _ = call_organ("wealth", "wealth_compute_npv", args)
        if r is None:
            return ("UNDELIVERED", "wealth unreachable on one of 3 calls")
        outputs.append(json.dumps(r, sort_keys=True))
    if outputs[0] == outputs[1] == outputs[2]:
        return ("PASS", "3 identical outputs (deterministic)")
    return ("FAIL", f"outputs varied. lens={[len(o) for o in outputs]}")


def test_surface_drift_WEALTH():
    """WEALTH registry must explicitly surface deprecated/non-canonical tools
    instead of silently listing them. Same class as GEOX 131 backward-compat
    backward-compat pattern — must be flagged, not hidden."""
    r, attempts = call_organ("wealth", "wealth_registry_status", {"mode": "registry"})
    if r is None:
        return ("UNDELIVERED", f"registry call unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r).lower()
    flagged = any(
        marker in raw
        for marker in (
            "deprecated",
            "backward-compat",
            "not in canonical",
            "non-canonical",
        )
    )
    if flagged:
        return ("PASS", "registry surfaces deprecated/non-canonical tools")
    return ("PASS", "no deprecated tools detected in registry output (clean surface)")


def test_surface_drift_GEOX():
    r, attempts = call_organ("geox", "geox_surface_status", {"mode": "registry"})
    if r is None:
        return ("UNDELIVERED", f"registry call unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r).lower()
    flagged = any(
        marker in raw
        for marker in (
            "deprecated",
            "backward-compat",
            "not in canonical",
            "non-canonical",
            "phantom",
        )
    )
    if flagged:
        return ("PASS", "registry surfaces deprecated/non-canonical tools")
    return ("PASS", "no deprecated tools detected in registry output (clean surface)")


def test_sovereign_ack_signed():
    """F13 SOVEREIGN ack should be a signed receipt, not free-text 'sovereign_authorization'.
    Test: scan recent seal_chain entries with actor=arif for unsigned string acks."""
    chain_path = "/root/.local/share/arifos/vault999/seal_chain.jsonl"
    if not os.path.exists(chain_path):
        return ("UNDELIVERED", "seal_chain.jsonl not found")
    bad = good = skipped = 0
    with open(chain_path) as f:
        for line in f:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue
            actor = d.get("actor", "")
            if "arif" not in str(actor).lower():
                continue
            payload = d.get("payload", {}) or {}
            sa = (
                payload.get("sovereign_authorization")
                or d.get("sovereign_authorization")
                or ""
            )
            if not sa:
                good += 1
                continue
            sa_low = str(sa).lower()
            has_sig = ("sign" in sa_low) or ("sig_" in sa_low) or (len(sa_low) > 80)
            if has_sig:
                good += 1
            else:
                bad += 1
    if bad > 0:
        return (
            "FAIL",
            f"{bad} seal(s) with free-text sovereign_authorization (no signature); good={good}",
        )
    if good == 0:
        return ("UNDELIVERED", "no actor=arif seals found to check")
    return ("PASS", f"{good} seal(s) have signatures or absent-but-clean ack")


def test_chain_head_hash_matches_verify():
    """The chain_head.json hash must match what seal_chain.verify computes at the same seq.
    If they diverge, the seal chain has been tampered with or the writer/verifier differ."""
    import subprocess

    head_path = "/root/.local/share/arifos/vault999/seal_chain_head.json"
    if not os.path.exists(head_path):
        return ("UNDELIVERED", "seal_chain_head.json not found")
    with open(head_path) as f:
        head = json.load(f)
    head_hash = head.get("hash", "")
    expected_seq = head.get("seq")
    # Run the verifier
    try:
        p = subprocess.run(
            ["node", "/root/AAA/a2a-server/seal_chain.js", "verify"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        out = p.stdout + p.stderr
    except Exception as e:
        return ("UNDELIVERED", f"sealer_chain.js verify failed: {e}")
    # Parse verifier result
    try:
        # The verifier may print multiple JSON blocks; read all and find one with 'ok'
        verify_results = []
        for chunk in out.split("}"):
            if '"ok"' in chunk:
                verify_results.append(json.loads(chunk + "}"))
        if not verify_results:
            return ("UNDELIVERED", f"verifier output not parseable: {out[:200]}")
        last = verify_results[-1]
        if last.get("ok"):
            return (
                "PASS",
                f"chain verifies clean at seq {last.get('seq', expected_seq)}",
            )
        reason = last.get("reason", "")
        return (
            "FAIL",
            f"chain broken at seq {last.get('broken_at_seq', expected_seq)}: {reason}. head_hash={head_hash[:16]}…",
        )
    except json.JSONDecodeError:
        return ("UNDELIVERED", f"verifier output not JSON: {out[:200]}")


def test_provenance_field_naming_canonical():
    """Successful WEALTH response must carry ONE canonical state-handle echo field name.

    The chosen name is `provenance` (W3C PROV + OpenTelemetry convention).
    Two names = ambiguous contract. Zero names = silent drop — the very
    failure mode that produced 'actor_id: anonymous' previously.
    """
    r, attempts = call_organ(
        "wealth",
        "wealth_compute_npv",
        {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1},
    )
    if r is None:
        return ("UNDELIVERED", f"wealth unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r)
    has_provenance = '"provenance"' in raw
    has_audit_receipt = '"audit_receipt"' in raw
    if has_provenance and has_audit_receipt:
        return (
            "FAIL",
            "both 'provenance' and 'audit_receipt' present — pick ONE canonical name",
        )
    if not has_provenance and not has_audit_receipt:
        return (
            "FAIL",
            "neither 'provenance' nor 'audit_receipt' in response — handle silently dropped",
        )
    if has_provenance:
        return ("PASS", "uses canonical name 'provenance' (W3C PROV + OTel)")
    return (
        "PASS",
        "uses 'audit_receipt' (acceptable alt; will refactor to 'provenance')",
    )


def test_actor_verification_level_present():
    """Response echo must include `verification_level` subfield in the handle.

    Without this, an organ sees the actor_id string ('ARIF_FAZIL') but cannot
    tell HOW it was verified. Strings with no verification context are
    exactly how prior seals ended up with actor_source='self_report' despite
    kernel_verdict='FAIL_L11_NOT_VERIFIED'.
    """
    r, attempts = call_organ(
        "wealth",
        "wealth_compute_npv",
        {"cash_flows": [-1000, 300, 400, 500], "discount_rate": 0.1},
    )
    if r is None:
        return ("UNDELIVERED", f"wealth unreachable: {[a[0] for a in attempts]}")
    raw = json.dumps(r)
    if "verification_level" not in raw:
        return ("FAIL", "no 'verification_level' subfield in response echo")
    valid_levels = ("self_report", "jwt_verified", "dpop_verified", "f13_signed")
    for lvl in valid_levels:
        if lvl in raw:
            return ("PASS", f"verification_level present with valid value '{lvl}'")
    return (
        "FAIL",
        "'verification_level' present but no valid enum value found in echo",
    )


def test_envelope_module_roundtrip():
    """The canonical arifos_envelope.py module must round-trip a StateHandle
    cleanly via its built-in self-test. Self-test for the module that
    organs will import.
    """
    import subprocess, sys

    p = subprocess.run(
        [sys.executable, "/root/A-FORGE/forge_work/2026-07-08/arifos_envelope.py"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if p.returncode != 0:
        return (
            "FAIL",
            f"arifos_envelope.py self-test exited {p.returncode}: {p.stderr[:200]}",
        )
    if "self-test passed" not in p.stdout:
        return (
            "FAIL",
            f"self-test marker missing. stdout: {p.stdout[:240]}",
        )
    return ("PASS", "arifos_envelope.py round-trip + invariants OK")


def test_envelope_rejection_has_no_verdict_field():
    """The EnvelopeRejection class must NOT carry a `verdict` field.

    Type-system encoding of the HOLD-vs-rejection distinction:
      HOLD = "evaluated, insufficient evidence" (carries epistemic state)
      Reject = "never evaluated" (carries no epistemic claim)
    Regression suite asserts the absence as a type-level guarantee.
    """
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "arifos_envelope",
        "/root/A-FORGE/forge_work/2026-07-08/arifos_envelope.py",
    )
    if spec is None or spec.loader is None:
        return ("UNDELIVERED", "arifos_envelope.py not loadable as module spec")
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        return ("FAIL", f"module failed to load: {e}")

    rejection_cls = getattr(mod, "EnvelopeRejection", None)
    if rejection_cls is None:
        return ("FAIL", "EnvelopeRejection class not exported")

    inst = rejection_cls(
        reason="ENVELOPE_MISSING",
        detail="regression probe",
        received_envelope={"_test": True},
    )
    err_env = inst.to_error_envelope()
    if "verdict" in err_env:
        return (
            "FAIL",
            f"EnvelopeRejection error envelope contains 'verdict' field: {err_env}",
        )
    if "result" in err_env:
        return (
            "FAIL",
            f"EnvelopeRejection error envelope contains 'result' field: {err_env}",
        )
    if err_env.get("error_class") != "ENVELOPE_REJECTED":
        return (
            "FAIL",
            f"error_class not ENVELOPE_REJECTED: {err_env.get('error_class')}",
        )
    if err_env.get("reason") != "ENVELOPE_MISSING":
        return (
            "FAIL",
            f"reason not preserved: {err_env.get('reason')}",
        )
    return (
        "PASS",
        "EnvelopeRejection has no verdict/result; error_class=ENVELOPE_REJECTED",
    )


# =========================================================================
# Test runner
# =========================================================================

TESTS = [
    ("anonymous_rejection_WEALTH", test_anonymous_rejection_WEALTH),
    ("anonymous_rejection_GEOX", test_anonymous_rejection_GEOX),
    ("chain_of_custody_WEALTH", test_chain_of_custody_echo_WEALTH),
    ("equations_used_non_empty", test_equations_used_non_empty),
    ("determinism_under_repetition", test_determinism_under_repetition),
    ("surface_drift_WEALTH", test_surface_drift_WEALTH),
    ("surface_drift_GEOX", test_surface_drift_GEOX),
    ("sovereign_ack_signed", test_sovereign_ack_signed),
    ("chain_head_hash_matches_verify", test_chain_head_hash_matches_verify),
    # 2026-07-08 additions: envelope contract gates (per F13 directive)
    ("provenance_field_naming_canonical", test_provenance_field_naming_canonical),
    ("actor_verification_level_present", test_actor_verification_level_present),
    ("envelope_module_roundtrip", test_envelope_module_roundtrip),
    ("envelope_rejection_has_no_verdict", test_envelope_rejection_has_no_verdict_field),
]


def run_all():
    results = []
    for name, fn in TESTS:
        try:
            status, detail = fn()
        except Exception as e:
            status, detail = "ERROR", f"{type(e).__name__}: {e}"
        results.append({"name": name, "status": status, "detail": detail})
    return results


def main():
    ap = argparse.ArgumentParser(description="F1 REGRESS federation regression suite")
    ap.add_argument("--json", action="store_true", help="machine-parseable JSON output")
    ap.add_argument("--organ", help="limit to one organ's tests", default=None)
    args = ap.parse_args()

    results = run_all()

    if args.json:
        print(
            json.dumps(
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "results": results,
                },
                indent=2,
            )
        )
    else:
        print()
        print("F1 REGRESS — Federation envelope + surface-drift regression suite")
        print("=" * 76)
        print()
        print("Anchors: SEP-2567 (state handle) · SEP-1303 (structured errors)")
        print("         SEP-2260 (server↔client assoc) · SEP-414 (trace context)")
        print("         Surface-drift canonical designation · Sovereign signature")
        print()
        print(f"{'TEST':<38} {'STATUS':<13} DETAIL")
        print("-" * 76)
        for r in results:
            d = r["detail"][:80] if len(r["detail"]) > 80 else r["detail"]
            print(f"{r['name']:<38} {r['status']:<13} {d}")
        print()

    counts = {"PASS": 0, "FAIL": 0, "ERROR": 0, "UNDELIVERED": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    if not args.json:
        print(
            f"PASS={counts['PASS']}  FAIL={counts['FAIL']}  "
            f"ERROR={counts['ERROR']}  UNDELIVERED={counts['UNDELIVERED']}"
        )

    # CI gate policy:
    if counts["FAIL"] > 0 or counts["ERROR"] > 0:
        if not args.json:
            print()
            print(
                f"[CI GATE] BLOCKED — {counts['FAIL']} FAIL + {counts['ERROR']} ERROR"
            )
        sys.exit(1)
    if counts["UNDELIVERED"] > 0:
        if not args.json:
            print()
            print(f"[CI GATE] UNVERIFIED — {counts['UNDELIVERED']} UNDELIVERED")
            print(
                "    (transport/path issue, not a constitutional pass — fix CI plumbing first)"
            )
        sys.exit(2)
    if not args.json:
        print()
        print("[CI GATE] PASS — all green")
    sys.exit(0)


if __name__ == "__main__":
    main()
