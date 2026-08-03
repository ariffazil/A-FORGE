#!/bin/bash
# context_boot.sh — Federation Context-Aware Boot Compiler
# DITEMPA BUKAN DIBERI
#
# Pipeline: task → context_compile.py → resolve organs → generate slim boot doc
#
# Usage:
#   context_boot.sh --print "fix arifOS kernel bug"
#   context_boot.sh --write /tmp/boot.md "deploy AAA cockpit"
#   context_boot.sh --flow "interpret seismic section"

set -euo pipefail

COMPILER="/root/A-FORGE/scripts/context_compile.py"
SURFACE_GEN="/root/A-FORGE/scripts/tool_surface_gen.py"
BOOT_DIR="/tmp/context_boot"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# ─── ORGAN → AGENTS.md SECTION MAP ─────────────────────────────────

declare -A ORGAN_SECTIONS
ORGAN_SECTIONS["arifos"]="9. Memory landscape|13. Cross-cutting governance"
ORGAN_SECTIONS["aforge"]="6. Tech stack|7. Build, test, deploy|8. Code style|12. Testing strategy"
ORGAN_SECTIONS["geox"]="6. Tech stack"
ORGAN_SECTIONS["wealth"]="6. Tech stack"
ORGAN_SECTIONS["well"]="6. Tech stack"

ALWAYS_SECTIONS=(
    "4. Constitutional floors (F1-F13)"
    "5. Autonomy tiers"
    "10. Security"
    "16. One rule"
)

# ─── USAGE ─────────────────────────────────────────────────────────

usage() {
    cat <<'EOF'
Usage: context_boot.sh [--print|--write <path>|--flow] <task description>

  --print        Print compiled boot to stdout
  --write PATH   Write compiled boot to PATH  
  --flow         Ingest compilation step into arifFlow
  --help         This message
EOF
    exit 0
}

# ─── MAIN ──────────────────────────────────────────────────────────

MODE="print"
TASK=""
FLOW=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --print) MODE="print"; shift ;;
        --write) MODE="write"; BOOT_FILE="$2"; shift 2 ;;
        --flow)  FLOW=true; shift ;;
        --help)  usage ;;
        -*) echo "Unknown flag: $1"; usage ;;
        *) TASK="$*"; break ;;
    esac
done

if [ -z "$TASK" ]; then
    echo "Error: No task description." >&2
    usage
fi

mkdir -p "$BOOT_DIR"

# ── Step 1: Run context compiler (with adaptive weights if available) ──
WEIGHT_FLAG=""
WEIGHT_MAP="/root/.arifos/context/organ_weight_map.json"
if [ -f "$WEIGHT_MAP" ]; then
    WEIGHT_FLAG="--weights $WEIGHT_MAP"
fi
COMPILED=$("$COMPILER" "$TASK" --json $WEIGHT_FLAG 2>/dev/null)
PRIMARY=$(echo "$COMPILED" | python3 -c "import json,sys; d=json.load(sys.stdin); scores=d['reachable_organs']; print(max(scores,key=lambda k:scores.get(k,0)))")
REDUCTION=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['reduction_pct'])")
NAIVE=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['naive_tokens'])")
COMPILED_TOKENS=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['compiled_tokens'])")

