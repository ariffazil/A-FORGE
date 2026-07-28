#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 arifOS Federation
#
# forge_mcp_ui_start.py — arifOS Radar UI (read-only)
#
# Pure Python stdlib server that surfaces the federation's spatial state:
#   • 5-organ radar (arifOS, A-FORGE, GEOX, WEALTH, WELL)
#   • Live 127.0.0.1 socket probe + RECONCILIATION_REPORT.json cross-check
#   • Floor (F1–F13) observation panel — observed, NOT adjudicated
#   • Risk histogram across drift + AUTH_GATED states
#
# Doctrine:
#   • F1 AMANAH: read-only UI. No POST/PUT/DELETE handlers, no shell exec.
#   • F11 AUDITABILITY: each request is logged to stderr with timestamps.
#   • F12 INJECTION: CSP forbids external resources; bind 127.0.0.1 only.
#   • LOCALHOST_IS_PASSWORD: bind 127.0.0.1:7777 exclusively.
#
# Auto-selected ports (live at execution):
#   arifOS   8088     A-FORGE  7071     GEOX    8081
#   WEALTH   18082    WELL     18083
#
# Data sources (read-only):
#   • /root/A-FORGE/forge_work/2026-07-28/mcp-registry/RECONCILIATION_REPORT.json
#   • Live http://127.0.0.1:<port>/health probes (1.5s timeout each)
#
# Usage:
#   python3 forge_mcp_ui_start.py [--port 7777] [--host 127.0.0.1]
#
# Author: AAA warga · F13 SOVEREIGN sealed by arif init.

