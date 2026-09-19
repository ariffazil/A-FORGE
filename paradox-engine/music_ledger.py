"""
Dynamic Music Memory Ledger — arifOS Somatic Intelligence Stack

Extends the Paradox Engine with reconsolidation-aware music memory tracking.
Key properties:
  - Non-exclusive mood buckets (a track can be both upbeat AND sad)
  - Sequence-first: tracks stored in play order, transitions computed
  - Reconsolidation tracking: every play logs context change and drift
  - Compatible export back to MotifState for Paradox Engine interop

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import json
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

import numpy as np

from models import SOMATIC_DIM, SOMATIC_LABELS, MotifState


# ── Music Memory Pointer ──────────────────────────────────────────────

@dataclass
class MusicMemoryPointer:
    """
    A dynamic memory of a specific music track — replaces static hash pointers.

    Each play of a track creates or updates a MusicMemoryPointer.
    Mood buckets allow overlap: a track can be 'romantic' AND 'upbeat' AND 'sad'
    simultaneously, at different intensities. This fixes the bucket simplification
    blind spot in pure-enum mood classification.
    """
    track_id: str
    track_name: str
    artist: str
    is_original: bool  # True = original composition, False = cover/adaptation

    # 16-dim somatic vector — how this track FEELS in the body
    somatic_vector: np.ndarray  # shape (SOMATIC_DIM,)

    # Non-exclusive mood buckets — keys are freeform, values are [0,1] intensity
    # Example: {'romantic': 0.3, 'upbeat': 0.6, 'sad': 0.1}
    mood_buckets: dict[str, float] = field(default_factory=dict)

    # Sequence context
    sequence_position: int = 0  # position within its session
    session_id: str = ""  # which session this play belongs to
    timestamp: float = 0.0  # epoch when played

    # Reconsolidation tracking
    reconsolidation_count: int = 0  # how many times memory has been re-written
    last_modified_context: str = ""  # free text: what changed on most recent play
    memory_drift: float = 0.0  # cosine distance from first-play vector to current

    # Internal: store the ORIGINAL somatic vector for drift computation
    _original_somatic_vector: Optional[np.ndarray] = field(
        default=None, repr=False, compare=False
    )

    def __post_init__(self):
        if self.somatic_vector.shape != (SOMATIC_DIM,):
            raise ValueError(
                f"somatic_vector must be {SOMATIC_DIM}-dim, got {self.somatic_vector.shape}"
            )
        # Validate mood bucket values
        for mood, intensity in self.mood_buckets.items():
            if not 0.0 <= intensity <= 1.0:
                raise ValueError(
                    f"mood_bucket '{mood}' intensity must be [0,1], got {intensity}"
                )
        # Store original on first creation
        if self._original_somatic_vector is None:
            self._original_somatic_vector = self.somatic_vector.copy()

    def record_reconsolidation(
        self,
        new_somatic_vector: np.ndarray,
        context: str,
    ) -> None:
        """
        Reconsolidate: update the memory's somatic meaning after a new play.
        Increments count, logs context, recomputes drift from original.
        """
        if new_somatic_vector.shape != (SOMATIC_DIM,):
            raise ValueError(
                f"new_somatic_vector must be {SOMATIC_DIM}-dim, "
                f"got {new_somatic_vector.shape}"
            )
        self.somatic_vector = new_somatic_vector.copy()
        self.reconsolidation_count += 1
        self.last_modified_context = context
        self._compute_drift()

    def _compute_drift(self) -> None:
        """Cosine distance between original and current somatic vector."""
        if self._original_somatic_vector is None:
            self._original_somatic_vector = self.somatic_vector.copy()
            self.memory_drift = 0.0
            return
        orig = self._original_somatic_vector
        curr = self.somatic_vector
        norm_o = np.linalg.norm(orig)
        norm_c = np.linalg.norm(curr)
        if norm_o < 1e-8 or norm_c < 1e-8:
            self.memory_drift = 1.0  # degenerate case: zero vectors are maximally different
            return
        cosine_sim = float(np.dot(orig, curr) / (norm_o * norm_c))
        self.memory_drift = max(0.0, 1.0 - cosine_sim)

    @property
    def primary_mood(self) -> str:
        """Highest-intensity mood bucket key."""
        if not self.mood_buckets:
            return "unclassified"
        return max(self.mood_buckets, key=self.mood_buckets.get)  # type: ignore[arg-type]

    def top_moods(self, n: int = 3) -> list[tuple[str, float]]:
        """Return top-n moods sorted by intensity descending."""
        sorted_moods = sorted(
            self.mood_buckets.items(), key=lambda x: x[1], reverse=True
        )
        return sorted_moods[:n]

    def to_dict(self) -> dict[str, Any]:
        """Serialize to JSON-compatible dict."""
        d = {
            "track_id": self.track_id,
            "track_name": self.track_name,
            "artist": self.artist,
            "is_original": self.is_original,
            "somatic_vector": self.somatic_vector.tolist(),
            "mood_buckets": self.mood_buckets,
            "sequence_position": self.sequence_position,
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "reconsolidation_count": self.reconsolidation_count,
            "last_modified_context": self.last_modified_context,
            "memory_drift": self.memory_drift,
        }
        if self._original_somatic_vector is not None:
            d["_original_somatic_vector"] = self._original_somatic_vector.tolist()
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> MusicMemoryPointer:
        """Deserialize from dict."""
        d = dict(d)  # copy
        d["somatic_vector"] = np.array(d["somatic_vector"], dtype=np.float64)
        if "_original_somatic_vector" in d:
            d["_original_somatic_vector"] = np.array(
                d["_original_somatic_vector"], dtype=np.float64
            )
        return cls(**d)


# ── Listening Session ─────────────────────────────────────────────────

@dataclass
class ListeningSession:
    """
    A coherent listening session — tracks played in sequence.
    Sequence is first-class: tracks are stored in play order, and the
    transition_function is computed from the sequence.
    """
    session_id: str
    start_time: float
    end_time: float
    tracks: list[MusicMemoryPointer] = field(default_factory=list)
    transition_function: str = ""  # e.g. 'grounding→resolution'
    entropy_delta: float = 0.0  # system entropy change across session
    sovereign_annotation: Optional[str] = None  # F13 annotation

    def __post_init__(self):
        # Ensure sequence positions are consistent
        for i, track in enumerate(self.tracks):
            if track.sequence_position == 0 and i > 0:
                track.sequence_position = i
            if not track.session_id:
                track.session_id = self.session_id

    def compute_transition_function(self) -> str:
        """
        Derive a transition string from the track sequence.
        Uses primary mood of each track to describe the emotional arc.
        """
        if len(self.tracks) < 2:
            if self.tracks:
                return f"static({self.tracks[0].primary_mood})"
            return "empty"

        moods = [t.primary_mood for t in self.transitions_as("primary_mood")]
        # Deduplicate consecutive identical moods
        compressed = [moods[0]]
        for m in moods[1:]:
            if m != compressed[-1]:
                compressed.append(m)
        return "→".join(compressed)

    def transitions_as(self, attr: str = "primary_mood") -> list[MusicMemoryPointer]:
        """Return tracks in play order."""
        return sorted(self.tracks, key=lambda t: t.sequence_position)

    def duration_seconds(self) -> float:
        return self.end_time - self.start_time

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "tracks": [t.to_dict() for t in self.tracks],
            "transition_function": self.transition_function,
            "entropy_delta": self.entropy_delta,
            "sovereign_annotation": self.sovereign_annotation,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> ListeningSession:
        d = dict(d)
        d["tracks"] = [MusicMemoryPointer.from_dict(t) for t in d["tracks"]]
        return cls(**d)


# ── Dynamic Music Memory Ledger ───────────────────────────────────────

class DynamicLedger:
    """
    Central ledger for dynamic music memory with reconsolidation tracking.

    Maintains:
      - All sessions (ordered by start_time)
      - Per-track memory pointers (latest state, with full drift history)
      - Sequence transition patterns
      - Reconsolidation heatmap data
    """

    def __init__(self) -> None:
        self._sessions: list[ListeningSession] = []
        self._track_pointers: dict[str, MusicMemoryPointer] = {}
        self._transition_counts: dict[tuple[str, str], int] = defaultdict(int)
        self._reconsolidation_counts: dict[str, int] = defaultdict(int)

    @property
    def session_count(self) -> int:
        return len(self._sessions)

    @property
    def tracked_tracks(self) -> list[str]:
        return list(self._track_pointers.keys())

    def add_session(self, session: ListeningSession) -> None:
        """
        Record a listening session. Updates track pointers with reconsolidation
        logic: if a track has been seen before, increment its count and compute drift.
        """
        self._sessions.append(session)
        self._sessions.sort(key=lambda s: s.start_time)

        # Compute transition function if not set
        if not session.transition_function:
            session.transition_function = session.compute_transition_function()

        # Process each track in sequence
        ordered = session.transitions_as()
        for i, track in enumerate(ordered):
            track_id = track.track_id

            if track_id in self._track_pointers:
                # Reconsolidation: memory already exists, update it
                existing = self._track_pointers[track_id]
                context_str = (
                    f"session={session.session_id} pos={i} "
                    f"mood_shift={track.primary_mood} "
                    f"session_mood_arc={session.transition_function}"
                )
                existing.record_reconsolidation(
                    new_somatic_vector=track.somatic_vector,
                    context=context_str,
                )
                # Merge mood buckets (take max intensity for overlapping moods)
                for mood, intensity in track.mood_buckets.items():
                    if mood in existing.mood_buckets:
                        existing.mood_buckets[mood] = max(
                            existing.mood_buckets[mood], intensity
                        )
                    else:
                        existing.mood_buckets[mood] = intensity
                existing.session_id = session.session_id
                existing.timestamp = track.timestamp
                self._reconsolidation_counts[track_id] = existing.reconsolidation_count
            else:
                # First encounter — register as new pointer
                pointer = MusicMemoryPointer(
                    track_id=track.track_id,
                    track_name=track.track_name,
                    artist=track.artist,
                    is_original=track.is_original,
                    somatic_vector=track.somatic_vector.copy(),
                    mood_buckets=dict(track.mood_buckets),
                    sequence_position=track.sequence_position,
                    session_id=session.session_id,
                    timestamp=track.timestamp,
                    reconsolidation_count=0,
                    last_modified_context=f"initial: session={session.session_id}",
                    memory_drift=0.0,
                    _original_somatic_vector=track.somatic_vector.copy(),
                )
                self._track_pointers[track_id] = pointer

        # Record sequence transition patterns
        for i in range(len(ordered) - 1):
            from_mood = ordered[i].primary_mood
            to_mood = ordered[i + 1].primary_mood
            self._transition_counts[(from_mood, to_mood)] += 1

    def get_drift(self, track_id: str) -> float:
        """How much this track's memory has drifted from its first-play state."""
        if track_id not in self._track_pointers:
            return -1.0  # not found sentinel
        return self._track_pointers[track_id].memory_drift

    def get_sequence_patterns(self) -> dict[str, int]:
        """
        Common transitions: which moods follow which.
        Returns dict like {'sad→upbeat': 3, 'upbeat→grounding': 2, ...}
        """
        patterns: dict[str, int] = {}
        for (from_mood, to_mood), count in sorted(
            self._transition_counts.items(), key=lambda x: -x[1]
        ):
            patterns[f"{from_mood}→{to_mood}"] = count
        return patterns

    def get_reconsolidation_heatmap(self) -> dict[str, dict[str, Any]]:
        """
        Per-track reconsolidation summary:
          - play_count (sessions appeared in)
          - reconsolidation_count
          - current_drift
          - primary_mood (current)
        Tracks with 0 plays vs many plays highlight memory formation vs stagnation.
        """
        heatmap: dict[str, dict[str, Any]] = {}
        for track_id, pointer in self._track_pointers.items():
            heatmap[track_id] = {
                "track_name": pointer.track_name,
                "artist": pointer.artist,
                "play_count": pointer.reconsolidation_count,
                "reconsolidation_count": pointer.reconsolidation_count,
                "current_drift": round(pointer.memory_drift, 4),
                "primary_mood": pointer.primary_mood,
                "mood_buckets": dict(pointer.mood_buckets),
                "last_context": pointer.last_modified_context,
            }
        return heatmap

    def export_for_paradox_engine(self) -> list[MotifState]:
        """
        Convert current ledger state to MotifState list for Paradox Engine interop.
        Each tracked track becomes a MotifState with intensity = min(1.0, play_count/5).
        """
        motifs: list[MotifState] = []
        for track_id, pointer in self._track_pointers.items():
            # Intensity based on how often the track has been reconsolidated
            # More plays = more somatic presence, capped at 1.0
            intensity = min(1.0, (pointer.reconsolidation_count + 1) / 5.0)

            # Decay rate: high-drift tracks decay faster (memory is unstable)
            decay_rate = 0.05 + (pointer.memory_drift * 0.1)

            motif = MotifState(
                id=track_id,
                label=f"{pointer.artist} - {pointer.track_name}",
                intensity=intensity,
                somatic_vector=pointer.somatic_vector.copy(),
                semantic_embedding=None,
                timestamp=pointer.timestamp,
                decay_rate=decay_rate,
                contradiction_ids=[],
                complementary_ids=[],
                cultural_origin="nusantara" if pointer.is_original else "cover",
                description=(
                    f"Music memory: {pointer.primary_mood} "
                    f"(drift={pointer.memory_drift:.3f}, "
                    f"plays={pointer.reconsolidation_count})"
                ),
            )
            motifs.append(motif)
        return motifs

    def serialize(self) -> str:
        """Full ledger to JSON string for persistence."""
        data = {
            "version": "1.0.0",
            "sessions": [s.to_dict() for s in self._sessions],
            "transition_counts": {
                f"{k[0]}|{k[1]}": v for k, v in self._transition_counts.items()
            },
        }
        return json.dumps(data, indent=2)

    @classmethod
    def deserialize(cls, json_str: str) -> DynamicLedger:
        """Reconstruct a ledger from JSON string."""
        data = json.loads(json_str)
        ledger = cls()

        for s_data in data.get("sessions", []):
            session = ListeningSession.from_dict(s_data)
            ledger.add_session(session)

        # Rebuild transition counts
        if "transition_counts" in data:
            for key, count in data["transition_counts"].items():
                parts = key.split("|", 1)
                if len(parts) == 2:
                    ledger._transition_counts[(parts[0], parts[1])] = count

        return ledger

    def get_track_pointer(self, track_id: str) -> Optional[MusicMemoryPointer]:
        """Get the current memory pointer for a track."""
        return self._track_pointers.get(track_id)

    def get_all_sessions(self) -> list[ListeningSession]:
        """Return all sessions in chronological order."""
        return list(self._sessions)

    def summary(self) -> str:
        """Human-readable summary of the ledger."""
        lines = [
            f"[MUSIC MEMORY LEDGER — v1.0.0]",
            f"Sessions recorded: {self.session_count}",
            f"Tracks tracked: {len(self._track_pointers)}",
            f"Unique transition patterns: {len(self._transition_counts)}",
            "",
        ]

        if self._track_pointers:
            lines.append("Track memory state:")
            for tid, ptr in self._track_pointers.items():
                lines.append(
                    f"  {ptr.artist} - {ptr.track_name}: "
                    f"plays={ptr.reconsolidation_count} "
                    f"drift={ptr.memory_drift:.4f} "
                    f"mood={ptr.primary_mood}"
                )

        patterns = self.get_sequence_patterns()
        if patterns:
            lines.append("\nTop transition patterns:")
            for pattern, count in list(patterns.items())[:5]:
                lines.append(f"  {pattern}: {count}x")

        return "\n".join(lines)


