#!/usr/bin/env bash
# identity-drift-watchdog.sh
# Detects silent drift in the 11 auto-loaded identity files.
# Compares live sha256 to sealed baseline; logs PASS or DRIFT.
# Tier 2 of zen-flow: "Errors should never pass silently."
# Tier 3 of zen-flow: emits carry_forward.json — auto-recall substrate for next wake.
#
# Session anchor: SEAL-2751ad53b5d04c50  |  Sealed: 2026-07-05T07:51Z
# Author: opencode-333 (FORGE)  |  Authority: MUBAH (digital ops)
# Schedule: every 5 min via root crontab
# Outputs:
#   /var/log/arifos/identity-drift.log      per-cycle PASS/DRIFT record
#   /root/A-FORGE/forge_work/identity-drift-watchdog/DRIFT.flag.json   alarm file
#   /root/.local/share/arifos/carry_forward.json                       wake-on context for next agent
set -euo pipefail

BASELINE="/root/.local/share/arifos/identity-fingerprint-baseline.sha256"
LIVE="/tmp/identity-fingerprint.live.sha256"
LOG="/var/log/arifos/identity-drift.log"
FLAG_DIR="/root/A-FORGE/forge_work/identity-drift-watchdog"
FLAG="$FLAG_DIR/DRIFT.flag.json"
CARRY="/root/.local/share/arifos/carry_forward.json"
VAULT="/root/.local/share/arifos/vault999"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 11 identity files (must match baseline order exactly)
FILES=(
  /root/AAA/agents/opencode/AGENTS.md
  /root/AAA/agents/opencode/SOUL.md
  /root/AAA/agents/opencode/TOOLS.md
  /root/AAA/agents/opencode/IDENTITY.md
  /root/AAA/agents/opencode/BOOTSTRAP.md
  /root/AAA/agents/opencode/HEARTBEAT.md
  /root/.openclaw/workspace/USER.md
  /root/.agents/skills/CONSTITUTIONAL_REFLEX/SKILL.md
  /root/.agents/skills/shadow-diagnostic/SKILL.md
  /root/.agents/skills/000-init-intent-classify/SKILL.md
  /root/AAA/skills/reflective/README.md
)

# === TIER 2: Compute live hashes ===
{
  for f in "${FILES[@]}"; do
    if [ -f "$f" ]; then
      sha256sum "$f"
    else
      echo "MISSING  $f"
    fi
  done
} > "$LIVE"

BASELINE_HASHES=$(grep '^[a-f0-9]' "$BASELINE" | sort)
LIVE_HASHES=$(grep '^[a-f0-9]' "$LIVE" | sort)

DRIFT_STATE="PASS"
if [ "$BASELINE_HASHES" != "$LIVE_HASHES" ]; then
  DRIFT_STATE="DRIFT"
  echo "$TS  drift_check=DRIFT  files=11/11" >> "$LOG"
  diff "$BASELINE" "$LIVE" >> "$LOG" || true
  mkdir -p "$FLAG_DIR"
  cat > "$FLAG" <<EOF
{
  "detected_at": "$TS",
  "session_anchor": "SEAL-2751ad53b5d04c50",
  "baseline": "$BASELINE",
  "diff_kind": "hash_mismatch",
  "action": "next_arif_init_must_surface"
}
EOF
else
  echo "$TS  drift_check=PASS  files=11/11" >> "$LOG"
  rm -f "$FLAG"
fi

# === TIER 3: Emit carry_forward.json — single-file wake-on context ===
# Reuses existing substrate: VAULT999 (seal_chain, never_repeat, scars, sessions)
# No new data sources invented. Read-only observation + JSON assembly.

# Last session anchor from seal_chain head (most recent SEAL)
LAST_SEAL_TMP=$(mktemp)
tail -1 "$VAULT/seal_chain.jsonl" > "$LAST_SEAL_TMP" 2>/dev/null || echo '{}' > "$LAST_SEAL_TMP"
SESSION_ANCHOR=$(jq -r '.payload.constitutional_chain_id // .constitutional_chain_id // "unknown"' "$LAST_SEAL_TMP" 2>/dev/null || echo "unknown")
LAST_ACTOR=$(jq -r '.actor // "unknown"' "$VAULT/seal_chain_head.json" 2>/dev/null || echo "unknown")
LAST_VERDICT=$(jq -r '.verdict // "unknown"' "$VAULT/seal_chain_head.json" 2>/dev/null || echo "unknown")
LAST_EPOCH=$(jq -r '.epoch // "unknown"' "$VAULT/seal_chain_head.json" 2>/dev/null || echo "unknown")
rm -f "$LAST_SEAL_TMP"

