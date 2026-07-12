#!/usr/bin/env bash
# FORGE DUTY 3: Vitality Pulse — runs 23:00 MYT (15:00 UTC)
# Nightly forge intelligence summary.
# Always delivers. Includes: vitality, entropy, contradictions, drift, scars, recommendations.
# F2 TRUTH: every metric labeled OBS/DER.
# F4 CLARITY: ΔS ≤ 0 — this report reduces entropy.

set -euo pipefail

TODAY=$(date +%Y-%m-%d)
LOG_DIR="/root/A-FORGE/duties/logs/${TODAY}"
REPORT="${LOG_DIR}/vitality-pulse-$(date +%H%M).md"
mkdir -p "$LOG_DIR"

# ── 1. ORGAN VITALITY ──────────────────────────────────────────────────
TOTAL_ORGANS=6
ALIVE=0
ORGAN_TABLE=""

for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  name="${svc%%:*}"; port="${svc##*:}"
  start_ns=$(date +%s%N)
  if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    end_ns=$(date +%s%N)
    latency=$(( (end_ns - start_ns) / 1000000 ))
    ORGAN_TABLE="${ORGAN_TABLE}| ${name} | ✅ UP | ${latency}ms |
"
    ALIVE=$((ALIVE + 1))
  else
    ORGAN_TABLE="${ORGAN_TABLE}| ${name} | ❌ DOWN | — |
"
  fi
done

VITALITY_PCT=$((ALIVE * 100 / TOTAL_ORGANS))

# ── 2. ENTROPY SCORE ───────────────────────────────────────────────────
ENTROPY_SCORE=0
ENTROPY_DETAILS=""

# Uncommitted files across key repos
UNCOMMITTED=0
for repo in /root/arifOS /root/A-FORGE /root/AAA /root/geox /root/WEALTH /root/WELL; do
  if [ -d "$repo/.git" ]; then
    dirty=$(git -C "$repo" status --porcelain 2>/dev/null | wc -l)
    UNCOMMITTED=$((UNCOMMITTED + dirty))
  fi
done
if [ "$UNCOMMITTED" -gt 5 ]; then
  ENTROPY_SCORE=$((ENTROPY_SCORE + 2))
  ENTROPY_DETAILS="${ENTROPY_DETAILS}  ⚠️  ${UNCOMMITTED} uncommitted files across repos
"
fi

# Dead processes
DEAD_PROCS=$(ps aux 2>/dev/null | grep -c '[d]efunct' || true)
DEAD_PROCS=${DEAD_PROCS:-0}
if [ "$DEAD_PROCS" -gt 3 ]; then
  ENTROPY_SCORE=$((ENTROPY_SCORE + 1))
  ENTROPY_DETAILS="${ENTROPY_DETAILS}  ⚠️  ${DEAD_PROCS} zombie processes
"
fi

# Disk pressure
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 70 ]; then
  ENTROPY_SCORE=$((ENTROPY_SCORE + 1))
  ENTROPY_DETAILS="${ENTROPY_DETAILS}  ⚠️  Disk usage: ${DISK_PCT}%
"
fi

# Stale forge_work entries (older than 7 days)
STALE_WORK=$(find /root/A-FORGE/forge_work -maxdepth 1 -type d -mtime +7 2>/dev/null | wc -l)
if [ "$STALE_WORK" -gt 3 ]; then
  ENTROPY_SCORE=$((ENTROPY_SCORE + 1))
  ENTROPY_DETAILS="${ENTROPY_DETAILS}  ⚠️  ${STALE_WORK} stale forge_work directories (>7d)
"
fi

# Entropy band
if [ "$ENTROPY_SCORE" -le 1 ]; then
  ENTROPY_BAND="🟢 LOW (ΔS ≤ 0)"
elif [ "$ENTROPY_SCORE" -le 3 ]; then
  ENTROPY_BAND="🟡 MODERATE"
else
  ENTROPY_BAND="🔴 HIGH — action needed"
fi

# ── 3. CONTRADICTION COUNT ─────────────────────────────────────────────
CONTRADICTIONS=0
CONTRA_DETAILS=""

