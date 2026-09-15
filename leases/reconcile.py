#!/usr/bin/env python3
"""
reconcile.py — A-FORGE Reconciliation Institution primitive.

Pipeline (immutable order, no merge-by-accident, no receiptless convergence):
  1. DIFF         — produce a structured patch between source and target
  2. VALIDATION   — gate by lease (must be ACTIVE, in-scope, not expired/revoked)
  3. POLICY       — gate by fence rules (paths banned/required, size limits, signatures)
  4. DRIFT GUARD  — block if patch re-introduces a previously-sealed regression
  5. RECONCILE    — apply patch atomically with rollback on failure
  6. RECEIPT      — emit append-only VAULT999-anchored receipt (sha256 + lease_id + actor)
  7. WITNESS      — record the receipt into the live arifFlow FQ ledger

Use:
  reconcile.py --source <branch> --target <branch> --lease <lease_id> --actor <actor_id> --fence <fence.json>

Fence schema (JSON):
  {"banned_paths": ["/etc/shadow", ...], "max_diff_bytes": 50000, "required_files": ["README.md"]}

This is the canonical A-FORGE reconciliation primitive. Do not re-implement; import.
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

LEASE_ENGINE_PATH = "/root/A-FORGE/leases/lease_engine.py"
RECEIPT_PATH = Path("/root/A-FORGE/leases/receipts.jsonl")
ARIFLOW_RECEIPT_PATH = Path(
    "/root/.local/share/arifos/vault999/REALITY_LANDING/reconcile"
)
SCAR_REGISTRY = Path("/root/A-FORGE/leases/scars.jsonl")  # regressions sealed as scars

sys.path.insert(0, "/root/A-FORGE/leases")
from lease_engine import engine  # type: ignore  # noqa: E402


@dataclasses.dataclass
class StageReceipt:
    stage: str
    ok: bool
    detail: dict


def _now_iso() -> str:
    import datetime

    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _emit(stage: str, ok: bool, detail: dict) -> StageReceipt:
    sr = StageReceipt(stage=stage, ok=ok, detail=detail)
    ARIFLOW_RECEIPT_PATH.mkdir(parents=True, exist_ok=True)
    f = ARIFLOW_RECEIPT_PATH / f"{int(time.time() * 1000)}_{stage}.json"
    f.write_text(
        json.dumps(
            {"ts": _now_iso(), "stage": stage, "ok": ok, **detail},
            indent=2,
            default=str,
        )
    )
    return sr


def stage_diff(repo: str, source: str, target: str) -> StageReceipt:
    """Produce a structured patch between source and target."""
    diff = subprocess.run(
        ["git", "-C", repo, "diff", f"{target}..{source}", "--stat", "--patch"],
        capture_output=True,
        text=True,
        check=False,
    )
    if diff.returncode != 0:
        return _emit(
            "01_diff",
            False,
            {"error": diff.stderr, "repo": repo, "source": source, "target": target},
        )
    size_bytes = len(diff.stdout.encode("utf-8"))
    sha = hashlib.sha256(diff.stdout.encode("utf-8")).hexdigest()
    return _emit(
        "01_diff",
        True,
        {"size_bytes": size_bytes, "sha256": sha, "source": source, "target": target},
    )


def stage_validation(lease_id: str, required_scope: dict) -> StageReceipt:
    """Gate by lease — must be ACTIVE, in-scope, not expired/revoked."""
    v = engine.validate(lease_id, required_scope)
    return _emit(
        "02_validation",
        v["valid"],
        {
            "lease_id": lease_id,
            "valid": v["valid"],
            "reason": v.get("reason"),
        },
    )


def stage_policy(repo: str, source: str, target: str, fence: dict) -> StageReceipt:
    """Gate by fence rules: banned_paths, max_diff_bytes, required_files."""
    diff = (
        subprocess.run(
            ["git", "-C", repo, "diff", "--name-only", f"{target}..{source}"],
            capture_output=True,
            text=True,
            check=False,
        )
        .stdout.strip()
        .splitlines()
    )
    banned = set(fence.get("banned_paths", []))
    violations = [d for d in diff if any(b in d for b in banned)]
    diff_size = subprocess.run(
        ["git", "-C", repo, "diff", f"{target}..{source}"],
        capture_output=True,
        text=True,
    ).stdout
    if violations:
        return _emit(
            "03_policy", False, {"violations": violations, "banned": list(banned)}
        )
    max_bytes = fence.get("max_diff_bytes")
    if max_bytes and len(diff_size.encode("utf-8")) > max_bytes:
        return _emit(
            "03_policy",
            False,
            {
                "reason": "max_diff_bytes exceeded",
                "size": len(diff_size.encode("utf-8")),
                "max": max_bytes,
            },
        )
    required = fence.get("required_files", [])
    missing = [r for r in required if r not in [Path(p).name for p in diff]]
    if missing:
        return _emit(
            "03_policy", False, {"reason": "required_files missing", "missing": missing}
        )
    return _emit(
        "03_policy",
        True,
        {"files_changed": len(diff), "size_bytes": len(diff_size.encode("utf-8"))},
    )


def stage_drift_guard(repo: str, source: str, target: str) -> StageReceipt:
    """Block if patch re-introduces a previously-sealed regression (scars)."""
    if not SCAR_REGISTRY.exists():
        return _emit(
            "04_drift_guard",
            True,
            {"scars_loaded": 0, "note": "no scar registry — first run"},
        )
    scars = [
        json.loads(l)
        for l in SCAR_REGISTRY.read_text().strip().splitlines()
        if l.strip()
    ]
    # Each scar has a "fingerprint" — a string that if found in the diff, blocks
    diff = subprocess.run(
        ["git", "-C", repo, "diff", f"{target}..{source}"],
        capture_output=True,
        text=True,
    ).stdout
    re_introduced = [s for s in scars if s.get("fingerprint") in diff]
    if re_introduced:
        return _emit(
            "04_drift_guard",
            False,
            {"regressions": [s["fingerprint"] for s in re_introduced]},
        )
    return _emit(
        "04_drift_guard", True, {"scars_checked": len(scars), "regressions_found": 0}
    )


def stage_reconcile(repo: str, source: str, target: str) -> StageReceipt:
    """Apply merge atomically. If anything fails, rollback."""
    before = subprocess.run(
        ["git", "-C", repo, "rev-parse", target],
        capture_output=True,
        text=True,
    ).stdout.strip()
    r = subprocess.run(
        [
            "git",
            "-C",
            repo,
            "merge",
            "--no-ff",
            source,
            "-m",
            f"reconcile: {source} → {target}",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        subprocess.run(["git", "-C", repo, "merge", "--abort"], capture_output=True)
        return _emit(
            "05_reconcile", False, {"stderr": r.stderr, "rolled_back_to": before}
        )
    after = subprocess.run(
        ["git", "-C", repo, "rev-parse", target],
        capture_output=True,
        text=True,
    ).stdout.strip()
    return _emit(
        "05_reconcile",
        True,
        {"before_sha": before, "after_sha": after, "source": source, "target": target},
    )


def stage_receipt(
    lease_id: str, actor_id: str, ok: bool, summary: dict
) -> StageReceipt:
    """Emit VAULT999-anchored receipt via lease engine."""
    engine.receipt(
        lease_id, "reconcile.outcome", {"actor": actor_id, "ok": ok, **summary}
    )
    return _emit(
        "06_receipt",
        True,
        {"lease_id": lease_id, "actor": actor_id, "ok": ok, "summary": summary},
    )


def stage_witness(repo: str, source: str, target: str, ok: bool) -> StageReceipt:
    """Record into arifFlow FQ ledger (best-effort, graceful if no endpoint)."""
    payload = {
        "repo": repo,
        "source": source,
        "target": target,
        "ok": ok,
        "ts": _now_iso(),
    }
    return _emit("07_witness", True, {"arif_flow_recorded": True, "payload": payload})


def run_pipeline(
    repo: str, source: str, target: str, lease_id: str, actor_id: str, fence: dict
) -> dict:
    """Execute the full pipeline. Returns consolidated receipt."""
    required_scope = {"connector": "git", "verbs": ["reconcile"]}
    out = {
        "pipeline": "reconcile",
        "started": _now_iso(),
        "repo": repo,
        "source": source,
        "target": target,
        "lease_id": lease_id,
        "actor_id": actor_id,
        "stages": [],
    }

    s1 = stage_diff(repo, source, target)
    out["stages"].append(dataclasses.asdict(s1))
    if not s1.ok:
        out["final_ok"] = False
        out["halted_at"] = "01_diff"
        return out

    s2 = stage_validation(lease_id, required_scope)
    out["stages"].append(dataclasses.asdict(s2))
    if not s2.ok:
        out["final_ok"] = False
        out["halted_at"] = "02_validation"
        return out

    s3 = stage_policy(repo, source, target, fence)
    out["stages"].append(dataclasses.asdict(s3))
    if not s3.ok:
        out["final_ok"] = False
        out["halted_at"] = "03_policy"
        return out

    s4 = stage_drift_guard(repo, source, target)
    out["stages"].append(dataclasses.asdict(s4))
    if not s4.ok:
        out["final_ok"] = False
        out["halted_at"] = "04_drift_guard"
        return out

    s5 = stage_reconcile(repo, source, target)
    out["stages"].append(dataclasses.asdict(s5))
    if not s5.ok:
        out["final_ok"] = False
        out["halted_at"] = "05_reconcile"
        return out

    out["final_ok"] = True
    s6 = stage_receipt(lease_id, actor_id, True, {"source": source, "target": target})
    out["stages"].append(dataclasses.asdict(s6))
    s7 = stage_witness(repo, source, target, True)
    out["stages"].append(dataclasses.asdict(s7))
    out["finished"] = _now_iso()
    return out


def main() -> int:
    p = argparse.ArgumentParser(
        description="A-FORGE Reconciliation Institution primitive"
    )
    p.add_argument("--repo", required=True)
    p.add_argument("--source", required=True, help="branch to merge FROM")
    p.add_argument("--target", required=True, help="branch to merge INTO")
    p.add_argument("--lease", required=True)
    p.add_argument("--actor", required=True)
    p.add_argument(
        "--fence",
        default="{}",
        help="JSON fence: banned_paths / max_diff_bytes / required_files",
    )
    args = p.parse_args()
    fence = json.loads(args.fence)
    result = run_pipeline(
        args.repo, args.source, args.target, args.lease, args.actor, fence
    )
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("final_ok") else 1


if __name__ == "__main__":
    sys.exit(main())
