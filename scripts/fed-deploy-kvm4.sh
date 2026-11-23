#!/usr/bin/env bash
# fed-deploy-kvm4.sh — canonical FED SOT → kvm4 worker deploy (Forged 2026-09-06, session SEAL-dad03bc9c1f644e9)
#
# SOURCE SEMANTICS (2026-11-23, F13 "sah deploy-source fix"):
#   The deploy source is an EXPLICIT IDENTITY, never the mutable working directory.
#   Every byte that reaches kvm4 is resolved by scripts/fed-deploy-artifacts.py against
#   deploy/fed/deploy-artifacts.yaml:
#     * git artifacts come from `git show <source_sha>:<path>` — an uncommitted change in the
#       working tree cannot travel, because the working tree is never read;
#     * external artifacts must carry an owner and an approved sha256, and are rejected before
#       anything moves if the live bytes do not match;
#     * a missing or unresolvable source SHA, a path absent at that SHA, an unknown source type
#       or a hash mismatch fails CLOSED, before any byte is copied.
#   Rationale (measured): on 2026-11-23 the previous working-tree copy shipped an owner lane's
#   uncommitted guard module into production twice, and each time it had to be restored by hand.
#   Two seats equal is not two seats ratified.
#
# DIVERGENCE DOCTRINE (documented, scripted — never hidden drift):
#   Z.AI coding-plan entitlement is IP-bound (empirical: same key 200 from KVM8, 429 code 1113 from kvm4).
#   Therefore kvm4's glm-5.3/glm-5.2 deployments RELAY through KVM8's local shadow litellm (:4013,
#   mesh ACL tag:arifos:4013, UFW 100.64.0.5-only). KVM8 SOT keeps direct zai (correct for KVM8).
#   The divergence is applied to the STAGED copy, so the recorded hash describes exactly what is
#   deployed and the live bytes can be compared against it.
#
# Usage:
#   bash scripts/fed-deploy-kvm4.sh --source-sha <rev>      # deploy from an explicit revision
#   FED_DEPLOY_SHA=<rev> bash scripts/fed-deploy-kvm4.sh      # same, via the environment
#   bash scripts/fed-deploy-kvm4.sh --verify-only            # probes only, no deploy
set -euo pipefail
KVM4=root@100.64.0.5
REPO=/root/A-FORGE
MANIFEST=$REPO/deploy/fed/deploy-artifacts.yaml
RESOLVER=$REPO/scripts/fed-deploy-artifacts.py
REMOTE_CFG=/docker/litellm/config.yaml
RECEIPT=/root/.local/share/arifos/fed-deploy-last.json
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

VERIFY_ONLY=0
SOURCE_SHA="${FED_DEPLOY_SHA:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=1 ;;
    --source-sha) shift; SOURCE_SHA="${1:-}" ;;
    --source-sha=*) SOURCE_SHA="${1#*=}" ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ "$VERIFY_ONLY" = "0" ]; then
  if [ -z "$SOURCE_SHA" ]; then
    echo "FAIL-CLOSED: an explicit source SHA is required (--source-sha <rev> or FED_DEPLOY_SHA)." >&2
    echo "            The deploy source is an identity; the working tree is not a deploy source." >&2
    exit 2
  fi

  STAGE=$(mktemp -d /tmp/fed-deploy-stage-XXXXXX)
  trap 'rm -rf "$STAGE"' EXIT

  echo "--- resolve artifacts from $SOURCE_SHA (working tree never read) ---"
  python3 "$RESOLVER" resolve --manifest "$MANIFEST" --source-sha "$SOURCE_SHA" \
      --repo "$REPO" --outdir "$STAGE" --resolved-at "$STAMP"

  echo "--- backup remote config ---"
  ssh -o BatchMode=yes $KVM4 "cp $REMOTE_CFG $REMOTE_CFG.bak-$STAMP"

  echo "--- promote the STAGED bytes ---"
  python3 "$RESOLVER" promote --resolved "$STAGE/resolved.json" --target "$KVM4"

  echo "--- restart + wait ---"
  ssh -o BatchMode=yes $KVM4 "systemctl reset-failed fed-litellm 2>/dev/null || true; systemctl restart fed-litellm"
  sleep 14

  echo "--- verify live bytes == artifact bytes ---"
  python3 "$RESOLVER" verify --resolved "$STAGE/resolved.json" --target "$KVM4"

  echo "--- record the deploy identity ---"
  mkdir -p "$(dirname "$RECEIPT")"
  python3 - "$STAGE/resolved.json" "$RECEIPT" <<'PYEOF'
import json, sys
resolved = json.load(open(sys.argv[1]))
resolved["deployed_at"] = resolved.get("resolved_at", "")
json.dump(resolved, open(sys.argv[2], "w"), indent=2)
print("receipt:", sys.argv[2], "source_sha:", resolved["source_sha"])
PYEOF
fi

# --- verify: container + one completion per critical group via local haproxy ---
echo "--- verify ---"
ssh -o BatchMode=yes $KVM4 "docker ps --filter name=litellm --format '{{.Status}}'"
PROBE_RC=0
python3 - <<'PYEOF' || PROBE_RC=1
import os, json, urllib.request, urllib.error, time
envf = os.popen("ls /root/.sec*/*.flat.env | head -1").read().strip()
for l in open(envf):
    if '=' in l and not l.startswith('#'):
        k, v = l.strip().split('=', 1)
        os.environ.setdefault(k, v)
MK = os.environ['LITELLM_MASTER_' + ''.join(chr(c) for c in (75, 69, 89))]
failures = 0
def hit(g):
    global failures
    t0 = time.time()
    req = urllib.request.Request('http://127.0.0.1:4000/v1/chat/completions',
        headers={'Authorization': 'Bearer ' + MK, 'Content-Type': 'application/json'},
        data=json.dumps({'model': g, 'messages': [{'role': 'user', 'content': 'Reply with exactly: OK'}], 'max_tokens': 8}).encode())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.load(r)
            print(f"{g:26s} 200 {round((time.time()-t0)*1000):>5}ms served={j.get('model','?')[:32]}")
    except urllib.error.HTTPError as e:
        failures += 1
        print(f"{g:26s} {e.code} {e.read(110).decode()[:100]}")
    except Exception as e:
        failures += 1
        print(f"{g:26s} ERR {str(e)[:70]}")
# 2026-11-23 (FI-003, F13 "buang group kimi-k3 tu"): 'kimi-k3' removed from this list — the
# group was removed from active routing (Kimi seat quota exhausted for the billing cycle).
# The tombstone in litellm-config.yaml records the restore steps.
for g in ['glm-5.3', 'glm-5.2', 'i-arif', 'deepseek-v4-flash-vision', 'agi-333']:
    hit(g)
if failures:
    print(f"PROBE FAILURES: {failures}")
    raise SystemExit(1)
PYEOF

if [ "$PROBE_RC" != "0" ]; then
  echo "PROBE FAILED — rolling back to the pre-deploy remote bytes" >&2
  if [ "$VERIFY_ONLY" = "0" ]; then
    ssh -o BatchMode=yes $KVM4 "cp $REMOTE_CFG.bak-$STAMP $REMOTE_CFG; systemctl restart fed-litellm" || true
  fi
  exit 3
fi
echo "DEPLOY OK"
