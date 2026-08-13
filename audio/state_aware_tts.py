#!/usr/bin/env python3
"""
state_aware_tts.py — Layer 4: State-Aware TTS voice/rate selection.

Reads VoiceState from the sidecar written by audio_event_bridge.py and
adapts the TTS response. This is a CLI helper called by the agent's voice
note flow BEFORE calling text_to_speech — it outputs the suggested speed
and instructions override.

It does NOT modify Hermes core. The agent (or a plugin) calls this to get
adaptation parameters, then passes them to the standard text_to_speech tool.

DITEMPA BUKAN DIBERI. F6 EMPATHY (acknowledge human state), F7 (confidence),
F9 (machine has no voice — it adapts, doesn't become).

Usage:
  python3 state_aware_tts.py                # reads /tmp/aforge_voice_state.json
  python3 state_aware_tts.py --state /path   # custom sidecar path
  → JSON: {speed, instructions, acknowledge, response_style}
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

VOICE_STATE_SIDECAR = Path(os.environ.get("AFORGE_VOICE_STATE_PATH", "/tmp/aforge_voice_state.json"))


def read_hint(sidecar: Path = VOICE_STATE_SIDECAR) -> Optional[Dict[str, Any]]:
    if not sidecar.exists():
        return None
    try:
        data = json.loads(sidecar.read_text())
        return data.get("tts_hint")
    except Exception:
        return None


def adapt(hint: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert TTS hint → parameters for Hermes text_to_speech tool."""
    if not hint:
        # No voice state available — default OsmanNeural profile
        return {
            "speed": None,
            "instructions": None,
            "acknowledge": False,
            "response_style": "normal",
            "source": "no-voice-state",
        }

    rate = hint.get("rate_adjust", "+0%")
    pitch = hint.get("pitch_adjust", "+0Hz")

    # Convert rate string ("+5%", "-15%") to speed multiplier
    try:
        pct = int(rate.replace("%", "").replace("+", ""))
        speed = round(1.0 + pct / 100.0, 2)
        speed = max(0.5, min(2.0, speed))
    except Exception:
        speed = None

    instructions = None
    if hint.get("acknowledge_state"):
        # Voice design instruction for the TTS provider
        instructions = "Speak with gentle, measured warmth — the listener sounds fatigued or frustrated."
    elif hint.get("emotion") == "high":
        instructions = "Speak with bright, energetic delivery matching the listener's energy."

    return {
        "speed": speed,
        "instructions": instructions,
        "acknowledge": hint.get("acknowledge_state", False),
        "response_style": hint.get("response_style", "normal"),
        "emotion": hint.get("emotion", "neutral"),
        "fatigue_score": hint.get("fatigue_score", 0.0),
        "arousal_score": hint.get("arousal_score", 0.0),
        "source": "voice-state",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="State-aware TTS parameter router")
    ap.add_argument("--state", default=str(VOICE_STATE_SIDECAR), help="VoiceState sidecar path")
    args = ap.parse_args()

    hint = read_hint(Path(args.state))
    params = adapt(hint)
    print(json.dumps(params, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())