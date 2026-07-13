#!/usr/bin/env python3
"""
temporal_consequence.py — Minimal temporal consequence engine for A-FORGE.

Computes:
  - Time series builder from seal chain + forge_work + shell ledger
  - Trajectories A (act now) / B (don't act) / C (alternative timing)
  - Risk propagation (immediate → delayed → compounding → cascading)
  - ΔS_t (entropy trajectory)
  - F1-F13 floor flags
  - Consequence ledger append

Usage:
  python3 temporal_consequence.py --domain deploy [--horizon short|medium|long]
  python3 temporal_consequence.py --domain deploy --trajectory a
  python3 temporal_consequence.py --domain deploy --ledger

Constitutional:
  F1 AMANAH — all outputs are advisory, never verdicts
  F2 TRUTH — evidence-labeled outputs (OBS/DER/INT)
  F4 CLARITY — ΔS ≤ 0 per trajectory
  F8 GENIUS — simplest correct path
  F11 AUDIT — consequence ledger append-only

DITEMPA BUKAN DIBERI — Forged, Not Given
"""

import json
import sys
import os
import argparse
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
SEAL_CHAIN = "/root/.local/share/arifos/vault999/seal_chain.jsonl"
SHELL_LEDGER = "/root/A-FORGE/data/vault999_chain.jsonl"
FORGE_WORK = "/root/A-FORGE/forge_work"
CONSEQUENCE_LEDGER = "/root/A-FORGE/data/consequence_ledger.jsonl"

# ── Per-organ horizon policy ────────────────────────────────────────────
# Each organ has distinct temporal physics. Horizons must match organ cadence.
#   SEAL     — bursty, high-frequency, governance-critical
#   COOLING  — slow, rhythmic, recovery-based
#   A-FORGE  — operational, bursty, high-observability
#   WELL     — daily cadence, somatic shadows
#   WEALTH   — monthly/quarterly, long-horizon
#   arifOS   — near-real-time kernel transitions
HORIZON_POLICY = {
    "deploy": {  # A-FORGE deploy domain
        "short_ms": 4 * 3600 * 1000,  # 4h — operational cycle
        "medium_ms": 48 * 3600 * 1000,  # 48h — governance cycle
        "long_ms": 7 * 24 * 3600 * 1000,  # 7d — constitutional cycle
        "cadence_profile": "bursty",
        "min_data_points": 10,
        "f4_threshold": 0.50,
        "f13_threshold": 0.30,
    },
    "seal": {
        "short_ms": 1 * 3600 * 1000,  # 1h — seal burst window
        "medium_ms": 24 * 3600 * 1000,  # 24h — daily governance
        "long_ms": 7 * 24 * 3600 * 1000,  # 7d — weekly constitution
        "cadence_profile": "bursty",
        "min_data_points": 20,
        "f4_threshold": 0.45,
        "f13_threshold": 0.10,  # tight — irreversible governance actions
    },
    "cooling": {
        "short_ms": 1 * 3600 * 1000,  # 1h — cooling interval
        "medium_ms": 12 * 3600 * 1000,  # 12h — half-day rhythm
        "long_ms": 3 * 24 * 3600 * 1000,  # 3d — recovery window
        "cadence_profile": "slow",
        "min_data_points": 5,
        "f4_threshold": 0.25,  # tightest — rhythmic, low entropy
        "f13_threshold": 0.50,
    },
    "well": {
        "short_ms": 24 * 3600 * 1000,  # 1d — daily vitality
        "medium_ms": 7 * 24 * 3600 * 1000,  # 7d — weekly trend
        "long_ms": 30 * 24 * 3600 * 1000,  # 30d — monthly trajectory
        "cadence_profile": "steady",
        "min_data_points": 5,
        "f4_threshold": 0.80,  # most permissive — sparse somatic data
        "f13_threshold": 0.50,
    },
    "wealth": {
        "short_ms": 7 * 24 * 3600 * 1000,  # 7d — weekly liquidity
        "medium_ms": 30 * 24 * 3600 * 1000,  # 30d — monthly cashflow
        "long_ms": 90 * 24 * 3600 * 1000,  # 90d — quarterly runway
        "cadence_profile": "slow",
        "min_data_points": 3,
        "f4_threshold": 0.90,  # wide range tolerance (-1.0 to +1.0)
        "f13_threshold": 0.50,
    },
    "arifos": {
        "short_ms": 1 * 3600 * 1000,  # 1h — kernel pulse
        "medium_ms": 12 * 3600 * 1000,  # 12h — session rhythm
        "long_ms": 3 * 24 * 3600 * 1000,  # 3d — system stability
        "cadence_profile": "steady",
        "min_data_points": 5,
        "f4_threshold": 0.55,
        "f13_threshold": 0.50,
    },
}

