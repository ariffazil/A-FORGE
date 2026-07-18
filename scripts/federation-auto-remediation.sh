#!/usr/bin/env bash
set -euo pipefail
E="/opt/arifos/app/scripts/emit_observatory_snapshot.py"
S="/root/.arifos/observatory/snapshots"
L="/root/A-FORGE/logs/federation-remediation.log"
K="/tmp/federation-auto-remediation.lock"
mkdir -p /root/A-FORGE/logs
[ -f "$K" ] && kill -0 $(cat "$K") 2>/dev/null && echo "LOCKED" >> "$L" && exit 0
echo $$ > "$K"; trap 'rm -f "$K"' EXIT
log() { echo "[$(date -u +%FT%TZ)] $*" >> "$L"; }
log "=== CYCLE ==="
cd /opt/arifos/app
python3 "$E" >> "$L" 2>&1
X=$(ls -t "$S"/obs_*.json 2>/dev/null | head -1)
log "SNAP=$(basename $X)"
O=$(python3 -c "import json;d=json.load(open('$X'));items=d['findings']['findings'];[print(f['id'],f['category']) for f in items if f['status']=='OPEN']" 2>/dev/null)
[ -z "$O" ] && log "ALL CLEAR" && log "=== DONE ===" && exit 0
echo "$O" | while read id c; do
  log "OPEN: $id"
  J=$(python3 -c "import json,urllib.request;p=json.dumps({'actor':'OPENCLAW','intent':'Remediate $id','domain':'$c','reversibility_level':'FULL','blast_radius':'LOW'}).encode();r=urllib.request.Request('http://127.0.0.1:8088/mcp',data=p,headers={'Content-Type':'application/json'});d=json.loads(urllib.request.urlopen(r,timeout=10).read());print(d.get('result',{}).get('verdict','?'),d.get('result',{}).get('constitutional_chain_id',''))" 2>&1)
  V=$(echo "$J" | cut -d' ' -f1); C=$(echo "$J" | cut -d' ' -f2-)
  log "JUDGE=$V"
  [ "$V" != "SEAL" ] && log "SKIP" && continue
  log "FORGE $id"
  python3 -c "import json,urllib.request;p=json.dumps({'mode':'dry_run','intent':'auto-remediate $id','constitutional_chain_id':'$C'}).encode();r=urllib.request.Request('http://127.0.0.1:8088/mcp',data=p);print(urllib.request.urlopen(r,timeout=15).read().decode()[:200])" >> "$L" 2>&1
done
cd /opt/arifos/app && python3 "$E" >> "$L" 2>&1
log "=== DONE ==="
