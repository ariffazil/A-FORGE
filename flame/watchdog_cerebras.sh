#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# FLAME Cerebras Credit Watchdog — F1 AMANAH Protection
# ═══════════════════════════════════════════════════════════════════════════
# Forged: 2026-07-25 · Authority: T1 AUTO-DO · Risk: REVERSIBLE (config only)
#
# Cerebras $5 prepaid credit expires Aug 20, 2026.
# This watchdog runs every 15 minutes via cron. It:
#   1. Pings Cerebras API — if 401/402/403 → credit EXHAUSTED
#   2. Checks hard deadline — if past Aug 20 → auto-remove
#   3. Tracks consecutive failures — if 5+ → demote from chain
#   4. Writes decision to FLAME event log
#
# DITEMPA BUKAN DIBERI — Forged, Not Given.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────
CEREBRAS_KEY="${CEREBRAS_API_KEY:-}"
WATCHDOG_STATE="/root/.local/share/flame/watchdog_cerebras.json"
FLAME_CONFIG="/root/A-FORGE/flame/flame_config.json"
FLAME_EVENT_LOG="/root/.local/share/flame/flame_events.jsonl"
DEADLINE="2026-08-20T23:59:59Z"
DEADLINE_EPOCH=$(date -d "$DEADLINE" +%s 2>/dev/null || echo 2147483647)

# ── Load secrets if needed ──────────────────────────────────────────────
if [ -z "$CEREBRAS_KEY" ] && [ -f /root/.secrets/vault.env ]; then
    source <(grep CEREBRAS_API_KEY /root/.secrets/vault.env | sed 's/export //')
fi

if [ -z "$CEREBRAS_KEY" ]; then
    echo "[WATCHDOG] ❌ CEREBRAS_API_KEY not found in env or vault"
    exit 1
fi

# ── State file ──────────────────────────────────────────────────────────
mkdir -p "$(dirname "$WATCHDOG_STATE")"
if [ ! -f "$WATCHDOG_STATE" ]; then
    echo '{"consecutive_fails":0,"last_check":"","status":"ACTIVE","demoted":false,"removed":false,"actions":[]}' > "$WATCHDOG_STATE"
fi

STATE=$(cat "$WATCHDOG_STATE")
CONSEC_FAILS=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('consecutive_fails',0))")
DEMOTED=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('demoted',False))")
REMOVED=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('removed',False))")

NOW_EPOCH=$(date +%s)
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ACTION="none"
REASON=""

# ── Gate 1: Hard Deadline ───────────────────────────────────────────────
if [ "$NOW_EPOCH" -gt "$DEADLINE_EPOCH" ]; then
    if [ "$REMOVED" != "True" ]; then
        ACTION="remove"
        REASON="Credit expiry deadline passed ($DEADLINE). Cerebras removed from FLAME chain."
    fi
fi

# ── Gate 2: API Liveness Check ──────────────────────────────────────────
if [ "$ACTION" = "none" ] && [ "$REMOVED" != "True" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://api.cerebras.ai/v1/models" \
        -H "Authorization: Bearer $CEREBRAS_KEY" \
        --connect-timeout 10 --max-time 15 2>/dev/null || echo "000")

    case "$HTTP_CODE" in
        200)
            # API healthy — reset fail counter
            CONSEC_FAILS=0
            ;;
        401|403)
            # Key revoked or expired
            ACTION="remove"
            REASON="Cerebras API returned HTTP $HTTP_CODE — key revoked or expired."
            ;;
        402)
            # Payment required — credit exhausted
            ACTION="remove"
            REASON="Cerebras API returned HTTP 402 — credit exhausted or payment required."
            ;;
        429)
            # Rate limited — don't count as failure, just note
            ACTION="note"
            REASON="Cerebras rate-limited (HTTP 429). Skipping this cycle."
            ;;
        *)
            # Other failure — increment counter
            CONSEC_FAILS=$((CONSEC_FAILS + 1))
            if [ "$CONSEC_FAILS" -ge 5 ] && [ "$DEMOTED" != "True" ]; then
                ACTION="demote"
                REASON="Cerebras failed $CONSEC_FAILS consecutive health checks. Auto-demoting."
            fi
            ;;
    esac
