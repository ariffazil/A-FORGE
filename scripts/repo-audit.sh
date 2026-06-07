#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# arifOS Federation — Weekly Repo Steward Audit (Ω — 2026-06-07)
#
# Schedule: Mon 09:00 MYT (01:00 UTC) — per WORKFLOW_REPO_STEWARD.md
# Wired in:  /etc/cron.d/arifos-repo-audit
# Source:    /root/A-FORGE/WORKFLOWS/WORKFLOW_REPO_STEWARD.md
#
# Calls 4 A-FORGE /api/repo-steward/* endpoints, logs to /var/log/arifos/,
# and fires 888_HOLD via NATS if any verdict is RED.
#
# A-FORGE observes. This script observes A-FORGE. A human or 888_HOLD
# approver decides what to do with the result. The script never deletes,
# mutates, or pushes.
# ════════════════════════════════════════════════════════════════════════════

set -u  # do not use -e — we want all 4 endpoints to run even if one fails

LOG_DIR="/var/log/arifos"
LOG_FILE="${LOG_DIR}/repo-audit.log"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BASE="http://127.0.0.1:7071/api/repo-steward"
TIMEOUT=15

mkdir -p "$LOG_DIR" || { echo "[FATAL] cannot mkdir $LOG_DIR" >&2; exit 1; }

log() { echo "[$TS] $*" | tee -a "$LOG_FILE"; }

log "════════════════════════════════════════════════════════════"
log "arifOS Federation Repo Steward Audit — weekly (Mon 09:00 MYT)"
log "════════════════════════════════════════════════════════════"

# Quick preflight — is A-FORGE up?
if ! curl -sf --max-time 3 "${BASE%/api/repo-steward}/health" >/dev/null 2>&1; then
  log "[RED] A-FORGE not reachable on :7071 — cannot audit"
  fire_888_hold "A-FORGE_DOWN" "A-FORGE :7071 unreachable during weekly repo audit"
  exit 1
fi

OVERALL=0   # 0 = GREEN, 1 = YELLOW, 2 = RED
RED_ORGANS=()

# ─── helper: fire 888_HOLD via NATS ───
# Subject: arifos.events.governance.888_hold
# Payload: JSON {kind, reason, source, ts, organs[]}
# Pure publish, no ack. If nats CLI not installed, logs only.
fire_888_hold() {
  local KIND="$1" REASON="$2"
  local PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'kind': '$KIND',
  'reason': '''$REASON''',
  'source': 'repo-audit.sh (Mon 09:00 MYT weekly)',
  'ts': '$TS',
  'organs': [$(printf '"%s",' "${RED_ORGANS[@]:-}" | sed 's/,$//')]
}))
")
  if command -v nats >/dev/null 2>&1; then
    echo "$PAYLOAD" | nats -s localhost pub arifos.events.governance.888_hold 2>>"$LOG_FILE" || \
      log "[WARN] NATS publish failed — 888_HOLD not delivered"
  else
    log "[WARN] nats CLI not found — 888_HOLD not delivered. Payload: $PAYLOAD"
  fi
}

for ep in sot-validator registry-trinity repo-entropy steward-suggest; do
  log ""
  log "─── $ep ───"
  RESP=$(curl -sf --max-time $TIMEOUT "$BASE/$ep" 2>&1) || {
    log "[FAIL] $ep: curl error"
    RED_ORGANS+=("$ep (curl)")
    OVERALL=2
    continue
  }
  VERDICT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('verdict','?'))" 2>/dev/null || echo "PARSE_FAIL")
  OK=$(echo "$RESP"    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','?'))" 2>/dev/null || echo "?")
  log "  verdict: $VERDICT  ok: $OK"

  # Compact per-endpoint summary
  case "$ep" in
    sot-validator)
      SUMM=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); s=d.get('summary',{}); print('reachable={reachable}/{total} down={down} zero={zero} no_count_key={no_count_key}'.format(**s))" 2>/dev/null)
      [ -n "$SUMM" ] && log "  $SUMM"
      ;;
    registry-trinity)
      DRIFT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); dr=d.get('drift',{}); print('canonical={canonical_live} v2_live={v2_live} archive_live={archive_live} mirror={mirror_count}'.format(**dr))" 2>/dev/null)
      [ -n "$DRIFT" ] && log "  $DRIFT"
      MISMATCHES=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(' | '.join(d.get('drift',{}).get('mismatches',[])))" 2>/dev/null)
      [ -n "$MISMATCHES" ] && [ "$MISMATCHES" != "" ] && log "  mismatches: $MISMATCHES"
      ;;
    repo-entropy)
      SCORE=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('entropy_score','?'))" 2>/dev/null)
      TOTALS=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); t=d.get('totals',{}); print('dirty={dirty} unpushed={unpushed} bak={bak} tmp={tmp}'.format(**t))" 2>/dev/null)
      log "  entropy_score: $SCORE/100"
      [ -n "$TOTALS" ] && log "  $TOTALS"
      ;;
    steward-suggest)
      N=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('suggested_actions',[])))" 2>/dev/null)
      log "  suggested_actions: $N (non-executing; A-FORGE observes only)"
      ;;
  esac

  # Aggregate
  case "$VERDICT" in
    RED)    OVERALL=2; RED_ORGANS+=("$ep") ;;
    YELLOW) [ "$OVERALL" -lt 1 ] && OVERALL=1 ;;
    GREEN)  ;;
  esac
done

log ""
log "════════════════════════════════════════════════════════════"
case "$OVERALL" in
  0) log "OVERALL: GREEN — federation entropy healthy" ;;
  1) log "OVERALL: YELLOW — drift detected, non-blocking" ;;
  2)
    log "OVERALL: RED — entropy exceeded threshold"
    log "Red organs: ${RED_ORGANS[*]}"
    fire_888_hold "REPO_ENTROPY_RED" "Federation repo audit RED. Organs: ${RED_ORGANS[*]}. See ${LOG_FILE} for details."
    ;;
esac
log "════════════════════════════════════════════════════════════"
log ""

exit $OVERALL
