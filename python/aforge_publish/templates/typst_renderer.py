"""Typst template renderer — converts ArtifactManifest → .typ source.

Best for math-heavy academic-style AAA artifacts. Falls back to a graceful
degraded layout if any field is missing.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..types import ArtifactManifest


# ---------------------------------------------------------------------------
# Top-level template — Zen layout
# ---------------------------------------------------------------------------
def render_manifest_to_typst(manifest: ArtifactManifest) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    return "\n".join(
        [
            _header(),
            _cover_block(manifest, now),
            _falsification_block(manifest),
            _body_block(manifest),
            _figures_block(manifest),
            _organ_evidence_block(manifest),
            _footer(),
        ]
    )


def _header() -> str:
    return """\
// =============================================================================
// A-FORGE PUBLISH · TYPST BACKEND · Tier 3 AAA-grade compiler
// DITEMPA BUKAN DIBERI · Forged 2026-07-21
// =============================================================================

#set document(
  title: "A-FORGE Publish Artifact",
  author: "A-FORGE (000Ω) · FORGE",
  keywords: ("arifOS", "constitutional", "F1-F13", "Tier-3"),
)

#set page(
  paper: "a4",
  margin: (top: 25mm, bottom: 25mm, left: 20mm, right: 20mm),
  header: [
    #set text(8pt, fill: rgb("#555"))
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [SOVEREIGN · actor · session], [#context.metadata.artifact_id],
    )
    #line(length: 100%, stroke: 0.3pt + rgb("#ccc"))
  ],
  footer: [
    #line(length: 100%, stroke: 0.3pt + rgb("#ccc"))
    #set text(8pt, fill: rgb("#888"), style: "italic")
    #align(center)[DITEMPA BUKAN DIBERI · page #counter(page) of #context pages]
  ],
)

#set text(font: "Helvetica", size: 10pt, lang: "en")
#set par(justify: true, leading: 0.7em)

// epistemic palette
#let pill-OBS = box(fill: rgb("#0a5d2e"), inset: 3pt, radius: 2pt,
                     text(fill: white, weight: "bold", size: 8pt)[#raw("[OBS]")])
#let pill-DER = box(fill: rgb("#1f5fa8"), inset: 3pt, radius: 2pt,
                     text(fill: white, weight: "bold", size: 8pt)[#raw("[DER]")])
#let pill-INT = box(fill: rgb("#b86b00"), inset: 3pt, radius: 2pt,
                     text(fill: white, weight: "bold", size: 8pt)[#raw("[INT]")])
#let pill-SPEC = box(fill: rgb("#a02020"), inset: 3pt, radius: 2pt,
                      text(fill: white, weight: "bold", size: 8pt)[#raw("[SPEC]")])

#let pill(name) = {
  if name == "[OBS]" { pill-OBS }
  else if name == "[DER]" { pill-DER }
  else if name == "[INT]" { pill-INT }
  else if name == "[SPEC]" { pill-SPEC }
  else { box(fill: rgb("#666"), inset: 3pt, radius: 2pt,
             text(fill: white, size: 8pt)[#raw(name)]) }
}

#let epistemic-row(labels) = {
  set text(8pt)
  for lbl in labels [ #pill(lbl) ]
}

#let severity-color(v) = {
  if v == "SEAL" { rgb("#0a5d2e") }
  else if v == "INCONCLUSIVE" { rgb("#b86b00") }
  else if v == "FALSIFIED" or v == "VOID" { rgb("#a02020") }
  else { rgb("#333") }
}

"""


def _cover_block(m: ArtifactManifest, now: str) -> str:
    meta = [
        ("Sovereign", m.sovereign),
        ("Actor", m.actor_id),
        ("Session", m.session_id),
        ("Intent", m.intent),
        ("Tier", m.tier),
        ("Compiled", now),
    ]
    meta_rows = "\n".join(f"    [*{k}:*] {v}," for k, v in meta)
    epistemic_summary = m.epistemic_summary or {}
    epi_str = "  ".join(
        f'#pill("{k}") = {v}' for k, v in epistemic_summary.items() if v
    )
    return f"""\
// ----- COVER ----------------------------------------------------------------
#align(center)[
  #text(22pt, weight: "bold")[{m.title}]
  #v(0.3em)
  #text(12pt, fill: rgb("#555"))[{m.subject}]
]

#v(1em)

#block(
  fill: rgb("#f6f6f6"),
  inset: 8pt,
  radius: 2pt,
  width: 100%,
)[
  #set text(9pt)
  *Constitutional Provenance*
  #v(0.4em)
  #table(
    columns: (auto, 1fr),
    align: (left, left),
    stroke: 0.25pt + rgb("#aaa"),
{meta_rows}
  )
  #v(0.4em)
  *Epistemic Rollup:* {epi_str or "(none yet — figures will populate)"}
]

#pagebreak()

"""


def _falsification_block(m: ArtifactManifest) -> str:
    if not m.falsification_refs:
        return """\
// ----- FALSIFICATION GATE (empty — Tier 3 requires at least one) ----------
#block(
  fill: rgb("#fff8e1"),
  stroke: 1pt + rgb("#b86b00"),
  inset: 8pt,
  radius: 2pt,
)[
  #set text(10pt, fill: rgb("#7a4d00"))
  *Falsification Gate — WARNING.* No geox_falsify references provided.
  Per F2 TRUTH, this artifact CANNOT be rendered as Tier 3 evidence.
  Either provide at least one falsification result, or render with
  prominent Ω_0 uncertainty overlay.
]

#pagebreak()

"""
    rows = []
    for ref in m.falsification_refs:
        fr = ref.get("filters", {})
        rows.append(
            f"    [{ref.get('claim_text', '—')}], "
            f"[*{ref.get('verdict', '—')}*], "
            f"[PASS={fr.get('passed', 0)} FAIL={fr.get('failed', 0)} NT={fr.get('not_tested', 0)}], "
            f"[{ref.get('source', '—')}],"
        )
    rows_str = "\n".join(rows)
    return f"""\
// ----- FALSIFICATION GATE ----------------------------------------------------
#block(
  fill: rgb("#f0f7ed"),
  stroke: 1pt + rgb("#0a5d2e"),
  inset: 8pt,
  radius: 2pt,
)[
  #set text(10pt)
  *Falsification Gate (Tier 3 obligation).* Per F2 TRUTH: no claim rendered
  as fact without surviving the 7-filter Kill Matrix. INCONCLUSIVE →
  Ω₀ uncertainty. Filter NOT_TESTED = NO MAP.
]

