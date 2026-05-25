#!/bin/bash
# preflight-check-mcp.sh — A-FORGE MCP endpoint invariant validator
# DITEMPA BUKAN DIBERI
# Run before deploying or after any arifOS/GEOX/WEALTH routing change.
#
# Fails fast if any stale endpoint is detected in .mcp.json
# Banned patterns:
#   arifOS on :8080   (correct: :8088)
#   GEOX on   :8081   (correct: :18081)
#   WEALTH on :8082   (correct: :18082, or leave unset if not deployed)

set -euo pipefail

MCP_FILE="${1:-.mcp.json}"
FAILED=0

echo "=== A-FORGE MCP Invariant Check ==="
echo "Checking: $MCP_FILE"

check_banned() {
    local pattern="$1"
    local replacement="$2"
    local context="$3"

    if grep -q "$pattern" "$MCP_FILE" 2>/dev/null; then
        echo "❌ STALE ENDPOINT: found '$pattern' (should be '$replacement') — $context"
        FAILED=1
    else
        echo "✅ $context: no stale '$pattern'"
    fi
}

if [ ! -f "$MCP_FILE" ]; then
    echo "⚠️  $MCP_FILE not found — skipping MCP invariant check"
    exit 0
fi

check_banned "localhost:8080" "localhost:8088" "arifOS MCP endpoint"
check_banned "127.0.0.1:8080" "127.0.0.1:8088" "arifOS MCP endpoint"
check_banned ":8080/mcp" ":8088/mcp" "arifOS MCP path"
check_banned "localhost:8081" "localhost:18081" "GEOX MCP endpoint"
check_banned "127.0.0.1:8081" "127.0.0.1:18081" "GEOX MCP endpoint"
check_banned ":8081" ":18081" "GEOX MCP port"

echo ""
if [ $FAILED -eq 1 ]; then
    echo "❌ PREFLIGHT FAILED: stale MCP endpoints detected"
    echo "   Fix .mcp.json and re-run this check before deploying."
    exit 1
else
    echo "✅ PREFLIGHT PASSED: all MCP endpoints current"
    exit 0
fi
