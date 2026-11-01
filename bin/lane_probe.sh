#!/usr/bin/env bash
# lane_probe — probe FED lane liveness, fail sementara BARU setiap lane.
#
# Sebab wujud (2026-11-01, 333-AGI): bug bukti basi menangkap probe tiga kali
# dalam satu sesi — /tmp/opencode/l2.json tak dipotong antara lane, jadi
# content='ok' pada HTTP000 ialah sisa fail LEPAS, bukan respons lane itu.
# Disiplin "jangan lupa rm" gagal tiga kali berturut. Ubah jadi MEKANISMA:
# mktemp setiap lane supaya probe akan datang tak bergantung pada ingatan agent.
#
# Output: satu baris JSON per lane, dengan medan yang bukti itu sendiri perlukan:
#   ts              masa probe (bukti basi = tak bermakna tanpa ni)
#   samples         bilangan sampel dalam probe ni
#   http            status transport (BUKAN capability)
#   content_chars   panjang kandungan — 200 + 0 char = UNKNOWN, bukan hidup
#   failure_class   DURABLE_402 | TRANSIENT_RATELIMIT | UNKNOWN_NAME |
#                   EMPTY_200 | TRANSPORT_FAIL | NONE
#                   (kelas wajib: tanpa ni, TRANSIENT tak bermakna — sesi depan
#                    tak tahu dah berapa basi label itu)
set -u
BASE="${FED_BASE:-http://127.0.0.1:4000/v1/chat/completions}"
TOKENS="${MAX_TOKENS:-16}"
for m in "$@"; do
	f="$(mktemp -u /tmp/opencode/laneprobe.XXXXXX.json)" # BARU setiap lane
	code=$(curl -s -m 25 -o "$f" -w '%{http_code}' "$BASE" \
		-H 'Content-Type: application/json' \
		-d "{\"model\":\"$m\",\"messages\":[{\"role\":\"user\",\"content\":\"say ok\"}],\"max_tokens\":$TOKENS}" 2>/dev/null)
	ts="$(date -u +%FT%TZ)"
	python3 - "$m" "$code" "$f" "$ts" "$TOKENS" <<'PY'
import json,sys,os,re
m,code,path,ts,tokens=sys.argv[1:6]
raw=open(path,'rb').read() if os.path.exists(path) else b''
os.unlink(path) if os.path.exists(path) else None
body=raw.decode('utf-8','replace').strip()
content=None; err=''
try:
    d=json.loads(body)
    content=((d.get('choices') or [{}])[0].get('message') or {}).get('content')
    err=(d.get('error') or {}).get('message','') if isinstance(d.get('error'),dict) else ''
except Exception:
    err=body[:160]
n=len(content or '')
def klass(code,n,err,raw):
    if code in ('000','') or not raw: return 'TRANSPORT_FAIL'
    if code=='400' and 'Invalid model name' in err: return 'UNKNOWN_NAME'
    if code=='402':
        if 'rate' in err.lower() or 'too many' in err.lower(): return 'TRANSIENT_RATELIMIT'
        return 'DURABLE_402'
    if code=='200' and n==0: return 'EMPTY_200'
    if code=='200': return 'NONE'
    return 'OTHER_%s'%code
print(json.dumps({"model":m,"ts":ts,"samples":1,"http":code,
                  "content_chars":n,"failure_class":klass(code,n,err,raw),
                  "err":err[:120]}))
PY
done