fi

# ── Execute action ──────────────────────────────────────────────────────
case "$ACTION" in
    remove)
        echo "[WATCHDOG $(date)] 🚫 REMOVING Cerebras from FLAME chain: $REASON"
        
        # Remove all Cerebras tiers from the chain
        python3 -c "
import json
with open('$FLAME_CONFIG') as f:
    c = json.load(f)
tiers = c['chains']['RM0-TOOLS-FREELOOP']['tiers']
before = len(tiers)
c['chains']['RM0-TOOLS-FREELOOP']['tiers'] = [
    t for t in tiers if t['provider'] != 'cerebras'
]
after = len(c['chains']['RM0-TOOLS-FREELOOP']['tiers'])
with open('$FLAME_CONFIG', 'w') as f:
    json.dump(c, f, indent=2)
print(f'Removed {before - after} Cerebras tiers. {after} tiers remain.')
"
        # Update state
        python3 -c "
import json
s = json.load(open('$WATCHDOG_STATE'))
s['removed'] = True
s['demoted'] = True
s['last_check'] = '$NOW_ISO'
s.setdefault('actions', []).append({'time': '$NOW_ISO', 'action': 'remove', 'reason': '$REASON'})
json.dump(s, open('$WATCHDOG_STATE', 'w'), indent=2)
"
        # Log event
        echo "{\"event\":\"cerebras_watchdog_remove\",\"time\":\"$NOW_ISO\",\"reason\":\"$REASON\",\"consecutive_fails\":$CONSEC_FAILS}" >> "$FLAME_EVENT_LOG"
        
        # Restart FLAME to pick up config change
        systemctl restart flame.service 2>/dev/null || true
        ;;
        
    demote)
        echo "[WATCHDOG $(date)] ⚠️ DEMOTING Cerebras in FLAME chain: $REASON"
        
        # Set all Cerebras tier weights to 0 (demoted but still in config)
        python3 -c "
import json
with open('$FLAME_CONFIG') as f:
    c = json.load(f)
for t in c['chains']['RM0-TOOLS-FREELOOP']['tiers']:
    if t['provider'] == 'cerebras':
        t['weight'] = 0
        t.setdefault('tags', []).append('demoted-by-watchdog')
with open('$FLAME_CONFIG', 'w') as f:
    json.dump(c, f, indent=2)
print('Cerebras tiers demoted (weight=0).')
"
        # Update state
        python3 -c "
import json
s = json.load(open('$WATCHDOG_STATE'))
s['demoted'] = True
s['consecutive_fails'] = $CONSEC_FAILS
s['last_check'] = '$NOW_ISO'
s.setdefault('actions', []).append({'time': '$NOW_ISO', 'action': 'demote', 'reason': '$REASON'})
json.dump(s, open('$WATCHDOG_STATE', 'w'), indent=2)
"
        # Log event
        echo "{\"event\":\"cerebras_watchdog_demote\",\"time\":\"$NOW_ISO\",\"reason\":\"$REASON\",\"consecutive_fails\":$CONSEC_FAILS}" >> "$FLAME_EVENT_LOG"
        ;;
        
    note)
        echo "[WATCHDOG $(date)] 📝 NOTE: $REASON"
        ;;
        
    none|*)
        # All healthy — update state, nothing to do
        python3 -c "
import json
s = json.load(open('$WATCHDOG_STATE'))
s['consecutive_fails'] = $CONSEC_FAILS
s['last_check'] = '$NOW_ISO'
s['status'] = 'ACTIVE'
json.dump(s, open('$WATCHDOG_STATE', 'w'), indent=2)
" 2>/dev/null || true
        ;;
esac

echo "[WATCHDOG $(date)] Status: status=${ACTION:-healthy} fails=${CONSEC_FAILS} demoted=${DEMOTED} removed=${REMOVED}"
