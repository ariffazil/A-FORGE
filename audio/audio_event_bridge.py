#!/usr/bin/env python3
"""
audio_event_bridge.py — Hermes ↔ A-FORGE AudioEvent bridge (Layer 3, non-core).

Sits in A-FORGE (NOT hermes-agent core) so it survives upstream sync.
Invoked as a subprocess by Hermes plugins/hooks — never imported into the
agent core. Keeps Qdrant / STT / parselmouth out of the upstream tree
(per Hermes AGENTS.md: "third-party backends do NOT land under plugins/").

What it does:
  1. Receives the cached audio path from the gateway's inbound voice-note flow.
  2. Extracts VoiceState (parselmouth + scipy — no librosa segfaults).
  3. Transcribes via Hermes production STT (whisper-1 / local / Groq).
  4. Persists AudioEvent to Qdrant (voice_state vector + transcript payload).
  5. Writes VoiceState JSON sidecar next to the audio for the TTS router to read.
  6. Returns VoiceState summary for the TTS layer to adapt to (Layer 4).

Wiring (Hermes side, non-core):
  - A plugin under ~/.hermes/plugins/audio_event_bridge/ calls this script
    on inbound voice notes.
  - OR a post-STT hook calls: python3 audio_event_bridge.py <audio_path> --session ...
  - The TTS router reads the latest VoiceState from /tmp/aforge_voice_state.json

Invocation:
  python3 audio_event_bridge.py <audio_path> --session <sid> --platform <p>
  → JSON stdout: {voice_state, audio_hash, point_id, tts_hint}

TTS hint contract (Layer 4 input):
  {
    "fatigue_score": 0.0-1.0,
    "arousal_score": 0.0-1.0,
    "emotion": "low"|"neutral"|"high",
    "rate_adjust": "-10%" | "+5%" | ...,   # suggested edge-tts rate
    "pitch_adjust": "-5Hz" | "+0Hz",       # suggested pitch
    "response_style": "concise"|"normal"|"detailed",
    "acknowledge_state": True|False         # F6 EMPATHY — name the state
  }
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Add A-FORGE tools to path (forge_audio_ingest lives in tools/, not audio/)
_TOOLS = Path(__file__).resolve().parent.parent / "tools"
sys.path.insert(0, str(_TOOLS))
_AUDIO = Path(__file__).resolve().parent
sys.path.insert(0, str(_AUDIO))

# Re-use the ingest pipeline (features + transcribe + qdrant)
from forge_audio_ingest import build_event, upsert, _append_ledger   # noqa: E402
from forge_audio_features import VoiceState                          # noqa: E402

VOICE_STATE_SIDECAR = Path(os.environ.get("AFORGE_VOICE_STATE_PATH", "/tmp/aforge_voice_state.json"))


def _tts_hint(vs: Dict[str, Any]) -> Dict[str, Any]:
    """Map VoiceState → TTS adaptation hint. [DER] — derived, not observed."""
    fatigue = vs.get("fatigue_score", 0.0)
    arousal = vs.get("arousal_score", 0.5)
    emotion = vs.get("emotion", "neutral")

    # Fatigue > 0.7: slower rate, lower pitch, shorter response (Layer 4 spec)
    if fatigue > 0.7:
        rate_adjust = "-15%"
        pitch_adjust = "-5Hz"
        response_style = "concise"
        acknowledge_state = True
    # High arousal > 0.8: match energy, concise
    elif arousal > 0.8:
        rate_adjust = "+10%"
        pitch_adjust = "+0Hz"
        response_style = "concise"
        acknowledge_state = False
    # Frustration heuristic: high arousal + low intensity (tense/flat)
    elif arousal > 0.6 and vs.get("mean_intensity", 50) < 55 and vs.get("f0_std", 20) < 15:
        rate_adjust = "-5%"
        pitch_adjust = "-3Hz"
        response_style = "concise"
        acknowledge_state = True  # F6 EMPATHY — acknowledge frustration
    # Neutral: normal
    else:
        rate_adjust = "+0%"
        pitch_adjust = "+0Hz"
        response_style = "normal"
        acknowledge_state = False

    return {
        "fatigue_score": fatigue,
        "arousal_score": arousal,
        "emotion": emotion,
        "rate_adjust": rate_adjust,
        "pitch_adjust": pitch_adjust,
        "response_style": response_style,
        "acknowledge_state": acknowledge_state,
    }


def bridge(
    audio_path: str,
    session_id: str = "",
    platform: str = "unknown",
    skip_qdrant: bool = False,
) -> Dict[str, Any]:
    """Full bridge: ingest audio → persist → produce TTS hint."""
    event = build_event(audio_path, session_id, platform)

    ingest_result: Optional[Dict[str, Any]] = None
    if not skip_qdrant:
        try:
            ingest_result = upsert(dict(event))
            _append_ledger({"event": event, "ingested": ingest_result})
        except Exception as e:
            ingest_result = {"error": str(e)}

    vs = event["voice_state"]
    hint = _tts_hint(vs)

    # Write sidecar for TTS router to read
    VOICE_STATE_SIDECAR.parent.mkdir(parents=True, exist_ok=True)
    VOICE_STATE_SIDECAR.write_text(json.dumps({"voice_state": vs, "tts_hint": hint}, ensure_ascii=False))

    return {
        "success": True,
        "audio_hash": event["audio_hash"],
        "voice_state": vs,
        "tts_hint": hint,
        "qdrant": ingest_result,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Hermes ↔ A-FORGE AudioEvent bridge")
    ap.add_argument("audio", help="cached audio path from Hermes gateway")
    ap.add_argument("--session", default="")
    ap.add_argument("--platform", default="unknown")
    ap.add_argument("--skip-qdrant", action="store_true", help="extract features only, no persistence")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    result = bridge(args.audio, args.session, args.platform, args.skip_qdrant)
    print(json.dumps(result) if args.json else json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())