#!/usr/bin/env python3
"""
audio_watcher.py — Poll Hermes audio cache → A-FORGE ingest (Layer 3 memory).

Non-core wiring: watches /root/.hermes/cache/audio/ for new files,
runs canonical voice_state extraction + Qdrant persistence. Survives
upstream sync. Zero modifications to hermes-agent-dev.

Run:
  python3 audio_watcher.py                    # foreground, poll every 2s
  python3 audio_watcher.py --once             # process new files once, exit

Processed filenames tracked in .processed.json to avoid re-ingestion on restart.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

AUDIO_CACHE = Path(os.environ.get("HERMES_AUDIO_CACHE", "/root/.hermes/cache/audio"))
PROCESSED_FILE = Path(__file__).resolve().parent / ".processed.json"
INGEST = Path(__file__).resolve().parent.parent / "tools" / "forge_audio_ingest.py"
POLL_INTERVAL = float(os.environ.get("AUDIO_WATCH_POLL", "2.0"))
AUDIO_EXTS = {".ogg", ".oga", ".opus", ".mp3", ".wav", ".m4a", ".aac", ".flac", ".webm"}


def _load_processed() -> set:
    try:
        return set(json.loads(PROCESSED_FILE.read_text()))
    except Exception:
        return set()


def _save_processed(done: set) -> None:
    PROCESSED_FILE.write_text(json.dumps(sorted(done)))


def _scan() -> list:
    if not AUDIO_CACHE.is_dir():
        return []
    return sorted(
        [f for f in AUDIO_CACHE.iterdir()
         if f.suffix.lower() in AUDIO_EXTS and f.is_file()],
        key=lambda p: p.stat().st_mtime,
    )


def run_once(verbose: bool = True) -> int:
    done = _load_processed()
    candidates = [f for f in _scan() if f.name not in done]
    if not candidates:
        if verbose:
            print("no new audio")
        return 0

    count = 0
    for f in candidates:
        try:
            res = subprocess.run(
                [sys.executable, str(INGEST), str(f),
                 "--platform", "telegram", "--json"],
                capture_output=True, text=True, timeout=300,
            )
            out = res.stdout.strip()
            d: dict = {}
            try:
                d = json.loads(out)
            except Exception:
                d = {"raw": out}
            if res.returncode == 0 and d.get("success"):
                count += 1
                done.add(f.name)
                if verbose:
                    wf = d.get("well_features", {})
                    print(f"[OK] {f.name} stress={wf.get('stress_load', '?')} "
                          f"clarity={wf.get('cognitive_clarity', '?')} "
                          f"session={d.get('session_id', '')}")
            else:
                print(f"[FAIL] {f.name}: {(res.stderr or out)[:200]}", file=sys.stderr)
                done.add(f.name)
        except Exception as e:
            print(f"[ERROR] {f.name}: {e}", file=sys.stderr)
    _save_processed(done)
    if verbose:
        print(f"processed {count} new audio files")
    return count


def main() -> int:
    if "--once" in sys.argv:
        run_once()
        return 0
    print(f"watching {AUDIO_CACHE} every {POLL_INTERVAL}s (Ctrl-C to stop)")
    try:
        while True:
            run_once(verbose=False)
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())