# ── Test Data & Validation ────────────────────────────────────────────

def _build_test_tracks() -> dict[str, MusicMemoryPointer]:
    """
    5 tracks with correct metadata — 3 original, 2 cover.
    NO fabrication. Somatic vectors are illustrative placeholders
    matching the 16-dim schema from models.py.
    """
    tracks = {}

    # Track 1: Babendi-Bendi (original, culturally weighted upbeat)
    tracks["babendi"] = MusicMemoryPointer(
        track_id="babendi",
        track_name="Babendi-Bendi",
        artist="Arif Fazil",
        is_original=True,
        somatic_vector=np.array([
            0.6,   # valence: positive
            0.7,   # arousal: energetic
            0.3,   # tension: moderate-low
            0.4,   # depth: moderate
            0.5,   # duration_feel: medium
            0.6,   # density: moderate
            0.7,   # warmth: warm
            0.4,   # weight: light-medium
            0.6,   # direction: outward
            0.5,   # stability: moderate
            0.3,   # spiritual: low-moderate
            0.7,   # cultural_weight: culturally specific
            0.2,   # paradox_affinity: low
            0.6,   # breath: flowing
            0.2,   # silence: filled
            0.3,   # emergence: mostly known
        ], dtype=np.float64),
        mood_buckets={"upbeat": 0.7, "playful": 0.6, "cultural": 0.5},
        sequence_position=0,
        session_id="session_001",
        timestamp=1726800000.0,
    )

    # Track 2: Rindu (original, longing/bittersweet)
    tracks["rindu"] = MusicMemoryPointer(
        track_id="rindu",
        track_name="Rindu",
        artist="Arif Fazil",
        is_original=True,
        somatic_vector=np.array([
            -0.3,  # valence: slightly negative
            0.3,   # arousal: low
            0.6,   # tension: moderate-high
            0.8,   # depth: deep
            0.7,   # duration_feel: enduring
            0.4,   # density: sparse-moderate
            0.5,   # warmth: warm
            0.6,   # weight: medium-heavy
            0.3,   # direction: inward
            0.4,   # stability: moderate-unstable
            0.5,   # spiritual: moderate
            0.8,   # cultural_weight: high
            0.7,   # paradox_affinity: holds tension
            0.3,   # breath: semi-held
            0.5,   # silence: moderate
            0.4,   # emergence: partially arising
        ], dtype=np.float64),
        mood_buckets={"longing": 0.8, "romantic": 0.5, "sad": 0.3, "nostalgic": 0.6},
        sequence_position=1,
        session_id="session_001",
        timestamp=1726800300.0,
    )

    # Track 3: Menunggu (original, waiting/patience)
    tracks["menunggu"] = MusicMemoryPointer(
        track_id="menunggu",
        track_name="Menunggu",
        artist="Arif Fazil",
        is_original=True,
        somatic_vector=np.array([
            -0.1,  # valence: neutral-negative
            0.15,  # arousal: very low
            0.4,   # tension: moderate
            0.7,   # depth: deep
            0.9,   # duration_feel: very enduring
            0.2,   # density: sparse
            0.6,   # warmth: warm
            0.7,   # weight: heavy
            0.2,   # direction: inward
            0.6,   # stability: grounded
            0.6,   # spiritual: moderate-high
            0.9,   # cultural_weight: very culturally specific
            0.8,   # paradox_affinity: holds tension
            0.2,   # breath: held
            0.7,   # silence: quiet
            0.5,   # emergence: arising
        ], dtype=np.float64),
        mood_buckets={"contemplative": 0.7, "patient": 0.8, "spiritual": 0.5, "sad": 0.2},
        sequence_position=2,
        session_id="session_001",
        timestamp=1726800600.0,
    )

    # Track 4: Padi - Madu Tiga (cover, upbeat but complex)
    tracks["madu_tiga"] = MusicMemoryPointer(
        track_id="madu_tiga",
        track_name="Madu Tiga",
        artist="Padi (cover by Arif Fazil)",
        is_original=False,
        somatic_vector=np.array([
            0.4,   # valence: positive but conflicted
            0.65,  # arousal: moderate-high
            0.5,   # tension: moderate
            0.3,   # depth: moderate-shallow
            0.4,   # duration_feel: medium
            0.5,   # density: moderate
            0.5,   # warmth: moderate
            0.35,  # weight: light-medium
            0.7,   # direction: outward
            0.4,   # stability: moderate
            0.1,   # spiritual: low
            0.4,   # cultural_weight: moderate
            0.4,   # paradox_affinity: moderate
            0.5,   # breath: moderate
            0.2,   # silence: filled
            0.2,   # emergence: known
        ], dtype=np.float64),
        mood_buckets={"upbeat": 0.5, "playful": 0.4, "romantic": 0.3, "conflicted": 0.3},
        sequence_position=3,
        session_id="session_001",
        timestamp=1726800900.0,
    )

    # Track 5: Peterpan - Mencari Cinta (cover, searching/yearning)
    tracks["mencari_cinta"] = MusicMemoryPointer(
        track_id="mencari_cinta",
        track_name="Mencari Cinta",
        artist="Peterpan (cover by Arif Fazil)",
        is_original=False,
        somatic_vector=np.array([
            0.2,   # valence: slightly positive
            0.45,  # arousal: moderate
            0.55,  # tension: moderate-high
            0.5,   # depth: moderate
            0.6,   # duration_feel: medium-enduring
            0.4,   # density: moderate
            0.4,   # warmth: moderate
            0.4,   # weight: medium
            0.5,   # direction: moderate inward-outward
            0.35,  # stability: moderate-unstable
            0.2,   # spiritual: low-moderate
            0.3,   # cultural_weight: moderate-low
            0.3,   # paradox_affinity: moderate
            0.4,   # breath: moderate
            0.3,   # silence: moderate-filled
            0.3,   # emergence: partially arising
        ], dtype=np.float64),
        mood_buckets={"yearning": 0.7, "romantic": 0.5, "searching": 0.6, "sad": 0.2},
        sequence_position=4,
        session_id="session_001",
        timestamp=1726801200.0,
    )

    return tracks


