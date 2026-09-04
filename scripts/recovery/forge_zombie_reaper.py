#!/usr/bin/env python3
"""
forge_zombie_reaper.py — P3 of ARIFOS::CLOSURE_RECOVERY::v1

The Zombie Reaper Agent.

Purpose: RECOVER unfinished work, NOT build new work.
Inverse of forge_skill / forge_register.

Scans surfaces for unfinished artifacts and classifies each as:
  SEAL        — emit closure now (minimal-receipt or fail-soft)
  HOLD        — needs more evidence before sealing
  ARCHIVE     — too old for auto-decision, file for F13 review
  RECOVER     — work is recoverable, attempt closure
  UNKNOWN     — cannot classify

Cron-friendly: exit 0 if clean, exit 1 if zombies found.

Doctrine ref: ARIFOS::CLOSURE_RECOVERY::v1 — LEVERAGE POINT #4
"""

import json, os, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Locate paths_resolver relative to this script:
# scripts/recovery/forge_zombie_reaper.py → ../../paradox-engine/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

OUTPUT_BASE = str(org_path("forge_work") / "recovery-scans")
SURFACES = {
    "pending_receipts": "/root/.local/share/arifos/pending_receipts.jsonl",
    "seal_pending": "/root/.local/share/arifos/seal-pending",
    "handoff": "/root/.local/share/arifos/handoff",
    "recovery": "/root/.local/share/arifos/recovery",
    "minimal_receipts": str(org_path("forge_work") / "minimal-receipts"),
    "forge_work": str(org_path("forge_work")),
}

STALE_DAYS = 7  # beyond this → ARCHIVE


def classify_item(path, mtime, intent_hint=""):
    """Single-item classifier. Returns (verdict, reason, action)."""
    age_days = (datetime.now().timestamp() - mtime) / 86400
    if age_days > STALE_DAYS:
        return (
            "ARCHIVE",
            f"{age_days:.1f}d old — auto-decision unsafe",
            "file for F13 review",
        )
    if intent_hint and any(
        k in intent_hint.lower() for k in ["seal", "witness", "done", "complete"]
    ):
        return "SEAL", "intent indicates closure", "emit fail-soft or minimal receipt"
    if age_days < 1 and intent_hint:
        return (
            "RECOVER",
            "fresh + has intent — recoverable",
            "attempt closure with fail-soft",
        )
    if age_days < 1:
        return "HOLD", "fresh but no intent hint", "tag with intent"
    return "RECOVER", f"{age_days:.1f}d old, within window", "attempt closure"


def scan_surface(name, path):
    """Scan one surface. Returns list of items."""
    items = []
    if not Path(path).exists():
        return items
    p = Path(path)
    if p.is_file():
        # JSONL
        try:
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        d = json.loads(line)
                        sid = d.get("session_id") or d.get("session", "unknown")
                        intent = (
                            d.get("content", {}).get("intent", "")
                            or d.get("reason", "")
                            or d.get("intent", "")
                        )
                        ts = d.get("timestamp") or d.get("ts")
                        if ts:
                            try:
                                mtime = datetime.fromisoformat(
                                    ts.replace("Z", "+00:00")
                                ).timestamp()
                            except Exception:
                                mtime = p.stat().st_mtime
                        else:
                            mtime = p.stat().st_mtime
                        items.append(
                            {
                                "surface": name,
                                "subject": sid,
                                "intent": intent[:80],
                                "mtime": mtime,
                                "source_file": str(p),
                            }
                        )
                    except Exception:
                        continue
        except Exception:
            pass
    elif p.is_dir():
        for f in p.iterdir():
            if not f.is_file():
                continue
            try:
                mtime = f.stat().st_mtime
                # Try to read intent from JSON files
                intent = ""
                if f.suffix == ".json":
                    try:
                        with open(f) as fh:
                            d = json.loads(fh.read())
                            intent = d.get("intent", "") or d.get("outcome", "")
                    except Exception:
                        pass
                items.append(
                    {
                        "surface": name,
                        "subject": f.name,
                        "intent": intent[:80],
                        "mtime": mtime,
                        "source_file": str(f),
                    }
                )
            except Exception:
                continue
    return items


def reap_once():
    """Run one reaping pass. Return aggregate report."""
    scan_ts = datetime.now(timezone.utc).isoformat()
    scan_id = f"reap-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    all_items = []
    for name, path in SURFACES.items():
        items = scan_surface(name, path)
        for it in items:
            verdict, reason, action = classify_item(
                it["source_file"], it["mtime"], it["intent"]
            )
            it["verdict"] = verdict
            it["reason"] = reason
            it["action"] = action
            all_items.append(it)

    # Aggregate by verdict
    by_verdict = defaultdict(int)
    by_surface = defaultdict(int)
    for it in all_items:
        by_verdict[it["verdict"]] += 1
        by_surface[it["surface"]] += 1

    # Write scan output
    Path(OUTPUT_BASE).mkdir(parents=True, exist_ok=True)
    out_path = Path(OUTPUT_BASE) / f"{scan_id}.json"
    out_path.write_text(
        json.dumps(
            {
                "scan_id": scan_id,
                "scan_ts_utc": scan_ts,
                "doctrine_ref": "ARIFOS::CLOSURE_RECOVERY::v1",
                "agent": "forge_zombie_reaper",
                "stale_threshold_days": STALE_DAYS,
                "surfaces_scanned": list(SURFACES.keys()),
                "items": all_items,
                "summary": {
                    "total": len(all_items),
                    "by_verdict": dict(by_verdict),
                    "by_surface": dict(by_surface),
                },
            },
            indent=2,
            default=str,
        )
    )

    return {
        "scan_id": scan_id,
        "scan_path": str(out_path),
        "total_items": len(all_items),
        "by_verdict": dict(by_verdict),
        "by_surface": dict(by_surface),
    }


if __name__ == "__main__":
    result = reap_once()
    print(f"Reaper scan complete: {result['scan_id']}")
    print(f"Output: {result['scan_path']}")
    print(f"Total items: {result['total_items']}")
    print(f"By verdict: {result['by_verdict']}")
    print(f"By surface: {result['by_surface']}")
    # Exit 1 if zombies found (for cron alerting)
    zombies = result["by_verdict"].get("HOLD", 0) + result["by_verdict"].get(
        "UNKNOWN", 0
    )
    if zombies > 0:
        print(f"⚠ {zombies} zombies detected — reaper needs follow-up")
        sys.exit(1)
    sys.exit(0)
