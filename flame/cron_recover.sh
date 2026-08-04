#!/usr/bin/env bash
# ── FLAME S5 Part 2: Auto-Recovery Cron ───────────────────────────────────
# Runs every 5 minutes via flame-recover.timer.
# Attempts to re-promote auto-demoted tiers after cooldown.
# Also serves as a provider health probe — a tier that stays down
# for multiple cycles needs manual investigation.
#
# DITEMPA BUKAN DIBERI — Forged 2026-08-04

set -euo pipefail
LOGFILE="/var/log/flame-recover.log"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

{
    echo "[$(timestamp)] FLAME recover cycle start"

    # Run recovery with 5s per-model timeout
    output=$(/usr/local/bin/free-llm --mode recover --json 2>&1) || true

    # Parse result
    recovered=$(echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('recovered',0))" 2>/dev/null || echo "0")
    failed=$(echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('failed',0))" 2>/dev/null || echo "0")
    cooling=$(echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('still_cooling',0))" 2>/dev/null || echo "0")

    echo "  recovered=$recovered failed=$failed cooling=$cooling"

    # Log detail if something changed
    if [ "$recovered" -gt 0 ] || [ "$failed" -gt 0 ]; then
        echo "  detail:"
        echo "$output" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('detail',{}).get('recovered',[]):
    print(f'    ✅ RECOVERED {r[\"key\"]} ({r[\"latency_ms\"]:.0f}ms)')
for f in d.get('detail',{}).get('failed',[]):
    print(f'    ❌ STILL DOWN {f[\"key\"]} ({f.get(\"reason\",\"?\")})')
" 2>/dev/null || true
    fi

    echo "[$(timestamp)] FLAME recover cycle complete"
    echo "---"
} >> "$LOGFILE" 2>&1

exit 0
