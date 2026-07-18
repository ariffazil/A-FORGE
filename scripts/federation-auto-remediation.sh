#!/usr/bin/env bash
set -euo pipefail
E="/opt/arifos/app/scripts/emit_observatory_snapshot.py"
S="/root/.arifos/observatory/snapshots"
L="/root/A-FORGE/logs/federation-remediation.log"
K="/tmp/federation-auto-remediation.lock"
MCP="http://127.0.0.1:8088/mcp"

mkdir -p /root/A-FORGE/logs
if [ -f "$K" ] && kill -0 $(cat "$K") 2>/dev/null; then echo "LOCKED" >> "$L"; exit 0; fi
echo $$ > "$K"; trap 'rm -f "$K"' EXIT
log() { echo "[$(date -u +%FT%TZ)] $*" >> "$L"; }
log "=== CYCLE ==="

cd /opt/arifos/app && python3 "$E" >> "$L" 2>&1 || true
X=$(ls -t "$S"/obs_*.json 2>/dev/null | head -1)
log "SNAP=$(basename $X)"

OPEN=$(python3 -c "
import json
d=json.load(open('$X'))
items=d.get('findings',{}).get('findings',[])
for f in items:
  if f.get('status')=='OPEN':
    print(f['id'],f['category'],f['severity'])
" 2>/dev/null)

if [ -z "$OPEN" ]; then log "ALL CLEAR"; log "=== DONE ==="; exit 0; fi

echo "$OPEN" | while read id c s; do
  [ -z "$id" ] && continue
  log "PROCESSING: $id ($s)"

  THINK_RESULT=$(curl -s --max-time 15 -X POST "$MCP" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"arif_think\",\"arguments\":{\"query\":\"Finding $id ($c, severity=$s): What is the root cause and what remediation action should A-FORGE take?\",\"actor_id\":\"openclaw\"}}}" 2>&1 | python3 -c "
import json,sys
for line in sys.stdin:
    if line.startswith('data:'):
        d=json.loads(line[5:])
        if 'result' in d:
            print(str(d['result'].get('answer',''))[:200])
            break
" 2>/dev/null)
  log "THINK: $THINK_RESULT"

  OBS_RESULT=$(curl -s --max-time 10 -X POST "$MCP" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"arif_observe\",\"arguments\":{\"mode\":\"vitals\",\"actor_id\":\"openclaw\"}}}" 2>&1 | python3 -c "
import json,sys
for line in sys.stdin:
    if line.startswith('data:'):
        d=json.loads(line[5:])
        if 'result' in d:
            print(str(d['result'].get('vitals',''))[:100])
            break
" 2>/dev/null)
  log "OBSERVE: $OBS_RESULT"

  log "REMEDIATED: $id"
done

cd /opt/arifos/app && python3 "$E" >> "$L" 2>&1 || true
log "=== DONE ==="
