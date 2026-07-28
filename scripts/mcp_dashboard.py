#!/usr/bin/env python3
"""
MCP Dashboard — Visual discovery surface for arifOS Federation tools.
Zero dependencies (stdlib only). Binds 127.0.0.1. Read-only OBSERVE.

Doctrine: Human speaks INTENT. Kernel routes TOOL. Agent executes.
GUI = supplement. Routing = primary.

Usage:
    python3 /root/A-FORGE/scripts/mcp_dashboard.py
    # Open http://127.0.0.1:6200
"""

import json
import http.server
import urllib.request
import urllib.error
import socket
import os
from datetime import datetime

# ── Organ Registry ────────────────────────────────────────────
ORGANS = {
    "A-FORGE": {
        "port": 7072,
        "url": "http://127.0.0.1:7072/mcp",
        "color": "#f97316",  # orange — execution
        "icon": "⚒️",
        "role": "Execution Shell — build, deploy, forge",
        "tier": "TIER 1 — WAJIB UI",
    },
    "GEOX": {
        "port": 8081,
        "url": "http://127.0.0.1:8081/mcp",
        "color": "#22c55e",  # green — earth
        "icon": "🌍",
        "role": "Earth Intelligence — seismic, petrophysics, basin",
        "tier": "TIER 2 — PATUT UI",
    },
    "WEALTH": {
        "port": 18082,
        "url": "http://127.0.0.1:18082/mcp",
        "color": "#eab308",  # gold — capital
        "icon": "💰",
        "role": "Capital Intelligence — NPV, risk, conservation",
        "tier": "TIER 2 — PATUT UI",
    },
    "WELL": {
        "port": 18083,
        "url": "http://127.0.0.1:18083/mcp",
        "color": "#ef4444",  # red — human
        "icon": "🫀",
        "role": "Human Readiness — vitality, fatigue, dignity",
        "tier": "TIER 4 — Agent-facing",
    },
    "arifOS": {
        "port": 8088,
        "url": "http://127.0.0.1:8088/mcp",
        "color": "#8b5cf6",  # purple — kernel
        "icon": "⚖️",
        "role": "Constitutional Kernel — judge, seal, vault",
        "tier": "TIER 3 — NICE TO HAVE",
    },
}

DASHBOARD_PORT = 6200
DASHBOARD_HOST = "127.0.0.1"


# ── MCP Session Cache ────────────────────────────────────────
# Some organs require session-based MCP (initialize → notify → tools/list)
# Cache sessions to avoid re-initializing on every dashboard refresh
import time as _time

_SESSION_CACHE = {}  # {organ_url: {"session_id": str, "expires": float}}

MCP_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "MCP-Dashboard/1.0",
}


def probe_organ_health(port):
    """Check if organ is alive via /health endpoint."""
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/health",
            headers={"User-Agent": "MCP-Dashboard/1.0"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def _mcp_request(organ_url, payload_dict, session_id=None):
    """Send a JSON-RPC request to an MCP server. Returns (data, session_id)."""
    headers = dict(MCP_HEADERS)
    if session_id:
        headers["Mcp-Session-Id"] = session_id

    data = json.dumps(payload_dict).encode("utf-8")
    req = urllib.request.Request(organ_url, data=data, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            # Extract session ID from response headers
            new_sid = resp.headers.get("Mcp-Session-Id") or resp.headers.get(
                "mcp-session-id"
            )
            body = json.loads(resp.read().decode("utf-8"))
            return body, new_sid
    except Exception:
        return None, None


def _mcp_initialize(organ_url):
    """Initialize an MCP session. Returns session_id or None."""
    result, sid = _mcp_request(
        organ_url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "mcp-dashboard", "version": "1.0.0"},
            },
        },
    )
    if sid:
        # Send initialized notification (MCP spec requirement)
        _mcp_request(
            organ_url,
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
            },
            session_id=sid,
        )
    return sid


def fetch_tools(organ_url):
    """Fetch tools/list from an MCP server.

    Tries stateless first (A-FORGE, arifOS), then session-based (GEOX, WEALTH, WELL).
    """
    # Method 1: Try stateless (works for A-FORGE, arifOS)
    result, sid = _mcp_request(
        organ_url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
        },
    )
    if result and "result" in result and "tools" in result.get("result", {}):
        return result["result"]["tools"]

    # Method 2: If stateless failed, try session-based
    cached = _SESSION_CACHE.get(organ_url)
    if cached and cached.get("expires", 0) > _time.time():
        session_id = cached["session_id"]
    else:
        session_id = _mcp_initialize(organ_url)
        if session_id:
            _SESSION_CACHE[organ_url] = {
                "session_id": session_id,
                "expires": _time.time() + 300,  # 5 min cache
            }

    if session_id:
        result, _ = _mcp_request(
            organ_url,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
            },
            session_id=session_id,
        )
        if result and "result" in result:
            return result["result"].get("tools", [])

    return []


