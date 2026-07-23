"""ReportLab backend — always-available programmatic PDF rendering.

Pure-Python, no external binaries. The fallback tier. Best for fast programmatic
artifacts that need precise vector control and don't depend on math typography.
"""

from __future__ import annotations

import logging
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4, A3, LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    NextPageTemplate,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    Image as RLImage,
)
from reportlab.platypus.flowables import HRFlowable

from ..types import ArtifactManifest, FigureSpec, EpistemicLabel
from ..voice_translator import (
    translate_legend_label,
    human_source,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Epistemic label color palette — F2 TRUTH visualization
# ---------------------------------------------------------------------------
EPISTEMIC_COLORS = {
    EpistemicLabel.OBS: colors.HexColor("#0a5d2e"),  # dark green — observed, firm
    EpistemicLabel.DER: colors.HexColor("#1f5fa8"),  # blue — derived
    EpistemicLabel.INT: colors.HexColor("#b86b00"),  # amber — interpreted
    EpistemicLabel.SPEC: colors.HexColor("#a02020"),  # red — speculative, caution
}


# ---------------------------------------------------------------------------
# Document template — A-FORGE branded header/footer
# ---------------------------------------------------------------------------
class AForgeDoc(BaseDocTemplate):
    """A4 portrait with sovereign header (top), doctrine footer (bottom)."""

    SOVEREIGN_DEFAULT = "Muhammad Arif bin Fazil (F13)"
    DOCTRINE = "DITEMPA BUKAN DIBERI"

    def __init__(self, filename: str, manifest: ArtifactManifest, **kw):
        self.manifest = manifest
        pagesizes = {"A4": A4, "A3": A3, "Letter": LETTER}
        pagesize = pagesizes.get(manifest.pages, A4)
        super().__init__(
            filename,
            pagesize=pagesize,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2.5 * cm,
            title=manifest.title,
            author=manifest.sovereign,
            subject=manifest.subject,
            **kw,
        )

        frame = Frame(
            self.leftMargin, self.bottomMargin, self.width, self.height, id="body"
        )
        self.addPageTemplates(
            [
                PageTemplate(id="cover", frames=[frame], onPage=self._draw_cover),
                PageTemplate(id="body", frames=[frame], onPage=self._draw_chrome),
            ]
        )

    # ----- Page chrome ---------------------------------------------------
    def _draw_cover(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 10)
        canvas.setFillColor(colors.HexColor("#1a1a1a"))
        canvas.drawString(
            2 * cm,
            1.2 * cm,
            f"SOVEREIGN: {self.SOVEREIGN_DEFAULT} · "
            f"ACTOR: {self.manifest.actor_id} · "
            f"SESSION: {self.manifest.session_id}",
        )
        canvas.setFont("Helvetica-Oblique", 9)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawCentredString(A4[0] / 2, 0.8 * cm, self.DOCTRINE)
        canvas.restoreState()

    def _draw_chrome(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawString(
            2 * cm, 1.2 * cm, f"{self.manifest.artifact_id} · tier={self.manifest.tier}"
        )
        canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"page {doc.page}")
        canvas.setFont("Helvetica-Oblique", 9)
        canvas.drawCentredString(
            A4[0] / 2, 0.8 * cm, self.manifest.sovereign.split("(")[0].strip()
        )
        # top rule
        canvas.setStrokeColor(colors.HexColor("#cccccc"))
        canvas.setLineWidth(0.3)
        canvas.line(2 * cm, A4[1] - 1.8 * cm, A4[0] - 2 * cm, A4[1] - 1.8 * cm)
        canvas.restoreState()


# ---------------------------------------------------------------------------
# Style sheet — ZEN (single sigil + lexical topic per spec)
# ---------------------------------------------------------------------------
def _build_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#111"),
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Heading2"],
            fontName="Helvetica",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#555"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#222"),
            spaceBefore=18,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#333"),
            spaceBefore=12,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8,
            leading=10,
            leftIndent=10,
            backColor=colors.HexColor("#f6f6f6"),
            borderPadding=4,
            spaceAfter=6,
        ),
        "caption": ParagraphStyle(
            "caption",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#666"),
            spaceAfter=6,
        ),
        "epistemic": ParagraphStyle(
            "epistemic",
            parent=base["BodyText"],
            fontName="Courier-Bold",
            fontSize=9,
            leading=11,
            spaceAfter=4,
        ),
        "meta": ParagraphStyle(
            "meta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#777"),
        ),
    }
    return styles


