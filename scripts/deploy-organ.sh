#!/bin/bash
# deploy-organ.sh — Governed federation organ deployment
# DITEMPA BUKAN DIBERI — Forged 2026-07-26
# Usage: ./deploy-organ.sh <organ> [--force]
#   organ: arifos | aforge | aforge-mcp | wealth | geox | well | aaa
#   --force: skip head=origin/main check (for hotfixes)

set -euo pipefail

ORGAN="${1:?Usage: $0 <organ> [--force]}"
FORCE="${2:-}"
TIMESTAMP=$(date +%Y%m%dT%H%M%SZ)
BACKUP_ROOT="/root/backups/deploy-rollbacks"

# ── Organ configuration ──────────────────────────────────────────
declare -A ORGAN_SOURCE ORGAN_OPT ORGAN_SERVICE ORGAN_PORT ORGAN_HEALTH ORGAN_TEST
ORGAN_SOURCE[arifos]="/root/arifOS"
ORGAN_OPT[arifos]="/opt/arifos/app"
ORGAN_SERVICE[arifos]="arifos"
ORGAN_PORT[arifos]="8088"
ORGAN_HEALTH[arifos]="http://localhost:8088/health"
ORGAN_TEST[arifos]="cd /root/arifOS && uv sync --frozen && pytest tests/ -q --tb=short -m 'not e3e and not slow'"

ORGAN_SOURCE[aforge]="/root/A-FORGE"
ORGAN_OPT[aforge]="/opt/a-forge/app"
ORGAN_SERVICE[aforge]="a-forge"
ORGAN_PORT[aforge]="7071"
ORGAN_HEALTH[aforge]="http://localhost:7071/health"
ORGAN_TEST[aforge]="cd /root/A-FORGE && npm ci && npm run build && npm test"

ORGAN_SOURCE[aforge-mcp]="/root/A-FORGE"
ORGAN_OPT[aforge-mcp]="/opt/a-forge/app"
ORGAN_SERVICE[aforge-mcp]="a-forge-mcp"
ORGAN_HEALTH[aforge-mcp]="http://localhost:7072/mcp"
ORGAN_TEST[aforge-mcp]=""  # Share with aforge

ORGAN_SOURCE[wealth]="/root/WEALTH"
ORGAN_OPT[wealth]="/opt/wealth/app"
ORGAN_SERVICE[wealth]="wealth-organ"
ORGAN_PORT[wealth]="18082"
ORGAN_HEALTH[wealth]="http://localhost:18082/health"
ORGAN_TEST[wealth]="cd /root/WEALTH && uv sync --frozen && pytest tests/ -q --tb=short"

ORGAN_SOURCE[geox]="/root/GEOX"
ORGAN_OPT[geox]="/opt/geox/app"
ORGAN_SERVICE[geox]="geox-mcp"
ORGAN_PORT[geox]="8081"
ORGAN_HEALTH[geox]="http://localhost:8081/health"
ORGAN_TEST[geox]="cd /root/GEOX && uv sync --frozen && pytest tests/ -q --tb=short"

ORGAN_SOURCE[well]="/root/WELL"
ORGAN_OPT[well]="/opt/well/app"
ORGAN_SERVICE[well]="well"
ORGAN_PORT[well]="18083"
ORGAN_HEALTH[well]="http://localhost:18083/health"
ORGAN_TEST[well]="cd /root/WELL && uv sync --frozen && pytest tests/ -q --tb=short"

# ── Validate organ ──────────────────────────────────────────────
SRC="${ORGAN_SOURCE[$ORGAN]:-}"
OPT="${ORGAN_OPT[$ORGAN]:-}"
SVC="${ORGAN_SERVICE[$ORGAN]:-}"
HEALTH="${ORGAN_HEALTH[$ORGAN]:-}"
TEST_CMD="${ORGAN_TEST[$ORGAN]:-}"

if [ -z "$SRC" ]; then
  echo "❌ Unknown organ: $ORGAN"
  echo "   Valid: ${!ORGAN_SOURCE[*]}"
  exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  DEPLOY: $ORGAN                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Stage 1: Source sync ────────────────────────────────────────
echo "── Stage 1: Source sync ──"
cd "$SRC"

if [ "$FORCE" != "--force" ]; then
  git fetch origin main 2>/dev/null || true
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
  if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
    echo "⚠️  HEAD ($LOCAL) != origin/main ($REMOTE)"
    echo "   Use --force to deploy anyway"
    exit 1
  fi
