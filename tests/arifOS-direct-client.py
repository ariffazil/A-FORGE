#!/usr/bin/env python3
"""
arifOS MCP Direct HTTP Client
=============================
Platform-agnostic client for arifOS MCP via StreamableHTTP.
No mistralai dependency — uses requests directly.

Demonstrates:
  - Direct MCP JSON-RPC over HTTP
  - Tool execution with real responses
  - Constitutional verdicts (SEAL/HOLD/VOID)
  - Session state across calls

Usage:
    export ARIFOS_MCP_URL=http://127.0.0.1:8080/mcp
    python3 arifOS-direct-client.py

DITEMPA BUKAN DIBERI — Forged, Not Given
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

# ── Configuration ─────────────────────────────────────────────────────────────

ARIFOS_SERVER = os.environ.get("ARIFOS_MCP_URL", "http://127.0.0.1:8080/mcp")
TIMEOUT = 120


# ── MCP JSON-RPC Helpers ───────────────────────────────────────────────────────


def mcp_request(method: str, params: dict[str, Any] | None = None) -> dict:
    """
    Send MCP JSON-RPC request to arifOS server.

    Args:
        method: MCP method (e.g., "tools/list", "tools/call")
        params: Method parameters

    Returns:
        Parsed JSON response
    """
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "id": f"req-{int(time.time() * 1000) % 1000000}",
    }
    if params:
        payload["params"] = params

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

    response = requests.post(
        ARIFOS_SERVER, json=payload, headers=headers, timeout=TIMEOUT, stream=True
    )

    # Handle SSE + JSON responses
    content_type = response.headers.get("content-type", "")

    if "text/event-stream" in content_type:
        # SSE stream — collect all events
        events = []
        for line in response.iter_lines():
            if line:
                line = line.decode("utf-8")
                if line.startswith("event:"):
                    continue
                if line.startswith("data:"):
                    data = line[5:].strip()
                    try:
                        events.append(json.loads(data))
                    except json.JSONDecodeError:
                        continue

        # Return last JSON-RPC result or first event
        for event in reversed(events):
            if isinstance(event, dict) and ("result" in event or "error" in event):
                return event
        return {"result": events} if events else {"error": "No events received"}

    else:
        # Plain JSON response
        return response.json()


def list_tools() -> list[dict]:
    """List all available arifOS MCP tools."""
    result = mcp_request("tools/list")
    tools = result.get("result", {}).get("tools", [])
    print(f"\n📋 Available tools ({len(tools)}):")
    for tool in tools:
        print(f"   • {tool['name']}: {tool.get('description', '')[:60]}...")
    return tools


def call_tool(name: str, arguments: dict) -> dict:
    """
    Call an arifOS MCP tool and return the result.

    Args:
        name: Tool name (e.g., "arif_session_init", "arif_judge_deliberate")
        arguments: Tool arguments

    Returns:
        Tool execution result
    """
    print(f"\n🔧 Calling tool: {name}")
    print(f"   Args: {json.dumps(arguments, indent=2)[:200]}...")

    start = time.perf_counter()
    result = mcp_request("tools/call", params={"name": name, "arguments": arguments})
    latency_ms = (time.perf_counter() - start) * 1000

    # Extract verdict from result
    if "result" in result:
        tool_result = result["result"]
        if isinstance(tool_result, dict):
            verdict = tool_result.get("verdict", tool_result.get("status", "UNKNOWN"))
            ok = tool_result.get("ok", True)
        else:
            verdict = "UNKNOWN"
            ok = True
    elif "error" in result:
        verdict = f"ERROR: {result['error'].get('message', 'Unknown error')}"
        ok = False
    else:
        verdict = "UNKNOWN"
        ok = False

    print(f"   ✅ Verdict: {verdict}")
    print(f"   ⏱️  Latency: {latency_ms:.2f}ms")

    return {
        "tool": name,
        "verdict": verdict,
        "ok": ok,
        "latency_ms": latency_ms,
        "result": result,
    }


# ── Demo Workflow ──────────────────────────────────────────────────────────────


def demo_init(
    actor_id: str = "arif-direct-demo",
    intent: str = "test connection",
    mode: str = "probe",
):
    """000 INIT — Constitutional session ignition."""
    print(f"\n{'=' * 60}")
    print("000 INIT — arif_session_init")
    print(f"{'=' * 60}")
    return call_tool(
        "arif_session_init", {"actor_id": actor_id, "intent": intent, "mode": mode}
    )


def demo_sense(query: str = "What is the state of my VPS?", mode: str = "governed"):
    """111 THINK — Constitutional reality sensing."""
    print(f"\n{'=' * 60}")
    print("111 THINK — arif_sense_observe")
    print(f"{'=' * 60}")
    return call_tool("arif_sense_observe", {"query": query, "mode": mode})


def demo_judge(query: str = "Is my VPS healthy?", risk_tier: str = "low"):
    """888 JUDGE — Final constitutional verdict."""
    print(f"\n{'=' * 60}")
    print("888 JUDGE — arif_judge_deliberate")
    print(f"{'=' * 60}")
    return call_tool("arif_judge_deliberate", {"query": query, "risk_tier": risk_tier})


def demo_probe():
    """Diagnostic probe — system status check."""
    print(f"\n{'=' * 60}")
    print("111 PROBE — arif_sense_observe (diagnostic)")
    print(f"{'=' * 60}")
    return call_tool(
        "arif_sense_observe", {"actor_id": "arif-direct-demo", "intent": "diagnostic probe"}
    )


# ── Main ───────────────────────────────────────────────────────────────────────


def main():
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  arifOS MCP Direct Client                                    ║
║  Platform-agnostic — connects to any arifOS MCP server       ║
║  DITEMPA BUKAN DIBERI — Forged, Not Given                    ║
╚══════════════════════════════════════════════════════════════╝

Server: {ARIFOS_SERVER}
Time:   {datetime.now(timezone.utc).isoformat()}
""")

    # Check server health
    print("🔍 Checking server health...")
    try:
        health = requests.get(ARIFOS_SERVER.replace("/mcp", "/health"), timeout=10)
        if health.status_code == 200:
            health_data = health.json()
            print(f"   ✅ Server healthy: {health_data.get('version', 'unknown')}")
            print(f"   📊 Tools loaded: {health_data.get('tools_loaded', 'N/A')}")
        else:
            print(f"   ⚠️  Health check returned: {health.status_code}")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        print("   Trying direct MCP connection anyway...")

    # List available tools
    try:
        list_tools()
    except Exception as e:
        print(f"   ❌ Failed to list tools: {e}")

    # Run demo workflow
    verdicts = []

    # 1. Init
    v1 = demo_init(actor_id="arif-direct-demo", intent="MCP client demo", mode="probe")
    verdicts.append(v1)

    # 2. Sense
    v2 = demo_sense(query="VPS constitutional status", mode="governed")
    verdicts.append(v2)

    # 3. Judge
    v3 = demo_judge(query="Is the MCP demo successful?", risk_tier="low")
    verdicts.append(v3)

    # 4. Probe
    v4 = demo_probe()
    verdicts.append(v4)

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY — Agentic Proof")
    print(f"{'=' * 60}")

    agentic_tools = [v["tool"] for v in verdicts if v["ok"]]
    agentic_verdicts = [v["verdict"] for v in verdicts]

    print(f"   Tools executed: {len(agentic_tools)}")
    print(f"   Tool names: {', '.join(agentic_tools)}")
    print(f"   Verdicts: {agentic_verdicts}")
    print(f"   All OK: {'YES ✅' if all(v['ok'] for v in verdicts) else 'NO ❌'}")

    if len(agentic_tools) >= 3:
        print(f"\n   ✅ AGENTIC BEHAVIOR PROVEN")
        print(f"   arifOS MCP tools executed successfully.")
        print(f"   Not just sembang generative — real tool calls, real verdicts.")
    else:
        print(f"\n   ⚠️  Partial agentic behavior — check tool configuration.")

    print(f"\n{'=' * 60}")
    print("Proof: arifOS MCP is platform-agnostic.")
    print("Any HTTP-capable client can connect to the same endpoint.")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
