#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# P2.6 — Pre-Commit Secret Scan
# Blocks commits containing live-looking credentials.
# Must pass before git commit proceeds.
#
# Configure via: git config core.hooksPath .githooks
# Or symlink:   ln -s ../../scripts/pre-commit-secrets.sh .git/hooks/pre-commit
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

HAS_ERRORS=0

# ── Gitleaks (if available) ─────────────────────────────────────────────
if command -v gitleaks &>/dev/null; then
  echo -e "${GREEN}[SECRET-SCAN]${NC} Running gitleaks on staged files..."

  GITLEAKS_OUT=$(gitleaks detect --source . --no-git --verbose --redact 2>&1) || true
  LEAK_COUNT=$(echo "$GITLEAKS_OUT" | grep -c "leaks found:" | grep -o '[0-9]\+' || echo "0")

  if [ "$LEAK_COUNT" -gt 0 ] 2>/dev/null; then
    # Filter: only fail on staged files
    STAGED_LEAKS=$(echo "$GITLEAKS_OUT" | grep -F "$STAGED_FILES" 2>/dev/null || true)
    if [ -n "$STAGED_LEAKS" ]; then
      echo -e "${RED}[SECRET-SCAN] BLOCKED — secrets detected in staged files${NC}"
      echo "$GITLEAKS_OUT" | grep -A2 "RuleID\|Secret\|File" | head -40
      HAS_ERRORS=1
    else
      echo -e "${YELLOW}[SECRET-SCAN] Leaks found but none in staged files (likely in gitignored paths)${NC}"
    fi
  else
    echo -e "${GREEN}[SECRET-SCAN]${NC} No secrets detected in staged files ✅"
  fi
else
  echo -e "${YELLOW}[SECRET-SCAN]${NC} gitleaks not installed — skipping (install: go install github.com/gitleaks/gitleaks/v8@latest)"
fi

# ── Pattern scan (always runs, no dependencies) ─────────────────────────
echo -e "${GREEN}[PATTERN-SCAN]${NC} Running regex pattern check on staged files..."

# Patterns that should NEVER appear in source
DANGEROUS_PATTERNS=(
  "postgresql://[^@ ]*:[^@ ]*@"
  "mongodb://[^@ ]*:[^@ ]*@"
  "DATABASE_URL=postgres://[^@ ]*:[^@ ]*@"
  "sk-[a-zA-Z0-9]{32,}"
  "xox[bprs]-[a-zA-Z0-9-]{10,}"
  "-----BEGIN RSA PRIVATE KEY-----"
  # Allow PEM in IDENTITY/keys/ only
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  MATCHES=$(echo "$STAGED_FILES" | xargs -I{} grep -lE "$pattern" {} 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    # Allow IDENTITY/keys/ path for PEM files
    if echo "$MATCHES" | grep -q "IDENTITY/keys/"; then
      continue
    fi
    echo -e "${RED}[PATTERN-SCAN] DANGEROUS PATTERN in:${NC}"
    echo "$MATCHES" | while read -r f; do
      echo "  $f: $(grep -nE "$pattern" "$f" | head -3)"
    done
    HAS_ERRORS=1
  fi
done

if [ "$HAS_ERRORS" -eq 1 ]; then
  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  COMMIT BLOCKED — Secrets detected in staged files      ║${NC}"
  echo -e "${RED}║  Remove secrets, use env vars, or add to .gitleaksignore ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi

echo -e "${GREEN}[SECRET-SCAN]${NC} All checks passed ✅"
exit 0
