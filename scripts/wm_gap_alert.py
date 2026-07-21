#!/usr/bin/env python3
"""
WM Gap Alert Pipeline — Phase 1.5b
Detects high-confidence wrong predictions and emits to:
  1. NATS subject: wm.gap.alert (for dashboard/agents)
  2. Alert log: /root/.local/share/arifos/world-model/gap_alerts.jsonl
  3. stderr (for journald capture)

Modes:
  --scan       : Scan trajectory log for historical gaps, emit alerts
  --watch      : Watch trajectory log (tail -f) for real-time gaps
  --threshold  : Set surprise_threshold (default 0.6), e.g. --threshold 0.5
  --dry-run    : Print alerts without emitting to NATS
"""
import json, os, sys, time, subprocess
from datetime import datetime

TRAJECTORY_LOG = "/root/.local/share/arifos/world-model/trajectories.jsonl"
ALERT_LOG = "/root/.local/share/arifos/world-model/gap_alerts.jsonl"
NATS_SUBJECT = "wm.gap.alert"
NATS_SERVER = "nats://127.0.0.1:4222"

CONFIDENCE_THRESHOLD = 0.7
SURPRISE_THRESHOLD = 0.6

def emit_nats(alert: dict) -> bool:
    """Publish alert to NATS. Returns True on success."""
    try:
        payload = json.dumps(alert)
        result = subprocess.run(
            ["nats", "pub", "--server", NATS_SERVER, NATS_SUBJECT, payload],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except Exception as e:
        print(f"[gap-alert] NATS publish failed: {e}", file=sys.stderr)
        return False

def log_alert(alert: dict) -> None:
    """Append alert to persistent log."""
    os.makedirs(os.path.dirname(ALERT_LOG), exist_ok=True)
    with open(ALERT_LOG, "a") as f:
        f.write(json.dumps(alert) + "\n")

def detect_gaps(records: list[dict], conf_threshold: float, surprise_threshold: float) -> list[dict]:
    """Find records where agent was confident but wrong."""
    alerts = []
    for r in records:
        conf = r.get("agent_confidence", r.get("wm", {}).get("agent_confidence", -1))
        surprise = r.get("surprise_score", r.get("wm", {}).get("surprise_score", 1.0))
        gap = r.get("prediction_gap")
        tool = r.get("tool", r.get("tool_name", "unknown"))
        ts = r.get("ts", r.get("timestamp", ""))
        
        if conf > conf_threshold and surprise > surprise_threshold:
            severity = "CRITICAL" if surprise > 0.9 else "HIGH" if surprise > 0.75 else "MEDIUM"
            alerts.append({
                "type": "wm_gap_alert",
                "severity": severity,
                "tool": tool,
                "timestamp": ts,
                "agent_confidence": conf,
                "surprise_score": surprise,
                "prediction_gap": gap,
                "subject": NATS_SUBJECT,
                "emitted_at": datetime.utcnow().isoformat() + "Z",
            })
    return alerts

def scan_trajectories(conf_threshold: float, surprise_threshold: float, dry_run: bool = False) -> list[dict]:
    """Scan all trajectories and emit gap alerts."""
    records = []
    if os.path.exists(TRAJECTORY_LOG):
        with open(TRAJECTORY_LOG) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    
    alerts = detect_gaps(records, conf_threshold, surprise_threshold)
    
    for alert in alerts:
        sev_icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡"}.get(alert["severity"], "⚪")
        print(f"{sev_icon} [GAP] {alert['tool']} | conf={alert['agent_confidence']:.2f} surprise={alert['surprise_score']:.3f}")
        
        if not dry_run:
            emitted = emit_nats(alert)
            alert["nats_emitted"] = emitted
            if not emitted:
                print(f"  ⚠️ NATS emit failed", file=sys.stderr)
        
        log_alert(alert)
    
    print(f"\n{alerts.__len__()} gap alerts detected and processed.")
    return alerts

def watch_trajectories(conf_threshold: float, surprise_threshold: float, dry_run: bool = False) -> None:
    """Tail the trajectory log for real-time gap detection."""
    print(f"[gap-alert] Watching {TRAJECTORY_LOG} for gaps (conf>{conf_threshold}, surprise>{surprise_threshold})")
    
    last_size = os.path.getsize(TRAJECTORY_LOG) if os.path.exists(TRAJECTORY_LOG) else 0
    
    while True:
        try:
            if os.path.exists(TRAJECTORY_LOG):
                current_size = os.path.getsize(TRAJECTORY_LOG)
                if current_size > last_size:
                    with open(TRAJECTORY_LOG) as f:
                        f.seek(last_size)
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                r = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            
                            conf = r.get("agent_confidence", r.get("wm", {}).get("agent_confidence", -1))
                            surprise = r.get("surprise_score", r.get("wm", {}).get("surprise_score", 1.0))
                            
                            if conf > conf_threshold and surprise > surprise_threshold:
                                gap = r.get("prediction_gap")
                                tool = r.get("tool", r.get("tool_name", "unknown"))
                                ts = r.get("ts", r.get("timestamp", ""))
                                severity = "CRITICAL" if surprise > 0.9 else "HIGH" if surprise > 0.75 else "MEDIUM"
                                
                                alert = {
                                    "type": "wm_gap_alert",
                                    "severity": severity,
                                    "tool": tool,
                                    "timestamp": ts,
                                    "agent_confidence": conf,
                                    "surprise_score": surprise,
                                    "prediction_gap": gap,
                                    "subject": NATS_SUBJECT,
                                    "emitted_at": datetime.utcnow().isoformat() + "Z",
                                }
                                
                                sev_icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡"}.get(severity, "⚪")
                                print(f"{sev_icon} [REALTIME GAP] {tool} | conf={conf:.2f} surprise={surprise:.3f}")
                                
                                if not dry_run:
                                    alert["nats_emitted"] = emit_nats(alert)
                                log_alert(alert)
                    
                    last_size = current_size
            time.sleep(2)
        except KeyboardInterrupt:
            print("\n[gap-alert] Stopped.")
            break
        except Exception as e:
            print(f"[gap-alert] Watch error: {e}", file=sys.stderr)
            time.sleep(5)

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    watch_mode = "--watch" in sys.argv
    
    # Parse --threshold
    surprise_threshold = SURPRISE_THRESHOLD
    for i, arg in enumerate(sys.argv):
        if arg == "--threshold" and i + 1 < len(sys.argv):
            surprise_threshold = float(sys.argv[i + 1])
    
    if watch_mode:
        watch_trajectories(CONFIDENCE_THRESHOLD, surprise_threshold, dry_run)
    else:
        scan_trajectories(CONFIDENCE_THRESHOLD, surprise_threshold, dry_run)
