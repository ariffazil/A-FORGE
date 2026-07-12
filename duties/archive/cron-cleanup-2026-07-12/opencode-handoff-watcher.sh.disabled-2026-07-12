#!/usr/bin/env bash
# opencode-handoff-watcher.sh — Trigger openclaw_handoff.py on session closures.
# Pure shell — no LLM. Reads opencode_sessions.jsonl tail, calls Python.
# Quiet unless new handoffs detected.

set -u

SESSION_TABLE="/root/A-FORGE/forge_work/opencode_sessions.jsonl"
STATE_FILE="/root/.openclaw/cron/runs/opencode-handoff.state.json"
SIGNAL_LOG="/root/.openclaw/cron/runs/opencode-handoff.jsonl"
PYTHON="/usr/bin/env python3"
HANDOFF_SCRIPT="/root/A-FORGE/forge_work/openclaw_handoff.py"

mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null

# Current line count in session table
current_lines=0
if [[ -f "$SESSION_TABLE" ]]; then
    current_lines=$(wc -l < "$SESSION_TABLE" 2>/dev/null || echo 0)
fi
current_lines=${current_lines:-0}

# Prior line count from state file
prior_lines=0
if [[ -f "$STATE_FILE" ]]; then
    prior_lines=$(jq -r '.last_line // 0' "$STATE_FILE" 2>/dev/null || echo 0)
fi
prior_lines=${prior_lines:-0}

# Process delta only
if [[ $current_lines -gt $prior_lines ]]; then
    "$PYTHON" "$HANDOFF_SCRIPT" "$prior_lines" \
        >> /root/.openclaw/cron/runs/opencode-handoff.cron.log 2>&1

    # Save state
    jq -nc --argjson last_line "$current_lines" \
        '{last_line: $last_line, ts: (now | todate)}' \
        > "$STATE_FILE" 2>/dev/null

    # Emit signal
    entry=$(jq -nc \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg detail "lines ${prior_lines}->${current_lines}" \
        '{ts: $ts, actor: "openclaw-handoff-watcher", trigger: "handoff_processed", detail: $detail}')
    echo "$entry" >> "$SIGNAL_LOG"
fi
# Quiet otherwise — no output when nothing to do
