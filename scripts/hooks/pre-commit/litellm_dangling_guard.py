#!/usr/bin/env python3
"""LITELLM DANGLING GUARD — pre-commit gate for /root/A-FORGE/litellm-config.yaml

Spec (FI-001/333-AGI, cross-audit 2026-10-03; endorsed + built by FI-008):
  1. Every group referenced in router_settings.fallbacks /
     context_window_fallbacks MUST exist in model_list (model_name).
  2. model_name count delta vs HEAD > 2 → BLOCK unless flagged:
     commit message contains "config-regen" (best-effort via .git/COMMIT_EDITMSG)
     OR env LITELLM_GUARD_SKIP_DELTA=1 (audited override).

Failure class (real, 2 incidents — passes Canon #0):
  - bc98843d (2026-09-30, 333-AGI bulk checkpoint): config regen silently
    dropped 8 i-arif deployments. Caught only by manual probe, 3 days later.
  - b4670f33 era: fallbacks referenced nonexistent deepseek-v4-pro group
    (repaired post-hoc). Manual dangling scan caught 3 broken refs.

Doctrine-gate watches .md; nothing watched config YAML. This closes that gap
at the commit boundary. F2: an artifact must be internally consistent before
it can claim to be configuration.

Usage:
  litellm_dangling_guard.py               # gate mode (staged litellm-config.yaml)
  litellm_dangling_guard.py --file X      # check explicit file (testing)
  litellm_dangling_guard.py --head-ref R  # delta baseline ref (default HEAD)
"""
import os
import re
import subprocess
import sys

CONFIG = "litellm-config.yaml"
DELTA_LIMIT = 2


def _git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def _git_show(ref_path):
    r = _git("show", ref_path)
    return r.stdout if r.returncode == 0 else None


def _parse_with_yaml(text):
    import yaml  # noqa
    data = yaml.safe_load(text) or {}
    model_list = data.get("model_list") or []
    names = set()
    for m in model_list:
        if isinstance(m, dict) and m.get("model_name") is not None:
            names.add(str(m["model_name"]))
    router = data.get("router_settings") or {}
    refs = set()
    for key in ("fallbacks", "context_window_fallbacks"):
        block = router.get(key) or []
        if isinstance(block, list):
            for entry in block:
                if isinstance(entry, dict):
                    for _group, targets in entry.items():
                        if isinstance(targets, list):
                            refs.update(str(t) for t in targets)
                        elif isinstance(targets, str):
                            refs.add(targets)
    return names, refs


def _parse_with_regex(text):
    """Fallback when PyYAML unavailable. Indentation-scoped section scan."""
    names = set(re.findall(r"^\s*-\s*model_name:\s*[\"']?([A-Za-z0-9_.\-/]+)", text, re.M))
    refs = set()
    lines = text.splitlines()
    in_router = False
    in_fb = False
    for ln in lines:
        if re.match(r"^router_settings:", ln):
            in_router = True
            continue
        if in_router and re.match(r"^\S", ln):
            in_router = False
        if in_router and re.match(r"^\s+(fallbacks|context_window_fallbacks):", ln):
            in_fb = True
            continue
        if in_fb and re.match(r"^\s{4}\S", ln) and not re.match(r"^\s+-", ln):
            in_fb = False
        if in_fb:
            m = re.match(r"^\s+-\s*[\"']?([A-Za-z0-9_.\-/]+)", ln)
            if m and not ln.lstrip().startswith("- model_name"):
                refs.add(m.group(1))
    return names, refs


def parse(text):
    try:
        import yaml  # noqa: F401
        return _parse_with_yaml(text)
    except Exception:
        return _parse_with_regex(text)


def commit_msg_has_flag():
    flag = False
    try:
        with open(os.path.join(_git("rev-parse", "--git-dir").stdout.strip(), "COMMIT_EDITMSG")) as fh:
            flag = "config-regen" in fh.read()
    except Exception:
        pass
    if os.environ.get("LITELLM_GUARD_SKIP_DELTA") == "1":
        flag = True
    return flag


def check(content, head_ref="HEAD"):
    names, refs = parse(content)
    dangling = sorted(refs - names)
    errors = []
    if dangling:
        errors.append(
            "DANGLING FALLBACK REFS — referenced but absent from model_list: "
            + ", ".join(dangling)
        )
    head_text = _git_show(f"{head_ref}:{CONFIG}")
    if head_text is not None:
        head_names, _ = parse(head_text)
        delta = abs(len(names) - len(head_names))
        if delta > DELTA_LIMIT and not commit_msg_has_flag():
            errors.append(
                f"MODEL_NAME COUNT DELTA {len(head_names)}→{len(names)} (>{DELTA_LIMIT}). "
                "Add 'config-regen' to the commit message or set LITELLM_GUARD_SKIP_DELTA=1 "
                "if this is an intentional regeneration."
            )
    return errors, len(names), len(refs)


def main():
    args = sys.argv[1:]
    target = CONFIG
    head_ref = "HEAD"
    if "--file" in args:
        target = args[args.index("--file") + 1]
        content = open(target, encoding="utf-8").read()
        if "--head-ref" in args:
            head_ref = args[args.index("--head-ref") + 1]
    else:
        staged = _git("diff", "--cached", "--name-only", "--diff-filter=ACM").stdout.split()
        if CONFIG not in staged:
            sys.exit(0)  # not staged — gate not applicable
        content = _git_show(f":{CONFIG}")
        if content is None:
            sys.exit(0)

    errors, n_names, n_refs = check(content, head_ref)
    if errors:
        print(f"❌ LITELLM-DANGLING-GUARD: {target} BLOCKED", file=sys.stderr)
        for e in errors:
            print(f"   {e}", file=sys.stderr)
        print(
            "   Failure class: bc98843d i-arif drop + deepseek-v4-pro dangling (2 incidents).\n"
            "   Fix refs, or flag intentional regen ('config-regen' / LITELLM_GUARD_SKIP_DELTA=1).",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"⬡ LITELLM-DANGLING-GUARD: PASS ({n_names} models, {n_refs} fallback refs consistent)")
    sys.exit(0)


if __name__ == "__main__":
    main()
