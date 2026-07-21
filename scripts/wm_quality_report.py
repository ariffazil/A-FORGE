#!/usr/bin/env python3
"""
WM Trajectory Quality Report + Phase 2 Readiness — Phase 1.5c + 1.5d
"""
import json, os
from collections import defaultdict
from datetime import datetime

TRAJECTORY_LOG = "/root/.local/share/arifos/world-model/trajectories.jsonl"
FORGE_WORK = "/root/A-FORGE/forge_work/2026-07-21"

def load_all() -> list[dict]:
    records = []
    if os.path.exists(TRAJECTORY_LOG):
        with open(TRAJECTORY_LOG) as f:
            for line in f:
                line = line.strip()
                if line:
                    try: records.append(json.loads(line))
                    except json.JSONDecodeError: continue
    return records

def normalize(r: dict) -> dict:
    if "wm" in r:
        wm = r["wm"]
        return {
            "tool": r.get("tool_name", "unknown"),
            "ts": r.get("timestamp", ""),
            "priority": wm.get("tool_priority", 2),
            "conf": wm.get("agent_confidence", -1),
            "surprise": wm.get("surprise_score", 1.0),
            "entropy": wm.get("observation_entropy", 0),
            "eligible": wm.get("wm_eligible", False),
            "ok": r.get("ok", True),
            "gap": None,
        }
    return {
        "tool": r.get("tool", "unknown"),
        "ts": r.get("ts", ""),
        "priority": {"P0": 0, "P1": 1, "P2": 2}.get(r.get("wm_priority", "P2"), 2),
        "conf": r.get("agent_confidence", -1),
        "surprise": r.get("surprise_score", 1.0),
        "entropy": r.get("observation_entropy", 0),
        "eligible": r.get("wm_eligible", False),
        "ok": r.get("exit_code") == 0 if r.get("exit_code") is not None else True,
        "gap": r.get("prediction_gap"),
    }

def quality_score(records: list[dict]) -> dict:
    tools: dict[str, dict] = {}
    for r in records:
        t = r["tool"]
        if t not in tools:
            tools[t] = {"count": 0, "eligible": 0, "surprise_sum": 0.0, "entropy_sum": 0.0,
                         "high_surprise": 0, "low_conf_high_surprise": 0, "gaps": []}
        d = tools[t]
        d["count"] += 1
        d["surprise_sum"] += r["surprise"]
        d["entropy_sum"] += r["entropy"]
        if r["eligible"]: d["eligible"] += 1
        if r["surprise"] > 0.5: d["high_surprise"] += 1
        if r["conf"] >= 0 and r["conf"] < 0.5 and r["surprise"] > 0.5: d["low_conf_high_surprise"] += 1
        if r["gap"] is not None: d["gaps"].append(r["gap"])
    
    scores = {}
    for tool, d in tools.items():
        n = d["count"]
        scores[tool] = {
            "count": n,
            "eligible": d["eligible"],
            "eligible_rate": d["eligible"] / n,
            "avg_surprise": d["surprise_sum"] / n,
            "avg_entropy": d["entropy_sum"] / n,
            "high_surprise_rate": d["high_surprise"] / n,
            "learning_opportunity_rate": d["low_conf_high_surprise"] / n,
            "avg_gap": sum(d["gaps"]) / len(d["gaps"]) if d["gaps"] else None,
            "quality_grade": _grade(n, d["eligible"] / n, d["surprise_sum"] / n),
        }
    return scores

def _grade(count: int, eligible_rate: float, avg_surprise: float) -> str:
    if count < 5: return "INSUFFICIENT_DATA"
    if eligible_rate > 0.6 and avg_surprise > 0.4: return "A — Excellent"
    if eligible_rate > 0.4 and avg_surprise > 0.3: return "B — Good"
    if eligible_rate > 0.2: return "C — Fair"
    return "D — Poor"

def trend_analysis(records: list[dict]) -> dict:
    if len(records) < 3: return {"verdict": "INSUFFICIENT_DATA"}
    by_tool = defaultdict(list)
    for r in records: by_tool[r["tool"]].append(r)
    trends = {}
    for tool, recs in by_tool.items():
        recs.sort(key=lambda x: x["ts"])
        if len(recs) < 3:
            trends[tool] = "INSUFFICIENT_DATA"; continue
        mid = len(recs) // 2
        avg1 = sum(r["surprise"] for r in recs[:mid]) / mid
        avg2 = sum(r["surprise"] for r in recs[mid:]) / (len(recs) - mid)
        delta = avg2 - avg1
        if delta < -0.1: trends[tool] = f"IMPROVING (delta={delta:+.2f})"
        elif delta > 0.1: trends[tool] = f"DEGRADING (delta={delta:+.2f})"
        else: trends[tool] = f"STABLE (delta={delta:+.2f})"
    return trends

