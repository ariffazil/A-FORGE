"""Typst backend — math/typeset AAA-grade PDFs via the typst CLI.

Requires typst binary on PATH. Falls back gracefully if missing.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from ..types import ArtifactManifest
from ..templates.typst_renderer import render_manifest_to_typst

log = logging.getLogger(__name__)


class TypstBackend:
    """Typst programmatic compiler. Best for math + academic typography."""

    name = "typst"

    def __init__(self):
        self.typst_bin = shutil.which("typst")
        if not self.typst_bin:
            log.warning("typst binary not on PATH — Typst backend will fail at compile")

    def render(self, manifest: ArtifactManifest, out_path: Path) -> None:
        if not self.typst_bin:
            raise RuntimeError(
                "typst binary not found on PATH. Install via: "
                "curl -L https://github.com/typst/typst/releases/latest/download/"
                "typst-x86_64-unknown-linux-musl.tar.xz | tar -xJ && "
                "mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/"
            )

        # Generate .typ source
        typ_source = render_manifest_to_typst(manifest)

        # Compile in a tempdir (typst needs a workspace for fonts etc.)
        with tempfile.TemporaryDirectory(prefix="aforge_typst_") as tmp:
            tmp = Path(tmp)
            typ_file = tmp / "artifact.typ"
            typ_file.write_text(typ_source, encoding="utf-8")
            # typst compile --format pdf
            cmd = [
                self.typst_bin,
                "compile",
                "--format",
                "pdf",
                str(typ_file),
                str(out_path),
            ]
            log.info("typst compile: %s", " ".join(cmd))
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                # Write source for debug
                debug_path = out_path.with_suffix(".typ")
                debug_path.write_text(typ_source, encoding="utf-8")
                raise RuntimeError(
                    f"typst compile failed (rc={result.returncode})\n"
                    f"STDOUT: {result.stdout[:2000]}\n"
                    f"STDERR: {result.stderr[:2000]}\n"
                    f"Source written to: {debug_path}"
                )
            if not out_path.exists():
                raise RuntimeError(
                    f"typst compile reported success but {out_path} missing"
                )
            log.info(
                "Typst render complete · %s · %d bytes",
                out_path.name,
                out_path.stat().st_size,
            )
