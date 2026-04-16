#!/bin/sh
# AF-FORGE Backup Cron — runs pg_dump daily
# DITEMPA BUKAN DIBERI — F1 Amanah: backup before any irreversible change
#
# Schedule: 02:00 MYT daily (18:00 UTC)
# Retention: 30 days local
# Off-box: rsync to $BACKUP_OFFBOX_TARGET if configured
#
# Usage:
#   docker compose run af-forge-backup
#   Or run directly: ./cron.sh

set -e

PGHOST="${POSTGRES_URL##*@}"
PGHOST="${PGHOST%%:*}"
PGPORT="${POSTGRES_URL##*:*:}"
PGPORT="${PGPORT%%/*}"
PGUSER="${POSTGRES_URL##*://}"
PGUSER="${PGUSER%%:*}"
PGDATABASE="${POSTGRES_URL##*/}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +%Y-%m-%dT%H%M%S%z)
BACKUP_FILE="${BACKUP_DIR}/arifos_vault-${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] AF-FORGE backup started: ${BACKUP_FILE}"

# pg_dump with compression
pg_dump -h "${PGHOST}" -p "${PGPORT:-5432}" -U "${PGUSER}" -d "${PGDATABASE}" -Fc | gzip > "${BACKUP_FILE}"

# Verify backup integrity
if pg_restore --dry-run --schema-only -Fc "${BACKUP_FILE}" 2>/dev/null; then
    echo "[$(date -Iseconds)] Backup verified OK: ${BACKUP_FILE}"
else
    echo "[$(date -Iseconds)] Backup VERIFICATION FAILED: ${BACKUP_FILE}"
    exit 1
fi

# Report size
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${SIZE}"

# Cleanup old backups
find "${BACKUP_DIR}" -name "arifos_vault-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -Iseconds)] Old backups cleaned (retention=${RETENTION_DAYS} days)"

# Off-box replication if configured
if [ -n "${BACKUP_OFFBOX_TARGET}" ]; then
    echo "[$(date -Iseconds)] Pushing to off-box: ${BACKUP_OFFBOX_TARGET}"
    rsync -avz --progress "${BACKUP_FILE}" "${BACKUP_OFFBOX_TARGET}/" 2>/dev/null || \
    echo "[$(date -Iseconds)] Off-box push failed (rsync not available or target unreachable)"
fi

echo "[$(date -Iseconds)] AF-FORGE backup finished"
