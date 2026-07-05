#!/usr/bin/env bash
# self-heal-watchdog.sh
# Tier 4 of zen-flow: "Governance should be executable" — last ritual closed.
# Probes each organ/container against machine_constitution.json, restarts dead ones
# (within allowlist + cooldown + risk policy), writes receipt.
#
# Session anchor: INIT_PROMPT_AF_FORGE::v1.0.0::SEALED::2026-07-05T07:45Z
# Author: opencode-333 (FORGE)  |  Authority: MUBAH (digital ops, F13 SOVEREIGN override)
# Schedule: every 5 min via root crontab
# Outputs:
#   /var/log/arifos/self-heal.log           per-cycle record
#   /root/.local/share/arifos/self-heal-RECEIPT.md   audit trail (append-only)
#   /root/.local/share/arifos/self-heal-cooldown.json   per-organ cooldown state
#   /root/.local/share/arifos/self-heal-HOLD.json   failure escalation (if any)
set -euo pipefail

CONSTITUTION="/root/.local/share/arifos/machine_constitution.json"
RECEIPT="/root/.local/share/arifos/self-heal-RECEIPT.md"
COOLDOWN_FILE="/root/.local/share/arifos/self-heal-cooldown.json"
HOLD_FILE="/root/.local/share/arifos/self-heal-HOLD.json"
LOG="/var/log/arifos/self-heal.log"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ ! -f "$CONSTITUTION" ]; then
  echo "$TS  SELF_HEAL  FAIL  constitution_missing" >> "$LOG"
  exit 0  # not an error — the system just isn't initialized yet
fi

# Load cooldown state
if [ -f "$COOLDOWN_FILE" ]; then
  COOLDOWN_DATA=$(cat "$COOLDOWN_FILE")
else
  COOLDOWN_DATA='{}'
fi

CHECKS_RUN=0
RESTARTS_ATTEMPTED=0
RESTARTS_SUCCEEDED=0
FAILURES=0

# Helper: check if organ is in cooldown
in_cooldown() {
  local organ="$1"
  local cooldown_min="$2"
  local last_attempt=$(echo "$COOLDOWN_DATA" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('$organ',''))" 2>/dev/null || echo "")
  if [ -z "$last_attempt" ]; then return 1; fi
  local last_epoch=$(date -u -d "$last_attempt" +%s 2>/dev/null || echo 0)
  local now_epoch=$(date -u +%s)
  local diff_min=$(( (now_epoch - last_epoch) / 60 ))
  if [ "$diff_min" -lt "$cooldown_min" ]; then return 0; fi
  return 1
}

record_cooldown() {
  local organ="$1"
  COOLDOWN_DATA=$(echo "$COOLDOWN_DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['$organ'] = '$TS'
print(json.dumps(d))
")
}

# Check one organ
check_organ() {
  local organ_def="$1"
  local name=$(echo "$organ_def" | jq -r '.name')
  local svc=$(echo "$organ_def" | jq -r '.service')
  local hc_method=$(echo "$organ_def" | jq -r '.healthcheck.method')
  local hc_url=$(echo "$organ_def" | jq -r '.healthcheck.url // ""')
  local hc_expect_key=$(echo "$organ_def" | jq -r '.healthcheck.expect_key // ""')
  local hc_expect=$(echo "$organ_def" | jq -r '.healthcheck.expect // ""')
  local restart_cmd=$(echo "$organ_def" | jq -r '.restart.command')
  local restart_risk=$(echo "$organ_def" | jq -r '.restart.risk')
  local cooldown_min=$(echo "$organ_def" | jq -r '.cooldown_minutes')

  CHECKS_RUN=$((CHECKS_RUN + 1))

  # Health probe
  local alive=0
  case "$hc_method" in
    http)
      local code
      code=$(curl -sf -m 5 -o /tmp/self-heal-body.json -w "%{http_code}" "$hc_url" 2>/dev/null || echo "000")
      if [ "$code" = "200" ]; then
        if [ -n "$hc_expect_key" ]; then
          local actual=$(jq -r ".$hc_expect_key // \"\"" /tmp/self-heal-body.json 2>/dev/null)
          [ -n "$actual" ] && alive=1
        else
          alive=1
        fi
      fi
      ;;
    systemd_active)
      systemctl is-active --quiet "$svc" 2>/dev/null && alive=1
      ;;
    docker)
      docker ps --filter "name=$hc_expect" --format '{{.Names}}' 2>/dev/null | grep -q . && alive=1
      ;;
  esac

  if [ "$alive" = "1" ]; then
    echo "$TS  PASS  $name" >> "$LOG"
    return 0
  fi

  # DEAD — check policy before restart
  if in_cooldown "$name" "$cooldown_min"; then
    echo "$TS  HOLD  $name  in_cooldown(${cooldown_min}m)" >> "$LOG"
    return 0
  fi

  if [ "$restart_risk" = "HIGH" ]; then
    echo "$TS  HOLD  $name  HIGH_risk_no_auto_restart" >> "$LOG"
    return 0
  fi

  # Restart
  RESTARTS_ATTEMPTED=$((RESTARTS_ATTEMPTED + 1))
  echo "$TS  RESTART  $name  cmd=$restart_cmd" >> "$LOG"

  if $restart_cmd >> "$LOG" 2>&1; then
    sleep 5  # let service come up
    # Re-probe
    local recheck=0
    case "$hc_method" in
      http)
        local code2
        code2=$(curl -sf -m 5 -o /dev/null -w "%{http_code}" "$hc_url" 2>/dev/null || echo "000")
        [ "$code2" = "200" ] && recheck=1
        ;;
      systemd_active)
        systemctl is-active --quiet "$svc" 2>/dev/null && recheck=1
        ;;
      docker)
        docker ps --filter "name=$hc_expect" --format '{{.Names}}' 2>/dev/null | grep -q . && recheck=1
        ;;
    esac
    if [ "$recheck" = "1" ]; then
      RESTARTS_SUCCEEDED=$((RESTARTS_SUCCEEDED + 1))
      record_cooldown "$name"
      echo "$TS  RECOVERED  $name" >> "$LOG"
    else
      FAILURES=$((FAILURES + 1))
      record_cooldown "$name"
      echo "$TS  RESTART_FAILED  $name" >> "$LOG"
    fi
  else
    FAILURES=$((FAILURES + 1))
    record_cooldown "$name"
    echo "$TS  RESTART_CMD_FAILED  $name" >> "$LOG"
  fi
}