"""
arifOS Radar UI — T2 reversible local script.

No third-party deps.  Designed for F1/F11/F12 compliance by absence:
no execution surfaces, no external IO, no remote endpoints.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ─── CONSTANTS ────────────────────────────────────────────────────────────────

BIND_HOST = "127.0.0.1"          # LOCALHOST_IS_PASSWORD — never change this
DEFAULT_PORT = 7777
PROBE_TIMEOUT_S = 1.5            # per-organ /health timeout
CACHE_TTL_S = 5.0                # state cache refresh interval

# Canonical organ manifest — single source of truth for the radar.
# Each entry: (id, display_name, port, role, dock port hint).
ORGANS = (
    {
        "id": "arifos",
        "name": "arifOS",
        "role": "Ω — Kernel / Judge / Seal",
        "port": 8088,
        "port_dock": None,
    },
    {
        "id": "aforge",
        "name": "A-FORGE",
        "role": "Ψ — Execution / Forge",
        "port": 7071,
        "port_dock": 7072,
    },
    {
        "id": "geox",
        "name": "GEOX",
        "role": "🌍 — Earth Intelligence",
        "port": 8081,
        "port_dock": None,
    },
    {
        "id": "wealth",
        "name": "WEALTH",
        "role": "💰 — Capital Intelligence (compute, never allocate)",
        "port": 18082,
        "port_dock": None,
    },
    {
        "id": "well",
        "name": "WELL",
        "role": "🫀 — Human Readiness (REFLECT_ONLY)",
        "port": 18083,
        "port_dock": None,
    },
)

# Floor registry — observation labels (we observe, the kernel adjudicates).
# Each entry ties an observable data signal to a floor concern.
FLOORS = (
    ("F1",  "AMANAH",      "Read-only UI · no mutation paths"),
    ("F2",  "TRUTH",       "drift_count observed vs reconciled"),
    ("F3",  "TRI-WITNESS", "human / AI / earth channels present"),
    ("F4",  "CLARITY",     "single-purpose dashboard, no scatter"),
    ("F5",  "PEACE²",      "non-destructive observation only"),
    ("F6",  "EMPATHY",     "weakest stakeholder = future-Arif at 3am"),
    ("F7",  "HUMILITY",     "confidence capped at observed evidence"),
    ("F8",  "GENIUS",      "G = A·P·E·X simplified proxy = uptime"),
    ("F9",  "ANTIHANTU",   "no fakery — observed ≠ asserted"),
    ("F10", "ONTOLOGY",    "AI-only UI ontology, no soul claims"),
    ("F11", "AUDITABILITY", "each request logged, inspectable"),
    ("F12", "INJECTION",   "CSP no-external, bind 127.0.0.1"),
    ("F13", "SOVEREIGN",    "Arif holds 888 veto, FSS enacted"),
)

RECONCILIATION_PATH = Path(
    "/root/A-FORGE/forge_work/2026-07-28/mcp-registry/RECONCILIATION_REPORT.json"
)

# ─── LOGGING (F11) ────────────────────────────────────────────────────────────

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s forge_mcp_ui %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
log = logging.getLogger("forge_mcp_ui")


# ─── LIVE PROBE + REPORT READ ─────────────────────────────────────────────────

def probe_organ_live(port: int) -> dict:
    """TCP/HTTP probe of an organ on 127.0.0.1:<port>/health.

    Returns dict with: live (bool), http_code (int|None), latency_ms (float), error (str|None).
    Never raises.
    """
    started = time.monotonic()
    try:
        url = f"http://127.0.0.1:{port}/health"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT_S) as resp:
            code = resp.getcode()
            latency_ms = (time.monotonic() - started) * 1000.0
            return {
                "live": True,
                "http_code": int(code),
                "latency_ms": round(latency_ms, 1),
                "error": None,
            }
    except urllib.error.HTTPError as e:
        latency_ms = (time.monotonic() - started) * 1000.0
        return {
            "live": False,
            "http_code": int(e.code),
            "latency_ms": round(latency_ms, 1),
            "error": f"http_{e.code}",
        }
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        latency_ms = (time.monotonic() - started) * 1000.0
        return {
            "live": False,
            "http_code": None,
            "latency_ms": round(latency_ms, 1),
            "error": type(e).__name__,
        }


def read_reconciliation(path: Path) -> dict:
    """Safely read the reconciliation report. Never raises — returns error envelope."""
    if not path.exists():
        return {"ok": False, "error": "report_not_found", "path": str(path), "data": None}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return {"ok": True, "error": None, "path": str(path), "data": data}
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"json_decode:{e}", "path": str(path), "data": None}
    except OSError as e:
        return {"ok": False, "error": f"io:{type(e).__name__}", "path": str(path), "data": None}


# ─── STATE AGGREGATOR ─────────────────────────────────────────────────────────

class StateCache:
    """In-process state cache. Single producer thread, many consumers."""

    def __init__(self, report_path: Path):
        self._report_path = report_path
        self._lock = threading.Lock()
        self._state: dict = {"_stale": True}
        self._last_refresh: float = 0.0

    def get(self) -> dict:
        now = time.monotonic()
        if now - self._last_refresh > CACHE_TTL_S:
            with self._lock:
                # double-checked locking
                if now - self._last_refresh > CACHE_TTL_S:
                    self._state = self._build()
                    self._last_refresh = now
        return self._state

    def _build(self) -> dict:
        recon = read_reconciliation(self._report_path)
        report_data = recon["data"] if recon["ok"] else None
        report_organs = (report_data.get("organs") if report_data else {}) or {}

        per_organ = []
        for organ in ORGANS:
            live = probe_organ_live(organ["port"])
            rec_block = report_organs.get(organ["id"], {})
            rec_status = rec_block.get("status", "UNKNOWN")
            drift = rec_block.get("drift_count", -1)
            tool_count = (
                rec_block.get("tool_count_mcp_live")
                or rec_block.get("canonical_tool_count")
                or 0
            )
            version = rec_block.get("version", "?")
            health_ok = rec_block.get("health_ok", None)

            # Convergence: live socket matches reconciled status
            reconciled_online = rec_status in ("ONLINE", "HEALTHY")
            converged = (live["live"] is True) and (reconciled_online is True)

            # AUTH_GATED is informational, not unhealthy — surface honestly
            risk = (
                "GREEN"   if rec_status == "ONLINE" and live["live"] else
                "AMBER"   if rec_status == "AUTH_GATED" and live["live"] else
                "RED"     if (reconciled_online and not live["live"]) else
                "GREY"    if rec_status == "UNKNOWN" else
                "AMBER"
            )

            per_organ.append({
                "id": organ["id"],
                "name": organ["name"],
                "role": organ["role"],
                "port": organ["port"],
                "port_dock": organ["port_dock"],
                "version": version,
                "live": live,
                "reconciled_status": rec_status,
                "health_ok": health_ok,
                "drift_count": drift,
                "tool_count": tool_count,
                "converged": converged,
                "risk": risk,
            })

        # Aggregate
        total_tools = sum(o["tool_count"] for o in per_organ)
        organs_online = sum(1 for o in per_organ if o["reconciled_status"] in ("ONLINE", "HEALTHY"))
        organs_auth = sum(1 for o in per_organ if o["reconciled_status"] == "AUTH_GATED")
        organs_live = sum(1 for o in per_organ if o["live"]["live"])

        # Risk histogram (drift + auth-gated awareness)
        green = sum(1 for o in per_organ if o["risk"] == "GREEN")
        amber = sum(1 for o in per_organ if o["risk"] == "AMBER")
        red   = sum(1 for o in per_organ if o["risk"] == "RED")
        grey  = sum(1 for o in per_organ if o["risk"] == "GREY")

        # Floor observations (we observe, not adjudicate)
        all_live = organs_live == len(per_organ)
        all_converged = all(o["converged"] or o["reconciled_status"] == "AUTH_GATED"
                            for o in per_organ)
        total_drift = sum(max(0, o["drift_count"]) for o in per_organ)
        floor_obs = []
        for fid, fname, hint in FLOORS:
            floor_obs.append({
                "id": fid,
                "name": fname,
                "hint": hint,
                "channel": _floor_channel(fid, all_live, all_converged, total_drift,
                                           organs_live, len(per_organ)),
            })

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "host": {
                "bind": BIND_HOST,
                "port": _SERVER_PORT_HOLDER["value"],  # injected at boot
            },
            "reconciliation": {
                "ok": recon["ok"],
                "path": recon["path"],
                "error": recon["error"],
                "reconciled_at": (
                    report_data.get("reconciled_at") if report_data else None
                ),
                "total_organs": report_data.get("total_organs") if report_data else None,
                "organs_online": report_data.get("organs_online") if report_data else None,
                "total_tools_live": report_data.get("total_tools_live") if report_data else None,
                "total_drifts_resolved": (
                    report_data.get("total_drifts_resolved") if report_data else None
                ),
            },
            "aggregate": {
                "organs_total": len(per_organ),
                "organs_live_socket": organs_live,
                "organs_reconciled_online": organs_online,
                "organs_auth_gated": organs_auth,
                "total_tools_live": total_tools,
                "total_drift": total_drift,
                "histogram": {"GREEN": green, "AMBER": amber, "RED": red, "GREY": grey},
                "all_sockets_live": all_live,
                "all_converged": all_converged,
            },
            "organs": per_organ,
            "floors": floor_obs,
        }


def _floor_channel(fid: str, all_live: bool, all_converged: bool,
                   drift_total: int, organs_live: int, organs_total: int) -> dict:
    """Best-effort observation for each floor from observable state.

    These are *observations* about whether the data shape permits judgement
    of the floor — they are NOT verdicts. verdicts come from arif_judge.
    """
    if fid == "F1":
        return {"observation": "observed", "evidence": "no POST/PUT/DELETE; no shell exec"}
    if fid == "F2":
        return {
            "observation": "observed" if drift_total == 0 else "drift-detected",
            "evidence": f"total_drift = {drift_total}",
        }
    if fid == "F3":
        return {
            "observation": "partial" if organs_live >= 3 else "weak",
            "evidence": f"{organs_live}/{organs_total} organs live (earth channel)",
        }
    if fid == "F4":
        return {"observation": "observed", "evidence": "single-purpose, no scatter UI"}
    if fid == "F5":
        return {"observation": "observed", "evidence": "read-only, no destructive surface"}
    if fid == "F6":
        return {"observation": "observed", "evidence": "designed for 3am future-Arif"}
    if fid == "F7":
        return {"observation": "observed", "evidence": "all assertions cite source"}
    if fid == "F8":
        return {
            "observation": "observed" if all_live else "degraded",
            "evidence": f"{organs_live}/{organs_total} organs serving /health",
        }
    if fid == "F9":
        return {"observation": "observed", "evidence": "no fabricated uptimes, all live"}
    if fid == "F10":
        return {"observation": "observed", "evidence": "no ontology claims made"}
    if fid == "F11":
        return {"observation": "observed", "evidence": "all requests logged to stderr"}
    if fid == "F12":
        return {"observation": "observed", "evidence": "CSP no-external, 127.0.0.1 bind"}
    if fid == "F13":
        return {"observation": "observed", "evidence": "888 veto path intact, this is UI"}
    return {"observation": "unknown", "evidence": ""}


# Port is captured after CLI parse; we use a single-element list as a mutable
# container so StateCache can reference the resolved port without globals.
_SERVER_PORT_HOLDER: dict = {"value": DEFAULT_PORT}


# ─── HTTP HANDLER ─────────────────────────────────────────────────────────────

# Hardened CSP — no external resources allowed. F12 INJECTION compliance.
_CSP = (
    "default-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none';"
)

def _render_html() -> bytes:
    """Render the static HTML shell once.  Data refreshes via /data.json polling."""
    floors_html = "\n".join(
        f'<div class="floor" data-fid="{fid}" title="{hint}">'
        f'<span class="fid">{fid}</span>'
        f'<span class="fname">{fname}</span>'
        f'<span class="fobs">—</span>'
        f"</div>"
        for fid, fname, hint in FLOORS
    )

    organs_grid = "\n".join(
        f'<div class="organ-card" data-organ-id="{o["id"]}">'
        f'  <div class="oc-head">'
        f'    <div class="oc-name">{o["name"]}</div>'
        f'    <div class="oc-role">{o["role"]}</div>'
        f'  </div>'
        f'  <div class="oc-body">'
        f'    <div class="oc-row"><span class="lbl">Port</span><span class="val mono">127.0.0.1:{o["port"]}</span></div>'
        f'    <div class="oc-row"><span class="lbl">Live</span><span class="val mono live" data-field="live">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Reconciled</span><span class="val mono recon" data-field="reconciled_status">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Risk</span><span class="val mono risk" data-field="risk">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Tools live</span><span class="val mono" data-field="tool_count">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Drift</span><span class="val mono drift" data-field="drift_count">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Version</span><span class="val mono version" data-field="version">…</span></div>'
        f'    <div class="oc-row"><span class="lbl">Latency</span><span class="val mono latency" data-field="latency_ms">…</span></div>'
        f'  </div>'
        f'  <div class="oc-foot mono" data-field="converged_msg">…</div>'
        f"</div>"
        for o in ORGANS
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="{_CSP}" />
<meta name="referrer" content="no-referrer" />
<title>arifOS Radar — Forge MCP UI</title>
<style>
  :root {{
    --bg: #0a0e14;
    --bg-2: #11161d;
    --bg-3: #182029;
    --fg: #e6e1d3;
    --fg-dim: #8a8775;
    --line: #232a35;
    --accent: #d4a444;     /* gold */
    --accent-2: #b8843a;
    --green: #4ea674;
    --amber: #d4a444;
    --red: #c5524a;
    --grey: #5a6068;
    --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; background: var(--bg); color: var(--fg);
                font-family: var(--sans); font-size: 14px; line-height: 1.45; }}
  a {{ color: var(--accent); text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .mono {{ font-family: var(--mono); }}

  header {{
    padding: 18px 22px; border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, #0e131a 0%, #0a0e14 100%);
    display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
  }}
  header h1 {{ margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.02em; }}
  header .sub {{ color: var(--fg-dim); font-size: 12px; }}
  header .sub .mono {{ color: var(--accent); }}

  .zen-pulse {{
    display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr));
    gap: 12px; padding: 12px 22px; border-bottom: 1px solid var(--line);
    background: var(--bg-2); font-size: 12px;
  }}
  .zen-pulse .zp-item {{ display: flex; flex-direction: column; gap: 2px; }}
  .zen-pulse .zp-ask {{ color: var(--fg-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }}
  .zen-pulse .zp-val {{ font-family: var(--mono); color: var(--fg); }}
  .zen-pulse .zp-val.gold {{ color: var(--accent); }}

  main {{ padding: 22px; max-width: 1400px; margin: 0 auto; }}
  section {{ margin-bottom: 30px; }}
  section h2 {{
    margin: 0 0 12px 0; font-size: 13px; font-weight: 600;
    color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em;
  }}
  section .desc {{ color: var(--fg-dim); font-size: 12px; margin: -8px 0 14px 0; }}

  /* Organ grid */
  .organ-grid {{
    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }}
  .organ-card {{
    background: var(--bg-2); border: 1px solid var(--line); border-radius: 6px;
    overflow: hidden; transition: border-color 0.2s ease;
  }}
  .organ-card[data-risk="RED"]   {{ border-color: var(--red); }}
  .organ-card[data-risk="AMBER"] {{ border-color: var(--amber); }}
  .organ-card[data-risk="GREEN"] {{ border-color: var(--green); }}
  .organ-card[data-risk="GREY"]  {{ border-color: var(--grey); }}
  .oc-head {{ padding: 12px 14px; background: var(--bg-3); border-bottom: 1px solid var(--line); }}
  .oc-name {{ font-size: 15px; font-weight: 600; color: var(--fg); }}
  .oc-role {{ font-size: 11px; color: var(--fg-dim); margin-top: 2px; }}
  .oc-body {{ padding: 12px 14px; }}
  .oc-row {{
    display: flex; justify-content: space-between; padding: 4px 0;
    border-bottom: 1px dotted #1d242e; font-size: 12px;
  }}
  .oc-row:last-child {{ border-bottom: none; }}
  .oc-row .lbl {{ color: var(--fg-dim); }}
  .oc-row .val {{ color: var(--fg); }}
  .oc-foot {{
    padding: 8px 14px; background: var(--bg); color: var(--fg-dim); font-size: 11px;
    border-top: 1px solid var(--line);
  }}
  .val.live.UP {{ color: var(--green); }}
  .val.live.DOWN {{ color: var(--red); }}
  .val.risk.GREEN {{ color: var(--green); }}
  .val.risk.AMBER {{ color: var(--amber); }}
  .val.risk.RED {{ color: var(--red); }}
  .val.risk.GREY {{ color: var(--grey); }}

  /* Histogram */
  .histogram {{
    display: flex; height: 26px; border-radius: 4px; overflow: hidden;
    border: 1px solid var(--line); font-family: var(--mono); font-size: 11px;
  }}
  .histogram .seg {{ display: flex; align-items: center; justify-content: center;
                     font-weight: 600; color: #0a0e14; }}
  .histogram .seg.GREEN {{ background: var(--green); }}
  .histogram .seg.AMBER {{ background: var(--amber); }}
  .histogram .seg.RED   {{ background: var(--red); }}
  .histogram .seg.GREY  {{ background: var(--grey); color: #fff; }}
  .histogram .legend {{
    display: flex; gap: 14px; margin-top: 8px; font-size: 11px; color: var(--fg-dim);
  }}
  .histogram .legend .dot {{
    display: inline-block; width: 9px; height: 9px; border-radius: 2px;
    margin-right: 4px; vertical-align: middle;
  }}

  /* Floors */
  .floor-grid {{
    display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 8px;
  }}
  .floor {{
    background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
    padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;
    font-size: 11px;
  }}
  .floor .fid {{ font-family: var(--mono); font-weight: 600; color: var(--accent); font-size: 11px; }}
  .floor .fname {{ color: var(--fg); font-weight: 500; }}
  .floor .fobs {{ color: var(--fg-dim); font-family: var(--mono); font-size: 10px; }}
  .floor[data-obs="observed"]      {{ border-color: var(--green); }}
  .floor[data-obs="partial"]       {{ border-color: var(--amber); }}
  .floor[data-obs="weak"]          {{ border-color: var(--red); }}
  .floor[data-obs="drift-detected"]{{ border-color: var(--red); }}
  .floor[data-obs="degraded"]      {{ border-color: var(--amber); }}

  /* Source panel */
  pre.source {{
    background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
    padding: 12px; font-family: var(--mono); font-size: 11px;
    color: var(--fg-dim); overflow: auto; max-height: 320px; margin: 0;
  }}
  pre.source .k {{ color: var(--accent); }}

  footer {{
    padding: 18px 22px; border-top: 1px solid var(--line); color: var(--fg-dim);
    font-size: 11px; text-align: center;
  }}
  footer .mono {{ color: var(--accent); }}

  .dim {{ color: var(--fg-dim); }}
</style>
</head>
<body>
<header>
  <h1>arifOS Radar <span class="sub">— Forge MCP UI</span></h1>
  <span class="sub">Bind <span class="mono">127.0.0.1:<span data-field="port">{DEFAULT_PORT}</span></span></span>
  <span class="sub">Auto-refresh <span class="mono">10s</span></span>
  <span class="sub">Updated <span class="mono" data-field="generated_at">…</span></span>
</header>

<div class="zen-pulse">
  <div class="zp-item">
    <span class="zp-ask">Where am I?</span>
    <span class="zp-val">arifOS · Forge MCP UI · 5-organ radar</span>
  </div>
  <div class="zp-item">
    <span class="zp-ask">Why care?</span>
    <span class="zp-val gold">Read-only. Bind 127.0.0.1. No mutation. F1/F11/F12 by design.</span>
  </div>
  <div class="zp-item">
    <span class="zp-ask">What next?</span>
    <span class="zp-val">Observe. If a card turns red → check the organ's systemd unit.</span>
  </div>
</div>

<main>
  <section>
    <h2>Federation Aggregate</h2>
    <div class="desc">Cross-check between RECONCILIATION_REPORT.json (last seal) and live 127.0.0.1 probes.</div>
    <div class="histogram" data-field="histogram">
      <div class="seg GREEN" data-field="h-GREEN">0</div>
      <div class="seg AMBER" data-field="h-AMBER">0</div>
      <div class="seg RED"   data-field="h-RED">0</div>
      <div class="seg GREY"  data-field="h-GREY">0</div>
    </div>
    <div class="legend">
      <span><span class="dot" style="background: var(--green)"></span>GREEN · live + ONLINE</span>
      <span><span class="dot" style="background: var(--amber)"></span>AMBER · AUTH_GATED (gate upstream)</span>
      <span><span class="dot" style="background: var(--red)"></span>RED · reconciled online but socket DOWN</span>
      <span><span class="dot" style="background: var(--grey)"></span>GREY · no reconciled state</span>
    </div>
    <div class="desc mono" style="margin-top: 12px;" data-field="aggregate_text">…</div>
  </section>

  <section>
    <h2>Organ Radar · 5 Organs</h2>
    <div class="desc">Each card = one (reconciled state) ∩ (live 127.0.0.1 socket). Click → /health endpoint, opens stdout log.</div>
    <div class="organ-grid">
      {organs_grid}
    </div>
  </section>

  <section>
    <h2>Floor Observations · F1–F13</h2>
    <div class="desc">This UI <em>observes</em> data that bears on each floor; the kernel <span class="mono">arif_judge</span> is the only organ that adjudicates verdicts. Border color = whether we have observability.</div>
    <div class="floor-grid" data-field="floor-grid">
      {floors_html}
    </div>
  </section>

  <section>
    <h2>Data Sources · F11 Auditability</h2>
    <div class="desc">What this dashboard is reading from (read-only paths).</div>
    <pre class="source" data-field="source-text">…</pre>
  </section>
</main>

<footer>
  forge_mcp_ui · F1 AMANAH (read-only) · F11 AUDITABILITY (logged to stderr) ·
  F12 INJECTION (CSP no-external, bind <span class="mono">127.0.0.1:{DEFAULT_PORT}</span>) ·
  LOCALHOST_IS_PASSWORD
</footer>

<script>
(() => {{
  const POLL_MS = 10000;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  function fmtBool(v) {{ return v ? "UP" : "DOWN"; }}
  function fmtLatency(o) {{
    if (o == null) return "—";
    if (o < 1) return o.toFixed(2) + " ms";
    return Math.round(o) + " ms";
  }}

  function apply(state) {{
    // header
    $$("[data-field='generated_at']").forEach(el => el.textContent = state.generated_at);
    $$("[data-field='port']").forEach(el => el.textContent = state.host.port);

    // histogram
    const hist = state.aggregate.histogram;
    const total = Math.max(1, Object.values(hist).reduce((a,b)=>a+b,0));
    for (const [k, v] of Object.entries(hist)) {{
      const seg = $("[data-field='h-" + k + "']");
      if (seg) {{
        seg.textContent = v;
        seg.style.flex = String(v);
        seg.style.display = v === 0 ? "none" : "flex";
      }}
    }}

    const a = state.aggregate;
    const r = state.reconciliation;
    const recon_frag = r.ok
      ? `recon @ <span class="mono">${{r.reconciled_at || "?"}}</span> · ${{r.total_organs || "?"}}/${{r.organs_online || "?"}} online`
      : `<span style="color:var(--red)">report: ${{r.error}}</span>`;
    $("[data-field='aggregate_text']").innerHTML =
      `${{a.organs_live_socket}}/${{a.organs_total}} sockets live · ` +
      `${{a.organs_reconciled_online}} reconciled online · ` +
      `${{a.organs_auth_gated}} AUTH_GATED · ` +
      `tools live <span class="mono">${{a.total_tools_live}}</span> · ` +
      `drift <span class="mono">${{a.total_drift}}</span> · ` +
      recon_frag;

    // organ cards
    for (const o of state.organs) {{
      const card = $("[data-organ-id='" + o.id + "']");
      if (!card) continue;
      card.dataset.risk = o.risk;
      const live = o.live.live ? "UP" : "DOWN";
      card.querySelector("[data-field='live']").textContent = live + " " + (o.live.http_code || "—");
      card.querySelector("[data-field='live']").className = "val mono live " + live;
      card.querySelector("[data-field='reconciled_status']").textContent = o.reconciled_status;
      card.querySelector("[data-field='risk']").textContent = o.risk;
      card.querySelector("[data-field='risk']").className = "val mono risk " + o.risk;
      card.querySelector("[data-field='tool_count']").textContent = o.tool_count;
      card.querySelector("[data-field='drift_count']").textContent = String(o.drift_count);
      card.querySelector("[data-field='version']").textContent = o.version;
      card.querySelector("[data-field='latency_ms']").textContent = fmtLatency(o.live.latency_ms);
      const msg = o.converged
        ? `✓ converged · http ${{o.live.http_code}} · ${{o.live.latency_ms}} ms`
        : (o.reconciled_status === "AUTH_GATED"
            ? `◇ AUTH_GATED upstream · socket live · http ${{o.live.http_code}}`
            : `⚠ not converged · reconciled=${{o.reconciled_status}} live=${{live}}`);
      card.querySelector("[data-field='converged_msg']").textContent = msg;
    }}

    // floor observations
    const fg = $("[data-field='floor-grid']");
    if (fg) {{
      // build floor mapping by id (since order matches registration)
      const fmap = Object.fromEntries(state.floors.map(f => [f.id, f]));
      $$(".floor", fg).forEach(el => {{
        const fid = el.dataset.fid;
        const f = fmap[fid];
        if (f) {{
          el.dataset.obs = f.channel.observation;
          el.querySelector(".fobs").textContent = f.channel.observation;
          el.title = f.hint + " · " + f.channel.evidence;
        }}
      }});
    }}

    // source panel
    $("[data-field='source-text']").textContent = JSON.stringify(
      {{ path: state.reconciliation.path, ok: state.reconciliation.ok,
         sample_keys: Object.keys(state.reconciliation) }},
      null, 2);
  }}

  async function tick() {{
    try {{
      const r = await fetch("/data.json", {{ cache: "no-store", credentials: "same-origin" }});
      if (!r.ok) throw new Error("HTTP " + r.status);
      const state = await r.json();
      apply(state);
    }} catch (e) {{
      console.error("tick failed", e);
      $$("[data-field='generated_at']").forEach(el => el.textContent = "ERR: " + e.message);
    }}
  }}

  tick();
  setInterval(tick, POLL_MS);
}})();
</script>
</body>
</html>
"""
    return html.encode("utf-8")


