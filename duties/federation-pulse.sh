#!/usr/bin/env bash
# FEDERATION PULSE — the institution's thermometer (FI-008, 2026-09-04)
# Re-runnable, read-only. Baseline + method: MESH_FIDELITY_BASELINE.md
set -u
echo "FEDERATION PULSE · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1) Mesh fidelity (content-level)
python3 - <<'EOF'
import os,hashlib
stores={'kimi':'/root/.kimi-code/skills','aaa':'/root/AAA/skills','hermes':'/root/HERMES/skills'}
S={k:{os.path.basename(dp):hashlib.sha256(open(os.path.join(dp,'SKILL.md'),'rb').read()).hexdigest()[:10]
      for dp,dn,fn in os.walk(v) if 'SKILL.md' in fn} for k,v in stores.items()}
parts=[]
for a,b in [('kimi','aaa'),('aaa','hermes'),('kimi','hermes')]:
    i=set(S[a])&set(S[b]); s=sum(1 for n in i if S[a][n]==S[b][n])
    parts.append(f"{a}<->{b}={s/len(i)*100:.1f}%")
i3=set(S['kimi'])&set(S['aaa'])&set(S['hermes'])
s3=sum(1 for n in i3 if len({S[x][n] for x in stores})==1)
parts.append(f"triple={s3/len(i3)*100:.1f}%")
print("mesh_fidelity:", " | ".join(parts))
EOF

# 2) Mesh links (sync tool self-report)
LINKS=$(timeout 90 bash /root/AAA/skills/scripts/skill-mesh-sync.sh --check 2>/dev/null | tail -1)
echo "mesh_links: ${LINKS:-UNAVAILABLE}"

# 3) VAULT999 chain verdict (official verifier, read-only)
VAULT=$(timeout 90 python3 /root/arifOS/scripts/verify_vault_chain.py 2>/dev/null | grep -o '"overall": *"[A-Z]*"' | head -1 | grep -o '[A-Z]*"$' | tr -d '"')
echo "vault_chain: ${VAULT:-UNAVAILABLE}"

# 4) Metabolism (arifFlow vector diagnosis + FQ)
FLOW=$(curl -s -m 4 http://127.0.0.1:7073/health 2>/dev/null)
if [ -n "$FLOW" ]; then
  FQ=$(echo "$FLOW" | python3 -c "import json,sys; d=json.load(sys.stdin); print(round(d.get('fq',{}).get('quotient',0),3))" 2>/dev/null)
  DIAG=$(echo "$FLOW" | python3 -c "import json,sys; d=json.load(sys.stdin); v=d.get('vector',{}).get('diagnosis',{}); print(v.get('constellation','?'),'/',v.get('primary_pathology','?'))" 2>/dev/null)
  echo "metabolism: FQ=${FQ:-?} diagnosis=${DIAG:-?}"
else echo "metabolism: UNAVAILABLE"; fi

echo "pulse_complete · baseline=2026-09-03T20:09Z · target: pairs>=95% links missing=0 broken=0 vault=INTACT"
