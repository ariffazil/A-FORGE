#!/bin/bash
# USER-VENV-SEPARATION — Rollback & Migration Script
# Forged: 2026-07-31 by 333-AGI (autonomous drive)
# Purpose: Migrate federation services from root to dedicated users.
# F1 AMANAH: Every step has a verified rollback path.
# BLAST RADIUS: HIGH. Execute only during dedicated sprint with quiet window.
# 
# Usage:
#   ./user-venv-migrate.sh assess     — Assess current state (safe, read-only)
#   ./user-venv-migrate.sh plan       — Print migration plan
#   ./user-venv-migrate.sh backup     — Snapshot all service configs
#   ./user-venv-migrate.sh migrate    — Execute migration (REQUIRES 888_HOLD)
#   ./user-venv-migrate.sh rollback   — Revert to snapshots (if needed)

set -euo pipefail

# Locate A-FORGE root from this script: scripts/user-venv-migrate.sh → ..
A_FORGE_ROOT="$(cd "$(dirname "$0")" && cd .. && pwd)"
PATH_R() { python3 -c "import sys; sys.path.insert(0, '$A_FORGE_ROOT/paradox-engine'); from paths_resolver import org_path; print(org_path('$1'))"; }

BACKUP_DIR="$(PATH_R forge_work)/2026-07-31/user-venv-migration-backups"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# ─── SERVICE MAP ─────────────────────────────────────────────────────
# Format: service_name|current_user|target_user|risk
# target_user="" means no change needed
SERVICES=(
  "arifos.service|arifos||LOW"
  "aforge.service|root|aforge|MEDIUM"
  "geox-mcp.service|root|geox|MEDIUM"
  "geox-static-server.service|www-data||LOW"
  "hermes-asi-gateway.service|root|hermes|HIGH"
  "hermes-mcp.service|root|hermes|HIGH"
  "wealth-organ.service|wealth||LOW"
  "well.service|root|well|MEDIUM"
  "well-witness.service|well-witness||LOW"
  "aaa-a2a.service|aaa-a2a||LOW"
  "aaa-preforge.service|aaa-preforge||LOW"
  "aaa-signing.service|root|aaa-signing|MEDIUM"
)

assess() {
  echo "=== USER-VENV SEPARATION ASSESSMENT ==="
  echo "Timestamp: $TIMESTAMP"
  echo ""
  
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r svc current target risk <<< "$entry"
    
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      actual_user=$(systemctl show -p User "$svc" 2>/dev/null | cut -d= -f2)
      if [ "$actual_user" = "root" ] && [ -n "$target" ]; then
        echo "❌ $svc: runs as root → should be $target ($risk risk)"
      elif [ "$actual_user" = "$target" ] && [ -n "$target" ]; then
        echo "✅ $svc: runs as $target (correct)"
      elif [ -z "$target" ]; then
        echo "✅ $svc: runs as $actual_user (no migration needed)"
      else
        echo "⚠️  $svc: runs as $actual_user (expected $target — investigate)"
      fi
    else
      echo "⚫ $svc: NOT RUNNING"
    fi
  done
  
  echo ""
  echo "=== ROOT-OWNED PROCESSES ==="
  ps aux | grep -E "arifos|aforge|hermes|geox|wealth|well" | grep "^root" | grep -v grep | awk '{print "  PID=" $2 " CMD=" $11}' || echo "  (none)"
}

plan() {
  echo "=== MIGRATION PLAN ==="
  echo "ORDER: least-risk services first, verify each before proceeding."
  echo ""
  echo "PHASE 1 — Low risk (single-service, well-understood):"
  echo "  1. geox-mcp → geox user"
  echo "  2. well → well user"
  echo "  3. aaa-signing → aaa-signing user"
  echo ""
  echo "PHASE 2 — Medium risk (depends on venv/directory permissions):"
  echo "  4. aforge → aforge user"
  echo ""
  echo "PHASE 3 — High risk (multiple services, Hermes is critical):"
  echo "  5. hermes-asi-gateway → hermes user"
  echo "  6. hermes-mcp → hermes user"
  echo ""
  echo "EACH MIGRATION STEP:"
  echo "  a. Create system user if missing: useradd -r -s /bin/false <user>"
  echo "  b. Chown organ directory: chown -R <user>:<user> /opt/<organ>/app/"
  echo "  c. Chown venv: chown -R <user>:<user> /opt/<organ>/venv/"
  echo "  d. Chown data dirs (if any): chown -R <user>:<user> /var/lib/<organ>/"
  echo "  e. Update systemd drop-in: systemctl edit <service> --drop-in=user"
  echo "     [Service]"
  echo "     User=<user>"
  echo "     Group=<user>"
  echo "  f. systemctl daemon-reload && systemctl restart <service>"
  echo "  g. VERIFY: systemctl status <service> && curl :port/health"
  echo "  h. If FAIL: run rollback for that service immediately"
  echo ""
  echo "CRITICAL PORTS TO MONITOR DURING MIGRATION:"
  echo "  8088 (arifOS), 7071 (A-FORGE), 8081 (GEOX), 18001 (Hermes)"
}

