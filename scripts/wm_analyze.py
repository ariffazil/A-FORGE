#!/usr/bin/env python3
"""
🌐 WM-ANALYZE — World Model Trajectory Analysis & Quality Report
Phase 1.5c — Trajectory Quality Report

Reads trajectories.jsonl and predictions.jsonl, produces:
  - Tool-level prediction accuracy
  - Gap score trending
  - Phase 2 readiness assessment
  - Recommendations for training data curation

Usage:
  python3 wm_analyze.py           # Full report
  python3 wm_analyze.py --json    # JSON output
  python3 wm_analyze.py --watch   # Watch mode (poll every 60s)

Forged: 2026-07-21 by FORGE (000Ω)
DITEMPA BUKAN DIBERI
"""

import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

TRAJECTORY_LOG = "/root/.local/share/arifos/world-model/trajectories.jsonl"
PREDICTION_LOG = "/root/.local/share/arifos/world-model/predictions.jsonl"
ALERT_LOG = "/root/.local/share/arifos/world-model/gap_alerts.jsonl"
CHAIN_HEAD = "/root/.local/share/arifos/world-model/chain_head.json"

MIN_P0_TRAJECTORIES = 100
MIN_PREDICTION_ACCURACY = 0.6


def parse_jsonl(path):
    records = []
    if not os.path.exists(path):
        return records
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return records


def analyze():
    traj = parse_jsonl(TRAJECTORY_LOG)
    preds = parse_jsonl(PREDICTION_LOG)

    # ── Tool-level stats ──
    tool_stats = defaultdict(
        lambda: {
            "total": 0,
            "eligible": 0,
            "gaps": [],
            "surprises": [],
            "entropies": [],
            "confidences": [],
            "priority": "P2",
        }
    )

    for t in traj:
        tool = t.get("tool", "unknown")
        stats = tool_stats[tool]
        stats["total"] += 1
        stats["priority"] = t.get("wm_priority", "P2")
        if t.get("wm_eligible"):
            stats["eligible"] += 1
        if t.get("prediction_gap") is not None:
            stats["gaps"].append(t["prediction_gap"])
        if t.get("surprise_score") is not None:
            stats["surprises"].append(t["surprise_score"])
        if t.get("observation_entropy") is not None:
            stats["entropies"].append(t["observation_entropy"])
        if t.get("agent_confidence") is not None:
            stats["confidences"].append(t["agent_confidence"])

    # ── Priority summary ──
    by_priority = {"P0": 0, "P1": 0, "P2": 0}
    eligible_count = 0
    for t in traj:
        p = t.get("wm_priority", "P2")
        if p in by_priority:
            by_priority[p] += 1
        if t.get("wm_eligible"):
            eligible_count += 1

    # ── Gap distribution ──
    gap_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    all_gaps = []
    for p in preds:
        gap = p.get("gap_score") or p.get("prediction_gap") or 0
        all_gaps.append(gap)
        if gap < 0.3:
            gap_dist["low"] += 1
        elif gap < 0.7:
            gap_dist["medium"] += 1
        elif gap < 1.0:
            gap_dist["high"] += 1
        else:
            gap_dist["critical"] += 1

    avg_gap = sum(all_gaps) / len(all_gaps) if all_gaps else 0
    accuracy = 1 - avg_gap

    # ── Trends ──
    mid = len(preds) // 2
    first_half = preds[:mid]
    second_half = preds[mid:]
    avg_gap_first = (
        sum(p.get("gap_score", 0) for p in first_half) / len(first_half)
        if first_half
        else 0
    )
    avg_gap_second = (
        sum(p.get("gap_score", 0) for p in second_half) / len(second_half)
        if second_half
        else 0
    )

    if len(preds) < 4:
        gap_trend = "STABLE"
    elif avg_gap_second < avg_gap_first * 0.9:
        gap_trend = "IMPROVING"
    elif avg_gap_second > avg_gap_first * 1.1:
        gap_trend = "DEGRADING"
    else:
        gap_trend = "STABLE"

    # ── Phase 2 Readiness ──
    p0_count = by_priority["P0"]
    if p0_count >= MIN_P0_TRAJECTORIES and accuracy >= MIN_PREDICTION_ACCURACY:
        readiness = "READY"
    elif p0_count >= MIN_P0_TRAJECTORIES // 2:
        readiness = "ADEQUATE"
    elif p0_count >= 10:
        readiness = "MINIMAL"
    else:
        readiness = "NOT_READY"

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_trajectories": len(traj),
            "total_predictions": len(preds),
            "by_priority": by_priority,
            "eligible_ratio": eligible_count / len(traj) if traj else 0,
        },
        "tools": {
            tool: {
                "priority": s["priority"],
                "total_calls": s["total"],
                "eligible_calls": s["eligible"],
                "avg_gap_score": sum(s["gaps"]) / len(s["gaps"]) if s["gaps"] else 0,
                "avg_surprise": sum(s["surprises"]) / len(s["surprises"])
                if s["surprises"]
                else 0,
                "avg_entropy": sum(s["entropies"]) / len(s["entropies"])
                if s["entropies"]
                else 0,
                "avg_confidence": sum(s["confidences"]) / len(s["confidences"])
                if s["confidences"]
                else 0,
            }
            for tool, s in tool_stats.items()
        },
        "gap_distribution": gap_dist,
        "trends": {
            "prediction_accuracy": round(accuracy, 2),
            "gap_trend": gap_trend,
            "avg_gap_first_half": round(avg_gap_first, 3),
            "avg_gap_second_half": round(avg_gap_second, 3),
        },
        "phase2_readiness": {
            "status": readiness,
            "p0_trajectories": p0_count,
            "min_p0_required": MIN_P0_TRAJECTORIES,
            "prediction_accuracy": round(accuracy, 2),
            "min_accuracy_required": MIN_PREDICTION_ACCURACY,
            "recommendations": _get_recommendations(p0_count, accuracy, readiness),
        },
    }


