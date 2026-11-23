"""The real deploy manifest, resolved at HEAD — read-only on the repo, disposable on disk.

This is the proof that the production manifest is itself correct: the git artifacts resolve to
COMMITTED bytes (never the dirty working tree), the kvm4 divergence is applied to the staged copy,
and the external artifact matches its approved hash.
"""

import hashlib
import json
import os
import subprocess
import sys

import yaml

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESOLVER = os.path.join(REPO, "scripts", "fed-deploy-artifacts.py")
MANIFEST = os.path.join(REPO, "deploy", "fed", "deploy-artifacts.yaml")


def run_resolver(*args):
    return subprocess.run([sys.executable, RESOLVER, *args],
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def sha256_file(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def git_blob_sha(repo, sha, path):
    blob = subprocess.run(["git", "-C", repo, "rev-parse", f"{sha}:{path}"],
                           stdout=subprocess.PIPE, text=True, check=True).stdout.strip()
    return blob


def test_real_manifest_resolves_committed_bytes_and_patched_divergence(tmp_path):
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", MANIFEST, "--source-sha", "HEAD",
                     "--repo", REPO, "--outdir", str(out))
    assert r.returncode == 0, r.stderr
    resolved = json.loads((out / "resolved.json").read_text())
    artifacts = {a["id"]: a for a in resolved["artifacts"]}
    assert set(artifacts) == {"litellm-config", "fed-context-guard", "fed-attribution-callback"}

    # the guard must be the COMMITTED byte, even though the working tree copy is dirty
    head = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"],
                           stdout=subprocess.PIPE, text=True, check=True).stdout.strip()
    committed = subprocess.run(["git", "-C", REPO, "show", f"{head}:scripts/fed_context_guard.py"],
                               stdout=subprocess.PIPE, check=True).stdout
    assert artifacts["fed-context-guard"]["sha256"] == hashlib.sha256(committed).hexdigest()
    working = open(os.path.join(REPO, "scripts", "fed_context_guard.py"), "rb").read()
    if working != committed:
        assert artifacts["fed-context-guard"]["sha256"] != hashlib.sha256(working).hexdigest(), \
            "a dirty working-tree byte must never be the artifact"

    # the config artifact carries the kvm4-only divergence, and the hash describes THAT
    staged_cfg = (out / "litellm-config").read_text()
    assert "http://100.64.0.2:4013/v1" in staged_cfg, "the ZAI relay divergence is missing"
    assert "data.fed_context_guard.FedContextGuard" in staged_cfg, "the guardrail ref is missing"
    assert artifacts["litellm-config"]["sha256"] == sha256_file(out / "litellm-config")

    # the external artifact is attested against its approved hash
    manifest = yaml.safe_load(open(MANIFEST))
    ext = next(a for a in manifest["artifacts"] if a["source_type"] == "external_attested")
    assert artifacts["fed-attribution-callback"]["sha256"] == ext["sha256"]
    assert artifacts["fed-attribution-callback"]["sha256"] == sha256_file(out / "fed-attribution-callback")

    # and the resolution must name the source, not the filesystem
    assert artifacts["fed-context-guard"]["source"].startswith("git:")
    assert artifacts["fed-context-guard"]["source"].endswith("scripts/fed_context_guard.py")
    assert resolved["working_tree_read"] is False


def test_real_config_artifact_is_a_valid_yaml_after_the_divergence(tmp_path):
    out = tmp_path / "stage"
    r = run_resolver("resolve", "--manifest", MANIFEST, "--source-sha", "HEAD",
                     "--repo", REPO, "--outdir", str(out))
    assert r.returncode == 0, r.stderr
    cfg = yaml.safe_load((out / "litellm-config").read_text())
    assert isinstance(cfg["model_list"], list) and cfg["model_list"]
    # the staged config is a different byte from the committed one, by design (divergence)
    head = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"],
                           stdout=subprocess.PIPE, text=True, check=True).stdout.strip()
    committed = subprocess.run(["git", "-C", REPO, "show", f"{head}:litellm-config.yaml"],
                               stdout=subprocess.PIPE, check=True).stdout
    assert (out / "litellm-config").read_bytes() != committed, \
        "the divergence should make the staged config differ from the committed blob"
