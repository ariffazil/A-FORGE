from pathlib import Path

import pytest

from aforge_publish import (
    AForgePublishCompiler,
    ArtifactManifest,
    DecoderPayload,
    KillMatrixResult,
    KillMatrixVerdict,
    MetabolizerOutput,
)
from aforge_publish.backends.weasyprint_backend import HTML_TEMPLATE, _safe_url_fetcher
from aforge_publish.validator import ClosedLoopVisualValidator, ValidatorCheck


ALL_GATES = {
    "K001_physics": True,
    "K002_strat": True,
    "K003_thermal": True,
    "K004_burial": True,
    "K005_pressure": True,
    "K006_logic": True,
    "K007_evidence": True,
}


def make_payload(artifact_id: str = "safe-artifact") -> DecoderPayload:
    kill_matrix = KillMatrixResult(
        cleared=True,
        overall_verdict=KillMatrixVerdict.PASS,
        gates=ALL_GATES,
    )
    verified = MetabolizerOutput(
        kill_matrix=kill_matrix,
        confidence_score=0.90,
        epistemic_labels={},
    )
    manifest = ArtifactManifest(
        artifact_id=artifact_id,
        title="Safe",
        subject="Boundary test",
        sovereign="Arif",
        actor_id="test",
        session_id="session-test",
        intent="verify boundary",
        backend="fake",
        body_blocks=[{"type": "paragraph", "text": "verified"}],
    )
    return DecoderPayload(verified, manifest)


class FakeBackend:
    def render(self, manifest: ArtifactManifest, out_path: Path) -> None:
        out_path.write_bytes(b"%PDF-1.4\n% boundary test\n")


def test_compiler_rejects_unverified_manifest(tmp_path: Path) -> None:
    compiler = AForgePublishCompiler(tmp_path)

    with pytest.raises(TypeError, match="DecoderPayload"):
        compiler.compile(make_payload().artifact_manifest)  # type: ignore[arg-type]


@pytest.mark.parametrize("artifact_id", ["../escape", "/tmp/escape", "bad/name"])
def test_compiler_rejects_path_traversal(tmp_path: Path, artifact_id: str) -> None:
    compiler = AForgePublishCompiler(tmp_path)
    compiler.BACKEND_REGISTRY = {"fake": FakeBackend}

    with pytest.raises(ValueError, match="artifact_id"):
        compiler.compile(make_payload(artifact_id))


def test_compiler_emits_execution_state_not_judgment(tmp_path: Path) -> None:
    compiler = AForgePublishCompiler(tmp_path)
    compiler.BACKEND_REGISTRY = {"fake": FakeBackend}

    result = compiler.compile(make_payload())

    assert result["execution_status"] == "COMPLETED"
    assert result["judgment_status"] == "PENDING_ARIFOS"
    assert "status" not in result


def test_kill_matrix_cannot_self_attest_without_all_gates() -> None:
    with pytest.raises(ValueError, match="K001-K007"):
        KillMatrixResult(
            cleared=True,
            overall_verdict=KillMatrixVerdict.PASS,
            gates={},
        )


def test_confidence_cannot_exceed_humility_cap() -> None:
    kill_matrix = KillMatrixResult(True, KillMatrixVerdict.PASS, ALL_GATES)

    with pytest.raises(ValueError, match="0.90"):
        MetabolizerOutput(kill_matrix, 0.99, {})


def test_weasyprint_template_escapes_manifest_html() -> None:
    manifest = make_payload().artifact_manifest
    manifest.title = '<img src="file:///etc/passwd">'

    rendered = HTML_TEMPLATE.render(manifest=manifest, weasyprint_version="test")

    assert "&lt;img" in rendered
    assert '<img src="file:///etc/passwd">' not in rendered


def test_weasyprint_blocks_external_resources() -> None:
    with pytest.raises(ValueError, match="external resource blocked"):
        _safe_url_fetcher("file:///etc/passwd")


def test_validator_returns_raw_warn_not_seal() -> None:
    validator = ClosedLoopVisualValidator()
    validator.checks = [ValidatorCheck("example", "WARN")]

    assert validator._rollup() == "WARN"
