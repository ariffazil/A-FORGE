#!/bin/bash
# A-FORGE MCP Bridge Startup
# Loads secrets from /root/.secrets/a-forge.env before starting
# Usage: ./start-A-FORGE-bridge.sh

set -euo pipefail

SECRETS_FILE="/root/.secrets/a-forge.env"
LOG="/var/log/a-forge-bridge.log"

if [[ ! -f "$SECRETS_FILE" ]]; then
    echo "[ERROR] Secrets file not found: $SECRETS_FILE" | tee -a "$LOG"
    exit 1
fi

# Verify permissions
PERMS=$(stat -c "%a" "$SECRETS_FILE" 2>/dev/null || echo "000")
if [[ "$PERMS" != "600" ]]; then
    echo "[WARN] Secrets file has loose permissions ($PERMS), fixing..." | tee -a "$LOG"
    chmod 600 "$SECRETS_FILE"
fi

# Load secrets into environment
set -a
source "$SECRETS_FILE"
set +a

echo "[$(date)] A-FORGE bridge starting with secrets from $SECRETS_FILE" >> "$LOG"

# Run via docker compose if available, otherwise docker run
if command -v docker &>/dev/null && docker info &>/dev/null; then
    exec docker compose -f /root/compose/a-forge.yml up -d
else
    echo "[ERROR] Docker not available" | tee -a "$LOG"
    exit 1
fi