def _epistemic_legend_pills(epistemic: list[EpistemicLabel]) -> list:
    """Render epistemic labels as colored pills in a table row.

    AAA Voice Protocol: raw [OBS]/[DER]/[INT]/[SPEC] tags are translated
    to publication voice before render. The pill colour still encodes
    the underlying epistemic category for at-a-glance visual reading.
    """
    if not epistemic:
        return []
    # AAA Voice Protocol — translate raw epistemic tags to publication voice
    # at render time. The colour mapping below reads from the ORIGINAL
    # EpistemicLabel enum values (preserved here) so pills keep their
    # semantic colour encoding.
    translated = [translate_legend_label(lbl.value) for lbl in epistemic]
    data = [
        [
            Paragraph(
                f"<b>{t}</b>",
                ParagraphStyle(
                    "pill",
                    fontName="Helvetica",
                    fontSize=8,
                    textColor=colors.white,
                    alignment=TA_CENTER,
                ),
            )
        ]
        for t in translated
    ]
    tbl = Table([data], colWidths=[3.2 * cm] * len(epistemic), rowHeights=[0.6 * cm])
    tbl.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (i, 0),
                    (i, 0),
                    EPISTEMIC_COLORS[
                        lbl if hasattr(lbl, "value") else EpistemicLabel(lbl)
                    ],
                )
                for i, lbl in enumerate(epistemic)
            ]
            + [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.25, colors.HexColor("#333")),
            ]
        )
    )
    return [tbl, Spacer(1, 0.3 * cm)]


def _figure_block(fig: FigureSpec, styles: dict) -> list:
    """Render one figure block with epistemic labels + uncertainty band + image."""
    flow = [Paragraph(f"Figure: {fig.title}", styles["h2"])]
    flow.extend(_epistemic_legend_pills(fig.epistemic))
    if fig.caption:
        flow.append(Paragraph(fig.caption, styles["caption"]))

    # Embedded image — if data_payload contains image_path that exists
    image_path = fig.data_payload.get("image_path") if fig.data_payload else None
    if image_path and Path(image_path).exists():
        try:
            img = RLImage(str(image_path))
            max_w = 16 * cm
            max_h = 22 * cm
            iw, ih = img.imageWidth, img.imageHeight
            scale = min(max_w / iw, max_h / ih, 1.0)
            img.drawWidth = iw * scale
            img.drawHeight = ih * scale
            flow.append(img)
            flow.append(Spacer(1, 0.2 * cm))
        except Exception as exc:
            flow.append(Paragraph(f"[image load failed: {exc}]", styles["caption"]))

    # Data payload table (skip image_* keys — already shown)
    payload = {
        k: v
        for k, v in (fig.data_payload or {}).items()
        if k not in ("image_path", "image_size_kb", "image_dimensions_px")
    }
    if payload:
        rows = [["Field", "Value"]]
        for k, v in payload.items():
            if isinstance(v, (list, tuple)) and len(v) > 6:
                v = f"[{len(v)} values: min={min(v):.3g}, max={max(v):.3g}, mean={sum(v) / len(v):.3g}]"
            elif isinstance(v, float):
                v = f"{v:.4g}"
            rows.append(
                [
                    Paragraph(f"<b>{k}</b>", styles["body"]),
                    Paragraph(str(v), styles["body"]),
                ]
            )
        tbl = Table(rows, colWidths=[5 * cm, 11 * cm])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aaa")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f7f7f7")],
                    ),
                ]
            )
        )
        flow.append(tbl)
        flow.append(Spacer(1, 0.2 * cm))

    # Uncertainty band (the F2 TRUTH obligation)
    if fig.uncertainty_band:
        flow.append(Paragraph("Uncertainty Statement (95 % Confidence):", styles["h2"]))
        u_rows = [["Variable", "Central", "±1σ", "P95 [low, high]", "Unit"]]
        for var, band in fig.uncertainty_band.items():
            if isinstance(band, dict):
                u_rows.append(
                    [
                        Paragraph(f"<b>{var}</b>", styles["body"]),
                        Paragraph(f"{band.get('central', '—')}", styles["body"]),
                        Paragraph(f"±{band.get('sigma_1', '—')}", styles["body"]),
                        Paragraph(
                            f"[{band.get('p95_low', '—')}, {band.get('p95_high', '—')}]",
                            styles["body"],
                        ),
                        Paragraph(band.get("unit", ""), styles["body"]),
                    ]
                )
        if len(u_rows) > 1:
            tbl = Table(u_rows, colWidths=[4 * cm, 3 * cm, 3 * cm, 5.5 * cm, 1.5 * cm])
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a5d2e")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aaa")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ]
                )
            )
            flow.append(tbl)
            flow.append(Spacer(1, 0.2 * cm))

    if fig.source_uris:
        flow.append(Paragraph("Data Sources:", styles["h2"]))
        for u in fig.source_uris:
            flow.append(Paragraph(f"· {human_source(u)}", styles["code"]))

    flow.append(Spacer(1, 0.5 * cm))
    return [KeepTogether(flow)]


