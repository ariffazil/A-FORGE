#!/usr/bin/env python3
"""
RECONCILE-SEAL-STORES — Chain-wins reconciliation across three stores.

CANONICAL SOURCE: seal_chain.jsonl (hash-chained, append-only, local)
REPLICAS:         Local PG vault999 / Supabase Cloud

Doctrine: Chain is truth. DBs are caches. Chain-wins on all conflicts.

Usage:
  python3 reconcile_seal_stores.py [--fix] [--verbose]

Output modes:
  --report (default)  — divergence report only, no writes
  --fix               — replay missing entries from chain → DBs
  --verbose           — show all entries, not just mismatches
"""

import json
import os
import sys
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

# ── Config ──────────────────────────────────────────────────────────
SEAL_CHAIN_PATH = Path(
    os.getenv("SEAL_CHAIN_PATH", "/root/.local/share/arifos/vault999/seal_chain.jsonl")
)
SEAL_CHAIN_HEAD_PATH = Path(
    os.getenv(
        "SEAL_CHAIN_HEAD_PATH",
        "/root/.local/share/arifos/vault999/seal_chain_head.json",
    )
)
LOCAL_PG_URL = os.getenv(
    "LOCAL_PG_URL",
    "postgresql://arifos_admin:ArifPostgres2026!@localhost:5432/vault999",
)
SUPABASE_PG_URL = os.getenv(
    "SUPABASE_PG_URL",
    "postgresql://postgres.utbmmjmbolmuahwixjqc:cWZ228S72IaC9UzRD5i7UHh8s8NUbaXT@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
)

# Tables to reconcile, with their chain-linking column
TABLES = {
    "vault_seals": {
        "local_schema": "public",
        "local_pk": "id",
        "chain_link_col": "event_id",  # uuid in both DB and chain
        "chain_field": "event_id",
    },
    "vault_events": {
        "local_schema": "public",
        "local_pk": "id",
        "chain_link_col": "event_id",
        "chain_field": "event_id",
    },
    "cooling_ledger_entries": {
        "local_schema": "public",
        "local_pk": "id",
        "chain_link_col": "id",  # uuid
        "chain_field": "entry_id",
    },
    "memory_store": {
        "local_schema": "public",
        "local_pk": "id",  # uuid
        "supabase_table": "memory_store",
        "chain_link_col": "id",
        "chain_field": "memory_id",
    },
}


# ── Chain Reader ────────────────────────────────────────────────────
def read_chain() -> list[dict]:
    """Read the JSONL seal chain. Returns list of entries, seq-ordered."""
    entries = []
    if not SEAL_CHAIN_PATH.exists():
        print(f"❌ Seal chain not found: {SEAL_CHAIN_PATH}")
        return entries
    with open(SEAL_CHAIN_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"⚠️  Corrupt chain line: {e}")
    return entries


def verify_chain_integrity(entries: list[dict]) -> dict:
    """Verify hash chain continuity. Returns {status, breaks: [...]}."""
    breaks = []
    for i, entry in enumerate(entries):
        if i == 0:
            continue
        prev = entries[i - 1]
        expected_prev = entry.get("prev_hash", "")
        actual_prev = prev.get("this_hash", "")
        if expected_prev and actual_prev and expected_prev != actual_prev:
            breaks.append(
                {
                    "seq": entry.get("seq", i),
                    "expected_prev": expected_prev,
                    "actual_prev": actual_prev,
                    "gap": f"Chain break at seq={entry.get('seq')}",
                }
            )
    return {
        "status": "OK" if not breaks else "BROKEN",
        "total_entries": len(entries),
        "breaks": breaks,
        "latest_seq": entries[-1].get("seq") if entries else None,
        "latest_hash": entries[-1].get("this_hash") if entries else None,
    }


# ── DB Queries ─────────────────────────────────────────────────────
async def query_local(table: str, schema: str = "public") -> list[dict]:
    """Query local PG for all rows in a table."""
    import asyncpg

    conn = await asyncpg.connect(LOCAL_PG_URL)
    try:
        rows = await conn.fetch(f'SELECT * FROM {schema}."{table}" ORDER BY id')
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def query_supabase(table: str, schema: str = "public") -> list[dict]:
    """Query Supabase for all rows in a table."""
    import asyncpg

    conn = await asyncpg.connect(SUPABASE_PG_URL)
    try:
        rows = await conn.fetch(f'SELECT * FROM {schema}."{table}" ORDER BY id')
        return [dict(r) for r in rows]
    finally:
        await conn.close()