# Last 3 seal_chain entries
RECENT_SEALS=$(tail -3 "$VAULT/seal_chain.jsonl" 2>/dev/null | python3 -c "
import json, sys
out = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        out.append({
            'seq': d.get('seq'),
            'actor': d.get('actor', '?'),
            'verdict': d.get('verdict', '?')
        })
    except Exception:
        pass
print(json.dumps(out, indent=2))
" 2>/dev/null || echo "[]")

# NEVER patterns (from never_repeat.jsonl)
NEVER_PATTERNS=$(python3 -c "
import json, os
fp = '$VAULT/never_repeat.jsonl'
out = []
if os.path.exists(fp):
    with open(fp) as f:
        for line in f:
            try:
                d = json.loads(line)
                out.append({
                    'pattern': d.get('pattern', '?'),
                    'severity': d.get('severity', '?'),
                    'reason': d.get('reason', ''),
                    'sealed_at': d.get('sealed_at', '')
                })
            except Exception:
                pass
print(json.dumps(out, indent=2))
" 2>/dev/null || echo "[]")

# Active scars — with first-line lesson + floor mapping (APEX: scar→floor bridge)
SCARS_DIR="$VAULT/scars"
if [ -d "$SCARS_DIR" ]; then
  SCARS_COUNT=$(ls "$SCARS_DIR" 2>/dev/null | wc -l)
  SCARS_DIRS=$(ls "$SCARS_DIR" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
else
  SCARS_COUNT=0
  SCARS_DIRS=""
fi

# APEX-level scar surface: each scar dir → first markdown line + floors it cites
# Delegated to scar_surface.py (clean separation, no bash quoting hell)
SCAR_SURFACE=$(python3 /root/A-FORGE/forge_work/scar_surface.py 2>/dev/null || echo "[]")

# Prior session summary (from latest session-*.md)
LAST_SESSION_FILE=$(ls -t "$VAULT"/session-*.md 2>/dev/null | head -1 || true)
if [ -n "$LAST_SESSION_FILE" ]; then
  LAST_SESSION_NAME=$(basename "$LAST_SESSION_FILE")
  LAST_SESSION_INTENT=$(grep -E "^\- \*\*intent\*\*:|intent:" "$LAST_SESSION_FILE" 2>/dev/null | head -1 | sed 's/^.*: //;s/^.*\*\*//;s/\*\*.*$//' | tr -d '\n')
  LAST_SESSION_DATE=$(echo "$LAST_SESSION_NAME" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -1)
else
  LAST_SESSION_NAME=""
  LAST_SESSION_INTENT=""
  LAST_SESSION_DATE=""
fi

# Next safe action — computed from drift state
if [ "$DRIFT_STATE" = "DRIFT" ]; then
  NEXT_SAFE_ACTION="ADDRESS_DRIFT_BEFORE_PROCEED"
else
  NEXT_SAFE_ACTION="PROCEED_OR_SABAR"
fi

# Assemble carry_forward.json — single source of truth for wake-on context
cat > "$CARRY" <<EOF
{
  "generated_at": "$TS",
  "session_anchor": "$SESSION_ANCHOR",
  "last_seal": {
    "actor": "$LAST_ACTOR",
    "verdict": "$LAST_VERDICT",
    "epoch": "$LAST_EPOCH"
  },
  "identity_drift": "$DRIFT_STATE",
  "next_safe_action": "$NEXT_SAFE_ACTION",
  "prior_session": {
    "file": "$LAST_SESSION_NAME",
    "date": "$LAST_SESSION_DATE",
    "intent": "$LAST_SESSION_INTENT"
  },
  "active_scars": {
    "count": $SCARS_COUNT,
    "directories": "$SCARS_DIRS",
    "surface": $SCAR_SURFACE
  },
  "never_patterns": $NEVER_PATTERNS,
  "recent_seals": $RECENT_SEALS,
  "wake_protocol": "Read /root/CONTEXT.md + /root/.claude/projects/-root/memory/session-state.md + this file. Identity drift MUST be PASS before any irreversible action."
}
EOF

echo "$TS  carry_forward_emitted  drift=$DRIFT_STATE  scars=$SCARS_COUNT  never=$(echo "$NEVER_PATTERNS" | python3 -c "import json,sys;print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)" >> "$LOG"

if [ "$DRIFT_STATE" = "DRIFT" ]; then
  exit 1
fi
exit 0