def _build_test_sessions() -> list[ListeningSession]:
    """
    Two hypothetical sessions showing sequence matters.
    Session 1: upbeat → longing → contemplative → playful → searching (emotional arc)
    Session 2: different order of same tracks — same songs, different meaning.
    """
    tracks = _build_test_tracks()
    sessions = []

    # Session 1: morning reflective arc
    s1_tracks = []
    for i, tid in enumerate(["babendi", "rindu", "menunggu", "madu_tiga", "mencari_cinta"]):
        t = tracks[tid]
        t_copy = MusicMemoryPointer(
            track_id=t.track_id,
            track_name=t.track_name,
            artist=t.artist,
            is_original=t.is_original,
            somatic_vector=t.somatic_vector.copy(),
            mood_buckets=dict(t.mood_buckets),
            sequence_position=i,
            session_id="session_001",
            timestamp=1726800000.0 + (i * 300),
        )
        s1_tracks.append(t_copy)

    session1 = ListeningSession(
        session_id="session_001",
        start_time=1726800000.0,
        end_time=1726801500.0,
        tracks=s1_tracks,
        entropy_delta=0.35,
        sovereign_annotation="Morning session — playful start settling into contemplation",
    )
    session1.transition_function = session1.compute_transition_function()
    sessions.append(session1)

    # Session 2: evening — same tracks, reordered (contemplative first)
    s2_tracks = []
    for i, tid in enumerate(["menunggu", "mencari_cinta", "rindu", "madu_tiga", "babendi"]):
        t = tracks[tid]
        t_copy = MusicMemoryPointer(
            track_id=t.track_id,
            track_name=t.track_name,
            artist=t.artist,
            is_original=t.is_original,
            somatic_vector=t.somatic_vector.copy(),
            mood_buckets=dict(t.mood_buckets),
            sequence_position=i,
            session_id="session_002",
            timestamp=1726886400.0 + (i * 300),
        )
        s2_tracks.append(t_copy)

    session2 = ListeningSession(
        session_id="session_002",
        start_time=1726886400.0,
        end_time=1726887900.0,
        tracks=s2_tracks,
        entropy_delta=-0.15,
        sovereign_annotation="Evening — starting deep, rising to energy. Intentional reconsolidation.",
    )
    session2.transition_function = session2.compute_transition_function()
    sessions.append(session2)

    return sessions


