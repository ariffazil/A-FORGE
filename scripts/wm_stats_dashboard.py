#!/usr/bin/env python3
"""
WM Stats Dashboard — Phase 1.5a
Reads trajectories.jsonl (dual-format tolerant) and produces:
  1. Per-tool prediction accuracy & surprise distribution
  2. Gap score trending (is the agent getting better?)
  3. WM eligibility rates by priority tier
  4. High-confidence failures (gap alerts)

Usage: python3 wm_stats_dashboard.py [--json] [--alerts-only]
Output: human-readable table or JSON for NATS/dashboard consumption
"""
import json, sys, os
from collections import defaultdict
from datetime import datetime

TRAJECTORY_LOG = "/root/.local/share/arifos/world-model/trajectories.jsonl"

def load_trajectories(path: str) -> list[dict]:
    records = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records

def normalize_record(r: dict) -> dict:
    """Normalize both legacy (OpenCode) and canonical (Hermes) formats."""
    # Canonical format (Hermes)
    if "wm" in r:
        wm = r["wm"]
        return {
            "tool": r.get("tool_name", "unknown"),
            "timestamp": r.get("timestamp", ""),
            "action_hash": wm.get("action_hash", ""),
            "observation_hash": wm.get("observation_hash", ""),
            "priority": f"P{wm.get('tool_priority', 2)}",
            "agent_confidence": wm.get("agent_confidence", -1),
            "surprise_score": wm.get("surprise_score", 1.0),
            "observation_entropy": wm.get("observation_entropy", 0),
            "wm_eligible": wm.get("wm_eligible", False),
            "ok": r.get("ok", True),
            "prediction_gap": None,
            "exit_code": None,
            "observation_len": len(r.get("observation", "")),
        }
    # Legacy format (OpenCode/FORGE)
    return {
        "tool": r.get("tool", "unknown"),
        "timestamp": r.get("ts", ""),
        "action_hash": r.get("action_hash", ""),
        "observation_hash": r.get("observation_hash", ""),
        "priority": r.get("wm_priority", "P2"),
        "agent_confidence": r.get("agent_confidence", -1),
        "surprise_score": r.get("surprise_score", 1.0),
        "observation_entropy": r.get("observation_entropy", 0),
        "wm_eligible": r.get("wm_eligible", False),
        "ok": r.get("exit_code") == 0 if r.get("exit_code") is not None else True,
        "prediction_gap": r.get("prediction_gap"),
        "exit_code": r.get("exit_code"),
        "observation_len": 0,
    }

def compute_stats(records: list[dict]) -> dict:
    tools = defaultdict(lambda: {"count": 0, "eligible": 0, "surprises": [], "confidences": [], "gaps": []})
    priorities = defaultdict(lambda: {"count": 0, "eligible": 0})
    total, total_eligible, total_predicted = 0, 0, 0
    
    for r in records:
        total += 1
        tool = r["tool"]
        tools[tool]["count"] += 1
        tools[tool]["surprises"].append(r["surprise_score"])
        tools[tool]["confidences"].append(r["agent_confidence"])
        if r["prediction_gap"] is not None:
            tools[tool]["gaps"].append(r["prediction_gap"])
        if r["wm_eligible"]:
            tools[tool]["eligible"] += 1
            total_eligible += 1
        if r["agent_confidence"] > 0:
            total_predicted += 1
        
        p = r["priority"]
        priorities[p]["count"] += 1
        if r["wm_eligible"]:
            priorities[p]["eligible"] += 1
    
    # Per-tool averages
    tool_stats = {}
    for tool, data in tools.items():
        surprises = data["surprises"]
        confs = [c for c in data["confidences"] if c >= 0]
        gaps = data["gaps"]
        tool_stats[tool] = {
            "count": data["count"],
            "eligible": data["eligible"],
            "eligibility_rate": data["eligible"] / data["count"] if data["count"] else 0,
            "avg_surprise": sum(surprises) / len(surprises) if surprises else 0,
            "avg_confidence": sum(confs) / len(confs) if confs else 0,
            "avg_prediction_gap": sum(gaps) / len(gaps) if gaps else None,
            "max_surprise": max(surprises) if surprises else 0,
        }
    
    return {
        "total_records": total,
        "total_eligible": total_eligible,
        "total_predicted": total_predicted,
        "prediction_rate": total_predicted / total if total else 0,
        "eligible_rate": total_eligible / total if total else 0,
        "tools": tool_stats,
        "priorities": {p: dict(d) for p, d in priorities.items()},
    }

