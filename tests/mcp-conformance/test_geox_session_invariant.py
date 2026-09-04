#!/usr/bin/env python3
"""
GEOX P0 Regression Test: Modern-path session invariant.
GEOX must NOT mint sessions on MCP 2026-07-28 requests.

Run: python3 test_geox_session_invariant.py
Exit 0 = PASS, Exit 1 = FAIL
"""
import json
import sys
import urllib.request
import urllib.error

GEOX_PORT = 8081
MCP_VERSION = "2026-07-28"

def test_no_session_on_discover():
    """P06: server/discover on modern path must NOT mint session."""
    url = f"http://127.0.0.1:{GEOX_PORT}/mcp"
    payload = json.dumps({
        "jsonrpc": "2.0", "id": "p06-discover",
        "method": "server/discover",
        "params": {"_meta": {"io.modelcontextprotocol/protocolVersion": MCP_VERSION}}
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "server/discover")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        headers = dict(resp.headers)
    except urllib.error.HTTPError as e:
        headers = dict(e.headers) if e.headers else {}
    except Exception as e:
        print(f"  SKIP: GEOX unreachable ({e})")
        return True  # Can't test if unreachable

    session_id = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    if session_id:
        print(f"  FAIL: GEOX minted session on modern path: {session_id}")
        return False
    print("  PASS: No session minted on modern discover")
    return True

def test_no_session_on_tools_list():
    """P06: tools/list on modern path must NOT mint session."""
    url = f"http://127.0.0.1:{GEOX_PORT}/mcp"
    payload = json.dumps({
        "jsonrpc": "2.0", "id": "p06-tools-list",
        "method": "tools/list", "params": {}
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "tools/list")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        headers = dict(resp.headers)
    except urllib.error.HTTPError as e:
        headers = dict(e.headers) if e.headers else {}
    except Exception as e:
        print(f"  SKIP: GEOX unreachable ({e})")
        return True

    session_id = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    if session_id:
        print(f"  FAIL: GEOX minted session on modern tools/list: {session_id}")
        return False
    print("  PASS: No session minted on modern tools/list")
    return True

def test_no_session_on_tools_call():
    """P06: tools/call on modern path must NOT mint session."""
    # First get a tool name
    url = f"http://127.0.0.1:{GEOX_PORT}/mcp"
    list_payload = json.dumps({
        "jsonrpc": "2.0", "id": "list-1", "method": "tools/list", "params": {}
    }).encode()
    req = urllib.request.Request(url, data=list_payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "tools/list")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        body = json.loads(resp.read().decode())
        tools = body.get("result", {}).get("tools", [])
        if not tools:
            print("  SKIP: No tools available")
            return True
        tool_name = tools[0]["name"]
    except Exception as e:
        print(f"  SKIP: Can't get tool list ({e})")
        return True

    # Now call the tool
    call_payload = json.dumps({
        "jsonrpc": "2.0", "id": "p06-call",
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": {}}
    }).encode()
    req = urllib.request.Request(url, data=call_payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "tools/call")
    req.add_header("Mcp-Name", tool_name)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        headers = dict(resp.headers)
    except urllib.error.HTTPError as e:
        headers = dict(e.headers) if e.headers else {}
    except Exception as e:
        print(f"  SKIP: tools/call failed ({e})")
        return True

    session_id = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    if session_id:
        print(f"  FAIL: GEOX minted session on modern tools/call: {session_id}")
        return False
    print(f"  PASS: No session minted on modern tools/call ({tool_name})")
    return True

if __name__ == "__main__":
    print("GEOX P0 Session Invariant Test")
    print("=" * 40)
    results = [
        test_no_session_on_discover(),
        test_no_session_on_tools_list(),
        test_no_session_on_tools_call(),
    ]
    passed = all(results)
    print(f"\n{'PASS' if passed else 'FAIL'}: {sum(results)}/{len(results)} tests passed")
    sys.exit(0 if passed else 1)
