#!/usr/bin/env python3
"""
audio_watcher.py — Watch Hermes inbound audio cache → run A-FORGE bridge.

Non-core wiring: a background daemon that polls /root/.hermes/cache/audio/
for new files, extracts VoiceState + transcript, persists to Qdrant, and
writes the VoiceState sidecar that state_aware_tts.py reads.

Zero modifications to hermes-agent-dev. Zero upstream-sync risk.

Run:
  python3 audio_watcher.py                    # foreground, poll every 2s
  python3 audio_watcher.py --once             # process new files once, exit
  (as daemon: register in cron or hermes background process)

State file tracks processed hashes in /root/A-FORGE/audio/.processed.json
so restarts don't re-ingest.
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
BRIDGE = Path(__file__).resolve().parent / "audio_event_bridge.py"
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
    files = []
    for f in AUDIO_CACHE.iterdir():
        if f.suffix.lower() in AUDIO_EXTS and f.is_file():
            files.append(f)
    return sorted(files, key=lambda p: p.stat().st_mtime)


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
                [sys.executable, str(BRIDGE), str(f),
                 "--platform", "telegram", "--json"],
                capture_output=True, text=True, timeout=180,
            )
            out = res.stdout.strip()
            data: object
            try:
                data = json.loads(out)
            except Exception:
                data = {"raw": out}
            d = data if isinstance(data, dict) else {"raw": str(data)}
            if res.returncode == 0 and d.get("success"):
                if verbose:
                    print(f"[OK] {f.name} fatigue={vs.get('fatigue_score')} "
                          f"arousal={vs.get('arousal_score')} emotion={hint.get('emotion')}")
            else:
                print(f"[FAIL] {f.name}: {res.stderr[-200:] or out[:200]}", file=sys.stderr)
                done.add(f.name)  # don't retry broken files forever
        except Exception as e:
            print(f"[ERROR] {f.name}: {e}", file=sys.stderr)
    _save_processed(done)
    if verbose:
        print(f"processed {count} new audio files")
    return count


def main() -> int:
    once = "--once" in sys.argv
    if once:
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