def run_validation() -> str:
    """
    Build ledger, add both test sessions, validate all invariants, return summary.
    """
    ledger = DynamicLedger()
    sessions = _build_test_sessions()

    # Add sessions
    for session in sessions:
        ledger.add_session(session)

    # Validate invariants
    errors = []

    # 1. Session count
    if ledger.session_count != 2:
        errors.append(f"Expected 2 sessions, got {ledger.session_count}")

    # 2. Track count: 5 unique tracks across both sessions
    if len(ledger.tracked_tracks) != 5:
        errors.append(f"Expected 5 tracked tracks, got {len(ledger.tracked_tracks)}")

    # 3. Reconsolidation: all 5 tracks should be reconsolidated (appear in 2 sessions)
    for tid in ledger.tracked_tracks:
        ptr = ledger.get_track_pointer(tid)
        assert ptr is not None, f"Track {tid} not found"
        if ptr.reconsolidation_count < 1:
            errors.append(f"Track {tid} not reconsolidated (count={ptr.reconsolidation_count})")

    # 4. Drift: at least one track should have non-zero drift
    any_drift = any(
        ledger.get_track_pointer(tid) is not None and ledger.get_drift(tid) > 0
        for tid in ledger.tracked_tracks
    )
    if not any_drift:
        errors.append("No tracks show memory drift after 2 sessions")

    # 5. Sequence patterns: different session orders should produce patterns
    patterns = ledger.get_sequence_patterns()
    if len(patterns) < 3:
        errors.append(f"Expected at least 3 transition patterns, got {len(patterns)}")

    # 6. Mood buckets allow overlap: check rindu has multiple moods
    rindu_ptr = ledger.get_track_pointer("rindu")
    if rindu_ptr and len(rindu_ptr.mood_buckets) < 2:
        errors.append("Rindu mood_buckets should have overlap (multiple moods)")

    # 7. Export to Paradox Engine: should produce 5 MotifState objects
    motifs = ledger.export_for_paradox_engine()
    if len(motifs) != 5:
        errors.append(f"Expected 5 MotifState from export, got {len(motifs)}")

    # 8. JSON round-trip
    json_str = ledger.serialize()
    restored = DynamicLedger.deserialize(json_str)
    if restored.session_count != 2:
        errors.append(f"JSON round-trip: expected 2 sessions, got {restored.session_count}")

    # 9. Transition functions computed
    for session in sessions:
        if not session.transition_function:
            errors.append(f"Session {session.session_id} has empty transition_function")

    # Build result
    if errors:
        result = "FAIL: " + "; ".join(errors)
    else:
        result = "PASS: all 9 invariant checks"

    result += "\n\n" + ledger.summary()
    return result


if __name__ == "__main__":
    print(run_validation())
