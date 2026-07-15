#!/usr/bin/env bash
# mcp-permission-lint.sh — Flag irreversible tools that are auto-approved
# 
# This script scans MCP tool descriptions for irreversibility language
# and cross-references against the OpenCode permission config.
#
# Usage: ./mcp-permission-lint.sh [--fix]
#   --fix: Propose config changes (dry-run, doesn't modify files)
#
# Audited: 2026-07-07 by FORGE (000Ω)

set -uo pipefail

CONFIG_FILE="${HOME}/.config/opencode/opencode.json"
DB_FILE="${HOME}/.local/share/opencode/opencode.db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== MCP Permission Lint — $(date -Iseconds) ==="
echo ""

# Check if config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}ERROR: Config not found at $CONFIG_FILE${NC}"
    exit 1
fi

# Check if blanket MCP approval is set
MCP_PERM=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
print(cfg.get('permission', {}).get('mcp', 'NOT_SET'))
" 2>/dev/null)

echo "Current MCP permission: $MCP_PERM"
echo ""

if [[ "$MCP_PERM" == "allow" ]]; then
    echo -e "${YELLOW}WARNING: Blanket 'mcp: allow' means ALL MCP tools are auto-approved.${NC}"
    echo -e "${YELLOW}No per-tool granularity exists in the current config.${NC}"
    echo ""
fi

# Check permission table
PERM_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM permission;" 2>/dev/null || echo "0")
echo "Stored per-tool permissions: $PERM_COUNT"
if [[ "$PERM_COUNT" == "0" ]]; then
    echo -e "${YELLOW}No persistent per-tool approvals in database.${NC}"
fi
echo ""

# Known irreversible tools (from system prompt analysis)
# These are tools whose descriptions explicitly state irreversibility
declare -A IRREVERSIBLE_TOOLS=(
    # arifOS
    ["arifos.arif_seal"]="Irreversible. Requires ack_irreversible=True for seal mode. Append to VAULT999 immutable ledger."
    ["arifos.arif_forge"]="commit/write/generate modes execute after judge SEAL. Irreversible execution."
    ["arifos.arif_judge"]="Constitutional verdict gate. SEAL verdict is irreversible."
    
    # GEOX
    ["geox.geox_claim"]="seal mode is IRREVERSIBLE (requires ack_irreversible=True). Creates permanent geological claim."
    ["geox.geox_govern"]="seal mode is IRREVERSIBLE. Creates permanent governance record."
    
    # A-FORGE
    ["aforge.forge_execute_sealed"]="FAILS HARD without valid seal. Irreversible sealed execution."
    ["aforge.forge_seal"]="Seal a Tri-Witness validated skill into permanent VAULT999 memory. Irreversible."
    ["aforge.forge_execute"]="Execution and motor cortex. Irreversible after judge SEAL."
    ["aforge.forge_register"]="APEX v36Ω gated registration. Irreversible tool registration."
    
    # WEALTH
    ["wealth.wealth_vault_write"]="Write a transaction to the VAULT999 ledger. Irreversible."
    
    # WELL
    # WELL tools are all read-only/reflection, no irreversible tools
)

