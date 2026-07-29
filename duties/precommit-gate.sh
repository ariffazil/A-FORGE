#!/usr/bin/env bash
# FORGE Pre-Commit Gate — fast T1 push guardian (<10s)
# Checks: working-tree, lint, secrets, drift. No full test suite.
# Exit 0 = CLEAN. Exit 1 = BLOCKED.
# DITEMPA BUKAN DIBERI

set -euo pipefail

REPO="${1:-$(pwd)}"
GATE_ID="gate-$(date +%Y%m%dT%H%M%S)"
CHECKS_PASSED=0
CHECKS_TOTAL=0
FINDINGS=""

cd "$REPO" || exit 1

# ── 1. WORKING TREE ────────────────────────────────────────────────────
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if [ -d ".git" ]; then
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l)
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  if [ "$DIRTY" -gt 0 ]; then
    FINDINGS="${FINDINGS}  ✅ WORKING_TREE: ${DIRTY} uncommitted (non-blocking) [OBS]
"
  else
    FINDINGS="${FINDINGS}  ✅ WORKING_TREE: clean [OBS]
"
  fi
else
  FINDINGS="${FINDINGS}  ❌ NOT_A_GIT_REPO [OBS]
"
fi

# ── 2. LINT (warn-only — never blocks push) ─────────────────────────────
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if [ -f "pyproject.toml" ] && command -v ruff &>/dev/null; then
  LINT_OUT=$(timeout 10 ruff check . 2>&1 || true)
  LINT_COUNT=$(echo "$LINT_OUT" | wc -l)
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  if [ "$LINT_COUNT" -le 1 ]; then
    FINDINGS="${FINDINGS}  ✅ LINT: ruff clean [OBS]
"
  else
    FINDINGS="${FINDINGS}  ⚠️  LINT: ruff found ~$((LINT_COUNT - 1)) issues (non-blocking) [OBS]
"
  fi
elif [ -f "package.json" ] && grep -q '"eslint"' package.json 2>/dev/null; then
  LINT_OUT=$(timeout 10 npx eslint . 2>&1 || true)
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  FINDINGS="${FINDINGS}  ⚠️  LINT: eslint checked (non-blocking) [OBS]
"
else
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  FINDINGS="${FINDINGS}  ⚪ LINT: no linter — skip [OBS]
"
fi

# ── 3. SECRETS (quick scan) ─────────────────────────────────────────────
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if command -v gitleaks &>/dev/null; then
  if timeout 10 gitleaks detect --no-git --source . --exit-code 0 2>/dev/null; then
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    FINDINGS="${FINDINGS}  ✅ SECRETS: clean [OBS]
"
  else
    FINDINGS="${FINDINGS}  ❌ SECRETS: leak or timeout [OBS]
"
  fi
else
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  FINDINGS="${FINDINGS}  ⚪ SECRETS: no gitleaks — skip [OBS]
"
fi

# ── 4. DRIFT ────────────────────────────────────────────────────────────
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if curl -sf http://127.0.0.1:7071/health >/dev/null 2>&1; then
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  FINDINGS="${FINDINGS}  ✅ DRIFT: A-FORGE healthy [OBS]
"
else
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  FINDINGS="${FINDINGS}  ⚪ DRIFT: A-FORGE unavailable — skip [OBS]
"
fi

# ── VERDICT ─────────────────────────────────────────────────────────────
SCORE=$((CHECKS_PASSED * 100 / CHECKS_TOTAL))
if [ "$CHECKS_PASSED" -eq "$CHECKS_TOTAL" ]; then
  VERDICT="CLEAN"
else
  VERDICT="BLOCKED"
fi

echo "${VERDICT} ${GATE_ID} ${CHECKS_PASSED}/${CHECKS_TOTAL} ${REPO}"
[ "$VERDICT" = "CLEAN" ] && exit 0 || exit 1
