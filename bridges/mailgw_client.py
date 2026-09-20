#!/usr/bin/env python3
"""
mailgw_client.py — client for the arifOS Token-Custody Broker.

Any agent that needs Google Workspace runs this instead of `gws` directly.
It carries the actor's identity and a stated purpose to the broker, which
enforces authority and writes the receipt.

    mailgw_client.py --actor-id HERMES --purpose "check for owner reply" \
        gmail users messages list --params '{"userId":"me","maxResults":5}'

Or, installed as the PATH shim, it inherits identity from the environment:

    MAILGW_ACTOR=HERMES MAILGW_PURPOSE="..." gws gmail users labels list

Exit code mirrors the underlying gws call, so existing pipelines keep working.
"""

from __future__ import annotations

import json
import os
import socket
import sys
from pathlib import Path

SOCKET_PATH = Path(os.getenv("MAILGW_SOCKET", "/run/mailgw/broker.sock"))
TIMEOUT = int(os.getenv("MAILGW_TIMEOUT", "90"))


def call(req: dict) -> dict:
    if not SOCKET_PATH.exists():
        return {
            "ok": False, "status": "BROKER_UNAVAILABLE",
            "detail": (f"No broker socket at {SOCKET_PATH}. The sanctioned mail "
                       "path is down - do not fall back to calling gws directly; "
                       "that path is confined and will refuse."),
        }
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(TIMEOUT)
        s.connect(str(SOCKET_PATH))
        s.sendall((json.dumps(req) + "\n").encode())
        buf = b""
        while not buf.endswith(b"\n"):
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    try:
        return json.loads(buf.decode(errors="replace"))
    except json.JSONDecodeError:
        return {"ok": False, "status": "BAD_RESPONSE",
                "detail": buf[:400].decode(errors="replace")}


def main() -> int:
    argv = sys.argv[1:]

    # Explicit identity flags are stripped before the remaining argv is forwarded.
    actor = os.getenv("MAILGW_ACTOR", "")
    purpose = os.getenv("MAILGW_PURPOSE", "")
    f13 = os.getenv("MAILGW_F13_TOKEN", "")
    rest: list[str] = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--actor-id", "--purpose", "--f13-token") and i + 1 < len(argv):
            val = argv[i + 1]
            if a == "--actor-id":
                actor = val
            elif a == "--purpose":
                purpose = val
            else:
                f13 = val
            i += 2
            continue
        rest.append(a)
        i += 1

    if not actor:
        print(json.dumps({
            "ok": False, "status": "ACTOR_ID_REQUIRED",
            "detail": ("Set --actor-id or MAILGW_ACTOR. Anonymous access to the "
                       "owner's mail is not permitted."),
        }, indent=2))
        return 2

    if not purpose:
        print(json.dumps({
            "ok": False, "status": "PURPOSE_REQUIRED",
            "detail": ("Set --purpose or MAILGW_PURPOSE with a specific, "
                       "falsifiable reason for this call."),
        }, indent=2))
        return 2

    req = {"actor_id": actor, "purpose": purpose, "argv": rest}
    if f13:
        req["f13_token"] = f13

    resp = call(req)

    if resp.get("stdout"):
        sys.stdout.write(resp["stdout"])
    if resp.get("stderr"):
        sys.stderr.write(resp["stderr"])

    if not resp.get("ok"):
        # Surface the refusal in a machine-readable way on stdout as well,
        # so a caller parsing output sees the gate, not silence.
        if not resp.get("stdout") and not resp.get("stderr"):
            print(json.dumps(resp, indent=2))
        return 3 if resp.get("status") != "NONZERO_EXIT" else resp.get(
            "exit_code", 1)

    return int(resp.get("exit_code", 0))


if __name__ == "__main__":
    sys.exit(main())
