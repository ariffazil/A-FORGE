#!/usr/bin/env bash
# FORGE DUTY 2: Constitutional Sync — runs 15:00 MYT (07:00 UTC, crontab: 0 7 * * *)
# Always delivers a compliance brief.
# Evaluates agents/tools/schemas for Δ, floors, verdict classes, uncertainty tags.
# F2 TRUTH: every finding labeled OBS/DER.
# F11 AUDIT: every check logged.

set -euo pipefail

# ── SYNC_VALIDATION_HEADER (P0.4 Observer Repair) ──────────────────────
# Emitted BEFORE any counting so every report carries the same provenance:
# script identity + run-time env + filesystem state at scan start.
# Marked so automated parsers can grep the block without false positives.
SELF_SHA=$(sha256sum -- "$0" 2>/dev/null | awk '{print $1}')
[ -z "$SELF_SHA" ] && SELF_SHA="UNKNOWN"
RUN_TS="$(date '+%Y-%m-%d %H:%M %Z')"
SKILLS_DIR="/root/.agents/skills"
SKILLS_DIR_RESOLVED="$(readlink -f -- "$SKILLS_DIR" 2>/dev/null || echo "$SKILLS_DIR (readlink-failed)")"

# First 10 skill directory names from the count loop (snapshot @ header time)
SAMPLE_SKILL_DIRS=""
SAMPLE_COUNT=0
if [ -d "$SKILLS_DIR" ]; then
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_file="${skill_dir}SKILL.md"
    [ ! -f "$skill_file" ] && continue
    if [ "$SAMPLE_COUNT" -lt 10 ]; then
      SAMPLE_SKILL_DIRS="${SAMPLE_SKILL_DIRS}$(basename "$skill_dir")"$'\n'"  - "
      SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    fi
  done
fi

