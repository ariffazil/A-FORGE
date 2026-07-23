#!/usr/bin/env python3
"""AForgePublish CLI — Tier 3 compiler driver.

Usage:
  aforge-publish compile <manifest.yaml> [--backend typst|reportlab|weasyprint] [--out PATH]
  aforge-publish probe [geox|well|wealth|arifos]
  aforge-publish demo  # build a Malay Basin Tier-3 example artifact
  aforge-publish forge-basin --basin "Malay Basin" --send-telegram

DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Allow running as script without install
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from aforge_publish import (
    AForgePublishCompiler,
    ArtifactManifest,
    DecoderPayload,
    FigureSpec,
    EpistemicLabel,
    KillMatrixResult,
    KillMatrixVerdict,
    MetabolizerOutput,
)
from aforge_publish.validator import ClosedLoopVisualValidator
from aforge_publish.integrations.geox_hook import GeoxHook
from aforge_publish.integrations.well_hook import WellHook
from aforge_publish.integrations.wealth_hook import WealthHook
from aforge_publish.integrations.organ_hooks import ArifOSHook

log_level = os.environ.get("AFORGE_LOG", "INFO")
logging.basicConfig(
    level=log_level, format="%(asctime)s · %(name)s · %(levelname)s · %(message)s"
)
log = logging.getLogger("aforge_publish.cli")


SOVEREIGN = "Muhammad Arif bin Fazil (F13)"


def cmd_compile(args):
    import yaml

    with open(args.manifest) as f:
        raw = yaml.safe_load(f)
    payload = _payload_from_dict(raw)
    compiler = AForgePublishCompiler()
    result = compiler.compile(payload, source_manifest_path=Path(args.manifest))
    print(
        json.dumps(
            {
                "execution_status": result["execution_status"],
                "judgment_status": result["judgment_status"],
                "pdf_path": result["pdf_path"],
                "pdf_sha256": result["pdf_sha256"],
                "pdf_bytes": result["pdf_bytes"],
                "elapsed_ms": result["elapsed_ms"],
                "warnings": result["warnings"],
                "epistemic_summary": result["receipt"]["epistemic_summary"],
            },
            indent=2,
        )
    )
    return 0


def cmd_probe(args):
    organ = args.organ or "geox"
    hooks = {
        "geox": GeoxHook,
        "well": WellHook,
        "wealth": WealthHook,
        "arifos": ArifOSHook,
    }
    hook = hooks[organ]()
    print(f"[{organ}] {hook.base_url}/health")
    print(json.dumps(hook.probe(), indent=2, default=str))
    return 0


def cmd_demo(args):
    """Build the Malay Basin Tier-3 demo artifact with real EMAG2 evidence."""
    import json as _json

    # Load the pre-built evidence
    base = Path("/tmp/tier3_sundaland")
    with open(base / "competing_models.json") as f:
        models = _json.load(f)
    with open(base / "basin_mag_samples.json") as f:
        _json.load(f)
    with open(base / "emag2_meta.json") as f:
        emag_meta = _json.load(f)

    # Build figures
    figures = []

    # Figure 1: EMAG2 magnetic anomaly at 15 Sundaland basin centres
    fig1_payload = {
        "source": "EMAG2_V3 (NOAA/NCEI), 2 arc-min global magnetic anomaly grid",
        "grid_extent": "Sundaland (lon 90-145E, lat 20N-20S)",
        "pixel_resolution_deg": emag_meta["pixel_indices"],
        "stats_nT": emag_meta["stats_nT"],
        "valid_pixel_pct": round(emag_meta["valid_pct"], 1),
        "license": "Public domain (NOAA)",
        "interpretation_note": (
            "Low/negative magnetic anomaly over deep sediment basins (Malay, NW Java, "
            "Beibuwan) reflects signal attenuation through 6-14 km non-magnetic sediment. "
            "Positive anomalies at South/North Sumatra, Andaman Sea suggest thinner sediment "
            "cover or exposed igneous basement."
        ),
    }
    fig1_uncertainty = {
        "EMAG2 measurement noise": {
            "central": 0.0,
            "sigma_1": 2.0,
            "p95_low": -3.9,
            "p95_high": 3.9,
            "unit": "nT",
        },
        "cross-basin spatial uncertainty": {
            "central": 0.0,
            "sigma_1": 5.0,
            "p95_low": -9.8,
            "p95_high": 9.8,
            "unit": "nT",
        },
    }
    figures.append(
        FigureSpec(
            figure_id="fig-01-emag2-sundaland",
            title="EMAG2 Magnetic Anomaly · Sundaland 15 Basin Centres",
            type="map",
            epistemic=[EpistemicLabel.OBS],
            source_uris=[
                "/root/.cache/geox/emag2/EMAG2_V3_UpCont_DataTiff.tif",
                "https://www.ncei.noaa.gov/products/earth-magnetic-model-anomaly-grid",
            ],
            data_payload=fig1_payload,
            uncertainty_band=fig1_uncertainty,
            caption="[OBS] Magnetic anomaly at basin centres sampled from EMAG2v3 (2 arc-min). "
            "Negative anomalies mark deep sediment basins; positive anomalies mark "
            "thin sediment or exposed igneous basement.",
        )
    )

    # Figure 2: Competing structural models for Malay Basin
    fig2_payload = {
        "note": "Three competing models tested against EMAG2 magnetic observation"
    }
    fig2_uncertainty = {}
    for name, m in models.items():
        p = m["model_predictions_test"]
        pred = p["mag_predicted_nT"]
        comb = p["combined_uncertainty_1sigma_nT"]
        var_key = f"{m['category']} model · {name.split(' — ')[0]}"
        fig2_uncertainty[var_key] = {
            "central": round(pred, 2),
            "sigma_1": round(comb, 2),
            "p95_low": round(pred - 1.96 * comb, 2),
            "p95_high": round(pred + 1.96 * comb, 2),
            "unit": "nT",
        }
    figures.append(
        FigureSpec(
            figure_id="fig-02-malay-3model-falsification",
            title="Malay Basin · 3-Competing-Model Structural Falsification",
            type="section",
            epistemic=[EpistemicLabel.OBS, EpistemicLabel.INT, EpistemicLabel.SPEC],
            source_uris=[
                "/data/wells/MALAY_BASIN_MADON_2021_GSM72.pdf",
                "/root/.cache/geox/emag2/EMAG2_V3_UpCont_DataTiff.tif",
                "geox_falsify(claim='Malay Basin rift-sag Cenozoic province')",
            ],
            data_payload=fig2_payload,
            uncertainty_band=fig2_uncertainty,
            caption="Three competing structural models forward-modeled against EMAG2 magnetic "
            "observation at Malay Basin centre. Model A (pure continental) survives "
            "weakly (z=2.17). Model B (rift-sag passive margin) survives cleanly "
            "(z=0.03, matches Madon 2021 published interpretation). Model C "
            "(underplated continental) FALSIFIED at z=3.11.",
        )
    )

    # Falsification block
    falsification_refs = [
        {
            "claim_text": "Sundaland basin architecture can be classified from USGS OFR 97-470F "
            "polygons as the primary evidence base",
            "verdict": "INCONCLUSIVE",
            "filters": {"passed": 2, "failed": 0, "not_tested": 5},
            "source": "geox_falsify(mode='full') — 5/7 K-filters NOT_TESTED",
        },
        {
            "claim_text": "Malay Basin classification as rift-sag Cenozoic province is consistent "
            "with multi-physics evidence (gravity + magnetics + backstripping + thermal maturity)",
            "verdict": "INCONCLUSIVE",
            "filters": {"passed": 2, "failed": 0, "not_tested": 5},
            "source": "geox_falsify(mode='full') — 5/7 K-filters NOT_TESTED pending gravity grid + wells",
        },
        {
            "claim_text": "Malay Basin Model B (rift-sag passive margin) matches observed magnetic "
            "anomaly within ±2σ combined uncertainty",
            "verdict": "KILL_MATRIX_PASS",
            "filters": {"passed": 7, "failed": 0, "not_tested": 0},
            "source": "Tier-3 3-model falsification · z=0.03 · within Madon 2021 published geometry",
        },
    ]

    # Body blocks
    body_blocks = [
        {
            "type": "heading",
            "level": 1,
            "text": "🌋 SUNDALAND BASIN — TIER 3 MULTI-PHYSICS INVERSION",
        },
        {
            "type": "paragraph",
            "epistemic": ["[INT]"],
            "text": "A geoscientist's Tier-3 decision surface for Sundaland basin architecture. "
            "Built on EMAG2v3 magnetic observation + Madon (2021) literature anchor + "
            "3-model structural falsification. Other 94 of 95 USGS polygons in the region "
            "are explicitly marked [SPEC] — no physics evidence available for them in "
            "this session. F2 TRUTH = no claim rendered as fact without surviving the "
            "7-filter Kill Matrix.",
        },
        {
            "type": "heading",
            "level": 2,
            "text": "1. WHY THIS IS DIFFERENT FROM PRIOR v1-v4 PDFs",
        },
        {
            "type": "paragraph",
            "text": (
                "The previous agent's basin classification PDFs (v1 08:03, v2 08:11, v3 08:17, "
                "v4 08:26) were Tier 2 legacy-shapefile plots. They showed 95 USGS polygons with "
                "no uncertainty bands, no epistemic labels, no multi-physics, and no falsification. "
                "geox_falsify returned INCONCLUSIVE (5 of 7 K-filters NOT_TESTED) but the agent "
                "published anyway. This artifact corrects that: physics evidence drives the "
                "decision surface, every figure carries epistemic labels, and the 7-filter Kill "
                "Matrix is honestly tested where data permits."
            ),
        },
        {"type": "heading", "level": 2, "text": "2. EVIDENCE INVENTORY"},
        {
            "type": "raw",
            "text": (
                "Magnetic observation:  EMAG2_V3_UpCont_DataTiff.tif  (229 MB NOAA public)\n"
                "Literature anchor:      MADON_2021_GSM72.pdf  (Bull. Geol. Soc. Malaysia 72)\n"
                "Basin profile:          GEOX workspace, Madon 2021 synthesis\n"
                "Falsification engine:   geox_falsify(mode='full') with K001-K007\n"
                "F2 compliance:          5/7 K-filters tested where evidence permits\n"
                "MISSING for Tier-3+:    Bouguer gravity grid, real LAS wells, SEG-Y seismic, "
                "                          Crust1.0 model — all marked [SPEC]"
            ),
        },
        {"type": "rule"},
        {
            "type": "heading",
            "level": 2,
            "text": "3. EPISTEMIC ROLLUP (across this artifact)",
        },
        {
            "type": "paragraph",
            "epistemic": ["[OBS]"],
            "text": "EMAG2 magnetic observation at 15 Sundaland basin centres. Real geophysical "
            "measurement at 2 arc-min global resolution. Low/negative values over deep "
            "sediment basins (Malay, NW Java, Beibuwan) consistent with signal attenuation.",
        },
        {
            "type": "paragraph",
            "epistemic": ["[DER]"],
            "text": "Derived layer: basin centre anomaly extracted from 5x5 pixel patches of EMAG2 "
            "grid (10 arc-min smoothing kernel). Standard deviation per basin = spatial "
            "uncertainty on the [OBS] value.",
        },
        {
            "type": "paragraph",
            "epistemic": ["[INT]"],
            "text": "Interpreted layer: 3-model structural framework for Malay Basin. Model "
            "categories (CONSERVATIVE/RECOMMENDED/AGGRESSIVE) correspond to canonical "
            "tectonic regimes. Predicted magnetic anomaly per model uses empirical "
            "priors calibrated to global magnetic anomaly studies (Maus et al. 2009).",
        },
        {
            "type": "paragraph",
            "epistemic": ["[SPEC]"],
            "text": "94 of 95 Sundaland basin polygons rendered in prior PDFs are explicitly "
            "marked [SPEC] here. They appear in the regional EMAG2 magnetic map with "
            "their measured anomaly values where data permits, but no subsurface "
            "structural model has been built or falsified for them in this session.",
        },
    ]

    # Organ evidence anchors
    organ_evidence_refs = [
        {
            "organ": "GEOX",
            "tool": "geox_basin(mode=profile)",
            "summary": "Malay Basin profile returned HIGH-confidence tectonic history (Madon 2021) "
            "with 700+ wells drilled, 14.8 bboe recoverable, Groups J/I/K = 60% resources.",
            "sha256": "trace-81d33f1f40644280 (live session)",
        },
        {
            "organ": "GEOX",
            "tool": "geox_falsify(mode=full)",
            "summary": "K001-K007 Kill Matrix run. 5/7 NOT_TESTED for basin classification claims "
            "(missing gravity grid, geothermal gradient, well logs). Model B Malay "
            "rift-sag survives cleanly (z=0.03).",
            "sha256": "trace-f12f57c0 (live session)",
        },
        {
            "organ": "EMAG2",
            "tool": "EMAG2_V3_UpCont_DataTiff.tif",
            "summary": "229 MB NOAA public-domain magnetic anomaly grid at 2 arc-min. Sundaland "
            "crop extracted (1501x1651 pixels). 15 basin centres sampled.",
            "sha256": "(file on disk — verifiable via /root/.cache/geox/emag2/)",
        },
    ]

    # Manifest
    manifest = ArtifactManifest(
        artifact_id="tier3-sundaland-malay-2026-07-21",
        title="Sundaland Basin — Tier 3 Multi-Physics Inversion",
        subject="EMAG2 magnetic + Madon 2021 literature + 3-model falsification",
        sovereign=SOVEREIGN,
        actor_id="arif",
        session_id="SEAL-454e3a09d5ff40e0",
        intent="Tier 3 honest basin inversion — Malay only physics-evidenced, "
        "other 94 marked [SPEC]",
        backend=args.backend
        if hasattr(args, "backend") and args.backend
        else "reportlab",
        pages="A4",
        tier="AAA",
        figures=figures,
        body_blocks=body_blocks,
        falsification_refs=falsification_refs,
        organ_evidence_refs=organ_evidence_refs,
        metadata={
            "delivered_to": "@ariffazil",
            "constitutional_floors": ["F1", "F2", "F4", "F7", "F11", "F13"],
            "doctrine": "DITEMPA BUKAN DIBERI",
        },
    )

    compiler = AForgePublishCompiler()
    raise RuntimeError(
        "demo contains NOT_TESTED Kill Matrix gates and cannot cross the DecoderPayload membrane"
    )
    result = compiler.compile(manifest)  # pragma: no cover - fail-closed legacy example
    pdf_path = result["pdf_path"]

    # Closed-loop visual validation — the layer that catches Tier-2
    # hallucinations masquerading as Tier-3 artifacts
    manifest_dict = {
        "artifact_id": manifest.artifact_id,
        "actor_id": manifest.actor_id,
        "sovereign": manifest.sovereign,
        "session_id": manifest.session_id,
        "intent": manifest.intent,
        "falsification_refs": manifest.falsification_refs,
        "figures": [
            {"epistemic": [e.value for e in f.epistemic], "source_uris": f.source_uris}
            for f in manifest.figures
        ],
        "organ_evidence_refs": manifest.organ_evidence_refs,
    }
    validator = ClosedLoopVisualValidator()
    vresult = validator.validate(pdf_path, manifest_dict)
    validator_path = Path(pdf_path).with_suffix(".validator.json")
    validator_path.write_text(json.dumps(vresult.to_dict(), indent=2))

    print(
        json.dumps(
            {
                "execution_status": result["execution_status"],
                "judgment_status": result["judgment_status"],
                "pdf_path": result["pdf_path"],
                "pdf_sha256": result["pdf_sha256"],
                "pdf_bytes": result["pdf_bytes"],
                "epistemic_summary": result["receipt"]["epistemic_summary"],
                "validator": {
                    "overall": vresult.overall,
                    "validation_complete": vresult.validation_complete,
                    "warn": vresult.delta_summary.get("warn_count"),
                    "fail": vresult.delta_summary.get("fail_count"),
                    "checks": [
                        {"name": c.name, "verdict": c.verdict} for c in vresult.checks
                    ],
                },
                "warnings": result["warnings"],
            },
            indent=2,
        )
    )

    # Optional delivery to sovereign's Telegram via Hermes courier
    if args.send_telegram:
        _deliver_via_hermes(
            basin="Malay Basin Tier 3",
            session_id=manifest.session_id,
            pdf_path=Path(pdf_path),
            validation=vresult,
        )
    return 0


def cmd_forge_basin(args):
    """Pull live evidence from GEOX and compile + deliver."""
    arifos = ArifOSHook()
    geox = GeoxHook()
    well = WellHook()

    sess = arifos.session_init(
        actor_id=args.actor or "arif",
        intent=f"Tier 3 basin compile: {args.basin}",
    )
    session_id = (sess.get("result") or {}).get("session_id", "")
    log.info("session: %s", session_id)

    # Pull evidence
    profile = geox.basin_profile(args.basin, session_id=session_id, actor_id=args.actor)
    falsify = geox.falsify(
        f"{args.basin} classification is consistent with multi-physics evidence",
        session_id=session_id,
        actor_id=args.actor,
    )
    vitality = well.validate_vitality(intent=f"Compile basin: {args.basin}")

    # Print receipt
    print(
        json.dumps(
            {
                "session_id": session_id,
                "basin": args.basin,
                "profile_artifact_status": (profile.get("result") or {}).get(
                    "artifact_status"
                ),
                "falsify_verdict": (falsify.get("result") or {}).get("verdict"),
                "vitality_verdict": (vitality.get("result") or {}).get("verdict"),
            },
            indent=2,
        )
    )

    if args.send_telegram:
        raise RuntimeError(
            "forge-basin gathered evidence but produced no session-bound artifact; delivery refused"
        )
    return 0


def _deliver_via_hermes(
    basin: str,
    session_id: str,
    pdf_path: Path,
    validation,
):
    artifacts_dir = Path("/root/A-FORGE/python/aforge_publish/artifacts").resolve()
    bound_pdf = pdf_path.resolve()
    if bound_pdf.parent != artifacts_dir or not bound_pdf.is_file():
        raise ValueError("delivery artifact is not a current A-FORGE artifact")
    if validation.artifact_path != str(bound_pdf) or validation.overall != "PASS":
        raise ValueError(
            "delivery requires PASS validation bound to the exact artifact"
        )
    raise RuntimeError(
        "direct CLI delivery is disabled; submit the exact artifact hash, session, "
        f"and validation receipt through arifOS → A-FORGE (basin={basin!r}, "
        f"session={session_id[:16]!r})"
    )


def _manifest_from_dict(raw: dict) -> ArtifactManifest:
    """Convert a YAML/JSON dict into ArtifactManifest."""
    figs = [FigureSpec(**f) for f in raw.get("figures", [])]
    return ArtifactManifest(
        artifact_id=raw["artifact_id"],
        title=raw["title"],
        subject=raw.get("subject", ""),
        sovereign=raw.get("sovereign", SOVEREIGN),
        actor_id=raw.get("actor_id", "arif"),
        session_id=raw.get("session_id", ""),
        intent=raw.get("intent", ""),
        backend=raw.get("backend", "reportlab"),
        pages=raw.get("pages", "A4"),
        tier=raw.get("tier", "AAA"),
        figures=figs,
        body_blocks=raw.get("body_blocks", []),
        falsification_refs=raw.get("falsification_refs", []),
        organ_evidence_refs=raw.get("organ_evidence_refs", []),
        metadata=raw.get("metadata", {}),
    )


def _payload_from_dict(raw: dict) -> DecoderPayload:
    """Build the only compiler input, rejecting absent or incomplete verification."""
    verification = raw.get("verification")
    if not isinstance(verification, dict):
        raise ValueError("manifest requires a verification block")
    km_raw = verification.get("kill_matrix")
    if not isinstance(km_raw, dict):
        raise ValueError("verification requires kill_matrix")
    kill_matrix = KillMatrixResult(
        cleared=km_raw.get("cleared") is True,
        overall_verdict=KillMatrixVerdict(km_raw.get("overall_verdict", "K_UNTESTED")),
        gates=km_raw.get("gates", {}),
        failure_details=km_raw.get("failure_details", {}),
        mahalanobis_z=km_raw.get("mahalanobis_z"),
        uncertainty_omega_0=km_raw.get("uncertainty_omega_0", 0.03),
    )
    epistemic_labels = {
        figure_id: [EpistemicLabel(label) for label in labels]
        for figure_id, labels in verification.get("epistemic_labels", {}).items()
    }
    metabolizer_output = MetabolizerOutput(
        kill_matrix=kill_matrix,
        confidence_score=float(verification.get("confidence_score", 0.0)),
        epistemic_labels=epistemic_labels,
        spatial_bounds=verification.get("spatial_bounds", {}),
        computed_primitives=verification.get("computed_primitives", {}),
        evidence_refs=verification.get("evidence_refs", []),
        falsification_trace=verification.get("falsification_trace", []),
    )
    return DecoderPayload(
        metabolizer_output=metabolizer_output,
        artifact_manifest=_manifest_from_dict(raw),
        voice_profile=raw.get("voice_profile", "senior_geoscientist"),
        target_audience=raw.get("target_audience", "peer_review"),
        delivery_telegram=raw.get("delivery", {}).get("telegram", False),
        delivery_outbox=raw.get("delivery", {}).get("outbox", True),
    )


def main():
    parser = argparse.ArgumentParser(
        prog="aforge-publish",
        description="A-FORGE Publish · Tier 3 constitutional PDF compiler",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_compile = sub.add_parser("compile", help="Compile YAML manifest to PDF")
    p_compile.add_argument("manifest")
    p_compile.add_argument(
        "--backend", default="reportlab", choices=["typst", "reportlab", "weasyprint"]
    )
    p_compile.add_argument("--out", default=None)
    p_compile.set_defaults(func=cmd_compile)

    p_probe = sub.add_parser("probe", help="Probe organ health")
    p_probe.add_argument(
        "organ", nargs="?", default="geox", choices=["geox", "well", "wealth", "arifos"]
    )
    p_probe.set_defaults(func=cmd_probe)

    p_demo = sub.add_parser("demo", help="Build Malay Basin Tier-3 demo artifact")
    p_demo.add_argument(
        "--backend", default="reportlab", choices=["typst", "reportlab", "weasyprint"]
    )
    p_demo.add_argument(
        "--send-telegram",
        action="store_true",
        help="deliver to sovereign's Telegram via Hermes courier",
    )
    p_demo.set_defaults(func=cmd_demo)

    p_fb = sub.add_parser("forge-basin", help="Pull live evidence + compile + deliver")
    p_fb.add_argument("--basin", required=True)
    p_fb.add_argument("--session", default=None)
    p_fb.add_argument("--actor", default="arif")
    p_fb.add_argument("--backend", default="reportlab")
    p_fb.add_argument("--send-telegram", action="store_true")
    p_fb.set_defaults(func=cmd_forge_basin)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main() or 0)
