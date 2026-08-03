#!/usr/bin/env bash
# ⚡ metabolize_session.sh — Session-End Metabolic Loop Closure
# DITEMPA BUKAN DIBERI
#
# Closes the metabolic loop for a session: reads every activation log entry,
# finds its matching compile JSON by compile_id, runs the learner, writes receipts.
#
# Usage:
#   metabolize_session.sh [--session-id SID] [--save] [--all]
#
# Options:
#   --session-id  Filter activation entries by session_id (default: all entries)
#   --save         Write receipts to activation_receipts.jsonl
#   --all          Process ALL activation log entries (ignore session_id filter)
#
# Integration: RSI Phase 4 (LEDGER) → call this before sealing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LEARNER="$SCRIPT_DIR/organ_activation_learner.py"
ACTIVATION_LOG="${ACTIVATION_LOG:-/root/.arifos/context/activation_log.jsonl}"
COMPILE_DIR="${COMPILE_DIR:-/root/.arifos/context/compiles}"
SESSION_ID=""
SAVE=""
PROCESS_ALL=false
GAPS_TOTAL=0
REINFORCED_TOTAL=0
EXPAND_TOTAL=0
PROCESSED=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --session-id) SESSION_ID="$2"; shift 2 ;;
        --save) SAVE="--save"; shift ;;
        --all) PROCESS_ALL=true; shift ;;
        *) shift ;;
    esac
done

echo "╔══════════════════════════════════════════╗"
echo "║   SESSION METABOLIC CLOSURE             ║"
echo "╠══════════════════════════════════════════╣"

if [[ -n "$SESSION_ID" ]]; then
    echo "║ Session:  ${SESSION_ID:0:24}..."
fi

if [[ ! -f "$ACTIVATION_LOG" ]]; then
    echo "║ ⚠️  No activation log. Nothing to metabolize."
    echo "╚══════════════════════════════════════════╝"
    exit 0
fi

ENTRY_COUNT=$(wc -l < "$ACTIVATION_LOG")
echo "║ Log:      $ACTIVATION_LOG"
echo "║ Entries:  $ENTRY_COUNT"
echo "║ Compiles: $COMPILE_DIR"
echo "╠══════════════════════════════════════════╣"

# Process each activation log entry
LINE_NUM=0
while IFS= read -r line; do
    LINE_NUM=$((LINE_NUM + 1))
    [[ -z "$line" ]] && continue

    # Parse entry
    ENTRY=$(echo "$line" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    # Filter by session_id if specified and not --all
    sid = d.get('session_id','')
    target = '$SESSION_ID'
    if target and target != 'unknown' and sid != target and not '$PROCESS_ALL' == 'true':
        sys.exit(1)
    print(json.dumps({
        'compile_id': d.get('compile_id',''),
        'task': d.get('task','')[:60],
        'organs': d.get('organs_activated',[]),
        'outcome': d.get('task_outcome','?')
    }))
except Exception as e:
    print(f'ERROR:{e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null) || continue

    COMPILE_ID=$(echo "$ENTRY" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['compile_id'])")
    TASK=$(echo "$ENTRY" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['task'])")

    # Find matching compile JSON
    COMPILE_JSON="$COMPILE_DIR/${COMPILE_ID}.json"

    if [[ ! -f "$COMPILE_JSON" ]]; then
        echo "║ ⏭  #$LINE_NUM ${COMPILE_ID:0:12} — no compile JSON, skipping"
        continue
    fi

    echo "║"
    echo "║ ▶ #$LINE_NUM ${COMPILE_ID:0:12} | $TASK"
    echo "║"

    # Run learner
    RESULT=$(python3 "$LEARNER" diff --from-compile "$COMPILE_JSON" $SAVE 2>&1) || true

    # Count gaps
    GAPS=$(echo "$RESULT" | grep -c "compiler_gap" || true)
    REINFORCED=$(echo "$RESULT" | grep -c "REINFORCE" || true)
    EXPAND=$(echo "$RESULT" | grep -c "EXPAND" || true)

    GAPS_TOTAL=$((GAPS_TOTAL + GAPS))
    REINFORCED_TOTAL=$((REINFORCED_TOTAL + REINFORCED))
    EXPAND_TOTAL=$((EXPAND_TOTAL + EXPAND))
    PROCESSED=$((PROCESSED + 1))

done < "$ACTIVATION_LOG"

echo "╠══════════════════════════════════════════╣"
echo "║ METABOLIC CLOSURE COMPLETE              ║"
echo "║ Processed: $PROCESSED entries            "
echo "║ Reinforced: $REINFORCED_TOTAL  |  Gaps: $GAPS_TOTAL  |  Expand: $EXPAND_TOTAL"
echo "╠══════════════════════════════════════════╣"

# Receipt count
if [[ -f /root/.arifos/context/activation_receipts.jsonl ]]; then
    RECEIPTS=$(wc -l < /root/.arifos/context/activation_receipts.jsonl)
    echo "║ Receipts total: $RECEIPTS"
fi

echo "╚══════════════════════════════════════════╝"
