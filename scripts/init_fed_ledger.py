#!/usr/bin/env python3
"""Initialize the FED spend ledger schema on any node.

KVM4 defect (observed 2026-11-22): /root/A-FORGE/scripts/data/token_bank.db was
0 bytes with no token_bank_spend table. The spend callback then has nowhere to
INSERT, so rows are lost while the request still returns 200.

This script is additive and idempotent: CREATE TABLE IF NOT EXISTS + the
columns the attribution callback expects. It never drops or rewrites rows.

Usage:
  python3 scripts/init_fed_ledger.py --db /root/A-FORGE/scripts/data/token_bank.db
  python3 scripts/init_fed_ledger.py --db ... --check
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

BASE_COLUMNS = {
    "provider_name": "TEXT NOT NULL DEFAULT 'UNKNOWN'",
    "model_id": "TEXT NOT NULL DEFAULT 'UNKNOWN'",
    "agent_id": "TEXT DEFAULT 'unknown'",
    "tokens_in": "INTEGER DEFAULT 0",
    "tokens_out": "INTEGER DEFAULT 0",
    "estimated_cost_usd": "REAL DEFAULT 0.0",
    "called_at": "TEXT NOT NULL DEFAULT ''",
    "protocol": "TEXT",
    "api_base": "TEXT",
    "attribution_confidence": "TEXT",
    "call_id": "TEXT",
    "serving_provider": "TEXT",
    "serving_provider_source": "TEXT",
    "attempted_fallbacks": "INTEGER",
}

# PR-FED-1 lineage columns (additive).
ATTRIBUTION_COLUMNS = {
    "actor_id": "TEXT",
    "actor_source": "TEXT",
    "session_id": "TEXT",
    "task_id": "TEXT",
    "turn_id": "TEXT",
    "purpose": "TEXT",
    "trace_id": "TEXT",
    "logical_request_id": "TEXT",
    "requested_model_group": "TEXT",
    "deployment_id": "TEXT",
    "transport_protocol": "TEXT",
    "entry_gateway": "TEXT",
    "routing_intermediary": "TEXT",
    "upstream_model_id": "TEXT",
    "serving_provider_confidence": "REAL",
    "cache_state": "TEXT",
    "cost_evidence_class": "TEXT",
}


def _columns(con: sqlite3.Connection) -> set[str]:
    return {r[1] for r in con.execute("PRAGMA table_info(token_bank_spend)").fetchall()}


def check(db: str) -> dict:
    path = Path(db)
    if not path.exists():
        return {"db": db, "exists": False, "ok": False, "missing": ["<file>"]}
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        cols = _columns(con)
        if not cols:
            return {
                "db": db,
                "exists": True,
                "ok": False,
                "missing": ["token_bank_spend"],
            }
        needed = set(BASE_COLUMNS) | set(ATTRIBUTION_COLUMNS)
        missing = sorted(needed - cols)
        rows = con.execute("SELECT COUNT(*) FROM token_bank_spend").fetchone()[0]
        return {
            "db": db,
            "exists": True,
            "ok": not missing,
            "missing": missing,
            "rows": rows,
        }
    finally:
        con.close()


def init(db: str) -> dict:
    con = sqlite3.connect(db)
    try:
        con.execute(
            "CREATE TABLE IF NOT EXISTS token_bank_spend (id INTEGER PRIMARY KEY AUTOINCREMENT)"
        )
        existing = _columns(con)
        for name, ddl in {**BASE_COLUMNS, **ATTRIBUTION_COLUMNS}.items():
            if name not in existing:
                con.execute(f"ALTER TABLE token_bank_spend ADD COLUMN {name} {ddl}")
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_spend_called_at ON token_bank_spend(called_at)"
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_spend_trace ON token_bank_spend(trace_id)"
        )
        con.commit()
    finally:
        con.close()
    return check(db)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Idempotent FED ledger schema init/check")
    ap.add_argument("--db", required=True)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    result = check(args.db) if args.check else init(args.db)
    import json

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
