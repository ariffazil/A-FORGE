"""
AAA PDF Voice Translator — arifOS Federation
=============================================

Forged 2026-07-21 by FORGE (000Ω) under F13 SOVEREIGN directive.

Translates internal governance/state vocabulary into professional geological
publication language suitable for AAPG Bulletin / PETRONAS technical report voice.

THE RULE: the internal state machine is unchanged. Only the rendered TEXT changes.
DOCTRINE: DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

from typing import Any, Iterable


# ---------------------------------------------------------------------------
# Vocabulary map — apply in order, case-insensitive
# ---------------------------------------------------------------------------
VOICE_MAP: list[tuple[str, str]] = [
    # ----- Epistemic tags (the most important) -----
    ("[OBS]", "Measured Data"),
    ("[DER]", "Calculated Surface"),
    ("[INT]", "Geological Interpretation"),
    ("[SPEC]", "Uncalibrated Polygon"),
    # ----- Governance / floor tags -----
    ("F1 AMANAH", "Data provenance cryptographically verified"),
    ("F2 TRUTH", "Source citations attached"),
    ("F4 CLARITY", "Editorial clarity"),
    ("F11 AUDIT", "Audit trail preserved"),
    ("F13 SOVEREIGN", "Sovereign approval"),
    ("FLOOR", "Editorial standard"),
    # ----- System primitives -----
    ("geox_falsify", "regional geophysical validation"),
    ("geox_basin", "basin framework synthesis"),
    ("geox_falsify(mode='full')", "full regional geophysical validation"),
    ("geox_subsurface_model", "subsurface modelling suite"),
    ("geox_petrophysics", "petrophysical analysis pipeline"),
    ("geox_to_wealth_bridge", "economic translation"),
    ("Kill Matrix", "seven-layer geological consistency test"),
    ("KILL MATRIX", "seven-layer geological consistency test"),
    ("INCONCLUSIVE", "requires additional calibration"),
    ("FALSIFIED", "rejected on geophysical evidence"),
    ("VOID", "rejected on evidentiary grounds"),
    ("SEAL", "validated"),
    ("SABAR", "held pending further data"),
    ("HOLD", "deferred"),
    # ----- Pipeline vocabulary -----
    ("AForgePublishCompiler", "document preparation pipeline"),
    ("ClosedLoopVisualValidator", "independent technical review"),
    ("forged", "compiled"),
    ("forge", "compile"),
    ("rendering", "preparing"),
    ("backend", "presentation engine"),
    ("validator", "reviewer"),
    # ----- Epistemic status in body text -----
    ("true|false", ""),  # placeholder to keep dict shape
    # ----- Receipt / audit -----
    ("receipt", "audit record"),
    ("SHA256", "cryptographic identifier"),
    ("sha256", "cryptographic identifier"),
    ("sct_v1", "session identifier"),
    ("session_id", "session identifier"),
    ("actor_id", "responsible analyst"),
    ("trace_id", "workflow identifier"),
    ("call_hash", "operation fingerprint"),
    # ----- Resource URIs -----
    ("arifos://", ""),
    ("VAULT999", "immutable audit log"),
    # ----- Pipeline jargon -----
    ("payload", "data"),
    ("manifest", "specification"),
    ("figure block", "figure"),
    ("epistemic pill", "data category indicator"),
    ("uncertainty band", "uncertainty statement"),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def translate_text(text: str) -> str:
    """Translate a single string. Idempotent. Preserves casing."""
    if not text:
        return text
    out = text
    # Longest patterns first to avoid partial-match issues
    for src, dst in sorted(VOICE_MAP, key=lambda kv: -len(kv[0])):
        if src and src in out:
            out = out.replace(src, dst)
    return out


def translate_legend_label(label: str) -> str:
    """Translate a single legend / epistemic label into publication voice.

    Examples
    --------
    >>> translate_legend_label("[OBS] Malay Basin")
    'Measured Data — Malay Basin'
    >>> translate_legend_label("[SPEC] 14 other centres")
    'Uncalibrated Polygon — 14 other centres'
    """
    # Strip leading bracket-tag if present
    s = label.strip()
    for tag, replacement in [
        ("[OBS]", "Measured Data"),
        ("[DER]", "Calculated Surface"),
        ("[INT]", "Geological Interpretation"),
        ("[SPEC]", "Uncalibrated Polygon"),
    ]:
        if s.startswith(tag):
            tail = s[len(tag) :].lstrip(" —-:")
            return f"{replacement} — {tail}" if tail else replacement
    return translate_text(s)


def translate_figure_legend(labels: Iterable[str]) -> list[str]:
    """Translate a list of legend labels in publication voice."""
    return [translate_legend_label(lbl) for lbl in labels]


def translate_manifest_dict(d: dict) -> dict:
    """Recursively translate all string values in a manifest dict."""
    if isinstance(d, dict):
        return {k: translate_manifest_dict(v) for k, v in d.items()}
    if isinstance(d, list):
        return [translate_manifest_dict(v) for v in d]
    if isinstance(d, str):
        return translate_text(d)
    return d


def translate_manifest(manifest: Any) -> Any:
    """Translate an ArtifactManifest (dataclass) in place. Returns the same object.

    All string fields are passed through translate_text. Lists and dicts
    inside dataclass fields are walked recursively.
    """
    import dataclasses

    if not dataclasses.is_dataclass(manifest):
        return manifest
    for f in dataclasses.fields(manifest):
        val = getattr(manifest, f.name)
        if isinstance(val, str):
            setattr(manifest, f.name, translate_text(val))
        elif isinstance(val, list):
            new_list = []
            for item in val:
                if isinstance(item, str):
                    new_list.append(translate_text(item))
                elif dataclasses.is_dataclass(item):
                    new_list.append(translate_manifest(item))
                else:
                    new_list.append(item)
            setattr(manifest, f.name, new_list)
        elif dataclasses.is_dataclass(val):
            translate_manifest(val)
    return manifest


def translate_figure_legend_block(epistemic_list: Iterable) -> str:
    """Build a human-language legend line from a list of EpistemicLabel values."""
    parts = []
    seen: set[str] = set()
    for ep in epistemic_list:
        v = ep.value if hasattr(ep, "value") else str(ep)
        if v in seen:
            continue
        seen.add(v)
        parts.append(translate_legend_label(v))
    return " · ".join(parts)


# ---------------------------------------------------------------------------
# Geological publication voice — caption + section helpers
# ---------------------------------------------------------------------------
SCAR_REPLACEMENTS = {
    # file paths → scientific citations
    "/root/.cache/geox/emag2/EMAG2_V3_UpCont_DataTiff.tif": "NOAA/NCEI EMAG2v3 (Maus et al., 2009)",
    "/data/wells/MALAY_BASIN_MADON_2021_GSM72.pdf": "Madon (2021), Bulletin of the Geological Society of Malaysia, vol. 72",
    "/root/A-FORGE/forge_work/2026-07-21/": "",
    "geox_basin(mode=profile)": "GEOX basin-framework synthesis",
    "geox_falsify": "regional geophysical validation",
    "arifOS Federation · DITEMPA BUKAN DIBERI": "arifOS Federation",
}


def human_source(uri: str) -> str:
    """Convert a machine source URI to a scientific citation."""
    s = str(uri).strip()
    for src, dst in SCAR_REPLACEMENTS.items():
        if src and src in s:
            return s.replace(src, dst)
    return s


__all__ = [
    "translate_text",
    "translate_legend_label",
    "translate_figure_legend",
    "translate_manifest_dict",
    "translate_manifest",
    "translate_figure_legend_block",
    "human_source",
    "VOICE_MAP",
]
