#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  LSP GATE INSTALLER — Installs pre-commit hooks across all  ║
# ║  federation organ repos                                     ║
# ║  Forged: 2026-08-06 by 333-AGI Δ MIND · F13 SOVEREIGN      ║
# ║  DITEMPA BUKAN DIBERI                                       ║
# ╚══════════════════════════════════════════════════════════════╝

set -euo pipefail
GATE_SCRIPT="/root/A-FORGE/hooks/pre-commit-lsp-gate.sh"
REPOS=(
    "/root/arifOS"
    "/root/A-FORGE"
    "/root/AAA"
    "/root/GEOX"
    "/root/WEALTH"
    "/root/WELL"
)

G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; X='\033[0m'

echo "=== LSP PRE-COMMIT GATE INSTALLER ==="
echo ""

for repo in "${REPOS[@]}"; do
    if [ ! -d "${repo}/.git" ]; then
        echo -e "  ${Y}SKIP${X} ${repo} — no .git directory"
        continue
    fi
    
    hook_path="${repo}/.git/hooks/pre-commit"
    
    # Backup existing hook
    if [ -f "$hook_path" ]; then
        if [ -L "$hook_path" ]; then
            # It's a symlink — check if it points to our gate
            current_target=$(readlink -f "$hook_path" 2>/dev/null || true)
            if [ "$current_target" = "$GATE_SCRIPT" ]; then
                echo -e "  ${G}OK${X}   ${repo} — already linked"
                continue
            fi
        fi
        # Backup real hook
        cp -a "$hook_path" "${hook_path}.bak-$(date +%Y%m%d-%H%M%S)"
        echo -e "  ${Y}BAK${X}  ${repo} — existing hook backed up"
    fi
    
    # Create symlink
    ln -sf "$GATE_SCRIPT" "$hook_path"
    echo -e "  ${G}LINK${X} ${repo} → pre-commit-lsp-gate.sh"
done

echo ""
echo -e "${G}⬡ LSP pre-commit gate installed across ${#REPOS[@]} repos${X}"
echo "  Gate fires on every git commit with staged .ts/.py/.js files"
echo "  Bypass (NOT RECOMMENDED): git commit --no-verify"
echo ""
