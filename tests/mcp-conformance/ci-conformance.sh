#!/bin/bash
# MCP 2026-07-28 Conformance Harness — CI Runner
# Run: bash /root/A-FORGE/tests/mcp-conformance/ci-conformance.sh
# Exit 0 = all pass, Exit 1 = failures

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="/root/A-FORGE/tests/mcp-conformance/results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
RESULTS_FILE="$RESULTS_DIR/conformance-${TIMESTAMP}.json"

echo "=== MCP Conformance Harness — CI Run ==="
echo "Timestamp: $TIMESTAMP"
echo ""

# Run MCP conformance
echo "--- MCP Conformance ---"
python3 "$SCRIPT_DIR/mcp_conformance.py" --organs all --json > "$RESULTS_FILE" 2>&1
MCP_EXIT=$?
echo "Results: $RESULTS_FILE (exit $MCP_EXIT)"

# Run A2A schema check
echo ""
echo "--- A2A Schema Check ---"
python3 "$SCRIPT_DIR/test_a2a_schema.py" 2>&1
A2A_EXIT=$?

# Run GEOX session invariant
echo ""
echo "--- GEOX Session Invariant ---"
python3 "$SCRIPT_DIR/test_geox_session_invariant.py" 2>&1
GEOX_EXIT=$?

# Run JCS/JWS vectors
echo ""
echo "--- JCS/JWS Test Vectors ---"
python3 "$SCRIPT_DIR/test_jcs_jws.py" 2>&1
JCS_EXIT=$?

# Summary
echo ""
echo "=== CI Summary ==="
echo "MCP Conformance: exit $MCP_EXIT"
echo "A2A Schema:      exit $A2A_EXIT"
echo "GEOX Invariant:  exit $GEOX_EXIT"
echo "JCS/JWS:         exit $JCS_EXIT"

# Overall exit
if [ $MCP_EXIT -ne 0 ] || [ $GEOX_EXIT -ne 0 ]; then
    echo "FAIL: Critical tests failed"
    exit 1
fi
echo "PASS: All critical tests passed"
exit 0
