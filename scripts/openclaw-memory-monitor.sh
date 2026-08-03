#!/bin/bash
# OpenClaw Memory Monitor — checks RSS every 5 minutes, logs warnings
# Installed by 333-AGI 2026-08-03 (Loop 4 resolution)
# Threshold: 1.5GB RSS (matching OpenClaw's own diagnostic threshold)

THRESHOLD_MB=1536
SERVICE="openclaw-gateway"

RSS_KB=$(ps -o rss= -p $(pgrep -f "$SERVICE" | head -1) 2>/dev/null)
if [ -z "$RSS_KB" ]; then
    echo "[$(date -Iseconds)] openclaw-monitor: $SERVICE not running" | systemd-cat -t openclaw-monitor -p warning
    exit 1
fi

RSS_MB=$((RSS_KB / 1024))

if [ "$RSS_MB" -gt "$THRESHOLD_MB" ]; then
    RATIO=$(awk "BEGIN {printf \"%.1f\", $RSS_MB / $THRESHOLD_MB * 100}")
    echo "[$(date -Iseconds)] openclaw-monitor: MEMORY PRESSURE — RSS=${RSS_MB}MB threshold=${THRESHOLD_MB}MB ratio=${RATIO}%" | systemd-cat -t openclaw-monitor -p warning
    
    # If critically high (>180% threshold), log critical
    if [ "$RSS_MB" -gt $((THRESHOLD_MB * 180 / 100)) ]; then
        echo "[$(date -Iseconds)] openclaw-monitor: CRITICAL — RSS=${RSS_MB}MB. Manual restart recommended. Run: systemctl restart openclaw-gateway" | systemd-cat -t openclaw-monitor -p critical
    fi
else
    # Log OK status once per hour (avoid spam)
    MINUTE=$(date +%M)
    if [ "$MINUTE" = "00" ]; then
        echo "[$(date -Iseconds)] openclaw-monitor: OK — RSS=${RSS_MB}MB" | systemd-cat -t openclaw-monitor -p info
    fi
fi
