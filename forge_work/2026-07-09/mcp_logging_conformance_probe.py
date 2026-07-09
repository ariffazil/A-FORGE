#!/usr/bin/env python3
"""MCP logging/completions conformance probe (Phase 4).

Checks per organ:
  L1  logging capability present XOR absent consistently with setLevel method
  L2  if logging declared → logging/setLevel returns result (not -32601)
  L3  if logging absent → setLevel is method-not-found OR not advertised
  L4  completions ABSENT until handlers exist (must not declare without handler)
  L5  if completions declared → completion/complete is not -32601 Method not found
  L6  serverInfo.name is non-empty (identity)

Exit 0 if all pass; 1 if any fail.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

ORGANS: list[tuple[str, str, dict[str, Any]]] = [
    # name, url, expectations
    ("arifOS", "http://127.0.0.1:8088/mcp", {"logging": True, "completions": False}),
    ("GEOX", "http://127.0.0.1:8081/mcp", {"logging": True, "completions": False}),
    ("WEALTH", "http://127.0.0.1:18082/mcp", {"logging": True, "completions": False}),
    ("WELL", "http://127.0.0.1:18083/mcp", {"logging": True, "completions": False}),
    ("A-FORGE", "http://127.0.0.1:7072/mcp", {"logging": False, "completions": False}),
]


def _post(url: str, method: str, params: dict, sid: str | None = None) -> tuple[dict, str | None]:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if sid:
        headers["Mcp-Session-Id"] = sid
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = r.read().decode()
        new_sid = r.headers.get("mcp-session-id") or sid
    if "data:" in raw:
        for line in raw.splitlines():
            if line.startswith("data:"):
                raw = line[5:].strip()
                break
    return json.loads(raw), new_sid


def probe_one(name: str, url: str, exp: dict[str, Any]) -> list[str]:
    fails: list[str] = []
    try:
        init, sid = _post(
            url,
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "conformance-probe", "version": "0"},
            },
        )
    except Exception as e:
        return [f"{name}: initialize failed: {e}"]

    if "error" in init:
        return [f"{name}: initialize error {init['error']}"]

    result = init.get("result") or {}
    caps = result.get("capabilities") or {}
    info = result.get("serverInfo") or {}
    logging_declared = "logging" in caps
    completions_declared = "completions" in caps

    # L6 identity
    if not info.get("name"):
        fails.append(f"{name}: L6 serverInfo.name empty")

    # L1 / L2 / L3 logging
    if exp["logging"] and not logging_declared:
        fails.append(f"{name}: L1 expected logging:{{}} missing")
    if not exp["logging"] and logging_declared:
        fails.append(f"{name}: L1 unexpected logging claim")

    try:
        set_resp, sid = _post(url, "logging/setLevel", {"level": "error"}, sid)
        set_err = set_resp.get("error")
        set_ok = "result" in set_resp and not set_err
        set_method_missing = bool(
            set_err and set_err.get("code") == -32601
        )
        if logging_declared and not set_ok:
            fails.append(f"{name}: L2 setLevel failed while logging declared: {set_err}")
        if not logging_declared and set_ok:
            # soft: some servers accept silently — note only if they claim nothing but implement
            pass
        if not logging_declared and not set_method_missing and set_err:
            # unexpected error shape — soft
            pass
    except urllib.error.HTTPError as e:
        if logging_declared:
            fails.append(f"{name}: L2 setLevel HTTP {e.code} while logging declared")
    except Exception as e:
        if logging_declared:
            fails.append(f"{name}: L2 setLevel exception: {e}")

    # L4 / L5 completions
    if exp["completions"] is False and completions_declared:
        fails.append(f"{name}: L4 completions declared but deferred (handler may be missing)")
    if completions_declared:
        try:
            c_resp, _ = _post(
                url,
                "completion/complete",
                {
                    "ref": {"type": "ref/prompt", "name": "x"},
                    "argument": {"name": "a", "value": "p"},
                },
                sid,
            )
            c_err = c_resp.get("error")
            if c_err and c_err.get("code") == -32601:
                fails.append(f"{name}: L5 completions declared but complete → -32601")
        except Exception as e:
            fails.append(f"{name}: L5 complete exception: {e}")
    else:
        # ensure complete is not advertised — optional check method missing
        try:
            c_resp, _ = _post(
                url,
                "completion/complete",
                {
                    "ref": {"type": "ref/prompt", "name": "x"},
                    "argument": {"name": "a", "value": "p"},
                },
                sid,
            )
            c_err = c_resp.get("error")
            if c_err is None and "result" in c_resp:
                fails.append(
                    f"{name}: L4 complete succeeded but completions not declared (odd)"
                )
        except Exception:
            pass

    # WELL identity anti-regression
    if name == "WELL":
        sname = str(info.get("name") or "")
        if sname.upper().startswith("ARIFOS") or "ARIFOS" in sname.upper():
            fails.append(f"{name}: identity regression — serverInfo={info}")

    return fails


def main() -> int:
    all_fails: list[str] = []
    print("=== MCP logging/completions conformance ===")
    for name, url, exp in ORGANS:
        fails = probe_one(name, url, exp)
        status = "PASS" if not fails else "FAIL"
        print(f"  {name:8} {status}")
        for f in fails:
            print(f"           - {f}")
            all_fails.append(f)

    # Bridge unit (offline)
    try:
        sys.path.insert(0, "/root/arifOS")
        sys.path.insert(0, "/opt/arifos/app")
        from arifosmcp.runtime.mcp_log_bridge import evaluate_log_for_hold

        d1 = evaluate_log_for_hold(level="alert", data={})
        assert d1.action == "NONE", d1
        d2 = evaluate_log_for_hold(level="warning", data={"verdict": "HOLD", "floor": "F7"})
        assert d2.action == "HOLD_CANDIDATE", d2
        d3 = evaluate_log_for_hold(level="info", data={"floor": "F13", "verdict": "888_HOLD"})
        assert d3.action == "HOLD_CANDIDATE" and d3.requires_human, d3
        print("  bridge   PASS")
    except Exception as e:
        print(f"  bridge   FAIL — {e}")
        all_fails.append(f"bridge: {e}")

    print("=== result ===")
    if all_fails:
        print(f"FAIL ({len(all_fails)} issues)")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