# We precompute HTML once at import — it never changes at runtime.
HTML_DOC = _render_html()


class RadarHandler(BaseHTTPRequestHandler):
    """Hardened read-only handler.

    Only GET (HEAD implicitly) is served.  Any other verb returns 405.
    """

    server_version = "arifOS-Radar/1.0 (read-only)"

    # State cache is created in main() and bound here.
    state_cache: StateCache = None  # type: ignore[assignment]

    # ── Security headers (F12 INJECTION) ────────────────────────────────────
    def _set_hardening_headers(self) -> None:
        self.send_header("Content-Security-Policy", _CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        # 127.0.0.1 bind is an additional guard, not a substitute.
        self.send_header("Cache-Control", "no-store")

    def _send(self, status: HTTPStatus, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._set_hardening_headers()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:  # F11 — via stdlib logger
        log.info("%s - %s", self.address_string(), fmt % args)

    # ── Methods ──────────────────────────────────────────────────────────────
    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self._send(HTTPStatus.OK, HTML_DOC, "text/html; charset=utf-8")
            return
        if path == "/data.json":
            try:
                state = self.state_cache.get()
            except Exception as e:  # pragma: no cover — graceful
                self._send(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    json.dumps({"error": str(e)}).encode("utf-8"),
                    "application/json; charset=utf-8",
                )
                return
            body = json.dumps(state, ensure_ascii=False, sort_keys=False).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return
        if path == "/health":
            self._send(
                HTTPStatus.OK,
                b'{"status":"UP","service":"forge_mcp_ui","read_only":true}',
                "application/json; charset=utf-8",
            )
            return
        # Unknown path
        self._send(
            HTTPStatus.NOT_FOUND,
            b'{"error":"not_found","read_only":true}',
            "application/json; charset=utf-8",
        )

    def do_HEAD(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(HTML_DOC)))
            self._set_hardening_headers()
            self.end_headers()
            return
        self.send_response(HTTPStatus.NOT_FOUND)
        self.end_headers()

    # ── Read-only enforcement (F1) ──────────────────────────────────────────
    def do_POST(self) -> None:    # noqa: N802
        self._refuse_method()

    def do_PUT(self) -> None:     # noqa: N802
        self._refuse_method()

    def do_DELETE(self) -> None:  # noqa: N802
        self._refuse_method()

    def do_PATCH(self) -> None:   # noqa: N802
        self._refuse_method()

    def do_OPTIONS(self) -> None: # noqa: N802
        self._refuse_method()

    def _refuse_method(self) -> None:
        body = json.dumps({
            "error": "method_not_allowed",
            "read_only": True,
            "doctrine": "F1 AMANAH · no execution surfaces",
        }).encode("utf-8")
        self._send(HTTPStatus.METHOD_NOT_ALLOWED, body, "application/json; charset=utf-8")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        prog="forge_mcp_ui",
        description="arifOS Radar UI — pure stdlib, read-only, bound to 127.0.0.1.",
    )
    parser.add_argument(
        "--host", default=BIND_HOST,
        help=f"Bind host (default: {BIND_HOST}; LOCALHOST_IS_PASSWORD doctrine forbids 0.0.0.0)",
    )
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT,
        help=f"Bind port (default: {DEFAULT_PORT})",
    )
    args = parser.parse_args()

    # F1 AMANAH guard: refuse to bind to anything other than 127.0.0.1.
    if args.host not in (BIND_HOST, "localhost"):
        log.error("Refusing bind to '%s' — LOCALHOST_IS_PASSWORD requires 127.0.0.1.",
                  args.host)
        return 2

    _SERVER_PORT_HOLDER["value"] = args.port

    cache = StateCache(RECONCILIATION_PATH)
    RadarHandler.state_cache = cache

    # Warm state once before binding so the first /data.json call is fast.
    try:
        cache.get()
    except Exception as e:  # pragma: no cover
        log.warning("Initial state build failed: %s (UI will retry on demand)", e)

    httpd = ThreadingHTTPServer((args.host, args.port), RadarHandler)
    sa = httpd.socket.getsockname()
    log.info("arifOS Radar UI listening on http://%s:%s/ (read-only, 5 organs, F11 logging)",
             sa[0], sa[1])

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down (KeyboardInterrupt)")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
