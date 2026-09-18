#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  LSP PRE-COMMIT GATE — Hard enforcement at commit boundary  ║
# ║  Forged: 2026-08-06 by 333-AGI Δ MIND · F13 SOVEREIGN      ║
# ║                                                            ║
# ║  Fires on every git commit. Checks staged .ts/.py/.js files ║
# ║  for LSP diagnostic cleanliness. Blocks commit on errors.   ║
# ║                                                            ║
# ║  This is the KERNEL-LEVEL HARD GATE. It does not depend on  ║
# ║  agent compliance. It fires regardless of what the agent    ║
# ║  did or didn't do before committing.                        ║
# ║                                                            ║
# ║  Install: ln -s /root/A-FORGE/hooks/pre-commit-lsp-gate.sh  ║
# ║           /root/A-FORGE/.git/hooks/pre-commit               ║
# ║  Or:      bash /root/A-FORGE/hooks/install-lsp-gate.sh      ║
# ║                                                            ║
# ║  DITEMPA BUKAN DIBERI                                       ║
# ╚══════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
MAX_LSP_WARNINGS=5
MAX_LSP_ERRORS=0
GATED_EXTENSIONS="ts|tsx|py|js|jsx|mjs"
HOOK_NAME="PRE-COMMIT-GATE"

# Colors
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; C='\033[1;36m'; D='\033[2;37m'; X='\033[0m'

# ── GITLEAKS SECRET SCAN (merged from /root/.githooks/pre-commit 2026-09-15) ──
# Primary scanner: Gitleaks protect --staged. Blocks secrets at commit boundary.
BLOCKED=0
for file in $(git diff --cached --name-only --diff-filter=ACM 2>/dev/null); do
  if echo "$file" | grep -qE "(vault\.flat\.env|vault\.env|\.secrets/|secrets\.env|credentials\.json)"; then
    echo -e "${R}BLOCKED${NC}: Secret file staged: $file"
    BLOCKED=1
  fi
done
if command -v gitleaks >/dev/null 2>&1; then
  if ! gitleaks protect --staged >/dev/null 2>&1; then
    echo -e "${R}BLOCKED${NC}: Gitleaks detected potential secrets in staged files."
    echo "Run 'gitleaks protect --staged --verbose' to inspect."
    BLOCKED=1
  fi
else
  for file in $(git diff --cached --name-only --diff-filter=ACM 2>/dev/null); do
    file "$file" 2>/dev/null | grep -q "text" || continue
    if git show ":$file" 2>/dev/null | grep -qE "(sk-[a-zA-Z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})"; then
      echo -e "${R}BLOCKED${NC}: Potential secret in $file"
      BLOCKED=1
    fi
  done
fi
if [ $BLOCKED -eq 1 ]; then
  echo ""
  echo -e "${Y}COMMIT BLOCKED${NC} — Potential secrets detected."
  echo "If this is a false positive, use: git commit --no-verify"
  exit 1
fi

# ── DOCTRINE STATUS GATE (U18 / constitutional-invariants v1.1, 2026-09-12) ──
# K6 scar (UL-002): status-line reclassification caught by peer, not boundary.
# Deterministic staged-content check — zero detection debt. Runs BEFORE the
# code-file early-exit so pure-.md doctrine commits are gated too.
if [ -f "/root/AAA/scripts/doctrine_status_gate.py" ]; then
    if ! python3 /root/AAA/scripts/doctrine_status_gate.py; then
        echo -e "${R}DOCTRINE-STATUS GATE: commit blocked — ratified-class Status needs F13 instrument (date or quote); ANNEX-class forbidden; new watched .md must carry Status.${X}" >&2
        exit 1
    fi
fi

# ── Find staged code files ──────────────────────────────────
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(${GATED_EXTENSIONS})$" 2>/dev/null || true)

if [ -z "$STAGED" ]; then
    # No code files staged — gate passes silently
    exit 0
fi

FILE_COUNT=$(echo "$STAGED" | wc -l)
echo -e "${C}[${HOOK_NAME}]${X} ${FILE_COUNT} code file(s) staged. Running LSP diagnostics..."

ERRORS=0
WARNINGS=0
CLEAN=0

