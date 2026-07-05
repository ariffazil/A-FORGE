#!/usr/bin/env python3
"""Test GEOX MCP session management and petrophysics call."""

import json, urllib.request, http.cookiejar

GEOX_URL = "http://localhost:8081/mcp"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Step 1: Initialize session
init = json.dumps(
    {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "QQQ-FFF-TEST", "version": "1.0"},
        },
    }
).encode()

req = urllib.request.Request(
    GEOX_URL,
    data=init,
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
with opener.open(req, timeout=10) as resp:
    r = json.loads(resp.read())
    print(f"INIT OK: {json.dumps(r, indent=2)[:200]}")

# Step 2: Notify
notify = json.dumps(
    {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}
).encode()
req2 = urllib.request.Request(
    GEOX_URL,
    data=notify,
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
with opener.open(req2, timeout=10) as resp:
    print(f"NOTIFY OK: {resp.status}")

# Step 3: tools/list
tl = json.dumps(
    {"jsonrpc": "2.0", "id": "2", "method": "tools/list", "params": {}}
).encode()
req3 = urllib.request.Request(
    GEOX_URL,
    data=tl,
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
with opener.open(req3, timeout=10) as resp:
    r3 = json.loads(resp.read())
    names = [t["name"] for t in r3.get("result", {}).get("tools", [])]
    print(f"TOOLS: {len(names)} available")
    for n in names:
        if "petro" in n.lower() or "vsh" in n.lower() or "ingest" in n.lower():
            print(f"  -> {n}")

# Step 4: Call petrophysics
body = json.dumps(
    {
        "jsonrpc": "2.0",
        "id": "3",
        "method": "tools/call",
        "params": {
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
    }
).encode()

req4 = urllib.request.Request(
    GEOX_URL,
    data=body,
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
with opener.open(req4, timeout=30) as resp:
    res = json.loads(resp.read())
    print(f"\nPETROPHYSICS RESPONSE:")
    for c in res.get("result", {}).get("content", []):
        t = c.get("type", "")
        if t == "text":
            print(f"  Text ({len(c['text'])} chars): {c['text'][:600]}")
        elif t == "json":
            print(f"  JSON: {json.dumps(c['json'], indent=2)[:600]}")
    meta = res.get("result", {}).get("meta", {})
    if meta:
        print(f"  Meta: {json.dumps(meta, indent=2)[:200]}")
