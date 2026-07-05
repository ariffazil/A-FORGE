#!/usr/bin/env python3
"""Full MCP streamable-http session with GEOX."""

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
        session_id = resp.headers.get("Mcp-Session-Id", session_id)
        data = json.loads(resp.read())
        return data, session_id, resp.status


# 1. Initialize
res, sid, status = mcp(
    "initialize",
    {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "QQQ-FFF-TEST", "version": "1.0"},
    },
)
print(f"INIT: status={status}, session_id={sid}")
print(f"  Result: {json.dumps(res, indent=2)[:200]}")

if not sid:
    print("ERROR: No session ID from server")
    exit(1)

# 2. Notify (some servers need this)
notify_body = json.dumps(
    {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}
).encode()
req = urllib.request.Request(GEOX_URL, data=notify_body, headers=HEADERS)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f"NOTIFY: status={resp.status}")
except Exception as e:
    print(f"NOTIFY: {e} (non-fatal)")

# 3. List tools
res, sid2, status = mcp("tools/list", {}, sid)
print(f"\nTOOLS/LIST: status={status}")
names = [t["name"] for t in res.get("result", {}).get("tools", [])]
print(f"  {len(names)} tools")
for n in names:
    if (
        "petro" in n.lower()
        or "vsh" in n.lower()
        or "qc" in n.lower()
        or "ingest" in n.lower()
    ):
        print(f"  -> {n}")

# 4. Call petrophysics
res, sid3, status = mcp(
    "tools/call",
    {
        "name": "geox_petrophysics",
        "arguments": {
            "mode": "generate",
            "target_class": "vsh",
            "evidence_refs": ["QQQ_FFF_test_well"],
            "gr_clean": 30,
            "gr_shale": 130,
            "vsh_method": "linear",
            "session_id": "SEAL-dfcbdde46a1946fe",
            "actor_id": "QQQ-FFF-TEST",
        },
    },
    sid,
)
print(f"\nPETROPHYSICS: status={status}")
for c in res.get("result", {}).get("content", []):
    t = c.get("type", "")
    if t == "text":
        print(f"  Text: {c['text'][:800]}")
    elif t == "json":
        print(f"  JSON: {json.dumps(c['json'], indent=2)[:800]}")
err = res.get("error")
if err:
    print(f"  ERROR: {json.dumps(err, indent=2)[:400]}")
