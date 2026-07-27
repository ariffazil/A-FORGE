#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# arifOS Federation — A-FORGE Governance Gate Eval
# Phase 1: Gate instrumentation harness (2026-07-27)
# DITEMPA BUKAN DIBERI ⚒️
# ═══════════════════════════════════════════════════════════════════════════
#
# PURPOSE:
#   Toggle each gate ON/OFF and measure pass rate delta across the test suite.
#   Answers: "Which gates actually block execution, and which are transparent?"
#
# USAGE:
#   bash scripts/eval_governance.sh [--quick] [--suite <pattern>] [--repeat N]
#     --quick         Run only AmanahLockManager + AgentEngine tests (faster)
#     --suite <pat>   Run specific test pattern (e.g. "engine|amanah")
#     --repeat N      Run each configuration N times (default 1)
#     --json          Output JSON instead of terminal table
#
# OUTPUT:
#   Terminal table or JSON with pass rate per gate configuration.
#   Also writes reports/eval_governance_<timestamp>.json for audit trail.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FORGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$FORGE_ROOT/reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT_FILE="$REPORT_DIR/eval_governance_${TIMESTAMP}.json"

QUICK=false
SUITE_PATTERN=""
REPEAT=1
JSON_OUT=false
OUTPUT_MODE="terminal"

for arg in "$@"; do
    case "$arg" in
        --quick) QUICK=true ;;
        --suite) SUITE_PATTERN="${2:-}"; shift ;;
        --repeat) REPEAT="${2:-1}"; shift ;;
        --json) JSON_OUT=true ;;
    esac
    shift 2>/dev/null || true
done

# ─── TEST TARGETS ──────────────────────────────────────────────────────────
if [ -n "$SUITE_PATTERN" ]; then
    TEST_TARGET="dist/test/ --test-name-pattern='$SUITE_PATTERN'"
elif [ "$QUICK" = true ]; then
    TEST_TARGET="dist/test/AmanahLockManager.test.js dist/test/AgentEngine.test.js dist/test/CoolingGate.test.js dist/test/PlanValidator.test.js"
else
    TEST_TARGET="dist/test/"
fi

# ─── GATE CONFIGURATIONS ────────────────────────────────────────────────────
# Each config: name + env vars to set
declare -A GATE_ENV
GATE_ENV["baseline"]=""                                                    # All gates ON
GATE_ENV["skip-model-gate"]="FORGE_SKIP_MODEL_GATE=1"                      # ModelCapabilityGate OFF
GATE_ENV["skip-plan-governance"]="FORGE_SKIP_PLAN_GOVERNANCE=1"            # PlanGovernanceGate OFF
GATE_ENV["skip-amanah-lock"]="FORGE_SKIP_AMANAH_LOCK=1"                    # AmanahLockManager OFF
GATE_ENV["skip-model+plan"]="FORGE_SKIP_MODEL_GATE=1 FORGE_SKIP_PLAN_GOVERNANCE=1"
GATE_ENV["all-off"]="FORGE_SKIP_MODEL_GATE=1 FORGE_SKIP_PLAN_GOVERNANCE=1 FORGE_SKIP_AMANAH_LOCK=1"

GATE_ORDER=("baseline" "skip-model-gate" "skip-plan-governance" "skip-amanah-lock" "skip-model+plan" "all-off")

# ─── BUILD ONCE ────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ⚒️  A-FORGE Governance Gate Eval — Phase 1     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  timestamp: $TIMESTAMP"
echo "  test_target: $TEST_TARGET"
echo "  repeat: $REPEAT"
echo ""

cd "$FORGE_ROOT"

echo "  [1/3] Building..."
npm run build 2>&1 | tail -1 || {
    echo "  ❌ Build failed. Cannot proceed."
    exit 1
}
echo "  ✅ Build complete"
echo ""

# ─── RUN EVAL ──────────────────────────────────────────────────────────────
declare -A RESULTS
RUN_NUM=1