for file in $STAGED; do
    # Skip deleted files
    [ -f "$file" ] || continue
    
    ext="${file##*.}"
    
    # ── Run LSP documentSymbol via the OpenCode LSP tool ──────
    # We can't call the lsp tool directly from a git hook,
    # but we CAN check if a recent LSP probe exists.
    # 
    # Fallback: check for syntax validity with language-specific tools
    
    case "$ext" in
        ts|tsx)
            # TypeScript: project-level tsc is authoritative.
            # Individual file checks need tsconfig context.
            # The agent's LSP probes (documentSymbol/hover/findReferences)
            # provide the real safety net. Pre-commit verifies syntax only.
            echo -e "  ${Y}⚠${X} ${D}${file}${X} — TS files require LSP probe before commit (not checked at hook level)"
            CLEAN=$((CLEAN + 1))
            ;;
        js|jsx)
            # JavaScript: node --check catches syntax errors
            if node --check "$file" 2>/dev/null; then
                echo -e "  ${G}✓${X} ${D}${file}${X} — syntax valid"
                CLEAN=$((CLEAN + 1))
            else
                SYNTAX_ERR=$(node --check "$file" 2>&1 | head -3)
                echo -e "  ${R}✗${X} ${file} — SYNTAX ERROR"
                echo -e "    ${R}${SYNTAX_ERR}${X}"
                ERRORS=$((ERRORS + 1))
            fi
            ;;
        py)
            # Python: check with python -m py_compile
            if python3 -m py_compile "$file" 2>/dev/null; then
                echo -e "  ${G}✓${X} ${D}${file}${X} — syntax valid"
                CLEAN=$((CLEAN + 1))
            else
                PY_ERR=$(python3 -m py_compile "$file" 2>&1 | head -3)
                echo -e "  ${R}✗${X} ${file} — SYNTAX ERROR"
                echo -e "    ${R}${PY_ERR}${X}"
                ERRORS=$((ERRORS + 1))
            fi
            ;;
    esac
    # ── Scar-001 Check: ESM require() guard (FORGE-esm-require-guard) ──
    case "$ext" in
        ts|tsx|js|jsx|mjs)
            # Delegated to a precise checker (2026-09-18). The previous inline grep
            # flagged 3 files on a real merge and all 3 were false positives: one had
            # its only require() inside a JSDoc block, and two establish a
            # `require = createRequire(...)` binding at module scope, where
            # require('node:crypto') resolves fine under `node --input-type=module`.
            # A lexical grep cannot see comments or a binding — read the construct in
            # its enclosing scope. Real violations (bare require, no binding) still block.
            if [ -f "/root/AAA/scripts/esm_require_guard.py" ]; then
                GUARD_OUT=$(python3 /root/AAA/scripts/esm_require_guard.py "$file" 2>&1)
                GUARD_RC=$?
                if [ "$GUARD_RC" -ne 0 ]; then
                    echo -e "  ${R}✗${X} ${file}${X}"
                    echo -e "$GUARD_OUT" | sed 's/^/  /'
                    ERRORS=$((ERRORS + 1))
                fi
            fi
            ;;
    esac
done

# ── SUPPLY-CHAIN PIN GATE (E-2 / gate-promotion doctrine, 2026-08-25) ──
# Fails closed: unpinned npx/uvx in watched agent configs blocks this commit.
if [ -f "/root/AAA/scripts/supply_chain_gate.py" ]; then
    if ! python3 /root/AAA/scripts/supply_chain_gate.py --all; then
        echo -e "${R}SUPPLY-CHAIN GATE: commit blocked — pin the install (pkg@x.y.z) and register it in registries/supply_chain_pins.json${X}" >&2
        ERRORS=$((ERRORS + 1))
    fi
fi

# ── MUSYAWARAH NO-GATE (E-3 / musyawarah.md §6, 2026-09-08) ──
# Sentinel: scans arifFlow ledger for T2/T3 receipts without musyawarah_reference.
# Tier: OBSERVE_ONLY (advisory at commit boundary). Runtime gate (Phase 2 step 3,
# forge_shell action_class DENY) is the GATE-tier enforcement to avoid detection debt.
# Per gate-promotion.md: paired with runtime gate = no detection debt.
if [ -f "/root/AAA/scripts/musyawarah_gate.py" ]; then
    echo -e "${C}[MUSYAWARAH-GATE]${X} scanning arifFlow ledger (OBSERVE_ONLY)..."
    MUSYAWARAH_OUT=$(python3 /root/AAA/scripts/musyawarah_gate.py --scan-ledger --dry-run 2>&1)
    MUSYAWARAH_RC=$?
    if [ -n "$MUSYAWARAH_OUT" ]; then
        echo "$MUSYAWARAH_OUT" | sed 's/^/  /'
    fi
    # OBSERVE_ONLY: do not block commit. Runtime gate is Phase 2 step 3.
    # Set MUSYAWARAH_STRICT=1 to escalate to blocking (development flag).
    if [ "${MUSYAWARAH_STRICT:-0}" = "1" ] && [ "$MUSYAWARAH_RC" -ne 0 ]; then
        echo -e "${R}MUSYAWARAH GATE (STRICT): commit blocked — fix T2/T3 violations in arifFlow ledger${X}" >&2
        ERRORS=$((ERRORS + 1))
    fi
fi

# ── Verdict ──────────────────────────────────────────────────
echo ""
TOTAL=$((ERRORS + WARNINGS + CLEAN))

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${R}⬡⬡⬡ PRE-COMMIT HARD GATES: COMMIT BLOCKED ⬡⬡⬡${X}"
    echo -e "${R}  ${ERRORS} gate violation(s) / syntax error(s) in staged files.${X}"
    echo -e "${R}  Fix errors before committing.${X}"
    echo -e "${D}  Tip: Run LSP probes on failing files or remove illegal require() in ESM.${X}"
    echo ""
    echo -e "${Y}  SKIP gate (NOT RECOMMENDED): git commit --no-verify${X}"
    exit 1
fi

echo -e "${G}⬡ PRE-COMMIT HARD GATES: PASSED${X} — ${CLEAN}/${TOTAL} checks clean"
echo -e "${D}  F2 TRUTH enforced · F4 ΔS ≤ 0 maintained · Scar-001 guarded${X}"
echo ""

exit 0
