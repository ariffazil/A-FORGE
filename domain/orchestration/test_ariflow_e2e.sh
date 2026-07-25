#!/usr/bin/env bash
# arifFlow E2E Integration Test
# Spawns Rust binary, pipes topology, verifies protocol compliance
# DITEMPA BUKAN DIBERI — 2026-07-25

set -euo pipefail

BINARY="${1:-/root/arifFlow/target/release/ariflow}"
PASS=0
FAIL=0

green() { echo "✅ $1"; PASS=$((PASS+1)); }
red() { echo "❌ $1"; FAIL=$((FAIL+1)); }

# Generate valid UUIDs
UUID_A=$(uuidgen 2>/dev/null || echo "11111111-1111-4111-8111-111111111111")
UUID_B=$(uuidgen 2>/dev/null || echo "22222222-2222-4222-8222-222222222222")

# ── Test 1: Configure + seed + step → need_verdict ──────────────────
echo "=== Test 1: Configure → seed → step → need_verdict ==="
OUTPUT=$(printf '{"type":"configure","topology":"fan_out","lease_id":"%s","actor_id":"arif","chain_id":"%s"}
{"type":"seed","channel":"input","data":"hello world"}
{"type":"step","nodes":[{"id":"node-1","subs":["input"],"outputs":["output"]}]}
{"type":"stop"}' "$UUID_A" "$UUID_B" | "$BINARY" 2>/dev/null || true)

if echo "$OUTPUT" | grep -q "need_verdict"; then
    green "step() returned need_verdict"
else
    red "step() did not return need_verdict"
    echo "OUTPUT: $OUTPUT"
fi

if echo "$OUTPUT" | grep -q "cooling"; then
    green "stop() returned cooling receipt"
else
    red "stop() did not return cooling receipt"
fi

# ── Test 2: Configure + seed + step + verdict → step_result ────────
echo ""
echo "=== Test 2: Configure → seed → step → verdict → step_result ==="
OUTPUT2=$(printf '{"type":"configure","topology":"fan_out","lease_id":"%s","actor_id":"arif","chain_id":"%s"}
{"type":"seed","channel":"input","data":"test data"}
{"type":"step","nodes":[{"id":"node-1","subs":["input"],"outputs":["output"]}]}
{"type":"verdict","class":"SEAL","verdict_id":"aaa","hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
{"type":"stop"}' "$UUID_A" "$UUID_B" | "$BINARY" 2>/dev/null || true)

if echo "$OUTPUT2" | grep -q "step_result"; then
    green "verdict → step_result received"
else
    red "verdict → step_result not received"
    echo "OUTPUT2: $OUTPUT2"
fi

if echo "$OUTPUT2" | grep -q "SEAL"; then
    green "step_result verdict = SEAL"
else
    red "step_result verdict ≠ SEAL"
fi

# ── Test 3: Multiple steps ──────────────────────────────────────────
echo ""
echo "=== Test 3: Multiple steps ==="
OUTPUT3=$(printf '{"type":"configure","topology":"fan_out","lease_id":"%s","actor_id":"arif","chain_id":"%s"}
{"type":"seed","channel":"input","data":"step0"}
{"type":"step","nodes":[{"id":"node-1","subs":["input"],"outputs":["output"]}]}
{"type":"verdict","class":"SEAL","verdict_id":"bbb","hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
{"type":"step","nodes":[{"id":"node-2","subs":["output"],"outputs":["output2"]}]}
{"type":"verdict","class":"SEAL","verdict_id":"ccc","hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}
{"type":"stop"}' "$UUID_A" "$UUID_B" | "$BINARY" 2>/dev/null || true)

STEP_COUNT=$(echo "$OUTPUT3" | grep -c "step_result" || true)
if [ "$STEP_COUNT" -ge 2 ]; then
    green "2 step_results received"
else
    red "Expected 2 step_results, got $STEP_COUNT"
    echo "OUTPUT3: $OUTPUT3"
fi

# ── Test 4: HOLD verdict ────────────────────────────────────────────
echo ""
echo "=== Test 4: HOLD verdict ==="
OUTPUT4=$(printf '{"type":"configure","topology":"fan_out","lease_id":"%s","actor_id":"arif","chain_id":"%s"}
{"type":"seed","channel":"input","data":"hold test"}
{"type":"step","nodes":[{"id":"node-h","subs":["input"],"outputs":["output"]}]}
{"type":"verdict","class":"HOLD","verdict_id":"ddd","hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}
{"type":"stop"}' "$UUID_A" "$UUID_B" | "$BINARY" 2>/dev/null || true)

if echo "$OUTPUT4" | grep -q "HOLD"; then
    green "HOLD verdict processed"
else
    red "HOLD verdict not found"
    echo "OUTPUT4: $OUTPUT4"
fi

# ── Test 5: Kabarkan AFQ field present ──────────────────────────────
echo ""
echo "=== Test 5: AFQ in need_verdict ==="
OUTPUT5=$(printf '{"type":"configure","topology":"fan_out","lease_id":"%s","actor_id":"arif","chain_id":"%s"}
{"type":"seed","channel":"input","data":"afq_test"}
{"type":"step","nodes":[{"id":"node-afq","subs":["input"],"outputs":["output"]}]}
{"type":"stop"}' "$UUID_A" "$UUID_B" | "$BINARY" 2>/dev/null || true)

AFQ=$(echo "$OUTPUT5" | grep "need_verdict" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('afq','MISSING'))" 2>/dev/null || echo "MISSING")
if [ "$AFQ" != "MISSING" ]; then
    green "AFQ field present in need_verdict: $AFQ"
else
    red "AFQ field missing from need_verdict"
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  arifFlow E2E: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

[ "$FAIL" -eq 0 ]
