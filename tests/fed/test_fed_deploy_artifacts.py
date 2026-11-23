"""Disposable tests for the FED deploy artifact contract (T1-T7).

Every test builds its own throwaway git repository and staging directory under tmp_path; nothing
here touches the federation, the real config, the real repo working tree, or any host.

  T1  a dirty tracked sentinel must NOT reach the artifact (bytes come from the commit)
  T2  a committed sentinel MUST reach the artifact, and the artifact follows the requested SHA
  T3  a path missing at that SHA must fail closed before anything is staged
  T4  an undeclared external artifact (no owner / no approved hash / unknown source_type)
      must fail closed
  T5  a hash mismatch must fail closed BEFORE any live byte is replaced
  T6  a failed probe after a copy must roll the live bytes back
  T7  the owner's dirty working tree must be untouched throughout
"""

import json
import os
import subprocess
import sys

import pytest
import yaml

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESOLVER = os.path.join(REPO, "scripts", "fed-deploy-artifacts.py")


def run_resolver(*args, cwd=None):
    return subprocess.run([sys.executable, RESOLVER, *args], cwd=cwd,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout.strip()


def make_repo(tmp_path):
    repo = tmp_path / "repo"
    (repo / "scripts").mkdir(parents=True)
    (repo / "litellm-config.yaml").write_text("model_list: []\n")
    (repo / "scripts" / "fed_context_guard.py").write_text("# committed v1\n")
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "test@example.invalid")
    git(repo, "config", "user.name", "test")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "v1")
    return repo


def write_manifest(path, artifacts):
    path.write_text(yaml.safe_dump({"version": 1, "artifacts": artifacts}, sort_keys=False))


def read_resolved(outdir):
    return json.loads((outdir / "resolved.json").read_text())


# ---------------------------------------------------------------- T1
def test_t1_dirty_tracked_sentinel_is_excluded(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    # dirty the tracked file without committing
    (repo / "scripts" / "fed_context_guard.py").write_text("# DIRTY WORKING TREE\n")

    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/fed_context_guard.py"},
    ])
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                     "--repo", str(repo), "--outdir", str(out))
    assert r.returncode == 0, r.stderr
    staged = (out / "guard").read_text()
    assert staged == "# committed v1\n", "the artifact must be the COMMITTED byte"
    assert "DIRTY" not in staged
    assert read_resolved(out)["working_tree_read"] is False


# ---------------------------------------------------------------- T2
def test_t2_committed_sentinel_is_included_and_follows_the_sha(tmp_path):
    repo = make_repo(tmp_path)
    sha1 = git(repo, "rev-parse", "HEAD")
    (repo / "scripts" / "fed_context_guard.py").write_text("# committed v2\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "v2")
    sha2 = git(repo, "rev-parse", "HEAD")
    assert sha1 != sha2

    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/fed_context_guard.py"},
    ])
    out1, out2 = tmp_path / "s1", tmp_path / "s2"
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha1,
                         "--repo", str(repo), "--outdir", str(out1)).returncode == 0
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha2,
                         "--repo", str(repo), "--outdir", str(out2)).returncode == 0
    assert (out1 / "guard").read_text() == "# committed v1\n"
    assert (out2 / "guard").read_text() == "# committed v2\n"
    assert read_resolved(out2)["source_sha"] == sha2


# ---------------------------------------------------------------- T3
def test_t3_missing_git_path_fails_closed(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/does_not_exist.py",
         "destination": "/dst/x.py"},
    ])
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                     "--repo", str(repo), "--outdir", str(out))
    assert r.returncode == 2, r.stdout
    assert "FAIL-CLOSED" in r.stderr
    assert not (out / "resolved.json").exists(), "nothing may be recorded as resolved"


def test_t3b_missing_source_sha_fails_closed(tmp_path):
    repo = make_repo(tmp_path)
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/x.py"},
    ])
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", str(manifest), "--source-sha", "",
                     "--repo", str(repo), "--outdir", str(out))
    assert r.returncode == 2
    assert "source SHA" in r.stderr


# ---------------------------------------------------------------- T4
@pytest.mark.parametrize("artifact", [
    {"id": "cb", "source_type": "external_attested", "source_path": "/tmp/x.py",
     "destination": "/dst/cb.py"},                       # no owner, no approved hash
    {"id": "cb", "source_type": "external_attested", "owner": "someone",
     "source_path": "/tmp/x.py", "destination": "/dst/cb.py"},   # no approved hash
    {"id": "cb", "source_type": "mystery", "path": "x", "destination": "/dst/cb.py"},
])
def test_t4_undeclared_external_artifact_fails_closed(tmp_path, artifact):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    src = tmp_path / "x.py"
    src.write_text("# external\n")
    artifact = dict(artifact)
    if artifact.get("source_path"):
        artifact["source_path"] = str(src)
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [artifact])
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                     "--repo", str(repo), "--outdir", str(out))
    assert r.returncode == 2, r.stdout
    assert "FAIL-CLOSED" in r.stderr
    assert not (out / "resolved.json").exists()