SKELETON_ORGANS=$(echo "$COMPILED" | python3 -c "
import json,sys; d=json.load(sys.stdin)
scores=d['reachable_organs']
primary=max(scores,key=lambda k:scores.get(k,0))
others=[o for o,s in scores.items() if o!=primary and s>0.1]
print(','.join(others) or 'none')
")

EXCLUDED_ORGANS=$(echo "$COMPILED" | python3 -c "
import json,sys; d=json.load(sys.stdin)
scores=d['reachable_organs']
excluded=[o for o,s in scores.items() if s<=0.1]
print(','.join(excluded))
")

# ── Step 2: Build compiled boot document ──
PRIMARY_UPPER=$(echo "$PRIMARY" | tr '[:lower:]' '[:upper:]')

BOOT_CONTENT=$(cat <<ENDOFHEADER
# AGENTS.md — CONTEXT-COMPILED BOOT
> **Compiled for:** $TASK
> **Primary organ:** $PRIMARY_UPPER
> **Reduction:** ${NAIVE} → ${COMPILED_TOKENS} tokens (${REDUCTION}% reduction)
> **Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
> **Compiler:** Federation Context Compiler v1
>
> This is a CONTEXT-COMPILED variant. Full doc: /root/AGENTS.md
> Excluded organs available on demand via \`arif_route\`.

---

## CONSTITUTIONAL FLOORS (F1-F13)

| Floor | Name | Type | Rule |
|-------|------|------|------|
| F1 | AMANAH | HARD | Reversible-first. Irreversible → 888_HOLD. |
| F2 | TRUTH | HARD | Evidence labelled OBS/DER/INT/SPEC. Cap 0.90. |
| F3 | TRI-WITNESS | DERIVED | Human × AI × Earth × Verifier ≥ 0.75 (Nash product). |
| F4 | CLARITY | HARD | ΔS ≤ 0 — every output reduces entropy. |
| F5 | PEACE² | SOFT | Non-destructive power. Blocks harm/harass/extort. |
| F6 | MARUAH | SOFT | Dignity-first. Never name individuals negatively. |
| F7 | HUMILITY | HARD | Ω₀ ∈ [0.03, 0.05]. No fake certainty. |
| F8 | GENIUS | DERIVED | G ≥ 0.80 for complex actions. |
| F9 | ANTI-HANTU | HARD | No deception, consciousness claims. |
| F10 | ONTOLOGY | HARD | AI-only ontology. No soul/feelings. |
| F11 | AUDITABILITY | HARD | Every decision logged, inspectable. |
| F12 | RESILIENCE | HARD | Injection defense. Risk < 0.85. |
| F13 | SOVEREIGN | HARD | Human veto FINAL. Arif's word is terminal. |

## AUTONOMY TIERS

| Tier | Action | Pattern |
|------|--------|---------|
| T0 | Read, grep, probe | Auto-do |
| T1 | Edit, test, commit, lint, restart | Auto-do |
| T2 | Multi-file refactor, deploy | Announce 10s |
| T3 | rm -rf, force-push, prod deploy | 888_HOLD |

---

## PRIMARY ORGAN — $PRIMARY_UPPER (FULL SURFACE)

ENDOFHEADER
)

# Add primary organ tools
BOOT_CONTENT+=$'\n'
BOOT_CONTENT+=$("$SURFACE_GEN" "$PRIMARY" "full")

# Add relevant sections
BOOT_CONTENT+=$'## RELEVANT AGENTS.md SECTIONS\n\n'
for section in "${ALWAYS_SECTIONS[@]}"; do
    BOOT_CONTENT+="- **$section** (always loaded)"$'\n'
done

IFS='|' read -ra ORG_SEC <<< "${ORGAN_SECTIONS[$PRIMARY]:-}"
for section in "${ORG_SEC[@]}"; do
    BOOT_CONTENT+="- **$section** ($PRIMARY)"$'\n'
done
BOOT_CONTENT+=$'\n'

# ── Step 3: Skeletonized secondary organs ──
if [ "$SKELETON_ORGANS" != "none" ] && [ -n "$SKELETON_ORGANS" ]; then
    BOOT_CONTENT+="## SECONDARY ORGANS — SKELETON (interface only)"$'\n\n'
    IFS=',' read -ra ORG_ARR <<< "$SKELETON_ORGANS"
    for org in "${ORG_ARR[@]}"; do
        BOOT_CONTENT+=$("$SURFACE_GEN" "$org" "skeleton")
        BOOT_CONTENT+=$'\n'
    done
    BOOT_CONTENT+="> Load full surface via \`arif_route\` if needed."$'\n\n'
fi

# ── Step 4: Excluded organs ──
if [ "$EXCLUDED_ORGANS" != "none" ] && [ -n "$EXCLUDED_ORGANS" ]; then
    BOOT_CONTENT+="## EXCLUDED ORGANS — AVAILABLE ON DEMAND"$'\n\n'
    IFS=',' read -ra EXC_ARR <<< "$EXCLUDED_ORGANS"
    for org in "${EXC_ARR[@]}"; do
        BOOT_CONTENT+="- **$org** — route via \`arif_route\` when needed"$'\n'
    done
    BOOT_CONTENT+=$'\n'
fi

# ── Step 5: Shell init + One Rule ──
BOOT_CONTENT+=$(cat <<'ENDOFFOOTER'

## SHELL INIT
```bash
set -a && source /root/.secrets/kunci-mas.env && set +a
```

## PROBE BEFORE ACT
`:port/health` and `tools/list` are truth. This file is a pointer, not a constitution.
The constitution runs on port 8088.

## ONE RULE
**Probe before act.** Sealed where Arif has agreed, reversibly expanded where he has not.
When in doubt: HOLD.

---
*Context-compiled by Federation Context Compiler v1. DITEMPA BUKAN DIBERI.*
ENDOFFOOTER
)

# ── Step 6: Output ──
case "$MODE" in
    print)
        echo "$BOOT_CONTENT"
        ;;
    write)
        echo "$BOOT_CONTENT" > "$BOOT_FILE"
        # Save compile JSON alongside boot doc (for metabolizer --from-compile)
        COMPILE_JSON="${BOOT_FILE%.md}.compile.json"
        echo "$COMPILED" > "$COMPILE_JSON"
        echo "Compiled boot written to: $BOOT_FILE"
        echo "  Compile JSON: $COMPILE_JSON"
        echo "  Primary: $PRIMARY | Skeleton: $SKELETON_ORGANS | Excluded: $EXCLUDED_ORGANS"
        echo "  ${NAIVE} → ${COMPILED_TOKENS} tokens (${REDUCTION}% reduction)"
        export CC_COMPILE_JSON="$COMPILE_JSON"
        ;;
esac

# ── Step 7: arifFlow ingestion ──
if [ "$FLOW" = true ]; then
    curl -sf -X POST http://localhost:7073/ingest \
        -H 'Content-Type: application/json' \
        -d "{
            \"actor_id\": \"333-AGI\",
            \"session_id\": \"CC-BOOT-$TIMESTAMP\",
            \"step_type\": \"Execute\",
            \"step_number\": 1,
            \"epistemic_label\": \"Observation\",
            \"floor_verdict\": \"Pass\",
            \"payload\": {
                \"tool\": \"context_boot\",
                \"task\": \"$(echo "$TASK" | sed 's/"/\\"/g')\",
                \"primary_organ\": \"$PRIMARY\",
                \"naive_tokens\": $NAIVE,
                \"compiled_tokens\": $COMPILED_TOKENS,
                \"reduction_pct\": $REDUCTION
            }
        }" > /dev/null 2>&1 && echo "[arifFlow] Compilation ingested. FQ updated." || true
fi

export CC_PRIMARY_ORGAN="$PRIMARY"
export CC_NAIVE_TOKENS="$NAIVE"
export CC_COMPILED_TOKENS="$COMPILED_TOKENS"
export CC_REDUCTION_PCT="$REDUCTION"
