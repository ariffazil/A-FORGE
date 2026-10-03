#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK_SRC="$REPO_ROOT/scripts/hooks/pre-push/pre-push.sh"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-push"

if [[ ! -x "$HOOK_SRC" ]]; then
  echo "Hook source missing or not executable: $HOOK_SRC"
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"

echo "Installed pre-push hook: $HOOK_DST"
echo "Guard script: $REPO_ROOT/scripts/hooks/pre-push/repo_guard.py"

# ── LITELLM DANGLING GUARD (2026-10-03): ensure invocation present in pre-commit ──
# Appends the guard call to .git/hooks/pre-commit if the marker is absent.
# Does NOT touch any other pre-commit content (LSP gate etc. stay intact).
PRE_COMMIT_DST="$REPO_ROOT/.git/hooks/pre-commit"
MARKER="LITELLM DANGLING GUARD"
if [ -f "$PRE_COMMIT_DST" ] && ! grep -q "$MARKER" "$PRE_COMMIT_DST"; then
  cat >> "$PRE_COMMIT_DST" <<'GUARD_EOF'

# ── LITELLM DANGLING GUARD (FI-001 spec 2026-10-03; built FI-008, SEAL-ddf5fe51f3cf465b) ──
# Group refs in fallbacks must exist in model_list; delta >2 unflagged = BLOCK.
if [ -f "/root/A-FORGE/scripts/hooks/pre-commit/litellm_dangling_guard.py" ]; then
    GUARD_OUT=$(python3 /root/A-FORGE/scripts/hooks/pre-commit/litellm_dangling_guard.py 2>&1) && GUARD_RC=0 || GUARD_RC=$?
    echo "$GUARD_OUT" | sed 's/^/  /'
    if [ "$GUARD_RC" -ne 0 ]; then
        ERRORS=$((ERRORS + 1))
    fi
fi
GUARD_EOF
  echo "Appended LITELLM DANGLING GUARD to $PRE_COMMIT_DST"
else
  echo "LITELLM DANGLING GUARD already present (or no pre-commit hook to patch)"
fi
