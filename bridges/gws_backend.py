#!/usr/bin/env python3
"""
gws_backend.py — Shared gws CLI backend for APA bridges.

Some Google services are out of scope for the gws CLI's current OAuth grant
(drive works, gmail/calendar don't — see gws auth status). This module
gives every bridge a uniform way to call Google APIs:

  - If the service IS in gws scope: call gws CLI, return its JSON.
  - If NOT in gws scope: return a structured error envelope
    explaining the user must grant the OAuth scope for that service.

The bridges in /root/A-FORGE/bridges/* can switch from
google-auth library to this module with minimal code change.
"""

import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

GWS_SCOPES_CACHE = {"path": None, "scopes": None, "ts": 0}
SCOPE_TTL = 30  # seconds


def gws_available_scopes() -> set[str]:
    """Return the set of OAuth scopes currently granted to gws."""
    now = time.time()
    if (
        GWS_SCOPES_CACHE["ts"] > now - SCOPE_TTL
        and GWS_SCOPES_CACHE["scopes"] is not None
    ):
        return GWS_SCOPES_CACHE["scopes"]
    try:
        r = subprocess.run(
            ["gws", "auth", "status"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=10,
        )
        out = r.stdout
        start = out.find("{")
        if start == -1:
            return set()
        data = json.loads(out[start:])
        GWS_SCOPES_CACHE["scopes"] = set(data.get("scopes", []))
        GWS_SCOPES_CACHE["ts"] = now
        GWS_SCOPES_CACHE["path"] = "/root/.config/gws"
        return GWS_SCOPES_CACHE["scopes"]
    except Exception:
        return set()


def service_in_scope(service: str) -> bool:
    """Return True if gws has OAuth scope to call this Google service."""
    scopes = gws_available_scopes()
    mapping = {
        "drive": {"https://www.googleapis.com/auth/drive"},
        "gmail": {
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail",
        },
        "calendar": {
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
        },
        "sheets": {
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/cloud-platform",
        },
    }
    if service not in mapping:
        # Unknown service: assume in scope (caller knows what they're doing)
        return True
    return bool(scopes & mapping[service])


def envelope(
    connector: str,
    verb: str,
    ok: bool,
    result: Any,
    verdict: str = "PROCEED",
    error: str | None = None,
) -> dict:
    return {
        "ok": ok,
        "connector": connector,
        "verb": verb,
        "verdict": verdict if ok else "HOLD",
        "result": result,
        "error": error,
    }


def call_gws(
    service: str,
    resource: str,
    method: str,
    params: dict | None = None,
    body: dict | None = None,
    connector: str = "unknown",
) -> dict:
    """Call gws CLI as subprocess. Returns envelope."""
    verb = f"{resource}.{method}"
    if not service_in_scope(service):
        scopes = gws_available_scopes()
        return envelope(
            connector,
            verb,
            False,
            None,
            verdict="HOLD",
            error=f"gws lacks OAuth scope for {service}. "
            f"Run: gws auth login --services {service} "
            f"(requires browser consent on the VPS)",
        )
    cmd = ["gws", service] + resource.split(".") + [method]
    if params:
        cmd.extend(["--params", json.dumps(params)])
    if body:
        cmd.extend(["--json", json.dumps(body)])
    try:
        # gws writes "Using keyring backend: keyring" to stderr; discard to keep stdout clean
        r = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=30,
        )
        out = r.stdout
        if r.returncode == 0:
            # try to parse JSON
            try:
                return envelope(connector, verb, True, json.loads(out))
            except json.JSONDecodeError:
                return envelope(connector, verb, True, out)
        # non-zero: try to extract error
        try:
            err_data = json.loads(out)
            err_msg = err_data.get("error", {}).get("message", out[:200])
        except json.JSONDecodeError:
            err_msg = (
                out[:200]
                if out
                else (r.stderr[:200] if r.stderr else "gws call failed")
            )
        return envelope(connector, verb, False, None, verdict="HOLD", error=err_msg)
    except subprocess.TimeoutExpired:
        return envelope(
            connector,
            verb,
            False,
            None,
            verdict="HOLD",
            error="gws call timed out (30s)",
        )
    except FileNotFoundError:
        return envelope(
            connector,
            verb,
            False,
            None,
            verdict="VOID",
            error="gws CLI not found in PATH",
        )


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print("Usage: gws_backend.py <service> <resource> <method> [json-params]")
        sys.exit(1)
    service = sys.argv[1]
    resource = sys.argv[2]
    method = sys.argv[3]
    params = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
    print(
        json.dumps(
            call_gws(service, resource, method, params, connector="cli"),
            indent=2,
        )
    )