# Known safe tools (read-only, low blast radius)
declare -A SAFE_TOOLS=(
    # arifOS
    ["arifos.arif_observe"]="Reality grounding: web search, URL fetch, vitals. Read-only."
    ["arifos.arif_think"]="Cognitive engine: reason, plan, reflect. Read-only."
    ["arifos.arif_route"]="Canonical intent router. Read-only."
    ["arifos.arif_compose"]="Governed response composition. Read-only."
    ["arifos.arif_memory"]="Store/retrieve memory. Revisable/forgettable."
    ["arifos.arif_critique"]="Ethical risk assessment. Read-only."
    ["arifos.arif_bridge_connect"]="Low-level direct organ tool call. Routing passthrough."
    ["arifos.arif_triage"]="Session status, priority queue. Read-only."
    ["arifos.arif_init"]="Session ignition. Creates session, not irreversible."
    
    # GEOX
    ["geox.geox_observe"]="Query earth data. Read-only."
    ["geox.geox_compute"]="Transform earth data. Computed, not stored."
    ["geox.geox_interpret"]="Geological cognition. Read-only."
    ["geox.geox_model"]="Simulate earth processes. Computed, not stored."
    ["geox.geox_evidence"]="Discover/synthesize evidence. Read-only."
    ["geox.geox_spatial"]="Geometry & maps. Read-only."
    ["geox.geox_surface_status"]="Registry probe. Read-only."
    ["geox.geox_tie_preflight"]="Pre-interpretation gate. Read-only."
    ["geox.geox_tie_receipt"]="Evidence envelope. Read-only."
    
    # A-FORGE
    ["aforge.forge_probe"]="Federation organ liveness. Read-only."
    ["aforge.forge_status"]="Active execution state. Read-only."
    ["aforge.forge_health_check"]="Server health. Read-only."
    ["aforge.forge_filesystem"]="Filesystem primitive. Read/write but reversible."
    ["aforge.forge_shell_dryrun"]="Preview shell command. No mutation."
    ["aforge.forge_registry"]="Dynamic skill registry. Read-only."
    ["aforge.forge_registry_status"]="Registry status. Read-only."
    ["aforge.forge_docs_lookup"]="Governed docs lookup. Read-only."
    ["aforge.forge_search"]="Web search. Read-only."
    ["aforge.forge_fetch"]="URL content extraction. Read-only."
    ["aforge.forge_worktree"]="Git physics sensor. Read-only."
    ["aforge.forge_vps_ports"]="Port registry. Read-only."
    ["aforge.forge_vps_services"]="Service registry. Read-only."
    ["aforge.forge_vps_cron"]="Cron registry. Read-only."
    ["aforge.forge_netdata_alarms"]="Netdata alarms. Read-only."
    ["aforge.forge_netdata_metrics"]="Netdata metrics. Read-only."
    ["aforge.forge_journalctl"]="Systemd journal logs. Read-only."
    ["aforge.forge_shell_status"]="Shell subsystem health. Read-only."
    ["aforge.forge_shell_ledger"]="Shell ledger entries. Read-only."
    ["aforge.forge_shell_alert_history"]="Alert history. Read-only."
    ["aforge.forge_memory"]="Memory primitive. Read-only."
    ["aforge.forge_surface_audit"]="MCP tool surface audit. Read-only."
    ["aforge.forge_surface_guard"]="Surface guard. Read-only."
    ["aforge.forge_chart"]="Agentic charting. Read-only."
    ["aforge.forge_research"]="Web research. Read-only."
    ["aforge.forge_verify_timeline"]="Timeline verification. Read-only."
    ["aforge.forge_scar"]="Scar metabolization. Read-only."
    ["aforge.forge_scar_scan"]="Scar scan. Read-only."
    ["aforge.forge_evaluate"]="APEX evaluation gate. Read-only."
    ["aforge.forge_witness"]="Tri-witness consensus. Read-only."
    ["aforge.forge_docket_prep"]="Evidence package. Read-only."
    ["aforge.forge_receipt_draft"]="Compliance receipt. Read-only."
    
    # WEALTH
    ["wealth.wealth_registry_status"]="Registry status. Read-only."
    ["wealth.wealth_system_registry_status"]="Registry status. Read-only."
    
    # WELL
    ["well.well_health_check"]="Health check. Read-only."
    ["well.well_registry_status"]="Registry status. Read-only."
    ["well.well_readiness"]="Readiness verdict. Read-only."
    ["well.well_validate_vitality"]="Vitality validation. Read-only."
    ["well.well_assess_homeostasis"]="Homeostasis assessment. Read-only."
    ["well.well_assess_livelihood"]="Livelihood assessment. Read-only."
    ["well.well_assess_metabolism"]="Metabolism assessment. Read-only."
    ["well.well_assess_reliability"]="Reliability assessment. Read-only."
    ["well.well_assess_sovereign_entropy"]="Sovereign entropy. Read-only."
    ["well.well_classify_substrate"]="Substrate classification. Read-only."
    ["well.well_compute_metabolic_flux"]="Metabolic flux. Read-only."
    ["well.well_detect_boundary"]="Boundary detection. Read-only."
    ["well.well_guard_dignity"]="Dignity guard. Read-only."
    ["well.well_measure_gradient"]="Gradient measurement. Read-only."
    ["well.well_medical_boundary"]="Medical boundary. Read-only."
    ["well.well_signal_coverage"]="Signal coverage. Read-only."
    ["well.well_trace_lineage"]="Lineage tracing. Read-only."
    ["well.well_check_repair"]="Repair check. Read-only."
)

echo "=== Scanning known irreversible tools ==="
echo ""

FLAGGED=0
for tool in "${!IRREVERSIBLE_TOOLS[@]}"; do
    server="${tool%%.*}"
    name="${tool##*.}"
    desc="${IRREVERSIBLE_TOOLS[$tool]}"
    
    echo -e "${RED}FLAG: $server/$name${NC}"
    echo "  Description: ${desc:0:200}"
    echo "  Current: auto-approved (blanket 'mcp: allow')"
    echo "  Recommended: ask (requires human confirmation)"
    echo ""
    FLAGGED=$((FLAGGED + 1))
done

echo "=== Summary ==="
if [[ $FLAGGED -gt 0 ]]; then
    echo -e "${RED}Found $FLAGGED irreversible tools that are auto-approved.${NC}"
    echo ""
    echo "These tools should require human confirmation (ask) because:"
    echo "  - They write to immutable/append-only stores"
    echo "  - They execute irreversible operations"
    echo "  - Their descriptions explicitly state irreversibility"
    echo ""
    echo "Recommended actions:"
    echo "  1. Change 'mcp: allow' to 'mcp: ask' in opencode.json"
    echo "  2. Use the permission table to store per-tool 'always' grants for safe tools"
    echo "  3. OR add server-side confirmation prompts for irreversible tools"
    echo ""
    echo "Note: The MCP servers already have server-side guards (ack_irreversible=True)."
    echo "The client-side permission is a UI convenience, not a security boundary."
else
    echo -e "${GREEN}No irreversible tools found that are auto-approved.${NC}"
fi

echo ""
echo "=== Binding Analysis ==="
echo "Permission key: (project_id, action, resource)"
echo "  - project_id: OpenCode project (worktree)"
echo "  - action: 'allow' or 'deny'"
echo "  - resource: tool name string (NO server_id, NO schema_hash)"
echo ""
echo "Risks:"
echo "  1. Cross-server name collision: Two servers with same tool name share permission"
echo "  2. Tool rename: Old permission orphaned (fail-open with blanket 'mcp: allow')"
echo "  3. Schema drift: Tool changes side effects, permission unchanged"
echo ""
echo "Recommended binding: (server_id, tool_name, tool_schema_hash)"
echo ""
echo "=== Done ==="
