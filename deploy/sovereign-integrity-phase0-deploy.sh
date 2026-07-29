#!/bin/bash
# ⚒️ DEPLOY-ROLLBACK — Sovereign Integrity Phase 0
# P0-1 SCT HMAC Verification + P0-2 Credential Removal
# Branch: fix/sovereign-integrity-phase0-20260729
# Forged: 2026-07-29 | DITEMPA BUKAN DIBERI
#
# USAGE:
#   bash deploy.sh          → Deploy A-FORGE with SCT fix
#   bash deploy.sh rollback → Rollback to previous state
#   bash deploy.sh verify   → Post-deploy verification only
#
# REQUIRED F13 APPROVAL: F13 APPROVE P0-CONTAINMENT DEPLOY

set -euo pipefail

REPO="/root/A-FORGE"
DEPLOY="/opt/a-forge/app"
SERVICE="a-forge"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/root/A-FORGE/deploy/rollback/${TIMESTAMP}"

log() { echo "[$(date +%H:%M:%S)] $*"; }
err() { echo "[$(date +%H:%M:%S)] ❌ $*" >&2; }

# ── Verify pre-conditions ──────────────────────────────────────────
preflight() {
    log "PREFLIGHT: Checking pre-conditions..."
    
    # Check we're on the correct branch
    local br=$(git -C "$REPO" branch --show-current)
    if [ "$br" != "fix/sovereign-integrity-phase0-20260729" ]; then
        err "Wrong branch: $br (expected fix/sovereign-integrity-phase0-20260729)"
        exit 1
    fi
    
    # Check build is current
    local src_ts="$REPO/src/infrastructure/governance/sctIngress.ts"
    local dist_js="$REPO/dist/src/infrastructure/governance/sctIngress.js"
    if [ ! -f "$dist_js" ] || [ "$src_ts" -nt "$dist_js" ]; then
        log "Rebuilding (source newer than dist)..."
        cd "$REPO" && npm run build 2>&1 | tail -3
    fi
    
    # Verify compiled code has HMAC verification
    if ! grep -q "timingSafeEqual" "$dist_js"; then
        err "FATAL: Compiled dist does NOT contain HMAC verification!"
        exit 1
    fi
    log "✅ Compiled code has HMAC verification"
    
    # Check service is running
    if ! systemctl is-active --quiet "$SERVICE"; then
        err "Service $SERVICE is not running"
        exit 1
    fi
    log "✅ Service $SERVICE is active"
    
    # Check ARIFOS_SESSION_SECRET is available
    if [ -z "${ARIFOS_SESSION_SECRET:-}" ]; then
        err "ARIFOS_SESSION_SECRET not set — source kunci-mas.env first"
        exit 1
    fi
    log "✅ ARIFOS_SESSION_SECRET is set"
}

# ── Backup current deployment ──────────────────────────────────────
backup() {
    log "BACKUP: Snapshotting current deployment..."
    mkdir -p "$BACKUP_DIR"
    
    # Save current dist
    if [ -d "$DEPLOY/dist" ]; then
        cp -a "$DEPLOY/dist" "$BACKUP_DIR/dist"
        log "  dist/ backed up"
    fi
    
    # Save current git SHA
    git -C "$REPO" rev-parse HEAD > "$BACKUP_DIR/pre_deploy_sha"
    log "  SHA: $(cat $BACKUP_DIR/pre_deploy_sha | head -c 7)"
    
    # Save service file hash
    sha256sum "$DEPLOY/src/infrastructure/governance/sctIngress.js" > "$BACKUP_DIR/sct_ingress_hash" 2>/dev/null || true
    
    log "✅ Backup complete: $BACKUP_DIR"
}