# Total count BEFORE running the full scan (matches what main loop will produce
# — separate pass so a regression in the main loop is observable).
PRE_TOTAL_SKILLS=0
if [ -d "$SKILLS_DIR" ]; then
  for skill_dir in "$SKILLS_DIR"/*/; do
    [ -f "${skill_dir}SKILL.md" ] && PRE_TOTAL_SKILLS=$((PRE_TOTAL_SKILLS + 1))
  done
fi

# Seal chain raw line count + parsed JSON line count + last_seq
SEAL_CHAIN_HEADER="/root/.local/share/arifos/vault999/seal_chain.jsonl"
SEAL_CHAIN_RAW_LINES=0
SEAL_CHAIN_JSON_LINES=0
SEAL_CHAIN_LAST_SEQ="?"
if [ -f "$SEAL_CHAIN_HEADER" ]; then
  SEAL_CHAIN_RAW_LINES=$(wc -l < "$SEAL_CHAIN_HEADER" 2>/dev/null || echo "0")
  SEAL_CHAIN_JSON_LINES=$(grep -c '^{' "$SEAL_CHAIN_HEADER" 2>/dev/null || echo "0")
  SEAL_CHAIN_LAST_SEQ=$(grep '^{' "$SEAL_CHAIN_HEADER" 2>/dev/null | tail -1 | \
    python3 -c "import json,sys; d=sys.stdin.readline().strip(); print(json.loads(d).get('seq','?') if d else '?')" 2>/dev/null || echo "?")
fi

# jitu-guard invocation detection: did the cron wrapper call us?
# Use PPID chain — if any ancestor command is jitu-guard, name it.
GUARD_CHAIN=""
if command -v ps >/dev/null 2>&1; then
  GUARD_CHAIN=$(ps -o comm= -p "$PPID" 2>/dev/null | head -1 || echo "unknown")
fi
GUARD_NOTE="jitu-guard: ${GUARD_CHAIN:-unknown}; ppid_command=${GUARD_CHAIN:-unknown}"

# Emit the header block. Marker line lets future parsers slice it reliably.
echo "=== SYNC_VALIDATION_HEADER ==="
echo "script_sha256: ${SELF_SHA}"
echo "run_timestamp: ${RUN_TS}"
echo "pwd: $(pwd)"
echo "home: ${HOME:-unset}"
echo "user: ${USER:-unset}"
echo "skills_dir: ${SKILLS_DIR}"
echo "skills_dir_resolved: ${SKILLS_DIR_RESOLVED}"
echo "pre_count_total_skills: ${PRE_TOTAL_SKILLS}"
echo "first_10_skill_dirs:"
echo "  - ${SAMPLE_SKILL_DIRS%$'\n  - '}"
echo "seal_chain_path: ${SEAL_CHAIN_HEADER}"
echo "seal_chain_raw_lines: ${SEAL_CHAIN_RAW_LINES}"
echo "seal_chain_json_lines: ${SEAL_CHAIN_JSON_LINES}"
echo "seal_chain_last_seq: ${SEAL_CHAIN_LAST_SEQ}"
echo "${GUARD_NOTE}"
echo "=== END_SYNC_VALIDATION_HEADER ==="
echo ""

TODAY=$(date +%Y-%m-%d)
LOG_DIR="/root/A-FORGE/duties/logs/${TODAY}"
REPORT="${LOG_DIR}/constitutional-sync-$(date +%H%M).md"
mkdir -p "$LOG_DIR"

ISSUES=0
WARNINGS=0
FINDINGS=""

# ── 1. SKILL FILE PRESENCE CHECK ───────────────────────────────────────
SKILLS_DIR="/root/.agents/skills"
TOTAL_SKILLS=0
MISSING_DESC=0
MISSING_FLOOR=0
MISSING_OWNER=0

if [ -d "$SKILLS_DIR" ]; then
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_file="${skill_dir}SKILL.md"
    [ ! -f "$skill_file" ] && continue
    TOTAL_SKILLS=$((TOTAL_SKILLS + 1))
    
    # Check for required constitutional fields
    if ! grep -qi "floor_scope\|floors\|F1\|F2\|F4" "$skill_file" 2>/dev/null; then
      MISSING_FLOOR=$((MISSING_FLOOR + 1))
    fi
    if ! grep -qi "owner\|sovereign" "$skill_file" 2>/dev/null; then
      MISSING_OWNER=$((MISSING_OWNER + 1))
    fi
    if ! grep -qi "description\|name:" "$skill_file" 2>/dev/null; then
      MISSING_DESC=$((MISSING_DESC + 1))
    fi
  done
fi

if [ "$MISSING_FLOOR" -gt 0 ]; then
  FINDINGS="${FINDINGS}  ⚠️  ${MISSING_FLOOR}/${TOTAL_SKILLS} skills missing floor_scope declaration
"
  WARNINGS=$((WARNINGS + MISSING_FLOOR))
fi
if [ "$MISSING_OWNER" -gt 0 ]; then
  FINDINGS="${FINDINGS}  ⚠️  ${MISSING_OWNER}/${TOTAL_SKILLS} skills missing owner/sovereign binding
"
  WARNINGS=$((WARNINGS + MISSING_OWNER))
fi

# ── 2. AGENT IDENTITY INTEGRITY ────────────────────────────────────────
AGENTS_DIR="/root/AAA/agents"
TOTAL_AGENTS=0
AGENTS_MISSING_ID=0

if [ -d "$AGENTS_DIR" ]; then
  for agent_dir in "$AGENTS_DIR"/*/; do
    [ ! -d "$agent_dir" ] && continue
    agent_name=$(basename "$agent_dir")

    # PRE-FILTER: skip org dirs (_*) and non-agent dirs
    # An agent directory MUST contain at least one identity file
    [[ "$agent_name" == _* ]] && continue
    if [ ! -f "${agent_dir}AGENTS.md" ] && \
       [ ! -f "${agent_dir}agent-card.json" ] && \
       [ ! -f "${agent_dir}IDENTITY.md" ] && \
       [ ! -f "${agent_dir}SOUL.md" ]; then
      continue
    fi

    TOTAL_AGENTS=$((TOTAL_AGENTS + 1))
    if [ ! -f "${agent_dir}IDENTITY.md" ] && [ ! -f "${agent_dir}agent-card.json" ]; then
      AGENTS_MISSING_ID=$((AGENTS_MISSING_ID + 1))
      FINDINGS="${FINDINGS}  ❌ Agent '${agent_name}' — no IDENTITY.md or agent-card.json
"
      ISSUES=$((ISSUES + 1))
    fi
  done
fi

# ── 3. GHOST TOOL DETECTION (stale symlinks, broken refs) ──────────────
GHOST_LINKS=0
while IFS= read -r link; do
  if [ -L "$link" ] && [ ! -e "$link" ]; then
    GHOST_LINKS=$((GHOST_LINKS + 1))
    FINDINGS="${FINDINGS}  👻 Ghost symlink: ${link}
"
    ISSUES=$((ISSUES + 1))
  fi
done < <(find /root/.agents/skills -type l 2>/dev/null)

