#!/usr/bin/env python3
"""scan_seal_queue.py — AED duty: detect unsealed .sealed files and alert.

Reads /root/HERMES/seal-queue/ for *.sealed files older than 24h.
If found, writes alert to journal and returns non-zero for AED monitoring.
Does NOT seal — F13 authority required. Read-only.

Invoked by: aed.timer → aed.service
DITEMPA BUKAN DIBERI — 2026-07-31
"""
import os, json, time, sys
from datetime import datetime, timezone, timedelta

QUEUE_DIR = "/root/HERMES/seal-queue"
ALERT_AGE_HOURS = 24

def scan() -> dict:
    if not os.path.isdir(QUEUE_DIR):
        return {"status": "MISSING_DIR", "queue_dir": QUEUE_DIR, "files": []}

    now = datetime.now(timezone.utc)
    files = []
    stale = []

    for fname in sorted(os.listdir(QUEUE_DIR)):
        if not fname.endswith(".sealed"):
            continue
        fpath = os.path.join(QUEUE_DIR, fname)
        try:
            stat = os.stat(fpath)
            age_hours = (now.timestamp() - stat.st_mtime) / 3600
            with open(fpath) as fh:
                payload = json.load(fh)
            info = {
                "file": fname,
                "path": fpath,
                "age_hours": round(age_hours, 1),
                "size_bytes": stat.st_size,
                "summary": payload.get("session_summary") or payload.get("summary", "?"),
                "authority": payload.get("authority", "?"),
                "timestamp": payload.get("timestamp", "?"),
            }
            files.append(info)
            if age_hours > ALERT_AGE_HOURS:
                stale.append(info)
        except Exception as exc:
            files.append({"file": fname, "error": str(exc)})

    status = "STALE" if stale else ("PENDING" if files else "CLEAR")
    return {
        "status": status,
        "queue_dir": QUEUE_DIR,
        "total": len(files),
        "stale_count": len(stale),
        "alert_age_hours": ALERT_AGE_HOURS,
        "files": files,
        "stale": stale,
    }

if __name__ == "__main__":
    result = scan()
    status = result["status"]

    if status == "STALE":
        for s in result["stale"]:
            print(f"SEAL-QUEUE-ALERT: {s['file']} is {s['age_hours']}h old — {s['summary'][:80]}")
        sys.exit(1)
    elif status == "PENDING":
        print(f"SEAL-QUEUE: {result['total']} pending (all < {ALERT_AGE_HOURS}h)")
        sys.exit(0)
    else:
        print("SEAL-QUEUE: clear")
        sys.exit(0)