# ── Deploy ─────────────────────────────────────────────────────────
deploy() {
    log "DEPLOY: Deploying to $DEPLOY..."
    
    # Rebuild dist
    cd "$REPO" && npm run build 2>&1 | grep -v "^$" | tail -5
    log "  Build complete"
    
    # Verify compiled code
    if ! grep -q "timingSafeEqual" "$REPO/dist/src/infrastructure/governance/sctIngress.js"; then
        err "FATAL: HMAC verification not in compiled code!"
        exit 1
    fi
    
    # Rsync dist
    rsync -av --delete "$REPO/dist/" "$DEPLOY/dist/" 2>&1 | tail -3
    log "  Rsync complete"
    
    # Write deployment marker
    git -C "$REPO" rev-parse HEAD > "$DEPLOY/.git_commit"
    date -u +%Y-%m-%dT%H:%M:%SZ > "$DEPLOY/.started_at"
    log "  Deployment markers written"
    
    # Restart service
    log "  Restarting $SERVICE..."
    systemctl restart "$SERVICE"
    sleep 3
    
    # Verify service is back
    if systemctl is-active --quiet "$SERVICE"; then
        log "✅ Service restarted successfully"
    else
        err "Service failed to restart — rolling back"
        rollback_internal
        exit 1
    fi
}

# ── Verify ─────────────────────────────────────────────────────────
verify() {
    log "VERIFY: Post-deployment checks..."
    
    # Health check
    local health=$(curl -sf http://127.0.0.1:7071/health 2>/dev/null)
    if [ -z "$health" ]; then
        err "Health endpoint unreachable"
        exit 1
    fi
    log "✅ /health responding"
    
    # Check SCT mutation gate in health response
    local sct_gate=$(echo "$health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sct_mutation_gate',{}).get('enforced','?'))" 2>/dev/null)
    log "  SCT mutation gate enforced: $sct_gate"
    
    # Verify deployed commit matches source
    local deployed_sha=$(cat "$DEPLOY/.git_commit" 2>/dev/null | head -c 7)
    local source_sha=$(git -C "$REPO" rev-parse --short HEAD)
    if [ "$deployed_sha" = "$source_sha" ]; then
        log "✅ Deployed SHA matches source: $deployed_sha"
    else
        log "⚠️  SHA mismatch: deployed=$deployed_sha source=$source_sha"
    fi
    
    # Tool count check
    local tools=$(echo "$health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_count','?'))" 2>/dev/null)
    log "  Tools loaded: $tools"
    
    # Run SCT test against compiled code
    log "  Running SCT tests..."
    node --test "$REPO/dist/test/sctIngress.test.js" 2>&1 | grep "pass\|fail" | tail -3
    
    log "✅ Verification complete"
}

# ── Rollback ───────────────────────────────────────────────────────
rollback_internal() {
    local latest_backup=$(ls -dt /root/A-FORGE/deploy/rollback/*/ 2>/dev/null | head -1)
    if [ -z "$latest_backup" ]; then
        err "No backup found — cannot rollback"
        exit 1
    fi
    
    log "ROLLBACK: Restoring from $latest_backup"
    
    if [ -d "$latest_backup/dist" ]; then
        rsync -av --delete "$latest_backup/dist/" "$DEPLOY/dist/" 2>&1 | tail -3
    fi
    
    local pre_sha=$(cat "$latest_backup/pre_deploy_sha" 2>/dev/null | head -c 7)
    if [ -n "$pre_sha" ]; then
        echo "$pre_sha" > "$DEPLOY/.git_commit"
        log "  Restored SHA: $pre_sha"
    fi
    
    systemctl restart "$SERVICE"
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE"; then
        log "✅ Rollback complete — service active"
    else
        err "FATAL: Service still down after rollback!"
        exit 1
    fi
}

rollback() {
    # Verify backup exists
    local backups=$(ls -dt /root/A-FORGE/deploy/rollback/*/ 2>/dev/null | wc -l)
    if [ "$backups" -eq 0 ]; then
        err "No backups found"
        exit 1
    fi
    rollback_internal
}

# ── Main ───────────────────────────────────────────────────────────
case "${1:-deploy}" in
    deploy)
        preflight
        backup
        deploy
        verify
        log "═══════════════════════════════════════════════════════"
        log "DEPLOY COMPLETE — SCT HMAC verification now enforced"
        log "Rollback: bash $0 rollback"
        log "Backup:  $BACKUP_DIR"
        log "═══════════════════════════════════════════════════════"
        ;;
    rollback)
        rollback
        ;;
    verify)
        verify
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|verify}"
        exit 1
        ;;
esac
