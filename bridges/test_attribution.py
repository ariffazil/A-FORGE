#!/usr/bin/env python3
"""Attribution test — does the receipt name the calling agent?

RACE-SAFE: the receipt ledger is written concurrently by live agents (HERMES cron
jobs call gws while this test runs). Reading the last line is therefore wrong — an
earlier draft did that and reported UNIDENTIFIED for calls that were correctly
attributed. Instead, each case stamps a unique purpose marker and we match on it.

The chain must be REAL: agent process -> bash -> gws. The helper sets its own
/proc/self/comm to an agent name and THEN spawns the gws call, so the gws process
genuinely has the agent above it in the process tree.
"""
import json
import subprocess
import sys
import uuid
from pathlib import Path

RECEIPTS = Path("/var/lib/mail-gateway/audit/receipts.jsonl")
HELPER = Path("/tmp/.attrib-helper.py")

HELPER.write_text(
    "import ctypes, subprocess, sys\n"
    "libc = ctypes.CDLL('libc.so.6', use_errno=True)\n"
    "libc.prctl(15, sys.argv[1].encode(), 0, 0, 0)   # PR_SET_NAME\n"
    "env_marker = sys.argv[2] if len(sys.argv) > 2 else 'none'\n"
    "cmd = [\"bash\", \"-c\",\n"
    "       \"MAILGW_PURPOSE='attrib-probe \" + env_marker + \"' \"\n"
    "       \"gws gmail users labels list --params '{\\\"userId\\\":\\\"me\\\"}' \"\n"
    "       \">/dev/null 2>&1\"]\n"
    "subprocess.run(cmd, cwd='/tmp')\n"
)


def receipt_for(marker: str) -> dict | None:
    try:
        lines = RECEIPTS.read_text(errors="replace").splitlines()
    except OSError:
        return None
    for line in reversed(lines[-400:]):
        try:
            d = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        if marker in str(d.get("purpose", "")):
            return d
    return None


def call_as(agent_name: str | None, marker: str) -> dict | None:
    if agent_name is None:
        subprocess.run(
            ["bash", "-c",
             f"MAILGW_PURPOSE='attrib-probe {marker}' "
             "gws gmail users labels list --params '{\"userId\":\"me\"}' "
             ">/dev/null 2>&1"],
            cwd="/tmp")
    else:
        subprocess.run(["/usr/bin/python3", str(HELPER), agent_name, marker],
                       cwd="/tmp")
    return receipt_for(marker)


CASES = [
    # label, agent comm to simulate, expected substring in actor_id
    ("(control: under THIS Hermes)", None, "hermes"),
    ("hermes", "hermes-agent", "hermes-agent"),
    ("opencode", "opencode", "opencode"),
    ("qwen", "qwen-code", "qwen-code"),
    ("kimi", "kimi-code", "kimi-code"),
    ("claude", "claude-code", "claude-code"),
    ("codex", "codex", "codex"),
    ("openclaw", "openclaw", "openclaw"),
]

print("=" * 70)
print("ATTRIBUTION TEST — does the receipt name the calling agent?")
print("=" * 70)
print("NOTE: the control case runs under the live Hermes gateway, so a correct")
print("      result there is 'hermes' — not 'unidentified'.")
print()
ok = True
for label, name, expect in CASES:
    marker = uuid.uuid4().hex[:10]
    d = call_as(name, marker)
    actor = (d or {}).get("actor_id", "<no receipt found>")
    good = d is not None and expect in actor and "UNIDENTIFIED" not in actor
    ok = ok and good
    print(f"  {'OK ' if good else 'BAD'}  {label:28s} -> {actor}")

try:
    HELPER.unlink()
except OSError:
    pass

print()
print("RESULT:", "attribution names each agent" if ok else "ATTRIBUTION INCOMPLETE")
sys.exit(0 if ok else 1)
