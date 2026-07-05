#!/usr/bin/env python3
"""Inspect GEOX tool schemas and call the right tool."""

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
        return data, sid, resp.status


# Initialize session
res, sid, _ = mcp(
    "initialize",
    {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "QQQ-FFF-TEST", "version": "1.0"},
    },
)
print(f"Session: {sid}")

# Get tool schemas
res, sid, _ = mcp("tools/list", {}, sid)

# Find petrophysics-related tools and their schemas
targets = [
    "geox_petrophysics",
    "geox_subsurface_generate_candidates",
    "geox_well_qc",
    "geox_data_qc_bundle",
]
for tool in res.get("result", {}).get("tools", []):
    name = tool["name"]
    if name in targets:
        print(f"\n{'=' * 60}")
        print(f"TOOL: {name}")
        print(f"  Description: {tool.get('description', 'N/A')[:100]}")
        inp = tool.get("inputSchema", {})
        props = inp.get("properties", {})
        print(f"  Properties ({len(props)}):")
        for pname, pval in props.items():
            print(
                f"    {pname}: {pval.get('type', '?')} {'(required)' if pname in inp.get('required', []) else '(opt)'}"
            )
            desc = pval.get("description", "")
            if desc:
                print(f"      -> {desc[:100]}")
        print(f"  Required: {inp.get('required', [])}")

# Also check geox_well_ingest
for tool in res.get("result", {}).get("tools", []):
    if tool["name"] == "geox_well_ingest":
        inp = tool.get("inputSchema", {})
        print(f"\n{'=' * 60}")
        print(f"TOOL: geox_well_ingest")
        print(f"  Properties: {list(inp.get('properties', {}).keys())}")
        print(f"  Required: {inp.get('required', [])}")
        break
