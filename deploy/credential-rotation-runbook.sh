#!/bin/bash
# ⚒️ CREDENTIAL ROTATION RUNBOOK — arifos_admin Postgres
# P2 FIX (2026-07-29)
# DITEMPA BUKAN DIBERI
#
# REQUIRES: F13 APPROVE P2-CREDENTIAL ROTATE
#
# This script is a DRY-RUN guide. Each step requires explicit confirmation.
# The actual credential rotation must be performed by a human with root access
# or by an agent under explicit F13 authorization.
#
# ⚠️  DO NOT EXECUTE without F13 approval.
# ⚠️  This script prints NO secret values.

set -euo pipefail

log() { echo "[ROTATE] $(date +%H:%M:%S) $*"; }

cat << 'RUNBOOK'
═══════════════════════════════════════════════════════════════════
  CREDENTIAL ROTATION RUNBOOK — arifos_admin Postgres User
  Status: PREPARED — NOT EXECUTED
  Requires: F13 APPROVE P2-CREDENTIAL ROTATE
═══════════════════════════════════════════════════════════════════

AFFECTED CREDENTIAL:
  User:     arifos_admin
  Database: vault999 (local), arifos_vault (local)
  Host:     127.0.0.1:5432
  Status:   COMPROMISED — found in 5 source files + 2 deploy configs

CONSUMERS (must be updated):
  1. A-FORGE systemd service (:7071)       — DATABASE_URL
  2. AAA A2A server (:3001)                — POSTGRES_URL
  3. arifOS kernel (:8088)                 — POSTGRES_URL
  4. arifFlow (:7073)                      — POSTGRES_URL
  5. kabarkan worker                       — POSTGRES_URL
  6. Backup cron job                       — PGPASSWORD
  7. Health probes (read-only)             — may use separate role
  8. docker-compose.yml (agent-plane)      — POSTGRES_PASSWORD

SOURCE FILES FIXED (committed):
  ✅ A-FORGE/src/interfaces/mcp/proxyTools.ts       — env-only
  ✅ A-FORGE/scripts/dual_path_sync_test.ts          — env-only
  ✅ AAA/a2a-server/chat_agent.py                    — env-only
  ✅ AAA/a2a-server/vault999_writer_fix.py           — env-only
  ✅ A-FORGE/deploy/af-forge/docker-compose.yml      — ${VAR:?}

REMAINING (non-source, needs manual update):
  ⚠️  A-FORGE/deploy/agent-plane/docker-compose.yml  — default value
  ⚠️  A-FORGE/deploy/agent-plane/.env.example        — template
  ⚠️  forge_work/ historical logs                    — immutable audit

