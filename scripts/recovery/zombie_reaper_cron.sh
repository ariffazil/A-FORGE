#!/bin/bash
# forge-zombie-reaper wrapper — P3A ARIFOS::CLOSURE_RECOVERY::v1
# Doctrine: ARIFOS::CLOSURE_RECOVERY::v1 LEVERAGE POINT #4
# Purpose: Auto-recovery from manual recovery (entropy containment)

set -e
REAPER="/root/A-FORGE/scripts/recovery/forge_zombie_reaper.py"
LOG_DIR="/root/forge_work/recovery-scans/cron-logs"
LOG_FILE="$LOG_DIR/zombie-reaper.log"

mkdir -p "$LOG_DIR"

# Run reaper, capture output + exit code (must NOT abort on zombies)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
set +e
OUTPUT=$(python3 "$REAPER" 2>&1)
EXIT_CODE=$?
set -e

# Log entry
echo "=== $TS reaper exit=$EXIT_CODE ===" >> "$LOG_FILE"
echo "$OUTPUT" >> "$LOG_FILE"

# Emit system-wide FQ+closure signal — write structured snapshot
SNAPSHOT="/root/forge_work/recovery-scans/cron-snapshots/reaper-${TS//:/_}.json"
mkdir -p "$(dirname "$SNAPSHOT")"

# Extract numbers from output
TOTAL=$(echo "$OUTPUT" | grep "Total items:" | awk '{print $3}')
HOLD=$(echo "$OUTPUT" | grep "⚠" | grep -oE "[0-9]+" | head -1 || echo "0")

# Read latest full scan JSON for surface breakdown
LATEST=$(ls -t /root/forge_work/recovery-scans/reap-*.json 2>/dev/null | head -1)

cat > "$SNAPSHOT" << JSON
{
  "ts_utc": "$TS",
  "exit_code": $EXIT_CODE,
  "zombie_count": $HOLD,
  "total_items": $TOTAL,
  "latest_scan": "$LATEST",
  "doctrine_ref": "ARIFOS::CLOSURE_RECOVERY::v1",
  "leverage_point": 4
}
JSON

# Alert if zombies found — non-zero exit already triggers cron monitoring
if [ "$EXIT_CODE" -ne 0 ]; then
    echo "$TS zombie_count=$HOLD total=$TOTAL" >> /var/log/arifos/cron-alerts.log
fi

exit $EXIT_CODE
