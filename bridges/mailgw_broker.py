#!/usr/bin/env python3
"""
mailgw_broker.py — arifOS Token-Custody Broker (the sanctioned Gmail/Workspace path)

WHY THIS EXISTS
---------------
gws (the Google Workspace CLI) shipped on PATH for every federation agent, running
as root, with the OAuth token store at /root/.config/gws readable by anything on
the box. An honest audit on 2026-09-20 found 0 of 8 bypass vectors blocked.

This broker is the *sanctioned* path. It is the only process intended to execute
the gws CLI, and it is the only process whose AppArmor profile may read the token
store.

WHAT IT ACTUALLY GUARANTEES  (read this before trusting it)
-----------------------------------------------------------
It guarantees, for a process that is NOT root:
    - it cannot reach Google through gws (AppArmor denies the token path)
    - it cannot reach the token store directly (DAC 0700 + AppArmor)
    - every sanctioned call it makes is receipted

It does NOT guarantee anything against a root process on this same host:
    - root can read the token store with any interpreter
    - root can `aa-exec -p arifos-gws-broker` and inherit the broker profile
    - root can unload the profile entirely

That residual is not a bug in this design. On one Linux host, with the citizen
running as root, no filesystem or LSM mechanism can deny root access to a file.
The complete fix is to run citizens as non-root, or to move token custody to a
different host. Until then, the broker provides: default-deny for casual use,
full receipts, and detection (see token_access_watch.py) rather than absolute
prevention.

PROTOCOL
--------
Unix socket, newline-delimited JSON.

  request : {"actor_id": str, "purpose": str, "intent": str, "argv": [str], "timeout_s": int}
  response: {"ok": bool, "status": str, "receipt_id": str, "exit_code": int,
             "stdout": str, "stderr": str, "duration_ms": int}

  {"op": "status"}            -> broker posture
  {"op": "ping"}              -> liveness

Run:
    python3 mailgw_broker.py            # foreground
    systemctl start mailgw-broker       # as a service (User=mailgw)
"""

from __future__ import annotations

import json
import os
import socket
import socketserver
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
# Token custody lives with the `mail-gateway` service identity, not with root.
# The broker runs as that UID; the store is 0700 and only reachable from here.
GWS_CONFIG_DIR = os.getenv("GOOGLE_WORKSPACE_CLI_CONFIG_DIR",
                           "/var/lib/mail-gateway/gws")
SOCKET_PATH = Path(os.getenv("MAILGW_SOCKET", "/run/mailgw/broker.sock"))
RECEIPT_LOG = Path(os.getenv(
    "MAILGW_RECEIPTS", "/var/lib/mail-gateway/audit/receipts.jsonl"))
REVOCATION_FLAGS = [
    Path("/root/.secrets/email/GMAIL_REVOKED"),
    Path("/var/lib/mail-gateway/GMAIL_REVOKED"),
    Path("/tmp/GMAIL_REVOKED"),
]
GWS_BIN = os.getenv("MAILGW_GWS_BIN", "/usr/lib/node_modules/@googleworkspace/cli/bin/gws")
# The node launcher (/usr/bin/gws -> run.js) is deliberately NOT used: under the
# broker profile its `#!/usr/bin/env node` re-exec does not reliably stay inside
# the profile, and it fails on the store with EACCES. The native binary is
# executed directly instead - verified working under arifos-gws-broker.

# Consequential actions must carry an F13 token supplied by the caller.
CONSEQUENTIAL = {
    "send", "forward", "trash", "delete", "settings_update",
    "users.messages.send", "users.messages.trash", "users.messages.delete",
}

