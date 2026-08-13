#!/usr/bin/env python3
"""
forge_audio_features.py — Prosody / VoiceState extraction (Layer 1).

Extracts a fixed-dimensional VoiceState vector + scalar prosody features
from raw audio using parselmouth (Praat) + scipy. This transforms audio from
a "file format" into a "state carrier" — the foundation every downstream
layer (memory, governance, adaptive TTS) builds on.

NO librosa — beat_track / chroma_cqt / onset_detect segfault on this box
(numpy 2.4.6). parselmouth gives us proper F0, jitter, shimmer, HNR which
librosa can't, and scipy handles spectral features without crashing.

Features (VoiceState, empirically robust, [OBS] — raw measurements):
  f0_mean          mean fundamental frequency (Hz)
  f0_std           F0 variability (Hz)          — drops when fatigued
  jitter_local     cycle-to-cycle F0 perturbation — rises when fatigued
  shimmer_local    amplitude perturbation
  mean_intensity   mean dB                       — drops when fatigued
  intensity_slope  RMS slope over time           — dynamism / arousal
  hnr              harmonic-to-noise ratio (dB)  — drops when fatigued/hoarse
  spectral_flatness ratio geo/arith mean         — rises when breathy/noisy
  speaking_rate    energy-onset count / duration (approx syll/s)
  spectral_centroid mean spectral centroid (Hz)  — timbre brightness

Derived state indices [DER]:
  fatigue_score   ∈ [0,1]  — composite of f0_std↓, jitter↑, HNR↓, intensity↓
  arousal_score   ∈ [0,1]  — composite of f0_mean↑, intensity↑, rate↑, slope↑
  emotion         low/neutral/high — heuristic from the two axes

DITEMPA BUKAN DIBERI — Forged, Not Given. F1-F13 floors: F2 (OBS/DER tags),
F7 (interpretation confidence cap 0.90), F11 (measured, provenance logged).

Usage:
  python3 forge_audio_features.py <audio.wav|ogg|mp3> [--json]
  cat audio.ogg | python3 forge_audio_features.py - --stdin  (base64 on stdin)
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CONFIDENCE_CAP = 0.90          # F7 HUMILITY — do not over-claim interpretation
SUPPORTED = {".wav", ".ogg", ".mp3", ".mp4", ".m4a", ".flac", ".webm", ".opus", ".aac", ".aiff"}


# ─────────────────────────── audio decode ───────────────────────────
def _load_mono_stereo(path: str, sr: int = 22050) -> Tuple[float, float, Any, float]:
    """Decode any audio to raw samples via ffmpeg → scipy. Returns (sr_out, audio, raw_wav_path, dur_s)."""
    with tempfile.TemporaryDirectory() as td:
        mid = os.path.join(td, "_mid.wav")
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", path, "-ar", str(sr), "-ac", "1",
             "-acodec", "pcm_s16le", mid],
            capture_output=True, timeout=90,
        )
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg decode failed: {r.stderr.decode(errors='replace')[-300:]}")
        from scipy.io import wavfile
        rate, data = wavfile.read(mid)
        y = data.astype("float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        y /= 32768.0
        dur = len(y) / float(rate)
        return rate, y, mid, dur


def _safe_harmonic_mean(vals: List[float]) -> float:
    vals = [v for v in vals if v is not None]
    if not vals:
        return 0.0
    return float(sum(vals) / len(vals))


# ─────────────────────────── feature extraction ───────────────────────────
@dataclass
class VoiceState:
    f0_mean: float = 0.0
    f0_std: float = 0.0
    jitter_local: float = 0.0
    shimmer_local: float = 0.0
    mean_intensity: float = 0.0
    intensity_slope: float = 0.0
    hnr: float = 0.0
    spectral_flatness: float = 0.0
    speaking_rate: float = 0.0
    spectral_centroid: float = 0.0
    # derived (DER)
    fatigue_score: float = 0.0
    arousal_score: float = 0.0
    emotion: str = "neutral"
    confidence: float = CONFIDENCE_CAP
    duration_s: float = 0.0
    # provenance (F11)
    extractor: str = "parselmouth-0.4.7+scipy"
    source_path: str = ""

    def vector(self) -> List[float]:
        """Fixed-dim embedding for Qdrant 'voice' named vector. Order matters — keep stable."""
        return [self.f0_mean, self.f0_std, self.jitter_local, self.shimmer_local,
                self.mean_intensity, self.intensity_slope, self.hnr,
                self.spectral_flatness, self.speaking_rate, self.spectral_centroid]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _extract_parselmouth(path: str) -> Dict[str, float]:
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(path)

    pitch = snd.to_pitch()
    f0 = pitch.selected_array["frequency"]
    voiced = f0[f0 > 0]
    f0_mean = float(voiced.mean()) if len(voiced) else 0.0
    f0_std = float(voiced.std()) if len(voiced) else 0.0

    # Point process for jitter/shimmer — Praat-standard, no segfault
    pp = call(snd, "To PointProcess (periodic, cc)", 75, 600)
    jitter_local = _safe(call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3))
    shimmer_local = _safe(call([snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6))

    intensity = snd.to_intensity(75)
    mean_intensity = _safe(intensity.get_average())
    # intensity slope: linear fit over time frames
    try:
        t_step = intensity.get_time_step()
        n = intensity.get_number_of_frames()
        ts, iv = [], []
        for i in range(1, n + 1):
            v = intensity.get_value_in_frame(i)
            if v is not None and not math.isnan(v):
                ts.append(i * t_step)
                iv.append(v)
        if len(iv) >= 4:
            xs = list(range(len(iv)))
            n = len(xs)
            mx = sum(xs) / n
            my = sum(iv) / n
            num = sum((x - mx) * (y - my) for x, y in zip(xs, iv))
            den = sum((x - mx) ** 2 for x in xs) or 1.0
            intensity_slope = num / den
        else:
            intensity_slope = 0.0
    except Exception:
        intensity_slope = 0.0

    # HNR (harmonic-to-noise ratio) — strong fatigue/hoarseness signal
    try:
        hnr_obj = call([snd, pp], "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = _safe(hnr_obj.get_mean())
    except Exception:
        hnr = 0.0

    return {
        "f0_mean": f0_mean, "f0_std": f0_std,
        "jitter_local": jitter_local, "shimmer_local": shimmer_local,
        "mean_intensity": mean_intensity, "intensity_slope": intensity_slope,
        "hnr": hnr,
    }


def _safe(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        return v if math.isfinite(v) else default
    except Exception:
        return default


def _extract_scipy(y: Any, sr: float, dur: float) -> Dict[str, float]:
    import numpy as np
    from scipy.signal import stft as scipy_stft, find_peaks

    S = np.abs(scipy_stft(y, fs=sr, nperseg=2048, noverlap=1024)[2]) ** 2
    S = S + 1e-12

    # spectral flatness (geo/arith mean per frame, averaged)
    gm = np.exp(np.mean(np.log(S), axis=0))
    am = np.mean(S, axis=0)
    flats = np.where(am > 0, gm / am, 0.0)
    spectral_flatness = float(np.mean(flats))

    # spectral centroid
    freqs = np.linspace(0, sr / 2, S.shape[0])
    num = np.sum(S * freqs[:, None], axis=0)
    den = np.sum(S, axis=0) + 1e-12
    centroid_frames = num / den
    spectral_centroid = float(np.mean(centroid_frames))

    # speaking rate: energy envelope onset count / duration
    chunk = int(sr / 20)  # ~50ms chunks
    if len(y) >= chunk:
        n_chunks = len(y) // chunk
        env = np.sqrt(np.mean(np.abs(y[:n_chunks * chunk].reshape(n_chunks, chunk)), axis=1))
    else:
        env = np.abs(y)
    env = env - env.mean()
    # smooth
    from scipy.ndimage import uniform_filter1d
    es = uniform_filter1d(env, size=5)
    onsets, _ = find_peaks(es, distance=8, prominence=float(np.std(es)) * 0.5)
    speaking_rate = (len(onsets) / dur) if dur > 0 else 0.0

    return {
        "spectral_flatness": spectral_flatness,
        "spectral_centroid": spectral_centroid,
        "speaking_rate": speaking_rate,
    }


def _derive_indices(f: Dict[str, float]) -> Dict[str, Any]:
    """Map raw measurements (OBS) to state indices (DER). Heuristics, not fact.
    Reference calibration ~ adult male BM speaker, OsmanNeural ~ 120-140 Hz."""
    # Fatigue: f0_std↓ (monotone), jitter↑, HMR↓, intensity↓
    # Normalize each to [0,1] against soft bounds.
    def clamp01(x: float) -> float:
        return max(0.0, min(1.0, x))

    f0_std = f.get("f0_std", 0)
    jit = f.get("jitter_local", 0)
    hnr = f.get("hnr", 0)
    inten = f.get("mean_intensity", 0)
    flat = f.get("spectral_flatness", 0)

    f_fatigue = clamp01(1 - f0_std / 30.0)          # <10Hz std => monotonous
    j_fatigue = clamp01((jit - 0.005) / 0.015)       # >0.02 jitter => fatigued
    h_fatigue = clamp01(1 - hnr / 15.0)              # <10dB HNR => hoarse
    i_fatigue = clamp01(1 - inten / 60.0)            # <45dB => weak
    s_fatigue = clamp01(flat * 2.0)
    fatigue = 0.30 * f_fatigue + 0.25 * j_fatigue + 0.20 * h_fatigue + 0.15 * i_fatigue + 0.10 * s_fatigue

    # Arousal: f0_mean↑, intensity↑, rate↑, intensity_slope↑
    f0 = f.get("f0_mean", 0)
    rate = f.get("speaking_rate", 0)
    slope = f.get("intensity_slope", 0)
    a_f0 = clamp01((f0 - 110) / 60.0) if f0 > 0 else 0.3
    a_i = clamp01((inten - 40) / 25.0)
    a_r = clamp01(rate / 6.0)
    a_s = clamp01((slope + 2.0) / 4.0)
    arousal = 0.35 * a_f0 + 0.25 * a_i + 0.25 * a_r + 0.15 * a_s

    if arousal >= 0.65 and fatigue < 0.5:
        emotion = "high"
    elif fatigue >= 0.6:
        emotion = "low"
    else:
        emotion = "neutral"

    return {
        "fatigue_score": round(fatigue, 4),
        "arousal_score": round(arousal, 4),
        "emotion": emotion,
        "confidence": CONFIDENCE_CAP,
    }


def extract_voice_state(path: str) -> VoiceState:
    # Keep the temp directory alive through BOTH scipy and parselmouth reads.
    # Previous version returned mid path after context exited → file deleted
    # → parselmouth PraatError. Now we manage the lifecycle explicitly.
    from scipy.io import wavfile as _wavfile
    with tempfile.TemporaryDirectory() as td:
        mid = os.path.join(td, "_mid.wav")
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", path, "-ar", "22050", "-ac", "1",
             "-acodec", "pcm_s16le", mid],
            capture_output=True, timeout=90,
        )
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg decode failed: {r.stderr.decode(errors='replace')[-300:]}")
        rate, data = _wavfile.read(mid)
        y = data.astype("float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        y /= 32768.0
        dur = len(y) / float(rate)
        sr = rate
        # parselmouth reads mid WHILE the temp dir is still alive
        pf = _extract_parselmouth(mid)
    # scipy works on in-memory arrays, no file needed
    sf = _extract_scipy(y, sr, dur)
    feats = {**pf, **sf}
    idx = _derive_indices(feats)
    vs = VoiceState(
        f0_mean=round(pf["f0_mean"], 3), f0_std=round(pf["f0_std"], 3),
        jitter_local=round(pf["jitter_local"], 6), shimmer_local=round(pf["shimmer_local"], 6),
        mean_intensity=round(pf["mean_intensity"], 3), intensity_slope=round(pf["intensity_slope"], 5),
        hnr=round(pf["hnr"], 3),
        spectral_flatness=round(sf["spectral_flatness"], 5),
        speaking_rate=round(sf["speaking_rate"], 3),
        spectral_centroid=round(sf["spectral_centroid"], 2),
        fatigue_score=idx["fatigue_score"], arousal_score=idx["arousal_score"],
        emotion=idx["emotion"], confidence=idx["confidence"],
        duration_s=round(dur, 2), source_path=str(path),
    )
    return vs


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract VoiceState prosody features from audio")
    ap.add_argument("audio", nargs="?", help="audio file path (or '-' for stdin base64)")
    ap.add_argument("--stdin", action="store_true", help="read base64 audio from stdin")
    ap.add_argument("--json", action="store_true", help="output raw JSON (default human)")
    args = ap.parse_args()

    if args.stdin:
        b64 = sys.stdin.read().strip()
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tf:
            tf.write(base64.b64decode(b64))
            path = tf.name
    elif args.audio and args.audio != "-":
        path = args.audio
    else:
        print("usage: forge_audio_features.py <audio> | --stdin", file=sys.stderr)
        return 2

    vs = extract_voice_state(path)
    d = vs.to_dict()
    d["vector"] = vs.vector()
    out = {"success": True, "voice_state": d}
    print(json.dumps(out) if args.json else
          json.dumps(out, indent=2))
    if args.stdin:
        try:
            os.unlink(path)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())