# ── Per-organ keyword matchers ─────────────────────────────────────────
DEPLOY_KEYWORDS = [
    "deploy",
    "restart",
    "build",
    "redeploy",
    "forge.shell",
    "session.seal",
    "a-forge",
    "mcp",
]

SEAL_KEYWORDS = [
    "seal",
    "999_seal",
    "vault",
    "ledger",
    "chain",
]

COOLING_KEYWORDS = [
    "cooling",
    "gate_fire",
    "recovery",
    "rest",
]

WELL_KEYWORDS = [
    "well",
    "vitality",
    "fatigue",
    "sleep",
    "energy",
    "readiness",
    "biometric",
]

WEALTH_KEYWORDS = [
    "wealth",
    "cashflow",
    "runway",
    "npv",
    "burn",
    "capital",
    "fiscal",
]

ARIFOS_KEYWORDS = [
    "arifos",
    "kernel",
    "session.init",
    "judge",
    "floor",
    "constitutional",
]

DOMAIN_KEYWORDS = {
    "deploy": DEPLOY_KEYWORDS,
    "seal": SEAL_KEYWORDS,
    "cooling": COOLING_KEYWORDS,
    "well": WELL_KEYWORDS,
    "wealth": WEALTH_KEYWORDS,
    "arifos": ARIFOS_KEYWORDS,
}

# ── Floor flag thresholds (per-organ F4) ────────────────────────────────
FLOOR_FLAGS = {
    "F1_AMANAH": {
        "label": "Irreversible action pending",
        "trigger": lambda r: r.get("irreversibility_class", "").startswith("HIGH"),
    },
    "F4_CLARITY": {
        "label": "Entropy increase exceeds organ-specific threshold",
        "trigger": lambda r: r.get("entropy_delta", 0) > r.get("f4_threshold", 0.45),
    },
    "F7_HUMILITY": {
        "label": "Confidence exceeds 0.90",
        "trigger": lambda r: r.get("confidence", 0) > 0.90,
    },
    "F9_ANTI_HANTU": {
        "label": "Hallucination risk: extrapolation beyond data",
        "trigger": lambda r: r.get("data_points", 0) < 3,
    },
    "F13_SOVEREIGN": {
        "label": "Sovereign boundary: human decision required",
        "trigger": lambda r: r.get("delta_s", 0) > r.get("f13_threshold", 0.50),
    },
}

# ══════════════════════════════════════════════════════════════════════════
# 1. Time Series Builder
# ══════════════════════════════════════════════════════════════════════════


def load_seal_chain():
    """Load and parse VAULT999 seal chain."""
    entries = []
    try:
        with open(SEAL_CHAIN) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                    if isinstance(d, dict):
                        entries.append(d)
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        pass
    return entries


def load_shell_ledger():
    """Load A-FORGE shell execution ledger."""
    entries = []
    try:
        with open(SHELL_LEDGER) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                    if isinstance(d, dict):
                        entries.append(d)
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        pass
    return entries


def build_domain_timeseries(seal_entries, shell_entries, domain="deploy"):
    """
    Build a time series of events for a given domain.
    Returns list of (timestamp_epoch_ms, event_type, source).
    """
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    events = []

    # From seal chain
    for e in seal_entries:
        epoch = e.get("epoch", "")
        payload = e.get("payload", {})
        text = json.dumps(e).lower()
        payload_text = (
            json.dumps(payload).lower()
            if isinstance(payload, dict)
            else str(payload).lower()
        )
        actor = e.get("actor", "").lower()

        if any(kw in text for kw in keywords) or any(
            kw in payload_text for kw in keywords
        ):
            try:
                ts = datetime.fromisoformat(epoch.replace("Z", "+00:00"))
                events.append((ts.timestamp() * 1000, f"seal.{domain}", epoch[:19]))
            except (ValueError, TypeError):
                continue

    # From shell ledger
    for e in shell_entries:
        ts_str = e.get("ts", "")
        tool = e.get("tool", "")
        cmd = str(e.get("args", {}).get("command", "")).lower()
        if any(kw in cmd for kw in keywords) or tool == "forge_shell":
            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                events.append((ts.timestamp() * 1000, f"shell.{domain}", ts_str[:19]))
            except (ValueError, TypeError):
                continue

    # From forge_work directory — daily batch proxy for deploy/seal domains
    if domain in ("deploy", "seal", "arifos"):
        try:
            if os.path.isdir(FORGE_WORK):
                for day_dir in sorted(os.listdir(FORGE_WORK)):
                    day_path = os.path.join(FORGE_WORK, day_dir)
                    if not os.path.isdir(day_path) or not day_dir.startswith("2026-"):
                        continue
                    count = len(
                        [
                            f
                            for f in os.listdir(day_path)
                            if os.path.isfile(os.path.join(day_path, f))
                        ]
                    )
                    try:
                        ts = datetime.strptime(day_dir, "%Y-%m-%d")
                        events.append(
                            (
                                ts.timestamp() * 1000 + 43200,
                                f"forge_work.batch",
                                f"{day_dir} ({count} artifacts)",
                            )
                        )
                    except ValueError:
                        continue
        except Exception:
            pass

    events.sort(key=lambda x: x[0])
    return events


