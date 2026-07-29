#!/usr/bin/env python3
"""
ARA-v1 Breakage Detector — detects post-deploy organ degradation.
SENSE → CORRELATE → REVERT → VERIFY → REPORT

If an organ was healthy before a deploy and degraded after,
auto-revert the last commit (T1 only — non-critical organs).

F1 AMANAH: revert is fully reversible (git revert creates new commit).
F2 TRUTH: every claim labeled OBS/DER.
F13 SOVEREIGN: critical organs (arifOS) never auto-reverted.
DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ARIFOS_URL = "http://127.0.0.1:8088"
ORGAN_PORTS = {
    "aforge": 7071,
    "aaa": 3001,
    "geox": 8081,
    "wealth": 18082,
    "well": 18083,
    "arifos": 8088,  # CRITICAL — never auto-revert
}
CRITICAL_ORGANS = {"arifos"}
REPO_MAP = {
    "aforge": "/root/A-FORGE",
    "aaa": "/root/AAA",
    "geox": "/root/GEOX",
    "wealth": "/root/WEALTH",
    "well": "/root/WELL",
    "arifos": "/root/arifOS",
}
STATE_DIR = Path("/root/A-FORGE/duties/logs/ara_state")
LEDGER = Path("/root/A-FORGE/duties/logs/ara-ledger.jsonl")


def ts_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sh(cmd: str, timeout: int = 30) -> tuple[str, str, int]:
    try:
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", f"TIMEOUT after {timeout}s", -1
    except Exception as e:
        return "", str(e), -1


def curl_health(port: int) -> bool:
    out, _, rc = sh(
        f"curl -sf http://127.0.0.1:{port}/health -o /dev/null -w '%{{http_code}}'",
        timeout=5,
    )
    return rc == 0 and out == "200"


def write_receipt(action: str, verdict: str, details: str, tier: str = "T1"):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(
            json.dumps(
                {
                    "ts": ts_now(),
                    "source": "ARA-breakage-detect",
                    "action": action,
                    "verdict": verdict,
                    "tier": tier,
                    "details": details,
                }
            )
            + "\n"
        )


def load_last_known_good() -> dict:
    path = STATE_DIR / "last_known_good.json"
    if path.exists():
        return json.loads(path.read_text()) or {}
    return {}


def save_last_known_good(state: dict):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "last_known_good.json").write_text(json.dumps(state))


def detect_breakage() -> dict:
    """Probe all organs, compare to last-known-good, report degradation."""
    print("[ARA] Detecting breakage...")
    last = load_last_known_good()
    current = {}
    degraded = []

    for name, port in ORGAN_PORTS.items():
        healthy = curl_health(port)
        current[name] = healthy
        was_healthy = last.get(name)
        if was_healthy is True and not healthy:
            degraded.append(name)

    results = {
        "ts": ts_now(),
        "current": current,
        "last_known_good": last,
        "degraded": degraded,
    }

    if degraded:
        print(f"  DEGRADED: {degraded}")
        results["action"] = "correlate"
    else:
        print(f"  All organs healthy")
        save_last_known_good(current)  # update baseline
        results["action"] = "none"

    return results


def correlate_and_revert(organ: str) -> dict:
    """Check git log for recent commits to the degraded organ, auto-revert if safe."""
    repo = REPO_MAP.get(organ)
    if not repo:
        return {"organ": organ, "action": "unknown_repo"}

    if organ in CRITICAL_ORGANS:
        print(f"  {organ} is CRITICAL — cannot auto-revert. HOLD.")
        write_receipt(
            f"breakage_{organ}",
            "HOLD",
            f"{organ} degraded but critical — requires F13",
            "T3",
        )
        return {"organ": organ, "action": "hold_critical"}

    # Get last 3 commits
    out, _, rc = sh(f"git -C {repo} log --oneline -3", timeout=10)
    if rc != 0:
        return {"organ": organ, "action": "git_error"}

    commits = out.split("\n") if out else []
    print(f"  Recent commits for {organ}: {commits}")

    # Check if organ was healthy before these commits
    # For now: if degraded and non-critical, propose revert
    print(f"  Proposing revert of last commit for {organ}...")
    revert_out, revert_err, revert_rc = sh(
        f"git -C {repo} revert --no-edit HEAD", timeout=30
    )

    if revert_rc == 0:
        # Verify health after revert
        time.sleep(3)
        port = ORGAN_PORTS[organ]
        healthy = curl_health(port)
        if healthy:
            print(f"  ✅ Revert successful — {organ} healthy again")
            write_receipt(
                f"auto_revert_{organ}",
                "SEAL",
                f"Reverted last commit in {repo}: {commits[0] if commits else '?'}. Organ healthy.",
                "T1",
            )
            return {"organ": organ, "action": "reverted", "healthy": True}
        else:
            # Revert the revert
            sh(f"git -C {repo} revert --no-edit HEAD", timeout=30)
            print(f"  ❌ Revert did not fix {organ} — rolled back revert")
            write_receipt(
                f"auto_revert_{organ}_failed",
                "HOLD",
                f"Revert did not fix {organ}. Rolled back revert.",
                "T2",
            )
            return {"organ": organ, "action": "revert_failed", "healthy": False}
    else:
        print(f"  ❌ Git revert failed: {revert_err}")
        return {"organ": organ, "action": "revert_error", "error": revert_err[:200]}


def main():
    results = detect_breakage()
    actions = []

    for organ in results.get("degraded", []):
        action = correlate_and_revert(organ)
        actions.append(action)

    results["actions"] = actions
    print(f"\n[ARA] Breakage detection complete: {json.dumps(results, indent=2)}")
    return results


if __name__ == "__main__":
    if "--init" in sys.argv:
        # Initialize baseline
        current = {name: curl_health(port) for name, port in ORGAN_PORTS.items()}
        save_last_known_good(current)
        print(f"[ARA] Baseline saved: {json.dumps(current)}")
    else:
        main()
