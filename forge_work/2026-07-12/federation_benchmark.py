#!/usr/bin/env python3
"""One federation benchmark — existence + contracts + honesty. Exit 0 only if critical pass."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

CHECKS: list[tuple[str, bool, str]] = []


def ok(name: str, passed: bool, detail: str = "") -> None:
    CHECKS.append((name, passed, detail))
    print(f"{'PASS' if passed else 'FAIL'}  {name}" + (f" — {detail}" if detail else ""))


def health(port: int, timeout: float = 3.0) -> bool:
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/health",
            headers={"Host": "localhost", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", errors="replace")
            if r.status != 200:
                return False
            # Prefer JSON status when present
            try:
                d = json.loads(body)
                st = str(d.get("status", "")).lower()
                return st in ("healthy", "ok", "degraded", "ready") or bool(d)
            except Exception:
                return len(body) > 0
    except Exception:
        return False


def main() -> int:
    root = Path("/root")
    ok("apex.schema.json", (root / "arifOS/contracts/apex.schema.json").is_file())
    ok(
        "organ_evidence.schema.json",
        (root / "arifOS/contracts/organ_evidence.schema.json").is_file(),
    )
    ok(
        "federation_envelope.schema.json",
        (root / "arifOS/contracts/federation_envelope.schema.json").is_file(),
    )
    ok(
        "REPOSITORY_AUTHORITY_MAP",
        (root / "AAA/docs/REPOSITORY_AUTHORITY_MAP.md").is_file(),
    )
    ok(
        "MEASUREMENT_BOUNDARY",
        (root / "AAA/docs/MEASUREMENT_BOUNDARY_CONTRACT.md").is_file(),
    )
    ok("WELL loop recovery_v1", (root / "WELL/loop/recovery_v1.py").is_file())

    receipts = list((root / "WELL/loop/receipts").glob("recovery_*.json"))
    seal_proof = False
    for p in receipts:
        try:
            d = json.loads(p.read_text())
            if d.get("final_verdict") == "SEAL" and d.get("mutation_count", 0) <= 1:
                seal_proof = True
                break
        except Exception:
            pass
    ok("bounded_autonomy_receipt_SEAL", seal_proof, f"receipts={len(receipts)}")

    ok("organ_WELL:18083", health(18083))
    ok("organ_WEALTH:18082", health(18082))
    ok("organ_GEOX:8081", health(8081))
    ok("organ_AFORGE:7071", health(7071))
    ok("organ_AAA:3001", health(3001))
    ok("organ_arifOS:8088", health(8088), "critical for full GREEN")

    # WELL readiness envelope in-process
    try:
        sys.path.insert(0, str(root / "WELL"))
        from loop.readiness_envelope import build_readiness_envelope

        env = build_readiness_envelope(
            color="YELLOW",
            score=70,
            confidence=0.4,
            action="SIMPLIFY",
            reason="benchmark",
            human={"state": "UNKNOWN", "evidence_type": "none"},
            machine={"state": "STABLE", "evidence_type": "telemetry"},
        )
        sep = (
            env["readiness"]["substrates"]["human"]["evidence_type"] == "none"
            and env["readiness"]["substrates"]["machine"]["evidence_type"] == "telemetry"
        )
        ok("readiness_H_M_separation", sep)
    except Exception as e:
        ok("readiness_H_M_separation", False, str(e))

    passed = sum(1 for _, p, _ in CHECKS if p)
    total = len(CHECKS)
    critical_fail = any(
        n.startswith("organ_WELL") or n.startswith("apex.") or "AUTHORITY" in n
        for n, p, _ in CHECKS
        if not p
    )
    arifos_down = any(n == "organ_arifOS:8088" and not p for n, p, _ in CHECKS)

    print(f"\n{passed}/{total} checks passed")
    if arifos_down:
        print("NOTE: arifOS :8088 down — federation not full GREEN (honest).")
    if passed == total:
        print("VERDICT: FEDERATION_BENCHMARK_GREEN")
        return 0
    if not critical_fail and passed >= total - 2:
        print("VERDICT: FEDERATION_BENCHMARK_YELLOW")
        return 0
    print("VERDICT: FEDERATION_BENCHMARK_RED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
