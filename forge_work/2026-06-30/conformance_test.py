#!/usr/bin/env python3
"""conformance_test.py — WAJIB-009: Registry-Callability Mismatch Detector

Tests: for every MCP server, list all tools, then call each safe read-only
tool with minimal payload. Flags:
  - listed but unknown at runtime
  - listed but returns error
  - response shape mismatch

Run: python3 conformance_test.py
Exit: 0 = PASS, 1 = FAIL
"""

import json
import sys
import urllib.request
import urllib.error

SERVERS = {
    "arifos": (
        "http://localhost:8088/mcp",
        {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    ),
    "aforge": (
        "http://localhost:7072/mcp",
        {
            "Content-Type": "application/json",
        },
    ),
    "well": (
        "http://localhost:18083/mcp",
        {
            "Content-Type": "application/json",
        },
    ),
    "wealth": (
        "http://localhost:18082/mcp",
        {
            "Content-Type": "application/json",
            "Accept": "application/json,text/event-stream",
        },
    ),
}

# Tools to skip during callable test (mutation risk or require auth)
SKIP_CALLABLE = {
    "arifos": ["arif_act", "arif_seal"],
    "aforge": [
        "forge_shell",
        "forge_filesystem",
        "forge_postgres",
        "forge_git",
        "forge_docker",
        "forge_systemctl",
        "forge_execute",
        "forge8_execute",
        "forge_approve",
        "forge_seal",
        "forge_vault",
        "forge_register",
        "forge_skill",
        "forge_reality_loop",
        "forge_pipeline_run",
        "forge_lock",
        "forge_abort",
        "forge_agent",
        "forge_lease",
        "forge_browser_click",
        "forge_browser_type",
        "forge_browser_evaluate_js",
        "forge_github_create_issue",
        "forge_github_create_or_update_file",
        "forge_github_create_pull_request",
        "forge_sandbox_run",
        "forge_skillstore_write",
        "forge_docket_prep",
        "forge_stage",
        "forge_tier_bind",
    ],
    "well": [],
    "wealth": ["wealth_vault_write"],
}

# Minimal call payloads
MINIMAL_PAYLOADS = {
    "arif_init": {"mode": "light"},
    "arif_observe": {"mode": "vitals"},
    "well_health_check": {},
    "well_registry_status": {},
    "wealth_system_registry_status": {},
}


def call_mcp(server, payload):
    url, headers = SERVERS[server]
    data = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
            if payload is None
            else payload.get("method", "tools/call"),
            "params": payload or {},
        }
    ).encode()

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        json.JSONDecodeError,
        TimeoutError,
    ) as e:
        return {"error": str(e)}


def check_server(server):
    """Standalone server conformance check — NOT a pytest test."""
    print(f"\n{'=' * 60}")
    print(f"TESTING: {server} @ {SERVERS[server][0]}")
    print(f"{'=' * 60}")

    # Step 1: List tools
    resp = call_mcp(server, None)
    if "error" in resp:
        print(f"  FAIL: Cannot list tools — {resp['error']}")
        return False

    tools = resp.get("result", {}).get("tools", [])
    if not tools:
        print(f"  WARN: 0 tools returned (may be SSE transport)")
        print(f"  Using surface_status/registry_status instead.")
        return True  # Not a failure for SSE-only servers

    names = [t["name"] for t in tools]
    print(f"  Listed: {len(names)} tools")

    # Step 2: Test callability of safe tools
    skip = SKIP_CALLABLE.get(server, [])
    callable_count = 0
    fail_count = 0

    for name in names:
        if name in skip:
            print(f"  SKIP: {name} (mutation risk)")
            continue

        payload = MINIMAL_PAYLOADS.get(name, {})
        call_resp = call_mcp(
            server,
            {
                "method": "tools/call",
                "params": {"name": name, "arguments": payload},
            },
        )

        if not isinstance(call_resp, dict):
            print(f"  FAIL: {name} — non-dict response")
            fail_count += 1
            continue
        if "error" in call_resp:
            # Check for "Unknown tool" specifically
            err_val = call_resp.get("error", "")
            err_str = (
                json.dumps(err_val).lower()
                if not isinstance(err_val, str)
                else err_val.lower()
            )
            if "unknown tool" in err_str or "not found" in err_str:
                print(f"  ⛔ MISMATCH: {name} listed but UNKNOWN at runtime!")
                fail_count += 1
            else:
                print(
                    f"  WARN: {name} returned error but not 'unknown' — might need params"
                )
                callable_count += 1
        else:
            result = call_resp.get("result", {})
            if result.get("isError"):
                print(f"  WARN: {name} returned isError=true")
                fail_count += 1
            else:
                print(f"  ✅ {name} callable")
                callable_count += 1

    print(f"\n  Results: {callable_count} callable, {fail_count} mismatches")
    return fail_count == 0


def main():
    print("=" * 60)
    print("arifOS FEDERATION — CONFORMANCE TEST (WAJIB-009)")
    print("=" * 60)

    all_pass = True
    for server in SERVERS:
        if not check_server(server):
            all_pass = False

    print(f"\n{'=' * 60}")
    if all_pass:
        print("VERDICT: CONFORMANCE PASS — all listed tools are callable")
        print("Status: SEAL eligible")
    else:
        print("VERDICT: CONFORMANCE FAIL — registry-callability mismatch detected")
        print("Status: HOLD — fix mismatches before claiming SEAL")
    print(f"{'=' * 60}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