# ---------------------------------------------------------------- T5
def test_t5_hash_mismatch_fails_closed_before_any_live_byte_changes(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    src = tmp_path / "cb.py"
    src.write_text("# external v1\n")
    import hashlib
    good = hashlib.sha256(src.read_bytes()).hexdigest()
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "cb", "source_type": "external_attested", "owner": "A-FORGE",
         "source_path": str(src), "sha256": good, "destination": "/dst/cb.py"},
    ])
    out = tmp_path / "stage"
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                         "--repo", str(repo), "--outdir", str(out)).returncode == 0

    # the live external source changes after the manifest was written
    src.write_text("# external v2 — TAMPERED\n")
    out2 = tmp_path / "stage2"
    r = run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                     "--repo", str(repo), "--outdir", str(out2))
    assert r.returncode == 2
    assert "hash mismatch" in r.stderr

    # and a tampered staged artifact must be refused at promote time, with the live byte intact
    root = tmp_path / "live"
    dest = root / "dst" / "cb.py"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("# the current live byte\n")
    before = dest.read_text()
    staged = out / "cb"
    staged.write_text("# tampered after resolve\n")
    p = run_resolver("promote", "--resolved", str(out / "resolved.json"),
                     "--local-root", str(root))
    assert p.returncode == 2
    assert dest.read_text() == before, "the live byte must not change"


# ---------------------------------------------------------------- T6
def test_t6_failed_probe_rolls_the_live_bytes_back(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/fed_context_guard.py"},
    ])
    out = tmp_path / "stage"
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                         "--repo", str(repo), "--outdir", str(out)).returncode == 0

    root = tmp_path / "live"
    dest = root / "dst" / "fed_context_guard.py"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("# the PREVIOUS live byte\n")
    before = dest.read_text()

    p = run_resolver("promote", "--resolved", str(out / "resolved.json"),
                     "--local-root", str(root), "--probe-cmd", "exit 7")
    assert p.returncode == 5, p.stdout
    assert dest.read_text() == before, "a failed probe must restore the previous bytes"


def test_t6b_successful_probe_keeps_the_new_bytes(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/fed_context_guard.py"},
    ])
    out = tmp_path / "stage"
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                         "--repo", str(repo), "--outdir", str(out)).returncode == 0
    root = tmp_path / "live"
    dest = root / "dst" / "fed_context_guard.py"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("# the PREVIOUS live byte\n")
    p = run_resolver("promote", "--resolved", str(out / "resolved.json"),
                     "--local-root", str(root), "--probe-cmd", "exit 0")
    assert p.returncode == 0, p.stderr
    assert dest.read_text() == "# committed v1\n"


# ---------------------------------------------------------------- T7
def test_t7_dirty_owner_worktree_is_untouched(tmp_path):
    repo = make_repo(tmp_path)
    sha = git(repo, "rev-parse", "HEAD")
    dirty = repo / "scripts" / "fed_context_guard.py"
    dirty.write_text("# OWNER WORK IN PROGRESS\n")
    before_bytes = dirty.read_bytes()
    before_stat = dirty.stat()
    before_status = git(repo, "status", "--porcelain")

    manifest = tmp_path / "m.yaml"
    write_manifest(manifest, [
        {"id": "guard", "source_type": "git", "path": "scripts/fed_context_guard.py",
         "destination": "/dst/fed_context_guard.py"},
    ])
    out = tmp_path / "stage"
    assert run_resolver("resolve", "--manifest", str(manifest), "--source-sha", sha,
                         "--repo", str(repo), "--outdir", str(out)).returncode == 0

    root = tmp_path / "live"
    (root / "dst").mkdir(parents=True)
    (root / "dst" / "fed_context_guard.py").write_text("# live\n")
    assert run_resolver("promote", "--resolved", str(out / "resolved.json"),
                         "--local-root", str(root)).returncode == 0

    assert dirty.read_bytes() == before_bytes, "the owner's file must not be rewritten"
    assert dirty.stat().st_mtime == before_stat.st_mtime, "the owner's file must not be touched"
    assert git(repo, "status", "--porcelain") == before_status, "the tree must stay dirty, not cleaned"


def test_t7b_the_real_manifest_declares_both_artifact_classes():
    manifest = yaml.safe_load(open(os.path.join(REPO, "deploy", "fed", "deploy-artifacts.yaml")))
    kinds = {a["id"]: a["source_type"] for a in manifest["artifacts"]}
    assert kinds["fed-context-guard"] == "git"
    assert kinds["fed-attribution-callback"] == "external_attested"
    for a in manifest["artifacts"]:
        if a["source_type"] == "external_attested":
            assert a.get("owner"), "an external artifact needs an owner"
            assert a.get("sha256"), "an external artifact needs an approved hash"
            assert a.get("source_path"), "an external artifact needs an explicit source path"
