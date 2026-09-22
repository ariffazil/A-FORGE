#!/usr/bin/env bash
# apply-litellm-config.sh — THE fix for the stale bind-mount trap.
#
# Why this exists (2026-09-22, FI-008):
#   litellm-federation runs as `docker run -v /root/A-FORGE/litellm-config.yaml:/app/config.yaml`.
#   Docker bind-mounts a SINGLE FILE by inode. Any edit that replaces the file (vim, cp, most
#   editors) creates a NEW inode — the running container keeps serving the OLD content until
#   restart. Observed failure: config edited 12:33, container started 00:57 prior day, fallbacks
#   section invisible in-process => token-plan 429 was terminal ("No fallback model group found").
#
# Usage:  apply-litellm-config.sh [--no-restart]
# Steps:  1) YAML validate  2) structural diff vs last-applied  3) restart  4) health gate
#         5) canary chat completion  6) record applied checksum
set -euo pipefail

CFG=/root/A-FORGE/litellm-config.yaml
UNIT=litellm-federation
MARKER=/root/A-FORGE/.litellm-config.applied.sha256
GW=http://127.0.0.1:4013
KEY=$(grep -oE 'LITELLM_MASTER_KEY=sk-[A-Za-z0-9_.-]+' /root/.secrets/kunci-mas.flat.env | head -1 | cut -d= -f2)

echo "== 1) YAML validate =="
python3 - "$CFG" <<'PY'
import sys, yaml
cfg = yaml.safe_load(open(sys.argv[1]))
assert isinstance(cfg, dict) and 'model_list' in cfg, "missing model_list"
n = len(cfg['model_list'])
fb = cfg.get('router_settings', {}).get('fallbacks') or cfg.get('fallbacks') or []
print(f"OK: model_list={n} deployments, fallbacks={len(fb)} groups")
PY

NEW_SHA=$(sha256sum "$CFG" | cut -d' ' -f1)
OLD_SHA=$(cat "$MARKER" 2>/dev/null || echo none)
if [ "$NEW_SHA" = "$OLD_SHA" ]; then
  echo "== config unchanged since last apply (marker match) =="
else
  echo "== 2) checksum: ${OLD_SHA:0:12} -> ${NEW_SHA:0:12} =="
fi

if [ "${1:-}" = "--no-restart" ]; then
  echo "SKIP restart (--no-restart). Marker NOT updated."
  exit 0
fi

echo "== 3) restart $UNIT (re-does the bind mount -> fresh inode) =="
systemctl restart "$UNIT"

echo "== 4) health gate =="
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$GW/health/liveliness" || echo 000)
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "FAIL: gateway not healthy after 90s (code=$code)"; exit 1
fi
echo "healthy after ~$((i*2))s"

echo "== 5) canary =="
CAN=$(curl -s --max-time 30 "$GW/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"mimo-v2.6-flash-payg","messages":[{"role":"user","content":"reply exactly: APPLY_OK"}],"max_tokens":20}')
echo "$CAN" | python3 -c "import sys,json; d=json.load(sys.stdin); c=d['choices'][0]['message']['content']; assert 'APPLY_OK' in c, d; print('canary OK:', c)"

echo "$NEW_SHA" > "$MARKER"
echo "== APPLIED ${NEW_SHA:0:12} =="
