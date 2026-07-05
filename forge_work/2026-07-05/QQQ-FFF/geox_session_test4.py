#!/usr/bin/env python3
"""Call geox_petrophysics with arguments only (no extra fields in args dict)."""

import json, urllib.request

GEOX_URL = "http://localhost:8081/mcp"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


def mcp(method, params=None, session_id=None):
    body = json.dumps(
        {"jsonrpc": "2.0", "id": "1", "method": method, "params": params or {}}
    ).encode()
    hdrs = dict(HEADERS)
    if session_id:
        hdrs["Mcp-Session-Id"] = session_id
    req = urllib.request.Request(GEOX_URL, data=body, headers=hdrs)
    with urllib.request.urlopen(req, timeout=30) as resp:
        sid = resp.headers.get("Mcp-Session-Id", session_id)
        data = json.loads(resp.read())
        return data, sid


# Init
res, sid = mcp(
    "initialize",
    {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "QQQ-FFF-TEST", "version": "1.0"},
    },
)
print(f"Session: {sid}")

# Call geox_petrophysics with clean arguments (no session_id/actor_id inside)
res, sid = mcp(
    "tools/call",
    {
        "name": "geox_petrophysics",
        "arguments": {
            "arguments": {
                "mode": "generate",
                "target_class": "vsh",
                "evidence_refs": ["QQQ_FFF_test_well"],
                "gr_clean": 30,
                "gr_shale": 130,
                "vsh_method": "linear",
            }
        },
    },
    sid,
)

print(f"\nResult:")
err = res.get("error")
if err:
    print(f"  ERROR: {json.dumps(err, indent=2)[:600]}")
else:
    for c in res.get("result", {}).get("content", []):
        if c.get("type") == "text":
            print(f"  Text: {c['text'][:800]}")
        elif c.get("type") == "json":
            print(f"  JSON: {json.dumps(c['json'], indent=2)[:800]}")
