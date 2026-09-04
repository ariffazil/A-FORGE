#!/bin/bash
# Federation Context Compiler — Bash Wrapper
# DITEMPA BUKAN DIBERI
#
# Usage:
#   context_compile.sh "fix a bug in arifOS kernel"
#   context_compile.sh --json "deploy AAA cockpit"
#   context_compile.sh --load "interpret seismic section"  # outputs load commands
#
# The --load mode outputs shell commands to load only the compiled context.
# Pipe it: eval $(context_compile.sh --load "fix arifos init")

set -euo pipefail

# Locate A-FORGE root from this script: scripts/context_compile.sh → ..
A_FORGE_ROOT="$(cd "$(dirname "$0")" && cd .. && pwd)"
COMPILER="$A_FORGE_ROOT/scripts/context_compile.py"
CARRY_FORWARD="/root/.local/share/arifos/carry_forward.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    cat <<EOF
Usage: context_compile.sh [--json|--load|--dry] <task description>

  --json    Output compiler manifest as JSON (for programmatic consumption)
  --load    Output shell commands to load only compiled context
  --dry     Dry-run: show what WOULD be loaded, don't mutate anything
  --help    This message

Examples:
  context_compile.sh "fix a bug in arifOS kernel session"
  context_compile.sh --json "deploy AAA cockpit to production"
  eval \$(context_compile.sh --load "interpret seismic section")
EOF
    exit 0
}

MODE="report"
TASK=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json) MODE="json"; shift ;;
        --load) MODE="load"; shift ;;
        --dry)  MODE="dry"; shift ;;
        --help) usage ;;
        -*) echo "Unknown flag: $1"; usage ;;
        *) TASK="$*"; break ;;
    esac
done

if [ -z "$TASK" ]; then
    echo -e "${RED}Error: No task description provided.${NC}"
    usage
fi

# Run compiler
COMPILED=$(python3 "$COMPILER" "$TASK" --json 2>/dev/null)
if [ $? -ne 0 ]; then
    echo -e "${RED}Compiler failed.${NC}" >&2
    exit 1
fi

# Extract fields
NAIVE=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['naive_tokens'])")
COMPILED_TOKENS=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['compiled_tokens'])")
REDUCTION=$(echo "$COMPILED" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['reduction_pct'])")
ORGANS=$(echo "$COMPILED" | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(f'{k}:{v:.0%}' for k,v in d['reachable_organs'].items()))")
PRIMARY=$(echo "$COMPILED" | python3 -c "import json,sys; d=json.load(sys.stdin); scores=d['reachable_organs']; print(max(scores,key=lambda k:scores.get(k,0)))")
TIER1=$(echo "$COMPILED" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['tiers']['tier1_full']))")
TIER2=$(echo "$COMPILED" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['tiers']['tier2_skeleton']))")
TIER3=$(echo "$COMPILED" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['tiers']['tier3_excluded']))")
SKILLS=$(echo "$COMPILED" | python3 -c "import json,sys; print(','.join(json.load(sys.stdin)['reachable_skills']) or 'none')")
DOCS=$(echo "$COMPILED" | python3 -c "import json,sys; print(','.join(json.load(sys.stdin)['reachable_docs']))")

case "$MODE" in
    json)
        echo "$COMPILED"
        ;;
    load)
        # Output shell commands that the agent can eval to configure its context
        cat <<SHELL
# Federation Context Compiler — Context Load Commands
# Auto-generated for task: $TASK
# Primary organ: $PRIMARY | Reduction: ${REDUCTION}%
# $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Tier 1 — Full surface (ALWAYS load)
export CC_PRIMARY_ORGAN="$PRIMARY"
export CC_ALWAYS_DOCS="AUTONOMOUS_GOVERNANCE.md,IDENTITY.md"

# Tier 2 — Skeleton only (load interface, skip implementation)
export CC_SKELETON_ORGANS="$(echo "$COMPILED" | python3 -c "
import json,sys; d=json.load(sys.stdin)
scores=d['reachable_organs']
primary=max(scores,key=lambda k:scores.get(k,0))
others=[o for o,s in scores.items() if o!=primary and s>0.1]
print(','.join(others) or 'none')
")"
export CC_SKELETON_SKILLS="$SKILLS"
export CC_SKELETON_DOCS="$(echo "$COMPILED" | python3 -c "
import json,sys; d=json.load(sys.stdin)
always={'AUTONOMOUS_GOVERNANCE.md','IDENTITY.md'}
non_always=[dd for dd in d['reachable_docs'] if dd not in always]
print(','.join(non_always) or 'none')
")"

# Tier 3 — Excluded (available via arif_route on demand)
export CC_EXCLUDED_ORGANS="$(echo "$COMPILED" | python3 -c "
import json,sys; d=json.load(sys.stdin)
scores=d['reachable_organs']
excluded=[o for o,s in scores.items() if s<=0.1]
print(','.join(excluded))
")"

# Stats
export CC_NAIVE_TOKENS="$NAIVE"
export CC_COMPILED_TOKENS="$COMPILED_TOKENS"
export CC_REDUCTION_PCT="$REDUCTION"

echo -e "${GREEN}[CC] Compiled: ${NAIVE} → ${COMPILED_TOKENS} tokens (${REDUCTION}% reduction)${NC}"
echo -e "${CYAN}[CC] Primary: ${PRIMARY} | Tier2: ${TIER2} items | Excluded: ${TIER3} organs${NC}"
echo -e "${YELLOW}[CC] Skills: ${SKILLS}${NC}"
SHELL
        ;;
    dry)
        echo -e "${GREEN}=== CONTEXT COMPILER — DRY RUN ===${NC}"
        echo -e "Task: ${CYAN}$TASK${NC}"
        echo -e "Primary organ: ${CYAN}$PRIMARY${NC}"
        echo -e "Organs: ${CYAN}$ORGANS${NC}"
        echo -e "Skills: ${CYAN}$SKILLS${NC}"
        echo -e "Docs:   ${CYAN}$DOCS${NC}"
        echo ""
        echo -e "Tier 1 (full):    ${GREEN}$TIER1 items${NC}"
        echo -e "Tier 2 (skeleton): ${YELLOW}$TIER2 items${NC}"
        echo -e "Tier 3 (excluded): ${RED}$TIER3 items${NC}"
        echo ""
        echo -e "Naive:  ${RED}$NAIVE tokens${NC}"
        echo -e "Compiled: ${GREEN}$COMPILED_TOKENS tokens${NC}"
        echo -e "Reduction: ${GREEN}${REDUCTION}%${NC}"
        ;;
    *)
        # Report mode
        python3 "$COMPILER" "$TASK"
        ;;
esac