while [ "$RUN_NUM" -le "$REPEAT" ]; do
    if [ "$REPEAT" -gt 1 ]; then
        echo "  [2/3] Run $RUN_NUM / $REPEAT"
    else
        echo "  [2/3] Running gate configurations..."
    fi

    for gate in "${GATE_ORDER[@]}"; do
        env_vars="${GATE_ENV[$gate]}"
        
        # Run tests with specified env vars
        set +e
        if [ -n "$env_vars" ]; then
            test_output=$(eval "export $env_vars && node --test $TEST_TARGET 2>&1")
        else
            test_output=$(node --test "$TEST_TARGET" 2>&1)
        fi
        exit_code=$?
        set -e
        
        # Parse: count passed / failed tests
        passed=0
        failed=0
        total="?"
        pass_rate="N/A"
        
        # Count by Node test harness output: "tests X" / "pass X" / "fail X"
        harness_total=$(echo "$test_output" | grep -oP 'tests \K\d+' 2>/dev/null | tail -1 || true)
        harness_pass=$(echo "$test_output" | grep -oP 'pass \K\d+' 2>/dev/null | tail -1 || true)
        harness_fail=$(echo "$test_output" | grep -oP 'fail \K\d+' 2>/dev/null | tail -1 || true)
        
        if [ -n "${harness_total:-}" ] && [ "${harness_total:-}" != "" ]; then
            total="${harness_total}"
            passed="${harness_pass:-0}"
            failed="${harness_fail:-0}"
        fi
        
        if [ "${total:-?}" != "?" ] && [ "${total:-0}" != "0" ]; then
            pass_rate="${passed}/${total}"
        fi
        
        key="${gate}_${RUN_NUM}"
        RESULTS["${key}_total"]="${total:-?}"
        RESULTS["${key}_passed"]="${passed:-0}"
        RESULTS["${key}_failed"]="${failed:-0}"
        RESULTS["${key}_exit"]="${exit_code:-0}"
        RESULTS["${key}_pass_rate"]="${pass_rate:-N/A}"
        
        symbol="✅"
        [ "$exit_code" -ne 0 ] && symbol="❌"
        echo "    $symbol $gate :: pass=$passed fail=$failed total=$total"
    done
    
    RUN_NUM=$((RUN_NUM + 1))
done

echo ""

# ─── REPORT ─────────────────────────────────────────────────────────────────
echo "  [3/3] Generating report..."

# Build JSON report
python3 -c "
import json, os, sys

results = {}
for gate in ['baseline','skip-model-gate','skip-plan-governance','skip-amanah-lock','skip-model+plan','all-off']:
    run_data = []
    for r in range(1, int(os.environ.get('REPEAT','1'))+1 if len(sys.argv)<=1 else int(sys.argv[1])+1):
        key_prefix = f'${gate}_{r}_'
        run_data.append({
            'run': r,
            'total': os.environ.get(key_prefix+'total','?'),
            'passed': os.environ.get(key_prefix+'passed','?'),
            'failed': os.environ.get(key_prefix+'failed','?'),
            'exit_code': os.environ.get(key_prefix+'exit','?'),
            'pass_rate': os.environ.get(key_prefix+'pass_rate','?'),
        })
    results[gate] = run_data

# Compute baseline delta
baseline_pass = results.get('baseline',[{}])[0].get('passed','?')
baseline_total = results.get('baseline',[{}])[0].get('total','?')
baseline_rate = results.get('baseline',[{}])[0].get('pass_rate','?')

report = {
    'timestamp': '$TIMESTAMP',
    'phase': 1,
    'test_target': '$TEST_TARGET',
    'repeat': $REPEAT,
    'baseline': {'passed': baseline_pass, 'total': baseline_total, 'pass_rate': baseline_rate},
    'gates': {},
}

