#!/usr/bin/env python3
"""
mailgw_grant.py — give an agent identity read access to the mail gateway.

WHY: agents reach the mailbox through /run/mailgw/broker.sock, which is
group-owned by `mailgw-clients`. A reader must be in that group. This script is
the one sanctioned way to add one, so the grant is visible and repeatable rather
than an ad-hoc `usermod` someone half-remembers.

WHAT IT GRANTS: READ only. Membership of mailgw-clients admits a process to the
socket; it does NOT grant the token store (0700, uid mail-gateway) and does NOT
authorise send/forward/trash — those need a sovereign F13 token at the broker
regardless of group membership.

Usage:
    mailgw_grant.py --list                 # who has access now
    mailgw_grant.py --add <user>           # grant
    mailgw_grant.py --remove <user>        # revoke
    mailgw_grant.py --verify <user>        # prove the grant works end to end
"""

from __future__ import annotations

import argparse
import grp
import json
import subprocess
import sys
from pathlib import Path

GROUP = "mailgw-clients"
SOCKET = Path("/run/mailgw/broker.sock")
CLIENT = "/opt/mailgw/mailgw_client.py"


def group_members() -> list[str]:
    try:
        return sorted(grp.getgrnam(GROUP).gr_mem)
    except KeyError:
        return []


def cmd(argv: list[str]) -> tuple[int, str]:
    r = subprocess.run(argv, capture_output=True, text=True, errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip()


def show() -> int:
    members = group_members()
    print(f"group: {GROUP}")
    print(f"socket: {SOCKET}  {'present' if SOCKET.exists() else 'ABSENT'}")
    if SOCKET.exists():
        st = SOCKET.stat()
        import stat as st_mod
        print(f"        mode {st_mod.filemode(st.st_mode)}  "
              f"uid {st.st_uid}  gid {st.st_gid}")
    print("members:")
    if not members:
        print("  (none)")
    for m in members:
        print(f"  {m}")
    print()
    print("note: members may READ. The token store stays 0700 under uid")
    print("      mail-gateway; send/forward/trash need an F13 token.")
    return 0


def add(user: str) -> int:
    code, out = cmd(["id", "-u", user])
    if code != 0:
        print(f"ERROR: user '{user}' does not exist.", file=sys.stderr)
        return 2
    if user in group_members():
        print(f"{user} is already in {GROUP}; nothing to do.")
        return 0
    code, out = cmd(["usermod", "-aG", GROUP, user])
    if code != 0:
        print(f"ERROR granting {user}: {out}", file=sys.stderr)
        return 1
    # Group membership is read at process start; tell the operator what that means.
    print(f"granted: {user} -> {GROUP}")
    print("NOTE: the grant applies to NEW processes. A running agent keeps its "
          "old")
    print("      group set until it restarts.")
    return verify(user)


def remove(user: str) -> int:
    code, out = cmd(["gpasswd", "-d", user, GROUP])
    if code != 0:
        print(f"ERROR revoking {user}: {out}", file=sys.stderr)
        return 1
    print(f"revoked: {user} removed from {GROUP}")
    return 0


def verify(user: str) -> int:
    """Prove the grant end to end: as `user`, ask the broker for mailbox labels."""
    if not SOCKET.exists():
        print("VERIFY FAILED: broker socket absent.", file=sys.stderr)
        return 1
    script = (
        f"import socket,json;"
        f"s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);"
        f"s.settimeout(40);"
        f"s.connect({str(SOCKET)!r});"
        f"s.sendall((json.dumps({{'actor_id':'GRANT-VERIFY','purpose':"
        f"'verify mail gateway grant for {user}',"
        f"'argv':['gmail','users','labels','list','--params','{{\"userId\":\"me\"}}']}})+chr(10)).encode());"
        f"buf=b'';"
        f"\nwhile not buf.endswith(b'\\n'):\n"
        f"    c=s.recv(65536)\n"
        f"    if not c: break\n"
        f"    buf+=c\n"
        f"d=json.loads(buf.decode());"
        f"print('STATUS', d.get('status'), 'exit', d.get('exit_code'))"
    )
    code, out = cmd(["sudo", "-u", user, "--", "python3", "-c", script])
    ok = "STATUS OK" in out
    print(f"verify {user}: {'PASS' if ok else 'FAIL'} — {out[:200]}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="mail gateway access grants")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--add")
    ap.add_argument("--remove")
    ap.add_argument("--verify")
    a = ap.parse_args()

    if a.list:
        return show()
    if a.add:
        return add(a.add)
    if a.remove:
        return remove(a.remove)
    if a.verify:
        return verify(a.verify)
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
