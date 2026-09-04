#!/usr/bin/env python3
"""Canonical Claims Drift Monitor — compares README/docs/MCP against CANONICAL_CLAIMS_REGISTRY.

Part of the arifOS Federation autonomous CI healing system.
SOT: 2026-07-25 | DITEMPA BUKAN DIBERI
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Locate paths_resolver relative to this script:
# scripts/drift-monitor.py → ../paradox-engine/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

# ── Config ─────────────────────────────────────────────────────────────
CANON_REGISTRY = org_path("AAA") / "docs" / "CANONICAL_CLAIMS_REGISTRY.json"
LOG_DIR = org_path("forge_work") / "ci-autofix"

ORGAN_PORTS: dict[str, int] = {
    "arifOS": 8088, "A-FORGE": 7071, "AAA": 3001,
    "GEOX": 8081, "WEALTH": 18082, "WELL": 18083,
}

# ── Helpers ────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def log(msg: str) -> None:
    print(f"[{now_iso()}] {msg}")

def fetch_json(url: str, timeout: int = 10) -> dict | None:
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"  ⚠️  Cannot reach {url}: {e}")
        return None

def load_registry() -> dict:
    return json.loads(CANON_REGISTRY.read_text())

# ── Probes ─────────────────────────────────────────────────────────────
def probe_health(organ: str) -> dict | None:
    port = ORGAN_PORTS.get(organ)
    if not port:
        return None
    return fetch_json(f"http://127.0.0.1:{port}/health")

def probe_readme_badge(organ: str, repo: str) -> dict | None:
    """Extract claims from GitHub README badges."""
    url = f"https://raw.githubusercontent.com/{repo}/main/README.md"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None

    # Extract badge claims
    import re
    findings: dict = {"tool_mentions": [], "port_mentions": [], "endpoint_mentions": []}

    tool_badge = re.findall(r"badge[^)]*?(\d+)\s*tools?", text, re.IGNORECASE)
    if tool_badge:
        findings["tool_badge_count"] = int(tool_badge[0])

    port_matches = re.findall(r":(\d{4,5})", text)
    findings["port_mentions"] = list(set(port_matches))

    endpoint_matches = re.findall(r"(https?://[a-z.-]+\.arif-fazil\.com/[^\s)\]]+)", text)
    findings["endpoint_mentions"] = list(set(endpoint_matches))

    # Find "canonical tools" claim
    tool_count_matches = re.findall(r"(\d+)\s*(?:canonical|public)\s*(?:tools|verbs)", text, re.IGNORECASE)
    if tool_count_matches:
        findings["canonical_tool_claim"] = int(tool_count_matches[0])

    return findings

def compare_claims(organ: str) -> list[dict]:
    """Compare runtime truth vs registry claims. Returns drift events."""
    registry = load_registry()
    org_spec = registry["organs"].get(organ)
    if not org_spec:
        return []

    drifts: list[dict] = []
    health = probe_health(organ)

    # ── Tool count drift ────────────────────────────────────────────
    if health:
        live_tools = health.get("tools_exposed_via_mcp") or health.get("tool_count", 0)
        spec_tools = org_spec.get("public_tool_count")
        if spec_tools and live_tools != spec_tools:
            drifts.append({
                "dimension": "TOOLS",
                "severity": "HOLD",
                "description": f"{organ}: registry claims {spec_tools} tools, live /health reports {live_tools}",
                "diff": {"expected": spec_tools, "actual": live_tools},
            })

        # ── Status drift ────────────────────────────────────────────
        status = health.get("status", "")
        if status != "healthy":
            drifts.append({
                "dimension": "HEALTH",
                "severity": "HOLD",
                "description": f"{organ}: /health status={status}, expected 'healthy'",
                "diff": {"expected": "healthy", "actual": status},
            })

    # ── PyPI version vs runtime version ─────────────────────────────
    if organ == "arifOS":
        pypi = fetch_json("https://pypi.org/pypi/arifos/json")
        if pypi and health:
            pypi_ver = pypi.get("info", {}).get("version", "")
            runtime_ver = health.get("version", "")
            if pypi_ver and runtime_ver and pypi_ver not in runtime_ver:
                drifts.append({
                    "dimension": "VERSIONS",
                    "severity": "CAUTION",
                    "description": f"arifOS: PyPI={pypi_ver}, runtime={runtime_ver}",
                    "diff": {"pypi": pypi_ver, "runtime": runtime_ver},
                })

    # ── README badge vs registry ────────────────────────────────────
    repo = org_spec.get("repo")
    if repo:
        readme = probe_readme_badge(organ, repo)
        if readme and readme.get("tool_badge_count"):
            badge_count = readme["tool_badge_count"]
            spec_tools = org_spec.get("public_tool_count")
            if spec_tools and badge_count != spec_tools:
                drifts.append({
                    "dimension": "README_BADGE",
                    "severity": "CAUTION",
                    "description": f"{organ}: README badge shows {badge_count} tools, registry says {spec_tools}",
                    "diff": {"badge": badge_count, "registry": spec_tools},
                })

    return drifts


# ── Main ───────────────────────────────────────────────────────────────
def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    all_drifts: dict[str, list[dict]] = {}
    total = 0

    for organ in sorted(ORGAN_PORTS):
        log(f"Probing {organ}...")
        drifts = compare_claims(organ)
        all_drifts[organ] = drifts
        total += len(drifts)
        for d in drifts:
            log(f"  🔴 [{d['severity']}] {d['dimension']}: {d['description']}")

    # ── Report ──────────────────────────────────────────────────────
    report_path = LOG_DIR / f"drift-report-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    report = {
        "timestamp": now_iso(),
        "total_drifts": total,
        "organs": all_drifts,
    }
    report_path.write_text(json.dumps(report, indent=2))

    if total == 0:
        log("✅ No drift detected — all claims match runtime truth")
    else:
        void_count = sum(1 for drifts in all_drifts.values() for d in drifts if d["severity"] == "VOID")
        hold_count = sum(1 for drifts in all_drifts.values() for d in drifts if d["severity"] == "HOLD")
        caution_count = sum(1 for drifts in all_drifts.values() for d in drifts if d["severity"] == "CAUTION")
        log(f"📊 Drift report: {total} total ({void_count} VOID, {hold_count} HOLD, {caution_count} CAUTION)")
        log(f"   Report: {report_path}")

    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