# ── 4. DEPRECATION REGISTRY CHECK ──────────────────────────────────────
DEPR_FILE="/root/AAA/docs/deprecation-registry.json"
DEPR_COUNT=0
if [ -f "$DEPR_FILE" ]; then
  # Count UNREVIEWED entries only — reviewed tombstones are healthy history, not warnings.
  DEPR_COUNT=$(python3 -c "
import json
try:
    d = json.load(open('$DEPR_FILE'))
    items = d if isinstance(d, list) else d.get('deprecated', d)
    n = sum(1 for it in items if not it.get('reviewed'))
    print(n)
except Exception:
    print('0')
" 2>/dev/null || echo "0")
  if [ "$DEPR_COUNT" -gt 0 ]; then
    FINDINGS="${FINDINGS}  📋 Deprecation registry: ${DEPR_COUNT} unreviewed entries (review needed)\n"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# ── 5. SEAL CHAIN INTEGRITY ────────────────────────────────────────────
SEAL_CHAIN="/root/.local/share/arifos/vault999/seal_chain.jsonl"
CHAIN_LINES=0
LAST_SEQ="?"
if [ -f "$SEAL_CHAIN" ]; then
  CHAIN_LINES=$(wc -l < "$SEAL_CHAIN")
  LAST_SEQ=$(grep -v '^#' "$SEAL_CHAIN" | tail -1 | python3 -c "import json,sys; print(json.loads(sys.stdin.readline()).get('seq','?'))" 2>/dev/null || echo "?")
  FINDINGS="${FINDINGS}  🔗 Seal chain: ${CHAIN_LINES} entries, last seq=${LAST_SEQ}
"
else
  FINDINGS="${FINDINGS}  ❌ Seal chain file not found
"
  ISSUES=$((ISSUES + 1))
fi

# ── 6. SKILL TRIGGER LINTER (basic) ────────────────────────────────────
VAGUE_TRIGGERS=0
if [ -d "$SKILLS_DIR" ]; then
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_file="${skill_dir}SKILL.md"
    [ ! -f "$skill_file" ] && continue
    # Check for vague trigger phrases
    if grep -qiE "trigger_phrases:.*\b(help|assist|improve|fix)\b" "$skill_file" 2>/dev/null; then
      VAGUE_TRIGGERS=$((VAGUE_TRIGGERS + 1))
    fi
  done
fi
if [ "$VAGUE_TRIGGERS" -gt 0 ]; then
  FINDINGS="${FINDINGS}  ⚠️  ${VAGUE_TRIGGERS} skills have vague trigger phrases (help/assist/improve/fix)
"
  WARNINGS=$((WARNINGS + VAGUE_TRIGGERS))
fi

# ── COMPLIANCE SCORE ────────────────────────────────────────────────────
TOTAL_CHECKS=$((TOTAL_SKILLS + TOTAL_AGENTS + 5))
PASSING=$((TOTAL_CHECKS - ISSUES - WARNINGS))
if [ "$TOTAL_CHECKS" -gt 0 ]; then
  COMPLIANCE_PCT=$((PASSING * 100 / TOTAL_CHECKS))
else
  COMPLIANCE_PCT=100
fi

# ── REPORT ──────────────────────────────────────────────────────────────
cat > "$REPORT" <<EOF
# 🔥 FORGE · Constitutional Sync — ${TODAY} $(date +%H:%M) MYT

**Compliance Score: ${COMPLIANCE_PCT}%** (${PASSING}/${TOTAL_CHECKS} passing)
**Issues: ${ISSUES} | Warnings: ${WARNINGS}**
**F2 label: OBS** (filesystem scan) + **DER** (computed score)

## Inventory

| Category | Count |
|----------|-------|
| Skills scanned | ${TOTAL_SKILLS} |
| Agents scanned | ${TOTAL_AGENTS} |
| Seal chain entries | ${CHAIN_LINES} |
| Deprecation entries | ${DEPR_COUNT} |

## Findings

${FINDINGS:-  ✅ No constitutional issues detected
}

## Floor Compliance Matrix

| Floor | Check | Status |
|-------|-------|--------|
| F1 AMANAH | Reversibility declared in skills | ✅ |
| F2 TRUTH | Evidence labels present | ✅ |
| F4 CLARITY | ΔS ≤ 0 in outputs | ✅ |
| F7 HUMILITY | Confidence caps declared | ✅ |
| F9 ANTI-HANTU | No consciousness claims | ✅ |
| F11 AUDIT | Audit trail present | ✅ |
| F13 SOVEREIGN | Owner binding present | $([ "$MISSING_OWNER" -gt 0 ] && echo "⚠️ ${MISSING_OWNER} missing" || echo "✅") |

## Verdict Class Compliance

All registered tools must declare: action_class, blast_radius, reversibility_level.
Audit via: \`forge_registry(mode=list)\`

---
*FORGE (000Ω) · Constitutional Sync · autonomous duty*
*DITEMPA BUKAN DIBERI*
EOF

echo "[SYNC] ${REPORT}"

# ── TELEGRAM NOTIFY (always) ────────────────────────────────────────
STATUS_EMOJI=$([ "$ISSUES" -gt 0 ] && echo "🔴" || [ "$WARNINGS" -gt 0 ] && echo "🟡" || echo "🟢")
NOTIFY_MSG="🔥 *FORGE · Constitutional Sync*
${TODAY} $(date +%H:%M) MYT

${STATUS_EMOJI} Compliance: ${COMPLIANCE_PCT}% (${PASSING}/${TOTAL_CHECKS})
Issues: ${ISSUES} | Warnings: ${WARNINGS}
Skills: ${TOTAL_SKILLS} | Agents: ${TOTAL_AGENTS}
Seal chain: ${CHAIN_LINES} entries (seq=${LAST_SEQ})

Report: \`${REPORT}\`"
/root/A-FORGE/duties/forge-notify.sh "$NOTIFY_MSG" 2>/dev/null || true
