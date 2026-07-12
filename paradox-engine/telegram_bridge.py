"""
Telegram Signal Bridge — Paradox Engine v0.1
Maps Telegram message topology → A-FORGE Paradox Engine motif activations.

5-dim old template → 16-dim somatic vector bridge.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

import numpy as np

from models import MotifState, SOMATIC_DIM
from engine import ParadoxEngine
from api import SomaticStateAPI


# ── 5-dim → 16-dim Vector Bridge ─────────────────────────────────
# Old templates (5-dim):
#   [valence, arousal, tension, depth, density]
#
# New somatic features (16-dim):
#   [valence, arousal, tension, depth, duration_feel, density, warmth,
#    weight, direction, stability, spiritual, cultural_weight,
#    paradox_affinity, breath, silence, emergence]
#
# Mapping: the 5 input dims map to their 16-dim equivalents.
# Unmapped dims get culturally-appropriate defaults for Telegram text.

_5DIM_TO_16DIM = {
    0: 0,   # valence → valence
    1: 1,   # arousal → arousal
    2: 2,   # tension → tension
    3: 3,   # depth → depth
    4: 4,   # density → duration_feel (closest mapping)
}


def expand_5_to_16(vector_5: list[float]) -> np.ndarray:
    """
    Expand a 5-dim Telegram template vector to 16-dim somatic vector.
    Maps known dims, fills unknowns with Telegram-specific defaults.
    """
    if len(vector_5) != 5:
        raise ValueError(f"Expected 5-dim vector, got {len(vector_5)}-dim")

    out = np.zeros(SOMATIC_DIM, dtype=np.float64)

    # Map known dims
    for src_idx, dst_idx in _5DIM_TO_16DIM.items():
        out[dst_idx] = vector_5[src_idx]

    # Telegram-specific defaults (text-based, not audio)
    # valence: neutral to slightly positive (Telegram conversation)
    out[0] = max(out[0], 0.2)
    # arousal: moderate (conversation, not music)
    out[1] = 0.5
    # tension: moderate
    out[2] = 0.5
    # depth: use input
    out[3] = max(out[3], 0.3)
    # duration_feel: short (single messages)
    out[4] = 0.4
    # density: use input
    out[5] = max(out[5], 0.4)

    # Telegram-context defaults for unmapped dims
    out[6] = 0.5   # warmth — conversation is warm
    out[7] = 0.3   # weight — text is light
    out[8] = 0.5   # direction — balanced inward/outward
    out[9] = 0.5   # stability — conversation is fluid
    out[10] = 0.0  # spiritual — text is secular unless marked
    out[11] = 0.3  # cultural_weight — varies by content
    out[12] = 0.5  # paradox_affinity — Telegram paradox-prone
    out[13] = 0.5  # breath — flowing
    out[14] = 0.4  # silence — messages have rhythm
    out[15] = 0.0  # emergence — not in Telegram text

    return out


# ── Telegram Motif Templates (5-dim, will be expanded) ─────────────

TELEGRAM_MOTIF_TEMPLATES_5D = {
    # [valence, arousal, tension, depth, density]
    "question":        [0.0, 0.2, 0.5, 0.5, 0.3],
    "command":         [0.1, 0.1, 0.0, 0.8, 0.1],
    "reflection":      [-0.1, 0.7, 0.5, 0.2, 0.8],
    "frustration":     [-0.3, 0.1, 0.8, 0.6, 0.2],
    "agreement":       [0.6, 0.9, 0.0, 0.1, 0.5],
    "disagreement":    [-0.2, 0.1, 0.7, 0.5, 0.4],
    "creative":        [0.2, 0.5, 0.3, 0.2, 0.9],
    "technical":        [0.0, 0.3, 0.1, 0.7, 0.2],
    "emotional":       [-0.2, 0.6, 0.8, 0.3, 0.7],
    "sovereign":       [0.5, 0.0, 0.0, 1.0, 0.0],
    "deliberation":    [0.0, 0.5, 0.4, 0.6, 0.6],
    "uncertainty":     [-0.1, 0.3, 0.6, 0.4, 0.3],
    "hope":            [0.5, 0.4, 0.2, 0.5, 0.4],
    "grief":           [-0.6, 0.2, 0.7, 0.8, 0.3],
    "longing":         [-0.3, 0.4, 0.5, 0.7, 0.5],
    "rindu":           [-0.4, 0.3, 0.4, 0.8, 0.6],  # Melayu motif
    "sabar":           [0.0, 0.0, 0.2, 0.5, 0.7],    # Melayu motif
    "syukur":          [0.6, 0.3, 0.1, 0.4, 0.5],    # Melayu motif
    "redha":           [0.2, 0.0, 0.1, 0.6, 0.8],     # Melayu motif
    "sedih":           [-0.5, 0.2, 0.6, 0.7, 0.3],   # Melayu motif
}

# Telegram-level contradictions (structural, not semantic)
# These pairs tend to appear together in Telegram topology — not semantic opposition
TELEGRAM_CONTRADICTION_PAIRS = [
    ("frustration", "agreement"),
    ("command", "reflection"),
    ("sovereign", "uncertainty"),
    ("technical", "emotional"),
    ("disagreement", "creative"),
    ("grief", "syukur"),       # semantic paradox in conversation
    ("rindu", "redha"),        # Melayu complementary paradox
    ("sabar", "marah"),        # Melayu complementary paradox
    ("sedih", "syukur"),       # Melayu complementary — NOT contradictory
    ("longing", "sabar"),      # Melayu paradox
    ("hope", "uncertainty"),    # agentic paradox
    ("reflection", "command"),   # deliberation vs action
]


# ── Telegram Message Classifier ────────────────────────────────────

@dataclass
class TelegramMessage:
    """Canonical Telegram message format for the bridge."""
    id: int
    text: str
    is_reply: bool
    reply_to_id: Optional[int]
    timestamp: float
    sender: str
    authority_level: str  # "sovereign" | "agent" | "external"
    # Computed
    is_top_level: bool = False

    @classmethod
    def from_raw(cls, raw: dict) -> "TelegramMessage":
        """Parse from Telegram webhook payload."""
        return cls(
            id=raw["id"],
            text=raw.get("text", ""),
            is_reply=raw.get("is_reply", False),
            reply_to_id=raw.get("reply_to_id"),
            timestamp=raw.get("timestamp", time.time()),
            sender=raw.get("sender", "unknown"),
            authority_level=raw.get("authority_level", "external"),
            is_top_level=not raw.get("is_reply", False),
        )


class TelegramSignalClassifier:
    """
    Maps Telegram message → Telegram motif type.
    Pure classification — no MotifState creation here.
    """

    def classify(self, msg: TelegramMessage) -> str:
        """Classify a Telegram message into a motif type."""
        text = msg.text.lower()
        authority = msg.authority_level

        # Sovereign commands — highest priority
        if authority == "sovereign":
            if any(w in text for w in ["buat", "build", "create", "bina", "generate", "execute", " jalan"]):
                return "command"
            if any(w in text for w in ["fikir", "reflect", "think about", "consider"]):
                return "reflection"
            if any(w in text for w in ["verify", "check", "status", "report"]):
                return "technical"
            return "command"

        # Explicit content markers
        if any(w in text for w in ["?", "apa", "macam mana", "kenapa", "how", "what", "why", "where"]):
            return "question"
        if any(w in text for w in ["fikir", "reflect", "consider", "rasa", "think"]):
            return "reflection"
        if any(w in text for w in ["frust", "bodoh", "stuck", "fail", "tak boleh", "damn", "shit"]):
            return "frustration"
        if any(w in text for w in ["betul", "yes", "setuju", "agree", "ok", "没问题", "okie"]):
            return "agreement"
        if any(w in text for w in ["tak", "no", "salah", "wrong", "tapi", "but", "however"]):
            return "disagreement"
        if any(w in text for w in ["buat", "build", "create", "bina", "forge", "generate", "write code"]):
            return "creative"
        if any(w in text for w in ["code", "script", "debug", "error", "fix", "install", "api", "function"]):
            return "technical"
        if any(w in text for w in ["sedih", "happy", "rindu", "sayang", "takut", "marah", "gembira", "syukur", "sabar"]):
            return "emotional"
        if any(w in text for w in ["rindu", "merantau", "家乡", "home"]):
            return "rindu"
        if any(w in text for w in ["sabar", "patient", "tahan", "tabah"]):
            return "sabar"
        if any(w in text for w in ["syukur", "alhamdulillah", "bersyukur", "thankful"]):
            return "syukur"
        if any(w in text for w in ["redha", "terima", "iklas", "pasrah"]):
            return "redha"
        if any(w in text for w in ["sedih", "duka", "pilu", "grief", "sad"]):
            return "sedih"
        if any(w in text for w in ["harapan", "hope", "hope:", "impian", "dream"]):
            return "hope"
        if any(w in text for w in ["kecewa", "putus asa", "disappointed", "hopeless"]):
            return "grief"
        if any(w in text for w in ["rindu", "longing", "merindui", "miss"]):
            return "longing"
        if any(w in text for w in ["uncertain", "maybe", "perhaps", "tak pasti", "might", "could be"]):
            return "uncertainty"
        if any(w in text for w in ["deliberate", "deliberation", "weigh", "assess", "evaluate"]):
            return "deliberation"

        # Default
        return "question"

    def compute_intensity(self, msg: TelegramMessage, motif_type: str) -> float:
        """
        Compute motif intensity from Telegram message properties.
        Higher = more invested, more signal.
        """
        base = 0.5

        # Authority amplifies
        if msg.authority_level == "sovereign":
            base += 0.25
        elif msg.authority_level == "agent":
            base += 0.1

        # Length amplifies (longer = more invested)
        text_len = len(msg.text)
        if text_len > 500:
            base += 0.15
        elif text_len > 200:
            base += 0.1
        elif text_len > 50:
            base += 0.05

        # Reply chains amplify (engagement)
        if msg.is_reply:
            base += 0.1

        # Top-level messages are more intentional
        if msg.is_top_level:
            base += 0.05

        # Urgency markers
        text_lower = msg.text.lower()
        if any(w in text_lower for w in ["now", "sekarang", "urgent", "asap", "terus", "straight away"]):
            base += 0.15

        # Question marks suggest processing load
        if "?" in msg.text:
            base += 0.05

        return min(1.0, max(0.1, base))

    def get_contradiction_ids(self, motif_type: str) -> list[str]:
        """Get IDs of motifs this type contradicts (Telegram-level)."""
        ids = []
        for pair in TELEGRAM_CONTRADICTION_PAIRS:
            if motif_type in pair:
                other = pair[0] if pair[1] == motif_type else pair[1]
                ids.append(other)
        return ids


# ── Telegram Signal Bridge ────────────────────────────────────────

class TelegramSignalBridge:
    """
    Complete bridge from Telegram message → Paradox Engine motif activation.

    Workflow:
        TelegramMessage
            ↓ classify (TelegramSignalClassifier)
            ↓ compute intensity + vector (TelegramSignalBridge)
            ↓ create MotifState (via A-FORGE registry)
            ↓ feed to ParadoxEngine.tick()

    Usage:
        bridge = TelegramSignalBridge(api)
        for msg in telegram_webhook_payload:
            bridge.observe(msg)
            snapshot = bridge.tick()
            if snapshot.paradox_score > 0.5:
                # paradox detected — gate output
    """

    def __init__(self, api: SomaticStateAPI):
        self.api = api
        self.classifier = TelegramSignalClassifier()
        self._message_log: list[dict] = []

    def observe(self, raw_msg: dict) -> MotifState:
        """
        Process a raw Telegram message and activate the corresponding motif.
        Returns the MotifState that was activated.
        """
        msg = TelegramMessage.from_raw(raw_msg)
        self._message_log.append({
            "id": msg.id,
            "type": "observed",
            "timestamp": msg.timestamp,
        })

        motif_type = self.classifier.classify(msg)
        intensity = self.classifier.compute_intensity(msg, motif_type)
        contradiction_ids = self.classifier.get_contradiction_ids(motif_type)

        # Get 5-dim template
        template_5d = TELEGRAM_MOTIF_TEMPLATES_5D.get(
            motif_type,
            TELEGRAM_MOTIF_TEMPLATES_5D["question"]
        )

        # Expand to 16-dim somatic vector
        somatic_vector = expand_5_to_16(template_5d)

        # Create motif ID
        motif_id = f"tg_{motif_type}_{msg.id}"

        # Create MotifState directly — Telegram motifs are transient,
        # not part of the curated Melayu taxonomy registry
        motif = MotifState(
            id=motif_id,
            label=motif_type,
            intensity=intensity,
            somatic_vector=somatic_vector,
            semantic_embedding=None,
            timestamp=msg.timestamp,
            decay_rate=0.9,  # Telegram messages decay naturally
            contradiction_ids=contradiction_ids,
            complementary_ids=[],
            cultural_origin="telegram",
            description=f"Telegram motif: {motif_type}",
        )

        motif.source = "telegram"
        motif.metadata = {
            "telegram_msg_id": msg.id,
            "authority": msg.authority_level,
            "is_reply": msg.is_reply,
            "is_top_level": msg.is_top_level,
            "template_5d": template_5d,
        }

        # Register in API active motifs (transient, not in registry taxonomy)
        self.api._active_motifs[motif_id] = motif

        return motif

    def tick(self) -> "SomaticSnapshot":
        """
        Advance the Paradox Engine by one tick.
        Returns the current SomaticSnapshot.
        """
        active = list(self.api._active_motifs.values())
        snapshot = self.api.engine.tick(active)
        return snapshot

    def get_active_motifs(self) -> list[MotifState]:
        """Return currently alive motifs."""
        return [m for m in self.api._active_motifs.values() if m.is_alive()]

    def check_output(self, output_text: str) -> list[dict]:
        """
        Gate an output candidate against active paradoxes.
        Returns flags for any paradox that would be resolved.
        """
        return self.api.engine.check_output_resolution(
            output_text,
            self.get_active_motifs()
        )

    @property
    def engine(self) -> ParadoxEngine:
        return self.api.engine

    @property
    def paradox_score(self) -> float:
        return self.api.engine.get_paradox_score()

    @property
    def active_paradox_count(self) -> int:
        return self.api.engine.get_active_paradox_count()