def compute_cadence_metrics(events):
    """Compute inter-event gaps and cadence statistics."""
    if len(events) < 2:
        return {
            "mean_gap_ms": 0,
            "median_gap_ms": 0,
            "min_gap_ms": 0,
            "max_gap_ms": 0,
            "event_count": len(events),
            "burst_threshold_ms": 3600000,
        }

    timestamps = [e[0] for e in events]
    gaps = [timestamps[i + 1] - timestamps[i] for i in range(len(timestamps) - 1)]

    sorted_gaps = sorted(gaps)
    n = len(sorted_gaps)

    return {
        "mean_gap_ms": sum(gaps) / n if n > 0 else 0,
        "median_gap_ms": sorted_gaps[n // 2] if n > 0 else 0,
        "min_gap_ms": min(gaps) if gaps else 0,
        "max_gap_ms": max(gaps) if gaps else 0,
        "event_count": len(events),
        "burst_count": sum(1 for g in gaps if g < 3600000),  # <1h
        "burst_threshold_ms": 3600000,
    }


# ══════════════════════════════════════════════════════════════════════════
# 2. Forecaster — Moving Average + Linear Extrapolation
# ══════════════════════════════════════════════════════════════════════════


def moving_average(values, window=3):
    """Simple moving average with padding."""
    if len(values) < window:
        return values
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        window_vals = values[start : i + 1]
        result.append(sum(window_vals) / len(window_vals))
    return result


def linear_extrapolation(x, y, forecast_steps=3):
    """
    Simple linear extrapolation using last N points.
    Returns forecasted values.
    """
    if len(x) < 2 or len(y) < 2:
        return [y[-1] if y else 0] * forecast_steps

    n = min(len(x), 5)  # use last 5 points max
    x_recent = x[-n:]
    y_recent = y[-n:]

    # Simple linear regression
    n_pts = len(x_recent)
    sum_x = sum(x_recent)
    sum_y = sum(y_recent)
    sum_xy = sum(x * y for x, y in zip(x_recent, y_recent))
    sum_x2 = sum(x * x for x in x_recent)

    denom = n_pts * sum_x2 - sum_x * sum_x
    if abs(denom) < 1e-10:
        return [y_recent[-1]] * forecast_steps

    slope = (n_pts * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n_pts

    last_x = x_recent[-1]
    forecasts = []
    for step in range(1, forecast_steps + 1):
        forecast_x = (
            last_x + step * (x_recent[-1] - x_recent[-2])
            if n_pts >= 2
            else last_x + step
        )
        forecasts.append(slope * forecast_x + intercept)

    return forecasts


# ══════════════════════════════════════════════════════════════════════════
# 3. Trajectory Generator — A/B/C
# ══════════════════════════════════════════════════════════════════════════


def generate_trajectories(events, horizon_ms, domain="deploy"):
    """
    Generate three trajectories:
      A — Act now (forecast continues at current cadence)
      B — Don't act (cadence slows, backlog grows)
      C — Alternative timing (defer by one horizon unit)
    """
    if len(events) < 2:
        return {"error": "Insufficient data for trajectory generation"}

    # Extract daily counts as the time series
    daily_counts = defaultdict(int)
    first_ts = events[0][0]
    for ts, etype, desc in events:
        day_key = int((ts - first_ts) / (24 * 3600 * 1000))
        daily_counts[day_key] += 1

    day_keys = sorted(daily_counts.keys())
    counts = [daily_counts[k] for k in day_keys]

    # Forecast horizon in days
    horizon_days = max(1, int(horizon_ms / (24 * 3600 * 1000)))

    # Trajectory A — Act now (continue current cadence)
    forecast_a = counts + linear_extrapolation(day_keys, counts, horizon_days)

    # Trajectory B — Don't act (cadence decays by 30% per period)
    decay_factor = 0.7
    forecast_b = list(counts)
    last_val = counts[-1] if counts else 0
    for _ in range(horizon_days):
        next_val = last_val * decay_factor
        forecast_b.append(next_val)
        last_val = next_val

    # Trajectory C — Alternative timing (defer, then catch up)
    defer_periods = max(1, int(horizon_days * 0.3))
    forecast_c = list(counts)
    catchup_multiplier = 1.0
    for i in range(horizon_days):
        if i < defer_periods:
            forecast_c.append(counts[-1] * 0.5 if counts else 0)  # defer
        else:
            forecast_c.append(
                (forecast_a[-horizon_days + i] if i < horizon_days else forecast_a[-1])
                * 1.3
            )  # catch up

    return {
        "trajectory_a": {
            "label": "Act now",
            "forecast": forecast_a,
            "total_events": sum(forecast_a),
        },
        "trajectory_b": {
            "label": "Don't act",
            "forecast": forecast_b,
            "total_events": sum(forecast_b),
        },
        "trajectory_c": {
            "label": "Alternative timing (defer)",
            "forecast": forecast_c,
            "total_events": sum(forecast_c),
        },
        "horizon_days": horizon_days,
        "window_days": len(day_keys),
    }


# ══════════════════════════════════════════════════════════════════════════
# 4. Risk Propagation
# ══════════════════════════════════════════════════════════════════════════


def compute_risk_propagation(trajectories):
    """
    Risk propagation through four stages:
      immediate → delayed → compounding → cascading
    """

    def _risk_for_trajectory(traj):
        forecast = traj.get("forecast", [])
        if not forecast:
            return {"immediate": 0, "delayed": 0, "compounding": 0, "cascading": 0}

        # Immediate: variance in first 2 periods
        immediate = abs(forecast[-1] - forecast[0]) / max(forecast[0], 1)

        # Delayed: trend direction
        delayed = 1.0 if forecast[-1] < forecast[0] else 0.3

        # Compounding: accelerating deviation
        if len(forecast) >= 4:
            diffs = [forecast[i + 1] - forecast[i] for i in range(len(forecast) - 1)]
            compounding = abs(sum(diffs[-3:])) / max(
                sum(abs(d) for d in diffs[-3:]), 0.01
            )
        else:
            compounding = 0

        # Cascading: high compounding + low baseline = systemic risk
        cascading = compounding * (1 - immediate) if compounding > 0.5 else 0

        return {
            "immediate": round(min(immediate, 1.0), 3),
            "delayed": round(min(delayed, 1.0), 3),
            "compounding": round(min(compounding, 1.0), 3),
            "cascading": round(min(cascading, 1.0), 3),
        }

    return {
        "trajectory_a_risk": _risk_for_trajectory(trajectories.get("trajectory_a", {})),
        "trajectory_b_risk": _risk_for_trajectory(trajectories.get("trajectory_b", {})),
        "trajectory_c_risk": _risk_for_trajectory(trajectories.get("trajectory_c", {})),
    }


# ══════════════════════════════════════════════════════════════════════════
# 5. Entropy Trajectory (ΔS_t)
# ══════════════════════════════════════════════════════════════════════════


def compute_entropy_trajectory(trajectories, cadence):
    """
    Compute ΔS for each trajectory relative to current cadence baseline.
    ΔS < 0 = clarity increasing (good). ΔS > 0 = entropy increasing (bad).
    """
    baseline = cadence.get("mean_gap_ms", 3600000)
    total_events = cadence.get("event_count", 1)

    def _delta_s(traj):
        forecast = traj.get("forecast", [])
        if not forecast:
            return 0
        # Entropy proxy: coefficient of variation of forecast
        mean_f = sum(forecast) / len(forecast) if forecast else 1
        if mean_f == 0:
            return 0
        variance = sum((v - mean_f) ** 2 for v in forecast) / len(forecast)
        cv = (variance**0.5) / mean_f

        # ΔS = change in predictability relative to baseline
        baseline_cv = 0.5  # assumed baseline predictability
        delta = cv - baseline_cv

        # Normalize to [-1, 1]
        return round(max(-1.0, min(1.0, delta)), 3)

    return {
        "trajectory_a_delta_s": _delta_s(trajectories.get("trajectory_a", {})),
        "trajectory_b_delta_s": _delta_s(trajectories.get("trajectory_b", {})),
        "trajectory_c_delta_s": _delta_s(trajectories.get("trajectory_c", {})),
        "baseline": {
            "mean_gap_ms": baseline,
            "total_events": total_events,
        },
        "interpretation": {
            "negative": "Clarity increases (ΔS < 0) — action reduces entropy",
            "positive": "Entropy increases (ΔS > 0) — action adds uncertainty",
            "zero": "Neutral — no measurable change in clarity",
        },
    }


# ══════════════════════════════════════════════════════════════════════════
# 6. Floor Flags
# ══════════════════════════════════════════════════════════════════════════


def check_floor_flags(trajectories, cadence, risk, entropy, domain="deploy"):
    """Check which constitutional floors are triggered.
    Uses organ-specific F4 threshold from HORIZON_POLICY."""
    report = {}
    f4_threshold = HORIZON_POLICY.get(domain, {}).get("f4_threshold", 0.45)

    for floor_key, config in FLOOR_FLAGS.items():
        # Build a result dict for trigger evaluation
        result = {
            "irreversibility_class": "LOW",
            "entropy_delta": max(
                abs(v)
                for v in [
                    entropy.get("trajectory_a_delta_s", 0),
                    entropy.get("trajectory_b_delta_s", 0),
                    entropy.get("trajectory_c_delta_s", 0),
                ]
            ),
            "confidence": 0.85,
            "data_points": cadence.get("event_count", 0),
            "delta_s": max(
                abs(v)
                for v in [
                    entropy.get("trajectory_a_delta_s", 0),
                    entropy.get("trajectory_b_delta_s", 0),
                    entropy.get("trajectory_c_delta_s", 0),
                ]
            ),
            "f4_threshold": f4_threshold,
        }

        triggered = config["trigger"](result)
        report[floor_key] = {
            "label": config["label"],
            "triggered": triggered,
            "value": result.get(
                list(FLOOR_FLAGS[floor_key]["trigger"].__code__.co_varnames)[0], "N/A"
            ),
        }

    return report


# ══════════════════════════════════════════════════════════════════════════
# 7. Consequence Ledger
# ══════════════════════════════════════════════════════════════════════════


def write_consequence_ledger(
    domain, horizon, trajectories, risk, entropy, floors, cadence
):
    """Append a consequence record to the ledger (append-only JSONL)."""
    import hashlib
    import uuid

    now = datetime.now(timezone.utc)

    record = {
        "_meta": {
            "tool": "temporal_consequence",
            "version": "0.1.0",
            "domain": domain,
            "horizon": horizon,
            "generated_at": now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "consequence_id": f"conseq-{uuid.uuid4().hex[:12]}",
        },
        "cadence": {
            "event_count": cadence.get("event_count", 0),
            "mean_gap_ms": cadence.get("mean_gap_ms", 0),
            "burst_count": cadence.get("burst_count", 0),
        },
        "trajectories": trajectories,
        "risk_propagation": risk,
        "entropy": {
            "delta_s_a": entropy.get("trajectory_a_delta_s", 0),
            "delta_s_b": entropy.get("trajectory_b_delta_s", 0),
            "delta_s_c": entropy.get("trajectory_c_delta_s", 0),
        },
        "floor_flags": {k: v for k, v in floors.items() if v.get("triggered")},
        "recommendation": _generate_recommendation(trajectories, risk, entropy, floors),
    }

    # Hash for integrity
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"))
    record["_hash"] = hashlib.sha256(canonical.encode()).hexdigest()

    # Append
    os.makedirs(os.path.dirname(CONSEQUENCE_LEDGER), exist_ok=True)
    with open(CONSEQUENCE_LEDGER, "a") as f:
        f.write(json.dumps(record, separators=(",", ":")) + "\n")

    return record


def _generate_recommendation(trajectories, risk, entropy, floors):
    """Generate a simple recommendation based on all signals."""
    delta_s_values = [
        entropy.get("trajectory_a_delta_s", 0),
        entropy.get("trajectory_b_delta_s", 0),
        entropy.get("trajectory_c_delta_s", 0),
    ]

    triggered_floors = [k for k, v in floors.items() if v.get("triggered")]

    # Find trajectory with lowest entropy increase (best ΔS)
    best_traj_idx = delta_s_values.index(min(delta_s_values))
    traj_labels = ["A (act now)", "B (don't act)", "C (defer)"]

    if triggered_floors:
        base = f"FLOORS TRIGGERED: {', '.join(triggered_floors)}. "
    else:
        base = "No floors triggered. "

    if min(delta_s_values) < 0:
        return (
            base
            + f"Trajectory {traj_labels[best_traj_idx]} reduces entropy (ΔS={delta_s_values[best_traj_idx]}). Favorable."
        )
    elif min(delta_s_values) == 0:
        return (
            base + "All trajectories entropy-neutral. Choose based on operational need."
        )
    else:
        return (
            base
            + "All trajectories increase entropy. Recommend delay until conditions change."
        )


# ══════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════


def cmd_read_ledger():
    """Read recent consequence ledger entries."""
    try:
        with open(CONSEQUENCE_LEDGER) as f:
            entries = [json.loads(l) for l in f if l.strip()]
        return entries[-5:] if entries else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def main():
    parser = argparse.ArgumentParser(description="Temporal consequence engine")
    parser.add_argument(
        "--domain",
        default="deploy",
        choices=["deploy", "seal", "cooling", "well", "wealth", "arifos"],
    )
    parser.add_argument(
        "--horizon", default="medium", choices=["short", "medium", "long"]
    )
    parser.add_argument(
        "--ledger", action="store_true", help="Read recent ledger entries"
    )
    args = parser.parse_args()

    if args.ledger:
        entries = cmd_read_ledger()
        print(json.dumps({"status": "SEAL", "ledger_entries": entries}, indent=2))
        return

    # 1. Time series
    seal_entries = load_seal_chain()
    shell_entries = load_shell_ledger()

    # Build domain-specific time series
    events = build_domain_timeseries(seal_entries, shell_entries, args.domain)

    if not events:
        print(
            json.dumps(
                {"status": "VOID", "reason": "No temporal data available"}, indent=2
            )
        )
        return

    # 2. Cadence
    cadence = compute_cadence_metrics(events)

    # 3. Horizon
    horizon_ms = HORIZON_POLICY.get(args.domain, {}).get(args.horizon + "_ms", 86400000)

    # 4. Trajectories
    trajectories = generate_trajectories(events, horizon_ms, args.domain)

    # 5. Risk
    risk = compute_risk_propagation(trajectories)

    # 6. Entropy
    entropy = compute_entropy_trajectory(trajectories, cadence)

    # 7. Floor flags
    floors = check_floor_flags(trajectories, cadence, risk, entropy, args.domain)

    # 8. Write ledger
    ledger_record = write_consequence_ledger(
        args.domain, args.horizon, trajectories, risk, entropy, floors, cadence
    )

    # 9. Output
    output = {
        "status": "SEAL",
        "domain": args.domain,
        "horizon": args.horizon,
        "horizon_ms": horizon_ms,
        "cadence": cadence,
        "trajectories": {
            "a": {
                "label": trajectories["trajectory_a"]["label"],
                "total_events": trajectories["trajectory_a"]["total_events"],
                "forecast_preview": trajectories["trajectory_a"]["forecast"][-5:],
            },
            "b": {
                "label": trajectories["trajectory_b"]["label"],
                "total_events": trajectories["trajectory_b"]["total_events"],
                "forecast_preview": trajectories["trajectory_b"]["forecast"][-5:],
            },
            "c": {
                "label": trajectories["trajectory_c"]["label"],
                "total_events": trajectories["trajectory_c"]["total_events"],
                "forecast_preview": trajectories["trajectory_c"]["forecast"][-5:],
            },
        },
        "risk": risk,
        "entropy": entropy,
        "floor_flags": {k: v for k, v in floors.items() if v["triggered"]},
        "recommendation": ledger_record["recommendation"],
        "ledger_id": ledger_record["_meta"]["consequence_id"],
        "_epistemic": {
            "output_class": "DERIVED",
            "confidence": round(min(0.85, 0.5 + 0.05 * cadence["event_count"]), 2),
            "evidence_source": f"seal_chain ({len(seal_entries)} entries) + shell_ledger ({len(shell_entries)} entries)",
            "authority_claim": "ADVISORY",
            "reversible": True,
        },
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
