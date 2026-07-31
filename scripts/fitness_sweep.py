#!/usr/bin/env python3
"""
fitness_sweep.py — A-FORGE Survival of the Fittest · SEQUENTIAL T0 SWEEP

For each tool in the live A-FORGE surface (port 7071):
  1. fetch its current tool manifest via tools/list (cached on first call)
  2. invoke forge_evaluate (read-only OBSERVE-class) to compute G + C_dark
  3. record the verdict (SEAL / REVIEW / VOID)
  4. write a structured JSON record per tool
  5. aggregate into a single sweep-summary.json

F1 boundary respected: NO forge_register / forge_seal / push / deploy.
This script only reads. Demotion/promotion is a separate T1/T3 task.

Usage:
    python3 scripts/fitness_sweep.py [--limit N] [--only-fit] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import urllib.request
import urllib.error
import urllib.parse


AFORGE_BASE = "http://127.0.0.1:7071"
MCP_PATH = "/mcp"
PROTOCOL_VERSION = "2024-11-05"


def _mcp_call(method: str, params: dict[str, Any], session_id: str | None = None) -> tuple[dict[str, Any], str | None]:
    """Single MCP JSON-RPC call. Returns (parsed result dict, captured session_id from response header)."""
    payload = {
        "jsonrpc": "2.0",
        "id": int(time.time() * 1000) % 1_000_000,
        "method": method,
        "params": params,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{AFORGE_BASE}{MCP_PATH}",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **({"mcp-session-id": session_id} if session_id else {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            # MCP session_id lives in the response HEADER, not body
            new_sid = resp.headers.get("mcp-session-id") or resp.headers.get("Mcp-Session-Id")
    except urllib.error.URLError as e:
        raise RuntimeError(f"MCP transport error: {e}") from e
    # Strip SSE framing ONLY if present at start (don't strip "data:" mentions inside JSON content)
    if raw.startswith("data:"):
        raw = raw[len("data:"):].lstrip("\n").strip()
    data = json.loads(raw)
    if "error" in data:
        raise RuntimeError(f"MCP error {data['error'].get('code')}: {data['error'].get('message')}")
    return data.get("result", {}), new_sid


def _session() -> str:
    """Initialize an MCP session, return session_id (from response header)."""
    result, sid = _mcp_call(
        "initialize",
        {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "fitness_sweep", "version": "1.0"},
        },
    )
    if not sid:
        raise RuntimeError("initialize returned no session_id header")
    # Notifications/initialized (fire-and-forget, may not be needed)
    try:
        _mcp_call("notifications/initialized", {}, session_id=sid)
    except Exception:
        pass
    return sid


def _list_tools(sid: str) -> list[dict[str, Any]]:
    result, _ = _mcp_call("tools/list", {}, session_id=sid)
    return result.get("tools", [])


def _evaluate(sid: str, tool: dict[str, Any]) -> dict[str, Any]:
    """Invoke forge_evaluate for a single tool manifest. Returns verdict record."""
    name = tool.get("name", "?")
    desc = tool.get("description", "") or ""
    candidate_name = name if name.startswith("forge_") else f"forge_{name}"
    args = {
        "tool_name": candidate_name,
        "description": desc[:1500] if desc else f"A-FORGE canonical tool {name}",
        "domain": "aforge",
        "implementation": "",  # empty — pure spec evaluation
    }
    try:
        result, _ = _mcp_call("tools/call", {"name": "forge_evaluate", "arguments": args}, session_id=sid)
        content = result.get("content", [])
        text = content[0].get("text", "") if content else ""
        try:
            parsed = json.loads(text)
            # forge_evaluate nests the verdict scalars under .data
            data = parsed.get("data", parsed)
            return {
                "tool_name": name,
                "verdict": data.get("verdict"),
                "G": data.get("G"),
                "C_dark": data.get("C_dark"),
                "W3": data.get("W3"),
                "h": data.get("h"),
                "QDF": data.get("QDF"),
                "fingerprint": data.get("fingerprint"),
                "scores": data.get("scores"),
                "ok": True,
            }
        except (json.JSONDecodeError, KeyError, IndexError):
            return {"tool_name": name, "ok": False, "raw": text[:200]}
    except Exception as e:
        return {"tool_name": name, "ok": False, "error": str(e)[:200]}


def classify(record: dict[str, Any]) -> str:
    """Heuristic classification: FIT, REVIEW, VOID, UNKNOWN."""
    verdict = record.get("verdict")
    G = record.get("G")
    C_dark = record.get("C_dark")
    if verdict == "VOID":
        return "VOID"
    if verdict == "SEAL" and G is not None and G >= 0.80:
        return "FIT"
    if verdict == "REVIEW":
        return "REVIEW"
    if verdict == "SEAL":
        return "REVIEW"  # SEAL but G below threshold → review
    return "UNKNOWN"


def sweep(limit: int | None, only_fit: bool, out_dir: Path) -> dict[str, Any]:
    sid = _session()
    tools = _list_tools(sid)
    if limit is not None:
        tools = tools[:limit]

    records: list[dict[str, Any]] = []
    summary = {
        "FIT": 0,
        "REVIEW": 0,
        "VOID": 0,
        "UNKNOWN": 0,
        "errors": 0,
        "ok": 0,
    }

    started = datetime.now(timezone.utc).isoformat()
    print(f"[{started}] fitness_sweep starting — {len(tools)} tools (sequential)", flush=True)

    for i, tool in enumerate(tools, 1):
        name = tool.get("name", "?")
        record = _evaluate(sid, tool)
        cls = classify(record)
        record["class"] = cls
        records.append(record)

        if record.get("ok"):
            summary["ok"] += 1
        else:
            summary["errors"] += 1
        summary[cls] = summary.get(cls, 0) + 1

        # Compact per-tool log line
        v = record.get("verdict") or record.get("error", "?")[:30]
        g = record.get("G", "-")
        c = record.get("C_dark", "-")
        print(f"  [{i:3}/{len(tools)}] {name:35} → {cls:8} verdict={v} G={g} C_dark={c}", flush=True)

        # gentle pacing — avoid hammering A-FORGE if a slow tool
        time.sleep(0.05)

    finished = datetime.now(timezone.utc).isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    full_path = out_dir / "fitness_sweep_full.json"
    summary_path = out_dir / "fitness_sweep_summary.json"

    payload = {
        "started_at_utc": started,
        "finished_at_utc": finished,
        "tool_count": len(tools),
        "summary": summary,
        "records": records,
    }
    full_path.write_text(json.dumps(payload, indent=2))

    short = {
        "started_at_utc": started,
        "finished_at_utc": finished,
        "tool_count": len(tools),
        "summary": summary,
    }
    summary_path.write_text(json.dumps(short, indent=2))

    print(f"\n[{finished}] fitness_sweep complete — records: {summary}", flush=True)
    print(f"  full:     {full_path}", flush=True)
    print(f"  summary:  {summary_path}", flush=True)
    return short


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=None, help="limit number of tools (default: all)")
    p.add_argument("--only-fit", action="store_true", help="only print FIT/REVIEW/VOID verdicts")
    p.add_argument("--out", type=Path, default=Path("/root/A-FORGE/out/fitness_sweep"), help="output directory")
    args = p.parse_args()
    result = sweep(args.limit, args.only_fit, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