# Process organs — use temp file to preserve counter variables (avoids subshell scoping bug)
echo "$COOLDOWN_DATA" > "$COOLDOWN_FILE"  # write back any updates from previous runs (idempotent)

ORGANS_JSON=$(mktemp)
jq -c '.organs[]' "$CONSTITUTION" > "$ORGANS_JSON"
while IFS= read -r organ; do
  check_organ "$organ"
done < "$ORGANS_JSON"
rm -f "$ORGANS_JSON"

# Process containers — use temp file to preserve counter variables
CONTAINERS_JSON=$(mktemp)
jq -c '.containers[]' "$CONSTITUTION" > "$CONTAINERS_JSON"
while IFS= read -r container; do
  CHECKS_RUN=$((CHECKS_RUN + 1))
  cname=$(echo "$container" | jq -r '.name')
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${cname}$"; then
    echo "$TS  PASS  container:$cname" >> "$LOG"
  else
    if in_cooldown "container:$cname" 15; then
      echo "$TS  HOLD  container:$cname  in_cooldown" >> "$LOG"
    else
      RESTARTS_ATTEMPTED=$((RESTARTS_ATTEMPTED + 1))
      echo "$TS  RESTART  container:$cname" >> "$LOG"
      if docker restart "$cname" >> "$LOG" 2>&1; then
        RESTARTS_SUCCEEDED=$((RESTARTS_SUCCEEDED + 1))
        record_cooldown "container:$cname"
        echo "$TS  RECOVERED  container:$cname" >> "$LOG"
      else
        FAILURES=$((FAILURES + 1))
        record_cooldown "container:$cname"
        echo "$TS  RESTART_FAILED  container:$cname" >> "$LOG"
      fi
    fi
  fi
done < "$CONTAINERS_JSON"
rm -f "$CONTAINERS_JSON"

# Write cooldown state back
echo "$COOLDOWN_DATA" > "$COOLDOWN_FILE"

# Append to RECEIPT
cat >> "$RECEIPT" <<EOF
## $TS — cycle complete
- checks_run: $CHECKS_RUN
- restarts_attempted: $RESTARTS_ATTEMPTED
- restarts_succeeded: $RESTARTS_SUCCEEDED
- failures: $FAILURES

EOF

# If failures, write HOLD file
if [ "$FAILURES" -gt 0 ]; then
  cat > "$HOLD_FILE" <<EOF
{
  "held_at": "$TS",
  "failures": $FAILURES,
  "action": "manual_intervention_required",
  "log_tail": "$(tail -10 "$LOG" | tr '\n' '|')"
}
EOF
  echo "$TS  SELF_HEAL  HOLD  failures=$FAILURES" >> "$LOG"
fi

echo "$TS  SELF_HEAL  cycle_done  checks=$CHECKS_RUN restarts=$RESTARTS_ATTEMPTED/$RESTARTS_SUCCEEDED failures=$FAILURES" >> "$LOG"
exit 0