───────────────────────────────────────────────────────────────
STEP 1: VERIFY BACKUP
───────────────────────────────────────────────────────────────
  pg_dump -U arifos_admin -h 127.0.0.1 vault999 > /root/backups/vault999-pre-rotate-$(date +%Y%m%d).sql
  pg_dump -U arifos_admin -h 127.0.0.1 arifos_vault > /root/backups/arifos_vault-pre-rotate-$(date +%Y%m%d).sql
  sha256sum /root/backups/*-pre-rotate-*.sql

  Verify: pg_restore --list or grep for expected table counts.

───────────────────────────────────────────────────────────────
STEP 2: CREATE REPLACEMENT CREDENTIAL
───────────────────────────────────────────────────────────────
  # Generate via the authorised secret channel:
  NEW_PASSWORD=$(openssl rand -base64 24)

  # Apply to Postgres:
  psql -U postgres -h 127.0.0.1 -c "ALTER USER arifos_admin WITH PASSWORD '$NEW_PASSWORD';"

  # Update kunci-mas.env (append-only for agents — human must do this):
  # POSTGRES_PASSWORD=<new_value>
  # DATABASE_URL=postgresql://arifos_admin:<new_value>@127.0.0.1:5432/vault999

  ⚠️  Agent MUST NOT write to kunci-mas.env.
  ⚠️  Only Arif (F13) or a designated human operator may update it.

───────────────────────────────────────────────────────────────
STEP 3: UPDATE ALL CONSUMERS
───────────────────────────────────────────────────────────────
  For each consumer, update the DATABASE_URL or POSTGRES_URL
  to reference the new password via environment variable.

  DO NOT hardcode the new password in any config file.
  All consumers must read from ${DATABASE_URL} or ${POSTGRES_URL}
  environment variables, which are set via kunci-mas.env.

  Files to verify (must NOT contain new password):
    ✅ A-FORGE/src/interfaces/mcp/proxyTools.ts
    ✅ AAA/a2a-server/chat_agent.py
    ✅ AAA/a2a-server/vault999_writer_fix.py

───────────────────────────────────────────────────────────────
STEP 4: RESTART CONSUMERS
───────────────────────────────────────────────────────────────
  systemctl restart a-forge
  systemctl restart aaa-a2a
  systemctl restart arifos
  systemctl restart arifflow
  systemctl restart kabarkan-worker  # if exists

  Wait 5s between each restart.
  Verify each is active: systemctl is-active <service>

───────────────────────────────────────────────────────────────
STEP 5: VERIFY CONNECTIVITY
───────────────────────────────────────────────────────────────
  for svc in arifos:8088 aforge:7071 aaa:3001 arifflow:7073; do
    n="${svc%%:*}"; p="${svc##*:}"
    curl -sf "http://127.0.0.1:$p/health" >/dev/null && echo "✅ $n" || echo "❌ $n"
  done

  # Direct DB connectivity test (do NOT print DSN):
  PGPASSWORD="$NEW_PASSWORD" psql -U arifos_admin -h 127.0.0.1 -d vault999 -c "SELECT 1 AS connectivity_test;"

───────────────────────────────────────────────────────────────
STEP 6: REVOKE OLD CREDENTIAL
───────────────────────────────────────────────────────────────
  # The old password was found in 5 source files.
  # After all consumers are verified on the NEW password:

  # Verify old password is no longer in any running config:
  # (run on VPS — checks process environments)
  for pid in $(pgrep -f "a-forge\|arifos\|aaa-a2a\|arifflow"); do
    if cat /proc/$pid/environ 2>/dev/null | tr '\0' '\n' | grep -q "ArifPostgres"; then
      echo "❌ PID $pid still has old credential in environment!"
    fi
  done

───────────────────────────────────────────────────────────────
STEP 7: VERIFY OLD CREDENTIAL REJECTED
───────────────────────────────────────────────────────────────
  # Attempt connection with old password — MUST FAIL:
  PGPASSWORD="<OLD_PASSWORD>" psql -U arifos_admin -h 127.0.0.1 -d vault999 -c "SELECT 1;" 2>&1
  # Expected: FATAL: password authentication failed

───────────────────────────────────────────────────────────────
STEP 8: MONITOR
───────────────────────────────────────────────────────────────
  journalctl -u a-forge -f --since "1 min ago" | grep -i "error\|fail\|denied"
  journalctl -u arifos -f --since "1 min ago" | grep -i "error\|fail\|denied"
  journalctl -u aaa-a2a -f --since "1 min ago" | grep -i "error\|fail\|denied"

  Watch for: "password authentication failed", "connection refused",
             "FATAL", "no pg_hba.conf entry"

───────────────────────────────────────────────────────────────
STEP 9: RECORD EVIDENCE (NO SECRETS)
───────────────────────────────────────────────────────────────
  Write to forge_work/2026-07-29/credential-rotation-receipt.md:
    - Timestamp of rotation
    - Services restarted (names only)
    - Health probe results (pass/fail counts)
    - SHA256 of backup files
    - Old password: REVOKED (do NOT record the value)
    - New password: ACTIVE (do NOT record the value)
    - Evidence: journalctl excerpts (redacted)

═══════════════════════════════════════════════════════════════════
  END RUNBOOK — DO NOT EXECUTE WITHOUT F13 APPROVE P2-CREDENTIAL ROTATE
═══════════════════════════════════════════════════════════════════
RUNBOOK

log "Runbook displayed. No actions taken."
log "Awaiting: F13 APPROVE P2-CREDENTIAL ROTATE"
