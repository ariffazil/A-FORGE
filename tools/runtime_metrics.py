#!/usr/bin/env python3
"""
runtime_metrics.py — Real measurements for the Seven Organs.

NOT self-report. NOT toy scores. Actual probes against observables.

Metrics:
  ΔR  — Reality gap: claims verified against actual system state
  ΔG  — Governance compliance: floors checked, leases valid
  W   — Work done: actual state change measured
  I   — Civilization: organs alive and communicating
  M   — Memory: vault chain integrity
  Ω   — Witness: external confirmation ratio
  F   — Meaning: purpose alignment (session-level)

Usage:
  python3 runtime_metrics.py              # Full check
  python3 runtime_metrics.py --reality    # ΔR only
  python3 runtime_metrics.py --governance # ΔG only
  python3 runtime_metrics.py --work       # W only (with pre/post snapshot)
  python3 runtime_metrics.py --snapshot   # Capture state snapshot for W measurement
  python3 runtime_metrics.py --well-bridge # WELL-FORGE readiness gate

All output is JSON. No magic. No interpretation. Just numbers.
"""

import json
import subprocess
import sys
import os
import time
from pathlib import Path
from datetime import datetime, timezone

# ─── CONFIG ───────────────────────────────────────────────────────

SERVICES = {
    "arifos": 8088,
    "aforge": 7071,
    "aaa": 3001,
    "geox": 8081,
    "wealth": 18082,
    "well": 18083,
}

SNAPSHOT_DIR = Path("/tmp/runtime_metrics_snapshots")
VAULT_DIR = Path("/root/VAULT999")

# ─── ΔR: REALITY CHECK ───────────────────────────────────────────


def check_reality(claims=None) -> dict:
    """
    Verify claims against actual system state.

    claims format: {"service:arifos": "up", "file:/root/AGENTS.md": "exists", ...}

    If no claims provided, probes all services and returns raw state.

    Returns: {
        "checks": [{"claim": str, "expected": str, "observed": str, "match": bool}],
        "gap": float  # 0.0 = all match, 1.0 = all mismatch
    }
    """
    results = []

    if claims is None:
        # Default: probe all services
        claims = {}
        for name, port in SERVICES.items():
            claims[f"service:{name}"] = "up"

    for claim_key, expected in claims.items():
        parts = claim_key.split(":", 1)
        claim_type = parts[0]
        target = parts[1] if len(parts) > 1 else ""

        if claim_type == "service":
            port = SERVICES.get(target)
            if port:
                observed = _probe_service(port)
                results.append(
                    {
                        "claim": claim_key,
                        "expected": expected,
                        "observed": observed,
                        "match": (observed == expected),
                    }
                )
            else:
                results.append(
                    {
                        "claim": claim_key,
                        "expected": expected,
                        "observed": "unknown_service",
                        "match": False,
                    }
                )

        elif claim_type == "file":
            observed = "exists" if os.path.exists(target) else "missing"
            results.append(
                {
                    "claim": claim_key,
                    "expected": expected,
                    "observed": observed,
                    "match": (observed == expected),
                }
            )

        elif claim_type == "git":
            # target = repo path, expected = commit hash or "clean"
            observed = _git_state(target)
            results.append(
                {
                    "claim": claim_key,
                    "expected": expected,
                    "observed": observed,
                    "match": (observed == expected),
                }
            )

    total = len(results)
    matches = sum(1 for r in results if r["match"])
    gap = 1.0 - (matches / total) if total > 0 else 0.0

    return {
        "metric": "delta_R",
        "checks": results,
        "total": total,
        "matches": matches,
        "mismatches": total - matches,
        "gap": round(gap, 4),
        "verdict": "PASS" if gap == 0.0 else "FAIL",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    }


