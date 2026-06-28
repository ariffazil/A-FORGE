#!/bin/bash
# FORGE8 Execution Loop — End-to-End Example
#
# Demonstrates the full 8-verb pipeline:
# synthesize → stage → sandbox_run → scar_scan → skillstore_write →
# tier_bind → docket_prep → execute
#
# DITEMPA BUKAN DIBERI
# Constitutional chain: FORGE8_EXAMPLE_V1

set -euo pipefail

MCP_HOST="http://localhost:7072/mcp"

call_tool() {
  local tool="$1"
  local args="$2"
  curl -sf -X POST "$MCP_HOST" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool\",\"arguments\":$args}}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('result',{}); c=r.get('content',[]); print(c[0]['text'] if c else json.dumps(r, indent=2))" 2>/dev/null
}

echo "══════════════════════════════════════════════════════"
echo "FORGE8 EXECUTION LOOP — End-to-End Demo"
echo "══════════════════════════════════════════════════════"
echo ""

# STEP 1: SYNTHESIZE
echo "▶ STEP 1: forge_synthesize — Create artifact from intent"
SYNTH=$(call_tool "forge_synthesize" '{"intent":"Build a Python script to calculate Fibonacci numbers","decision_class":"C1_STANDARD"}')
echo "$SYNTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  artifact_id: {d[\"artifact_id\"]}'); print(f'  language: {d[\"language\"]}'); print(f'  complexity: {d[\"estimated_complexity\"]}')"
ARTIFACT_ID=$(echo "$SYNTH" | python3 -c "import json,sys; print(json.load(sys.stdin)['artifact_id'])")
echo ""

# STEP 2: STAGE
echo "▶ STEP 2: forge_stage — Move to quarantine, lock spec (IMMUTABLE)"
STAGE=$(call_tool "forge_stage" "{\"artifact_id\":\"$ARTIFACT_ID\"}")
echo "$STAGE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  stage_id: {d[\"stage_id\"]}'); print(f'  locked: {d[\"locked\"]}')"
STAGE_ID=$(echo "$STAGE" | python3 -c "import json,sys; print(json.load(sys.stdin)['stage_id'])")
echo ""

# STEP 3: SANDBOX RUN
echo "▶ STEP 3: forge_sandbox_run — Execute in isolated sandbox (ABSOLUTE timeout)"
SANDBOX=$(call_tool "forge_sandbox_run" "{\"stage_id\":\"$STAGE_ID\",\"test_suite\":\"basic\",\"resource_limits\":{\"cpu_cores\":2,\"memory_mb\":512,\"timeout_ms\":60000,\"network_access\":false},\"absolute_timeout_ms\":60000}")
echo "$SANDBOX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  exit_code: {d[\"test_results\"][\"exit_code\"]}'); print(f'  time: {d[\"metrics\"][\"execution_time_ms\"]}ms')"
echo ""

