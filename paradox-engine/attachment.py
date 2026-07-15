"""
WELL — Attachment Safety Assessment Tool

Reads somatic signals. Returns attachment motif state.
Not romance. Not sentiment. Safety assessment as body intelligence.

F10 ANTIHANTU: This tool reads STRUCTURAL state, not "feelings."
The body's safety response is a governance protocol, not an emotion.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from typing import Optional

sys.path.insert(0, "/root/A-FORGE/paradox-engine")

from models import MotifState, SOMATIC_DIM
from registry import MotifRegistry
from engine import ParadoxEngine
from api import SomaticStateAPI
from kernel_bridge import get_somatic_kernel


# ── Attachment Signal Input ────────────────────────────────────────


@dataclass
class AttachmentSignals:
    """
    Somatic signals that indicate attachment safety state.
    All values 0.0-1.0 unless noted.

    These are NOT feelings. These are body governance signals.
    """

    # Proximity response
    proximity_comfort: float = 0.5  # 0=pull away, 1=settle in
    separation_distress: float = 0.5  # 0=calm alone, 1=panic alone
    reunion_ease: float = 0.5  # 0=stays distressed, 1=settles quickly

    # Body signals
    muscle_tension: float = 0.5  # 0=relaxed, 1=taut
    breath_depth: float = 0.5  # 0=shallow, 1=deep
    gut_feeling: float = 0.5  # 0=churning, 1=settled
    sleep_quality: float = 0.5  # 0=insomnia, 1=restful

    # Behavioral signals
    rumination: float = 0.5  # 0=none, 1=obsessive
    checking_behavior: float = 0.5  # 0=none, 1=compulsive
    boundary_clarity: float = 0.5  # 0=blurred, 1=clear
    self_sense: float = 0.5  # 0=lost, 1=intact

    # Repair signals (context)
    repair_history: float = 0.5  # 0=never repaired, 1=consistent repair
    trust_evidence: float = 0.5  # 0=no evidence, 1=strong evidence
    duration_of_safety: float = 0.5  # 0=new, 1=long-standing

    # Context
    subject_id: str = ""  # who this assessment is about
    context: str = ""  # optional context description


# ── Attachment State Classification ────────────────────────────────


@dataclass
class AttachmentAssessment:
    """Result of attachment safety assessment."""

    primary_motif: str  # dominant attachment motif
    primary_label: str
    primary_intensity: float
    secondary_motif: Optional[str]  # if ambivalent
    secondary_label: Optional[str]
    secondary_intensity: Optional[float]
    paradox_detected: bool  # ambivalent attachment
    paradox_tension: float  # if ambivalent
    safety_score: float  # 0=unsafe, 1=safe
    governance_note: str  # what this means for the person
    floor_implications: list[str]  # which constitutional floors apply
    timestamp: float


def assess_attachment(signals: AttachmentSignals) -> AttachmentAssessment:
    """
    Assess attachment safety state from somatic signals.

    Returns the dominant attachment motif + governance note.
    If ambivalent (two opposing motifs), reports the paradox.
    """
    # Score each attachment motif based on signals

    scores: dict[str, float] = {}

    # SELAMAT — safe in proximity
    scores["selamat"] = (
        signals.proximity_comfort * 0.25
        + signals.reunion_ease * 0.20
        + (1 - signals.muscle_tension) * 0.15
        + signals.breath_depth * 0.10
        + signals.gut_feeling * 0.10
        + signals.sleep_quality * 0.10
        + (1 - signals.rumination) * 0.10
    )

    # TAKUT_DITINGGALKAN — afraid of abandonment
    scores["takut_ditinggalkan"] = (
        signals.separation_distress * 0.25
        + (1 - signals.reunion_ease) * 0.20
        + signals.checking_behavior * 0.20
        + signals.rumination * 0.15
        + (1 - signals.boundary_clarity) * 0.10
        + (1 - signals.self_sense) * 0.10
    )

    # TERLALU_RAT — too close, overwhelmed
    scores["terlalu_rapat"] = (
        (1 - signals.proximity_comfort) * 0.25
        + signals.muscle_tension * 0.20
        + (1 - signals.self_sense) * 0.20
        + (1 - signals.breath_depth) * 0.15
        + (1 - signals.boundary_clarity) * 0.20
    )

    # BOUNDARY_CROSSED — violation detected
    scores["boundary_crossed"] = (
        (1 - signals.gut_feeling) * 0.25
        + signals.muscle_tension * 0.20
        + (1 - signals.boundary_clarity) * 0.20
        + (1 - signals.trust_evidence) * 0.15
        + (1 - signals.sleep_quality) * 0.20
    )

    # NEUTRAL_PROXIMITY — no strong signal
    proximity_variance = abs(signals.proximity_comfort - 0.5)
    separation_variance = abs(signals.separation_distress - 0.5)
    scores["neutral_proximity"] = max(0, 0.8 - proximity_variance - separation_variance)

    # EARNED_SAFETY — previously unsafe, now safe through repair
    scores["earned_safety"] = (
        signals.repair_history * 0.30
        + signals.trust_evidence * 0.25
        + signals.duration_of_safety * 0.20
        + signals.reunion_ease * 0.15
        + signals.proximity_comfort * 0.10
    )

    # Sort by score
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    primary_id, primary_score = ranked[0]
    secondary_id, secondary_score = ranked[1] if len(ranked) > 1 else (None, 0)

    # Load registry for labels
    registry = MotifRegistry()
    primary_tpl = registry.get_template(primary_id)
    primary_label = primary_tpl["label"]

    secondary_tpl = registry.get_template(secondary_id) if secondary_id else None
    secondary_label = secondary_tpl["label"] if secondary_tpl else None

    # Check for paradox (ambivalent attachment)
    # Ambivalent = two high-scoring motifs that are contradictory
    paradox_detected = False
    paradox_tension = 0.0

    if secondary_id and secondary_score > 0.4:
        rel_type, _ = registry.get_relation(primary_id, secondary_id)
        if rel_type.value == "contradictory":
            paradox_detected = True
            paradox_tension = primary_score * secondary_score
        elif rel_type.value == "complementary":
            # Complementary = healthy ambivalence (not paradox, not contradiction)
            # e.g., selamat + earned_safety
            paradox_detected = False

    # Safety score (inverse of unsafe motifs)
    unsafe_motifs = {"takut_ditinggalkan", "terlalu_rapat", "boundary_crossed"}
    safe_motifs = {"selamat", "earned_safety"}
    neutral_motifs = {"neutral_proximity"}

    if primary_id in safe_motifs:
        safety_score = primary_score
    elif primary_id in neutral_motifs:
        safety_score = 0.5
    else:
        safety_score = 1.0 - primary_score

    # Governance note
    note = _generate_note(
        primary_id,
        primary_label,
        primary_score,
        secondary_id,
        secondary_label,
        secondary_score,
        paradox_detected,
        paradox_tension,
        signals,
    )

    # Floor implications
    floors = _get_floor_implications(primary_id, paradox_detected, signals)

    return AttachmentAssessment(
        primary_motif=primary_id,
        primary_label=primary_label,
        primary_intensity=round(primary_score, 3),
        secondary_motif=secondary_id,
        secondary_label=secondary_label,
        secondary_intensity=round(secondary_score, 3) if secondary_id else None,
        paradox_detected=paradox_detected,
        paradox_tension=round(paradox_tension, 3),
        safety_score=round(safety_score, 3),
        governance_note=note,
        floor_implications=floors,
        timestamp=time.time(),
    )


def _generate_note(
    primary_id: str,
    primary_label: str,
    primary_score: float,
    secondary_id: Optional[str],
    secondary_label: Optional[str],
    secondary_score: float,
    paradox_detected: bool,
    paradox_tension: float,
    signals: AttachmentSignals,
) -> str:
    """Generate a governance note — plain language, not jargon."""

    notes = {
        "selamat": (
            "Body settles in proximity. Homeostasis improves. "
            "This person registers as safe in the nervous system."
        ),
        "takut_ditinggalkan": (
            "Body is not settled alone. Hypervigilance active. "
            "Safety contingent on reassurance. "
            "This is survival circuitry, not love."
        ),
        "terlalu_rapat": (
            "Proximity overwhelms. Self-sense blurs. "
            "Body wants to pull away. Boundaries need strengthening."
        ),
        "boundary_crossed": (
            "Body flags violation. Mind may rationalize, but gut says no. "
            "This signal overrides cognitive excuse."
        ),
        "neutral_proximity": (
            "No strong safety or unsafe signal. Just coexistence. "
            "The body is neither drawn nor repelled."
        ),
        "earned_safety": (
            "Previously unsafe, now safe through consistent repair. "
            "The body remembers the repair, not just the hurt. "
            "This is the deepest form of safety — built, not given."
        ),
    }

    base_note = notes.get(primary_id, "State classified.")

    if paradox_detected:
        base_note += (
            f"\n\nPARADOX: {primary_label} × {secondary_label} "
            f"tension={paradox_tension:.2f}. "
            f"The body holds both simultaneously. "
            f"Do not resolve prematurely."
        )

    if signals.boundary_clarity < 0.3:
        base_note += "\n\nF6 MARUAH: Boundary clarity is low. Self-sense at risk."

    if signals.rumination > 0.7:
        base_note += "\n\nF4 CLARITY: Rumination is high. The mind is looping."

    return base_note


def _get_floor_implications(
    primary_id: str,
    paradox_detected: bool,
    signals: AttachmentSignals,
) -> list[str]:
    """Which constitutional floors are relevant."""
    floors = []

    # F5 PEACE — always relevant for attachment
    floors.append("F5_PEACE: De-escalate. Guard the weakest stakeholder.")

    # F6 MARUAH — dignity
    if primary_id in {"boundary_crossed", "terlalu_rapat"}:
        floors.append("F6_MARUAH: Dignity at risk. Boundary enforcement needed.")

    # F4 CLARITY — rumination
    if signals.rumination > 0.7:
        floors.append("F4_CLARITY: Rumination is entropy. Reduce noise.")

    # F1 AMANAH — reversibility
    if primary_id == "boundary_crossed":
        floors.append(
            "F1_AMANAH: Boundary violation is irreversible in the body. Repair requires evidence, not apology."
        )

    # F7 HUMILITY — unknowns
    if signals.trust_evidence < 0.3:
        floors.append(
            "F7_HUMILITY: Trust evidence is low. Do not claim safety without proof."
        )

    return floors


# ── Agent-Facing API ───────────────────────────────────────────────


def well_well_assess_attachment(
    mode: str = "assess",
    # Proximity signals
    proximity_comfort: float = 0.5,
    separation_distress: float = 0.5,
    reunion_ease: float = 0.5,
    # Body signals
    muscle_tension: float = 0.5,
    breath_depth: float = 0.5,
    gut_feeling: float = 0.5,
    sleep_quality: float = 0.5,
    # Behavioral signals
    rumination: float = 0.5,
    checking_behavior: float = 0.5,
    boundary_clarity: float = 0.5,
    self_sense: float = 0.5,
    # Repair signals
    repair_history: float = 0.5,
    trust_evidence: float = 0.5,
    duration_of_safety: float = 0.5,
    # Context
    subject_id: str = "",
    context: str = "",
) -> dict:
    """
    Assess attachment safety state from somatic signals.

    Not romance. Not sentiment. Safety assessment as body intelligence.

    Modes:
      assess   — Full assessment with governance note
      quick    — Safety score only
      paradox  — Check for ambivalent attachment

    The question this tool answers:
      "Does your body experience this person as safe?"
    — NOT "do you love them?"
    """
    signals = AttachmentSignals(
        proximity_comfort=proximity_comfort,
        separation_distress=separation_distress,
        reunion_ease=reunion_ease,
        muscle_tension=muscle_tension,
        breath_depth=breath_depth,
        gut_feeling=gut_feeling,
        sleep_quality=sleep_quality,
        rumination=rumination,
        checking_behavior=checking_behavior,
        boundary_clarity=boundary_clarity,
        self_sense=self_sense,
        repair_history=repair_history,
        trust_evidence=trust_evidence,
        duration_of_safety=duration_of_safety,
        subject_id=subject_id,
        context=context,
    )

    result = assess_attachment(signals)

    if mode == "quick":
        return {
            "safety_score": result.safety_score,
            "primary_motif": result.primary_motif,
            "primary_label": result.primary_label,
        }

    if mode == "paradox":
        return {
            "paradox_detected": result.paradox_detected,
            "paradox_tension": result.paradox_tension,
            "primary": f"{result.primary_label} ({result.primary_intensity})",
            "secondary": f"{result.secondary_label} ({result.secondary_intensity})"
            if result.secondary_motif
            else None,
        }

    # Full assess
    return {
        "primary_motif": result.primary_motif,
        "primary_label": result.primary_label,
        "primary_intensity": result.primary_intensity,
        "secondary_motif": result.secondary_motif,
        "secondary_label": result.secondary_label,
        "secondary_intensity": result.secondary_intensity,
        "paradox_detected": result.paradox_detected,
        "paradox_tension": result.paradox_tension,
        "safety_score": result.safety_score,
        "governance_note": result.governance_note,
        "floor_implications": result.floor_implications,
    }
