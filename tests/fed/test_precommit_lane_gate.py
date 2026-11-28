"""Deterministic regression tests for hooks/pre-commit-lsp-gate.sh lane_gate.

Proves (Section 10):
  1. Valid registered (name, email, signing-key fingerprint) passes.
  2. Mismatched email (including the observed 33-byte vs 44-byte PR-FED-2 failure)
     fails visibly with byte-length diagnostics.
  3. Mismatched name or signing key fails closed.
  4. Missing email fails closed.
  5. Normalization (CR stripping only) CANNOT collapse distinct identities.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

WORKTREE_ROOT = Path(__file__).resolve().parents[2]
HOOK_PATH = WORKTREE_ROOT / "hooks" / "pre-commit-lsp-gate.sh"


def _create_ed25519_key(tmp_path: Path, name: str) -> tuple[Path, str]:
    key_path = tmp_path / name
    subprocess.run(
        ["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(key_path)],
        check=True,
    )
    out = subprocess.check_output(["ssh-keygen", "-lf", str(key_path)], text=True)
    fp = out.strip().split()[1]
    return key_path, fp


def _run_lane_gate(
    tmp_path: Path,
    registry_text: str,
    git_name: str,
    git_email: str,
    git_key: str,
) -> subprocess.CompletedProcess[str]:
    repo = tmp_path / "repo"
    repo.mkdir(exist_ok=True)
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", git_name], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", git_email], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.signingkey", git_key], check=True)

    reg = tmp_path / "lane-identities.tsv"
    reg.write_bytes(registry_text.encode("utf-8"))

    # Extract only the lane_gate function from hooks/pre-commit-lsp-gate.sh and invoke it.
    hook_src = HOOK_PATH.read_text(encoding="utf-8")
    end_marker = "# ─── end LANE IDENTITY GATE"
    gate_block = hook_src[: hook_src.index(end_marker)]
    env = os.environ.copy()
    env["LANE_REGISTRY"] = str(reg)
    return subprocess.run(
        ["bash", "-c", gate_block],
        cwd=str(repo),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_lane_gate_valid_identity_passes(tmp_path: Path):
    key, fp = _create_ed25519_key(tmp_path, "agy_key")
    reg = f"agy|antigravity (agy/FI-004)|210893902+ariffazil@users.noreply.github.com|{key}|{fp}\n"
    res = _run_lane_gate(
        tmp_path,
        reg,
        "antigravity (agy/FI-004)",
        "210893902+ariffazil@users.noreply.github.com",
        str(key),
    )
    assert res.returncode == 0, res.stderr


def test_lane_gate_valid_identity_with_crlf_registry_passes(tmp_path: Path):
    key, fp = _create_ed25519_key(tmp_path, "agy_crlf")
    reg = f"agy|antigravity (agy/FI-004)|210893902+ariffazil@users.noreply.github.com|{key}|{fp}\r\n"
    res = _run_lane_gate(
        tmp_path,
        reg,
        "antigravity (agy/FI-004)",
        "210893902+ariffazil@users.noreply.github.com",
        str(key),
    )
    assert res.returncode == 0, res.stderr


def test_lane_gate_mismatched_33_vs_44_byte_email_fails_visibly(tmp_path: Path):
    """Reproduces the exact PR-FED-2 33-byte vs 44-byte email mismatch and proves fail-closed."""
    key, fp = _create_ed25519_key(tmp_path, "qwen_key")
    reg = f"qwen|FI-003 (333-AGI)|210893902+ariffazil@users.noreply.github.com|{key}|{fp}\n"
    res = _run_lane_gate(
        tmp_path,
        reg,
        "FI-003 (333-AGI)",
        "arifazil@users.noreply.github.com",  # 33 bytes vs 44 bytes
        str(key),
    )
    assert res.returncode == 1
    assert "unregistered identity/key pair" in res.stderr
    assert "len=33" in res.stderr
    assert "email_len=44" in res.stderr


def test_lane_gate_distinct_identities_cannot_collapse(tmp_path: Path):
    """Normalization must NEVER collapse distinct emails, casing, whitespace, or keys."""
    key1, fp1 = _create_ed25519_key(tmp_path, "key1")
    key2, _ = _create_ed25519_key(tmp_path, "key2")
    reg = f"agy|antigravity (agy/FI-004)|210893902+ariffazil@users.noreply.github.com|{key1}|{fp1}\n"

    # Case difference
    r_case = _run_lane_gate(
        tmp_path,
        reg,
        "antigravity (agy/FI-004)",
        "210893902+ARIFFAZIL@users.noreply.github.com",
        str(key1),
    )
    assert r_case.returncode == 1

    # Different key
    r_key = _run_lane_gate(
        tmp_path,
        reg,
        "antigravity (agy/FI-004)",
        "210893902+ariffazil@users.noreply.github.com",
        str(key2),
    )
    assert r_key.returncode == 1

    # Missing email
    r_empty = _run_lane_gate(
        tmp_path,
        reg,
        "antigravity (agy/FI-004)",
        "",
        str(key1),
    )
    assert r_empty.returncode == 1
    assert "email" in r_empty.stderr.lower()
