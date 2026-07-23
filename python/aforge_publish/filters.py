"""
AAA Human Cognitive Resonance Filter
====================================

Forged 2026-07-21 by FORGE (000Ω) under F13 SOVEREIGN directive.

Constitutional rendering filter for AForgePublishCompiler. Acts as the
**safety net** that catches any internal governance / system vocabulary
that leaks into the human-readable PDF artifact.

Layered defence:
  1. Agent attempts to write human text (per INIT.md Presentation Law)
  2. voice_translator.py translates raw epistemic tags
  3. filters.py (this file) catches any remaining system terms
  4. ClosedLoopVisualValidator (8th check) fails the build on any leak

Doctrine: DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import re
from typing import Iterable


# ---------------------------------------------------------------------------
# BANNED vocabulary — anything in this list MUST be translated before render.
# This is the AAA Human Cognitive Resonance guarantee.
# ---------------------------------------------------------------------------
BANNED_PDF_TERMS: list[str] = [
    # Governance floors
    "F1 AMANAH",
    "F2 TRUTH",
    "F3",
    "F4 CLARITY",
    "F7 HUMILITY",
    "F8 GENIUS",
    "F9 ANTI-HANTU",
    "F10 ONTOLOGY",
    "F11 AUDIT",
    "F13 SOVEREIGN",
    # System primitives
    "Kill Matrix",
    "KILL MATRIX",
    "K-filter",
    "K001",
    "K002",
    "K003",
    "K004",
    "K005",
    "K006",
    "K007",
    "INCONCLUSIVE",
    "FALSIFIED",
    "VOID",
    "SABAR",
    "NOT_TESTED",
    "Ω_0",
    "Ω₀",
    "Ω0",
    "Omega_0",
    "geox_falsify",
    "geox_basin",
    "geox_evidence",
    "geox_claim",
    "geox_deep_time",
    "geox_subsurface_model",
    "geox_petrophysics",
    "well_assess",
    "capital_wisdom",
    # Machine file paths
    "/root/.cache/",
    "/root/A-FORGE/",
    "/data/wells/",
    "/var/arifos/",
    "trace-",
    # Session / receipt tokens
    "sct_v1.",
    "arifos://",
    "VAULT999",
    "session_token",
    "call_hash",
    "receipt_id",
    # Function call signatures
    "mode=",
    "actor_id=",
    "session_id=",
    # Library / framework names
    "pymupdf",
    "reportlab",
    "weasyprint",
    "Playwright",
    "FORGE (000Ω)",
    "FORGE-000Omega",
    # ECHO/PaW loop jargon
    "ECHO/PaW",
    "PaW loop",
    # Status code letters when bare
    "SEAL verdict",
    "HOLD verdict",
    "VOID verdict",
    "z-score >",
    "z-score =",
]


# ---------------------------------------------------------------------------
# TRANSLATION MAP — replace internal vocabulary with publication voice.
# Applied before the safety-net BANNED scan.
# ---------------------------------------------------------------------------
TRANSLATION_MAP: list[tuple[str, str]] = [
    # Governance floors (every occurrence, including in compound phrases)
    ("F1 AMANAH", "Cryptographically verified provenance"),
    ("F2 TRUTH", "Source citations attached"),
    ("F3", "Editorial standard"),
    ("F4 CLARITY", "Editorial clarity"),
    ("F7 HUMILITY", "Confidence-capped uncertainty statement"),
    ("F8 GENIUS", "Decision quality threshold"),
    ("F9 ANTI-HANTU", "Anti-hallucination protocol"),
    ("F10 ONTOLOGY", "Domain-bound terminology"),
    ("F11 AUDIT", "Immutable audit trail"),
    ("F13 SOVEREIGN", "Sovereign approval"),
    # Kill matrix / falsification primitives
    ("Kill Matrix", "seven-layer geological consistency test"),
    ("KILL MATRIX", "seven-layer geological consistency test"),
    ("K-filter", "consistency layer"),
    ("K001", "physical-plausibility layer"),
    ("K002", "stratigraphic-consistency layer"),
    ("K003", "geothermal-gradient layer"),
    ("K004", "burial-compaction layer"),
    ("K005", "pore-pressure layer"),
    ("K006", "logical-consistency layer"),
    ("K007", "evidence-sufficiency layer"),
    ("INCONCLUSIVE", "requires additional calibration before deployment"),
    ("FALSIFIED", "rejected on geophysical evidence"),
    ("VOID", "rejected on evidentiary grounds"),
    ("NOT_TESTED", "data not yet assembled"),
    ("Ω_0 uncertainty", "uncertainty — additional data required"),
    ("Ω₀ uncertainty", "uncertainty — additional data required"),
    ("Ω0 uncertainty", "uncertainty — additional data required"),
    ("ECHO/PaW loop", "internal self-correction cycle"),
    ("PaW loop", "internal self-correction cycle"),
    # System primitives
    ("geox_falsify(mode='full')", "full regional geophysical validation"),
    ("geox_falsify", "regional geophysical validation"),
    ("geox_basin", "basin framework synthesis"),
    ("geox_evidence", "evidence synthesis"),
    ("geox_claim", "claim registration"),
    ("geox_deep_time", "deep-time state retrieval"),
    ("geox_subsurface_model", "subsurface modelling suite"),
    ("geox_petrophysics", "petrophysical analysis"),
    ("geox_to_wealth_bridge", "economic translation"),
    ("well_assess_homeostasis", "human-readiness assessment"),
    ("capital_wisdom", "capital-wisdom synthesis"),
    # Session / receipt tokens
    ("arifos://", ""),
    ("sct_v1.", "session-"),
    ("VAULT999", "immutable audit log"),
    ("session_token", "session credential"),
    ("call_hash", "operation fingerprint"),
    ("receipt_id", "audit record identifier"),
    # Library / framework names
    ("pymupdf", "the document library"),
    ("reportlab", "the PDF engine"),
    ("weasyprint", "the layout engine"),
    ("Playwright", "the rendering engine"),
    ("FORGE (000Ω)", "the forger"),
    ("FORGE-000Omega", "the forger"),
    # Function call signatures
    ("mode='full'", "(full mode)"),
    ('mode="full"', "(full mode)"),
    # File paths
    ("/root/.cache/", ""),
    ("/root/A-FORGE/", ""),
    ("/data/wells/", ""),
    ("/var/arifos/", ""),
    ("trace-", "workflow-"),
    # Status code in compound form
    ("SEAL verdict", "decision: validated"),
    ("HOLD verdict", "decision: deferred"),
    ("VOID verdict", "decision: rejected"),
    # Plain z-score notation (kept numeric elsewhere)
    ("z-score > 3", "Mahalanobis distance exceeds 3"),
    ("z-score >", "Mahalanobis distance exceeds "),
    ("z-score =", "Mahalanobis distance equals "),
]


# Compiled regex patterns for fast scan
_BANNED_PATTERNS: list[tuple[str, re.Pattern]] = [
    (term, re.compile(re.escape(term))) for term in BANNED_PDF_TERMS
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def enforce_human_cognitive_resonance(text: str) -> str:
    """Strip / translate internal AAA system vocabulary from a text block.

    Idempotent. Longest patterns first to avoid partial matches.
    """
    if not text:
        return text
    out = text
    for src, dst in sorted(TRANSLATION_MAP, key=lambda kv: -len(kv[0])):
        if src and src in out:
            out = out.replace(src, dst)
    return out


def scan_for_banned_terms(text: str) -> list[str]:
    """Return the list of banned terms still present in the text.

    If the list is empty, the text is clean. Any non-empty result means
    the human_resonance_check has FAILED.

    Uses compiled regex patterns for speed on large PDF text, with
    plain substring fallback for edge cases.
    """
    if not text:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for term, pat in _BANNED_PATTERNS:
        if term in seen:
            continue
        # Primary: compiled regex search (fast, catches word-boundary variants)
        if pat.search(text):
            found.append(term)
            seen.add(term)
            continue
        # Fallback: plain substring (catches terms embedded in longer strings
        # that the regex might miss due to re.escape boundaries)
        if term in text:
            found.append(term)
            seen.add(term)
    return found


def is_resonance_clean(text: str) -> tuple[bool, list[str]]:
    """Returns (clean, banned_terms_found)."""
    bad = scan_for_banned_terms(text)
    return (len(bad) == 0, bad)


def enforce_in_dict(d: dict) -> dict:
    """Recursively enforce resonance on every string value in a dict."""
    if isinstance(d, dict):
        return {k: enforce_in_dict(v) for k, v in d.items()}
    if isinstance(d, list):
        return [enforce_in_dict(v) for v in d]
    if isinstance(d, str):
        return enforce_human_cognitive_resonance(d)
    return d


def enforce_in_strings(strings: Iterable[str]) -> list[str]:
    return [enforce_human_cognitive_resonance(s) for s in strings]


__all__ = [
    "BANNED_PDF_TERMS",
    "TRANSLATION_MAP",
    "enforce_human_cognitive_resonance",
    "scan_for_banned_terms",
    "is_resonance_clean",
    "enforce_in_dict",
    "enforce_in_strings",
]