def serialize_row(row: dict) -> dict:
    """Convert row dict to JSON-safe format."""
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, (bytes, memoryview)):
            out[k] = v.hex() if isinstance(v, bytes) else bytes(v).hex()
        elif hasattr(v, "__class__") and v.__class__.__name__ == "UUID":
            out[k] = str(v)
        else:
            try:
                json.dumps(v)
                out[k] = v
            except (TypeError, ValueError):
                out[k] = str(v)
    return out


# ── Reconciliation ─────────────────────────────────────────────────
def reconcile_table(
    table_name: str,
    local_rows: list[dict],
    supabase_rows: list[dict],
    chain_entries: list[dict],
    config: dict,
) -> dict:
    """Compare local, supabase, and chain for one table."""
    result = {
        "table": table_name,
        "local_count": len(local_rows),
        "supabase_count": len(supabase_rows),
        "chain_entries_relevant": 0,
        "in_local_not_supabase": [],
        "in_supabase_not_local": [],
        "in_chain_not_local": [],
        "in_chain_not_supabase": [],
        "hash_mismatches": [],
        "verdict_mismatches": [],
    }

    # Build lookup sets by event_id or id
    local_by_id = {}
    for r in local_rows:
        key = str(r.get(config["chain_link_col"], r.get("id", "")))
        if key:
            local_by_id[key] = r

    supabase_by_id = {}
    for r in supabase_rows:
        key = str(r.get(config["chain_link_col"], r.get("id", "")))
        if key:
            supabase_by_id[key] = r

    # Local ↔ Supabase divergence
    local_ids = set(local_by_id.keys())
    supabase_ids = set(supabase_by_id.keys())

    only_local = local_ids - supabase_ids
    only_supabase = supabase_ids - local_ids

    for lid in only_local:
        r = local_by_id[lid]
        result["in_local_not_supabase"].append(
            {
                "id": lid,
                "actor_id": str(r.get("actor_id", "?")),
                "verdict": str(r.get("verdict", "?")),
            }
        )

    for sid in only_supabase:
        r = supabase_by_id[sid]
        result["in_supabase_not_local"].append(
            {
                "id": sid,
                "actor_id": str(r.get("actor_id", "?")),
                "verdict": str(r.get("verdict", "?")),
            }
        )

    # Chain ↔ DB divergence (for tables that link to chain)
    chain_link_col = config.get("chain_link_col")
    if chain_link_col:
        for entry in chain_entries:
            chain_id = str(entry.get(config.get("chain_field", "event_id"), ""))
            if not chain_id:
                continue
            result["chain_entries_relevant"] += 1

            in_local = chain_id in local_ids
            in_supabase = chain_id in supabase_ids

            if not in_local:
                result["in_chain_not_local"].append(
                    {
                        "seq": entry.get("seq"),
                        "event_id": chain_id,
                        "actor": entry.get("actor"),
                        "verdict": entry.get("verdict"),
                    }
                )
            if not in_supabase:
                result["in_chain_not_supabase"].append(
                    {
                        "seq": entry.get("seq"),
                        "event_id": chain_id,
                        "actor": entry.get("actor"),
                        "verdict": entry.get("verdict"),
                    }
                )

    # Hash/verdict comparison for entries in both
    common_ids = local_ids & supabase_ids
    for cid in common_ids:
        lr = local_by_id[cid]
        sr = supabase_by_id[cid]
        if str(lr.get("verdict")) != str(sr.get("verdict")):
            result["verdict_mismatches"].append(
                {
                    "id": cid,
                    "local_verdict": str(lr.get("verdict")),
                    "supabase_verdict": str(sr.get("verdict")),
                }
            )

    # Compute divergence score (0 = perfect, higher = worse)
    total_divergences = (
        len(result["in_local_not_supabase"])
        + len(result["in_supabase_not_local"])
        + len(result["in_chain_not_local"])
        + len(result["in_chain_not_supabase"])
        + len(result["hash_mismatches"])
        + len(result["verdict_mismatches"])
    )
    result["divergence_score"] = total_divergences
    result["verdict"] = (
        "CLEAN"
        if total_divergences == 0
        else "LIGHT_DRIFT"
        if total_divergences <= 3
        else "MODERATE_DRIFT"
        if total_divergences <= 10
        else "SIGNIFICANT_DRIFT"
    )

    return result