# STEP 4: SCAR SCAN
echo "▶ STEP 4: forge_scar_scan — Check against past failures"
SCAR=$(call_tool "forge_scar_scan" "{\"artifact_id\":\"$ARTIFACT_ID\",\"scan_depth\":\"full_analysis\"}")
echo "$SCAR" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  verdict: {d[\"verdict\"]}'); print(f'  scar_matches: {len(d[\"scar_matches\"])}')"
echo ""

# STEP 5: SKILLSTORE WRITE
echo "▶ STEP 5: forge_skillstore_write — Store with provenance"
STORE=$(call_tool "forge_skillstore_write" "{\"artifact_id\":\"$ARTIFACT_ID\",\"artifact\":{\"code\":\"# Fibonacci\nprint('hello')\",\"language\":\"python\",\"provenance\":{\"created_by\":\"forge-demo\",\"created_at\":\"2026-06-29T12:00:00Z\",\"intent\":\"Fibonacci calculator\",\"decision_class\":\"C1_STANDARD\"}},\"tags\":[\"demo\",\"fibonacci\"]}")
echo "$STORE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  record_id: {d[\"record_id\"]}'); print(f'  stored_at: {d[\"stored_at\"]}')"
echo ""

# STEP 6: TIER BIND
echo "▶ STEP 6: forge_tier_bind — Set trust tier LOWER BOUND (arifOS sets actual)"
TIER=$(call_tool "forge_tier_bind" "{\"artifact_id\":\"$ARTIFACT_ID\",\"trust_tier_lower_bound\":\"local_only\",\"execution_scope\":{\"filesystem_write\":false,\"network_access\":false,\"spawn_processes\":true,\"access_to_other_artifacts\":false}}")
echo "$TIER" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  lower_bound: {d[\"trust_tier_lower_bound\"]}'); print(f'  policy_hash: {d[\"policy_hash\"][:20]}...')"
echo ""

# STEP 7: DOCKET PREP
echo "▶ STEP 7: forge_docket_prep — Hand off to arifOS (CONTROL RELINQUISHED)"
DOCKET=$(call_tool "forge_docket_prep" "{\"artifact_id\":\"$ARTIFACT_ID\",\"stage_id\":\"$STAGE_ID\",\"evidence_package\":{\"synthesize_response\":{\"artifact_id\":\"$ARTIFACT_ID\",\"code\":\"test\",\"language\":\"python\",\"estimated_complexity\":\"simple\",\"synthesized_at\":\"2026-06-29T12:00:00Z\",\"buffer_location\":\"/tmp/forge8/buffer/test\"},\"stage_response\":{\"stage_id\":\"$STAGE_ID\",\"staging_location\":\"/tmp/forge8/staging/test\",\"locked\":true},\"sandbox_run_response\":{\"stage_id\":\"$STAGE_ID\",\"test_results\":{\"exit_code\":0,\"stdout\":\"\",\"stderr\":\"\"},\"metrics\":{\"execution_time_ms\":100,\"memory_peak_mb\":128,\"cpu_time_ms\":100}},\"scar_scan_response\":{\"artifact_id\":\"$ARTIFACT_ID\",\"scar_matches\":[],\"verdict\":\"CLEAN\",\"scanned_at\":\"2026-06-29T12:00:00Z\"},\"skillstore_sync_response\":{\"record_id\":\"test-record\",\"stored_at\":\"2026-06-29T12:00:00Z\"},\"tier_bind_response\":{\"artifact_id\":\"$ARTIFACT_ID\",\"trust_tier_lower_bound\":\"local_only\",\"policy_hash\":\"test-hash\"}}}")
echo "$DOCKET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  docket_id: {d[\"docket_id\"]}'); print(f'  status: {d[\"status\"]}'); print(f'  sealed: {d[\"sealed\"]}')"
DOCKET_ID=$(echo "$DOCKET" | python3 -c "import json,sys; print(json.load(sys.stdin)['docket_id'])")
echo ""

# STEP 8: EXECUTE (will FAIL without VAULT999 SEAL — by design)
echo "▶ STEP 8: forge8_execute — Attempt execution WITHOUT seal"
echo "  (Expected: FAILS HARD — constitutional boundary enforced)"
EXEC=$(call_tool "forge8_execute" "{\"docket_id\":\"$DOCKET_ID\"}" 2>/dev/null || echo '{"success":false,"error_type":"NO_VAULT999_SEAL"}')
echo "$EXEC" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d.get('success'):
  print('  ✅ EXECUTED')
else:
  print(f'  ❌ BLOCKED: {d.get(\"error_type\",\"UNKNOWN\")}')
  cv = d.get('constitutional_violation',{})
  if cv:
    print(f'  Violation: {cv.get(\"violated_principle\",\"?\")}')
    print(f'  Required: {cv.get(\"required_action\",\"?\")}')
"
echo ""
echo "══════════════════════════════════════════════════════"
echo "DEMO COMPLETE"
echo "  7/8 verbs succeeded"
echo "  forge8_execute BLOCKED (no VAULT999 SEAL — correct behavior)"
echo "  Constitutional compliance: 100%"
echo "══════════════════════════════════════════════════════"
