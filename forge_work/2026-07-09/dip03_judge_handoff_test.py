#!/usr/bin/env python3
"""DIP-03: Test wealth_judge_handoff with null/missing data.
Does the judge layer coerce null into GO (optimistic coercion bug)?"""

import json
import urllib.request

MCP_URL = "http://localhost:18082/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Mcp-Session-Id": "dip03-judge-handoff-test",
}


def mcp_call(tool_name: str, arguments: dict) -> dict:
    body = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }).encode()
    req = urllib.request.Request(MCP_URL, data=body, method="POST", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
    return json.loads(raw)


def parse_mcp_result(resp: dict) -> str:
    try:
        content = resp["result"]["content"][0]["text"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError):
        return resp


# ── Test A: Conflicting fields (status=HOLD, risk.verdict=GO) ──
print("=" * 60)
print("DIP-03 Test A: Conflicting fields (HOLD vs GO)")
print("=" * 60)
result_a = mcp_call("wealth_judge_handoff", {
    "tool_name": "wealth_compute_irr",
    "result": json.dumps({
        "status": "HOLD",
        "risk": {"verdict": "GO"},
        "irr": None,
        "confidence": None,
    }),
    "intent": "test null coercion — conflicting fields",
    "capability": "compute.irr",
    "mode": "prepare",
})
parsed_a = parse_mcp_result(result_a)
print(json.dumps(parsed_a, indent=2)[:2000])

# ── Test B: Clean null (no conflicting fields) ──
print("\n" + "=" * 60)
print("DIP-03 Test B: Clean null (no conflict)")
print("=" * 60)
result_b = mcp_call("wealth_judge_handoff", {
    "tool_name": "wealth_compute_irr",
    "result": json.dumps({
        "status": "HOLD",
        "irr": None,
        "confidence": None,
    }),
    "intent": "test null coercion — clean null",
    "capability": "compute.irr",
    "mode": "prepare",
})
parsed_b = parse_mcp_result(result_b)
print(json.dumps(parsed_b, indent=2)[:2000])

# ── Test C: Normal valid data (should PASS) ──
print("\n" + "=" * 60)
print("DIP-03 Test C: Valid data (should PASS)")
print("=" * 60)
result_c = mcp_call("wealth_judge_handoff", {
    "tool_name": "wealth_compute_irr",
    "result": json.dumps({
        "status": "OK",
        "irr": 0.15,
        "confidence": 0.85,
    }),
    "intent": "test valid data baseline",
    "capability": "compute.irr",
    "mode": "prepare",
})
parsed_c = parse_mcp_result(result_c)
print(json.dumps(parsed_c, indent=2)[:2000])

print("\n" + "=" * 60)
print("DIAGNOSIS")
print("=" * 60)
# Check for optimistic coercion
for label, r in [("A (conflict)", parsed_a), ("B (clean null)", parsed_b), ("C (valid)", parsed_c)]:
    verdict = r.get("verdict", r.get("result", {}).get("verdict", "?"))
    print(f"{label}: verdict={verdict}")
