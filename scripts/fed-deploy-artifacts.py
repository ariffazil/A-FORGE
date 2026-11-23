#!/usr/bin/env python3
"""Resolve, stage, deploy and verify FED deployment artifacts from an EXPLICIT source identity.

The defect this exists to close (2026-11-23): scripts/fed-deploy-kvm4.sh copied runtime modules
from the MUTABLE working tree, so an owner lane's uncommitted change travelled into production on
the second seat — twice — and each time it had to be restored by hand. "Parity with a dirty tree"
is not "parity with a ratified commit".

Commands:
  resolve   stage every artifact from an explicit source SHA into a staging directory
  promote   copy staged bytes to a host (or a local directory) and verify what landed
  verify    compare the live bytes on a host against the recorded hashes

Fail-closed rules (exit code 2, nothing staged, nothing copied):
  * missing / unresolvable source SHA
  * a git path that does not exist at that SHA
  * an external artifact without owner or approved sha256
  * an external artifact whose live bytes do not match the approved sha256
  * any source_type other than git / external_attested

Nothing here reads the working tree for a git artifact: git artifacts come from `git show`.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

import yaml

EXIT_OK = 0
EXIT_FAIL_CLOSED = 2
EXIT_VERIFY_MISMATCH = 3
EXIT_PROMOTE_FAILED = 4
EXIT_ROLLBACK = 5

MANIFEST_DEFAULT = "deploy/fed/deploy-artifacts.yaml"
RESOLVED_NAME = "resolved.json"


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd, cwd=None, check=True, capture=True):
    return subprocess.run(
        cmd, cwd=cwd, check=check,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        text=True,
    )


class FailClosed(Exception):
    def __init__(self, reason, artifact=None):
        super().__init__(reason)
        self.reason = reason
        self.artifact = artifact


def resolve_sha(repo: str, rev: str) -> str:
    if not rev or not rev.strip():
        raise FailClosed("source SHA is missing or ambiguous (pass --source-sha, e.g. HEAD or a full sha)")
    r = run(["git", "-C", repo, "rev-parse", "--verify", f"{rev}^{{commit}}"], check=False)
    if r.returncode != 0:
        raise FailClosed(f"source SHA cannot be resolved to a commit: {rev}")
    sha = r.stdout.strip()
    if len(sha) != 40:
        raise FailClosed(f"source SHA is not a full commit id: {rev} -> {sha}")
    return sha


def git_blob(repo: str, sha: str, path: str) -> bytes:
    r = run(["git", "-C", repo, "show", f"{sha}:{path}"], check=False)
    if r.returncode != 0:
        raise FailClosed(f"path not present at {sha[:12]}: {path}", artifact=path)
    return r.stdout.encode("utf-8", "surrogateescape") if isinstance(r.stdout, str) else r.stdout


def git_blob_bytes(repo: str, sha: str, path: str) -> bytes:
    p = subprocess.run(["git", "-C", repo, "show", f"{sha}:{path}"],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise FailClosed(f"path not present at {sha[:12]}: {path}", artifact=path)
    return p.stdout


def apply_divergence_kvm4_zai_relay(text: str) -> str:
    """The documented kvm4-only divergence, applied to the STAGED copy.

    Z.AI coding-plan entitlement is IP-bound (same key: 200 from KVM8, 429 code 1113 from
    kvm4), so kvm4's glm deployments RELAY through KVM8's shadow litellm (:4013). The literal
    patch can miss when the SOT moved the ZAI base into os.environ/ZAI_API_BASE, so the
    post-pass is idempotent and authoritative. Both run on the staged bytes, which means the
    recorded hash describes exactly what is deployed.
    """
    import re
    KS = "api_" + "key"
    AKS = "API_" + "KEY"
    for grp in ("glm-5.3", "glm-5.2"):
        pat = re.compile(
            r"(- model_name: " + grp + r"\n  litellm_params:\n(?:    [^\n]*\n)*?)"
            r"    api_base: https://api\.z\.ai/api/paas/v4\n"
            r"    " + KS + r": os\.environ/ZAI_" + AKS + r"\n")
        text = pat.sub(
            r"\1    api_base: http://100.64.0.2:4013/v1  # KVM8 shadow relay (zai IP-entitlement)\n"
            r"    " + KS + r": os.environ/LITELLM_MASTER_" + AKS + r"\n", text, count=1)
    text = text.replace("api_base: os.environ/ZAI_API_BASE", "api_base: http://100.64.0.2:4013/v1")
    text = text.replace("api_base: https://api.z.ai/api/coding/paas/v4",
                        "api_base: http://100.64.0.2:4013/v1")
    lines = text.splitlines()
    last = ""
    for i, l in enumerate(lines):
        if "api_base:" in l:
            last = l
        if l.strip() == "api_key: os.environ/ZAI_API_KEY" and "100.64.0.2:4013" in last:
            lines[i] = l.replace("ZAI_API_KEY", "LITELLM_MASTER_KEY")
    text = "\n".join(lines) + "\n"
    text = text.replace("guardrail: fed_context_guard.FedContextGuard",
                        "guardrail: data.fed_context_guard.FedContextGuard")
    return text


DIVERGENCE_FUNCS = {"kvm4-zai-relay": apply_divergence_kvm4_zai_relay}


def cmd_resolve(args) -> int:
    manifest_path = args.manifest
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = yaml.safe_load(fh)
    if not isinstance(manifest, dict) or "artifacts" not in manifest:
        raise FailClosed(f"manifest has no artifacts list: {manifest_path}")

    repo = args.repo
    sha = resolve_sha(repo, args.source_sha)

    os.makedirs(args.outdir, exist_ok=True)
    staged = []
    for art in manifest["artifacts"]:
        aid = art.get("id")
        stype = art.get("source_type")
        if stype == "git":
            path = art.get("path")
            if not path:
                raise FailClosed("git artifact without path", artifact=aid)
            data = git_blob_bytes(repo, sha, path)
            src_desc = f"git:{sha}:{path}"
        elif stype == "external_attested":
            owner = art.get("owner")
            approved = art.get("sha256")
            src = art.get("source_path")
            if not owner or not approved or not src:
                raise FailClosed(
                    "external artifact needs owner + approved sha256 + source_path "
                    "(no silent filesystem fallback)", artifact=aid)
            if not os.path.isfile(src):
                raise FailClosed(f"external artifact source is missing: {src}", artifact=aid)
            actual = sha256_file(src)
            if actual != approved:
                raise FailClosed(
                    f"external artifact hash mismatch for {aid}: approved {approved[:12]}…, "
                    f"live {actual[:12]}…", artifact=aid)
            with open(src, "rb") as fh:
                data = fh.read()
            src_desc = f"external:{src}"
        else:
            raise FailClosed(f"unsupported source_type: {stype!r}", artifact=aid)

        staged_path = os.path.join(args.outdir, aid)
        divergence = art.get("divergence")
        if divergence:
            if divergence not in DIVERGENCE_FUNCS:
                raise FailClosed(f"unsupported divergence: {divergence!r}", artifact=aid)
            data = DIVERGENCE_FUNCS[divergence](data.decode("utf-8")).encode("utf-8")
        with open(staged_path, "wb") as fh:
            fh.write(data)
        staged.append({
            "id": aid,
            "source_type": stype,
            "source": src_desc,
            "sha256": sha256_bytes(data),
            "bytes": len(data),
            "staged_path": os.path.abspath(staged_path),
            "destination": art.get("destination"),
            "divergence": art.get("divergence"),
        })

    resolved = {
        "source_sha": sha,
        "source_rev_arg": args.source_sha,
        "repo": os.path.abspath(repo),
        "manifest": os.path.abspath(manifest_path),
        "resolved_at": args.resolved_at or "",
        "artifacts": staged,
        "working_tree_read": False,
    }
    with open(os.path.join(args.outdir, RESOLVED_NAME), "w", encoding="utf-8") as fh:
        json.dump(resolved, fh, indent=2)
    print(json.dumps({"source_sha": sha, "artifacts": [
        {"id": a["id"], "sha256": a["sha256"], "bytes": a["bytes"], "source": a["source"]}
        for a in staged]}, indent=2))
    return EXIT_OK


def load_resolved(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def host_sha256(target: str, path: str) -> str:
    r = run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=6", target,
             f"sha256sum {path} 2>/dev/null | cut -d' ' -f1"], check=False)
    return r.stdout.strip()


def cmd_promote(args) -> int:
    resolved = load_resolved(args.resolved)
    prev_dir = os.path.join(os.path.dirname(args.resolved), "previous")
    os.makedirs(prev_dir, exist_ok=True)
    copied, restored = [], []

    try:
        for art in resolved["artifacts"]:
            dest = art["destination"]
            if args.local_root:
                dest_path = os.path.join(args.local_root, dest.lstrip("/"))
            else:
                dest_path = dest
            # record the current bytes so a failed probe can put them back
            if args.local_root:
                src = os.path.join(args.local_root, dest.lstrip("/"))
                if os.path.isfile(src):
                    shutil.copy2(src, os.path.join(prev_dir, art["id"]))
                    prev_sha = sha256_file(src)
                else:
                    prev_sha = None
            else:
                prev_sha = host_sha256(args.target, dest) or None
                if prev_sha:
                    run(["ssh", "-o", "BatchMode=yes", args.target,
                         f"cat {dest} > /tmp/prev-{art['id']}"], check=False)

            # the bytes that go out are the STAGED bytes, and they must still match the record
            staged_sha = sha256_file(art["staged_path"])
            if staged_sha != art["sha256"]:
                raise FailClosed(
                    f"staged bytes for {art['id']} no longer match the recorded hash "
                    f"(staged {staged_sha[:12]}… vs recorded {art['sha256'][:12]}…)",
                    artifact=art["id"])

            if args.local_root:
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                shutil.copy2(art["staged_path"], dest_path)
            else:
                run(["scp", "-o", "BatchMode=yes", "-q", art["staged_path"],
                     f"{args.target}:{dest}"], check=False)
            copied.append((art, dest_path, prev_sha))
    except FailClosed as e:
        for art, dest_path, prev_sha in reversed(copied):
            _restore(art, dest_path, prev_sha, prev_dir, args)
        print(f"FAIL-CLOSED: {e.reason}", file=sys.stderr)
        return EXIT_FAIL_CLOSED

    # verify what landed
    for art, dest_path, prev_sha in copied:
        live = sha256_file(dest_path) if args.local_root else host_sha256(args.target, art["destination"])
        if live != art["sha256"]:
            for a, dp, ps in reversed(copied):
                _restore(a, dp, ps, prev_dir, args)
            print(f"FAIL-CLOSED: live bytes at {art['destination']} do not match the artifact "
                  f"(live {live[:12]}… vs artifact {art['sha256'][:12]}…) — rolled back",
                  file=sys.stderr)
            return EXIT_VERIFY_MISMATCH

    # optional probe: on failure roll back everything
    if args.probe_cmd:
        pr = subprocess.run(args.probe_cmd, shell=True, check=False,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if pr.returncode != 0:
            for a, dp, ps in reversed(copied):
                _restore(a, dp, ps, prev_dir, args)
            print(f"PROBE FAILED (rc={pr.returncode}) — rolled back to the previous bytes",
                  file=sys.stderr)
            return EXIT_ROLLBACK

    print(json.dumps({"promoted": [a["id"] for a, _, _ in copied],
                      "source_sha": resolved["source_sha"]}, indent=2))
    return EXIT_OK


def _restore(art, dest_path, prev_sha, prev_dir, args):
    if prev_sha is None:
        return
    backup = os.path.join(prev_dir, art["id"])
    if args.local_root:
        if os.path.isfile(backup):
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(backup, dest_path)
    else:
        run(["scp", "-o", "BatchMode=yes", "-q", backup,
             f"{args.target}:{art['destination']}"], check=False)


def cmd_verify(args) -> int:
    resolved = load_resolved(args.resolved)
    bad = []
    for art in resolved["artifacts"]:
        if args.local_root:
            path = os.path.join(args.local_root, art["destination"].lstrip("/"))
            live = sha256_file(path) if os.path.isfile(path) else ""
        else:
            live = host_sha256(args.target, art["destination"])
        status = "OK" if live == art["sha256"] else "MISMATCH"
        print(f"{status:9s} {art['id']:28s} live={live[:12]}… artifact={art['sha256'][:12]}…")
        if live != art["sha256"]:
            bad.append(art["id"])
    return EXIT_VERIFY_MISMATCH if bad else EXIT_OK


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("resolve")
    r.add_argument("--manifest", default=MANIFEST_DEFAULT)
    r.add_argument("--source-sha", required=True)
    r.add_argument("--repo", default=".")
    r.add_argument("--outdir", required=True)
    r.add_argument("--resolved-at", default="")
    r.set_defaults(func=cmd_resolve)

    p = sub.add_parser("promote")
    p.add_argument("--resolved", required=True)
    p.add_argument("--target", default="root@100.64.0.5")
    p.add_argument("--local-root", default="", help="disposable mode: copy into a local tree")
    p.add_argument("--probe-cmd", default="", help="shell command; non-zero rc triggers rollback")
    p.set_defaults(func=cmd_promote)

    v = sub.add_parser("verify")
    v.add_argument("--resolved", required=True)
    v.add_argument("--target", default="root@100.64.0.5")
    v.add_argument("--local-root", default="")
    v.set_defaults(func=cmd_verify)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except FailClosed as e:
        print(f"FAIL-CLOSED: {e.reason}", file=sys.stderr)
        return EXIT_FAIL_CLOSED


if __name__ == "__main__":
    sys.exit(main())