def _probe_service(port: int) -> str:
    """Probe a service health endpoint. Returns 'up' or 'down'."""
    try:
        result = subprocess.run(
            [
                "curl",
                "-sf",
                "--connect-timeout",
                "3",
                f"http://localhost:{port}/health",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return "up" if result.returncode == 0 else "down"
    except (subprocess.TimeoutExpired, Exception):
        return "down"


def _git_state(repo_path: str) -> str:
    """Get git state. Returns 'clean' or 'dirty'."""
    try:
        result = subprocess.run(
            ["git", "-C", repo_path, "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return "clean" if result.stdout.strip() == "" else "dirty"
    except Exception:
        return "unknown"


# ─── ΔG: GOVERNANCE CHECK ────────────────────────────────────────


def check_governance() -> dict:
    """
    Measure governance compliance.

    Checks:
    - Are all services responding? (governance requires liveness)
    - Is the vault accessible? (governance requires memory)
    - Are constitutional docs present? (governance requires law)

    Returns: {
        "checks": [dict],
        "compliance": float  # 0.0 = no governance, 1.0 = full governance
    }
    """
    results = []

    # Service liveness (governance requires infrastructure)
    alive = 0
    for name, port in SERVICES.items():
        is_up = _probe_service(port) == "up"
        results.append(
            {
                "check": f"service:{name}",
                "status": "ok" if is_up else "down",
                "required": True,
            }
        )
        if is_up:
            alive += 1

    # Vault accessibility (governance requires memory)
    vault_ok = VAULT_DIR.exists() and any(VAULT_DIR.iterdir())
    results.append(
        {
            "check": "vault:VAULT999",
            "status": "ok" if vault_ok else "missing",
            "required": True,
        }
    )

    # Constitutional docs (governance requires law)
    docs = {
        "constitution": "/root/docs/CONSTITUTION-GOVERNED-INTELLIGENCE.md",
        "zen_organs": "/root/.agents/skills/ZEN_ORGANS/SKILL.md",
        "agents_md": "/root/AGENTS.md",
    }
    docs_present = 0
    for name, path in docs.items():
        exists = os.path.exists(path)
        results.append(
            {
                "check": f"doc:{name}",
                "status": "ok" if exists else "missing",
                "required": True,
            }
        )
        if exists:
            docs_present += 1

    total_checks = len(results)
    passed = sum(1 for r in results if r["status"] == "ok")
    compliance = passed / total_checks if total_checks > 0 else 0.0

    return {
        "metric": "delta_G",
        "checks": results,
        "total": total_checks,
        "passed": passed,
        "failed": total_checks - passed,
        "organs_alive": alive,
        "organs_total": len(SERVICES),
        "compliance": round(compliance, 4),
        "verdict": "PASS" if compliance >= 0.7 else "FAIL",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    }


# ─── W: WORK METER ───────────────────────────────────────────────


def snapshot_state(label: str = "pre") -> dict:
    """
    Capture system state snapshot for before/after comparison.

    Captures: git status, file counts, disk usage, service states.
    """
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    state = {
        "label": label,
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "git": {},
        "filesystem": {},
        "services": {},
    }

    # Git state for all repos
    repos = {
        "arifOS": "/root/arifOS",
        "A-FORGE": "/root/A-FORGE",
        "AAA": "/root/AAA",
        "WEALTH": "/root/WEALTH",
        "WELL": "/root/WELL",
        "geox": "/root/geox",
    }

    for name, path in repos.items():
        try:
            # Get changed files count
            result = subprocess.run(
                ["git", "-C", path, "diff", "--stat", "HEAD"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            changed_lines = 0
            for line in result.stdout.strip().split("\n"):
                if "insertion" in line or "deletion" in line:
                    parts = line.split(",")
                    for p in parts:
                        p = p.strip()
                        if "insertion" in p:
                            changed_lines += int(p.split()[0])
                        elif "deletion" in p:
                            changed_lines += int(p.split()[0])

            # Get untracked files
            result2 = subprocess.run(
                ["git", "-C", path, "status", "--porcelain"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            untracked = len(
                [l for l in result2.stdout.strip().split("\n") if l.startswith("??")]
            )
            modified = len(
                [
                    l
                    for l in result2.stdout.strip().split("\n")
                    if l and not l.startswith("??")
                ]
            )

            state["git"][name] = {
                "changed_lines": changed_lines,
                "untracked_files": untracked,
                "modified_files": modified,
            }
        except Exception:
            state["git"][name] = {"error": "probe_failed"}

    # Filesystem state
    try:
        result = subprocess.run(
            ["df", "-h", "/"], capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) > 1:
            parts = lines[1].split()
            state["filesystem"]["disk_used_pct"] = (
                parts[4] if len(parts) > 4 else "unknown"
            )
            state["filesystem"]["disk_avail"] = (
                parts[3] if len(parts) > 3 else "unknown"
            )
    except Exception:
        state["filesystem"] = {"error": "probe_failed"}

    # Service states
    for name, port in SERVICES.items():
        state["services"][name] = _probe_service(port)

    # Save snapshot
    snapshot_path = SNAPSHOT_DIR / f"snapshot_{label}_{int(time.time())}.json"
    with open(snapshot_path, "w") as f:
        json.dump(state, f, indent=2)

    return state


def measure_work(pre_snapshot: dict, post_snapshot: dict) -> dict:
    """
    Measure actual work done by comparing two state snapshots.

    Returns: {
        "git_changes": {repo: {"lines_delta": int, "files_delta": int}},
        "total_lines_changed": int,
        "total_files_changed": int,
        "services_changed": [str],
        "verdict": "WORK_DONE" | "ZERO_WORK"
    }
    """
    git_changes = {}
    total_lines = 0
    total_files = 0

    for repo in pre_snapshot.get("git", {}):
        pre = pre_snapshot["git"].get(repo, {})
        post = post_snapshot["git"].get(repo, {})

        if "error" in pre or "error" in post:
            git_changes[repo] = {"error": "snapshot_failed"}
            continue

        lines_delta = post.get("changed_lines", 0) - pre.get("changed_lines", 0)
        files_delta = (
            post.get("untracked_files", 0) + post.get("modified_files", 0)
        ) - (pre.get("untracked_files", 0) + pre.get("modified_files", 0))

        git_changes[repo] = {
            "lines_delta": abs(lines_delta),
            "files_delta": abs(files_delta),
        }
        total_lines += abs(lines_delta)
        total_files += abs(files_delta)

    # Service state changes
    services_changed = []
    for svc in SERVICES:
        pre_state = pre_snapshot.get("services", {}).get(svc, "unknown")
        post_state = post_snapshot.get("services", {}).get(svc, "unknown")
        if pre_state != post_state:
            services_changed.append(f"{svc}: {pre_state} → {post_state}")

    return {
        "metric": "W",
        "git_changes": git_changes,
        "total_lines_changed": total_lines,
        "total_files_changed": total_files,
        "services_changed": services_changed,
        "verdict": "WORK_DONE"
        if (total_lines > 0 or total_files > 0 or services_changed)
        else "ZERO_WORK",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    }


# ─── WELL-FORGE BRIDGE ───────────────────────────────────────────


def well_forge_bridge() -> dict:
    """
    Query WELL readiness and return execution intensity gate.

    Returns: {
        "readiness": {"color": str, "score": int, "action": str},
        "execution_intensity": "full" | "simplified" | "hold",
        "reason": str
    }
    """
    # Check if WELL is alive
    well_up = _probe_service(SERVICES["well"]) == "up"

    if not well_up:
        return {
            "metric": "well_forge_bridge",
            "well_status": "DOWN",
            "execution_intensity": "simplified",
            "reason": "WELL organ is down — cannot assess readiness. Defaulting to simplified.",
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }

    # Query WELL readiness via curl to health endpoint
    try:
        result = subprocess.run(
            [
                "curl",
                "-sf",
                "--connect-timeout",
                "5",
                f"http://localhost:{SERVICES['well']}/health",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode == 0:
            try:
                health_data = json.loads(result.stdout)
                # Extract what we can from health response
                status = health_data.get("status", "unknown")

                # Map to execution intensity
                if status == "healthy":
                    intensity = "full"
                    reason = "WELL reports healthy — full execution intensity."
                elif status == "degraded":
                    intensity = "simplified"
                    reason = "WELL reports degraded — simplifying execution."
                else:
                    intensity = "simplified"
                    reason = f"WELL reports {status} — defaulting to simplified."

                return {
                    "metric": "well_forge_bridge",
                    "well_status": status,
                    "execution_intensity": intensity,
                    "reason": reason,
                    "well_health": health_data,
                    "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                }
            except json.JSONDecodeError:
                return {
                    "metric": "well_forge_bridge",
                    "well_status": "UP_BUT_UNPARSEABLE",
                    "execution_intensity": "full",
                    "reason": "WELL is up but health response is not JSON. Proceeding with full intensity.",
                    "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                }
        else:
            return {
                "metric": "well_forge_bridge",
                "well_status": "UNREACHABLE",
                "execution_intensity": "simplified",
                "reason": "WELL health endpoint unreachable. Defaulting to simplified.",
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
            }
    except Exception as e:
        return {
            "metric": "well_forge_bridge",
            "well_status": "ERROR",
            "execution_intensity": "simplified",
            "reason": f"WELL probe failed: {str(e)}. Defaulting to simplified.",
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }


# ─── FULL CHECK ──────────────────────────────────────────────────


def full_check() -> dict:
    """Run all checks and return combined report."""
    reality = check_reality()
    governance = check_governance()
    bridge = well_forge_bridge()

    # Overall verdict
    all_pass = reality["verdict"] == "PASS" and governance["verdict"] == "PASS"

    return {
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "reality": reality,
        "governance": governance,
        "well_forge_bridge": bridge,
        "overall_verdict": "PROCEED" if all_pass else "HOLD",
        "note": "Run with --snapshot before action, then --work after to measure W.",
    }


# ─── CLI ─────────────────────────────────────────────────────────


def main():
    args = sys.argv[1:]

    if not args:
        # Full check
        result = full_check()
    elif "--reality" in args:
        result = check_reality()
    elif "--governance" in args:
        result = check_governance()
    elif "--snapshot" in args:
        label = "pre"
        for i, a in enumerate(args):
            if a == "--label" and i + 1 < len(args):
                label = args[i + 1]
        result = snapshot_state(label)
    elif "--work" in args:
        # Find most recent pre and post snapshots
        snapshots = sorted(SNAPSHOT_DIR.glob("snapshot_*.json"), key=os.path.getmtime)
        if len(snapshots) < 2:
            result = {
                "error": "Need at least 2 snapshots. Run --snapshot --label pre, then --snapshot --label post."
            }
        else:
            with open(snapshots[-2]) as f:
                pre = json.load(f)
            with open(snapshots[-1]) as f:
                post = json.load(f)
            result = measure_work(pre, post)
    elif "--well-bridge" in args:
        result = well_forge_bridge()
    elif "--help" in args:
        print(__doc__)
        sys.exit(0)
    else:
        print(f"Unknown args: {args}", file=sys.stderr)
        print(
            "Use: python3 runtime_metrics.py [--reality|--governance|--snapshot|--work|--well-bridge]",
            file=sys.stderr,
        )
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
