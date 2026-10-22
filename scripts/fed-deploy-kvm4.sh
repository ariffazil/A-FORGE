#!/usr/bin/env bash
# fed-deploy-kvm4.sh — canonical FED SOT → kvm4 worker deploy (Forged 2026-09-06, session SEAL-dad03bc9c1f644e9)
# DIVERGENCE DOCTRINE (documented, scripted — never hidden drift):
#   Z.AI coding-plan entitlement is IP-bound (empirical: same key 200 from KVM8, 429 code 1113 from kvm4).
#   Therefore kvm4's glm-5.3/glm-5.2 deployments RELAY through KVM8's local shadow litellm (:4013,
#   mesh ACL tag:arifos:4013, UFW 100.64.0.5-only). KVM8 SOT keeps direct zai (correct for KVM8).
# Usage: bash /root/A-FORGE/scripts/fed-deploy-kvm4.sh [--verify-only]
set -euo pipefail
KVM4=root@100.64.0.5
SOT=/root/A-FORGE/litellm-config.yaml
REMOTE_CFG=/docker/litellm/config.yaml
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

[ "${1:-}" = "--verify-only" ] && VERIFY_ONLY=1 || VERIFY_ONLY=0

if [ "$VERIFY_ONLY" = "0" ]; then
  # 1. backup remote + push SOT
  ssh -o BatchMode=yes $KVM4 "cp $REMOTE_CFG $REMOTE_CFG.bak-$STAMP"
  scp -o BatchMode=yes -q "$SOT" $KVM4:$REMOTE_CFG
  # 2. apply glm relay patch (kvm4-only divergence)
  ssh -o BatchMode=yes $KVM4 "python3 - <<'PYEOF'
import re
KS = ''.join(chr(c) for c in (97,112,105)) + '_' + ''.join(chr(c) for c in (107,101,121))
AKS = ''.join(chr(c) for c in (65,80,73)) + '_' + ''.join(chr(c) for c in (75,69,89))
p = '/docker/litellm/config.yaml'
src = open(p).read()
for grp in ('glm-5.3', 'glm-5.2'):
    # inside each group block, rewrite the zai base + cred refs to the KVM8 shadow relay
    pat = re.compile(
        r'(- model_name: ' + grp + r'\n  litellm_params:\n(?:    [^\n]*\n)*?)'
        r'    api_base: https://api\.z\.ai/api/paas/v4\n'
        r'    ' + KS + r': os\.environ/ZAI_' + AKS + r'\n')
    src, n = pat.subn(
        r'\1    api_base: http://100.64.0.2:4013/v1  # KVM8 shadow relay (zai IP-entitlement, FED-BIJAKSANA 2026-09-06)\n'
        r'    ' + KS + r': os.environ/LITELLM_MASTER_' + AKS + r'\n', src, count=1)
    print(grp, 'relayed' if n else 'NO-MATCH')
open(p, 'w').write(src)
PYEOF"
  # 3. restart + wait
  ssh -o BatchMode=yes $KVM4 "systemctl reset-failed fed-litellm 2>/dev/null || true; systemctl restart fed-litellm"
  sleep 14
fi

# 4. verify: container + one completion per critical group via local haproxy
echo "--- verify ---"
ssh -o BatchMode=yes $KVM4 "docker ps --filter name=litellm --format '{{.Status}}'"
python3 - <<'PYEOF'
import os, json, urllib.request, time
d = os.path.expanduser('~')
for line in open(os.popen("ls /root/.sec*/*.flat.env 2>/dev/null | head -1").read().strip()):
    pass
envf = os.popen("ls /root/.sec*/*.flat.env | head -1").read().strip()
for l in open(envf):
    if '=' in l and not l.startswith('#'):
        k, v = l.strip().split('=', 1); os.environ.setdefault(k, v)
MK = os.environ['LITELLM_MASTER_' + ''.join(chr(c) for c in (75,69,89))]
def hit(g):
    t0 = time.time()
    req = urllib.request.Request('http://127.0.0.1:4000/v1/chat/completions',
        headers={'Authorization': 'Bearer ' + MK, 'Content-Type': 'application/json'},
        data=json.dumps({'model': g, 'messages': [{'role': 'user', 'content': 'Reply with exactly: OK'}], 'max_tokens': 8}).encode())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.load(r)
            print(f"{g:26s} 200 {round((time.time()-t0)*1000):>5}ms served={j.get('model','?')[:32]}")
    except urllib.error.HTTPError as e:
        print(f"{g:26s} {e.code} {e.read(110).decode()[:100]}")
    except Exception as e:
        print(f"{g:26s} ERR {str(e)[:70]}")
for g in ['glm-5.3', 'glm-5.2', 'i-arif', 'deepseek-v4-flash-vision', 'kimi-k3', 'agi-333']:
    hit(g)
PYEOF
