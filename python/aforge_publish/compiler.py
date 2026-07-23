"""
AForgePublish — Tier 3 Compiler Sidecar for A-FORGE
======================================================

Constitutional PDF compiler. Three backends (Typst / ReportLab / WeasyPrint)
selected via strategy pattern. Integrations with GEOX, WELL, WEALTH organs
provide physics-validated evidence directly into the artifact.

Forged 2026-07-21 by FORGE (000Ω).
Doctrine: DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .backends.typst_backend import TypstBackend
from .backends.reportlab_backend import ReportLabBackend
from .backends.weasyprint_backend import WeasyPrintBackend
from .types import ArtifactManifest, DecoderPayload, EpistemicLabel, FigureSpec

__version__ = "1.0.0"

log = logging.getLogger("aforge_publish")


SAFE_ARTIFACT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


# ---------------------------------------------------------------------------
# Compiler facade
# ---------------------------------------------------------------------------
class AForgePublishCompiler:
    """Strategy-pattern PDF compiler.

    Pick backend → validate manifest → render → emit receipt.
    """

    BACKEND_REGISTRY = {
        "typst": TypstBackend,
        "reportlab": ReportLabBackend,
        "weasyprint": WeasyPrintBackend,
    }

    def __init__(self, workspace: str | Path | None = None):
        self.workspace = Path(
            workspace
            or os.environ.get(
                "AFORGE_PUBLISH_HOME", "/root/A-FORGE/python/aforge_publish"
            )
        )
        self.artifacts_dir = self.workspace / "artifacts"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        log.info("AForgePublishCompiler ready · workspace=%s", self.workspace)

    # -------------------------------------------------------------------
    # Backend selection
    # -------------------------------------------------------------------
    def _select_backend(self, name: str):
        if name not in self.BACKEND_REGISTRY:
            raise ValueError(
                f"Unknown backend '{name}'. "
                f"Available: {sorted(self.BACKEND_REGISTRY.keys())}"
            )
        return self.BACKEND_REGISTRY[name]()

    # -------------------------------------------------------------------
    # Manifest validation (F2 TRUTH)
    # -------------------------------------------------------------------
    def _validate_manifest(self, manifest: ArtifactManifest) -> list[str]:
        issues: list[str] = []
        if not manifest.figures and not manifest.body_blocks:
            issues.append(
                "F2 TRUTH: artifact has no figures or body — would render empty PDF"
            )
        for fig in manifest.figures:
            if not fig.epistemic:
                issues.append(
                    f"F2 TRUTH: figure '{fig.figure_id}' has no epistemic labels"
                )
            if fig.type not in (
                "map",
                "section",
                "chart",
                "table",
                "equation",
                "residual",
            ):
                issues.append(
                    f"F2 TRUTH: figure '{fig.figure_id}' has unknown type '{fig.type}'"
                )
        if not manifest.sovereign:
            issues.append("F13 SOVEREIGN: manifest missing sovereign")
        if not manifest.actor_id:
            issues.append("F11 AUDIT: manifest missing actor_id")
        if not manifest.session_id:
            issues.append("F11 AUDIT: manifest missing session_id")
        return issues

    # -------------------------------------------------------------------
    # Epistemic rollup
    # -------------------------------------------------------------------
    def _rollup_epistemic(self, manifest: ArtifactManifest) -> dict[str, int]:
        counts = {label.value: 0 for label in EpistemicLabel}
        for fig in manifest.figures:
            for label in fig.epistemic:
                counts[label.value] += 1
        for body in manifest.body_blocks:
            for label in body.get("epistemic", []):
                counts[label] = counts.get(label, 0) + 1
        manifest.epistemic_summary = counts
        return counts

    # -------------------------------------------------------------------
    # Receipt generation (F1 AMANAH + F11 AUDIT)
    # -------------------------------------------------------------------
    def _emit_receipt(
        self,
        manifest: ArtifactManifest,
        pdf_path: Path,
        source_manifest_path: Path | None,
        warnings: list[str],
        elapsed_ms: float,
    ) -> dict[str, Any]:
        pdf_bytes = pdf_path.read_bytes()
        pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        manifest_sha256 = hashlib.sha256(
            json.dumps(asdict(manifest), sort_keys=True, default=str).encode()
        ).hexdigest()
        receipt = {
            "receipt_id": f"art_{uuid.uuid4().hex[:12]}",
            "schema_version": "1.0.0",
            "issued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "artifact_id": manifest.artifact_id,
            "title": manifest.title,
            "tier": manifest.tier,
            "actor_id": manifest.actor_id,
            "sovereign": manifest.sovereign,
            "session_id": manifest.session_id,
            "intent": manifest.intent,
            "backend": manifest.backend,
            "pages": manifest.pages,
            "epistemic_summary": manifest.epistemic_summary,
            "figure_count": len(manifest.figures),
            "body_block_count": len(manifest.body_blocks),
            "falsification_ref_count": len(manifest.falsification_refs),
            "organ_evidence_ref_count": len(manifest.organ_evidence_refs),
            "pdf_path": str(pdf_path),
            "pdf_sha256": pdf_sha256,
            "pdf_bytes": len(pdf_bytes),
            "source_manifest_path": str(source_manifest_path)
            if source_manifest_path
            else None,
            "source_manifest_sha256": manifest_sha256,
            "elapsed_ms": round(elapsed_ms, 2),
            "warnings": warnings,
            "receipt_version": __version__,
            "constitution": {
                "F1_amanah": "source_manifest preserved; pdf sha256 anchored",
                "F2_truth": "epistemic labels: "
                + ", ".join(f"{k}={v}" for k, v in manifest.epistemic_summary.items()),
                "F4_clarity": "single-pass deterministic compile",
                "F11_audit": "actor_id + session_id present",
                "F13_sovereign": f"delivery targets sovereign={manifest.sovereign}",
            },
            "doctrine": "DITEMPA BUKAN DIBERI",
        }
        receipt_path = pdf_path.with_suffix(".receipt.json")
        receipt_path.write_text(json.dumps(receipt, indent=2))
        log.info(
            "RECEIPT emitted · sha256=%s · %d bytes", pdf_sha256[:16], len(pdf_bytes)
        )
        return receipt

    # -------------------------------------------------------------------
    # Main compile entry point
    # -------------------------------------------------------------------
    def compile(
        self, payload: DecoderPayload, source_manifest_path: Path | None = None
    ) -> dict[str, Any]:
        if not isinstance(payload, DecoderPayload):
            raise TypeError("compile() requires a verified DecoderPayload")
        if not payload.metabolizer_output.is_g_space_verified:
            raise ValueError(
                "decoder payload did not survive the verification membrane"
            )
        manifest = payload.artifact_manifest
        t0 = time.time()
        log.info(
            "compile start · id=%s · backend=%s", manifest.artifact_id, manifest.backend
        )

        # Validate (F2 TRUTH)
        issues = self._validate_manifest(manifest)
        warnings = []
        if issues:
            for issue in issues:
                log.warning("VALIDATION: %s", issue)
                warnings.append(issue)
            # Hard fail only on missing sovereign/actor/session (F13/F11 violations)
            hard = [i for i in issues if "F13 SOVEREIGN" in i or "F11 AUDIT" in i]
            if hard:
                raise ValueError(
                    f"Constitutional floor violation — refuse to render: {hard}"
                )

        # Epistemic rollup
        self._rollup_epistemic(manifest)

        # Select backend
        backend = self._select_backend(manifest.backend)

        # ===== AAA HUMAN COGNITIVE RESONANCE FILTER =====
        # Safety net — catches any internal system vocabulary that leaks
        # into the human artifact. The voice_translator handles the
        # primary translation (epistemic tags); this filter scrubs the
        # rest (function names, machine paths, status codes, etc.).
        # If anything survives both, the 8th validator check blocks
        # delivery.
        from .filters import enforce_human_cognitive_resonance

        for fig in manifest.figures:
            fig.title = enforce_human_cognitive_resonance(fig.title)
            fig.caption = enforce_human_cognitive_resonance(fig.caption)
        for blk in manifest.body_blocks:
            if isinstance(blk, dict) and isinstance(blk.get("text"), str):
                blk["text"] = enforce_human_cognitive_resonance(blk["text"])
        for ref in manifest.falsification_refs:
            if isinstance(ref, dict):
                ref["claim_text"] = enforce_human_cognitive_resonance(
                    ref.get("claim_text", "")
                )
                ref["source"] = enforce_human_cognitive_resonance(ref.get("source", ""))
        for ref in manifest.organ_evidence_refs:
            if isinstance(ref, dict):
                for k in ("summary", "tool", "organ"):
                    if k in ref:
                        ref[k] = enforce_human_cognitive_resonance(ref[k])
                if "sha256" in ref:
                    ref["sha256"] = enforce_human_cognitive_resonance(ref["sha256"])
        manifest.intent = enforce_human_cognitive_resonance(manifest.intent)
        manifest.subject = enforce_human_cognitive_resonance(manifest.subject)

        # Resolve output path
        if not SAFE_ARTIFACT_ID.fullmatch(manifest.artifact_id):
            raise ValueError(
                "artifact_id must be a basename containing only letters, digits, '.', '_' or '-'"
            )
        stamp = time.strftime("%Y%m%d-%H%M%S")
        out_name = f"{manifest.artifact_id}_{stamp}.pdf"
        artifacts_root = self.artifacts_dir.resolve()
        pdf_path = (artifacts_root / out_name).resolve()
        if pdf_path.parent != artifacts_root:
            raise ValueError("artifact output escaped artifacts_dir")

        # Render
        try:
            backend.render(manifest, pdf_path)
        except Exception as exc:
            log.exception("Backend '%s' failed", manifest.backend)
            raise RuntimeError(
                f"Compile failed at backend '{manifest.backend}': {exc}"
            ) from exc

        elapsed_ms = (time.time() - t0) * 1000

        # Receipt (F1 AMANAH + F11 AUDIT)
        receipt = self._emit_receipt(
            manifest, pdf_path, source_manifest_path, warnings, elapsed_ms
        )

        return {
            "execution_status": "COMPLETED",
            "judgment_status": "PENDING_ARIFOS",
            "pdf_path": str(pdf_path),
            "pdf_sha256": receipt["pdf_sha256"],
            "pdf_bytes": receipt["pdf_bytes"],
            "receipt": receipt,
            "warnings": warnings,
            "elapsed_ms": elapsed_ms,
        }


__all__ = [
    "AForgePublishCompiler",
    "ArtifactManifest",
    "FigureSpec",
    "EpistemicLabel",
    "DecoderPayload",
]