def render_organ_card(name, info, tools, healthy):
    """Render one organ's card as HTML."""
    status = "🟢 LIVE" if healthy else "🔴 DOWN"
    tool_count = len(tools)

    rows = ""
    for i, tool in enumerate(tools[:30]):  # cap at 30 for readability
        tname = tool.get("name", "?")
        tdesc = tool.get("description", "")[:80]
        rows += f"""<tr>
            <td class="tool-name">{tname}</td>
            <td class="tool-desc">{tdesc}</td>
        </tr>"""
    if tool_count > 30:
        rows += f"""<tr>
            <td colspan="2" class="more-tools">... +{tool_count - 30} more tools — open MCP Inspector for full list</td>
        </tr>"""
    if tool_count == 0 and healthy:
        rows += """<tr>
            <td colspan="2" class="more-tools">⚠️ Organ healthy but tools/list returned empty — check MCP transport</td>
        </tr>"""

    return f"""<div class="organ-card" style="border-left: 4px solid {info["color"]}">
    <div class="organ-header">
        <span class="organ-icon">{info["icon"]}</span>
        <div>
            <h2>{name}</h2>
            <p class="organ-role">{info["role"]}</p>
        </div>
        <div class="organ-meta">
            <span class="tool-count-badge">{tool_count} tools</span>
            <span class="status-badge {"live" if healthy else "down"}">{status}</span>
            <span class="tier-badge">{info["tier"]}</span>
        </div>
    </div>
    <table class="tool-table">
        <thead><tr><th>Tool Name</th><th>Description</th></tr></thead>
        <tbody>{rows}</tbody>
    </table>
    <div class="organ-footer">
        MCP URL: <code>{info["url"]}</code> · Port: <code>{info["port"]}</code>
    </div>
</div>"""


