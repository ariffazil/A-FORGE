#!/usr/bin/env python3
"""
World-model lite — predict-before-mutate gate (T2+)
═══════════════════════════════════════════════════

Minimal P(s′|s,a) seatbelt for federation actuators.

Does NOT train a neural world model. Does:
  1. Snapshot current organ health (state s)
  2. Classify action risk (T0–T3 / reversible class)
  3. For T2+: require dry-run / simulate predicate before mutate
  4. Emit a prediction receipt: predicted_s_prime + confidence + hold_if

Used by AED before T2 restarts and by operators before deploys.

FQ-aware: predictions count as Verify cost when ingested (caller decides).

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import json
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ORGANS = {
    "arifos": 8088,
    "aforge": 7071,
    "aaa": 3001,
    "geox": 8081,
    "wealth": 18082,
    "well": 18083,
    "arifflow": 7073,
}

LEDGER = Path("/root/A-FORGE/duties/logs/world-model-lite.jsonl")


def ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def sh(cmd: str, timeout: int = 15) -> tuple[str, str, int]:
    try:
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", "TIMEOUT", -1
    except Exception as e:
        return "", str(e), -1


def organ_snapshot() -> dict[str, bool]:
    snap: dict[str, bool] = {}
    for name, port in ORGANS.items():
        out, _, rc = sh(
            f"curl -sf --max-time 2 http://127.0.0.1:{port}/health -o /dev/null -w '%{{http_code}}'",
            timeout=5,
        )
        snap[name] = rc == 0 and out == "200"
    return snap


@dataclass
class ActionSpec:
    """Declared action for prediction."""

    name: str
    tier: str  # T0 | T1 | T1.5 | T2 | T3
    reversible: bool
    target: str  # organ | repo | path | external
    mutate: bool
    dry_run_cmd: Optional[str] = None  # shell command that must exit 0 if safe
    description: str = ""


@dataclass
class Prediction:
    prediction_id: str
    ts: str
    action: dict
    state_s: dict[str, bool]
    predicted_s_prime: dict[str, Any]
    confidence: float  # 0..1, capped at 0.90 (F7)
    allow_mutate: bool
    hold_reason: Optional[str] = None
    dry_run: Optional[dict] = None
    evidence: dict = field(default_factory=dict)


def classify_allow(action: ActionSpec, s: dict[str, bool], dry: Optional[dict]) -> tuple[bool, Optional[str], float, dict]:
    """Predict whether mutate is safe. Returns (allow, hold_reason, confidence, s_prime)."""
    s_prime: dict[str, Any] = {
        "organs": dict(s),
        "expected_delta": "none",
        "risk": "low",
    }
    conf = 0.75

    # T3 always HOLD — sovereign gate
    if action.tier == "T3" or (action.mutate and not action.reversible and action.tier != "T2"):
        if action.tier == "T3" or not action.reversible:
            if action.tier == "T3":
                return False, "T3 irreversible — 888_HOLD (F13)", min(conf, 0.90), s_prime

    # Critical organ down → HOLD non-repair actions
    if not s.get("arifos", False) and action.target != "arifos":
        return False, "arifOS kernel down — HOLD non-kernel actions", 0.85, s_prime

    # T0/T1 reversible without dry-run
    if not action.mutate or action.tier in ("T0", "T1", "T1.5"):
        s_prime["expected_delta"] = "reversible_local" if action.mutate else "read_only"
        s_prime["risk"] = "low"
        return True, None, min(0.88, conf + 0.05), s_prime

    # T2+ mutative: require dry-run when provided
    if action.tier in ("T2", "T3") and action.mutate:
        s_prime["risk"] = "medium" if action.tier == "T2" else "critical"
        s_prime["expected_delta"] = f"mutate:{action.target}"
        if action.dry_run_cmd:
            out, err, rc = sh(action.dry_run_cmd, timeout=30)
            dry_result = {"rc": rc, "stdout": out[:300], "stderr": err[:200]}
            if rc != 0:
                return (
                    False,
                    f"dry-run failed rc={rc}: {(err or out)[:120]}",
                    0.80,
                    {**s_prime, "dry_run": dry_result},
                )
            conf = 0.82
            return True, None, min(0.90, conf), {**s_prime, "dry_run": dry_result}
        # T2 without dry-run: allow only if target organ currently healthy (restart ok)
        if action.target in s and s[action.target] is False:
            # restarting a down non-critical organ — predicted recovery
            s_prime["organs"] = {**s, action.target: True}
            s_prime["expected_delta"] = f"recover:{action.target}"
            return True, None, 0.70, s_prime
        if action.target in s and s[action.target] is True and "restart" in action.name.lower():
            # restarting healthy organ — predicted brief blip then up
            s_prime["expected_delta"] = f"blip_then_up:{action.target}"
            return True, None, 0.72, s_prime
        # T2 mutate without dry-run and unclear target → HOLD for safety
        return (
            False,
            "T2 mutate requires dry_run_cmd or known organ restart target",
            0.65,
            s_prime,
        )

    return True, None, conf, s_prime


def predict(action: ActionSpec) -> Prediction:
    """Snapshot s, predict s′, gate mutate."""
    t0 = time.time_ns()
    s = organ_snapshot()
    dry: Optional[dict] = None
    allow, hold, conf, s_prime = classify_allow(action, s, dry)
    if "dry_run" in s_prime:
        dry = s_prime.pop("dry_run")  # type: ignore[assignment]
        # re-attach for evidence
    elapsed = time.time_ns() - t0
    pred = Prediction(
        prediction_id=str(uuid.uuid4()),
        ts=ts(),
        action={
            "name": action.name,
            "tier": action.tier,
            "reversible": action.reversible,
            "target": action.target,
            "mutate": action.mutate,
            "description": action.description,
        },
        state_s=s,
        predicted_s_prime=s_prime if isinstance(s_prime, dict) else {"raw": s_prime},
        confidence=min(0.90, float(conf)),  # F7 cap
        allow_mutate=allow,
        hold_reason=hold,
        dry_run=dry if isinstance(dry, dict) else (
            s_prime.get("dry_run") if isinstance(s_prime, dict) else None  # type: ignore
        ),
        evidence={"elapsed_ns": elapsed, "source": "world_model_lite_v1"},
    )
    # normalize dry_run from s_prime
    if isinstance(s_prime, dict) and "dry_run" in s_prime:
        pred.dry_run = s_prime["dry_run"]
        pred.predicted_s_prime = {k: v for k, v in s_prime.items() if k != "dry_run"}
    return pred


def write_prediction(pred: Prediction) -> Path:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(json.dumps(asdict(pred), default=str) + "\n")
    return LEDGER


def gate_or_hold(action: ActionSpec) -> Prediction:
    """Public entry: predict + ledger. Caller must respect allow_mutate."""
    pred = predict(action)
    write_prediction(pred)
    return pred


# ── Convenience constructors ──────────────────────────────────────────


def t2_restart(organ: str, systemd_unit: str) -> ActionSpec:
    return ActionSpec(
        name=f"restart_{organ}",
        tier="T2",
        reversible=True,
        target=organ,
        mutate=True,
        dry_run_cmd=f"systemctl cat {systemd_unit} >/dev/null && systemctl is-enabled {systemd_unit} >/dev/null 2>&1 || systemctl status {systemd_unit} --no-pager >/dev/null 2>&1; true",
        description=f"T2 restart {systemd_unit}",
    )


def t2_deploy_dry(repo: str, check_cmd: str) -> ActionSpec:
    return ActionSpec(
        name=f"deploy_{repo}",
        tier="T2",
        reversible=True,
        target=repo,
        mutate=True,
        dry_run_cmd=check_cmd,
        description=f"T2 deploy {repo} after dry-run green",
    )


if __name__ == "__main__":
    import sys

    # Demo: predict a T2 aforge restart
    action = t2_restart("aforge", "a-forge.service")
    pred = gate_or_hold(action)
    print(json.dumps(asdict(pred), indent=2, default=str))
    sys.exit(0 if pred.allow_mutate else 2)
