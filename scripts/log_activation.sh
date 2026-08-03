#!/usr/bin/env bash
# ⚡ log_activation.sh — Agent Organ Activation Logger
# DITEMPA BUKAN DIBERI
#
# Usage (inline JSON):
#   log_activation.sh '{"compile_id":"abc","task":"do X","organs_activated":["geox"],...}'
#
# Usage (--quick mode, minimal args):
#   log_activation.sh --quick --compile-id abc --task "do X" --organs "geox,wealth"
#
# Usage (--boot mode, saves compile JSON for later matching):
#   log_activation.sh --boot /path/to/session.compile.json
#
# Auto-detection:
#   If CC_COMPILE_JSON is set in env, --compile-id is auto-populated from it.
#   Compile JSON is auto-saved to COMPILE_DIR for metabolize_session.sh matching.
#
# Integration: called after every task by agent harness.

set -euo pipefail

ACTIVATION_LOG="${ACTIVATION_LOG:-/root/.arifos/context/activation_log.jsonl}"
COMPILE_DIR="${COMPILE_DIR:-/root/.arifos/context/compiles}"
LOG_DIR="$(dirname "$ACTIVATION_LOG")"
mkdir -p "$LOG_DIR" "$COMPILE_DIR"

now_iso() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ── --boot mode: save compile JSON for later matching ──
if [[ "${1:-}" == "--boot" ]]; then
    COMPILE_JSON="${2:-}"
    if [[ -z "$COMPILE_JSON" ]] || [[ ! -f "$COMPILE_JSON" ]]; then
        # Try CC_COMPILE_JSON from env
        COMPILE_JSON="${CC_COMPILE_JSON:-}"
    fi
    if [[ -z "$COMPILE_JSON" ]] || [[ ! -f "$COMPILE_JSON" ]]; then
        echo "❌ --boot requires path to compile JSON or CC_COMPILE_JSON env var."
        exit 1
    fi
    COMPILE_ID=$(python3 -c "import json; print(json.load(open('$COMPILE_JSON'))['compile_id'])")
    cp "$COMPILE_JSON" "$COMPILE_DIR/${COMPILE_ID}.json"
    echo "✅ Boot compile saved: $COMPILE_DIR/${COMPILE_ID}.json"
    echo "   Compile ID: $COMPILE_ID"
    echo "   Export: export CC_COMPILE_ID=$COMPILE_ID"
    exit 0
fi

# ── --quick mode: build entry from flags ──
if [[ "${1:-}" == "--quick" ]]; then
    shift
    COMPILE_ID="${CC_COMPILE_ID:-}"; TASK=""; ORGANS=""; CROSS=""; OUTCOME="completed"; VERDICT="Pass"; NOTES=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --compile-id) COMPILE_ID="$2"; shift 2 ;;
            --task) TASK="$2"; shift 2 ;;
            --organs) ORGANS="$2"; shift 2 ;;
            --cross) CROSS="$2"; shift 2 ;;
            --outcome) OUTCOME="$2"; shift 2 ;;
            --verdict) VERDICT="$2"; shift 2 ;;
            --notes) NOTES="$2"; shift 2 ;;
            *) echo "❌ Unknown flag: $1"; exit 1 ;;
        esac
    done

    if [[ -z "$COMPILE_ID" ]]; then
        echo "❌ --compile-id required (or set CC_COMPILE_ID env var)."
        exit 1
    fi

    # Build organs_activated array
    IFS=',' read -ra ORG_ARRAY <<< "$ORGANS"
    ORGANS_JSON="["
    for i in "${!ORG_ARRAY[@]}"; do
        [[ $i -gt 0 ]] && ORGANS_JSON+=","
        ORGANS_JSON+="\"${ORG_ARRAY[$i]}\""
    done
    ORGANS_JSON+="]"

    # Build cross_organ_routes if provided
    CROSS_JSON="[]"
    if [[ -n "$CROSS" ]]; then
        IFS=',' read -ra CROSS_ARRAY <<< "$CROSS"
        CROSS_JSON="["
        for i in "${!CROSS_ARRAY[@]}"; do
            [[ $i -gt 0 ]] && CROSS_JSON+=","
            IFS=':' read -ra PARTS <<< "${CROSS_ARRAY[$i]}"
            CROSS_JSON+="{\"organ\":\"${PARTS[0]:-unknown}\",\"reason\":\"${PARTS[1]:-compiler_gap}\",\"tool\":\"${PARTS[2]:-none}\",\"note\":\"${PARTS[3]:-none}\"}"
        done
        CROSS_JSON+="]"
    fi

    ENTRY=$(cat <<EOF
{
  "compile_id": "$COMPILE_ID",
  "task": "$TASK",
  "timestamp": "$(now_iso)",
  "session_id": "${SESSION_ID:-unknown}",
  "organs_activated": $ORGANS_JSON,
  "cross_organ_routes": $CROSS_JSON,
  "task_outcome": "$OUTCOME",
  "floor_verdict": "$VERDICT",
  "agent_notes": "$NOTES"
}
EOF
)
else
    # Read entry from argument (inline JSON) or stdin
    if [[ -f "${1:-}" ]]; then
        ENTRY=$(cat "$1")
    elif [[ -n "${1:-}" ]]; then
        ENTRY="$1"
    else
        ENTRY=$(cat)
    fi
fi

# Validate JSON
if ! echo "$ENTRY" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
    echo "❌ Invalid JSON entry. Must be a single JSON object."
    exit 1
fi

# Auto-save compile JSON to compiles dir if we have CC_COMPILE_JSON
if [[ -n "${CC_COMPILE_JSON:-}" ]] && [[ -f "$CC_COMPILE_JSON" ]]; then
    CID=$(python3 -c "import json; print(json.load(open('$CC_COMPILE_JSON'))['compile_id'])")
    TARGET="$COMPILE_DIR/${CID}.json"
    if [[ ! -f "$TARGET" ]]; then
        cp "$CC_COMPILE_JSON" "$TARGET"
    fi
fi

# Compact to single line and append
COMPACT=$(echo "$ENTRY" | python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())))")
echo "$COMPACT" >> "$ACTIVATION_LOG"

ENTRY_COUNT=$(wc -l < "$ACTIVATION_LOG")
CID=$(echo "$COMPACT" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('compile_id','?'))")
echo "✅ Activation logged. compile_id=$CID | total entries: $ENTRY_COUNT"