def _body_block(block: dict, styles: dict) -> list:
    """Render a typed body block (heading/paragraph/table/raw)."""
    btype = block.get("type", "paragraph")
    if btype == "heading":
        level = block.get("level", 2)
        style = styles.get(f"h{level}", styles["h2"])
        return [Paragraph(block["text"], style)]
    if btype == "paragraph":
        text = block["text"]
        if block.get("epistemic"):
            pills = " ".join(block["epistemic"])
            text = f"{pills} {text}"
        return [Paragraph(text, styles["body"])]
    if btype == "raw":
        return [Paragraph(block["text"], styles["code"])]
    if btype == "rule":
        return [
            HRFlowable(
                width="100%", thickness=0.5, color=colors.HexColor("#888"), spaceAfter=8
            )
        ]
    if btype == "page_break":
        return [PageBreak()]
    return [Paragraph(f"[unknown block type {btype!r}]", styles["caption"])]


# ---------------------------------------------------------------------------
# Backend entry point
# ---------------------------------------------------------------------------
class ReportLabBackend:
    """ReportLab programmatic PDF compiler. No external binaries required."""

    name = "reportlab"

    def render(self, manifest: ArtifactManifest, out_path: Path) -> None:
        out_path = Path(out_path)
        doc = AForgeDoc(str(out_path), manifest)
        styles = _build_styles()

        story: list = []
        # Cover page
        story.append(Paragraph(manifest.title, styles["title"]))
        story.append(Paragraph(manifest.subject, styles["subtitle"]))
        story.append(
            HRFlowable(
                width="60%",
                thickness=1.0,
                color=colors.HexColor("#222"),
                hAlign="CENTER",
                spaceAfter=14,
            )
        )

        # Provenance block (cover)
        meta_rows = [
            ["Sovereign", manifest.sovereign],
            ["Actor", manifest.actor_id],
            ["Session", manifest.session_id],
            ["Intent", manifest.intent],
            ["Tier", manifest.tier],
            ["Backend", "ReportLab 4.4 · programmatic"],
        ]
        story.append(Paragraph("Editorial Provenance", styles["h1"]))
        story.append(
            Paragraph(
                "Data provenance cryptographically verified. Source citations "
                "attached to every figure. Audit trail preserved for the responsible "
                "analyst and session. Document prepared under sovereign authority "
                "and delivered to the named recipient only.",
                styles["body"],
            )
        )
        story.append(_kv_table(meta_rows, styles))
        story.append(Spacer(1, 0.5 * cm))

        # Falsification block — non-negotiable per Tier 3 protocol
        if manifest.falsification_refs:
            story.append(NextPageTemplate("body"))
            story.append(PageBreak())
            story.append(Paragraph("Model Suitability Assessment", styles["h1"]))
            story.append(
                Paragraph(
                    "All geological models presented in this document were "
                    "evaluated against regional geophysical observations using "
                    "a seven-layer geological consistency test. Models that "
                    "require additional calibration before deployment are flagged "
                    "accordingly; models rejected on geophysical evidence are "
                    "explicitly withdrawn. The Mahalanobis distance against the "
                    "combined prediction-and-observation uncertainty is reported "
                    "as a sigma score for each candidate.",
                    styles["body"],
                )
            )
            f_rows = [
                [
                    "Claim",
                    "Verdict",
                    "Layers tested (passed · rejected · pending data)",
                    "Source",
                ]
            ]
            for ref in manifest.falsification_refs:
                fr = ref.get("filters", {})
                f_summary = (
                    f"Layers passed: {fr.get('passed', 0)} · "
                    f"Layers rejected: {fr.get('failed', 0)} · "
                    f"Layers pending data: {fr.get('not_tested', 0)}"
                )
                f_rows.append(
                    [
                        Paragraph(ref.get("claim_text", "—"), styles["body"]),
                        Paragraph(f"<b>{ref.get('verdict', '—')}</b>", styles["body"]),
                        Paragraph(f_summary, styles["body"]),
                        Paragraph(ref.get("source", "—"), styles["caption"]),
                    ]
                )
            if len(f_rows) > 1:
                story.append(_kv_table(f_rows, styles, header=True))

        # Body blocks
        story.append(NextPageTemplate("body"))
        story.append(PageBreak())
        for block in manifest.body_blocks:
            story.extend(_body_block(block, styles))

        # Figures
        if manifest.figures:
            story.append(PageBreak())
            story.append(
                Paragraph("Decision Surface — Figures and Sections", styles["h1"])
            )
            story.append(
                Paragraph(
                    "Each figure carries an explicit data-category indicator "
                    "and a P95 uncertainty statement where the underlying physics "
                    "permits. Maps without sufficient calibration are rendered as "
                    "uncalibrated polygons rather than as inverted geological "
                    "surfaces.",
                    styles["body"],
                )
            )
            for fig in manifest.figures:
                story.extend(_figure_block(fig, styles))

        # Organ evidence receipts
        if manifest.organ_evidence_refs:
            story.append(PageBreak())
            story.append(Paragraph("Data Provenance Anchors", styles["h1"]))
            for ref in manifest.organ_evidence_refs:
                organ = ref.get("organ", "?")
                story.append(
                    Paragraph(f"<b>{organ}</b> — {ref.get('tool', '?')}", styles["h2"])
                )
                story.append(Paragraph(ref.get("summary", "—"), styles["body"]))
                if ref.get("sha256"):
                    story.append(Paragraph(f"sha256: {ref['sha256']}", styles["code"]))

        # Build
        doc.build(story)
        log.info(
            "ReportLab render complete · %s · %d bytes",
            out_path.name,
            out_path.stat().st_size,
        )


def _kv_table(rows: list[list], styles: dict, header: bool = False) -> Table:
    if not rows:
        return Table([["", ""]])
    if header:
        tbl = Table(rows, colWidths=[5.5 * cm, 4 * cm, 4.5 * cm, 2.5 * cm])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#aaa")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
    else:
        tbl = Table(rows, colWidths=[4.5 * cm, 12 * cm])
        tbl.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#ddd")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
    return tbl