#v(0.6em)

#table(
  columns: (1fr, auto, auto, 1fr),
  align: (left, center, center, left),
  stroke: 0.25pt + rgb("#aaa"),
  fill: (col, row) => if row == 0 {{ rgb("#222") }} else {{ none }},
  table.header(
    [*Claim*], [*Verdict*], [PASS/FAIL/NT], [*Source*],
  ),
{rows_str}
)

#pagebreak()

"""


def _body_block(m: ArtifactManifest) -> str:
    if not m.body_blocks:
        return "// (no body blocks)\n\n#pagebreak()\n\n"
    out: list[str] = []
    for block in m.body_blocks:
        btype = block.get("type", "paragraph")
        if btype == "heading":
            level = block.get("level", 2)
            txt = block.get("text", "")
            out.append(f"{'=' * (level + 1)} {txt}\n\n")
        elif btype == "paragraph":
            text = block.get("text", "")
            pills = block.get("epistemic", [])
            pills_str = " ".join(f'#pill("{p}")' for p in pills)
            out.append(f"{pills_str} {text}\n\n")
        elif btype == "raw":
            out.append(f"```\n{block.get('text', '')}\n```\n\n")
        elif btype == "rule":
            out.append('#line(length: 100%, stroke: 0.5pt + rgb("#888"))\n\n')
        elif btype == "page_break":
            out.append("#pagebreak()\n\n")
        else:
            out.append(f"% unknown block type: {btype}\n\n")
    return "".join(out)


def _figures_block(m: ArtifactManifest) -> str:
    if not m.figures:
        return "// (no figures)\n\n"
    out = ["#pagebreak()\n\n", "= Decision Surface — Figures\n\n"]
    out.append(
        "_Each figure carries epistemic labels [OBS/DER/INT/SPEC] and a P95 "
        "uncertainty band where physics permits. No map-shaped hallucination._\n\n"
    )
    for fig in m.figures:
        out.append(f"== {fig.title}\n\n")
        if fig.caption:
            out.append(f"_{fig.caption}_\n\n")
        out.append(
            "#epistemic-row(("
            + ", ".join(f'"{lbl.value}"' for lbl in fig.epistemic)
            + "))\n\n"
        )

        # Data payload table
        if fig.data_payload:
            out.append(
                '#table(\n  columns: (auto, 1fr),\n  align: (left, left),\n  stroke: 0.25pt + rgb("#aaa"),\n'
            )
            for k, v in fig.data_payload.items():
                if isinstance(v, float):
                    v_str = f"{v:.4g}"
                else:
                    v_str = str(v)
                v_typst = v_str.replace('"', '\\"')
                out.append(f"  [*{k}*], [{v_typst}],\n")
            out.append(")\n\n")

        # Uncertainty band
        if fig.uncertainty_band:
            out.append('#block(fill: rgb("#f0f7ed"), inset: 6pt, radius: 2pt)[\n')
            out.append("  *Uncertainty band (F2 TRUTH):*\n\n")
            out.append(
                '  #table(\n    columns: (auto, auto, auto, auto, auto),\n    stroke: 0.25pt + rgb("#aaa"),\n'
            )
            out.append(
                "    [*Variable*], [*Central*], [±1σ], [*P95 [low, high]*], [*Unit*],\n"
            )
            for var, band in fig.uncertainty_band.items():
                if isinstance(band, dict):
                    out.append(
                        f"    [{var}], [{band.get('central', '—')}], "
                        f"[±{band.get('sigma_1', '—')}], "
                        f"[[{band.get('p95_low', '—')}, {band.get('p95_high', '—')}]], "
                        f"[{band.get('unit', '')}],\n"
                    )
            out.append("  )\n]\n\n")

        # Source URIs
        if fig.source_uris:
            out.append("*Sources:*\n\n")
            for u in fig.source_uris:
                u_safe = u.replace('"', '\\"')
                out.append(f"- `{u_safe}`\n")
            out.append("\n")

    return "".join(out)


def _organ_evidence_block(m: ArtifactManifest) -> str:
    if not m.organ_evidence_refs:
        return ""
    out = ["#pagebreak()\n\n", "= Organ Evidence Anchors\n\n"]
    for ref in m.organ_evidence_refs:
        out.append(f"== {ref.get('organ', '?')} — {ref.get('tool', '?')}\n\n")
        out.append(f"{ref.get('summary', '—')}\n\n")
        if ref.get("sha256"):
            out.append(f"```\nsha256: {ref['sha256']}\n```\n\n")
    return "".join(out)


def _footer() -> str:
    return """\
// =============================================================================
// END OF ARTIFACT — DITEMPA BUKAN DIBERI
// =============================================================================
"""
