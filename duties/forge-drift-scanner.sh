#!/usr/bin/env bash
# FORGE DUTY 1: Drift Scanner — runs 10:00 MYT (02:00 UTC)
# Silent when clean. Reports only when drift > threshold.
# F2 TRUTH: every signal labeled OBS (observed from live probe).
# F4 CLARITY: ΔS ≤ 0 — this report reduces entropy.

set -euo pipefail

TODAY=$(date +%Y-%m-%d)
LOG_DIR="/root/A-FORGE/duties/logs/${TODAY}"
REPORT="${LOG_DIR}/drift-scanner-$(date +%H%M).md"
mkdir -p "$LOG_DIR"

DRIFT_FOUND=0
FINDINGS=""

# ── 1. ORGAN HEALTH PROBE ─────────────────────────────────────────────
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  name="${svc%%:*}"; port="${svc##*:}"
  if ! curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    FINDINGS="${FINDINGS}  ❌ ${name} :${port} — DOWN
"
    DRIFT_FOUND=1
  fi
done

# ── 2. GIT SHA DRIFT (source vs runtime) ────────────────────────────────
check_drift() {
  local organ=$1 src=$2 runtime_file=$3
  local src_sha runtime_sha
  src_sha=$(git -C "$src" rev-parse --short=7 HEAD 2>/dev/null || echo "UNKNOWN")
  runtime_sha=$(cat "$runtime_file" 2>/dev/null || echo "UNKNOWN")
  if [ "$src_sha" != "UNKNOWN" ] && [ "$runtime_sha" != "UNKNOWN" ] && [ "$src_sha" != "$runtime_sha" ]; then
    FINDINGS="${FINDINGS}  ⚠️  ${organ} DRIFT: src=${src_sha} runtime=${runtime_sha}
"
    DRIFT_FOUND=1
  fi
}

check_drift "arifOS" "/root/arifOS" "/opt/arifos/app/.git_commit" 2>/dev/null || true

# ── 3. PORT DRIFT (unexpected public ports) ─────────────────────────────
KNOWN_PORTS="22 80 443 3001 7071 7072 8081 8088 18082 18083"
UNKNOWN_PORTS=""
while IFS= read -r line; do
  port=$(echo "$line" | awk '{print $4}' | grep -oP ':\K[0-9]+$' || true)
  [ -z "$port" ] && continue
  found=0
  for kp in $KNOWN_PORTS; do
    [ "$port" = "$kp" ] && found=1 && break
  done
  [ "$found" = "0" ] && UNKNOWN_PORTS="${UNKNOWN_PORTS} ${port}"
done < <(ss -tlnp 2>/dev/null | tail -n +2)

if [ -n "$UNKNOWN_PORTS" ]; then
  FINDINGS="${FINDINGS}  ⚠️  UNKNOWN_PUBLIC_PORTS:${UNKNOWN_PORTS}
"
  DRIFT_FOUND=1
fi

# ── 4. CONTAINER HEALTH ────────────────────────────────────────────────
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$UNHEALTHY" ]; then
  FINDINGS="${FINDINGS}  ❌ UNHEALTHY_CONTAINERS: ${UNHEALTHY}
"
  DRIFT_FOUND=1
fi

# ── 5. DISK/MEMORY THRESHOLD ───────────────────────────────────────────
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 80 ]; then
  FINDINGS="${FINDINGS}  🔴 DISK_USAGE: ${DISK_PCT}%
"
  DRIFT_FOUND=1
fi

MEM_PCT=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}')
if [ "$MEM_PCT" -gt 90 ]; then
  FINDINGS="${FINDINGS}  🔴 MEMORY_USAGE: ${MEM_PCT}%
"
  DRIFT_FOUND=1
fi

# ── 6. IDENTITY DRIFT (carry_forward.json) ─────────────────────────────
CF="/root/.local/share/arifos/carry_forward.json"
if [ -f "$CF" ]; then
  DRIFT_STATE=$(python3 -c "import json; d=json.load(open('$CF')); print(d.get('identity_drift','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
  if [ "$DRIFT_STATE" = "DRIFT" ]; then
    FINDINGS="${FINDINGS}  🔴 IDENTITY_DRIFT: DRIFT — check carry_forward.json
"
    DRIFT_FOUND=1
  fi
fi

# ── REPORT ──────────────────────────────────────────────────────────────
if [ "$DRIFT_FOUND" = "1" ]; then
  cat > "$REPORT" <<EOF
# 🔥 FORGE · Drift Scanner — ${TODAY} $(date +%H:%M) MYT

**Status: DRIFT DETECTED**
**F2 label: OBS** (live probe)

## Findings

${FINDINGS}

## Action Required

Review findings above. Silent when clean — this report exists because drift was found.

---
*FORGE (000Ω) · Drift Scanner · autonomous duty*
*DITEMPA BUKAN DIBERI*
EOF
  echo "[DRIFT] ${REPORT}"
  
  # ── TELEGRAM NOTIFY (only on findings) ─────────────────────────────
  NOTIFY_MSG="🔥 *FORGE · Drift Scanner*
${TODAY} $(date +%H:%M) MYT

*Status: DRIFT DETECTED*

$(echo -e "${FINDINGS}")

Review: \`${REPORT}\`"
  /root/A-FORGE/duties/forge-notify.sh "$NOTIFY_MSG" 2>/dev/null || true
else
  echo "[CLEAN] $(date +%Y-%m-%dT%H:%M:%S) — no drift detected"
fi
