#!/bin/bash
# KABARKAN Phase 1 — Deploy Script
# DITEMPA BUKAN DIBERI
#
# Usage:
#   bash deploy.sh              — full deploy (install + setup + start)
#   bash deploy.sh --check      — verify only, no changes
#   bash deploy.sh --uninstall  — stop + remove
#
# What this does:
#   1. Install Python deps (nats-py, asyncpg, aioboto3)
#   2. Create NATS JetStream stream
#   3. Apply telemetry.py NATS producer patch
#   4. Copy worker to runtime path
#   5. Install systemd unit
#   6. Start kabarkan-worker
#   7. Probe health

set -euo pipefail

MODE="${1:-deploy}"
RUNTIME_DIR="/opt/a-forge/app/kabarkan"
SOURCE_DIR="/root/A-FORGE/kabarkan"
VENV_DIR="/opt/a-forge/venv"
HEALTH_URL="http://127.0.0.1:18902/health"
ARIFOS_SOURCE="/root/arifOS/arifosmcp/runtime/telemetry.py"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}✅${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC}  $*"; }
fail(){ echo -e "${RED}❌${NC} $*"; exit 1; }

# ── Check ──────────────────────────────────────────────────────────────
if [ "$MODE" = "--check" ]; then
    ok "Kabarkan Phase 1 — Check Mode"

    # Check Python deps
    for dep in nats asyncpg; do
        python3 -c "import $dep" 2>/dev/null && ok "$dep-py installed" || warn "$dep-py MISSING"
    done

    # Check NATS
    nats stream info kabarkan_ingest --server nats://127.0.0.1:4222 >/dev/null 2>&1 && \
        ok "NATS stream kabarkan_ingest exists" || \
        warn "NATS stream kabarkan_ingest MISSING"

    # Check telemetry.py has NATS producer
    grep -q "_publish_to_nats\|kabarkan" "$ARIFOS_SOURCE" 2>/dev/null && \
        ok "telemetry.py has Kabarkan references" || \
        warn "telemetry.py may need NATS producer patch"

    # Check worker
    curl -sf "$HEALTH_URL" 2>/dev/null && \
        ok "Kabarkan Worker healthy :18902" || \
        warn "Kabarkan Worker not running"

    exit 0
fi

# ── Uninstall ──────────────────────────────────────────────────────────
if [ "$MODE" = "--uninstall" ]; then
    echo "Stopping Kabarkan Worker..."
    systemctl stop kabarkan-worker 2>/dev/null || true
    systemctl disable kabarkan-worker 2>/dev/null || true
    rm -f /etc/systemd/system/kabarkan-worker.service
    systemctl daemon-reload
    rm -rf "$RUNTIME_DIR"
    ok "Kabarkan Worker uninstalled"
    exit 0
fi

# ── Deploy ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  KABARKAN Phase 1 — Deploy          ║"
echo "║  NATS Stream + Producer + Worker    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Install Python deps
echo "── [1/6] Installing Python dependencies..."
$VENV_DIR/bin/pip3 install nats-py asyncpg aioboto3 2>&1 | tail -3 || {
    warn "pip install via venv failed, trying system pip3..."
    pip3 install nats-py asyncpg aioboto3 2>&1 | tail -3 || warn "pip install failed — install manually"
}
ok "Dependency check done"

# 2. Create NATS stream
echo "── [2/6] Setting up NATS stream..."
bash "$SOURCE_DIR/nats_setup.sh" || warn "NATS setup had issues — check manually"
ok "NATS setup done"

# 3. Backup + patch telemetry.py
echo "── [3/6] Patching telemetry.py for NATS producer..."
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
ARIFOS_BACKUP="/root/arifOS/arifosmcp/runtime/telemetry.py.kabarkan-backup-$TIMESTAMP"

if ! grep -q "_publish_to_nats" "$ARIFOS_SOURCE" 2>/dev/null; then
    cp -a "$ARIFOS_SOURCE" "$ARIFOS_BACKUP"
    ok "Backup saved: $ARIFOS_BACKUP"

    # Apply the patch
    # This adds NATS publisher after the Postgres write block
    python3 "$SOURCE_DIR/patch_telemetry.py" "$ARIFOS_SOURCE" 2>&1 && \
        ok "telemetry.py patched — NATS producer added" || \
        warn "telemetry.py patch failed — apply manually from $SOURCE_DIR/TELEMETRY_PATCH.md"

    # Restart arifOS to pick up changes
    echo "  Restarting arifOS to load patched telemetry..."
    systemctl restart arifos 2>/dev/null || warn "Could not restart arifos"
    sleep 2
    curl -sf http://127.0.0.1:8088/health >/dev/null 2>&1 && ok "arifOS restarted" || warn "arifOS may need manual restart"
else
    ok "telemetry.py already patched — skipping"
fi

# 4. Copy worker to runtime
echo "── [4/6] Deploying worker to runtime..."
mkdir -p "$RUNTIME_DIR"
cp "$SOURCE_DIR/worker.py" "$RUNTIME_DIR/"
cp "$SOURCE_DIR/nats_setup.sh" "$RUNTIME_DIR/"
chmod +x "$RUNTIME_DIR/worker.py"
chmod +x "$RUNTIME_DIR/nats_setup.sh"
ok "Worker deployed to $RUNTIME_DIR"

# 5. Install systemd unit
echo "── [5/6] Installing systemd unit..."
cp "$SOURCE_DIR/kabarkan-worker.service" /etc/systemd/system/
systemctl daemon-reload
ok "systemd unit installed"

# 6. Start worker
echo "── [6/6] Starting Kabarkan Worker..."
systemctl enable kabarkan-worker 2>/dev/null || true
systemctl restart kabarkan-worker 2>/dev/null || warn "systemctl restart failed — check journalctl -u kabarkan-worker"

# Wait for startup
for i in $(seq 1 10); do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Probe
echo ""
if curl -sf "$HEALTH_URL" 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  Status:        {d[\"status\"]}')
print(f'  NATS:          {d[\"nats_connected\"]}')
print(f'  Postgres:      {d[\"postgres_healthy\"]}')
print(f'  Received:      {d[\"messages_received\"]}')
print(f'  Processed:     {d[\"messages_processed\"]}')
print(f'  Batches:       {d[\"batches_flushed\"]}')
" 2>/dev/null; then
    ok "Kabarkan Worker is LIVE :18902"
else
    warn "Worker started but health probe failed — check: journalctl -u kabarkan-worker -n 20"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  KABARKAN Phase 1 — DEPLOYED        ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  Health:    curl :18902/health"
echo "  Logs:      journalctl -u kabarkan-worker -f"
echo "  NATS:      nats stream info kabarkan_ingest --server nats://127.0.0.1:4222"
echo "  Next:      Kabarkan UI (Phase 2)"
echo ""
