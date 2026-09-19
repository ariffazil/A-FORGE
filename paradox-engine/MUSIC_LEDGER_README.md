# Dynamic Music Memory Ledger

**arifOS Somatic Intelligence Stack — extends the Paradox Engine**

## What It Does

The Music Memory Ledger tracks how music memories **change over time** as they are re-heard. It replaces static hash pointers to music tracks with dynamic, reconsolidation-aware memory objects.

## Key Concepts

### Non-Exclusive Mood Buckets
A track can belong to multiple mood categories simultaneously at different intensities:
```python
# Rindu: bittersweet — both romantic AND sad AND nostalgic
mood_buckets = {"longing": 0.8, "romantic": 0.5, "sad": 0.3, "nostalgic": 0.6}
```
This fixes the blind spot in pure-enum mood classification where a track is forced into exactly one bucket.

### Sequence Is First-Class
Tracks are stored in play order. The emotional arc of a session (e.g., "contemplative→yearning→upbeat") is computed from the sequence and tracked across sessions. **Same songs in different order = different memory.**

### Reconsolidation Tracking
Every time a track is played again, its memory pointer is updated:
- `reconsolidation_count` increments
- `last_modified_context` logs what changed
- `memory_drift` measures cosine distance between the original somatic vector and the current one
- Mood buckets merge (max intensity for overlapping moods)

### Somatic Vectors
16-dimensional feature vectors matching the Paradox Engine's `SOMATIC_DIM` schema:
```
valence, arousal, tension, depth, duration_feel, density,
warmth, weight, direction, stability, spiritual,
cultural_weight, paradox_affinity, breath, silence, emergence
```

## Architecture

```
music_ledger.py
├── MusicMemoryPointer   — dynamic memory of one track (replaces static hash)
├── ListeningSession      — ordered tracks + transition function + entropy
├── DynamicLedger         — central ledger: sessions, patterns, heatmap
└── run_validation()      — test harness with 5 real tracks, 2 sessions
```

## Connection to Paradox Engine

```python
from music_ledger import DynamicLedger
from models import MotifState

ledger = DynamicLedger()
ledger.add_session(session)

# Export current state as MotifState list for the Paradox Engine
motifs = ledger.export_for_paradox_engine()
# Each track becomes a MotifState with:
#   - intensity = min(1.0, play_count/5)
#   - decay_rate = 0.05 + (drift * 0.1)  (unstable memories decay faster)
#   - cultural_origin = "nusantara" or "cover"
```

## API

| Method | Description |
|--------|-------------|
| `add_session(session)` | Record a listening session, update all track pointers |
| `get_drift(track_id)` | Cosine distance from first-play to current somatic vector |
| `get_sequence_patterns()` | Common mood transitions across all sessions |
| `get_reconsolidation_heatmap()` | Per-track play count, drift, mood state |
| `export_for_paradox_engine()` | Convert to `MotifState[]` for Paradox Engine |
| `serialize()` / `deserialize()` | JSON persistence |

## Persistence

The entire ledger serializes to JSON. Deserialize reconstructs sessions, track pointers, and transition counts.

## Running Tests

```bash
cd /root/A-FORGE/paradox-engine
python music_ledger.py
```

Runs 9 invariant checks against 5 real tracks across 2 sessions.

## Tracks (Test Data)

| ID | Track | Artist | Type | Primary Mood |
|----|-------|--------|------|-------------|
| babendi | Babendi-Bendi | Arif Fazil | Original | upbeat |
| rindu | Rindu | Arif Fazil | Original | longing |
| menunggu | Menunggu | Arif Fazil | Original | patient |
| madu_tiga | Madu Tiga | Padi (cover) | Cover | upbeat |
| mencari_cinta | Mencari Cinta | Peterpan (cover) | Cover | yearning |

3 original, 2 cover. No fabrication.
