"""
tests/adversarial/test_lane_gate_exit_code.py — LANE GATE exit-code invariant
==============================================================================

INVARIANT UNDER TEST
    A BLOCKED commit MUST return a non-zero exit code AND print a reason.
    "Blocked but exit 0" is the failure class this test exists to catch
    (a gate whose failure is reported as success — CON-08 family).

WHY THIS TEST EXISTS
    During the 2026-10-22 MCP audit a commit appeared to "fail with exit 0".
    On re-measurement WITHOUT a pipe (`git commit ... | tail`) the real code
    was 1 — the "0" was the exit status of `tail`, not git. The measurement
    was wrong, not the gate. This test encodes the invariant so a REAL
    regression (gate returns 0 while blocking) fails loudly.

HERMETIC BY CONSTRUCTION
    The test builds its own throwaway git repo in a temp dir and points
    core.hooksPath at the real hook. It NEVER runs inside the working repo, so
    it cannot touch the real A-FORGE index (which may hold unrelated staged
    work). All actions are reversible: the temp dir is removed on teardown.

    Only `--allow-empty` commits are created, and only inside the temp repo.

DITEMPA BUKAN DIBERI — ARIF · SALAM · IRFAN
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

FORGE_ROOT = Path(__file__).resolve().parents[2]
LANE_WRAPPER = Path("/root/scripts/git-lane")
HOOK_DIR = FORGE_ROOT / "hooks"


def _run(args: list[str], cwd: Path) -> tuple[int, str]:
    """Run a command, return (exit_code, combined_output). No pipe masking."""
    p = subprocess.run(
        args, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, timeout=180,
    )
    return p.returncode, p.stdout


class LaneGateExitCodeInvariant(unittest.TestCase):
    """Blocked ⇒ non-zero. The gate must not report success while blocking."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="lanegate-"))
        _run(["git", "init", "-q", str(self.tmp)], self.tmp)
        _run(["git", "-C", str(self.tmp), "config", "user.email", "t@t"], self.tmp)
        _run(["git", "-C", str(self.tmp), "config", "user.name", "t"], self.tmp)
        # Install the REAL hook as this temp repo's pre-commit. The hook file is
        # named pre-commit-lsp-gate.sh, so a bare core.hooksPath would NOT fire
        # it (git looks for a file literally named "pre-commit"). The real repo
        # symlinks .git/hooks/pre-commit -> that file; we do the same here.
        hook_src = HOOK_DIR / "pre-commit-lsp-gate.sh"
        if not hook_src.is_file():
            self.skipTest(f"hook script absent: {hook_src}")
        hook_dst = self.tmp / ".git" / "hooks" / "pre-commit"
        hook_dst.parent.mkdir(parents=True, exist_ok=True)
        if hook_dst.exists():
            hook_dst.unlink()
        hook_dst.symlink_to(hook_src)
        # Disable commit signing in the temp repo so git does NOT fail on the
        # ssh-signing precondition BEFORE the pre-commit lane gate runs. The
        # invariant we test is "lane gate blocks", not "git refuses to sign".
        _run(["git", "-C", str(self.tmp), "config", "commit.gpgsign", "false"], self.tmp)
        # Need one commit so HEAD~1 exists for the positive-path reset.
        _run(["git", "-C", str(self.tmp), "commit", "--no-verify", "--allow-empty",
              "-m", "root"], self.tmp)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_blocked_commit_returns_nonzero(self) -> None:
        """An unregistered identity must hit the LANE GATE and be blocked
        non-zero. Real-world case: repos carry a user.name that is not in the
        lane registry (or a missing signing key)."""
        rc, out = _run(
            ["git", "-c", "user.name=UNREGISTERED-PROBE", "-c", "user.signingkey=",
             "commit", "--allow-empty", "-m", "probe"],
            self.tmp,
        )
        self.assertNotEqual(
            rc, 0,
            f"INVARIANT VIOLATED: gate blocked but exit code was 0.\nOUTPUT:\n{out}",
        )
        self.assertRegex(
            out, r"LANE GATE|identity or signing key missing",
            f"blocked commit printed no reason:\n{out}",
        )

    def test_positive_control_lane_commit_succeeds(self) -> None:
        """Positive control: an explicit lane commit must NOT be blocked."""
        if not LANE_WRAPPER.is_file():
            self.skipTest("git-lane wrapper absent")
        rc, out = _run(
            ["bash", str(LANE_WRAPPER), "claude", "-C", str(self.tmp),
             "commit", "--allow-empty", "-m", "probe-positive"],
            self.tmp,
        )
        if rc != 0 and "LANE GATE" in out:
            self.fail(f"positive control blocked unexpectedly:\n{out}")

    def test_pipe_must_not_be_read_as_exit_code(self) -> None:
        """Documents the audit trap: `| tail` returns tail's status, not git's."""
        rc, _ = _run(
            ["git", "-c", "user.name=UNREGISTERED-PROBE", "-c", "user.signingkey=",
             "commit", "--allow-empty", "-m", "probe2"],
            self.tmp,
        )
        piped = subprocess.run(
            "git -c user.name=UNREGISTERED-PROBE -c user.signingkey= "
            "commit --allow-empty -m p | tail -1",
            cwd=str(self.tmp), shell=True, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, timeout=180,
        )
        self.assertNotEqual(rc, 0, "direct capture must be non-zero when blocked")
        self.assertEqual(piped.returncode, 0,
                         "sanity: `| tail` returns tail's status — the audit's own trap")

    def test_hookspath_bypass_vector_is_closed(self) -> None:
        """BYPASS VECTOR (found 2026-10-22, CLOSED): core.hooksPath=<dir> makes
        git look for a file literally named 'pre-commit' inside <dir>. The lane
        gate was named pre-commit-lsp-gate.sh, so a bare core.hooksPath to the
        hooks DIR silently skipped the gate and the commit succeeded (rc == 0).

        FIX: a symlink `hooks/pre-commit -> pre-commit-lsp-gate.sh` so the gate
        is reachable by the name git actually resolves. This test asserts the
        gate now fires under core.hooksPath — i.e. the bypass stays closed.

        If this test starts FAILING, the bypass has reopened."""
        bypass = HOOK_DIR  # the real hooks dir, where the symlink now lives
        if not (bypass / "pre-commit").exists():
            self.fail("BYPASS REOPENED: hooks/pre-commit symlink missing — "
                      "core.hooksPath would skip the lane gate")
        rc, out = _run(
            ["git", "-c", "core.hooksPath=" + str(bypass),
             "commit", "--allow-empty", "-m", "bypass-probe"],
            self.tmp,
        )
        self.assertNotEqual(
            rc, 0,
            f"BYPASS REOPENED: core.hooksPath skipped the lane gate (rc==0).\nOUTPUT:\n{out}",
        )
        self.assertRegex(out, r"LANE GATE|unregistered identity")


if __name__ == "__main__":
    unittest.main(verbosity=2)