def _get_recommendations(p0_count, accuracy, readiness):
    recs = []
    if p0_count < MIN_P0_TRAJECTORIES:
        recs.append(
            f"Need {MIN_P0_TRAJECTORIES - p0_count} more P0 trajectories before RL. Run forge_shell/forge_git/forge_docker."
        )
    if accuracy < MIN_PREDICTION_ACCURACY:
        recs.append(
            f"Accuracy {accuracy * 100:.0f}% below {MIN_PREDICTION_ACCURACY * 100:.0f}% minimum. Improve predictions first."
        )
    if readiness == "READY":
        recs.append(
            "Phase 2 RL training can proceed. Submit 888_HOLD for GRPO infra deployment."
        )
    if readiness == "NOT_READY":
        recs.append(
            "Accumulate more tool interaction data before considering RL training."
        )
    return recs


def print_report(report):
    s = report["summary"]
    p2 = report["phase2_readiness"]
    t = report["trends"]

    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║     🌐 WORLD MODEL — Trajectory Quality Report        ║")
    print("╠══════════════════════════════════════════════════════╣")
    print(f"║ Generated: {report['generated_at']}  ║")
    print("╠══════════════════════════════════════════════════════╣")
    print(
        f"║ Trajectories: {s['total_trajectories']:<5} | Predictions: {s['total_predictions']:<5}                ║"
    )
    print(
        f"║ P0: {s['by_priority']['P0']:<5} | P1: {s['by_priority']['P1']:<5} | P2: {s['by_priority']['P2']:<5}                       ║"
    )
    print(
        f"║ Eligible: {s['eligible_ratio'] * 100:.0f}%                                         ║"
    )
    print("╠══════════════════════════════════════════════════════╣")

    for tool, st in report["tools"].items():
        print(
            f"║ {tool:<14} | {st['priority']} | calls:{st['total_calls']:<3} | gap:{st['avg_gap_score']:.2f} | surp:{st['avg_surprise']:.2f} ║"
        )

    g = report["gap_distribution"]
    print("╠══════════════════════════════════════════════════════╣")
    print(f"║ Gap Distribution                                     ║")
    print(f"║   LOW (<0.3):     {g['low']:<5}                             ║")
    print(f"║   MED (0.3-0.7):  {g['medium']:<5}                             ║")
    print(f"║   HIGH (0.7-1.0): {g['high']:<5}                             ║")
    print(f"║   CRITICAL (=1):  {g['critical']:<5}                             ║")

    print("╠══════════════════════════════════════════════════════╣")
    print(
        f"║ Accuracy: {t['prediction_accuracy'] * 100:.0f}% | Gap: {t['gap_trend']:<10} | Δgap: {t['avg_gap_first_half']:.3f}→{t['avg_gap_second_half']:.3f} ║"
    )

    print("╠══════════════════════════════════════════════════════╣")
    status_icon = {
        "READY": "🟢",
        "ADEQUATE": "🟡",
        "MINIMAL": "🟠",
        "NOT_READY": "🔴",
    }.get(p2["status"], "⚪")
    print(
        f"║ {status_icon} Phase 2 Readiness: {p2['status']:<14}                        ║"
    )
    print(
        f"║   P0 trajectories: {p2['p0_trajectories']:<4} / {p2['min_p0_required']} minimum                ║"
    )
    print(
        f"║   Accuracy:        {p2['prediction_accuracy'] * 100:.0f}% / {p2['min_accuracy_required'] * 100:.0f}% minimum               ║"
    )
    for rec in p2["recommendations"]:
        print(f"║   → {rec[:48]:<48} ║")
    print("╚══════════════════════════════════════════════════════╝\n")


# ── Gap Alert Pipeline ────────────────────────────────────


def scan_gap_alerts():
    """Scan predictions for CRITICAL gaps and emit alerts."""
    preds = parse_jsonl(PREDICTION_LOG)
    alerts = []

    for p in preds:
        gap = p.get("gap_score") or p.get("prediction_gap") or 0
        confidence = p.get("agent_confidence") or 0
        action_hash = p.get("action_hash", "unknown")

        if gap >= 1.0 and confidence >= 0.7:
            # HIGH CONFIDENCE + COMPLETELY WRONG = CRITICAL ALERT
            alerts.append(
                {
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "level": "CRITICAL",
                    "action_hash": action_hash[:16],
                    "gap_score": gap,
                    "confidence": confidence,
                    "reason": "HIGH_CONFIDENCE_WRONG_PREDICTION",
                    "f7_trigger": True,  # F7 HUMILITY violation
                }
            )

    if alerts:
        # Write to alert log
        with open(ALERT_LOG, "a") as f:
            for alert in alerts:
                f.write(json.dumps(alert) + "\n")

    return alerts


if __name__ == "__main__":
    if "--json" in sys.argv:
        report = analyze()
        print(json.dumps(report, indent=2, default=str))
    elif "--watch" in sys.argv:
        print("🌐 WM-Analyze watch mode — Ctrl+C to stop")
        try:
            while True:
                report = analyze()
                alerts = scan_gap_alerts()
                print_report(report)
                if alerts:
                    print(f"🚨 {len(alerts)} CRITICAL gap alert(s) emitted!")
                time.sleep(60)
        except KeyboardInterrupt:
            print("\nWatch stopped.")
    else:
        report = analyze()
        alerts = scan_gap_alerts()
        print_report(report)
        if alerts:
            print(f"🚨 {len(alerts)} CRITICAL gap alert(s)! Check {ALERT_LOG}")