for gate in ['skip-model-gate','skip-plan-governance','skip-amanah-lock','skip-model+plan','all-off']:
    rd = results.get(gate,[{}])[0]
    gpass = rd.get('passed','?')
    gtotal = rd.get('total','?')
    grate = rd.get('pass_rate','?')
    
    # Compute delta
    delta_passed = 'N/A'
    if isinstance(baseline_pass, str) and baseline_pass.isdigit() and isinstance(gpass, str) and gpass.isdigit():
        delta_passed = int(gpass) - int(baseline_pass)
    
    report['gates'][gate] = {
        'passed': gpass,
        'total': gtotal,
        'pass_rate': grate,
        'delta_vs_baseline': delta_passed,
        'exit_code': rd.get('exit_code','?'),
    }

# Add findings
report['findings'] = {
    'phase_1_observations': [
        'Pass rate data from existing test suite — fixtures not gate-specific yet',
        'Phase 2 required for false positive / false negative rates',
        'Coverage gaps: ModelCapabilityGate=0 tests, GovernanceBridge=0 tests, ApprovalBoundary=0 tests',
        'AmanahLockManager=5 tests, CoolingGate=11 tests',
    ],
    'doc_vs_code_divergence': {
        'AGENTS.md_claims': '4-layer gate: AmanahLock → ModelCapabilityGate → GovernanceBridge → ApprovalBoundary',
        'AgentEngine.ts_reality': 'ModelCapabilityGate → PlanGovernanceGate (+ AmanahLockManager in FileTools)',
        'GovernanceBridge_actual': 'APEX G computation bridge in evaluate.ts — NOT in execution pipeline',
        'ApprovalBoundary_actual': 'Hold queue for ticket creation — NOT an active blocking gate',
    },
    'recommendation': 'Proceed to Phase 2: build dedicated gate test fixtures with ground-truth labels'
}

with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2, default=str)

print(f'  📄 Report: $REPORT_FILE')
" "$REPEAT"

echo ""

# ─── TERMINAL SUMMARY TABLE ────────────────────────────────────────────────
if [ "$JSON_OUT" = false ]; then
    echo "  ┌─────────────────────────┬───────┬───────┬──────────┬──────────────┐"
    echo "  │ Gate Configuration      │ Pass  │ Fail  │ Total    │ Δ Baseline   │"
    echo "  ├─────────────────────────┼───────┼───────┼──────────┼──────────────┤"
    
    baseline_passed="${RESULTS["baseline_1_passed"]:-0}"
    baseline_failed="${RESULTS["baseline_1_failed"]:-0}"
    baseline_total="${RESULTS["baseline_1_total"]:-?}"
    
    for gate in "${GATE_ORDER[@]}"; do
        gpassed="${RESULTS["${gate}_1_passed"]:-0}"
        gfailed="${RESULTS["${gate}_1_failed"]:-0}"
        gtotal="${RESULTS["${gate}_1_total"]:-?}"
        gratio="${RESULTS["${gate}_1_pass_rate"]:-N/A}"
        
        # Compute delta
        delta="N/A"
        if [[ "$baseline_passed" =~ ^[0-9]+$ ]] && [[ "$gpassed" =~ ^[0-9]+$ ]]; then
            d=$((gpassed - baseline_passed))
            delta="$d"
        fi
        
        label="$gate"
        [ "$gate" = "baseline" ] && label="baseline (all ON)"
        printf "  │ %-23s │ %5s │ %5s │ %8s │ %12s │\n" "$label" "$gpassed" "$gfailed" "$gtotal" "$delta"
    done
    
    echo "  └─────────────────────────┴───────┴───────┴──────────┴──────────────┘"
    echo ""
    echo "  ⚠️  Phase 1 CAVEAT: These results use existing test suites — not"
    echo "  dedicated gate fixtures. Δ=0 likely means the gate is untested,"
    echo "  not that it has no impact. Phase 2 (dedicated fixtures) required."
    echo ""
fi

# ─── SEAL TO VAULT999 ──────────────────────────────────────────────────────
echo "  📋 Report: $REPORT_FILE"

# Also output JSON if requested
if [ "$JSON_OUT" = true ]; then
    cat "$REPORT_FILE"
fi

exit 0