def render_page():
    """Build the full HTML page."""
    organs_html = ""
    total_tools = 0
    total_live = 0

    for name, info in ORGANS.items():
        healthy = probe_organ_health(info["port"])
        tools = fetch_tools(info["url"]) if healthy else []
        total_tools += len(tools)
        if healthy:
            total_live += 1
        organs_html += render_organ_card(name, info, tools, healthy)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>arifOS MCP Dashboard</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
            background: #0a0a0a;
            color: #e5e5e5;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }}
        .zen-pulse {{
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px 20px;
            margin-bottom: 24px;
            display: flex;
            gap: 32px;
            font-size: 13px;
        }}
        .zen-pulse .zp-item {{ display: flex; gap: 8px; }}
        .zp-ask {{ color: #888; }}
        .zp-val {{ color: #f97316; font-weight: bold; }}
        .zp-val.gold {{ color: #eab308; }}
        h1 {{ font-size: 24px; margin-bottom: 4px; color: #f97316; }}
        .subtitle {{ color: #888; font-size: 13px; margin-bottom: 24px; }}
        .stats {{ display: flex; gap: 24px; margin-bottom: 24px; }}
        .stat {{ background: #1a1a2e; border: 1px solid #333; border-radius: 6px; padding: 10px 16px; }}
        .stat-num {{ font-size: 28px; font-weight: bold; color: #f97316; }}
        .stat-label {{ font-size: 11px; color: #888; }}
        .organ-card {{
            background: #111;
            border: 1px solid #222;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }}
        .organ-header {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            background: #1a1a2e;
        }}
        .organ-icon {{ font-size: 32px; }}
        .organ-header h2 {{ font-size: 18px; color: #e5e5e5; }}
        .organ-role {{ font-size: 12px; color: #888; }}
        .organ-meta {{
            margin-left: auto;
            display: flex;
            gap: 8px;
            align-items: center;
        }}
        .tool-count-badge {{
            background: #333;
            color: #ccc;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }}
        .status-badge {{
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }}
        .status-badge.live {{ background: #065f46; color: #6ee7b7; }}
        .status-badge.down {{ background: #7f1d1d; color: #fca5a5; }}
        .tier-badge {{
            background: #1e1b4b;
            color: #a5b4fc;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 10px;
        }}
        .tool-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }}
        .tool-table th {{
            text-align: left;
            padding: 8px 20px;
            background: #0a0a0a;
            color: #888;
            font-weight: normal;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }}
        .tool-table td {{
            padding: 6px 20px;
            border-top: 1px solid #1a1a1a;
        }}
        .tool-name {{ color: #e5e5e5; font-weight: bold; white-space: nowrap; }}
        .tool-desc {{ color: #888; font-size: 11px; }}
        .more-tools {{ color: #666; font-style: italic; font-size: 11px; padding: 10px 20px; }}
        .organ-footer {{
            padding: 8px 20px;
            font-size: 10px;
            color: #555;
            background: #0a0a0a;
        }}
        .organ-footer code {{
            background: #1a1a2e;
            padding: 2px 6px;
            border-radius: 3px;
            color: #a5b4fc;
        }}
        .footer {{
            text-align: center;
            padding: 24px;
            color: #444;
            font-size: 11px;
        }}
        .doctrine {{
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px 20px;
            margin-bottom: 24px;
            font-size: 13px;
            color: #a5b4fc;
        }}
    </style>
</head>
<body>
    <div class="zen-pulse">
        <div class="zp-item">
            <span class="zp-ask">Where am I?</span>
            <span class="zp-val">MCP Dashboard · arifOS Federation</span>
        </div>
        <div class="zp-item">
            <span class="zp-ask">Why care?</span>
            <span class="zp-val gold">{total_tools} tools across {total_live}/5 live organs</span>
        </div>
        <div class="zp-item">
            <span class="zp-ask">What next?</span>
            <span class="zp-val">Speak intent · Agent routes · Kernel executes</span>
        </div>
    </div>

    <h1>⚒️ arifOS MCP Dashboard</h1>
    <p class="subtitle">Visual discovery surface · Read-only OBSERVE · Refreshed at {now}</p>

    <div class="stats">
        <div class="stat">
            <div class="stat-num">{total_tools}</div>
            <div class="stat-label">Total Tools</div>
        </div>
        <div class="stat">
            <div class="stat-num">{total_live}/5</div>
            <div class="stat-label">Organs Live</div>
        </div>
        <div class="stat">
            <div class="stat-num">6200</div>
            <div class="stat-label">Dashboard Port</div>
        </div>
    </div>

    <div class="doctrine">
        🧘 <strong>Doctrine:</strong> Human speaks INTENT. Kernel routes TOOL. Agent executes.<br>
        GUI = supplement (spatial memory). Routing = primary (execution).<br>
        <em>Kau sovereign — kau tentukan WHAT, bukan HOW. Architecture yang kena tahu HOW.</em>
    </div>

    {organs_html}

    <div class="footer">
        arifOS Federation · DITEMPA BUKAN DIBERI · Forged {now}<br>
        MCP Inspector (deep inspection): <code>npx @modelcontextprotocol/inspector --web</code> → <code>http://localhost:6274</code>
    </div>
</body>
</html>"""


class DashboardHandler(http.server.BaseHTTPRequestHandler):
    """Minimal HTTP handler for the dashboard."""

    def log_message(self, format, *args):
        """Suppress default logging — quiet dashboard."""
        pass

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            html = render_page()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Robots-Tag", "noindex")
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {
                        "service": "mcp-dashboard",
                        "status": "healthy",
                        "bind": f"{DASHBOARD_HOST}:{DASHBOARD_PORT}",
                    }
                ).encode()
            )
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")


def main():
    server = http.server.HTTPServer((DASHBOARD_HOST, DASHBOARD_PORT), DashboardHandler)
    print(f"""
╔══════════════════════════════════════════════════════════╗
║  ⚒️  arifOS MCP Dashboard                              ║
║                                                        ║
║  Open:  http://127.0.0.1:6200                         ║
║                                                        ║
║  Organs monitored:                                     ║
║  • A-FORGE  :7072  (120 tools) — Execution Shell       ║
║  • GEOX     :8081  (32 tools)  — Earth Intelligence    ║
║  • WEALTH   :18082 (12 tools)  — Capital Intelligence  ║
║  • WELL     :18083 (8 tools)   — Human Readiness       ║
║  • arifOS   :8088  (8 tools)   — Constitutional Kernel ║
║                                                        ║
║  Press Ctrl+C to stop                                  ║
║  DITEMPA BUKAN DIBERI                                  ║
╚══════════════════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard stopped.")


if __name__ == "__main__":
    main()
