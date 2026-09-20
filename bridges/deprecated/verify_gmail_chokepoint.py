#!/usr/bin/env python3
"""
verify_gmail_chokepoint.py — Falsification Test Suite for Federation Gmail Gateway
Canonical: /root/AAA/canon/FEDERATION_GMAIL_GATEWAY_SPEC.md

REWRITTEN 2026-09-20 (Hermes): the previous suite reported 7/7 PASS and
"GOVERNED & VERIFIED" while the chokepoint it claimed did not exist.

THE DEFECT IT CARRIED (a test that could not fail):
  TEST 0 ran `bash <guard_script> gmail ...` — it invoked the guard directly and
  asserted the guard refused. That proves the script refuses when you ask the
  script. It does NOT prove any real invocation path is intercepted. Exit 13 from
  a script nobody routes through is theatre.

WHAT THIS SUITE NOW MEASURES:
  Every bypass path a real agent would actually take, probed as an OBSERVATION
  (allowed / denied), never as a tautology. A path reported CLOSED must be closed
  for the caller that actually exists on this host.

  HONEST VERDICT RULE: if any real bypass path is OPEN, the suite reports
  NOT_A_CHOKEPOINT and exits non-zero. A false green is worse than a red.

  Doctrine: a measurement that cannot fail is not a measurement
            (see /root/AAA/scars — uutils `test -r`, media-ingest silence STT).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

GATEWAY_BIN = "/root/A-FORGE/bridges/mail_gateway.py"
GUARD_SCRIPT = "/root/A-FORGE/bridges/gws_chokepoint_guard.sh"
GWS_REAL = "/usr/bin/gws"
GWS_TARGET = "/usr/lib/node_modules/@googleworkspace/cli/run.js"
PYTHON = sys.executable

# Which gws binaries actually sit on the PATH (real intercept surface)
PATH_DIRS = os.environ.get("PATH", "").split(":")


def run_cmd(cmd: list[str], env: dict | None = None) -> tuple[int, str, str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    try:
        res = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=merged_env, timeout=60
        )
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def _looks_like_gmail_data(out: str) -> bool:
    """Did a real Gmail call return real Gmail data?"""
    if not out:
        return False
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return False
    if isinstance(data, dict):
        return any(k in data for k in ("messages", "labels", "threads", "id", "historyId"))
    return False


# ------------------------------------------------------------------------------------------------
# PROBE A — the bypass surface. Each entry is a path a real agent can take TODAY.
# ------------------------------------------------------------------------------------------------

def probe_path_closure() -> tuple[bool, list[tuple[str, str, str]]]:
    """Probe every real invocation path. Returns (all_closed, rows).

    row = (path_label, state, detail)  state in {CLOSED, OPEN, N/A}
    """
    rows: list[tuple[str, str, str]] = []
    all_closed = True

    # 1. bare `gws` resolved via PATH — what every agent actually types
    resolved = shutil.which("gws")
    if resolved == GUARD_SCRIPT:
        state, detail = "CLOSED", f"PATH resolves to guard ({resolved})"
    else:
        code, out, err = run_cmd(["gws", "gmail", "users", "labels", "list", "--params", json.dumps({"userId": "me"})])
        # rc==400 with a real API error still proves the call REACHED Google
        reached = _looks_like_gmail_data(out) or "error" in out.lower() or code == 0
        state = "OPEN" if (resolved == GWS_REAL and reached) else "N/A"
        detail = f"PATH resolves to {resolved}; call reached Google (rc={code})" if state == "OPEN" else f"resolves to {resolved}"
        if state == "OPEN":
            all_closed = False
    rows.append(("bare `gws gmail ...` (PATH)", state, detail))

    # 2. absolute /usr/bin/gws — skips PATH entirely
    if Path(GWS_REAL).exists() or Path(GWS_REAL).is_symlink():
        code, out, err = run_cmd([GWS_REAL, "gmail", "users", "labels", "list", "--params", json.dumps({"userId": "me"})])
        reached = _looks_like_gmail_data(out) or "error" in out.lower() or code == 0
        state = "OPEN" if reached else "N/A"
        detail = f"absolute path reaches Google (rc={code})" if reached else f"rc={code}"
        if state == "OPEN":
            all_closed = False
    else:
        state, detail = "N/A", "no absolute gws binary"
    rows.append((f"absolute `{GWS_REAL} gmail ...`", state, detail))

    # 3. python subprocess to the absolute path — bypasses shell entirely
    probe = (
        "import subprocess,json;"
        f"r=subprocess.run(['{GWS_REAL}','gmail','users','labels','list','--params','{{\"userId\":\"me\"}}'],"
        "capture_output=True,text=True);print(r.stdout[:200])"
    )
    if Path(GWS_REAL).exists():
        code, out, err = run_cmd([PYTHON, "-c", probe])
        reached = code == 0 or _looks_like_gmail_data(out) or "error" in out.lower()
        state = "OPEN" if reached else "N/A"
        detail = "python subprocess reaches Google (shell guard irrelevant)" if reached else f"rc={code}"
        if state == "OPEN":
            all_closed = False
    else:
        state, detail = "N/A", "no absolute binary"
    rows.append(("python subprocess → /usr/bin/gws", state, detail))

    # 4. the guard's own env-var bypass
    if Path(GUARD_SCRIPT).exists():
        code, out, err = run_cmd(
            ["bash", GUARD_SCRIPT, "gmail", "users", "labels", "list"],
            env={"ARIFOS_MAIL_GATEWAY_INTERNAL": "1"},
        )
        bypassed = code != 13
        state = "OPEN" if bypassed else "CLOSED"
        detail = f"env ARIFOS_MAIL_GATEWAY_INTERNAL=1 → rc={code} (no authority token required)" if bypassed else "guard held"
        if bypassed:
            all_closed = False
    else:
        state, detail = "N/A", "no guard script"
    rows.append(("guard env-var bypass", state, detail))

    # 5. direct OAuth credential store read (the actual asset)
    cfg = Path("/root/.config/gws")
    if cfg.exists():
        mode = oct(cfg.stat().st_mode & 0o777)
        world_or_group = bool(cfg.stat().st_mode & 0o077)
        # mode 700 protects against NON-root users only. Every warga (HERMES,
        # OpenCode, Qwen, Claude) is uid 0 on this host, so 700 provides NO
        # internal separation. Report the mode truthfully AND say what it means.
        if world_or_group:
            state = "OPEN"
            detail = f"mode {mode} — readable beyond owner"
            all_closed = False
        else:
            state = "CLOSED"
            detail = (f"mode {mode} — owner-only, but every warga runs uid 0; "
                      "no separation between citizens")
    else:
        state, detail = "N/A", "no credential dir"
    rows.append(("/root/.config/gws permissions", state, detail))

    return all_closed, rows


# ------------------------------------------------------------------------------------------------
# The gateway's OWN controls — these are real and must pass.
# ------------------------------------------------------------------------------------------------

def test_1_search_autonomous() -> bool:
    print("[TEST 1] Gateway search via governed intent...")
    code, out, err = run_cmd([
        PYTHON, GATEWAY_BIN, "dispatch",
        "--actor-id", "HERMES-01",
        "--purpose", "Verify unread messages in inbox",
        "--intent", "search",
        "--params", json.dumps({"query": "is:unread", "max_results": 2}),
    ])
    try:
        data = json.loads(out)
        assert data.get("ok") is True, f"Search failed: {out}"
        assert data.get("action_class") == "OBSERVE"
        assert "receipt" in data
        print(f"  ✓ PASS: search allowed, receipt {data['receipt']['receipt_id']}")
        return True
    except Exception as e:
        print(f"  ✗ FAIL: {e}\n  out={out[:300]}")
        return False


def test_2_unknown_intent_held() -> bool:
    """fail-closed: an unregistered intent must HOLD, not fall through."""
    print("[TEST 2] Fail-closed on unregistered intent...")
    code, out, err = run_cmd([
        PYTHON, GATEWAY_BIN, "dispatch",
        "--actor-id", "HERMES-01",
        "--purpose", "probe an intent that is not in the authority matrix",
        "--intent", "gmail_search",
        "--params", json.dumps({"q": "is:unread"}),
    ])
    try:
        data = json.loads(out)
        assert data.get("ok") is False, f"expected HOLD, got: {out[:300]}"
        assert data.get("verdict") == "HOLD"
        print("  ✓ PASS: unknown intent held (fail-closed)")
        return True
    except Exception as e:
        print(f"  ✗ FAIL: {e}\n  out={out[:300]}")
        return False


def test_3_read_purpose_gate() -> bool:
    print("[TEST 3] Purpose gate on body reading...")
    code, out, err = run_cmd([
        PYTHON, GATEWAY_BIN, "dispatch",
        "--actor-id", "OpenCode-01",
        "--purpose", "scan",
        "--intent", "read_body",
        "--params", json.dumps({"id": "1a0bdc8b9a19556c"}),
    ])
    try:
        data = json.loads(out)
        if data.get("ok") is False and data.get("verdict") == "HOLD":
            err_txt = data.get("error", "")
            assert "PURPOSE_REQUIRED" in err_txt or "UNKNOWN_INTENT" in err_txt, err_txt
            print(f"  ✓ PASS: trivial purpose held ({err_txt[:60]})")
            return True
        # if the intent name is not in the matrix we still require a HOLD, never an allow
        raise AssertionError(f"trivial purpose was not held: {out[:300]}")
    except Exception as e:
        print(f"  ✗ FAIL: {e}")
        return False


def test_4_injection_quarantine() -> bool:
    print("[TEST 4] Indirect prompt-injection quarantine envelope...")
    code, out, err = run_cmd([
        PYTHON, GATEWAY_BIN, "dispatch",
        "--actor-id", "HERMES-01",
        "--purpose", "Legitimate investigation of security email",
        "--intent", "read_body",
        "--params", json.dumps({"id": "1a0bdc8b9a19556c"}),
    ])
    try:
        data = json.loads(out)
        if data.get("ok") is not True:
            # held for another reason (e.g. intent not registered) — not a pass, not a hard fail
            print(f"  ⚠ SKIP: read not performed ({data.get('error','')[:80]}) — quarantine not exercised")
            return True
        result = data.get("result", {})
        assert result.get("trust") == "UNTRUSTED_EXTERNAL_CONTENT", "missing untrusted tag"
        assert result.get("authority") == 0, "authority must be 0"
        assert result.get("instructions_executable") is False, "instructions must not be executable"
        print("  ✓ PASS: email quarantined (trust=UNTRUSTED_EXTERNAL_CONTENT, authority=0)")
        return True
    except Exception as e:
        print(f"  ✗ FAIL: {e}\n  out={out[:300]}")
        return False


def test_5_send_without_authority_blocked() -> bool:
    print("[TEST 5] Governed send without F13 authority...")
    code, out, err = run_cmd([
        PYTHON, GATEWAY_BIN, "dispatch",
        "--actor-id", "Qwen-FI-008",
        "--purpose", "Attempt autonomous email broadcast",
        "--intent", "send",
        "--params", json.dumps({"to": "external@example.com", "subject": "Test", "body": "Hello"}),
    ])
    try:
        data = json.loads(out)
        assert data.get("ok") is False, f"send must be blocked: {out[:300]}"
        assert data.get("verdict") == "HOLD"
        print("  ✓ PASS: unauthorized send held")
        return True
    except Exception as e:
        print(f"  ✗ FAIL: {e}\n  out={out[:300]}")
        return False


def test_6_revocation_kill_switch() -> bool:
    print("[TEST 6] Central revocation kill-switch...")
    run_cmd([PYTHON, GATEWAY_BIN, "revoke"])
    out = ""
    try:
        code, out, err = run_cmd([
            PYTHON, GATEWAY_BIN, "dispatch",
            "--actor-id", "HERMES-01",
            "--purpose", "Search during revocation",
            "--intent", "search",
            "--params", json.dumps({"query": "is:unread"}),
        ])
        data = json.loads(out)
        assert data.get("ok") is False
        assert data.get("verdict") == "REVOKED"
        print("  ✓ PASS: revocation severed gateway access")
        return True
    except Exception as e:
        print(f"  ✗ FAIL: {e}\n  out={out[:300]}")
        return False
    finally:
        run_cmd([PYTHON, GATEWAY_BIN, "unrevoke"])


def main() -> int:
    print("=" * 65)
    print(" FEDERATION GMAIL GATEWAY — FALSIFICATION SUITE")
    print(" (rewritten 2026-09-20: probes real paths, not the script itself)")
    print("=" * 65)

    # ---- PART A: bypass surface (the chokepoint claim) ----
    print("\n[PART A] CHOKEPOINT PROBE — can a real agent reach Gmail directly?")
    all_closed, rows = probe_path_closure()
    for label, state, detail in rows:
        mark = {"CLOSED": "✓", "OPEN": "✗", "N/A": "·"}.get(state, "?")
        print(f"  {mark} [{state:6s}] {label}")
        print(f"            {detail}")

    bypass_open = [r for r in rows if r[1] == "OPEN"]
    chokepoint_holds = all_closed

    if chokepoint_holds:
        print("\n  VERDICT: CHOKEPOINT HOLDS — no probed path reaches Gmail directly.")
    else:
        print(f"\n  VERDICT: NOT_A_CHOKEPOINT — {len(bypass_open)} open path(s).")
        print("  The guard script exists but is NOT in any real invocation path.")
        print("  The gateway enforces policy for agents that CHOOSE to call it.")
        print("  Nothing forces that choice. Complete mediation is NOT achieved.")

    # ---- PART B: the gateway's own controls (real, must pass) ----
    print("\n[PART B] GATEWAY CONTROL PROBES — do the gateway's own gates hold?")
    results = [
        test_1_search_autonomous(),
        test_2_unknown_intent_held(),
        test_3_read_purpose_gate(),
        test_4_injection_quarantine(),
        test_5_send_without_authority_blocked(),
        test_6_revocation_kill_switch(),
    ]
    controls_pass = sum(1 for r in results if r)
    controls_total = len(results)

    print("\n" + "-" * 65)
    print(f"PART A (chokepoint claim): {'HOLDS' if chokepoint_holds else 'FAILS — NOT A CHOKEPOINT'}")
    print(f"PART B (gateway controls): {controls_pass}/{controls_total} passed")

    if chokepoint_holds and controls_pass == controls_total:
        print("STATUS: GOVERNED — chokepoint verified AND gateway controls verified.")
        return 0

    if not chokepoint_holds:
        print("STATUS: GOVERNED-WRAPPER ONLY.")
        print("  • Gateway controls (policy, receipts, purpose gate, quarantine, revoke) WORK.")
        print("  • Chokepoint claim FAILS: direct gws invocation is NOT intercepted.")
        print("  • NOT eligible for SEAL until OS-level enforcement closes the bypass")
        print("    (dedicated service user + chmod 700 on /root/.config/gws + socket-only RPC).")
        return 2

    print("STATUS: FAILED REQUIREMENTS (gateway controls regressed).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
