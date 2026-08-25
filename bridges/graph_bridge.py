#!/usr/bin/env python3
"""
graph_bridge.py — APA Code-Graph Bridge for A-FORGE.

Exposes the AAA code-graph (`/root/AAA/graph/codegraph.db`) as HTTP verbs
under the APA envelope so forge_* tools can query blast-radius / dependents
/ search / impact without needing direct SQLite access.

Port: 18922 (127.0.0.1) — change via GRAPH_BRIDGE_PORT env.

Pattern: same APA envelope as `A-FORGE/bridges/gemini_bridge.py`
and `AAA/phone-bridge/pickup_proxy.py`.

Verbs:
  GET  /health         → bridge liveness + DB stats
  GET  /verbs          → list of action verbs
  POST /{verb} {params}
    health          → same as GET /health
    blast           → blast_radius(path|symbol)
    dependents      → dependents(symbol_qualified_name)
    symbols         → symbols_in(file_path)
    search          → search(name, kind?, limit?)
    file            → file_summary(file_path)
    impact          → impact(path, depth?)
    cross           → cross_repo_callers(symbol_qualified_name)
    index_status    → per-repo file/symbol counts + last indexed_at

DITEMPA BUKAN DIBERI ⚒️ — graph for I-ARIF and forge blast-radius.
"""
from __future__ import annotations
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Pull in query module from AAA
sys.path.insert(0, "/root/AAA/graph")
import query as codegraph  # noqa: E402

DEFAULT_PORT = 18922
DEFAULT_BIND = "127.0.0.1"
DEFAULT_DB = Path("/root/AAA/graph/codegraph.db")

log = logging.getLogger("graph_bridge")
logging.basicConfig(level=os.environ.get("GRAPH_BRIDGE_LOG", "INFO"),
                    format="[graph_bridge] %(asctime)s %(levelname)s %(message)s")


def _envelope(verb: str, ok: bool, result, *, verdict="PROCEED",
              evidence_tag="OBS", confidence=0.95, error=None):
    return {
        "ok": ok, "connector": "graph_bridge", "verb": verb,
        "verdict": verdict if ok else "HOLD", "evidence_tag": evidence_tag,
        "confidence": confidence, "result": result, "error": error,
        "receipt": {"receipt_id": f"gb-{uuid.uuid4().hex[:12]}",
                    "timestamp": datetime.now(timezone.utc).isoformat()},
    }


# ─── ACTION VERBS ─────────────────────────────────────────────────────


def action_health(params: dict) -> dict:
    db = Path(params.get("db", str(DEFAULT_DB)))
    if not db.exists():
        return {"ok": False, "bridge": "graph_bridge",
                "status": "DB_MISSING", "db": str(db)}
    import sqlite3
    conn = sqlite3.connect(str(db))
    try:
        n_repos = conn.execute("SELECT COUNT(*) FROM repos").fetchone()[0]
        n_files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
        n_symbols = conn.execute("SELECT COUNT(*) FROM symbols").fetchone()[0]
        n_edges = conn.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
        n_imports = conn.execute("SELECT COUNT(*) FROM imports").fetchone()[0]
        last = conn.execute("SELECT MAX(indexed_at) FROM repos").fetchone()[0]
    finally:
        conn.close()
    return {
        "ok": True,
        "bridge": "graph_bridge",
        "protocol": "arifos.codegraph.v1",
        "db": str(db),
        "db_size_mb": round(db.stat().st_size / 1024 / 1024, 1),
        "repos": n_repos,
        "files": n_files,
        "symbols": n_symbols,
        "edges": n_edges,
        "imports": n_imports,
        "last_indexed_at": last,
        "verbs": ["blast", "dependents", "symbols", "search",
                  "file", "impact", "cross", "index_status"],
    }


def action_blast(params: dict) -> dict:
    target = params.get("path") or params.get("symbol") or params.get("target")
    if not target:
        return {"error": "missing_path_or_symbol",
                "hint": "send {'path': 'repo/file.py'} or {'symbol': 'ClassName.method'}"}
    depth = int(params.get("depth", 1))
    return codegraph.blast_radius(target, depth=depth)


def action_dependents(params: dict) -> dict:
    sym = params.get("symbol") or params.get("qualified_name")
    if not sym:
        return {"error": "missing_symbol"}
    return codegraph.dependents(sym)


