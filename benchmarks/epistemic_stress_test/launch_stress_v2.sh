#!/bin/bash
# AGENTIC_EPISTEMIC_STRESS_TEST_V2 — 3 lanes x 5 runs, structural egress isolation.
set -a
source /root/.secrets/kunci-root.env
source /root/.secrets/kunci-mas.env
set +a

# Structural isolation: everything except api.minimax.io dies at a dead proxy.
export HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 ALL_PROXY=socks5://127.0.0.1:9
export NO_PROXY=api.minimax.io
export no_proxy=api.minimax.io

cd /root/A-FORGE/benchmarks/epistemic_stress_test

echo "=== ISOLATION PROOF $(date -u +%FT%TZ) ==="
echo "-- egress to google.com through dead proxy (MUST FAIL):"
curl -s -m 4 -o /dev/null -w "google.com -> HTTP %{http_code}\n" https://www.google.com || echo "google.com -> BLOCKED (exit $?)"
echo "-- egress to minimax chat (MUST WORK):"
python3 - <<'EOF'
import os
from openai import OpenAI
c = OpenAI(api_key=os.environ["MINIMAX_API_KEY"], base_url="https://api.minimax.io/v1")
r = c.chat.completions.create(model="MiniMax-M3", messages=[{"role":"user","content":"Reply with the single word: PONG"}], max_tokens=10, temperature=0)
print("minimax ->", r.choices[0].message.content, "| usage:", r.usage.prompt_tokens, "in /", r.usage.completion_tokens, "out")
EOF
echo "=== BEGIN RUNS $(date -u +%FT%TZ) ==="
for lane in A B C; do
	echo "--- lane=$lane start $(date -u +%FT%TZ)"
	python3 run_stress_v2.py "$lane" 5 || echo "RUN_FAIL lane=$lane"
done
echo "=== ALL RUNS COMPLETE $(date -u +%FT%TZ) ==="
ls outputs_v2/ | wc -l
