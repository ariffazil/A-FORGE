#!/usr/bin/env python3
"""
forge_minimal_receipt.py — P1 of ARIFOS::CLOSURE_RECOVERY::v1

Doctrine (per ARIF F13 SOVEREIGN):
  Better an ugly witness than no witness.

Inversion of the seal-first path:

  OLD: work → verify → probe → seal → fail (no witness)
  NEW: work → EMIT MINIMAL RECEIPT → verify → enrich → seal

A "minimal receipt" is intentionally UGLY:
  - session_id, actor, intent, files_touched, timestamp
  - No floor checks, no W3 witness, no canonicalization
  - Just enough to say: "this work happened at this time"

Then a SEPARATE pass enriches it with full verification.
If the session dies before enrichment, the minimal receipt
remains — recovery cost drops from minutes to seconds.

Usage:
  python3 forge_minimal_receipt.py <session_id> <actor> <intent> <files_touched_csv>

This script REPLACES the seal ceremony's all-or-nothing posture
with a write-first / enrich-later posture. M5 (Agent Retreat)
is broken when agents see witnesses landing on the first touch,
not the 47th.

F1 AMANAH: append-only, reversible by deleting the receipt.
F2 TRUTH: every field is OBSERVABLE (no inference).
F11 AUDIT: payload schema arifos.record.v1.

Lane B autonomous — no F13 required.
"""

import json, os, sys, hashlib
from datetime import datetime, timezone
from pathlib import Path

# Locate paths_resolver relative to this script:
# scripts/recovery/forge_minimal_receipt.py → ../../paradox-engine/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

RECEIPT_BASE = str(org_path("forge_work") / "minimal-receipts")


def emit_minimal_receipt(session_id, actor, intent, files_touched):
    """Emit an ugly witness. The point is it EXISTS."""
    ts = datetime.now(timezone.utc).isoformat()
    payload = {
        "ts_utc": ts,
        "session_id": session_id,
        "actor": actor,
        "intent": intent[:200],
        "files_touched": files_touched[:50]
        if isinstance(files_touched, list)
        else [files_touched],
        "lane": "B",
        "tier": "minimal_receipt",
        "schema": "arifos.record.minimal.v1",
        "doctrine_ref": "ARIFOS::CLOSURE_RECOVERY::v1",
        "principle": "better an ugly witness than no witness",
        "enrichment_status": "pending",
        "verdict": "WORK_DONE_WITNESS_PENDING",
        "reversibility": "REVERSIBLE (delete receipt file to undo)",
    }
    content = json.dumps(payload, indent=2)
    # Hash for chain
    payload_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
    payload["payload_hash"] = payload_hash

    # Write to 3 paths (avoid EROFS pattern)
    Path(RECEIPT_BASE).mkdir(parents=True, exist_ok=True)
    ts_compact = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fname = f"{session_id}-minimal-{ts_compact}.json"
    written = []
    for base in [
        RECEIPT_BASE,
        "/root/.local/share/arifos/recovery",
    ]:
        try:
            Path(base).mkdir(parents=True, exist_ok=True)
            p = Path(base) / fname
            p.write_text(json.dumps(payload, indent=2))
            written.append(str(p))
        except (PermissionError, OSError):
            continue

    return payload, written


def enrich_receipt(session_id, floor_results=None, witness=None, verdict=None):
    """Find the minimal receipt for this session and enrich it.
    Idempotent — can be called multiple times."""
    matches = []
    for base in [RECEIPT_BASE, "/root/.local/share/arifos/recovery"]:
        if not Path(base).exists():
            continue
        for f in Path(base).glob(f"{session_id}-minimal-*.json"):
            matches.append(f)

    if not matches:
        return None, "no minimal receipt found — call emit_minimal_receipt first"

    target = matches[0]  # most recent or first
    try:
        data = json.loads(target.read_text())
    except Exception as e:
        return None, f"corrupt receipt: {e}"

    if floor_results:
        data["enrichment_floor_results"] = floor_results
    if witness:
        data["enrichment_witness"] = witness
    if verdict:
        data["enrichment_verdict"] = verdict
    data["enrichment_status"] = "complete"
    data["enrichment_ts"] = datetime.now(timezone.utc).isoformat()

    target.write_text(json.dumps(data, indent=2))
    return data, str(target)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(
            "Usage: forge_minimal_receipt.py emit <session_id> <actor> <intent> [files_csv]"
        )
        print("   or: forge_minimal_receipt.py enrich <session_id> [verdict]")
        sys.exit(1)

    mode = sys.argv[1]
    if mode == "emit":
        sid = sys.argv[2]
        actor = sys.argv[3]
        intent = sys.argv[4] if len(sys.argv) > 4 else "unspecified"
        files = sys.argv[5].split(",") if len(sys.argv) > 5 and sys.argv[5] else []
        payload, written = emit_minimal_receipt(sid, actor, intent, files)
        print(f"✓ Minimal receipt emitted (ugly witness on disk):")
        for p in written:
            print(f"  {p}")
        print(f"  verdict: {payload['verdict']}")
        print(f"  payload_hash: {payload['payload_hash']}")
    elif mode == "enrich":
        sid = sys.argv[2]
        verdict = sys.argv[3] if len(sys.argv) > 3 else "PARTIAL"
        data, path = enrich_receipt(sid, verdict=verdict)
        if data:
            print(f"✓ Enriched receipt: {path}")
            print(f"  status: {data['enrichment_status']}")
            print(f"  verdict: {verdict}")
        else:
            print(f"✗ {path}")
            sys.exit(1)
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)
