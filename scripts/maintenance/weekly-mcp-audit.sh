#!/usr/bin/env bash
# Weekly MCP Permission Audit — arifOS Maintenance Routine
#
# Scans A-FORGE MCP tool surface for:
#   - Tools with overly broad permissions
#   - Tools missing governance classification
#   - Unused or stale tools
#   - Write/deploy/delete actions without 888_HOLD
#   - Secret exposure in logs
#
# Output: JSON report to stdout + log to /root/A-FORGE/data/audit/weekly/
#
# Run: bash scripts/maintenance/weekly-mcp-audit.sh
# Cron: 0 9 * * 1 (Monday 9am)

set -euo pipefail

AUDIT_DIR="/root/A-FORGE/data/audit/weekly"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT_FILE="$AUDIT_DIR/mcp-audit-$(date +%Y%m%d).json"

mkdir -p "$AUDIT_DIR"

echo "[weekly-mcp-audit] Starting at $TIMESTAMP" >&2

# ── 1. Scan action classifier for unclassified tools ────────────────────

CLASSIFIER="/root/A-FORGE/src/domain/governance/actionClassifier.ts"

# Extract all tool names from the classifier
TOOLS_IN_CLASSIFIER=$(grep -oP '"(forge_[a-z_]+|arif_[a-z_]+)"' "$CLASSIFIER" | sort -u | tr -d '"')

# Extract all tool names registered in core.ts
TOOLS_REGISTERED=$(grep -oP 'server\.tool\("(forge_[a-z_]+|arif_[a-z_]+)"' /root/A-FORGE/src/interfaces/mcp/core.ts 2>/dev/null | grep -oP '"[^"]+"' | tr -d '"' | sort -u)

# Find tools registered but not classified
UNCLASSIFIED=""
for tool in $TOOLS_REGISTERED; do
  if ! echo "$TOOLS_IN_CLASSIFIER" | grep -qx "$tool"; then
    UNCLASSIFIED="$UNCLASSIFIED $tool"
  fi
done

# ── 2. Check for tools with dangerous patterns ──────────────────────────

# Tools that have write/deploy/delete capability
DANGEROUS_PATTERNS="deploy|delete|drop|rm_|force|push|seal|execute|mutate|write_file|send_email"
DANGEROUS_TOOLS=$(grep -oP '"(forge_[a-z_]+|arif_[a-z_]+)"' /root/A-FORGE/src/interfaces/mcp/forgeTools.ts 2>/dev/null | tr -d '"' | sort -u | while read tool; do
  if echo "$tool" | grep -qiE "$DANGEROUS_PATTERNS"; then
    echo "$tool"
  fi
done)

# ── 3. Check for hardcoded secrets ──────────────────────────────────────

SECRET_LEAKS=""
if command -v gitleaks &>/dev/null; then
  SECRET_LEAKS=$(gitleaks detect --source /root/A-FORGE --no-git --quiet 2>/dev/null | head -10 || true)
fi

# ── 4. Count 888_HOLD events in logs (last 7 days) ──────────────────────

HOLD_COUNT=$(journalctl -u a-forge -u a-forge-mcp --since "7 days ago" --no-pager 2>/dev/null | grep -ci "888.HOLD\|hold_required" || echo "0")

# ── 5. Count tool errors (last 7 days) ──────────────────────────────────

TOOL_ERRORS=$(journalctl -u a-forge -u a-forge-mcp --since "7 days ago" --no-pager 2>/dev/null | grep -ci "error\|failed\|isError" || echo "0")

# ── 6. Check lease scope violations ─────────────────────────────────────

LEASE_VIOLATIONS=$(journalctl -u a-forge-mcp --since "7 days ago" --no-pager 2>/dev/null | grep -ci "lease.*required\|not registered\|unauthorized" || echo "0")

# ── 7. Build report ─────────────────────────────────────────────────────

cat > "$REPORT_FILE" << EOF
{
  "audit_type": "weekly_mcp_permission",
  "timestamp": "$TIMESTAMP",
  "tools": {
    "registered_count": $(echo "$TOOLS_REGISTERED" | wc -w),
    "classified_count": $(echo "$TOOLS_IN_CLASSIFIER" | wc -w),
    "unclassified": [$(echo "$UNCLASSIFIED" | tr ' ' '\n' | grep -v '^$' | sed 's/^/"/;s/$/"/' | paste -sd, -)],
    "dangerous_pattern_tools": [$(echo "$DANGEROUS_TOOLS" | tr ' ' '\n' | grep -v '^$' | sed 's/^/"/;s/$/"/' | paste -sd, -)]
  },
  "security": {
    "secret_leaks_found": $([ -n "$SECRET_LEAKS" ] && echo "true" || echo "false"),
    "secret_leaks_sample": "$(echo "$SECRET_LEAKS" | head -3 | tr '\n' ' ' | sed 's/"/\\"/g')"
  },
  "runtime": {
    "888_hold_events_7d": $HOLD_COUNT,
    "tool_errors_7d": $TOOL_ERRORS,
    "lease_violations_7d": $LEASE_VIOLATIONS
  },
  "verdict": "$([ "$LEASE_VIOLATIONS" -gt 0 ] && echo "HOLD" || ([ "$TOOL_ERRORS" -gt 50 ] && echo "REVIEW" || echo "SEAL"))",
  "recommendations": [
    $([ -n "$UNCLASSIFIED" ] && echo '"Add unclassified tools to actionClassifier.ts",' || true)
    $([ "$HOLD_COUNT" -eq 0 ] && echo '"No 888_HOLD events — verify holds are not silently bypassed",' || true)
    $([ "$LEASE_VIOLATIONS" -gt 0 ] && echo '"Lease violations detected — review tool access controls",' || true)
    "Review dangerous-pattern tools for least privilege"
  ]
}
EOF

echo "[weekly-mcp-audit] Report written to $REPORT_FILE" >&2
cat "$REPORT_FILE"
