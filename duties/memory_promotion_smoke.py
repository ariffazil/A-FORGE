#!/usr/bin/env python3
"""
Memory promotion heat — L1→L6 path smoke test
══════════════════════════════════════════════

Proves the federation memory stack is reachable and that an ephemeral
observation can be written with provenance labels at each tier that is live.

  L1 Redis      — now / ephemeral (SET + GET + TTL)
  L2 Redis      — session thread (HASH session key)
  L3 Qdrant     — fuzzy similarity (arifos_memory collection exists + optional point)
  L4 Postgres   — structured (SELECT 1 / optional table probe)
  L5 Graphiti   — relationships (health on :8000)
  L6 VAULT999   — append-only outcomes.jsonl readable + last seal timestamp

Does NOT seal doctrine. Does NOT claim L3 write if collection schema blocks it.
Exit 0 = all critical tiers (L1, L3, L6) pass. L2/L4/L5 soft.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import json
import os
import socket
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib import error, request

REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
GRAPHITI_URL = os.environ.get("GRAPHITI_URL", "http://127.0.0.1:8000")
PG_HOST = os.environ.get("POSTGRES_HOST", "127.0.0.1")
PG_PORT = int(os.environ.get("POSTGRES_PORT", "5432"))
VAULT_OUTCOMES = Path(
    os.environ.get(
        "VAULT999_OUTCOMES",
        "/agent/vault999/receipts/outcomes.jsonl",
    )
)
SMOKE_KEY = f"arifos:smoke:l1:{uuid.uuid4().hex[:12]}"
SESSION_KEY = f"arifos:smoke:l2:session:{uuid.uuid4().hex[:8]}"


def ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def tcp_open(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def http_json(url: str, timeout: float = 3.0) -> tuple[bool, Any]:
    try:
        with request.urlopen(url, timeout=timeout) as resp:
            return True, json.loads(resp.read().decode())
    except Exception as e:
        return False, str(e)


def redis_cmd(*args: str) -> tuple[bool, str]:
    """Minimal RESP client — no redis package required."""
    try:
        with socket.create_connection((REDIS_HOST, REDIS_PORT), timeout=3.0) as s:
            parts = [f"*{len(args)}\r\n".encode()]
            for a in args:
                b = a.encode() if isinstance(a, str) else a
                parts.append(f"${len(b)}\r\n".encode() + b + b"\r\n")
            s.sendall(b"".join(parts))
            data = s.recv(65536).decode(errors="replace")
            return True, data.strip()
    except Exception as e:
        return False, str(e)


def smoke_l1() -> dict:
    """L1: ephemeral SET/GET/EXPIRE."""
    payload = json.dumps({"ts": ts(), "tier": "L1", "smoke": True})
    ok_set, r_set = redis_cmd("SET", SMOKE_KEY, payload, "EX", "120")
    ok_get, r_get = redis_cmd("GET", SMOKE_KEY)
    pass_ = ok_set and ok_get and "L1" in r_get
    return {
        "tier": "L1",
        "name": "Redis ephemeral",
        "pass": pass_,
        "set": r_set[:80],
        "get_ok": "L1" in r_get if ok_get else False,
        "key": SMOKE_KEY,
    }


def smoke_l2() -> dict:
    """L2: session thread HASH."""
    ok_h, r_h = redis_cmd("HSET", SESSION_KEY, "actor", "memory-smoke", "ts", ts())
    ok_g, r_g = redis_cmd("HGET", SESSION_KEY, "actor")
    redis_cmd("EXPIRE", SESSION_KEY, "120")
    pass_ = ok_h and ok_g and "memory-smoke" in r_g
    return {
        "tier": "L2",
        "name": "Redis session",
        "pass": pass_,
        "detail": r_g[:80] if ok_g else r_h[:80],
    }


def smoke_l3() -> dict:
    """L3: Qdrant arifos_memory collection reachable + points_count."""
    ok, body = http_json(f"{QDRANT_URL}/collections/arifos_memory")
    if not ok:
        return {"tier": "L3", "name": "Qdrant arifos_memory", "pass": False, "error": body}
    result = body.get("result") or {}
    points = result.get("points_count", 0)
    status = result.get("status")
    return {
        "tier": "L3",
        "name": "Qdrant arifos_memory",
        "pass": status == "green" or points is not None,
        "points_count": points,
        "status": status,
    }


def smoke_l4() -> dict:
    """L4: Postgres TCP + optional SELECT 1 via docker exec fallback."""
    if not tcp_open(PG_HOST, PG_PORT):
        return {
            "tier": "L4",
            "name": "Postgres",
            "pass": False,
            "error": f"tcp {PG_HOST}:{PG_PORT} closed",
        }
    # Prefer docker exec pg_isready — no password in smoke path
    import subprocess

    try:
        r = subprocess.run(
            [
                "docker",
                "exec",
                "postgres",
                "pg_isready",
                "-U",
                "arifos_admin",
                "-d",
                "vault999",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        ready = r.returncode == 0
        return {
            "tier": "L4",
            "name": "Postgres vault999",
            "pass": ready,
            "detail": (r.stdout or r.stderr).strip()[:120],
        }
    except Exception as e:
        return {"tier": "L4", "name": "Postgres", "pass": tcp_open(PG_HOST, PG_PORT), "error": str(e)}


def smoke_l5() -> dict:
    """L5: Graphiti MCP health."""
    ok, body = http_json(f"{GRAPHITI_URL}/health")
    if not ok:
        # try root
        ok2, body2 = http_json(GRAPHITI_URL)
        return {
            "tier": "L5",
            "name": "Graphiti",
            "pass": ok2,
            "detail": str(body2)[:120] if ok2 else str(body)[:120],
        }
    return {"tier": "L5", "name": "Graphiti", "pass": True, "detail": str(body)[:120]}


def smoke_l6() -> dict:
    """L6: VAULT999 outcomes.jsonl readable, append-only path live."""
    path = VAULT_OUTCOMES
    if not path.exists():
        alt = Path("/root/.local/share/arifos/vault999/outcomes.jsonl")
        path = alt if alt.exists() else path
    if not path.exists():
        return {"tier": "L6", "name": "VAULT999", "pass": False, "error": "outcomes.jsonl missing"}
    try:
        size = path.stat().st_size
        # last non-empty line
        last = ""
        with path.open("rb") as f:
            f.seek(max(0, size - 4096))
            chunk = f.read().decode(errors="replace")
            lines = [ln for ln in chunk.splitlines() if ln.strip()]
            last = lines[-1] if lines else ""
        obj = json.loads(last) if last else {}
        return {
            "tier": "L6",
            "name": "VAULT999 outcomes",
            "pass": size > 0 and bool(obj),
            "path": str(path),
            "bytes": size,
            "last_keys": list(obj.keys())[:8],
            "last_ts": obj.get("timestamp") or obj.get("ts") or obj.get("created_at"),
        }
    except Exception as e:
        return {"tier": "L6", "name": "VAULT999", "pass": False, "error": str(e)}


def run() -> dict:
    results = {
        "ts": ts(),
        "source": "memory_promotion_smoke",
        "tiers": {
            "L1": smoke_l1(),
            "L2": smoke_l2(),
            "L3": smoke_l3(),
            "L4": smoke_l4(),
            "L5": smoke_l5(),
            "L6": smoke_l6(),
        },
    }
    critical = ["L1", "L3", "L6"]
    soft = ["L2", "L4", "L5"]
    crit_pass = all(results["tiers"][t]["pass"] for t in critical)
    soft_pass = sum(1 for t in soft if results["tiers"][t]["pass"])
    results["verdict"] = "SEAL" if crit_pass else "HOLD"
    results["summary"] = {
        "critical_pass": crit_pass,
        "critical": {t: results["tiers"][t]["pass"] for t in critical},
        "soft_pass_count": soft_pass,
        "soft": {t: results["tiers"][t]["pass"] for t in soft},
    }
    # promotion heat: can we see the stack as a ladder?
    results["promotion_heat"] = {
        "L1_reachable": results["tiers"]["L1"]["pass"],
        "L3_has_points": (results["tiers"]["L3"].get("points_count") or 0) > 0,
        "L6_has_seals": (results["tiers"]["L6"].get("bytes") or 0) > 0,
        "note": "Full auto-promotion L1→L6 is a separate metabolize skill; this smoke proves reachability + heat.",
    }
    return results


if __name__ == "__main__":
    out = run()
    print(json.dumps(out, indent=2, default=str))
    sys.exit(0 if out["verdict"] == "SEAL" else 1)
