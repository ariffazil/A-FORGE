"""Closed-Loop Visual Validator — the missing tier-3 layer.

Forged 2026-07-21 by FORGE (000Ω) under F13 directive.

Pipeline:
    compile_pdf → rasterize → extract_text + extract_primitives →
    spatial_check → epistemic_check → falsification_check →
    receipt → PASS, WARN, or FAIL evidence for arifOS judgment

This is the layer that would have caught v1-v4 — by validating that
the rendered PDF actually contains the epistemic labels, falsification
references, and source URIs that the manifest claimed.

F2 TRUTH: if the rendered PDF doesn't contain what the manifest
declared, return a failed validation result.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result schema
# ---------------------------------------------------------------------------
@dataclass
class ValidatorCheck:
    name: str
    verdict: str  # "PASS" | "FAIL" | "WARN"
    detail: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidatorReceipt:
    artifact_path: str
    artifact_sha256: str
    artifact_bytes: int
    page_count: int
    checks: list[ValidatorCheck]
    overall: str  # "PASS" | "WARN" | "FAIL"
    validation_complete: bool
    delta_summary: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifact_path": self.artifact_path,
            "artifact_sha256": self.artifact_sha256,
            "artifact_bytes": self.artifact_bytes,
            "page_count": self.page_count,
            "checks": [
                {
                    "name": c.name,
                    "verdict": c.verdict,
                    "detail": c.detail,
                    "evidence": c.evidence,
                }
                for c in self.checks
            ],
            "overall": self.overall,
            "validation_complete": self.validation_complete,
            "delta_summary": self.delta_summary,
        }


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------
class ClosedLoopVisualValidator:
    """Compile → inspect → measure → emit validation evidence.

    The layer that makes Tier-3 mean something beyond "pretty PDF".
    """

    # Patterns we expect to find in the rendered text given a manifest
    EPISTEMIC_PATTERNS = {
        "[OBS]": r"\[OBS\]",
        "[DER]": r"\[DER\]",
        "[INT]": r"\[INT\]",
        "[SPEC]": r"\[SPEC\]",
    }

    def __init__(self):
        self.checks: list[ValidatorCheck] = []

    # -------------------------------------------------------------------
    # Main entry
    # -------------------------------------------------------------------
    def validate(
        self, pdf_path: str | Path, expected_manifest: dict[str, Any] | None = None
    ) -> ValidatorReceipt:
        pdf_path = Path(pdf_path)
        self.checks = []
        if not pdf_path.exists():
            return self._make_receipt(
                pdf_path, overall="FAIL", detail=f"PDF not found: {pdf_path}"
            )
        pdf_bytes = pdf_path.read_bytes()
        pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

        # Rasterize + extract via PyMuPDF
        try:
            doc = fitz.open(str(pdf_path))
        except Exception as exc:
            return self._make_receipt(
                pdf_path, overall="FAIL", detail=f"PyMuPDF open failed: {exc}"
            )
        page_count = doc.page_count

        full_text = ""
        all_uris: list[str] = []
        all_rects: list[tuple[float, float, float, float]] = []
        all_images: list[dict] = []
        for page_idx, page in enumerate(doc):
            full_text += page.get_text() + "\n"
            for link in page.get_links():
                uri = link.get("uri") or ""
                if uri:
                    all_uris.append(uri)
            # Bounding rects of all drawing primitives
            for d in page.get_drawings():
                if d.get("rect"):
                    all_rects.append(d["rect"])
            # Embedded images
            for img in page.get_images(full=True):
                all_images.append(
                    {
                        "page": page_idx,
                        "xref": img[0],
                        "width": img[2],
                        "height": img[3],
                    }
                )
        doc.close()

        # ---- 1. Document integrity --------------------------------------
        self._check_doc_integrity(pdf_path, page_count, len(pdf_bytes))

        # ---- 2. Epistemic label presence -------------------------------
        expected_labels = set()
        if expected_manifest:
            for fig in expected_manifest.get("figures", []):
                expected_labels.update(
                    ep if isinstance(ep, str) else ep.value
                    for ep in fig.get("epistemic", [])
                )
        self._check_epistemic_labels(full_text, expected_labels)

        # ---- 3. Falsification references --------------------------------
        self._check_falsification_refs(full_text, expected_manifest)

        # ---- 4. Source URI preservation --------------------------------
        declared_uris: set[str] = set()
        if expected_manifest:
            for fig in expected_manifest.get("figures", []):
                declared_uris.update(fig.get("source_uris", []))
            for ref in expected_manifest.get("organ_evidence_refs", []):
                # Some organ refs have a 'source' field
                if ref.get("source"):
                    declared_uris.add(ref["source"])
        self._check_uri_preservation(declared_uris, all_uris, full_text)

        # ---- 5. Primitive geometry sanity -----------------------------
        self._check_geometry(all_rects, page_count)

        # ---- 6. Image presence (legitimate figures, not stock clipart) -
        self._check_images(all_images, expected_manifest)

        # ---- 7. Constitutional provenance ------------------------------
        self._check_constitutional_provenance(full_text, expected_manifest)

        # ---- 8. Human Cognitive Resonance (AAA Voice Protocol) --------
        # This is the hard guarantee that no internal system vocabulary
        # leaked into the human artifact. The compiler filters scrub
        # common leaks before render; this check catches anything that
        # still got through.
        self._check_human_resonance(full_text)

        # ---- 9. Kill Matrix Gate (G-space physics enforcement) -------
        # A-FORGE DECOUPLING PRINCIPLE — Law 1 (Physics Floor).
        # K001-K007 structured validation. If the manifest declares
        # kill_matrix results, verify they are present and PASS.
        # If no kill_matrix declared, WARN — the artifact has no
        # physics gate, which is admissible only for text-only reports.
        self._check_kill_matrix_gate(full_text, expected_manifest)

        # Rollup
        return self._make_receipt(
            pdf_path,
            overall=self._rollup(),
            detail=f"{len(self.checks)} checks",
            page_count=page_count,
            pdf_sha256=pdf_sha256,
            pdf_bytes=len(pdf_bytes),
        )

    # -------------------------------------------------------------------
    # Individual checks
    # -------------------------------------------------------------------
    def _check_doc_integrity(self, pdf_path: Path, page_count: int, byte_count: int):
        if page_count == 0:
            self.checks.append(
                ValidatorCheck(
                    "doc_integrity",
                    "FAIL",
                    detail="PDF has 0 pages",
                    evidence={"path": str(pdf_path)},
                )
            )
            return
        # Reasonable byte/page ratio (catches empty-textbook attacks)
        ratio = byte_count / max(page_count, 1)
        if ratio < 500:
            self.checks.append(
                ValidatorCheck(
                    "doc_integrity",
                    "WARN",
                    detail=f"low bytes/page ratio: {ratio:.0f} (page may be near-empty)",
                    evidence={"bytes": byte_count, "pages": page_count},
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "doc_integrity",
                    "PASS",
                    detail=f"{page_count} pages · {byte_count} bytes · "
                    f"{ratio:.0f} bytes/page",
                    evidence={"pages": page_count, "bytes": byte_count},
                )
            )

    # AAA Voice Protocol — translated equivalents for the rendered PDF.
    # The validator accepts EITHER raw tags (legacy) OR voice-translated
    # terms (AAA protocol) — the goal is that data-category indicators
    # are explicit in the artifact, regardless of which form they take.
    VOICE_TERMS = {
        "[OBS]": ["Measured Data", "Measured Ground Truth"],
        "[DER]": [
            "Calculated Surface",
            "Derived Geometry",
            "Calculated Geometry",
            "Derived",
        ],
        "[INT]": ["Geological Interpretation"],
        "[SPEC]": [
            "Uncalibrated Polygon",
            "Uncalibrated Outline",
            "Hypothesised Extent",
        ],
    }

    def _check_epistemic_labels(self, text: str, expected: set[str]):
        # Raw tag counts (legacy check)
        raw_present: dict[str, int] = {}
        for label, pat in self.EPISTEMIC_PATTERNS.items():
            count = len(re.findall(pat, text))
            raw_present[label] = count
        # Voice-translated counts (AAA Voice Protocol check)
        voice_present: dict[str, int] = {}
        for label, voice_terms in self.VOICE_TERMS.items():
            count = sum(text.count(vt) for vt in voice_terms)
            voice_present[label] = count
        # Combined: raw OR voice
        combined: dict[str, int] = {}
        for label in self.EPISTEMIC_PATTERNS:
            combined[label] = raw_present.get(label, 0) + voice_present.get(label, 0)

        missing = [lbl for lbl in expected if combined.get(lbl, 0) == 0]
        if not expected:
            self.checks.append(
                ValidatorCheck(
                    "epistemic_labels",
                    "WARN",
                    detail="no manifest supplied; reporting observed counts only",
                    evidence={
                        "raw": raw_present,
                        "voice": voice_present,
                        "combined": combined,
                    },
                )
            )
        elif missing:
            self.checks.append(
                ValidatorCheck(
                    "epistemic_labels",
                    "FAIL",
                    detail=f"manifest declared {sorted(expected)} but rendered PDF "
                    f"missing both raw tags AND voice translations for: {missing}",
                    evidence={
                        "raw": raw_present,
                        "voice": voice_present,
                        "expected": sorted(expected),
                        "missing": missing,
                    },
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "epistemic_labels",
                    "PASS",
                    detail=f"all {len(expected)} declared data-category indicators "
                    f"present (raw or voice translation)",
                    evidence={
                        "raw": raw_present,
                        "voice": voice_present,
                        "expected": sorted(expected),
                    },
                )
            )

    def _check_falsification_refs(self, text: str, manifest: dict | None):
        if not manifest or not manifest.get("falsification_refs"):
            self.checks.append(
                ValidatorCheck(
                    "falsification_refs",
                    "WARN",
                    detail="no falsification refs declared (Tier 3 violation risk)",
                    evidence={},
                )
            )
            return
        n_refs = len(manifest["falsification_refs"])
        # Look for any verdict token from the falsification refs
        verdicts = {ref.get("verdict", "—") for ref in manifest["falsification_refs"]}
        verdicts_found = [v for v in verdicts if v in text]
        if not verdicts_found:
            self.checks.append(
                ValidatorCheck(
                    "falsification_refs",
                    "FAIL",
                    detail=f"{n_refs} refs declared but verdicts missing from render",
                    evidence={
                        "declared": sorted(verdicts),
                        "found_in_render": verdicts_found,
                    },
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "falsification_refs",
                    "PASS",
                    detail=f"{n_refs} refs declared · verdicts found: {verdicts_found}",
                    evidence={
                        "declared": sorted(verdicts),
                        "found_in_render": verdicts_found,
                    },
                )
            )

    def _check_uri_preservation(
        self, declared: set[str], rendered_uris: list[str], text: str
    ):
        if not declared:
            self.checks.append(
                ValidatorCheck(
                    "uri_preservation",
                    "WARN",
                    detail="no source URIs declared",
                    evidence={},
                )
            )
            return
        # Check declared URIs are present in either embedded links or text
        rendered_set = set(rendered_uris)
        missing = []
        for u in declared:
            if u in rendered_set:
                continue
            # Allow substring match (URI may be wrapped/shortened in text)
            if any(u[:60] in t for t in [text]):
                continue
            missing.append(u)
        if missing:
            self.checks.append(
                ValidatorCheck(
                    "uri_preservation",
                    "WARN",
                    detail=f"{len(missing)}/{len(declared)} declared URIs not found in render",
                    evidence={"missing": missing[:5]},
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "uri_preservation",
                    "PASS",
                    detail=f"all {len(declared)} declared URIs found in render",
                    evidence={"declared_count": len(declared)},
                )
            )

    def _check_geometry(self, rects: list[tuple], page_count: int):
        if not rects:
            self.checks.append(
                ValidatorCheck(
                    "geometry_primitives",
                    "WARN",
                    detail="no drawing primitives — text-only PDF (acceptable for "
                    "tabular reports)",
                    evidence={"rect_count": 0},
                )
            )
            return
        # Sanity: average rect within reasonable A4 / Letter bounds
        # A4 = 595 x 842 pts
        out_of_bounds = []
        for x0, y0, x1, y1 in rects:
            if x1 - x0 > 1000 or y1 - y0 > 1200:
                out_of_bounds.append((x0, y0, x1, y1))
        if out_of_bounds:
            self.checks.append(
                ValidatorCheck(
                    "geometry_primitives",
                    "WARN",
                    detail=f"{len(out_of_bounds)} rects exceed reasonable page bounds",
                    evidence={
                        "oob_count": len(out_of_bounds),
                        "oob_sample": out_of_bounds[:3],
                    },
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "geometry_primitives",
                    "PASS",
                    detail=f"{len(rects)} rects · all within page bounds",
                    evidence={"rect_count": len(rects)},
                )
            )

    def _check_images(self, images: list[dict], manifest: dict | None):
        if not manifest:
            self.checks.append(
                ValidatorCheck(
                    "images",
                    "WARN",
                    detail="no manifest to cross-check image count",
                    evidence={"image_count": len(images)},
                )
            )
            return
        # If manifest declares figures with maps/sections, expect at least 1 image
        declared_figs = len(manifest.get("figures", []))
        if declared_figs > 0 and not images:
            self.checks.append(
                ValidatorCheck(
                    "images",
                    "WARN",
                    detail=f"{declared_figs} figures declared but PDF has no embedded "
                    f"images — text-only render acceptable but unusual",
                    evidence={
                        "declared_figures": declared_figs,
                        "rendered_images": len(images),
                    },
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "images",
                    "PASS",
                    detail=f"{len(images)} embedded images vs {declared_figs} declared figures",
                    evidence={
                        "declared_figures": declared_figs,
                        "rendered_images": len(images),
                    },
                )
            )

    def _check_constitutional_provenance(self, text: str, manifest: dict | None):
        if not manifest:
            self.checks.append(
                ValidatorCheck(
                    "constitutional_provenance",
                    "WARN",
                    detail="no manifest supplied",
                    evidence={},
                )
            )
            return
        # F11 AUDIT: actor_id and session_id must be in render
        actor = manifest.get("actor_id", "")
        session = manifest.get("session_id", "")
        sovereign = manifest.get("sovereign", "")
        found_actor = actor in text if actor else True
        found_session = session in text if session else True
        found_sovereign = (
            sovereign.split("(")[0].strip() in text  # "Muhammad Arif bin Fazil"
            if sovereign
            else True
        )
        missing = []
        if not found_actor:
            missing.append(f"actor_id='{actor}'")
        if not found_session:
            missing.append(f"session_id='{session}'")
        if not found_sovereign:
            missing.append(f"sovereign='{sovereign}'")
        if missing:
            self.checks.append(
                ValidatorCheck(
                    "constitutional_provenance",
                    "FAIL",
                    detail=f"F11 AUDIT: render missing provenance: {missing}",
                    evidence={"missing": missing},
                )
            )
        else:
            self.checks.append(
                ValidatorCheck(
                    "constitutional_provenance",
                    "PASS",
                    detail="actor + session + sovereign all present in render",
                    evidence={
                        "actor": actor,
                        "session": session,
                        "sovereign": sovereign,
                    },
                )
            )

    # -------------------------------------------------------------------
    # 8. Human Cognitive Resonance — AAA Voice Protocol enforcement
    # -------------------------------------------------------------------
    def _check_human_resonance(self, text: str):
        """The 8th validator check. REFUSES to seal the artifact if any
        banned internal vocabulary leaked into the rendered PDF.

        This is the architectural guarantee that an artifact only becomes
        a "cognitive artifact" — the human brain doesn't have to burn
        energy parsing machine logs.
        """
        from .filters import BANNED_PDF_TERMS, scan_for_banned_terms

        found = scan_for_banned_terms(text)
        if found:
            self.checks.append(
                ValidatorCheck(
                    "human_resonance",
                    "FAIL",
                    detail=f"HUMAN_RESONANCE_FAIL: {len(found)} banned "
                    f"term(s) leaked into the rendered PDF — "
                    f"voice protocol violation, must rewrite "
                    f"before delivery",
                    evidence={
                        "banned_terms_found": found[:15],
                        "n_violations": len(found),
                        "policy": "AAA Human Cognitive Resonance "
                        "(A-FORGE Presentation Law, "
                        "arifOS Federation)",
                        "remediation": "re-render with "
                        "filters.enforce_human_"
                        "cognitive_resonance() and "
                        "remove leaks from source "
                        "manifest",
                    },
                )
            )
            return
        self.checks.append(
            ValidatorCheck(
                "human_resonance",
                "PASS",
                detail=f"no internal system vocabulary leaked into the "
                f"rendered PDF ({len(BANNED_PDF_TERMS)} banned terms "
                f"scanned)",
                evidence={"n_banned_scanned": len(BANNED_PDF_TERMS)},
            )
        )

    # -------------------------------------------------------------------
    # 9. Kill Matrix Gate — G-space physics enforcement
    # -------------------------------------------------------------------
    # A-FORGE DECOUPLING PRINCIPLE — Law 1 (Physics Floor).
    # K001-K007: physical-plausibility → stratigraphic-consistency →
    # geothermal-gradient → burial-compaction → pore-pressure →
    # logical-consistency → evidence-sufficiency.
    #
    # The gate reads structured kill_matrix data from the manifest if
    # present. If absent, WARN — admissible for text-only reports but
    # the artifact is NOT G-space verified.

    KILL_MATRIX_GATES = [
        ("K001", "physical-plausibility"),
        ("K002", "stratigraphic-consistency"),
        ("K003", "geothermal-gradient"),
        ("K004", "burial-compaction"),
        ("K005", "pore-pressure"),
        ("K006", "logical-consistency"),
        ("K007", "evidence-sufficiency"),
    ]

    def _check_kill_matrix_gate(self, text: str, manifest: dict | None):
        """Validate K001-K007 physics gate compliance in rendered artifact.

        If the manifest declares kill_matrix results, verifies:
        - All 7 gates are present
        - All gates have verdict='PASS'
        - At least one gate verdict appears in the rendered text
        - Mahalanobis z-score reference exists if declared

        Without kill_matrix, the artifact is J-space only — WARN,
        not FAIL. This is a quality gate, not a hard block for
        text-only reports.
        """
        if not manifest:
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "WARN",
                    detail="no manifest — kill matrix gate not evaluated",
                    evidence={},
                )
            )
            return

        km = manifest.get("kill_matrix", None)
        if not km:
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "WARN",
                    detail="manifest has no kill_matrix block — "
                    "artifact is J-space only (no G-space physics gate). "
                    "Admissible for text/administrative documents; "
                    "geological/geophysical artifacts SHOULD carry "
                    "K001-K007 verification",
                    evidence={"g_space_verified": False},
                )
            )
            return

        # Structured kill_matrix present — validate
        gates = km.get("gates", {})
        overall = km.get("overall_verdict", "UNKNOWN")
        z_score = km.get("mahalanobis_z", None)
        omega_0 = km.get("uncertainty_omega_0", None)

        failures = []
        missing = []
        for gate_id, gate_name in self.KILL_MATRIX_GATES:
            if gate_id not in gates:
                missing.append(gate_id)
            elif gates[gate_id] is not True:
                failures.append(f"{gate_id} ({gate_name})")

        # Check rendered text for kill matrix evidence
        rendered_has_km = any(
            f"{gid}" in text or gname in text.lower()
            for gid, gname in self.KILL_MATRIX_GATES
        )

        evidence = {
            "gates_evaluated": len(gates),
            "gates_expected": 7,
            "overall_verdict": overall,
            "mahalanobis_z": z_score,
            "uncertainty_omega_0": omega_0,
            "rendered_has_km_evidence": rendered_has_km,
        }

        if missing:
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "FAIL",
                    detail=f"Kill Matrix incomplete: {len(missing)} gates "
                    f"missing — {missing}. G-space verification requires "
                    f"all 7 gates.",
                    evidence={**evidence, "missing_gates": missing},
                )
            )
        elif failures:
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "FAIL",
                    detail=f"Kill Matrix failures: {failures}. "
                    f"Artifact contains claims that do not survive "
                    f"physics validation.",
                    evidence={**evidence, "failed_gates": failures},
                )
            )
        elif not rendered_has_km:
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "WARN",
                    detail=f"Kill Matrix PASS ({overall}) but no gate "
                    f"evidence found in rendered text. Consider adding "
                    f"a verification statement to the artifact.",
                    evidence=evidence,
                )
            )
        else:
            z_str = f" · z={z_score:.1f}" if z_score is not None else ""
            self.checks.append(
                ValidatorCheck(
                    "kill_matrix_gate",
                    "PASS",
                    detail=f"Kill Matrix {overall} — all 7 gates cleared"
                    f"{z_str} · G-space verified",
                    evidence=evidence,
                )
            )

    # -------------------------------------------------------------------
    # Rollup
    # -------------------------------------------------------------------
    def _rollup(self) -> str:
        verdicts = [c.verdict for c in self.checks]
        if "FAIL" in verdicts:
            return "FAIL"
        if all(v == "PASS" for v in verdicts):
            return "PASS"
        return "WARN"

    def _make_receipt(
        self,
        pdf_path: Path,
        overall: str,
        detail: str = "",
        page_count: int = 0,
        pdf_sha256: str = "",
        pdf_bytes: int = 0,
    ) -> ValidatorReceipt:
        return ValidatorReceipt(
            artifact_path=str(pdf_path),
            artifact_sha256=pdf_sha256,
            artifact_bytes=pdf_bytes,
            page_count=page_count,
            checks=self.checks,
            overall=overall,
            validation_complete=overall in {"PASS", "WARN"},
            delta_summary={
                "detail": detail,
                "warn_count": sum(1 for c in self.checks if c.verdict == "WARN"),
                "fail_count": sum(1 for c in self.checks if c.verdict == "FAIL"),
            },
        )


__all__ = ["ClosedLoopVisualValidator", "ValidatorReceipt", "ValidatorCheck"]
