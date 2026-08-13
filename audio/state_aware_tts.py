#!/usr/bin/env python3
"""
state_aware_tts.py — Layer 4: Diagnostic acknowledgment only.

Reads VoiceState from the sidecar written by forge_audio_ingest.py.
Outputs ONLY acknowledgment facts — NEVER modifies how the agent speaks.

F9 constitutional gate (sealed 2026-08-13):
  "State-aware TTS hanya boleh jadi diagnostic acknowledgment
   ('Kau kelihat penat. Aku akan jawab ringkas.')
   BUKAN ubah cara agent cakap."

Violations that were REMOVED:
  - ❌ Rate/pitch adaptation based on detected fatigue
  - ❌ Voice design instruction ("Speak with gentle, measured warmth")
  - ❌ TTS speed modification
  - ✅ NOW: acknowledgment only — factual statement to human, no TTS mutation

What this script outputs:
  { acknowledge: bool, message: str, response_style: str, factual_metrics: {...} }

The acknowledge flag tells the agent WHETHER to name the state ("abang, kau
kelihat penat") — NOT HOW to say it. The agent uses its own judgment
and voice (SOUL.md) for HOW. This is F6 EMPATHY without F9 violation.

DITEMPA BUKAN DIBERI. F9 anti-hantu — sensor measures, sensor does not
dictate delivery.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

VOICE_STATE_SIDECAR = Path(
    os.environ.get("AFORGE_VOICE_STATE_PATH", "/tmp/aforge_voice_state.json")
)

# Thresholds — when to suggest acknowledgment (only, not enforcement)
FATIGUE_ACK_THRESHOLD = 0.7
AROUSAL_ACK_THRESHOLD = 0.8


def read_well_features(sidecar: Path = VOICE_STATE_SIDECAR) -> Optional[Dict[str, Any]]:
    """Read well_features from sidecar written by forge_audio_ingest.py."""
    if not sidecar.exists():
        return None
    try:
        data = json.loads(sidecar.read_text())
        return data.get("well_features")
    except Exception:
        return None


def assess(well: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Assess voice state and produce acknowledgment guidance.

    F9: Returns FACTUAL metrics only. Never instructs HOW the agent speaks.
    F7: Returns raw values with confidence from source. No interpretation.
    F6: Sets acknowledge=True when human may benefit from being seen.
    """
    if not well:
        return {
            "acknowledge": False,
            "message": None,
            "response_style": "normal",
            "factual_metrics": None,
            "source": "no-voice-state",
        }

    stress = well.get("stress_load", 0.0)
    clarity = well.get("cognitive_clarity", 0.5)
    fatigue = well.get("chronic_fatigue", False)
    confidence = well.get("confidence", 0.70)

    # F9: The decision to acknowledge is based on observed metrics,
    # not on inferred emotional state. The "message" is a factual
    # observation, not a claimed feeling.
    acknowledge = False
    message = None
    response_style = "normal"

    # High stress + low clarity → suggest acknowledgment (F6 EMPATHY)
    if stress >= FATIGUE_ACK_THRESHOLD and clarity < 0.5:
        acknowledge = True
        # F9: factual statement, not claimed empathy
        # "multi-session high-stress detected" (if chronic fatigue true)
        # or "current session elevated stress detected"
        if fatigue:
            message = (
                "Multi-session elevated stress detected. "
                f"Current stress_load={stress:.2f}, cognitive_clarity={clarity:.2f}. "
                "Consider scheduling review or rest."
            )
        else:
            message = (
                f"Current session elevated stress detected. "
                f"stress_load={stress:.2f}, cognitive_clarity={clarity:.2f}."
            )
        response_style = "concise"

    # The agent decides HOW to deliver this acknowledgment.
    # This script does NOT set speed, rate, pitch, or voice instructions.
    # That would be F9 violation — dictating HOW the agent speaks
    # based on detected state.

    return {
        "acknowledge": acknowledge,
        "message": message,
        "response_style": response_style,
        "factual_metrics": {
            "stress_load": stress,
            "cognitive_clarity": clarity,
            "chronic_fatigue": fatigue,
            "confidence": confidence,
            "source": well.get("source", "unknown"),
        },
        "source": "voice-state-diagnostic",
        # F9: these fields exist for backward compatibility but are
        # ALWAYS null — they represent the removed F9-violating behavior
        "speed": None,          # REMOVED: was TTS speed adaptation
        "instructions": None,    # REMOVED: was voice design instruction
        "emotion": "neutral",    # F9: ALWAYS neutral, never inferred
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="State-aware TTS diagnostic acknowledgment (F9-gated)"
    )
    ap.add_argument("--state", default=str(VOICE_STATE_SIDECAR),
                    help="VoiceState sidecar path")
    args = ap.parse_args()
    result = assess(read_well_features(Path(args.state)))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