def action_symbols(params: dict) -> dict:
    p = params.get("path")
    if not p:
        return {"error": "missing_path"}
    return codegraph.symbols_in(p)


def action_search(params: dict) -> dict:
    name = params.get("name")
    if not name:
        return {"error": "missing_name"}
    kind = params.get("kind")
    limit = int(params.get("limit", 50))
    return codegraph.search(name, kind=kind, limit=limit)


def action_file(params: dict) -> dict:
    p = params.get("path")
    if not p:
        return {"error": "missing_path"}
    return codegraph.file_summary(p)


def action_impact(params: dict) -> dict:
    p = params.get("path") or params.get("symbol")
    if not p:
        return {"error": "missing_path_or_symbol"}
    depth = int(params.get("depth", 2))
    return codegraph.impact(p, depth=depth)


def action_cross(params: dict) -> dict:
    sym = params.get("symbol")
    if not sym:
        return {"error": "missing_symbol"}
    return codegraph.cross_repo_callers(sym)


def action_index_status(params: dict) -> dict:
    import sqlite3
    db = Path(params.get("db", str(DEFAULT_DB)))
    conn = sqlite3.connect(str(db))
    try:
        rows = conn.execute(
            "SELECT r.name, r.indexed_at, COUNT(f.id) AS files, "
            "       COALESCE(SUM(f.symbol_count),0) AS symbols"
            " FROM repos r LEFT JOIN files f ON f.repo_id=r.id"
            " GROUP BY r.id ORDER BY r.name"
        ).fetchall()
    finally:
        conn.close()
    return {
        "repos": [
            {"name": r[0], "indexed_at": r[1], "files": r[2], "symbols": r[3]}
            for r in rows
        ]
    }


ACTIONS = {
    "health": action_health,
    "blast": action_blast,
    "dependents": action_dependents,
    "symbols": action_symbols,
    "search": action_search,
    "file": action_file,
    "impact": action_impact,
    "cross": action_cross,
    "index_status": action_index_status,
}


# ─── HTTP ─────────────────────────────────────────────────────────────


class GraphBridgeHandler(BaseHTTPRequestHandler):
    server_version = "GraphBridge/0.1"

    def log_message(self, fmt, *args):
        log.info("%s - %s", self.address_string(), fmt % args)

    def _send(self, payload, status=200):
        body = json.dumps(payload, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self.path.split("?", 1)[0].rstrip("/") or "/"
        if p in ("/health", "/"):
            self._send(_envelope("health", True, action_health({})))
            return
        if p == "/verbs":
            self._send(_envelope("verbs", True,
                                 {"verbs": sorted(ACTIONS.keys())}))
            return
        self._send(_envelope("?", False, None,
                             verdict="HOLD", error=f"unknown_path: {p}"), 404)

    def do_POST(self):
        p = self.path.split("?", 1)[0].rstrip("/") or "/"
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except Exception as e:
            self._send(_envelope(p.lstrip("/"), False, None,
                                 verdict="HOLD", error=f"invalid_json: {e}"), 400)
            return
        verb = body.get("verb") or p.lstrip("/")
        params = body.get("params") or body
        if verb not in ACTIONS:
            self._send(_envelope(str(verb), False, None,
                                 verdict="HOLD", error=f"unknown_verb: {verb}"), 400)
            return
        try:
            result = ACTIONS[verb](params)
            # Verbose-but-bounded: if result is a list with >500 entries,
            # truncate but include a notice.
            if isinstance(result, list) and len(result) > 500:
                truncated = result[:500]
                truncated.append({"_truncated": True, "dropped": len(result) - 500})
                result = truncated
            self._send(_envelope(verb, True, result))
        except Exception as e:
            log.exception("verb=%s failed", verb)
            self._send(_envelope(verb, False, None,
                                 verdict="HOLD", error=str(e)[:400]), 500)


class _ReusableHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(os.environ.get("GRAPH_BRIDGE_PORT", str(DEFAULT_PORT)))
    bind = os.environ.get("GRAPH_BRIDGE_BIND", DEFAULT_BIND)
    log.info("graph_bridge listening on http://%s:%d", bind, port)
    log.info("codegraph db: %s", DEFAULT_DB)
    log.info("verbs: %s", sorted(ACTIONS.keys()))
    _ReusableHTTPServer((bind, port), GraphBridgeHandler).serve_forever()