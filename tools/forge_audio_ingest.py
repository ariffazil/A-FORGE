#!/usr/bin/env python3
"""
forge_audio_ingest.py — Persist AudioEvent (Layer 3) to Qdrant + ledger.

Consumes the CANONICAL extractor: /usr/local/lib/hermes-agent/tools/voice_state.py
(extract_voice_state + voice_state_to_well_features). This module is the
persistence + retrieval half of Layer 3 — the "nervous system" for audio
memory that Hermes core deliberately does not own (third-party Qdrant backend
does not land upstream).

AudioEvent:
  timestamp       datetime UTC ISO
  transcript      str            (Qdrant payload — filterable/searchable)
  well_features   dict           (stress_load, cognitive_clarity, emotional_state,
                                  hrv_status, chronic_fatigue, confidence) [DER]
  features_raw    dict           (raw prosody measurements) [OBS]
  audio_hash      SHA256         (content-addressable — NOT the audio file, F1)
  session_id      str
  platform        str
  vector 'well'   6-dim          (stress_load, cognitive_clarity, pause_density,
                                  energy_norm, voiced_fraction, pitch_std_norm)
                  — fatigue-sensitive subspace for similarity search

Query ("show me all conversations where Arif sounded fatigued"):
  forge_audio_ingest.py --query-fatigued [--min 0.6] [--limit 20]
  → vector search seeded by fatigued prototype + payload filter stress_load >= min

Constitutional floors:
  F1  — store audio_hash only, never the audio file; no auto-deletion
  F2  — features_raw tagged OBS; well_features tagged DER
  F7  — confidence passed through from canonical extractor (0.70, capped)
  F9  — emotional_state is always "neutral"; sensor measures, never speaks
  F11 — every ingest appended to append-only ledger jsonl
  F13 — voice cloning untouched by this module

Usage:
  python3 forge_audio_ingest.py <audio> [--session S] [--platform P] [--json]
  python3 forge_audio_ingest.py --query-fatigued [--min 0.6] [--limit 20]
  python3 forge_audio_ingest.py --health

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

HERMES_AGENT_ROOT = os.environ.get("HERMES_AGENT_ROOT", "/usr/local/lib/hermes-agent")
sys.path.insert(0, os.path.join(HERMES_AGENT_ROOT, "tools"))

QDRANT = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = os.environ.get("AFORGE_AUDIO_COLLECTION", "arifos_audio_memory")
WELL_VECTOR = "well"          # named vector, 6-dim
WELL_DIM = 6
LEDGER = Path(os.environ.get("AFORGE_AUDIO_LEDGER", "/root/A-FORGE/audio/audio_ledger.jsonl"))
SIDECAR = Path(os.environ.get("AFORGE_VOICE_STATE_PATH", "/tmp/aforge_voice_state.json"))


# ─────────────────────────── F1 provenance ───────────────────────────
def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# ─────────────────────────── canonical extraction ───────────────────────────
def extract_canonical(path: str) -> Dict[str, Any]:
    """Run the Hermes voice_state.py extractor (librosa, production-grade)."""
    from voice_state import extract_voice_state, voice_state_to_well_features
    features = extract_voice_state(path)
    well = voice_state_to_well_features(features)
    return {"features": features, "well": well}


def well_vector(features: Dict[str, Any], well: Dict[str, Any]) -> list:
    """6-dim fatigue-sensitive vector. Normalized to [0,1] where possible."""
    def clamp01(x: float) -> float:
        return max(0.0, min(1.0, float(x)))

    stress = well.get("stress_load", 0.0)
    clarity = well.get("cognitive_clarity", 0.5)
    pause = features.get("pause_density", 0.0)
    energy_db = features.get("energy_rms_mean_db", -60.0)
    voiced = features.get("voiced_fraction", 0.0)
    pitch_std = features.get("pitch_std_hz", 0.0) or 0.0

    return [
        round(clamp01(stress), 4),
        round(clamp01(clarity), 4),
        round(clamp01(pause), 4),
        round(clamp01((-energy_db - 20) / 40.0), 4),   # -60dB→1.0 (weak), -20dB→0
        round(clamp01(voiced), 4),
        round(clamp01(pitch_std / 80.0), 4),
    ]


# ─────────────────────────── Qdrant HTTP (A-FORGE embed_store pattern) ───────────────────────────
def _http(url: str, payload: dict, method: str = "POST") -> Dict[str, Any]:
    req = Request(url, data=json.dumps(payload).encode(),
                  headers={"Content-Type": "application/json"}, method=method)
    with urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def _http_get(url: str) -> Dict[str, Any]:
    with urlopen(Request(url), timeout=30) as r:
        return json.loads(r.read())


def ensure_collection() -> None:
    try:
        _http_get(f"{QDRANT}/collections/{COLLECTION}")
        return
    except URLError:
        pass
    _http(f"{QDRANT}/collections/{COLLECTION}",
          {"vectors": {WELL_VECTOR: {"size": WELL_DIM, "distance": "Cosine"}},
           "on_disk_payload": True}, method="PUT")


def _append_ledger(entry: Dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def build_event(audio_path: str, session_id: str = "", platform: str = "unknown",
                transcript: str = "") -> Dict[str, Any]:
    audio_hash = sha256_file(audio_path)
    ex = extract_canonical(audio_path)
    features, well = ex["features"], ex["well"]
    if features.get("extraction_status") != "ok":
        raise RuntimeError(f"canonical extraction failed: {features}")

    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "well_features": well,
        "features_raw": features,
        "voice_vector": well_vector(features, well),
        "audio_hash": audio_hash,
        "session_id": session_id,
        "platform": platform,
        "speaker_embedding": None,     # reserved: xAI STT diarization (P1)
        "confidence": well.get("confidence", 0.70),   # F7
        "emotional_state": well.get("emotional_state", "neutral"),  # F9
    }
    # sidecar for TTS layer / WELL consumer
    SIDECAR.parent.mkdir(parents=True, exist_ok=True)
    SIDECAR.write_text(json.dumps({"well_features": well, "features_raw": features},
                                  ensure_ascii=False))
    return event


def ingest(audio_path: str, session_id: str = "", platform: str = "unknown",
           transcript: str = "") -> Dict[str, Any]:
    ensure_collection()
    event = build_event(audio_path, session_id, platform, transcript)
    point_id = str(uuid.uuid4())   # Qdrant needs full UUID format with dashes
    payload = {k: v for k, v in event.items() if k != "voice_vector"}
    # Debug: print the payload before sending
    # print(json.dumps(payload, indent=2), file=sys.stderr)

    _http(f"{QDRANT}/collections/{COLLECTION}/points",
          {"points": [{"id": point_id,
                       "vector": {WELL_VECTOR: event["voice_vector"]},
                       "payload": payload}]},
          method="PUT")
    _append_ledger({"point_id": point_id, "audio_hash": event["audio_hash"],
                    "session_id": session_id, "platform": platform,
                    "at": event["timestamp"]})
    return {"point_id": point_id, "event": event}


# ─────────────────────────── retrieval: the Arif query ───────────────────────────
def query_fatigued(min_stress: float = 0.6, limit: int = 20,
                   session_id: Optional[str] = None) -> Dict[str, Any]:
    ensure_collection()
    proto = [1.0, 0.3, 0.8, 1.0, 0.3, 0.9]   # fatigued prototype in well-space
    must = [{"key": "well_features.stress_load", "range": {"gte": min_stress}}]
    if session_id:
        must.append({"key": "session_id", "match": {"value": session_id}})
    body = {"vector": {"name": WELL_VECTOR, "vector": proto}, "limit": limit,
            "with_payload": True, "filter": {"must": must}}
    try:
        res = _http(f"{QDRANT}/collections/{COLLECTION}/points/search", body)
        hits = res.get("result", [])
    except URLError as e:
        return {"success": False, "error": str(e), "hits": []}
    out = []
    for h in hits:
        p = h.get("payload", {})
        out.append({
            "timestamp": p.get("timestamp"),
            "session_id": p.get("session_id"),
            "platform": p.get("platform"),
            "transcript": (p.get("transcript") or "")[:200],
            "stress_load": (p.get("well_features") or {}).get("stress_load"),
            "cognitive_clarity": (p.get("well_features") or {}).get("cognitive_clarity"),
            "audio_hash": p.get("audio_hash"),
            "score": h.get("score"),
        })
    return {"success": True, "count": len(out), "hits": out}


def health() -> Dict[str, Any]:
    try:
        info = _http_get(f"{QDRANT}/collections/{COLLECTION}")
        return {"ok": True, "collection": COLLECTION,
                "points": info.get("result", {}).get("points_count")}
    except Exception as e:
        return {"ok": False, "collection": COLLECTION, "error": str(e)}


def main() -> int:
    ap = argparse.ArgumentParser(description="A-FORGE audio memory ingest (Layer 3)")
    ap.add_argument("audio", nargs="?")
    ap.add_argument("--session", default="")
    ap.add_argument("--platform", default="unknown")
    ap.add_argument("--transcript", default="", help="attach transcript (else empty)")
    ap.add_argument("--query-fatigued", action="store_true")
    ap.add_argument("--min", type=float, default=0.6)
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--health", action="store_true")
    args = ap.parse_args()

    if args.health:
        print(json.dumps(health())); return 0
    if args.query_fatigued:
        print(json.dumps(query_fatigued(args.min, args.limit), ensure_ascii=False)); return 0
    if not args.audio:
        print("usage: forge_audio_ingest.py <audio> | --query-fatigued | --health", file=sys.stderr)
        return 2

    res = ingest(args.audio, args.session, args.platform, args.transcript)
    ev = res["event"]
    print(json.dumps({
        "success": True, "point_id": res["point_id"],
        "audio_hash": ev["audio_hash"],
        "well_features": ev["well_features"],
        "vector": ev["voice_vector"],
        "transcript": ev["transcript"],
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())