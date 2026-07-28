#!/usr/bin/env python3
"""
AAA Orchestrator — Cross-Agent 8-Step Agentic Loop
══════════════════════════════════════════════════

Generalizes the 8-step agentic loop (DETECT→INVENTORY→SCORE→PROPOSE→
RATIFY→APPLY→AUDIT→SEAL) into the arifOS federation. Runs autonomously
as a periodic agent that coordinates detection, classification, and
execution across all organs.

Constitutional binding:
  F1  — Reversible-first. T1 actions only. T2+ requires sovereign.
  F2  — Every claim labeled OBS/DER/INT/SPEC.
  F4  — ΔS ≤ 0.
  F7  — Cap confidence at 0.90.
  F11 — Every action logged with receipt.
  F13 — Arif holds final veto. T3 = 888_HOLD.

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import json
import hashlib
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# ── Constants ─────────────────────────────────────────────────────────────

ARIFLOW_URL = "http://127.0.0.1:7073"
ORGAN_PORTS = {
    "arifos": 8088,
    "aforge": 7071,
    "aaa": 3001,
    "geox": 8081,
    "wealth": 18082,
    "well": 18083,
}
CRITICAL_ORGANS = {"arifos"}
FEDERATION_REPOS = {
    "arifOS": "/root/arifOS",
    "A-FORGE": "/root/A-FORGE",
    "AAA": "/root/AAA",
    "GEOX": "/root/GEOX",
    "WEALTH": "/root/WEALTH",
    "WELL": "/root/WELL",
}
AGENT_REGISTRY = Path("/root/AAA/registries/models/AGENT_MODEL_MAP.json")
GOAL_REGISTRY = Path("/root/AAA/state/goal_registry.json")
LEDGER = Path("/root/A-FORGE/duties/logs/orchestrator-ledger.jsonl")
LOOP_ID = "orchestrator-v1"


def ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def sh(cmd: str, timeout: int = 30) -> tuple[str, str, int]:
    try:
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except Exception as e:
        return "", str(e), -1


def curl_health(port: int) -> bool:
    out, _, rc = sh(
        f"curl -sf http://127.0.0.1:{port}/health -o /dev/null -w '%{{http_code}}'",
        timeout=5,
    )
    return rc == 0 and out == "200"


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text()) or {}
    except (json.JSONDecodeError, OSError):
        return {}


def write_receipt(action: str, verdict: str, details: str, tier: str = "T1"):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(
            json.dumps(
                {
                    "ts": ts(),
                    "source": LOOP_ID,
                    "action": action,
                    "verdict": verdict,
                    "tier": tier,
                    "details": details,
                }
            )
            + "\n"
        )


# ── Step 1: DETECT — find drift across all organs ─────────────────────────


def detect_drift() -> dict:
    """Scan all organs for: health degradation, git divergence, contradictions."""
    print("[ORCH-1] DETECT phase...")
    findings: dict = {"organs": {}, "git": {}, "flags": []}

    # Organ health
    for name, port in ORGAN_PORTS.items():
        findings["organs"][name] = curl_health(port)
    alive = sum(1 for v in findings["organs"].values() if v)
    findings["organs"]["_alive"] = f"{alive}/{len(ORGAN_PORTS)}"
    if alive < len(ORGAN_PORTS):
        findings["flags"].append(
            {
                "severity": "HIGH",
                "type": "organ_down",
                "count": len(ORGAN_PORTS) - alive,
            }
        )

    # Git divergence
    for name, path in FEDERATION_REPOS.items():
        out, _, rc = sh(
            f"git -C {path} status --porcelain 2>/dev/null | wc -l", timeout=10
        )
        dirty = int(out.strip() or "0") if rc == 0 else -1
        findings["git"][name] = dirty
        if dirty > 5:
            findings["flags"].append(
                {"severity": "LOW", "type": "dirty_repo", "repo": name, "count": dirty}
            )

    # Pre-commit gate for main repos only (fast check)
    blocked_repos = []
    for name in ("arifOS", "A-FORGE", "AAA"):
        path = FEDERATION_REPOS.get(name, "")
        if path:
            out, _, rc = sh(
                f"/root/A-FORGE/duties/precommit-gate.sh {path}", timeout=10
            )
            if rc != 0:
                blocked_repos.append(name)
    if blocked_repos:
        findings["flags"].append(
            {"severity": "MEDIUM", "type": "precommit_blocked", "repos": blocked_repos}
        )

    findings["flags_count"] = len(findings["flags"])
    print(f"  organs={findings['organs']['_alive']} flags={findings['flags_count']}")
    return findings


# ── Step 2: INVENTORY — what capabilities exist ───────────────────────────


def inventory_agents() -> dict:
    """Load agent registry, classify by autonomous tier."""
    print("[ORCH-2] INVENTORY phase...")
    reg = load_json(AGENT_REGISTRY)
    agents = reg.get("agents", [])

    inventory: dict = {"total": len(agents), "by_tier": {}, "eligible": []}
    for a in agents:
        profile = a.get("autonomous_profile", {})
        tier = profile.get("max_tier", "T0")
        inventory.setdefault("by_tier", {}).setdefault(tier, 0)
        inventory["by_tier"][tier] += 1
        if tier in ("T1", "T1.5"):
            inventory["eligible"].append(
                {
                    "agent_id": a.get("agent_id"),
                    "tier": tier,
                    "triggers": profile.get("triggers", []),
                }
            )

    print(
        f"  {inventory['total']} agents, {len(inventory['eligible'])} autonomous-eligible"
    )
    return inventory


# ── Step 3: SCORE — floor-check candidate actions ─────────────────────────

FLOORS = {
    "F1": "Reversible-first. Irreversible → 888_HOLD.",
    "F2": "≥ 0.99 fidelity. Claims must cite evidence.",
    "F4": "ΔS ≤ 0 — every output reduces entropy.",
    "F7": "Ω₀ ∈ [0.03, 0.05]. No fake certainty.",
    "F11": "Every decision logged, inspectable, attributable.",
    "F13": "Human veto FINAL. Strongest floor.",
}


def score_actions(findings: dict, inventory: dict) -> dict:
    """Floor-check candidate actions from detection against F1-F13."""
    print("[ORCH-3] SCORE phase...")
    actions: list[dict] = []
    flags = findings.get("flags", [])

    for flag in flags:
        action: dict = {"flag": flag, "passed": True, "violations": [], "tier": "T1"}

        # F1: Is it reversible?
        if flag["type"] in ("organ_down", "dirty_repo"):
            action["reversible"] = True
        elif flag["type"] == "precommit_blocked":
            action["reversible"] = "partial"
            action["tier"] = "T2"
        else:
            action["reversible"] = False
            action["violations"].append("F1: irreversible — requires 888_HOLD")
            action["passed"] = False

        # F2: Evidence labeled?
        action["evidence"] = f"[OBS] {flag.get('type')} detected at {ts()}"

        # F13: Human veto boundary
        if flag.get("severity") == "CRITICAL":
            action["tier"] = "T3"
            action["violations"].append("F13: CRITICAL severity requires sovereign")
            action["passed"] = False

        actions.append(action)

    result = {"actions": actions, "t1_count": 0, "t2_count": 0, "t3_count": 0}
    for a in actions:
        key = f"{a['tier'].lower()}_count"
        if key in result:
            result[key] += 1

    print(
        f"  actions: {len(actions)} ({result['t1_count']} T1, {result['t2_count']} T2, {result['t3_count']} T3)"
    )
    return result


# ── Step 4: PROPOSE — generate DAG plan ──────────────────────────────────


def propose_plan(scored: dict, inventory: dict) -> dict:
    """Generate a DAG execution plan from scored actions."""
    print("[ORCH-4] PROPOSE phase...")
    plan: dict = {"stages": [], "estimated_cost_ms": 0}

    t1_actions = [
        a
        for a in scored.get("actions", [])
        if a.get("tier") == "T1" and a.get("passed")
    ]
    t2_actions = [
        a
        for a in scored.get("actions", [])
        if a.get("tier") == "T2" and a.get("passed")
    ]
    t3_actions = [a for a in scored.get("actions", []) if a.get("tier") == "T3"]

    # Stage 1: T1 actions (auto-execute)
    if t1_actions:
        stage1 = {"stage": 1, "tier": "T1", "ratification": "auto", "actions": []}
        for a in t1_actions:
            flag = a["flag"]
            if flag["type"] == "dirty_repo":
                stage1["actions"].append(
                    {
                        "action": "commit_or_stash",
                        "target": flag.get("repo"),
                        "description": f"Commit or stash {flag.get('count')} files in {flag.get('repo')}",
                    }
                )
        if stage1["actions"]:
            plan["stages"].append(stage1)
            plan["estimated_cost_ms"] += 5000 * len(stage1["actions"])

    # Stage 2: T2 actions (announce then execute)
    if t2_actions:
        stage2 = {
            "stage": 2,
            "tier": "T2",
            "ratification": "announce_10s",
            "actions": [],
        }
        for a in t2_actions:
            flag = a["flag"]
            stage2["actions"].append(
                {
                    "action": "announce",
                    "target": "Telegram",
                    "description": f"Pre-commit BLOCKED on {flag.get('repos', [])} — review required",
                }
            )
        plan["stages"].append(stage2)
        plan["estimated_cost_ms"] += 10000

    # Stage 3: T3 actions (888_HOLD — do not execute)
    if t3_actions:
        plan["stages"].append(
            {
                "stage": 3,
                "tier": "T3",
                "ratification": "888_HOLD",
                "actions": [
                    {
                        "action": "surface_to_sovereign",
                        "description": f"{len(t3_actions)} T3 items require Arif",
                    }
                ],
            }
        )

    print(f"  plan: {len(plan['stages'])} stages, est={plan['estimated_cost_ms']}ms")
    return plan


# ── Step 5+6: RATIFY + APPLY ──────────────────────────────────────────────


def ratify_and_apply(plan: dict) -> dict:
    """For T1: auto-apply. For T2: announce (log). For T3: surface."""
    print("[ORCH-5+6] RATIFY + APPLY phase...")
    results: dict = {"applied": 0, "announced": 0, "held": 0, "details": []}

    for stage in plan.get("stages", []):
        tier = stage.get("tier")

        if tier == "T1":
            for action in stage.get("actions", []):
                target = action.get("target", "")
                desc = action.get("description", "")

                if action["action"] == "commit_or_stash":
                    # T1: Auto-commit uncommitted changes with F2 evidence
                    repo_path = FEDERATION_REPOS.get(target, "")
                    if repo_path:
                        out, _, rc = sh(
                            f"git -C {repo_path} status --porcelain", timeout=10
                        )
                        if out.strip():
                            # Log but don't auto-commit (too risky without content review)
                            results["details"].append(
                                f"T1: {target} has {len(out.splitlines())} uncommitted — flagged for review, not auto-committed"
                            )
                            write_receipt(
                                f"flag_dirty_{target}",
                                "HOLD",
                                f"{target}: {len(out.splitlines())} uncommitted — review needed",
                                "T1.5",
                            )
                            results["held"] += 1

                results["applied"] += 1
                print(f"  APPLY: {desc}")

        elif tier == "T2":
            for action in stage.get("actions", []):
                desc = action.get("description", "")
                # Announce via forge-notify if available
                sh(
                    f'/root/A-FORGE/duties/forge-notify.sh "🔔 ORCH: {desc}"',
                    timeout=10,
                )
                results["announced"] += 1
                print(f"  ANNOUNCE: {desc}")

        elif tier == "T3":
            results["held"] += len(stage.get("actions", []))
            write_receipt(
                "t3_held",
                "HOLD",
                f"{len(stage.get('actions', []))} T3 items surfaced to 888_HOLD",
                "T3",
            )
            print(f"  HOLD: {len(stage.get('actions', []))} T3 actions → 888_HOLD")

    print(
        f"  summary: {results['applied']} applied, {results['announced']} announced, {results['held']} held"
    )
    return results


# ── Step 7: AUDIT — verify results ────────────────────────────────────────


def audit_results(apply_results: dict) -> dict:
    """Verify that applied actions had the intended effect."""
    print("[ORCH-7] AUDIT phase...")
    audit: dict = {"organs_post": {}, "all_healthy": False}

    for name, port in ORGAN_PORTS.items():
        audit["organs_post"][name] = curl_health(port)

    audit["all_healthy"] = all(audit["organs_post"].values())
    alive = sum(1 for v in audit["organs_post"].values() if v)
    print(f"  organs={alive}/{len(ORGAN_PORTS)} healthy={audit['all_healthy']}")
    return audit


# ── Step 8: SEAL — VAULT999 + arifFlow ────────────────────────────────────


def seal_loop(
    findings: dict,
    plan: dict,
    apply_results: dict,
    audit: dict,
    execute_cost_ns: int,
    verify_cost_ns: int,
) -> dict:
    """Write seal receipt and ingest into arifFlow with honest phase costs.

    FQ = execute/verify. Do NOT double-count the same wall-clock as both
    Execute and Verify (that fakes FQ=1.0). DETECT/INVENTORY/SCORE/PROPOSE/
    APPLY → Execute; AUDIT re-probe → Verify.
    """
    print("[ORCH-8] SEAL phase...")
    import urllib.request
    import uuid

    COST_MIN_NS = 1_000_000
    exec_cost = max(COST_MIN_NS, int(execute_cost_ns))
    ver_cost = max(COST_MIN_NS, int(verify_cost_ns))
    cycle_cost_ns = exec_cost + ver_cost

    try:
        body = {
            "actor_id": LOOP_ID,
            "session_id": f"orch-{int(time.time())}",
            "step_type": "Execute",
            "step_number": 1,
            "cost_ns": exec_cost,
            "epistemic_label": "Observation",
            "floor_verdict": "Pass",
            "receipt_id": str(uuid.uuid4()),
            "created_at": ts(),
            "cooling_decision": "None",
        }
        req = urllib.request.Request(
            f"{ARIFLOW_URL}/ingest",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass

        body["step_type"] = "Verify"
        body["receipt_id"] = str(uuid.uuid4())
        body["cost_ns"] = ver_cost
        body["payload"] = {
            "organs_healthy": audit["all_healthy"],
            "cycle_fq": exec_cost / max(ver_cost, 1),
        }
        req2 = urllib.request.Request(
            f"{ARIFLOW_URL}/ingest",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req2, timeout=5) as resp:
            pass
    except Exception:
        pass

    seal_package = {
        "ts": ts(),
        "cycle_cost_ns": cycle_cost_ns,
        "execute_cost_ns": exec_cost,
        "verify_cost_ns": ver_cost,
        "cycle_fq": exec_cost / max(ver_cost, 1),
        "findings": {
            "flags": len(findings.get("flags", [])),
            "organs": findings.get("organs", {}).get("_alive"),
        },
        "plan_stages": len(plan.get("stages", [])),
        "apply": apply_results,
        "audit": audit,
    }

    write_receipt(
        "orchestrator_loop",
        "SEAL",
        f"8-step loop complete: {apply_results['applied']} applied, "
        f"{apply_results['announced']} announced, {apply_results['held']} held",
        "T1.5",
    )

    print(
        f"  sealed. flags={seal_package['findings']['flags']} organs={seal_package['findings']['organs']}"
    )
    return seal_package


# ── Full 8-Step Loop ──────────────────────────────────────────────────────


def run_orchestrator_loop() -> dict:
    """Execute the full 8-step agentic loop with honest execute/verify costs."""
    loop_start = time.time_ns()

    findings = detect_drift()  # 1. DETECT
    inventory = inventory_agents()  # 2. INVENTORY
    scored = score_actions(findings, inventory)  # 3. SCORE
    plan = propose_plan(scored, inventory)  # 4. PROPOSE
    apply_results = ratify_and_apply(plan)  # 5+6. RATIFY + APPLY
    execute_cost_ns = time.time_ns() - loop_start

    verify_start = time.time_ns()
    audit = audit_results(apply_results)  # 7. AUDIT (Verify)
    verify_cost_ns = time.time_ns() - verify_start

    seal = seal_loop(
        findings, plan, apply_results, audit, execute_cost_ns, verify_cost_ns
    )  # 8. SEAL

    return seal


if __name__ == "__main__":
    result = run_orchestrator_loop()
    print(f"\n[ORCH] 8-step loop complete: {json.dumps(result, indent=2, default=str)}")