fi
echo "✅ Source: $(git log --oneline -1)"

# ── Stage 2: Test ────────────────────────────────────────────────
echo ""
echo "── Stage 2: Test ──"
if [ -n "$TEST_CMD" ]; then
  if bash -c "$TEST_CMD" 2>&1 | tail -5; then
    echo "✅ Tests pass"
  else
    echo "❌ Tests failed — deploy aborted"
    exit 1
  fi
else
  echo "⏭️  No tests configured (skipped)"
fi

# ── Stage 3: Snapshot current deployment ─────────────────────────
echo ""
echo "── Stage 3: Snapshot ──"
mkdir -p "$BACKUP_ROOT"
ROLLBACK_DIR="$BACKUP_ROOT/${ORGAN}-${TIMESTAMP}"
if [ -d "$OPT" ]; then
  cp -a "$OPT" "$ROLLBACK_DIR"
  echo "✅ Snapshot: $ROLLBACK_DIR"
  echo "   Rollback: cp -a $ROLLBACK_DIR/* $OPT/"
else
  echo "⏭️  No existing deployment to snapshot"
fi

# ── Stage 4: Deploy ─────────────────────────────────────────────
echo ""
echo "── Stage 4: Deploy ──"
if [ -d "$OPT" ]; then
  # F1 AMANAH (2026-08-15): runtime-state + secret files live inside deploy targets
  # (/opt/arifos/app/.env, /opt/a-forge/app/a_think/budgets.yaml, .git_commit marker).
  # --delete would destroy them. Excluded here; rollback branch (snapshot restore)
  # intentionally UNexcluded so it restores full pre-deploy state.
  rsync -av --delete --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='node_modules' --exclude='.venv' --exclude='tests' \
    --exclude='.env' --exclude='.env.*' --exclude='.git_commit' \
    --exclude='budgets.yaml' \
    "$SRC/" "$OPT/" 2>&1 | tail -3
else
  mkdir -p "$OPT"
  rsync -av --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='node_modules' --exclude='.venv' --exclude='tests' \
    --exclude='.env' --exclude='.env.*' --exclude='.git_commit' \
    --exclude='budgets.yaml' \
    "$SRC/" "$OPT/" 2>&1 | tail -3
fi
echo "✅ Rsynced: $SRC → $OPT"

# ── Stage 5: Restart ─────────────────────────────────────────────
echo ""
echo "── Stage 5: Restart ──"
systemctl restart "$SVC" 2>&1
sleep 2
echo "✅ Service restarted: $SVC"

# ── Stage 6: Health check ────────────────────────────────────────
echo ""
echo "── Stage 6: Health check ──"
for i in 1 2 3 4 5; do
  if curl -sf "$HEALTH" >/dev/null 2>&1; then
    echo "✅ Health OK (attempt $i)"
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "❌ Health check FAILED after 5 attempts"
    echo ""
    echo "── ROLLING BACK ──"
    if [ -d "$ROLLBACK_DIR" ]; then
      rsync -av --delete "$ROLLBACK_DIR/" "$OPT/" 2>&1 | tail -2
      systemctl restart "$SVC" 2>&1
      sleep 2
      curl -sf "$HEALTH" >/dev/null 2>&1 && echo "✅ Rollback OK" || echo "❌ ROLLBACK FAILED — manual intervention required"
    else
      echo "❌ No rollback snapshot available"
    fi
    exit 1
  fi
  sleep 2
done

# ── Stage 7: Receipt ─────────────────────────────────────────────
echo ""
echo "── Stage 7: Receipt ──"
RECEIPT_DIR="/root/forge_work/$(date +%Y-%m-%d)"
mkdir -p "$RECEIPT_DIR"
cat > "$RECEIPT_DIR/deploy-${ORGAN}-${TIMESTAMP}.json" << EOF
{
  "organ": "$ORGAN",
  "timestamp": "$TIMESTAMP",
  "commit": "$(cd $SRC && git rev-parse HEAD)",
  "service": "$SVC",
  "health": "PASS",
  "rollback_snapshot": "$ROLLBACK_DIR",
  "deployer": "deploy-organ.sh v1.0.0"
}
EOF
echo "✅ Receipt: $RECEIPT_DIR/deploy-${ORGAN}-${TIMESTAMP}.json"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  DEPLOY COMPLETE: $ORGAN ✅                        ║"
echo "╚══════════════════════════════════════════════════╝"
