#!/usr/bin/env python3
"""FED Flow Probe — proves attribution actually flows, node by node.

Two modes:

  --offline (default)
      Read-only inventory: nodes, gateways, reachability, agent route matrix.
      No credentials, no inference, no writes.

  --live
      Send ONE bounded canary call (max_tokens=1) through a named gateway with
      attribution headers + metadata, then look for the persisted ledger row.
      Prints PASS / PARTIAL / FAIL / UNKNOWN with the evidence it used.

The probe never prints API keys or prompt content.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fed_attribution_client import (  # noqa: E402
    Attribution,
    CONTRACT,
    gateway_id_for_url,
    is_valid_attribution,
    load_registry,
    post_chat,
)

DEFAULT_LEDGERS = (
    os.environ.get("FED_LEDGER_DB", ""),
    "/root/.local/share/arifos/token_bank.db",
    "/root/A-FORGE/scripts/data/token_bank.db",
)
AGENTS_REGISTRY = (
    Path(__file__).resolve().parent.parent / "deploy" / "fed" / "agents.json"
)


def _tcp(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _split(listen: str) -> tuple[str, int]:
    if ":" not in listen:
        return listen, 0
    host, _, port = listen.rpartition(":")
    return host, int(port) if port.isdigit() else 0


def offline_report(registry: dict, agents: dict) -> dict:
    nodes_out = []
    for node, meta in (registry.get("nodes") or {}).items():
        inf = meta.get("inference") or {}
        listeners = []
        for listen in inf.get("listen") or []:
            host, port = _split(str(listen))
            listeners.append(
                {
                    "listen": listen,
                    "reachable_from_here": _tcp(host, port)
                    if host not in ("0.0.0.0", "::")
                    else None,
                }
            )
        nodes_out.append(
            {
                "node": node,
                "role": meta.get("role"),
                "loopback_gateway": meta.get("loopback_gateway"),
                "status": inf.get("status"),
                "listeners": listeners,
                "callback": inf.get("callback"),
                "ledger": inf.get("ledger"),
                "observed_defect": inf.get("observed_defect"),
            }
        )

    agents_out = []
    for a in agents.get("agents") or []:
        agents_out.append(
            {
                "agent": a.get("name"),
                "fi": a.get("fi"),
                "base_url": (a.get("fed_route") or {}).get("base_url"),
                "injection": a.get("injection"),
                "status": a.get("status"),
            }
        )

    return {
        "mode": "offline",
        "contract": registry.get("contract"),
        "registry_captured_at": registry.get("captured_at"),
        "nodes": nodes_out,
        "agents": agents_out,
        "evidence": "OBS — TCP reachability only; no inference sent",
    }


def _ledger_columns(db: str) -> list[str]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=1.0)
    try:
        return [
            r[1] for r in con.execute("PRAGMA table_info(token_bank_spend)").fetchall()
        ]
    finally:
        con.close()


def ledger_lookup(
    trace_id: str, call_id: str | None, actor_id: str, db_paths: list[str]
) -> dict:
    """Search each ledger with the strongest key it actually has."""
    attempts = []
    for db in [p for p in db_paths if p and os.path.exists(p)]:
        try:
            cols = _ledger_columns(db)
        except sqlite3.Error as exc:
            attempts.append({"db": db, "error": f"unreadable: {exc}"})
            continue
        if "trace_id" in cols:
            key, value = "trace_id", trace_id
        elif "call_id" in cols and call_id:
            key, value = "call_id", call_id
        else:
            key, value = None, None
        try:
            con = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=1.0)
            con.row_factory = sqlite3.Row
            if key:
                rows = con.execute(
                    f"SELECT rowid, * FROM token_bank_spend WHERE {key} = ? ORDER BY rowid DESC LIMIT 3",
                    (value,),
                ).fetchall()
            else:
                # Weak fallback: recent rows for this actor within 120s.
                actor_col = (
                    "actor_id"
                    if "actor_id" in cols
                    else ("agent_id" if "agent_id" in cols else None)
                )
                if not actor_col:
                    rows = []
                else:
                    rows = con.execute(
                        f"SELECT rowid, * FROM token_bank_spend WHERE {actor_col} = ? "
                        "AND called_at >= datetime('now','-120 seconds') ORDER BY rowid DESC LIMIT 3",
                        (actor_id,),
                    ).fetchall()
            con.close()
        except sqlite3.Error as exc:
            attempts.append({"db": db, "key": key, "error": str(exc)})
            continue
        attempts.append(
            {
                "db": db,
                "key": key,
                "match_count": len(rows),
                "rows": [dict(r) for r in rows],
                "strength": "STRONG" if key else ("WEAK" if rows else "NONE"),
            }
        )
    return {"attempts": attempts}


def live_probe(args: argparse.Namespace) -> dict:
    api_key = os.environ.get(args.api_key_env)
    if not api_key:
        return {
            "mode": "live",
            "verdict": "UNKNOWN",
            "reason": f"{args.api_key_env} not set",
        }

    base = args.base_url
    attr = Attribution.from_env(
        actor_id=args.actor,
        client="fed-flow-probe/1.0",
        purpose="verification",
        session_id=args.session_id or f"probe-{int(time.time())}",
        task_id="fed-attribution-flow-probe",
        turn_id="canary",
        trace_id=None,
        origin_node=args.node or None,
    )
    result = post_chat(
        base,
        api_key,
        args.model,
        [{"role": "user", "content": "reply with the single word: ok"}],
        attr,
        max_tokens=1,
        timeout=args.timeout,
        extra_body={"temperature": 0},
    )
    call_id = (result.get("response_headers") or {}).get("x-litellm-call-id")
    ledger = ledger_lookup(
        attr.trace_id,
        call_id,
        attr.actor_id,
        [args.ledger_db] if args.ledger_db else list(DEFAULT_LEDGERS),
    )
    strong = [
        a
        for a in ledger["attempts"]
        if a.get("strength") == "STRONG" and a.get("match_count")
    ]
    weak = [
        a
        for a in ledger["attempts"]
        if a.get("strength") == "WEAK" and a.get("match_count")
    ]

    if result["ok"] and strong:
        verdict = "PASS"
        reason = "request delivered and ledger row matched by strong key"
    elif result["ok"] and weak:
        verdict = "PARTIAL"
        reason = "request delivered; ledger matched only by weak time+actor key"
    elif result["ok"]:
        verdict = "FAIL"
        reason = "request delivered but NO ledger row matched — attribution not landing"
    else:
        verdict = "FAIL"
        reason = f"request rejected HTTP {result.get('status')}"

    return {
        "mode": "live",
        "verdict": verdict,
        "reason": reason,
        "expected_entry_gateway": gateway_id_for_url(base, attr.origin_node),
        "request": {
            "actor": attr.actor_id,
            "trace_id": attr.trace_id,
            "model_group": args.model,
            "base_url": base,
            "max_tokens": 1,
        },
        "attribution_valid": is_valid_attribution(attr.metadata())[0],
        "response": {
            "ok": result["ok"],
            "status": result["status"],
            "served_model": result.get("served_model"),
            "call_id": call_id,
            "response_headers": result.get("response_headers"),
        },
        "ledger": ledger,
        "evidence": "OBS — one paid canary call + read-only ledger lookup",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="FED attribution flow probe")
    ap.add_argument(
        "--live", action="store_true", help="send one canary call (default: offline)"
    )
    ap.add_argument("--json", action="store_true", default=True)
    ap.add_argument("--actor", default="fed-flow-probe")
    ap.add_argument("--node", default=None)
    ap.add_argument("--base-url", default="http://127.0.0.1:4000/v1")
    ap.add_argument("--model", default="agi-333")
    ap.add_argument("--api-key-env", default="LITELLM_MASTER_KEY")
    ap.add_argument("--ledger-db", default=None)
    ap.add_argument("--session-id", default=None)
    ap.add_argument("--timeout", type=float, default=60.0)
    ap.add_argument("--registry", default=None)
    args = ap.parse_args(argv)

    registry = load_registry(args.registry)
    agents_path = (
        Path(args.registry).parent / "agents.json" if args.registry else AGENTS_REGISTRY
    )
    agents = json.loads(agents_path.read_text(encoding="utf-8"))

    report = live_probe(args) if args.live else offline_report(registry, agents)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