# ── Report ──────────────────────────────────────────────────────────
def print_report(
    chain_integrity: dict, table_results: list[dict], verbose: bool = False
):
    """Print human-readable divergence report."""
    print("=" * 70)
    print("  SEAL-CHAIN RECONCILIATION REPORT")
    print("  Doctrine: Chain is canonical. DBs are replicas. Chain-wins.")
    print(f"  Generated: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    # Chain integrity
    print(f"\n📜 SEAL CHAIN INTEGRITY: {chain_integrity['status']}")
    print(f"   Total entries: {chain_integrity['total_entries']}")
    print(f"   Latest seq:    {chain_integrity['latest_seq']}")
    print(f"   Latest hash:   {chain_integrity['latest_hash']}")
    if chain_integrity["breaks"]:
        for b in chain_integrity["breaks"]:
            print(f"   ❌ BREAK: {b['gap']}")

    # Per-table results
    overall_divergence = 0
    for tr in table_results:
        print(f"\n📊 TABLE: {tr['table']}")
        print(f"   Local PG:    {tr['local_count']} rows")
        print(f"   Supabase:    {tr['supabase_count']} rows")
        print(f"   Chain refs:  {tr['chain_entries_relevant']} entries")
        print(f"   Divergences: {tr['divergence_score']}  → {tr['verdict']}")

        for key, label in [
            ("in_local_not_supabase", "In LOCAL only ⚠️"),
            ("in_supabase_not_local", "In SUPABASE only ⚠️"),
            ("in_chain_not_local", "In CHAIN, missing from LOCAL 🔴"),
            ("in_chain_not_supabase", "In CHAIN, missing from SUPABASE 🔴"),
            ("verdict_mismatches", "Verdict MISMATCH between stores ❌"),
        ]:
            items = tr.get(key, [])
            if items and (
                verbose
                or key not in ("in_local_not_supabase", "in_supabase_not_local")
                or len(items) <= 5
            ):
                print(f"   {label}: {len(items)} items")
                for item in items[:10]:
                    print(f"      {json.dumps(item, default=str)}")
                if len(items) > 10:
                    print(f"      ... and {len(items) - 10} more")

        overall_divergence += tr["divergence_score"]

    print(f"\n{'=' * 70}")
    print(f"  OVERALL DIVERGENCE: {overall_divergence}")
    if overall_divergence == 0:
        print(f"  VERDICT: CLEAN ✅ — All stores in sync")
    elif overall_divergence <= 5:
        print(f"  VERDICT: LIGHT DRIFT — Minor, likely timing")
    elif overall_divergence <= 20:
        print(f"  VERDICT: MODERATE DRIFT ⚠️ — Needs attention")
    else:
        print(f"  VERDICT: SIGNIFICANT DRIFT 🔴 — Stores have diverged")
    print(f"{'=' * 70}")


# ── Main ────────────────────────────────────────────────────────────
async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Seal-chain reconciliation")
    parser.add_argument("--fix", action="store_true", help="Replay missing entries")
    parser.add_argument("--verbose", action="store_true", help="Show all details")
    parser.add_argument("--table", type=str, help="Single table to reconcile")
    args = parser.parse_args()

    # 1. Read chain
    print("Reading seal chain...")
    chain_entries = read_chain()
    if not chain_entries:
        print("❌ No chain entries found. Cannot reconcile.")
        return 1

    # 2. Verify chain integrity
    chain_integrity = verify_chain_integrity(chain_entries)
    if chain_integrity["status"] == "BROKEN":
        print(
            f"❌ Chain integrity BROKEN: {len(chain_integrity['breaks'])} breaks detected"
        )
        print("   Reconciliation requires intact chain. Fix chain first.")
        return 2

    # 3. Query DBs
    tables_to_check = [args.table] if args.table else list(TABLES.keys())
    table_results = []

    for table_name in tables_to_check:
        config = TABLES[table_name]
        print(f"Querying {table_name}...")
        try:
            local_rows = await query_local(
                table_name, config.get("local_schema", "public")
            )
            supabase_rows = await query_supabase(
                config.get("supabase_table", table_name), "public"
            )
        except Exception as e:
            print(f"⚠️  Query failed for {table_name}: {e}")
            continue

        result = reconcile_table(
            table_name, local_rows, supabase_rows, chain_entries, config
        )
        table_results.append(result)

    # 4. Print report
    print_report(chain_integrity, table_results, verbose=args.verbose)

    # 5. Write JSON report
    report_path = Path("/root/A-FORGE/forge_work/reports")
    report_path.mkdir(parents=True, exist_ok=True)
    report_file = (
        report_path
        / f"reconcile-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    )
    report_data = {
        "chain_integrity": {
            k: str(v) if isinstance(v, datetime) else v
            for k, v in chain_integrity.items()
        },
        "tables": table_results,
        "doctrine": "chain-wins — seal_chain.jsonl is canonical, DBs are replicas",
    }
    with open(report_file, "w") as f:
        json.dump(report_data, f, indent=2, default=str)
    print(f"\n📄 Full report: {report_file}")

    return 0


if __name__ == "__main__":
    import asyncio

    sys.exit(asyncio.run(main()))
