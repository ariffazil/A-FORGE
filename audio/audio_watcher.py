#!/usr/bin/env python3
"""
audio_watcher.py — Poll Hermes audio cache → A-FORGE ingest (Layer 3 memory).

Non-core wiring: watches /root/.hermes/cache/audio/ for new files,
runs canonical voice_state extraction + Qdrant persistence + WELL homeostasis.
Survives upstream sync. Zero modifications to /usr/local/lib/hermes-agent.

Layer 5: After successful ingestion, calls WELL assess_homeostasis with
the well_features. W0: WELL reflects, never gates — assessment is advisory.

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
WELL_SIDECAR = Path(os.environ.get("AFORGE_VOICE_STATE_PATH", "/tmp/aforge_voice_state.json"))


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


def _call_well_homeostasis(well_features: dict) -> dict | None:
    """Call WELL assess_homeostasis with voice-derived features.

    W0: WELL reflects, never gates. This is advisory only.
    Uses mcporter CLI → WELL stdio MCP. Falls back silently.
    """
    if not well_features:
        return None
    try:
        args = [
            "mcporter", "call", "well.well_assess_homeostasis",
            "mode=fatigue",
            f"stress_load={well_features.get('stress_load', 0.0)}",
            f"cognitive_clarity={well_features.get('cognitive_clarity', 0.5)}",
            f"emotional_state={well_features.get('emotional_state', 'neutral')}",
            f"chronic_fatigue={str(well_features.get('chronic_fatigue', False)).lower()}",
            f"hrv_status={well_features.get('hrv_status', 'unknown')}",
            "decision_class=C3",
        ]
        res = subprocess.run(args, capture_output=True, text=True, timeout=15)
        if res.returncode == 0:
            out = res.stdout.strip()
            try:
                d = json.loads(out)
                return d.get("result", d)
            except Exception:
                return {"raw": out}
    except Exception as e:
        print(f"[WELL] homeostasis call skipped: {e}", file=sys.stderr)
    return None


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
                wf = d.get("well_features", {})
                if verbose:
                    print(f"[OK] {f.name} stress={wf.get('stress_load', '?')} "
                          f"clarity={wf.get('cognitive_clarity', '?')} "
                          f"session={d.get('session_id', '')}")
                # Layer 5: route well_features to WELL homeostasis
                if wf:
                    well_result = _call_well_homeostasis(wf)
                    if well_result and verbose:
                        print(f"[WELL] homeostasis: {json.dumps(well_result, ensure_ascii=False)[:200]}")
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