def phase2_readiness(records: list[dict]) -> dict:
    total = len(records)
    eligible = sum(1 for r in records if r["eligible"])
    tools_n = len(set(r["tool"] for r in records))
    MIN_T, MIN_E, MIN_TOOLS = 100, 50, 3
    checks = {
        "total_trajectories": {"value": total, "threshold": MIN_T, "pass": total >= MIN_T},
        "eligible_trajectories": {"value": eligible, "threshold": MIN_E, "pass": eligible >= MIN_E},
        "tools_represented": {"value": tools_n, "threshold": MIN_TOOLS, "pass": tools_n >= MIN_TOOLS},
    }
    return {
        "ready": all(c["pass"] for c in checks.values()),
        "checks": checks,
        "progress": f"{total}/{MIN_T} total, {eligible}/{MIN_E} eligible",
        "blockers": [
            "GRPO implementation (ref: Cameron Wolfe PyTorch GRPO post)",
            "Harbor-style agent harness for forge_* tools",
            "Docker sandboxes for safe rollout execution",
            "Task-completion verifier (reward model)",
        ],
        "architecture": {
            "rollout": "Harbor harness + Docker sandboxes",
            "loss": "ECHO hybrid: L_GRPO(action) + lambda*L_CE(obs)/Z, lambda in [0.01,0.05]",
            "optimizer": "GRPO with prompt-level advantage normalization",
            "target": "forge agent backbone (Qwen3-8B or DeepSeek-v4-flash)",
            "data_source": f"trajectories.jsonl ({total} records, {eligible} eligible)",
        },
    }

def generate_report(records: list[dict]) -> str:
    quality = quality_score(records)
    trends = trend_analysis(records)
    readiness = phase2_readiness(records)
    total = len(records)
    eligible = sum(1 for r in records if r["eligible"])
    
    lines = [
        "# WM Trajectory Quality Report + Phase 2 Readiness",
        f"> Generated: {datetime.utcnow().isoformat()}Z | {total} records, {eligible} eligible",
        "",
        "## 1. Per-Tool Quality",
        "",
        "| Tool | # | Eligible | Rate | Surprise | Entropy | Grade |",
        "|------|---|----------|------|----------|---------|-------|",
    ]
    for tool in sorted(quality):
        q = quality[tool]
        lines.append(f"| {tool} | {q['count']} | {q['eligible']} | {q['eligible_rate']:.0%} | {q['avg_surprise']:.3f} | {q['avg_entropy']:.3f} | {q['quality_grade']} |")
    
    lines += ["", "## 2. Trending", ""]
    for tool, trend in trends.items():
        lines.append(f"- **{tool}**: {trend}")
    
    r = readiness
    lines += [
        "", "## 3. Phase 2 Readiness", "",
        f"**Verdict:** {'READY' if r['ready'] else 'NOT READY'}",
        f"**Progress:** {r['progress']}",
        "",
        "| Check | Value | Threshold | Pass |",
        "|-------|-------|-----------|------|",
    ]
    for name, c in r["checks"].items():
        lines.append(f"| {name} | {c['value']} | {c['threshold']} | {'Y' if c['pass'] else 'N'} |")
    
    lines += ["", "### Blockers (888_HOLD)", ""]
    for b in r["blockers"]:
        lines.append(f"- [ ] {b}")
    
    lines += ["", "### Architecture", ""]
    for k, v in r["architecture"].items():
        lines.append(f"- **{k}:** {v}")
    
    lines += ["", "---", "*Auto-generated by wm_quality_report.py*"]
    return "\n".join(lines)

if __name__ == "__main__":
    raw = load_all()
    records = [normalize(r) for r in raw]
    report = generate_report(records)
    os.makedirs(FORGE_WORK, exist_ok=True)
    path = os.path.join(FORGE_WORK, "WM-PHASE15-QUALITY-READINESS.md")
    with open(path, "w") as f: f.write(report)
    print(report)
    print(f"\nSaved: {path}")