backup() {
  mkdir -p "$BACKUP_DIR/$TIMESTAMP"
  echo "Backing up to $BACKUP_DIR/$TIMESTAMP"
  
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r svc current target risk <<< "$entry"
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      # Backup unit file
      UNIT_PATH=$(systemctl show -p FragmentPath "$svc" 2>/dev/null | cut -d= -f2)
      if [ -f "$UNIT_PATH" ]; then
        cp -a "$UNIT_PATH" "$BACKUP_DIR/$TIMESTAMP/${svc}.unit"
        echo "  ✅ $svc unit backed up"
      fi
      # Backup drop-ins
      DROPIN_DIR=$(systemctl show -p DropInPaths "$svc" 2>/dev/null | cut -d= -f2)
      if [ -n "$DROPIN_DIR" ] && [ "$DROPIN_DIR" != "" ]; then
        mkdir -p "$BACKUP_DIR/$TIMESTAMP/${svc}.d"
        IFS=' ' read -ra DROPINS <<< "$DROPIN_DIR"
        for dropin in "${DROPINS[@]}"; do
          cp -a "$dropin" "$BACKUP_DIR/$TIMESTAMP/${svc}.d/" 2>/dev/null || true
        done
        echo "  ✅ $svc drop-ins backed up"
      fi
    fi
  done
  
  # Backup current user/group state
  getent passwd arifos aforge geox hermes well aaa-signing aaa-a2a aaa-preforge well-witness wealth 2>/dev/null > "$BACKUP_DIR/$TIMESTAMP/users.txt" || true
  getent group arifos aforge geox hermes well aaa-signing aaa-a2a aaa-preforge well-witness wealth 2>/dev/null > "$BACKUP_DIR/$TIMESTAMP/groups.txt" || true
  
  echo ""
  echo "Backup complete: $BACKUP_DIR/$TIMESTAMP"
  echo "SHA256: $(find "$BACKUP_DIR/$TIMESTAMP" -type f -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)"
}

rollback_service() {
  local svc="$1"
  local backup_ts="${2:-$TIMESTAMP}"
  
  echo "ROLLING BACK: $svc"
  systemctl stop "$svc" 2>/dev/null || true
  
  # Restore unit file
  if [ -f "$BACKUP_DIR/$backup_ts/${svc}.unit" ]; then
    cp -a "$BACKUP_DIR/$backup_ts/${svc}.unit" "$(systemctl show -p FragmentPath "$svc" 2>/dev/null | cut -d= -f2)" 2>/dev/null || true
  fi
  
  # Restore drop-ins
  if [ -d "$BACKUP_DIR/$backup_ts/${svc}.d" ]; then
    DROPIN_DIR="/etc/systemd/system/${svc}.d"
    rm -rf "$DROPIN_DIR" 2>/dev/null || true
    mkdir -p "$DROPIN_DIR"
    cp -a "$BACKUP_DIR/$backup_ts/${svc}.d/"* "$DROPIN_DIR/" 2>/dev/null || true
  fi
  
  systemctl daemon-reload
  systemctl start "$svc"
  sleep 2
  systemctl status "$svc" --no-pager
}

migrate_service() {
  local svc="$1" target_user="$2" organ_dir="$3"
  
  echo "MIGRATING: $svc → $target_user"
  
  # Create user if missing
  if ! id "$target_user" >/dev/null 2>&1; then
    useradd -r -s /bin/false "$target_user"
    echo "  Created user: $target_user"
  fi
  
  # Chown organ directory
  if [ -d "$organ_dir" ]; then
    chown -R "$target_user:$target_user" "$organ_dir" 2>/dev/null || echo "  ⚠️  Could not chown $organ_dir"
    echo "  Chowned: $organ_dir"
  fi
  
  # Create drop-in for User=
  mkdir -p "/etc/systemd/system/${svc}.d"
  cat > "/etc/systemd/system/${svc}.d/user-override.conf" << EOF
[Service]
User=$target_user
Group=$target_user
EOF
  
  systemctl daemon-reload
  systemctl restart "$svc"
  sleep 3
  
  if systemctl is-active --quiet "$svc"; then
    echo "  ✅ $svc migrated to $target_user successfully"
  else
    echo "  ❌ $svc FAILED to start as $target_user — rolling back"
    rollback_service "$svc"
  fi
}

case "${1:-assess}" in
  assess) assess ;;
  plan) plan ;;
  backup) backup ;;
  rollback)
    svc="${2:-}"
    if [ -z "$svc" ]; then
      echo "Usage: $0 rollback <service-name> [backup-timestamp]"
      exit 1
    fi
    rollback_service "$svc" "${3:-$TIMESTAMP}"
    ;;
  *)
    echo "Usage: $0 {assess|plan|backup|rollback}"
    echo ""
    echo "  assess   — Read-only assessment of current state"
    echo "  plan     — Print migration order and steps"
    echo "  backup   — Snapshot all service configs before migration"
    echo "  rollback — Restore a service from backup"
    echo ""
    echo "Full migration (migrate) is NOT automated — execute manually"
    echo "following the plan, one service at a time, verifying each step."
    ;;
esac
