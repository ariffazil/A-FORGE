#!/usr/bin/env python3
"""
forge_audio_transcribe.py — Transcript extraction bridge (Layer 3 input).

Transcribes an audio file to text via Hermes' production STT pipeline
(whisper-1 / faster-whisper local / Groq / xAI per config), OR falls back
to a direct OpenAI-compatible STT call. Returns transcript + metadata.

This reuses the production-grade "ears" (40+ STT tests upstream) rather than
reimplementing ASR. Emits transcript tagged [OBS] — measurement, not inference.

Hermes route (preferred):
  /usr/local/lib/hermes-agent/tools/transcription_tools.py :: transcribe_audio()

Fallback (no agent-dev import / not on HERMES_HOME):
  POST {stt_openai_base}/audio/transcriptions with whisper-1

DITEMPA BUKAN DIBERI. F2 (OBS), F7 (confidence), F11 (provider logged).

Usage:
  python3 forge_audio_transcribe.py <audio> [--json]
  python3 forge_audio_transcribe.py <audio> --provider openai|local|groq|xai
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional


def _try_hermes_transcribe(path: str) -> Optional[Dict[str, Any]]:
    """Use Hermes' own STT pipeline if importable — preserves provider config."""
    try:
        sys.path.insert(0, os.environ.get("HERMES_AGENT_ROOT", "/usr/local/lib/hermes-agent"))
        from tools import transcription_tools as tt
        if not hasattr(tt, "transcribe_audio"):
            return None
        res = tt.transcribe_audio(path)
        if res and res.get("success"):
            return {
                "transcript": res.get("transcript", "").strip(),
                "provider": res.get("provider") or res.get("engine") or "hermes",
                "confidence": res.get("confidence"),
                "language": res.get("language"),
                "duration": res.get("duration"),
            }
        # fall back to raw result shape
        if res and res.get("transcript"):
            return {"transcript": res.get("transcript").strip(), "provider": "hermes", "confidence": None}
        return None
    except Exception:
        return None


def _try_openai_compat(path: str) -> Optional[Dict[str, Any]]:
    """Direct OpenAI-compatible transcription (whisper-1) using configured key."""
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("HERMES_OPENAI_API_KEY")
    if not key:
        return None
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    import requests
    with open(path, "rb") as f:
        r = requests.post(
            f"{base}/audio/transcriptions",
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (Path(path).name, f, "application/octet-stream")},
            data={"model": "whisper-1"},
            timeout=120,
        )
    if r.status_code != 200:
        return None
    data = r.json()
    return {
        "transcript": data.get("text", "").strip(),
        "provider": "openai-whisper-1",
        "confidence": None,
        "language": data.get("language"),
        "duration": None,
    }


def transcribe(path: str, provider_hint: Optional[str] = None) -> Dict[str, Any]:
    res = None
    if provider_hint in (None, "hermes", "auto"):
        res = _try_hermes_transcribe(path)
        if res:
            res["route"] = "hermes-production-stt"
            return {"success": True, **res}
    if provider_hint in ("auto", "openai") and res is None:
        res = _try_openai_compat(path)
        if res:
            res["route"] = "openai-compat"
            return {"success": True, **res}
    return {"success": False, "transcript": "", "error": "No STT route available (check API keys / Hermes STT config)"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Transcribe audio via Hermes STT pipeline")
    ap.add_argument("audio")
    ap.add_argument("--provider", choices=["auto", "hermes", "openai"], default="auto")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    res = transcribe(args.audio, args.provider)
    print(json.dumps(res) if args.json else json.dumps(res, indent=2, ensure_ascii=False))
    return 0 if res.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())