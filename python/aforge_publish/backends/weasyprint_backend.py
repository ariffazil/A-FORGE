"""WeasyPrint backend — HTML+CSS → PDF. Best for dashboard-style reports."""

from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, select_autoescape
from weasyprint import HTML, default_url_fetcher

from ..types import ArtifactManifest

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# AAA-grade HTML template (Zen: single sigil + topic per spec)
# ---------------------------------------------------------------------------
_JINJA = Environment(
    autoescape=select_autoescape(default=True),
    trim_blocks=True,
    lstrip_blocks=True,
)

HTML_TEMPLATE = _JINJA.from_string("""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ manifest.title }}</title>
<style>
  @page {
    size: {{ manifest.pages }};
    margin: 20mm 18mm 22mm 18mm;
    @top-left { content: "SOVEREIGN: {{ manifest.sovereign }}"; font-size: 8pt; color: #666; }
    @top-right { content: "{{ manifest.artifact_id }} · {{ manifest.tier }}"; font-size: 8pt; color: #666; }
    @bottom-center { content: "DITEMPA BUKAN DIBERI — page " counter(page) " of " counter(pages);
                      font-size: 8pt; color: #888; font-style: italic; }
  }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #111; line-height: 1.4; }
  h1 { font-size: 22pt; margin: 0 0 6pt 0; }
  h2 { font-size: 13pt; margin: 16pt 0 4pt 0; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
  h3 { font-size: 11pt; margin: 12pt 0 3pt 0; color: #333; }
  p { margin: 6pt 0; }
  .subtitle { color: #555; font-size: 11pt; margin-bottom: 18pt; }
  .meta { background: #f6f6f6; padding: 8pt; border-left: 3pt solid #222; font-size: 9pt; margin: 10pt 0; }
  .pill { display: inline-block; padding: 2pt 8pt; margin: 1pt 2pt; color: white; font-family: 'Courier New', monospace;
          font-size: 8pt; font-weight: bold; border-radius: 3pt; }
  .obs { background: #0a5d2e; }
  .der { background: #1f5fa8; }
  .int { background: #b86b00; }
  .spec { background: #a02020; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9pt; }
  th { background: #222; color: white; text-align: left; padding: 5pt; font-weight: bold; }
  td { border: 0.5pt solid #aaa; padding: 5pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  pre { background: #f0f0f0; padding: 6pt; font-size: 8pt; overflow-wrap: break-word; }
  .uncertainty { background: #f0f7ed; border: 1px solid #0a5d2e; padding: 8pt; margin: 6pt 0; }
  .falsify { background: #fff8e1; border: 1px solid #b86b00; padding: 8pt; margin: 6pt 0; }
  .verdict-SEAL { color: #0a5d2e; font-weight: bold; }
  .verdict-INCONCLUSIVE { color: #b86b00; font-weight: bold; }
  .verdict-FALSIFIED { color: #a02020; font-weight: bold; }
</style>
</head>
<body>

<h1>{{ manifest.title }}</h1>
<div class="subtitle">{{ manifest.subject }}</div>

<div class="meta">
  <strong>Constitutional Provenance</strong><br>
  Sovereign: {{ manifest.sovereign }} · Actor: {{ manifest.actor_id }}<br>
  Session: {{ manifest.session_id }} · Tier: {{ manifest.tier }} · Backend: WeasyPrint {{ weasyprint_version }}<br>
  Intent: {{ manifest.intent }}<br>
  <em>F1 AMANAH: source manifest preserved. F2 TRUTH: epistemic labels on every figure.
   F11 AUDIT: actor + session anchored. F13 SOVEREIGN: delivery to sovereign only.</em>
</div>

{% if manifest.falsification_refs %}
<h2>Falsification Gate</h2>
<p><em>Per F2 TRUTH: no claim rendered as fact without surviving the 7-filter Kill Matrix.
  INCONCLUSIVE → Ω₀ uncertainty. Filter NOT_TESTED = NO MAP.</em></p>
<table>
  <thead><tr><th>Claim</th><th>Verdict</th><th>PASS / FAIL / NOT_TESTED</th><th>Source</th></tr></thead>
  <tbody>
  {% for ref in manifest.falsification_refs %}
    <tr>
      <td>{{ ref.claim_text }}</td>
      <td class="verdict-{{ ref.verdict }}">{{ ref.verdict }}</td>
      <td>PASS={{ ref.filters.passed }} / FAIL={{ ref.filters.failed }} / NT={{ ref.filters.not_tested }}</td>
      <td><code>{{ ref.source }}</code></td>
    </tr>
  {% endfor %}
  </tbody>
</table>
{% endif %}

{% for block in manifest.body_blocks %}
{% if block.type == 'heading' %}
<h{{ block.level|default(2) }}>{{ block.text }}</h{{ block.level|default(2) }}>
{% elif block.type == 'paragraph' %}
<p>{% if block.epistemic %}{% for lbl in block.epistemic %}<span class="pill {{ lbl|lower|replace('[','')|replace(']','') }}">{{ lbl }}</span>{% endfor %} {% endif %}{{ block.text }}</p>
{% elif block.type == 'raw' %}
<pre>{{ block.text }}</pre>
{% elif block.type == 'rule' %}
<hr>
{% endif %}
{% endfor %}

{% if manifest.figures %}
<h2>Decision Surface — Figures</h2>
<p><em>Each figure carries epistemic labels [OBS/DER/INT/SPEC] and a P95 uncertainty band
  where physics permits. No map-shaped hallucination.</em></p>
{% for fig in manifest.figures %}
<div style="margin: 12pt 0; padding: 8pt; border: 1px solid #ccc;">
  <h3>{{ fig.title }}</h3>
  <p>
  {% for lbl in fig.epistemic %}
    <span class="pill {{ lbl.value|lower|replace('[','')|replace(']','') }}">{{ lbl.value }}</span>
  {% endfor %}
  </p>
  {% if fig.caption %}<p><em>{{ fig.caption }}</em></p>{% endif %}
  {% if fig.data_payload %}
  <table>
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody>
    {% for k, v in fig.data_payload.items() %}
      <tr><td><strong>{{ k }}</strong></td><td><code>{{ v }}</code></td></tr>
    {% endfor %}
    </tbody>
  </table>
  {% endif %}
  {% if fig.uncertainty_band %}
  <div class="uncertainty">
    <strong>Uncertainty band (F2 TRUTH):</strong>
    <table>
      <thead><tr><th>Variable</th><th>Central</th><th>±1σ</th><th>P95 [low, high]</th><th>Unit</th></tr></thead>
      <tbody>
      {% for var, band in fig.uncertainty_band.items() %}
        <tr>
          <td><strong>{{ var }}</strong></td>
          <td>{{ band.central }}</td>
          <td>±{{ band.sigma_1 }}</td>
          <td>[{{ band.p95_low }}, {{ band.p95_high }}]</td>
          <td>{{ band.unit }}</td>
        </tr>
      {% endfor %}
      </tbody>
    </table>
  </div>
  {% endif %}
  {% if fig.source_uris %}
    <p><strong>Sources:</strong></p>
    <ul>
    {% for u in fig.source_uris %}<li><code>{{ u }}</code></li>{% endfor %}
    </ul>
  {% endif %}
</div>
{% endfor %}
{% endif %}

{% if manifest.organ_evidence_refs %}
<h2>Organ Evidence Anchors</h2>
{% for ref in manifest.organ_evidence_refs %}
<h3>{{ ref.organ }} — {{ ref.tool }}</h3>
<p>{{ ref.summary }}</p>
{% if ref.sha256 %}<pre>sha256: {{ ref.sha256 }}</pre>{% endif %}
{% endfor %}
{% endif %}

</body>
</html>
""")


class WeasyPrintBackend:
    """WeasyPrint HTML+CSS backend. Best for dashboard-style reports."""

    name = "weasyprint"

    def __init__(self):
        self.weasyprint_version = self._safe_version()

    @staticmethod
    def _safe_version() -> str:
        try:
            import weasyprint

            return weasyprint.__version__
        except Exception:
            return "?"

    def render(self, manifest: ArtifactManifest, out_path: Path) -> None:
        html_str = HTML_TEMPLATE.render(
            manifest=manifest,
            weasyprint_version=self.weasyprint_version,
        )
        HTML(string=html_str, url_fetcher=_safe_url_fetcher).write_pdf(str(out_path))
        log.info(
            "WeasyPrint render complete · %s · %d bytes",
            out_path.name,
            out_path.stat().st_size,
        )


def _safe_url_fetcher(url: str, *args, **kwargs):
    """Allow inline data only; manifests cannot read local files or fetch URLs."""
    if not url.startswith("data:"):
        raise ValueError(f"external resource blocked: {url.split(':', 1)[0]}")
    return default_url_fetcher(url, *args, **kwargs)