def find_gap_alerts(records: list[dict], threshold: float = 0.6) -> list[dict]:
    """High-confidence wrong predictions = gap alerts."""
    alerts = []
    for r in records:
        if r["agent_confidence"] > 0.7 and r["surprise_score"] > threshold:
            alerts.append({
                "tool": r["tool"],
                "timestamp": r["timestamp"],
                "confidence": r["agent_confidence"],
                "surprise": r["surprise_score"],
                "gap": r.get("prediction_gap"),
                "action_hash": r["action_hash"][:16],
                "severity": "HIGH" if r["surprise_score"] > 0.85 else "MEDIUM",
            })
    return alerts

def print_table(stats: dict, alerts: list[dict] = None):
    """Human-readable dashboard."""
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║              🔥 WM STATS DASHBOARD — Phase 1.5a                ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    print(f"║  Total records:     {stats['total_records']:>5d}                                          ║")
    print(f"║  Predicted:         {stats['total_predicted']:>5d}  ({stats['prediction_rate']:.0%})                                  ║")
    print(f"║  WM eligible:       {stats['total_eligible']:>5d}  ({stats['eligible_rate']:.0%})                                  ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    
    # Priority breakdown
    print("║  Priority Breakdown:                                             ║")
    for p in ["P0", "P1", "P2"]:
        d = stats["priorities"].get(p, {"count": 0, "eligible": 0})
        rate = d["eligible"] / d["count"] if d["count"] else 0
        print(f"║    {p}: {d['count']:>4d} records, {d['eligible']:>4d} eligible ({rate:.0%}){'':>20}║")
    
    print("╠══════════════════════════════════════════════════════════════════╣")
    print("║  Per-Tool Performance:                                           ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    print(f"║ {'Tool':<20s} {'#':>4s} {'Elig':>5s} {'Surprise':>9s} {'Conf':>6s} {'Gap':>8s} ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    
    for tool in sorted(stats["tools"]):
        t = stats["tools"][tool]
        gap_str = f"{t['avg_prediction_gap']:.3f}" if t['avg_prediction_gap'] is not None else "N/A"
        print(f"║ {tool:<20s} {t['count']:>4d} {t['eligible']:>5d} {t['avg_surprise']:>8.3f} {t['avg_confidence']:>5.2f} {gap_str:>8s} ║")
    
    print("╚══════════════════════════════════════════════════════════════════╝")
    
    if alerts is not None:
        print(f"\n🛑 GAP ALERTS ({len(alerts)} found, threshold >0.7 conf + >0.6 surprise):")
        print("─" * 70)
        if not alerts:
            print("  ✅ No high-confidence failures detected.")
        for a in alerts:
            sev = "🔴" if a["severity"] == "HIGH" else "🟡"
            print(f"  {sev} [{a['timestamp'][:19]}] {a['tool']} | conf={a['confidence']:.2f} surprise={a['surprise']:.3f}")

if __name__ == "__main__":
    json_mode = "--json" in sys.argv
    alerts_only = "--alerts-only" in sys.argv
    
    records_raw = load_trajectories(TRAJECTORY_LOG)
    records = [normalize_record(r) for r in records_raw]
    stats = compute_stats(records)
    alerts = find_gap_alerts(records)
    
    if json_mode:
        print(json.dumps({"stats": stats, "alerts": alerts}, indent=2, default=str))
    elif alerts_only:
        print(json.dumps(alerts, indent=2, default=str))
    else:
        print_table(stats, alerts)
