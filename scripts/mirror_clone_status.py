#!/usr/bin/env python3
"""
C-007 — Mirror-clone status (Batch B).

Does NOT force-sync by default. Reports HEAD/branch divergence for known
mirror pairs. Optional --apply only copies documented direction after dry-run.

Doctrine: AGENTS.md Known Anomaly — dual clones kept; truth is report, not silence.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# (label, path_a, path_b, notes)
PAIRS = [
    (
        "WEALTH",
        "/root/wealth",
        "/root/WEALTH",
        "GitHub case-insensitive same remote; runtime systemd uses /root/WEALTH",
    ),
    (
        "GEOX",
        "/root/geox",
        "/root/GEOX",
        "Both may exist; prefer path with systemd WorkingDirectory if set",
    ),
    (
        "WELL",
        "/root/well",
        "/root/WELL",
        "systemd well.service uses /root/WELL",
    ),
]


def git(path: str, *args: str) -> str:
    r = subprocess.run(
        ["git", "-C", path, *args],
        capture_output=True,
        text=True,
    )
    return r.stdout.strip() if r.returncode == 0 else f"ERR:{r.stderr.strip()[:120]}"


def probe(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {"path": path, "exists": False}
    if not (p / ".git").exists():
        return {"path": path, "exists": True, "git": False}
    return {
        "path": path,
        "exists": True,
        "git": True,
        "head": git(path, "rev-parse", "HEAD"),
        "short": git(path, "rev-parse", "--short=12", "HEAD"),
        "branch": git(path, "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": len(git(path, "status", "--porcelain").splitlines())
        if not git(path, "status", "--porcelain").startswith("ERR:")
        else None,
        "remote": git(path, "remote", "get-url", "origin"),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Report mirror-clone divergence (C-007)")
    ap.add_argument(
        "--json",
        action="store_true",
        help="machine-readable output",
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="RESERVED: refuse auto-sync without explicit pair+direction (safety)",
    )
    args = ap.parse_args()

    report = {
        "schema": "mirror_clone_status.v1",
        "epoch": datetime.now(timezone.utc).isoformat(),
        "pairs": [],
        "diverged": 0,
        "note": "Not auto-synced. Use report for F13/Batch decisions. --apply refuses by design.",
    }

    for label, a, b, notes in PAIRS:
        pa, pb = probe(a), probe(b)
        same = (
            pa.get("git")
            and pb.get("git")
            and pa.get("head")
            and pa.get("head") == pb.get("head")
        )
        entry = {
            "label": label,
            "a": pa,
            "b": pb,
            "same_commit": bool(same),
            "notes": notes,
        }
        report["pairs"].append(entry)
        if pa.get("exists") and pb.get("exists") and not same:
            report["diverged"] += 1

    if args.apply:
        print(
            "REFUSED: --apply is a no-op safety latch. "
            "Mirror sync is intentional only after F13 names direction.",
            file=sys.stderr,
        )
        report["apply"] = "REFUSED"
        if args.json:
            print(json.dumps(report, indent=2))
        return 2

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Mirror-clone status @ {report['epoch']}")
        print(f"Diverged pairs: {report['diverged']}\n")
        for e in report["pairs"]:
            a, b = e["a"], e["b"]
            mark = "SAME" if e["same_commit"] else "DIVERGED"
            print(f"[{e['label']}] {mark}")
            print(
                f"  A {a.get('path')}: "
                f"branch={a.get('branch')} head={a.get('short')} dirty={a.get('dirty')}"
            )
            print(
                f"  B {b.get('path')}: "
                f"branch={b.get('branch')} head={b.get('short')} dirty={b.get('dirty')}"
            )
            print(f"  note: {e['notes']}\n")
        print("No auto-sync performed (C-007 truth report only).")

    return 0 if report["diverged"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
