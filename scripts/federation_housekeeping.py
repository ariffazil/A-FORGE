#!/usr/bin/env python3
"""Governed housekeeping executor for federation sweep manifests.

Default mode is dry-run. Real mutation requires --execute.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ALLOWED_PREFIXES = (
    Path("/root/A-FORGE"),
    Path("/root/arifOS"),
    Path("/root/AAA"),
    Path("/root/GEOX"),
    Path("/root/WEALTH"),
    Path("/root/WELL"),
    Path("/root"),
)


@dataclass(frozen=True)
class Entry:
    action: str
    path: Path
    reason: str
    tier: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to housekeeping manifest JSON")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply the manifest. Default is dry-run.",
    )
    parser.add_argument(
        "--archive-root",
        type=Path,
        default=Path("/root/archive/federation-sweep-2026-07-09"),
        help="Destination root for archive actions.",
    )
    return parser.parse_args()


def load_entries(manifest_path: Path) -> tuple[list[Entry], dict]:
    data = json.loads(manifest_path.read_text())
    entries = [
        Entry(
            action=item["action"],
            path=Path(item["path"]),
            reason=item["reason"],
            tier=item.get("tier", "T1_AUTO_DO"),
        )
        for item in data.get("entries", [])
    ]
    return entries, data.get("metadata", {})


def is_allowed(path: Path) -> bool:
    try:
        resolved = path.resolve(strict=False)
    except OSError:
        return False
    return any(resolved == prefix or prefix in resolved.parents for prefix in ALLOWED_PREFIXES)


def archive_destination(archive_root: Path, source: Path) -> Path:
    relative = source.relative_to(Path("/root"))
    return archive_root / relative


def ensure_safe(entry: Entry) -> None:
    if not is_allowed(entry.path):
        raise ValueError(f"disallowed path: {entry.path}")
    if entry.path == Path("/root"):
        raise ValueError("refusing to mutate /root directly")
    if entry.tier != "T1_AUTO_DO":
        raise ValueError(f"entry requires higher gate: {entry.path} ({entry.tier})")


def iter_preview(entries: Iterable[Entry], archive_root: Path) -> list[dict]:
    preview = []
    for entry in entries:
        target = None
        if entry.action == "archive":
            target = str(archive_destination(archive_root, entry.path))
        preview.append(
            {
                "action": entry.action,
                "path": str(entry.path),
                "reason": entry.reason,
                "tier": entry.tier,
                "exists": entry.path.exists(),
                "target": target,
            }
        )
    return preview


def apply_entry(entry: Entry, archive_root: Path) -> str:
    if not entry.path.exists():
        return "missing"

    if entry.action == "delete":
        if entry.path.is_dir():
            shutil.rmtree(entry.path)
        else:
            entry.path.unlink()
        return "deleted"

    if entry.action == "archive":
        destination = archive_destination(archive_root, entry.path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(entry.path), str(destination))
        return f"archived:{destination}"

    raise ValueError(f"unsupported action: {entry.action}")


def main() -> int:
    args = parse_args()
    entries, metadata = load_entries(args.manifest)

    try:
        for entry in entries:
            ensure_safe(entry)
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2

    preview = iter_preview(entries, args.archive_root)
    if not args.execute:
        print(
            json.dumps(
                {
                    "ok": True,
                    "mode": "dry-run",
                    "manifest": str(args.manifest),
                    "metadata": metadata,
                    "entries": preview,
                },
                indent=2,
            )
        )
        return 0

    results = []
    args.archive_root.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        status = apply_entry(entry, args.archive_root)
        results.append({"path": str(entry.path), "action": entry.action, "status": status})

    print(
        json.dumps(
            {
                "ok": True,
                "mode": "execute",
                "manifest": str(args.manifest),
                "metadata": metadata,
                "results": results,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