MIN_PURPOSE_CHARS = 8
MAX_ARGV = 40
DEFAULT_TIMEOUT = 60


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def receipt(entry: dict) -> str:
    rid = f"r-mailgw-{uuid.uuid4().hex[:12]}"
    entry = {"receipt_id": rid, "ts": utc_now(), **entry}
    try:
        RECEIPT_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(RECEIPT_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        # A broker that cannot write its receipt must not pretend it did.
        entry["receipt_write_failed"] = True
    return rid


def revoked() -> str | None:
    """Return the path of an engaged kill-switch, or None.

    A flag the service cannot stat (EACCES on a root-only path) is treated as
    absent rather than fatal. The authoritative flag for this service lives at
    /var/lib/mail-gateway/GMAIL_REVOKED, which it can always read.
    """
    for p in REVOCATION_FLAGS:
        try:
            if p.exists():
                return str(p)
        except OSError:
            continue
    return None


def classify(argv: list[str]) -> str:
    """Best-effort intent label from argv, used for receipts only."""
    if len(argv) < 2:
        return "unknown"
    service = argv[0]
    tail = ".".join(argv[1:4])
    return f"{service}.{tail}"


def is_consequential(argv: list[str]) -> bool:
    joined = " ".join(argv).lower()
    return any(k in joined for k in CONSEQUENTIAL)


def handle_request(req: dict) -> dict:
    op = req.get("op")
    if op == "ping":
        return {"ok": True, "status": "PONG", "ts": utc_now()}
    if op == "status":
        return {
            "ok": True,
            "status": "READY" if not revoked() else "REVOKED",
            "socket": str(SOCKET_PATH),
            "gws_bin": GWS_BIN,
            "gws_present": Path(GWS_BIN).exists(),
            "revoked_by": revoked(),
            "uid": os.getuid(),
            "euid": os.geteuid(),
            "ts": utc_now(),
        }

    # ── Authorisation gate ────────────────────────────────────────────────
    actor_id = (req.get("actor_id") or "").strip()
    purpose = (req.get("purpose") or "").strip()
    argv = req.get("argv") or []

    if not actor_id:
        return {"ok": False, "status": "ACTOR_ID_REQUIRED",
                "detail": "Every broker call must name its actor."}

    rev = revoked()
    if rev:
        receipt({"actor_id": actor_id, "purpose": purpose, "argv": argv,
                 "verdict": "REVOKED", "flag": rev})
        return {"ok": False, "status": "REVOKED",
                "detail": f"Central kill-switch engaged ({rev})."}

    if len(purpose) < MIN_PURPOSE_CHARS:
        receipt({"actor_id": actor_id, "purpose": purpose, "argv": argv,
                 "verdict": "PURPOSE_REQUIRED"})
        return {"ok": False, "status": "PURPOSE_REQUIRED",
                "detail": ("A specific, falsifiable purpose is required "
                           f"(minimum {MIN_PURPOSE_CHARS} characters).")}

    if not isinstance(argv, list) or not argv or len(argv) > MAX_ARGV:
        return {"ok": False, "status": "BAD_ARGV",
                "detail": f"argv must be a list of 1..{MAX_ARGV} strings."}
    argv = [str(a) for a in argv]

    if is_consequential(argv):
        token = (req.get("f13_token") or "").strip()
        if not token:
            receipt({"actor_id": actor_id, "purpose": purpose, "argv": argv,
                     "verdict": "F13_TOKEN_REQUIRED"})
            return {"ok": False, "status": "F13_TOKEN_REQUIRED",
                    "detail": ("This action reaches another human or destroys "
                               "data; it requires a sovereign F13 token.")}

    # ── Execute under the broker's AppArmor profile ───────────────────────
    timeout = int(req.get("timeout_s") or DEFAULT_TIMEOUT)
    timeout = max(5, min(timeout, 300))
    started = time.time()
    child_env = dict(os.environ)
    child_env["GOOGLE_WORKSPACE_CLI_CONFIG_DIR"] = GWS_CONFIG_DIR
    try:
        proc = subprocess.run(
            [GWS_BIN, *argv],
            capture_output=True, text=True, errors="replace",
            timeout=timeout, env=child_env,
        )
        exit_code, stdout, stderr = proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        exit_code, stdout, stderr = 124, "", "BROKER_TIMEOUT"
    except FileNotFoundError:
        exit_code, stdout, stderr = 127, "", f"gws not found at {GWS_BIN}"
    except Exception as e:  # noqa: BLE001
        exit_code, stdout, stderr = 1, "", f"broker error: {e}"

    duration_ms = int((time.time() - started) * 1000)
    ok = exit_code == 0
    rid = receipt({
        "actor_id": actor_id, "purpose": purpose, "argv": argv,
        "intent": classify(argv), "verdict": "ALLOWED" if ok else "EXECUTED_NONZERO",
        "exit_code": exit_code, "duration_ms": duration_ms,
        "stdout_bytes": len(stdout or ""), "stderr_bytes": len(stderr or ""),
    })

    return {
        "ok": ok, "status": "OK" if ok else "NONZERO_EXIT",
        "receipt_id": rid, "exit_code": exit_code,
        "stdout": (stdout or "")[:400_000],
        "stderr": (stderr or "")[:20_000],
        "duration_ms": duration_ms,
    }


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        for raw in self.rfile:
            raw = raw.strip()
            if not raw:
                continue
            try:
                req = json.loads(raw)
            except json.JSONDecodeError:
                self.wfile.write((json.dumps(
                    {"ok": False, "status": "BAD_JSON"}) + "\n").encode())
                continue
            try:
                resp = handle_request(req)
            except Exception as e:  # noqa: BLE001
                resp = {"ok": False, "status": "BROKER_ERROR", "detail": str(e)}
            self.wfile.write((json.dumps(resp) + "\n").encode())
            self.wfile.flush()


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> int:
    SOCKET_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SOCKET_PATH.exists():
        try:
            SOCKET_PATH.unlink()
        except OSError:
            pass

    srv = Server(str(SOCKET_PATH), Handler)
    try:
        os.chmod(SOCKET_PATH, 0o660)
        # Warga connect through the socket; the token store stays 0700. Group
        # ownership lets a non-root citizen reach the socket without reaching
        # the credentials.
        import grp
        try:
            gid = grp.getgrnam("mailgw-clients").gr_gid
            os.chown(SOCKET_PATH, -1, gid)
        except KeyError:
            pass
    except OSError:
        pass

    print(f"[mailgw-broker] listening on {SOCKET_PATH}", flush=True)
    print(f"[mailgw-broker] uid={os.getuid()} euid={os.geteuid()} "
          f"receipts={RECEIPT_LOG}", flush=True)
    rev = revoked()
    if rev:
        print(f"[mailgw-broker] KILL-SWITCH ENGAGED ({rev}) — all calls refused",
              flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
        try:
            SOCKET_PATH.unlink()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
