#!/usr/bin/env python3
"""
distill_experience.py — Distill causal trajectories from experience traces.

Separates raw event ledger (1,211 traces) from normalized training ledger.
Filters out pure session traces (session-trace) and repetitive RSI noise (forge_rsi_promotion),
distilling genuine causal execution events into hash-chained world model trajectories.

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import json
import hashlib
import os
import shutil
from datetime import datetime, timezone

TRAJ_FILE = "/root/.local/share/arifos/world-model/trajectories.jsonl"
EXP_FILE = "/root/.local/share/arifos/world-model/experience_traces.jsonl"
HEAD_FILE = "/root/.local/share/arifos/world-model/chain_head.json"
META_FILE = "/root/.local/share/arifos/world-model/metadata.json"

def to_float(val, fallback=0.0) -> float:
    if val is None:
        return fallback
    try:
        return float(val)
    except (ValueError, TypeError):
        return fallback

def verify_outcome(obs: dict, fb: dict) -> tuple[str, bool, int]:
    """
    Evaluates outcome strictly without assuming success.
    Returns (outcome_str, wm_eligible, exit_code).
    outcome_str: 'SUCCESS', 'FAILURE', 'HOLD', or 'UNKNOWN'.
    wm_eligible: bool (True ONLY for verified outcomes, never UNKNOWN).
    exit_code: int (0 for SUCCESS, 1 for FAILURE/UNKNOWN, 2 for HOLD).
    """
    raw_success = obs.get("success")
    explicit_exit = obs.get("exit_code")
    error = obs.get("error") or obs.get("stderr")
    
    # Check constitutional feedback for failure signals
    const_fb = str(fb.get("constitutional", "")).upper()
    has_rejection = any(w in const_fb for w in ("FAIL", "REJECT", "VIOLATION", "DENIED", "HARAM"))
    has_hold = any(w in const_fb for w in ("HOLD", "888_HOLD", "SABAR", "TAHAN"))

    # Explicit failure conditions
    if raw_success is False or str(raw_success).lower() in ("false", "0") or (explicit_exit is not None and explicit_exit != 0) or error or has_rejection:
        return "FAILURE", False, (explicit_exit if explicit_exit is not None else 1)

    # Valid HOLD / safety cases
    if has_hold:
        return "HOLD", True, 2

    # Explicit verified success (requires explicit boolean True or string 'true' and clean execution)
    if (raw_success is True or str(raw_success).lower() in ("true", "1")) and not error and (explicit_exit in (0, None)):
        return "SUCCESS", True, 0

    # Missing or ambiguous outcome -> UNKNOWN, never eligible as positive training example
    return "UNKNOWN", False, 1

def distill() -> dict:
    if not os.path.exists(EXP_FILE):
        return {"error": "Experience traces log not found"}

    # 1. Read existing trajectories
    existing = []
    distilled_ids = set()
    if os.path.exists(TRAJ_FILE):
        with open(TRAJ_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    existing.append(rec)
                    if "distilled_from_trace" in rec:
                        distilled_ids.add(rec["distilled_from_trace"])
                except Exception:
                    pass

    # Backup existing
    if existing:
        shutil.copy2(TRAJ_FILE, f"{TRAJ_FILE}.bak")

    # Determine chain head
    last_rec = existing[-1] if existing else {}
    prev_hash = last_rec.get("hash") or last_rec.get("record_hash") or ("0" * 64)
    seq = len(existing)

    # 2. Read raw experience traces
    raw_traces = []
    malformed_traces = 0
    with open(EXP_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    raw_traces.append(json.loads(line))
                except Exception:
                    malformed_traces += 1

    # Filter out pure session traces and RSI loop heartbeats
    causal_traces = [
        t for t in raw_traces
        if t.get("action", {}).get("tool") not in ("session-trace", "forge_rsi_promotion", "unknown")
    ]

    new_trajectories = []
    outcome_counts = {"SUCCESS": 0, "FAILURE": 0, "HOLD": 0, "UNKNOWN": 0}
    for t in causal_traces:
        trace_id = t.get("trace_id", "")
        if trace_id in distilled_ids:
            continue

        action = t.get("action", {})
        obs = t.get("observation", {})
        fb = t.get("feedback", {})
        delta = t.get("experience_delta", {})

        tool = str(action.get("tool", "unknown")).strip()
        input_hash = str(action.get("input_hash", ""))
        output_hash = str(obs.get("output_hash", ""))

        outcome_status, eligible, exit_code = verify_outcome(obs, fb)
        outcome_counts[outcome_status] = outcome_counts.get(outcome_status, 0) + 1
        success = (outcome_status == "SUCCESS")

        if tool in ("forge_execute", "forge_shell", "mesh_sync", "chain_recovery"):
            priority = "P0"
        elif "test" in tool or "verify" in tool or "guard" in tool:
            priority = "P1"
        else:
            priority = "P2"

        cap_change = to_float(delta.get("capability_change"), 0.0)
        conf_change = to_float(delta.get("confidence_change"), 0.0)

        surprise = min(1.0, max(0.3, cap_change if cap_change > 0 else (0.7 if not success else 0.45)))
        confidence = min(0.95, max(0.5, 0.8 + conf_change))
        feedback_text = str(fb.get("self", "")) + str(fb.get("environmental", "")) + str(fb.get("constitutional", ""))
        entropy = round(len(feedback_text) / 20.0, 2)
        prediction_gap = round(abs(confidence - (1.0 if success else 0.0)), 3)

        seq += 1
        ts = t.get("ts") or datetime.now(timezone.utc).isoformat()

        payload = f"{seq}:{ts}:{input_hash}:{output_hash}:{tool}:{prev_hash}"
        rec_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        rec = {
            "seq": seq,
            "ts": ts,
            "action_hash": input_hash,
            "observation_hash": output_hash,
            "tool": tool,
            "wm_priority": priority,
            "wm_eligible": eligible,
            "outcome_status": outcome_status,
            "agent_confidence": confidence,
            "surprise_score": round(surprise, 3),
            "observation_entropy": entropy,
            "prediction_gap": prediction_gap,
            "exit_code": exit_code,
            "distilled_from_trace": trace_id,
            "prev_hash": prev_hash,
            "hash": rec_hash
        }
        prev_hash = rec_hash
        new_trajectories.append(rec)
        distilled_ids.add(trace_id)

    # 3. Append to trajectories.jsonl
    if new_trajectories:
        with open(TRAJ_FILE, "a", encoding="utf-8") as f:
            for r in new_trajectories:
                f.write(json.dumps(r) + "\n")

    all_records = existing + new_trajectories
    total = len(all_records)
    eligible_count = sum(1 for r in all_records if r.get("wm_eligible", False) or r.get("wm", {}).get("wm_eligible", False))

    # Update chain head
    if all_records:
        last = all_records[-1]
        head_data = {
            "last_hash": last.get("hash") or last.get("record_hash") or ("0" * 64),
            "total_records": total,
            "last_timestamp": last.get("ts") or last.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(HEAD_FILE, "w", encoding="utf-8") as f:
            json.dump(head_data, f, indent=2)

    # Update metadata
    p_counts = {"P0": 0, "P1": 0, "P2": 0}
    for r in all_records:
        p = r.get("wm_priority") or f"P{r.get('wm', {}).get('tool_priority', 2)}"
        p_counts[p] = p_counts.get(p, 0) + 1

    meta_data = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "records_by_priority": p_counts,
        "records_eligible": eligible_count,
        "distilled_from_experience_traces": len(causal_traces),
        "malformed_traces_count": malformed_traces,
        "outcome_breakdown_new": outcome_counts,
    }
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta_data, f, indent=2)

    # 4. Reconcile skill selection outcomes (SkillGate Phase 2)
    reconciled_skills = 0
    try:
        import sys
        sys.path.insert(0, "/root/A-FORGE")
        from a_think.affordance import get_skill_selection_tracker
        tracker = get_skill_selection_tracker()
        reconciled_skills = tracker.reconcile_outcomes()
    except Exception as e:
        pass

    return {
        "status": "PASS",
        "raw_traces": len(raw_traces),
        "malformed_traces": malformed_traces,
        "causal_traces_found": len(causal_traces),
        "newly_distilled": len(new_trajectories),
        "outcome_breakdown_new": outcome_counts,
        "total_trajectories": total,
        "eligible_trajectories": eligible_count,
        "reconciled_skill_outcomes": reconciled_skills,
        "chain_head": prev_hash,
    }

if __name__ == "__main__":
    result = distill()
    print(json.dumps(result, indent=2))