# Check for duplicate tool names across registries
DUPES=$(find /root/.agents/skills -name "SKILL.md" -exec grep -l "^name:" {} \; 2>/dev/null | \
  xargs grep "^name:" 2>/dev/null | awk -F: '{print $NF}' | sort | uniq -d | wc -l || true)
if [ "$DUPES" -gt 0 ]; then
  CONTRADICTIONS=$((CONTRADICTIONS + DUPES))
  CONTRA_DETAILS="${CONTRA_DETAILS}  ⚠️  ${DUPES} duplicate skill names detected
"
fi

# Check for broken cross-references (files referenced but not existing)
BROKEN_REFS=0
for ref in "/root/AAA/docs/deprecation-registry.json" "/root/AAA/docs/INVARIANTS.md" "/root/AAA/docs/TOOLREGISTRY.json"; do
  if [ ! -f "$ref" ]; then
    BROKEN_REFS=$((BROKEN_REFS + 1))
    CONTRA_DETAILS="${CONTRA_DETAILS}  ❌ Missing reference: ${ref}
"
  fi
done
CONTRADICTIONS=$((CONTRADICTIONS + BROKEN_REFS))

# ── 4. CAPABILITY DRIFT ────────────────────────────────────────────────
REGISTRY_FILE="/root/A-FORGE/a_think/federation_alignment_registry.json"
TOOL_COUNT="?"
if [ -f "$REGISTRY_FILE" ]; then
  TOOL_COUNT=$(python3 -c "import json; d=json.load(open('$REGISTRY_FILE')); print(len(d) if isinstance(d, list) else len(d.get('tools', d)))" 2>/dev/null || echo "?")
fi

# ── 5. AGENT LOAD ──────────────────────────────────────────────────────
# Federation runs as systemd services, not Docker containers
RUNNING_SERVICES=0
for svc in arifos.service a-forge.service aaa-a2a.service geox-mcp.service wealth-organ.service well.service; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    RUNNING_SERVICES=$((RUNNING_SERVICES + 1))
  fi
done
RUNNING_AGENTS=$RUNNING_SERVICES

# ── 6. REGISTRY SCARS ──────────────────────────────────────────────────
SCAR_DIR="/root/VAULT999"
SCAR_COUNT="0"
if [ -e "$SCAR_DIR" ]; then
  # Follow symlinks (VAULT999 is symlinked to /root/.local/share/arifos/vault999)
  SCAR_COUNT=$(find -L "$SCAR_DIR" -type f \( -name "*.jsonl" -o -name "*.json" \) 2>/dev/null | wc -l)
fi

# ── 7. RECOMMENDED NEXT ACTION ─────────────────────────────────────────
RECOMMENDATION="✅ System healthy. No immediate action required."

if [ "$ALIVE" -lt "$TOTAL_ORGANS" ]; then
  RECOMMENDATION="🔴 CRITICAL: $((TOTAL_ORGANS - ALIVE)) organ(s) down. Investigate immediately."
elif [ "$ENTROPY_SCORE" -gt 3 ]; then
  RECOMMENDATION="🟡 Entropy elevated. Run entropy-sweep to reduce chaos."
elif [ "$CONTRADICTIONS" -gt 0 ]; then
  RECOMMENDATION="🟡 ${CONTRADICTIONS} contradiction(s) detected. Review and resolve."
elif [ "$UNCOMMITTED" -gt 10 ]; then
  RECOMMENDATION="🟡 ${UNCOMMITTED} uncommitted files. Commit or stash to reduce entropy."
fi

# ── 8. VITALITY PEACE SCORE (VPS) ───────────────────────────────────────
VPS_OUTPUT=$(python3 /root/WELL/vps_compute.py --json 2>/dev/null || echo '{}')
VPS_SCORE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('score') or '—')" 2>/dev/null || echo "—")
VPS_BAND=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('band','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
VPS_VERDICT=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('verdict','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
VPS_H_STATE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['human']['state'])" 2>/dev/null || echo "UNKNOWN")
VPS_M_SCORE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['machine'].get('score','—'))" 2>/dev/null || echo "—")
VPS_M_STATE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['machine']['state'])" 2>/dev/null || echo "UNKNOWN")
VPS_G_SCORE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['governance'].get('score','—'))" 2>/dev/null || echo "—")
VPS_G_STATE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['governance']['state'])" 2>/dev/null || echo "UNKNOWN")
VPS_C_STATE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dimensions']['coupling']['state'])" 2>/dev/null || echo "UNKNOWN")
VPS_CAUSE=$(echo "$VPS_OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('primary_cause','Unknown'))" 2>/dev/null || echo "Unknown")

