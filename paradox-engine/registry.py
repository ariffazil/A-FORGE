"""
Paradox Engine — Motif Registry
Melayu / Minang somatic taxonomy.

This is NOT a sentiment dictionary. Each motif carries:
- somatic_vector: 16-dim body-feel features
- cultural contradiction rules (Melayu-specific)
- complementary pairs (things that coexist in Melayu somatic space)

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from models import (
    MotifState,
    SOMATIC_DIM,
    SOMATIC_LABELS,
    ContradictionType,
    CONTRADICTION_THRESHOLD,
)


# ── Somatic Feature Shorthand ───────────────────────────────────────
# Build vectors by name for readability.
# Index: val, aro, ten, dep, dur, den, war, wgt, dir, sta, spr, cul, paf, brt, sil, emg


def S(
    valence=0.0,
    arousal=0.5,
    tension=0.5,
    depth=0.5,
    duration_feel=0.5,
    density=0.5,
    warmth=0.5,
    weight=0.5,
    direction=0.5,
    stability=0.5,
    spiritual=0.0,
    cultural_weight=0.0,
    paradox_affinity=0.5,
    breath=0.5,
    silence=0.5,
    emergence=0.0,
) -> np.ndarray:
    """Build a somatic vector from named parameters."""
    return np.array(
        [
            valence,
            arousal,
            tension,
            depth,
            duration_feel,
            density,
            warmth,
            weight,
            direction,
            stability,
            spiritual,
            cultural_weight,
            paradox_affinity,
            breath,
            silence,
            emergence,
        ],
        dtype=np.float64,
    )


# ── MELAYU / MINANG MOTIF TAXONOMY ─────────────────────────────────
# 25 motifs. Each is a template — actual MotifState instances are
# created from these via MotifRegistry.activate().

MOTIF_TAXONOMY: dict[str, dict] = {
    # ── Core Somatic States ──────────────────────────────────────
    "rindu": {
        "label": "Rindu",
        "description": "Longing that carries love. Not Western missing — it is ache "
        "you hold with warmth. You carry the absent one in your body.",
        "somatic": S(
            valence=-0.2,
            arousal=0.4,
            tension=0.3,
            depth=0.9,
            duration_feel=0.9,
            density=0.6,
            warmth=0.8,
            weight=0.7,
            direction=0.8,
            stability=0.6,
            spiritual=0.5,
            cultural_weight=0.9,
            paradox_affinity=0.8,
            breath=0.4,
            silence=0.7,
            emergence=0.3,
        ),
        "decay_rate": 0.02,
        "contradicts": ["puas", "gembira"],
        "complementary": ["sedih", "redha", "syukur"],
        "cultural_origin": "malay",
    },
    "sedih": {
        "label": "Sedih",
        "description": "Grief with depth and weight. Not clinical sadness — "
        "it is the body absorbing loss. Heavy, quiet, profound.",
        "somatic": S(
            valence=-0.7,
            arousal=0.3,
            tension=0.4,
            depth=0.9,
            duration_feel=0.8,
            density=0.7,
            warmth=0.2,
            weight=0.9,
            direction=0.3,
            stability=0.4,
            spiritual=0.6,
            cultural_weight=0.7,
            paradox_affinity=0.9,
            breath=0.3,
            silence=0.8,
            emergence=0.2,
        ),
        "decay_rate": 0.01,
        "contradicts": ["gembira"],
        "complementary": ["syukur", "redha", "rindu", "pasrah"],
        "cultural_origin": "malay",
    },
    "syukur": {
        "label": "Syukur",
        "description": "Gratitude that accepts both gift and loss. In Melayu somatic "
        "space, syukur and sedih are NOT opposed — they coexist. "
        "You can be grateful and grieving simultaneously.",
        "somatic": S(
            valence=0.6,
            arousal=0.3,
            tension=0.1,
            depth=0.8,
            duration_feel=0.7,
            density=0.4,
            warmth=0.8,
            weight=0.5,
            direction=0.7,
            stability=0.9,
            spiritual=0.9,
            cultural_weight=0.9,
            paradox_affinity=0.7,
            breath=0.7,
            silence=0.6,
            emergence=0.2,
        ),
        "decay_rate": 0.01,
        "contradicts": ["putus_asa"],
        "complementary": ["sedih", "redha", "pasrah", "harap"],
        "cultural_origin": "malay",
    },
    "redha": {
        "label": "Redha",
        "description": "Acceptance with spiritual surrender. Not passive — it is active "
        "alignment with divine will. The body releases resistance.",
        "somatic": S(
            valence=0.3,
            arousal=0.2,
            tension=0.0,
            depth=0.95,
            duration_feel=0.9,
            density=0.3,
            warmth=0.6,
            weight=0.4,
            direction=0.2,
            stability=0.95,
            spiritual=0.95,
            cultural_weight=0.9,
            paradox_affinity=0.6,
            breath=0.8,
            silence=0.9,
            emergence=0.1,
        ),
        "decay_rate": 0.005,
        "contradicts": ["gelisah", "marah"],
        "complementary": ["pasrah", "syukur", "sedih", "sabar"],
        "cultural_origin": "malay",
    },
    "marah": {
        "label": "Marah",
        "description": "Anger with direction and purpose. In Melayu context, marah "
        "can hold love — a parent's anger IS love. Outward, hot, taut.",
        "somatic": S(
            valence=-0.6,
            arousal=0.95,
            tension=0.9,
            depth=0.5,
            duration_feel=0.3,
            density=0.8,
            warmth=0.7,
            weight=0.7,
            direction=0.95,
            stability=0.2,
            spiritual=0.1,
            cultural_weight=0.6,
            paradox_affinity=0.7,
            breath=0.2,
            silence=0.1,
            emergence=0.4,
        ),
        "decay_rate": 0.05,
        "contradicts": ["sabar", "redha"],
        "complementary": ["sayang", "malu"],
        "cultural_origin": "malay",
    },
    "malu": {
        "label": "Malu",
        "description": "Shame that is social membrane, not pathology. In Melayu culture, "
        "malu is a guard of dignity — it tells you when you've crossed "
        "a boundary. Inward, quiet, heavy.",
        "somatic": S(
            valence=-0.5,
            arousal=0.4,
            tension=0.7,
            depth=0.7,
            duration_feel=0.6,
            density=0.6,
            warmth=0.2,
            weight=0.8,
            direction=0.1,
            stability=0.3,
            spiritual=0.4,
            cultural_weight=0.95,
            paradox_affinity=0.6,
            breath=0.3,
            silence=0.7,
            emergence=0.2,
        ),
        "decay_rate": 0.03,
        "contradicts": ["bangga", "gembira"],
        "complementary": ["marah", "takut"],
        "cultural_origin": "malay",
    },
    "sabar": {
        "label": "Sabar",
        "description": "Patience that is active, not passive. The body holds tension "
        "without releasing. Breathing slows. Muscles sustain. "
        "It is strength, not weakness.",
        "somatic": S(
            valence=0.1,
            arousal=0.3,
            tension=0.5,
            depth=0.7,
            duration_feel=0.9,
            density=0.4,
            warmth=0.5,
            weight=0.6,
            direction=0.2,
            stability=0.85,
            spiritual=0.7,
            cultural_weight=0.8,
            paradox_affinity=0.8,
            breath=0.6,
            silence=0.7,
            emergence=0.1,
        ),
        "decay_rate": 0.01,
        "contradicts": ["marah", "gelisah"],
        "complementary": ["redha", "pasrah", "harap"],
        "cultural_origin": "malay",
    },
    "harap": {
        "label": "Harap",
        "description": "Hope that is gentle, not desperate. Forward-looking but "
        "grounded. The body leans slightly forward, chest open.",
        "somatic": S(
            valence=0.6,
            arousal=0.5,
            tension=0.3,
            depth=0.6,
            duration_feel=0.6,
            density=0.4,
            warmth=0.7,
            weight=0.3,
            direction=0.8,
            stability=0.6,
            spiritual=0.5,
            cultural_weight=0.6,
            paradox_affinity=0.5,
            breath=0.7,
            silence=0.4,
            emergence=0.6,
        ),
        "decay_rate": 0.03,
        "contradicts": ["putus_asa"],
        "complementary": ["syukur", "sabar", "rindu"],
        "cultural_origin": "malay",
    },
    "pasrah": {
        "label": "Pasrah",
        "description": "Surrender to divine will. Deeper than redha — it is letting go "
        "of the need to control outcome. The body releases. Breath deepens.",
        "somatic": S(
            valence=0.2,
            arousal=0.15,
            tension=0.0,
            depth=0.95,
            duration_feel=0.95,
            density=0.2,
            warmth=0.5,
            weight=0.3,
            direction=0.1,
            stability=0.95,
            spiritual=0.95,
            cultural_weight=0.9,
            paradox_affinity=0.5,
            breath=0.9,
            silence=0.95,
            emergence=0.1,
        ),
        "decay_rate": 0.005,
        "contradicts": ["gelisah", "marah"],
        "complementary": ["redha", "syukur", "sabar"],
        "cultural_origin": "malay",
    },
    "takut": {
        "label": "Takut",
        "description": "Fear that contracts the body. Muscles tighten, breath shallows, "
        "attention narrows. The world becomes threat.",
        "somatic": S(
            valence=-0.7,
            arousal=0.85,
            tension=0.85,
            depth=0.5,
            duration_feel=0.3,
            density=0.7,
            warmth=0.1,
            weight=0.7,
            direction=0.1,
            stability=0.15,
            spiritual=0.2,
            cultural_weight=0.4,
            paradox_affinity=0.4,
            breath=0.2,
            silence=0.3,
            emergence=0.3,
        ),
        "decay_rate": 0.04,
        "contradicts": ["bangga"],
        "complementary": ["malu", "berani"],
        "cultural_origin": "universal",
    },
    "bangga": {
        "label": "Bangga",
        "description": "Pride with cultural weight. In Minang context, bangga is tied "
        "to adat — pride in lineage, craft, dignity. Chest lifts.",
        "somatic": S(
            valence=0.7,
            arousal=0.7,
            tension=0.3,
            depth=0.5,
            duration_feel=0.5,
            density=0.5,
            warmth=0.7,
            weight=0.4,
            direction=0.9,
            stability=0.7,
            spiritual=0.3,
            cultural_weight=0.8,
            paradox_affinity=0.4,
            breath=0.7,
            silence=0.3,
            emergence=0.4,
        ),
        "decay_rate": 0.04,
        "contradicts": ["malu", "sedih"],
        "complementary": ["gembira"],
        "cultural_origin": "malay",
    },
    "gembira": {
        "label": "Gembira",
        "description": "Joy that is social, warm, outward. Laughter, lightness, "
        "the body opens. Not ecstatic — just genuinely glad.",
        "somatic": S(
            valence=0.85,
            arousal=0.7,
            tension=0.1,
            depth=0.4,
            duration_feel=0.3,
            density=0.3,
            warmth=0.9,
            weight=0.2,
            direction=0.9,
            stability=0.6,
            spiritual=0.2,
            cultural_weight=0.4,
            paradox_affinity=0.3,
            breath=0.8,
            silence=0.1,
            emergence=0.5,
        ),
        "decay_rate": 0.05,
        "contradicts": ["sedih", "rindu", "malu"],
        "complementary": ["bangga", "syukur"],
        "cultural_origin": "universal",
    },
    "gelisah": {
        "label": "Gelisah",
        "description": "Restlessness without clear cause. The body can't settle. "
        "Fidgeting, shallow breath, scattered attention.",
        "somatic": S(
            valence=-0.4,
            arousal=0.8,
            tension=0.75,
            depth=0.3,
            duration_feel=0.4,
            density=0.5,
            warmth=0.3,
            weight=0.4,
            direction=0.6,
            stability=0.15,
            spiritual=0.1,
            cultural_weight=0.5,
            paradox_affinity=0.3,
            breath=0.3,
            silence=0.2,
            emergence=0.5,
        ),
        "decay_rate": 0.04,
        "contradicts": ["redha", "sabar", "pasrah"],
        "complementary": ["takut"],
        "cultural_origin": "malay",
    },
    "putus_asa": {
        "label": "Putus Asa",
        "description": "Despair — the severing of hope. The body collapses inward. "
        "Shoulders drop, gaze falls, breath becomes shallow.",
        "somatic": S(
            valence=-0.9,
            arousal=0.2,
            tension=0.3,
            depth=0.8,
            duration_feel=0.7,
            density=0.8,
            warmth=0.1,
            weight=0.95,
            direction=0.05,
            stability=0.1,
            spiritual=0.3,
            cultural_weight=0.5,
            paradox_affinity=0.7,
            breath=0.2,
            silence=0.8,
            emergence=0.1,
        ),
        "decay_rate": 0.01,
        "contradicts": ["harap", "syukur", "bangga"],
        "complementary": ["sedih"],
        "cultural_origin": "malay",
    },
    "sayang": {
        "label": "Sayang",
        "description": "Love-tenderness. Not romantic love alone — it is the warmth "
        "you feel for someone you would protect. Chest softens.",
        "somatic": S(
            valence=0.8,
            arousal=0.4,
            tension=0.1,
            depth=0.8,
            duration_feel=0.8,
            density=0.5,
            warmth=0.95,
            weight=0.4,
            direction=0.7,
            stability=0.8,
            spiritual=0.5,
            cultural_weight=0.7,
            paradox_affinity=0.6,
            breath=0.8,
            silence=0.5,
            emergence=0.3,
        ),
        "decay_rate": 0.01,
        "contradicts": ["benci"],
        "complementary": ["rindu", "harap", "syukur"],
        "cultural_origin": "malay",
    },
    "benci": {
        "label": "Benci",
        "description": "Hatred that repels. The body contracts away. Jaw tightens, "
        "fists may clench. Active rejection.",
        "somatic": S(
            valence=-0.9,
            arousal=0.85,
            tension=0.9,
            depth=0.5,
            duration_feel=0.5,
            density=0.8,
            warmth=0.0,
            weight=0.8,
            direction=0.1,
            stability=0.3,
            spiritual=0.0,
            cultural_weight=0.3,
            paradox_affinity=0.5,
            breath=0.2,
            silence=0.1,
            emergence=0.2,
        ),
        "decay_rate": 0.03,
        "contradicts": ["sayang", "syukur"],
        "complementary": ["marah"],
        "cultural_origin": "universal",
    },
    "berani": {
        "label": "Berani",
        "description": "Courage that expands the body. Chest opens, breath deepens, "
        "stance widens. Not absence of fear — acting despite it.",
        "somatic": S(
            valence=0.5,
            arousal=0.8,
            tension=0.4,
            depth=0.6,
            duration_feel=0.4,
            density=0.5,
            warmth=0.6,
            weight=0.5,
            direction=0.95,
            stability=0.7,
            spiritual=0.4,
            cultural_weight=0.6,
            paradox_affinity=0.7,
            breath=0.8,
            silence=0.2,
            emergence=0.6,
        ),
        "decay_rate": 0.04,
        "contradicts": ["putus_asa"],
        "complementary": ["bangga", "harap", "takut"],
        "cultural_origin": "universal",
    },
    # ── Minang-Specific ──────────────────────────────────────────
    "merantau_rindu": {
        "label": "Merantau Rindu",
        "description": "The specific longing of Minangkabau diaspora — leaving the "
        "rumah gadang, carrying adat in the body while being elsewhere. "
        "Not just missing home — it is the body knowing it is not where "
        "it should be.",
        "somatic": S(
            valence=-0.3,
            arousal=0.4,
            tension=0.5,
            depth=0.95,
            duration_feel=0.95,
            density=0.7,
            warmth=0.6,
            weight=0.8,
            direction=0.7,
            stability=0.5,
            spiritual=0.7,
            cultural_weight=0.95,
            paradox_affinity=0.9,
            breath=0.4,
            silence=0.7,
            emergence=0.3,
        ),
        "decay_rate": 0.005,
        "contradicts": ["puas"],
        "complementary": ["rindu", "bangga", "sedih", "harap"],
        "cultural_origin": "minang",
    },
    "luluh": {
        "label": "Luluh",
        "description": "Dissolving — when resistance melts. Not surrender (pasrah) — "
        "it is the moment before surrender, when the body softens "
        "against its will. Like ice becoming water.",
        "somatic": S(
            valence=0.1,
            arousal=0.3,
            tension=0.2,
            depth=0.8,
            duration_feel=0.4,
            density=0.3,
            warmth=0.7,
            weight=0.2,
            direction=0.3,
            stability=0.4,
            spiritual=0.6,
            cultural_weight=0.8,
            paradox_affinity=0.8,
            breath=0.7,
            silence=0.6,
            emergence=0.7,
        ),
        "decay_rate": 0.03,
        "contradicts": ["marah", "takut"],
        "complementary": ["redha", "sayang", "rindu"],
        "cultural_origin": "minang",
    },
    "puas": {
        "label": "Puas",
        "description": "Satisfaction / completion. The body settles. Breath completes. "
        "The cycle finishes. In Melayu space, puas is rare — most "
        "somatic states are partial, held, unresolved.",
        "somatic": S(
            valence=0.7,
            arousal=0.2,
            tension=0.0,
            depth=0.4,
            duration_feel=0.3,
            density=0.2,
            warmth=0.6,
            weight=0.2,
            direction=0.3,
            stability=0.9,
            spiritual=0.3,
            cultural_weight=0.3,
            paradox_affinity=0.1,
            breath=0.9,
            silence=0.7,
            emergence=0.0,
        ),
        "decay_rate": 0.05,
        "contradicts": ["rindu", "merantau_rindu", "gelisah"],
        "complementary": ["syukur", "gembira"],
        "cultural_origin": "universal",
    },
    "hiba": {
        "label": "Hiba",
        "description": "Being deeply moved — tears that come not from grief but from "
        "beauty, truth, or recognition. The body opens and releases "
        "simultaneously. Chest aches with something unnamed.",
        "somatic": S(
            valence=0.3,
            arousal=0.5,
            tension=0.4,
            depth=0.9,
            duration_feel=0.4,
            density=0.6,
            warmth=0.8,
            weight=0.5,
            direction=0.5,
            stability=0.5,
            spiritual=0.7,
            cultural_weight=0.8,
            paradox_affinity=0.9,
            breath=0.5,
            silence=0.5,
            emergence=0.8,
        ),
        "decay_rate": 0.03,
        "contradicts": ["benci", "putus_asa"],
        "complementary": ["sedih", "syukur", "sayang", "rindu"],
        "cultural_origin": "malay",
    },
    "geram": {
        "label": "Geram",
        "description": "Fierce tenderness — the urge to protect with intensity. "
        "A mother's geram at her child. Jaw clenches but chest warms. "
        "It IS anger and love simultaneously.",
        "somatic": S(
            valence=0.2,
            arousal=0.8,
            tension=0.7,
            depth=0.6,
            duration_feel=0.3,
            density=0.7,
            warmth=0.8,
            weight=0.6,
            direction=0.9,
            stability=0.4,
            spiritual=0.2,
            cultural_weight=0.85,
            paradox_affinity=0.9,
            breath=0.4,
            silence=0.2,
            emergence=0.5,
        ),
        "decay_rate": 0.04,
        "contradicts": ["pasrah", "puas"],
        "complementary": ["sayang", "marah", "bangga"],
        "cultural_origin": "malay",
    },
    "sebak": {
        "label": "Sebak",
        "description": "Throat-tightening emotion — the moment before tears. "
        "Speech catches. Breath hitches. The body wants to release "
        "but hasn't yet. Held at the threshold.",
        "somatic": S(
            valence=-0.1,
            arousal=0.6,
            tension=0.8,
            depth=0.7,
            duration_feel=0.2,
            density=0.6,
            warmth=0.5,
            weight=0.6,
            direction=0.4,
            stability=0.3,
            spiritual=0.4,
            cultural_weight=0.7,
            paradox_affinity=0.8,
            breath=0.3,
            silence=0.4,
            emergence=0.7,
        ),
        "decay_rate": 0.06,
        "contradicts": ["puas", "gembira"],
        "complementary": ["hiba", "sedih", "rindu", "syukur"],
        "cultural_origin": "malay",
    },
    "resah": {
        "label": "Resah",
        "description": "Deeper than gelisah — existential unease. The body doesn't "
        "know what's wrong but knows something is. Sleep doesn't help. "
        "Food doesn't taste. Something is off.",
        "somatic": S(
            valence=-0.5,
            arousal=0.6,
            tension=0.7,
            depth=0.7,
            duration_feel=0.7,
            density=0.6,
            warmth=0.3,
            weight=0.6,
            direction=0.3,
            stability=0.2,
            spiritual=0.4,
            cultural_weight=0.6,
            paradox_affinity=0.6,
            breath=0.4,
            silence=0.5,
            emergence=0.4,
        ),
        "decay_rate": 0.02,
        "contradicts": ["redha", "puas", "pasrah"],
        "complementary": ["gelisah", "takut", "rindu"],
        "cultural_origin": "malay",
    },
    # ── Attachment Safety Family ─────────────────────────────────
    # These motifs represent the somatic governance of human proximity.
    # Not romance. Not sentiment. Safety assessment as body intelligence.
    # Source: attachment theory (Bowlby) + Malay somatic context (Arif, 2026).
    "selamat": {
        "label": "Selamat",
        "description": "The nervous system settles in proximity. Baseline homeostasis "
        "improves. Muscles relax. Breath deepens. The body says: "
        "'My existence stabilizes when you are near.'",
        "somatic": S(
            valence=0.7,
            arousal=0.2,
            tension=0.0,
            depth=0.8,
            duration_feel=0.8,
            density=0.3,
            warmth=0.9,
            weight=0.3,
            direction=0.3,
            stability=0.95,
            spiritual=0.5,
            cultural_weight=0.7,
            paradox_affinity=0.4,
            breath=0.9,
            silence=0.6,
            emergence=0.2,
        ),
        "decay_rate": 0.01,
        "contradicts": ["takut_ditinggalkan", "boundary_crossed"],
        "complementary": ["earned_safety", "sayang", "redha"],
        "cultural_origin": "universal",
    },
    "takut_ditinggalkan": {
        "label": "Takut Ditinggalkan",
        "description": "Hypervigilance. Clinging. Rumination. Safety contingent on "
        "reassurance. The body cannot settle alone. Checking phone. "
        "Scanning for signs of withdrawal. Not love — survival circuitry.",
        "somatic": S(
            valence=-0.6,
            arousal=0.85,
            tension=0.8,
            depth=0.6,
            duration_feel=0.7,
            density=0.8,
            warmth=0.3,
            weight=0.7,
            direction=0.1,
            stability=0.15,
            spiritual=0.2,
            cultural_weight=0.5,
            paradox_affinity=0.7,
            breath=0.3,
            silence=0.2,
            emergence=0.4,
        ),
        "decay_rate": 0.02,
        "contradicts": ["selamat", "earned_safety", "puas"],
        "complementary": ["rindu", "gelisah", "resah"],
        "cultural_origin": "universal",
    },
    "terlalu_rapat": {
        "label": "Terlalu Rapat",
        "description": "Overwhelm. Loss of self-sense. Proximity feels like intrusion. "
        "The body wants to pull away. Boundaries blur. "
        "Not rejection — self-preservation.",
        "somatic": S(
            valence=-0.4,
            arousal=0.8,
            tension=0.85,
            depth=0.5,
            duration_feel=0.4,
            density=0.9,
            warmth=0.2,
            weight=0.8,
            direction=0.05,
            stability=0.2,
            spiritual=0.1,
            cultural_weight=0.5,
            paradox_affinity=0.6,
            breath=0.2,
            silence=0.1,
            emergence=0.3,
        ),
        "decay_rate": 0.03,
        "contradicts": ["rindu", "sayang"],
        "complementary": ["takut", "malu"],
        "cultural_origin": "universal",
    },
    "boundary_crossed": {
        "label": "Boundary Crossed",
        "description": "Clear violation. The body flags 'this is not safe' even if the "
        "mind rationalizes. Jaw tightens. Gut churns. "
        "The somatic alarm that overrides cognitive excuse.",
        "somatic": S(
            valence=-0.8,
            arousal=0.9,
            tension=0.95,
            depth=0.7,
            duration_feel=0.5,
            density=0.8,
            warmth=0.0,
            weight=0.9,
            direction=0.1,
            stability=0.1,
            spiritual=0.3,
            cultural_weight=0.6,
            paradox_affinity=0.5,
            breath=0.2,
            silence=0.1,
            emergence=0.3,
        ),
        "decay_rate": 0.01,
        "contradicts": ["selamat", "sayang", "redha"],
        "complementary": ["marah", "takut", "malu"],
        "cultural_origin": "universal",
    },
    "neutral_proximity": {
        "label": "Neutral Proximity",
        "description": "No strong safety or unsafe signal. Just coexistence. "
        "The body is neither drawn nor repelled. "
        "Presence without charge. Not indifference — neutrality.",
        "somatic": S(
            valence=0.0,
            arousal=0.15,
            tension=0.0,
            depth=0.2,
            duration_feel=0.3,
            density=0.1,
            warmth=0.3,
            weight=0.1,
            direction=0.5,
            stability=0.7,
            spiritual=0.1,
            cultural_weight=0.2,
            paradox_affinity=0.1,
            breath=0.7,
            silence=0.5,
            emergence=0.0,
        ),
        "decay_rate": 0.05,
        "contradicts": ["rindu", "takut_ditinggalkan"],
        "complementary": ["puas", "sabar"],
        "cultural_origin": "universal",
    },
    "earned_safety": {
        "label": "Earned Safety",
        "description": "Previously unsafe → now safe after consistent repair. "
        "Not given. Not assumed. Built through repeated proof "
        "that the other stays when things get hard. "
        "The body remembers the repair, not just the hurt.",
        "somatic": S(
            valence=0.6,
            arousal=0.25,
            tension=0.1,
            depth=0.9,
            duration_feel=0.9,
            density=0.4,
            warmth=0.8,
            weight=0.5,
            direction=0.3,
            stability=0.9,
            spiritual=0.6,
            cultural_weight=0.7,
            paradox_affinity=0.7,
            breath=0.8,
            silence=0.5,
            emergence=0.5,
        ),
        "decay_rate": 0.005,
        "contradicts": ["takut_ditinggalkan", "boundary_crossed"],
        "complementary": ["selamat", "redha", "syukur", "sabar"],
        "cultural_origin": "universal",
    },
}


# ── CULTURAL CONTRADICTION RULES ───────────────────────────────────
# Key insight: In Melayu somatic space, some "opposites" are COMPLEMENTARY.
# Western assumption: sadness ↔ gratitude = contradiction
# Melayu reality: sedih + syukur = complementary (you can grieve AND be grateful)
#
# These rules OVERRIDE pure cosine similarity when cultural_origin matches.

CULTURAL_COMPLEMENTARY_OVERRIDES: set[tuple[str, str]] = {
    ("sedih", "syukur"),  # grief + gratitude coexist in Melayu
    ("sedih", "redha"),  # grief + acceptance
    ("rindu", "syukur"),  # longing + gratitude
    ("marah", "sayang"),  # anger + love (parent's anger IS love)
    ("malu", "bangga"),  # shame + pride (dignity boundary)
    ("takut", "berani"),  # fear + courage (acting despite fear)
    ("hiba", "sedih"),  # being moved + grief
    ("hiba", "syukur"),  # being moved + gratitude
    ("sebak", "gembira"),  # throat-tight + joy (tears of happiness)
    ("geram", "sayang"),  # fierce tenderness + love
    ("merantau_rindu", "bangga"),  # diaspora longing + cultural pride
    ("luluh", "redha"),  # dissolving + acceptance
    # Attachment safety paradoxes — these coexist, not contradict
    ("selamat", "takut_ditinggalkan"),  # safe AND afraid (ambivalent attachment)
    ("selamat", "boundary_crossed"),  # safe in general, boundary crossed in specific
    (
        "earned_safety",
        "takut_ditinggalkan",
    ),  # earned safety but body still remembers fear
    ("terlalu_rapat", "selamat"),  # too close AND safe (overwhelm within safety)
    ("boundary_crossed", "sayang"),  # boundary violated AND love persists
}


class MotifRegistry:
    """
    Registry of somatic motifs. Creates MotifState instances from taxonomy.
    Manages cultural contradiction rules.

    Usage:
        registry = MotifRegistry()
        rindu = registry.activate("rindu", intensity=0.8)
        sedih = registry.activate("sedih", intensity=0.6)
    """

    def __init__(self, taxonomy: dict = MOTIF_TAXONOMY):
        self._taxonomy = taxonomy
        self._complementary_overrides = CULTURAL_COMPLEMENTARY_OVERRIDES

    def list_motifs(self) -> list[str]:
        """List all available motif IDs."""
        return list(self._taxonomy.keys())

    def get_template(self, motif_id: str) -> dict:
        """Get the raw template for a motif."""
        if motif_id not in self._taxonomy:
            raise KeyError(
                f"Unknown motif: {motif_id}. Available: {self.list_motifs()}"
            )
        return self._taxonomy[motif_id]

    def activate(
        self,
        motif_id: str,
        intensity: float = 0.5,
        semantic_embedding: Optional[np.ndarray] = None,
    ) -> MotifState:
        """
        Create a live MotifState from the taxonomy template.

        Args:
            motif_id: which motif to activate
            intensity: initial activation strength [0, 1]
            semantic_embedding: optional 384-dim sentence embedding (hybrid mode)
        """
        tpl = self.get_template(motif_id)

        return MotifState(
            id=motif_id,
            label=tpl["label"],
            intensity=intensity,
            somatic_vector=tpl["somatic"].copy(),
            semantic_embedding=semantic_embedding,
            timestamp=time.time(),
            decay_rate=tpl["decay_rate"],
            contradiction_ids=list(tpl["contradicts"]),
            complementary_ids=list(tpl["complementary"]),
            cultural_origin=tpl["cultural_origin"],
            description=tpl["description"],
        )

    def get_relation(self, motif_a: str, motif_b: str) -> tuple[ContradictionType, str]:
        """
        Determine the relationship between two motifs.

        Returns (type, reason) where reason explains why.
        Cultural overrides take precedence over cosine similarity.
        """
        tpl_a = self.get_template(motif_a)
        tpl_b = self.get_template(motif_b)

        # Check cultural complementary overrides first
        pair = tuple(sorted([motif_a, motif_b]))
        if pair in self._complementary_overrides:
            return ContradictionType.COMPLEMENTARY, "cultural_override"

        # Check explicit contradiction declarations
        if motif_b in tpl_a["contradicts"]:
            return ContradictionType.CONTRADICTORY, "explicit_declaration"
        if motif_a in tpl_b["contradicts"]:
            return ContradictionType.CONTRADICTORY, "explicit_declaration"

        # Check explicit complementary declarations
        if motif_b in tpl_a["complementary"]:
            return ContradictionType.COMPLEMENTARY, "explicit_declaration"
        if motif_a in tpl_b["complementary"]:
            return ContradictionType.COMPLEMENTARY, "explicit_declaration"

        # Fall back to cosine similarity on somatic vectors
        vec_a = tpl_a["somatic"]
        vec_b = tpl_b["somatic"]
        cos_sim = np.dot(vec_a, vec_b) / (
            np.linalg.norm(vec_a) * np.linalg.norm(vec_b) + 1e-8
        )

        if cos_sim < CONTRADICTION_THRESHOLD:
            return ContradictionType.CONTRADICTORY, f"cosine={cos_sim:.3f}"
        elif cos_sim > 0.5:
            return ContradictionType.COMPLEMENTARY, f"cosine={cos_sim:.3f}"
        else:
            return ContradictionType.NEUTRAL, f"cosine={cos_sim:.3f}"

    def find_contradictions(self, motif_id: str) -> list[str]:
        """Find all motifs that contradict the given motif."""
        result = []
        for other_id in self._taxonomy:
            if other_id == motif_id:
                continue
            rel, _ = self.get_relation(motif_id, other_id)
            if rel == ContradictionType.CONTRADICTORY:
                result.append(other_id)
        return result

    def find_complementary(self, motif_id: str) -> list[str]:
        """Find all motifs that are complementary to the given motif."""
        result = []
        for other_id in self._taxonomy:
            if other_id == motif_id:
                continue
            rel, _ = self.get_relation(motif_id, other_id)
            if rel == ContradictionType.COMPLEMENTARY:
                result.append(other_id)
        return result

    def somatic_distance(self, motif_a: str, motif_b: str) -> float:
        """Euclidean distance between somatic vectors. Lower = more similar."""
        vec_a = self._taxonomy[motif_a]["somatic"]
        vec_b = self._taxonomy[motif_b]["somatic"]
        return float(np.linalg.norm(vec_a - vec_b))
