#!/usr/bin/env python3
"""
Fail-soft seal fallback — kill the EROFS /opt/arifos/app death pattern.

When `forge_vault(mode="seal")` fails with EROFS, retry to fallback paths
that never go through /opt/arifos/app:

1. /root/forge_work/recovery-ledger/<session_id>.md
2. /root/.local/share/arifos/recovery/<session_id>.json
3. /root/forge_work/<date>/<session_id>-FALLBACK-SEAL.md

This script is idempotent and reversible.
Part of ARIFOS::UNFINISHED_JOB_RECOVERY::v1 fix.
"""
import json, os, sys, hashlib
from datetime import datetime, timezone
from pathlib import Path

RECOVERY_PATHS = [
    "/root/forge_work/recovery-ledger",
    "/root/.local/share/arifos/recovery",
    "/root/forge_work",  # fallback to current forge_work
]

def safe_path(base_dir, session_id, ext="json"):
    """Generate a writable path that avoids /opt/arifos/app EROFS."""
    Path(base_dir).mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Path(base_dir) / f"{session_id}-recovery-{ts}.{ext}"

def write_recovery_seal(session_id, intent, outcome, evidence, delta_s=-1):
    """Write Lane B recovery seal to all writable paths."""
    payload = {
        "ts_utc": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "intent": intent,
        "outcome": outcome,
        "evidence": evidence,
        "delta_s": delta_s,
        "lane": "B",
        "verdict": "SEAL",
        "tier": "session.ledger",
        "schema": "arifos.record.v1",
        "doctrine_ref": "ARIFOS::UNFINISHED_JOB_RECOVERY::v1",
        "fix_ref": "fail_soft_seal.py",
        "reversibility": "REVERSIBLE",
    }
    content = json.dumps(payload, indent=2)
    written = []
    for base in RECOVERY_PATHS:
        try:
            p = safe_path(base, session_id)
            p.write_text(content)
            written.append(str(p))
        except (PermissionError, OSError) as e:
            # try next path
            continue
    if not written:
        # Last resort: stdout
        print(content)
        return ["stdout"]
    return written

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: fail_soft_seal.py <session_id> <intent> <outcome> [evidence] [delta_s]")
        sys.exit(1)
    sid = sys.argv[1]
    intent = sys.argv[2]
    outcome = sys.argv[3]
    evidence = sys.argv[4] if len(sys.argv) > 4 else ""
    delta_s = float(sys.argv[5]) if len(sys.argv) > 5 else -1.0
    written = write_recovery_seal(sid, intent, outcome, evidence, delta_s)
    print(f"Recovery seal written to {len(written)} path(s):")
    for p in written:
        print(f"  ✓ {p}")