# ── REPORT ──────────────────────────────────────────────────────────────
cat > "$REPORT" <<EOF
# 🔥 FORGE · Vitality Pulse — ${TODAY} $(date +%H:%M) MYT

## Summary

| Metric | Value | Band |
|--------|-------|------|
| **Vitality** | ${VITALITY_PCT}% (${ALIVE}/${TOTAL_ORGANS}) | $([ "$VITALITY_PCT" -eq 100 ] && echo "🟢 OPTIMAL" || echo "🔴 DEGRADED") |
| **Entropy** | ${ENTROPY_SCORE}/6 | ${ENTROPY_BAND} |
| **Contradictions** | ${CONTRADICTIONS} | $([ "$CONTRADICTIONS" -eq 0 ] && echo "🟢 NONE" || echo "🟡 REVIEW") |
| **Registered Tools** | ${TOOL_COUNT} | — |
| **Running Services** | ${RUNNING_AGENTS} | — |
| **Vault999 Entries** | ${SCAR_COUNT} | — |

## Vitality Peace Score (VPS)

| Dimension | Score | State | Weight |
|-----------|-------|-------|--------|
| **Human** | — | ${VPS_H_STATE} | 0.40 |
| **Machine** | ${VPS_M_SCORE} | ${VPS_M_STATE} | 0.20 |
| **Governance** | ${VPS_G_SCORE} | ${VPS_G_STATE} | 0.25 |
| **Coupling** | — | ${VPS_C_STATE} | 0.15 |

**VPS: ${VPS_SCORE} — ${VPS_BAND}**
**Verdict: ${VPS_VERDICT}**
**Primary cause: ${VPS_CAUSE}**

**F2 label: OBS** (live probes) + **DER** (computed scores)

## Organ Vitals

| Organ | Status | Latency |
|-------|--------|---------|
${ORGAN_TABLE}
## Entropy Details

${ENTROPY_DETAILS:-  ✅ No entropy signals detected
}
## Contradiction Map

${CONTRA_DETAILS:-  ✅ No contradictions detected
}
## Capability Drift

- Registered tools: ${TOOL_COUNT}
- Uncommitted files across repos: ${UNCOMMITTED}

## Registry Scars

- VAULT999 total entries: ${SCAR_COUNT}

## Recommended Next Action

${RECOMMENDATION}

---
*FORGE (000Ω) · Vitality Pulse · autonomous duty*
*DITEMPA BUKAN DIBERI*
EOF

echo "[PULSE] ${REPORT}"

# ── TELEGRAM NOTIFY (always) ────────────────────────────────────────
VITAL_EMOJI=$([ "$VITALITY_PCT" -eq 100 ] && echo "🟢" || echo "🔴")
ENTRO_EMOJI=$([ "$ENTROPY_SCORE" -le 1 ] && echo "🟢" || [ "$ENTROPY_SCORE" -le 3 ] && echo "🟡" || echo "🔴")
NOTIFY_MSG="🔥 *FORGE · Vitality Pulse*
${TODAY} $(date +%H:%M) MYT

VPS: ${VPS_SCORE} — ${VPS_BAND}
Verdict: ${VPS_VERDICT}
Human: ${VPS_H_STATE} | Machine: ${VPS_M_STATE}
Governance: ${VPS_G_STATE} | Coupling: ${VPS_C_STATE}

${VITAL_EMOJI} Organs: ${ALIVE}/${TOTAL_ORGANS}
${ENTRO_EMOJI} Entropy: ${ENTROPY_SCORE}/6
Tools: ${TOOL_COUNT} | VAULT999: ${SCAR_COUNT}

_${RECOMMENDATION}_

Report: \`${REPORT}\`"
/root/A-FORGE/duties/forge-notify.sh "$NOTIFY_MSG" 2>/dev/null || true
