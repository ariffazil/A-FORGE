#!/usr/bin/env python3
"""
gws_truth_test.py — HONEST verification of the Gmail capability boundary.

WHY THIS EXISTS
---------------
An earlier version of this file tested the guard by calling it directly, and
reported 7/7 PASS while the boundary was wide open. A guard that denies when
invoked is not a chokepoint. This suite tests the paths a careless or adversarial
citizen actually uses, and it runs them from the citizen identity — not from
inside the gateway.

DESIGN RULES
------------
1. Never call the gate. Test what avoids it.
2. Prove the suite can detect an open path (meta self-test, text AND binary).
3. Classify every open vector: DEFECT (closeable) vs ROOT_RESIDUAL (not closable
   on this host while citizens run as root).
4. Exit non-zero when a DEFECT is open.

Read-only against Gmail: metadata listing only. No body read, nothing sent.

Usage:
    python3 gws_truth_test.py            # human report
    python3 gws_truth_test.py --json     # machine report
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

# ── Targets ────────────────────────────────────────────────────────────────
NEW_STORE = Path("/var/lib/mail-gateway/gws")
OLD_STORE = Path("/root/.config/gws")
TOKEN_FILE = NEW_STORE / "token_cache.json"
GWS_CLI_JS = Path("/usr/lib/node_modules/@googleworkspace/cli/run.js")
GWS_NATIVE = Path("/usr/lib/node_modules/@googleworkspace/cli/bin/gws")
GUARD_SHIM = Path("/usr/local/bin/gws")
BROKER_SOCKET = Path("/run/mailgw/broker.sock")
RECEIPTS = Path("/var/lib/mail-gateway/audit/receipts.jsonl")
GATEWAY = Path("/root/A-FORGE/bridges/mail_gateway.py")

# The non-root citizen identity. Adversarial vectors run as this user.
WARGA_USER = os.getenv("TRUTHTEST_WARGA", "arifos")

TIMEOUT = 60


def run(cmd: list[str], shell_cmd: str | None = None,
        as_user: str | None = None) -> tuple[int, str, str]:
    """Run a command. Returns (exit_code, stdout, stderr). Never raises.

    errors="replace" is mandatory: the token cache is encrypted binary, and a
    strict-UTF8 decode failure would be swallowed and mis-reported as "blocked".
    """
    if as_user:
        cmd = ["sudo", "-u", as_user, "--", *cmd]
        shell_cmd = None
    try:
        if shell_cmd is not None:
            r = subprocess.run(shell_cmd, shell=True, capture_output=True,
                               text=True, errors="replace", timeout=TIMEOUT,
                               executable="/bin/bash")
        else:
            r = subprocess.run(cmd, capture_output=True, text=True,
                               errors="replace", timeout=TIMEOUT)
        return r.returncode, r.stdout or "", r.stderr or ""
    except subprocess.TimeoutExpired:
        return 124, "", "TIMEOUT"
    except FileNotFoundError as e:
        return 127, "", f"not found: {e}"
    except Exception as e:  # noqa: BLE001
        return 1, "", f"error: {e}"


def looks_like_gmail_data(exit_code: int, out: str) -> bool:
    if exit_code != 0:
        return False
    return any(m in out for m in ('"labels"', '"messages"', '"threads"',
                                  "INBOX", "SENT", "UNREAD"))


def was_denied(exit_code: int, err: str, out: str) -> bool:
    blob = (err + out).lower()
    if exit_code in (13, 126, 137):
        return True
    return any(m in blob for m in (
        "denied", "forbidden", "operation not permitted", "permission denied",
        "blocked", "apparmor", "no credentials provided"))


def receipted_for(marker: str) -> bool:
    if not RECEIPTS.exists():
        return False
    try:
        tail = RECEIPTS.read_text(errors="replace").splitlines()[-120:]
        return any(marker in line for line in tail)
    except OSError:
        return False


# ───────────────────────────────────────────────────────────────────────────
# VECTORS — each returns (blocked: bool, detail: str)
# ───────────────────────────────────────────────────────────────────────────

def v1_bare_path_mediated() -> tuple[bool, str]:
    """1. Bare `gws` — is it MEDIATED (receipted) rather than a bypass?"""
    marker = f"TRUTHTEST-{os.getpid()}"
    env = (f"MAILGW_ACTOR={shlex.quote(marker)} "
           f"MAILGW_PURPOSE='truth-test mediation probe' ")
    code, out, err = run([], shell_cmd=(
        env + "gws gmail users labels list --params '{\"userId\":\"me\"}'"))
    if receipted_for(marker):
        return True, f"mediated — receipted as {marker}"
    if looks_like_gmail_data(code, out):
        return False, f"REACHABLE WITHOUT A RECEIPT (exit {code})"
    return True, f"not reachable (exit {code})"


def v2_absolute_path() -> tuple[bool, str]:
    """2. Absolute /usr/bin/gws — defeats any PATH shim."""
    code, out, err = run(["/usr/bin/gws", "gmail", "users", "messages", "list",
                          "--params", '{"userId":"me","maxResults":2}'])
    if looks_like_gmail_data(code, out):
        return False, f"REACHABLE (exit {code})"
    return True, f"blocked (exit {code})"


def v3_node_direct_as_warga() -> tuple[bool, str]:
    """3. Non-root warga skips the launcher — node on run.js directly."""
    if not GWS_CLI_JS.exists():
        return True, "cli js not present"
    code, out, err = run(["node", str(GWS_CLI_JS), "gmail", "users",
                          "labels", "list", "--params", '{"userId":"me"}'],
                         as_user=WARGA_USER)
    if looks_like_gmail_data(code, out):
        return False, f"REACHABLE via node as {WARGA_USER} (exit {code})"
    if was_denied(code, err, out):
        return True, f"blocked via node as {WARGA_USER}"
    return True, f"no access (exit {code})"


def v4_nonroot_reads_store() -> tuple[bool, str]:
    """4. Non-root warga reads the token store. DAC must refuse."""
    code, out, err = run(["python3", "-c",
                          f"print(open({str(TOKEN_FILE)!r}).read()[:40])"],
                         as_user=WARGA_USER)
    if "PermissionError" in err or "Permission denied" in err:
        return True, f"DAC refused {WARGA_USER} on the token store"
    if code == 0 and out.strip():
        return False, f"REACHABLE — {WARGA_USER} read the token store"
    return True, f"not readable by {WARGA_USER} (exit {code})"


def v5_nonroot_copies_credential() -> tuple[bool, str]:
    """5. Non-root warga copies the encrypted credential blob out."""
    src = NEW_STORE / "credentials.enc"
    if not src.exists():
        return True, "credential blob absent"
    dest = "/tmp/.gws_truth_probe"
    code, out, err = run(["cp", str(src), dest], as_user=WARGA_USER)
    if code == 0 and os.path.exists(dest):
        try:
            os.remove(dest)
        except OSError:
            pass
        return False, f"REACHABLE — {WARGA_USER} copied the blob out"
    return True, f"copy refused for {WARGA_USER} (exit {code})"


def v6_root_reads_store() -> tuple[bool, str]:
    """6. ROOT warga reads the token store with an UNCONFINED interpreter.

    READ THE NUANCE — an earlier version of this suite stated the conclusion
    wrongly. It said "no LSM mechanism denies root on the same kernel". That is
    FALSE, and V2 of this same suite already contradicted it: `/usr/bin/gws` run
    as root IS denied (exit 4) because that exec enters an AppArmor profile.

    What is actually true, and what this vector measures:

        same uid (0), same kernel, same file
          unconfined process  -> READABLE
          confined   process  -> DENIED

    AppArmor binds root. The gap is not "root is ungovernable" — it is that the
    processes which constitute the threat are NOT CONFINED. Root can also
    deliberately escape with `aa-exec`, so the boundary is default-deny with an
    openable door, not a wall.

    Remedy, in order of strength:
      1. CONFINE THE CALLERS (a deny-only profile on the agent processes). This
         binds root and needs no filesystem move. Repro:
         /root/A-FORGE/bridges/evidence/repro-confine-denies-root.sh
      2. Run citizens as non-root — DAC then binds as well.
      3. Move custody off-host.
    """
    code, out, err = run(["cat", str(TOKEN_FILE)])
    if code == 0 and len(out) > 10:
        return False, (f"ROOT-UNCONFINED can read the store ({len(out)} chars) — "
                       "confining the caller would deny this")
    return True, "root denied (unconfined read unexpectedly blocked)"


def v7_root_node_direct() -> tuple[bool, str]:
    """7. ROOT warga, node on run.js — profile attaches on shebang, not argv."""
    if not GWS_CLI_JS.exists():
        return True, "cli js not present"
    code, out, err = run(["node", str(GWS_CLI_JS), "gmail", "users",
                          "labels", "list", "--params", '{"userId":"me"}'])
    if looks_like_gmail_data(code, out):
        return False, f"ROOT reachable via node (exit {code})"
    return True, f"no data (exit {code})"


def v8_path_mediated() -> tuple[bool, str]:
    """8. Does bare `gws` resolve to the mediated shim?"""
    code, out, err = run(["bash", "-lc", "type -a gws"])
    if code != 0:
        return True, "gws not on PATH"
    first = out.strip().splitlines()[0] if out.strip() else ""
    if "/usr/local/bin/gws" in first:
        return True, "PATH resolves to the broker shim"
    return False, f"PATH resolves to the raw CLI ({shutil.which('gws')})"


def v9_broker_refuses_anonymous() -> tuple[bool, str]:
    """9. Does the broker refuse an undeclared caller?"""
    code, out, err = run(["python3", "/opt/mailgw/mailgw_client.py",
                          "gmail", "users", "labels", "list",
                          "--params", '{"userId":"me"}'],
                         as_user=WARGA_USER)
    if "ACTOR_ID_REQUIRED" in (out + err):
        return True, "broker refuses undeclared callers"
    if looks_like_gmail_data(code, out):
        return False, "REACHABLE — broker served an anonymous call"
    return True, f"not served (exit {code})"


def v10_armor_profiles_loaded() -> tuple[bool, str]:
    """10. Are both chokepoint profiles loaded and enforcing?"""
    code, out, err = run(["aa-status"])
    blob = out + err
    if "arifos-gws-citizen" in blob and "arifos-gws-broker" in blob:
        return True, "both chokepoint profiles loaded"
    return False, "profiles NOT loaded — the deny is not in force"


def v11_broker_not_root() -> tuple[bool, str]:
    """11. Does the broker run as the dedicated service identity?"""
    code, out, err = run(["systemctl", "show", "-p", "MainPID", "--value",
                          "mailgw-broker"])
    pid = out.strip()
    if not pid or pid == "0":
        return False, "broker not running"
    code, out2, err2 = run(["ps", "-o", "user=", "-p", pid])
    user = out2.strip()
    if user == "mail-gateway":
        return True, f"broker runs as {user} (uid boundary holds)"
    return False, f"broker runs as '{user}' — must be mail-gateway"


def v12_socket_only_for_warga() -> tuple[bool, str]:
    """12. Can a non-group user reach the socket? (should not)"""
    code, out, err = run(["python3", "-c",
                          "import socket;s=socket.socket(socket.AF_UNIX);"
                          "s.connect('/run/mailgw/broker.sock');print('CONNECTED')"],
                         as_user="nobody")
    if "CONNECTED" in out:
        return False, "socket reachable by an unrelated user"
    return True, f"socket closed to non-group users (exit {code})"


VECTORS = [
    # (label, fn, class)
    ("V1 bare `gws` on PATH is mediated", v1_bare_path_mediated, "DEFECT"),
    ("V2 absolute /usr/bin/gws", v2_absolute_path, "DEFECT"),
    ("V3 non-root warga: node run.js", v3_node_direct_as_warga, "DEFECT"),
    ("V4 non-root warga reads token store", v4_nonroot_reads_store, "DEFECT"),
    ("V5 non-root warga copies credential", v5_nonroot_copies_credential, "DEFECT"),
    ("V6 ROOT warga reads token store", v6_root_reads_store, "ROOT_RESIDUAL"),
    ("V7 ROOT warga: node run.js", v7_root_node_direct, "ROOT_RESIDUAL"),
    ("V8 PATH mediated by shim", v8_path_mediated, "DEFECT"),
    ("V9 broker refuses anonymous", v9_broker_refuses_anonymous, "DEFECT"),
    ("V10 AppArmor profiles loaded", v10_armor_profiles_loaded, "DEFECT"),
    ("V11 broker runs as mail-gateway", v11_broker_not_root, "DEFECT"),
    ("V12 socket closed to non-group", v12_socket_only_for_warga, "DEFECT"),
]


def meta_selftest() -> tuple[bool, str]:
    """Prove the suite can detect an OPEN path, for text AND binary."""
    txt = Path("/tmp/.gws_meta_text")
    binp = Path("/tmp/.gws_meta_bin")
    problems = []
    try:
        txt.write_text("probe-payload-1234567890")
        code, out, err = run(["cat", str(txt)])
        if not (code == 0 and "probe-payload" in out):
            problems.append("text control not detected as open")

        binp.write_bytes(bytes(range(256)) * 8)
        code, out, err = run(["cat", str(binp)])
        if not (code == 0 and len(out) >= 2048):
            problems.append(
                f"binary control not detected as open (exit {code}, {len(out)} chars)")
    finally:
        for p in (txt, binp):
            try:
                p.unlink()
            except OSError:
                pass

    if problems:
        return False, "SUITE BLIND — " + "; ".join(problems)
    return True, "suite detects known-open text AND binary controls"


def main() -> int:
    as_json = "--json" in sys.argv
    meta_ok, meta_detail = meta_selftest()

    results = []
    for name, fn, vclass in VECTORS:
        try:
            blocked, detail = fn()
        except Exception as e:  # noqa: BLE001
            blocked, detail = False, f"probe error: {e}"
        results.append({"vector": name, "blocked": blocked,
                        "detail": detail, "class": vclass})

    open_defects = [r for r in results if not r["blocked"] and r["class"] == "DEFECT"]
    open_residual = [r for r in results
                     if not r["blocked"] and r["class"] == "ROOT_RESIDUAL"]
    enforced = len(results) - len(open_defects) - len(open_residual)

    if open_defects:
        verdict = "DEFECT_OPEN"
    elif open_residual:
        verdict = "ENFORCED_WITH_ROOT_RESIDUAL"
    else:
        verdict = "ENFORCED"

    report = {
        "suite": "gws_truth_test",
        "meta_selftest": {"ok": meta_ok, "detail": meta_detail},
        "verdict": verdict,
        "enforced": enforced,
        "total": len(results),
        "open_defects": [r["vector"] for r in open_defects],
        "open_root_residual": [r["vector"] for r in open_residual],
        "results": results,
        "note": (
            "DEFECT = closeable; close it. ROOT_RESIDUAL = reachable only by an "
            "UNCONFINED process; the fix is to confine the callers, not to move "
            "the files. Corrected 2026-09-20: an earlier version of this note "
            "claimed 'no LSM denies root on the same kernel' — that is FALSE and "
            "this suite's own V2 refutes it. See "
            "bridges/evidence/repro-confine-denies-root.sh for the controlled "
            "proof: same uid, same file, same kernel; unconfined -> READABLE, "
            "confined by an AppArmor deny rule -> DENIED."
        ),
    }

    if as_json:
        print(json.dumps(report, indent=2))
    else:
        print("=" * 76)
        print("GMAIL CAPABILITY BOUNDARY — HONEST VERIFICATION")
        print("=" * 76)
        print(f"meta self-test : {'OK' if meta_ok else 'FAILED'} — {meta_detail}")
        print(f"citizen identity under test: {WARGA_USER}")
        print()
        for r in results:
            mark = "BLOCKED" if r["blocked"] else "OPEN   "
            tag = "" if r["blocked"] else f"  [{r['class']}]"
            print(f"  [{mark}] {r['vector']}{tag}")
            print(f"            {r['detail']}")
        print()
        print("-" * 76)
        print(f"VERDICT: {verdict}  ({enforced}/{len(results)} blocked)")
        if open_defects:
            print()
            print("OPEN DEFECTS — closeable, close them:")
            for v in open_defects:
                print(f"  - {v['vector']}")
        if open_residual:
            print()
            print("ROOT RESIDUAL — reachable by an UNCONFINED process only:")
            for v in open_residual:
                print(f"  - {v['vector']}")
            print()
            print("A root process CAN read the token store while unconfined, and can")
            print("`aa-exec` into the broker profile. But the LSM DOES bind root where")
            print("it is applied — V2 above proves it, and a controlled test confirms")
            print("it directly (bridges/evidence/repro-confine-denies-root.sh):")
            print("  same uid, same file, same kernel ->")
            print("    unconfined process : READABLE")
            print("    confined by AppArmor deny rule : DENIED")
            print("Fix = CONFINE THE CALLERS. Moving the files does not help; root")
            print("reads any file regardless of ownership.")
        print("=" * 76)

    return 0 if not open_defects else 1


if __name__ == "__main__":
    sys.exit(main())
