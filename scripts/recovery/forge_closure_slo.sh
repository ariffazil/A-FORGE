#!/usr/bin/env bash
# forge_closure_slo.sh — Closure SLO dashboard
# Doctrine ref: ARIFOS::CLOSURE_RECOVERY::v1 LEVERAGE POINT #3
#
# Produces 4 metrics:
#   1. Unsealed sessions > 24h
#   2. Pending receipts count
#   3. Seal-pending oldest age
#   4. Closure velocity (last 24h seals emitted)

set -e

# Locate A-FORGE root from this script: scripts/recovery/forge_closure_slo.sh → ../..
A_FORGE_ROOT="$(cd "$(dirname "$0")" && cd ../.. && pwd)"
PATH_R() { python3 -c "import sys; sys.path.insert(0, '$A_FORGE_ROOT/paradox-engine'); from paths_resolver import org_path; print(org_path('$1'))"; }

OUTPUT_BASE="$(PATH_R forge_work)/closure-slo"
mkdir -p "$OUTPUT_BASE"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
SNAP="$OUTPUT_BASE/slo-${TS}.json"

echo "=== CLOSURE SLO SNAPSHOT ==="
echo "TS: $TS"

# 1. Unsealed > 24h (from opencode_receipts.jsonl)
UNSEALED_24H=$(python3 -c "
import json
from collections import defaultdict
from datetime import datetime, timezone, timedelta
sess = defaultdict(list)
with open('/root/.local/share/arifos/opencode_receipts.jsonl') as f:
    for line in f:
        try:
            d = json.loads(line)
            sid = d.get('sessionID')
            if not sid or sid=='boot': continue
            sess[sid].append(d)
        except: pass
cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
old = 0
for sid, evs in sess.items():
    evs.sort(key=lambda x: x.get('ts',''))
    if not evs: continue
    try:
        last = datetime.fromisoformat(evs[-1].get('ts','').replace('Z','+00:00'))
        if last < cutoff: old += 1
    except: pass
print(old)
" 2>/dev/null)
echo "Unsealed sessions > 24h: $UNSEALED_24H"

# 2. Pending receipts
PENDING=$(wc -l < /root/.local/share/arifos/pending_receipts.jsonl 2>/dev/null || echo 0)
echo "Pending receipts: $PENDING"

# 3. Seal-pending oldest age
SEAL_PENDING_AGE=$(python3 -c "
import os
from datetime import datetime
sp = '/root/.local/share/arifos/seal-pending'
if not os.path.isdir(sp): print(0); exit()
files = [f for f in os.listdir(sp) if os.path.isfile(os.path.join(sp,f))]
if not files: print(0); exit()
oldest = max(os.path.getmtime(os.path.join(sp,f)) for f in files)
days = (datetime.now().timestamp() - oldest) / 86400
print(f'{days:.1f}')
" 2>/dev/null)
echo "Seal-pending oldest: ${SEAL_PENDING_AGE}d"

# 4. Closure velocity (last 24h artifacts in forge_work)
CLOSURE_24H=$(find "$(PATH_R forge_work)" -name "*.md" -newermt "$(date -u -d '24 hours ago' '+%Y-%m-%d %H:%M:%S')" 2>/dev/null | wc -l)
echo "Closure artifacts (last 24h): $CLOSURE_24H"

# SLO thresholds per ARIF doctrine
echo
echo "=== SLO THRESHOLDS ==="
THRESH_UNSEALED=10
THRESH_PENDING=5
THRESH_SEAL_AGE=72
echo "Target: unsealed>24h < $THRESH_UNSEALED | pending < $THRESH_PENDING | seal-age < ${THRESH_SEAL_AGE}h"

# Verdict
VERDICT="GREEN"
[ "$UNSEALED_24H" -gt "$THRESH_UNSEALED" ] && VERDICT="YELLOW"
[ "$PENDING" -gt "$THRESH_PENDING" ] && VERDICT="YELLOW"
awk -v age="$SEAL_PENDING_AGE" -v thresh="$THRESH_SEAL_AGE" 'BEGIN{exit !(age+0 > thresh)}' && VERDICT="YELLOW"
[ "$CLOSURE_24H" -eq 0 ] && VERDICT="RED"

echo "Verdict: $VERDICT"

# Save snapshot
python3 -c "
import json
snap = {
    'ts': '$TS',
    'metrics': {
        'unsealed_over_24h': int('$UNSEALED_24H' or 0),
        'pending_receipts': int('$PENDING' or 0),
        'seal_pending_oldest_days': float('$SEAL_PENDING_AGE' or 0),
        'closure_24h': int('$CLOSURE_24H' or 0),
    },
    'thresholds': {
        'unsealed_over_24h_max': $THRESH_UNSEALED,
        'pending_max': $THRESH_PENDING,
        'seal_age_max_hours': $THRESH_SEAL_AGE,
    },
    'verdict': '$VERDICT',
    'doctrine_ref': 'ARIFOS::CLOSURE_RECOVERY::v1',
}
import os
os.makedirs('$OUTPUT_BASE', exist_ok=True)
with open('$SNAP','w') as f: json.dump(snap, f, indent=2)
print()
print(f'Snapshot: $SNAP')
"
