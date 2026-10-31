#!/usr/bin/env bash
# fed-parity-guard.sh — FED fail-closed capability guard (Forged 2026-10-21, 333-AGI)
#
# FAILURE CLASS THIS PREVENTS:
#   HAProxy backend health was `GET /health/liveliness` — a liveness check, not a
#   CAPABILITY check. A node can be alive while serving a different model cascade
#   under the same model_name (observed 2026-10-21: KVM4 `forge-777` -> glm-5.3-flash
#   while KVM8 `forge-777` -> deepseek-v4-pro). Failover then swaps the brain silently
#   and the caller has no signal. In a recursive-improvement loop that poisons memory.
#
# CONTRACT: the backup node is allowed in rotation ONLY if its model set is identical
#   to the primary's. Mismatch -> force MAINT (fail-closed). Never fail-open.
#
# TRANSPORT: HAProxy master CLI (`-S /run/haproxy-master.sock`). Requires
#   `stats socket /run/haproxy-admin.sock level admin` in the global block.
#
# EXIT: 0 = parity ok (or primary down — alarm only), 1 = drift detected -> backup MAINT
#
set -uo pipefail

PRIMARY="${PRIMARY:-http://127.0.0.1:4013}"
BACKUP="${BACKUP:-http://100.64.0.5:4000}"
SOCK="${SOCK:-/run/haproxy-admin.sock}"
BACKEND="${BACKEND:-llm_nodes}"
SERVER="${SERVER:-fed_backup}"
STATE_FILE="${STATE_FILE:-/var/lib/arifos/fed-parity-state.json}"
MASTER_KEY_ENV="${MASTER_KEY_ENV:-/root/.secrets/kunci-mas.flat.env}"
RECEIPT_DIR="${RECEIPT_DIR:-/root/.local/share/arifos/fed-parity}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
mkdir -p "$(dirname "$STATE_FILE")" "$RECEIPT_DIR"

# master key: never echo
KEY=$(grep -E '^LITELLM_MASTER_KEY=' "$MASTER_KEY_ENV" 2>/dev/null | head -1 | cut -d= -f2-)
[ -z "${KEY:-}" ] && {
	log "FATAL no master key in $MASTER_KEY_ENV"
	exit 2
}

fetch_models() {
	curl -s -m 12 -H "Authorization: Bearer $KEY" "$1/v1/models" |
		python3 -c 'import sys,json;print("\n".join(sorted(m["id"] for m in json.load(sys.stdin).get("data",[]))))' 2>/dev/null
}

P=$(fetch_models "$PRIMARY")
B=$(fetch_models "$BACKUP")

# Primary unreachable is a separate alarm (do not touch rotation on this path).
if [ -z "$P" ]; then
	log "ALARM primary unreachable — rotation untouched"
	printf '{"ts":"%s","primary":"down","backup_count":%d}\n' "$(date -u +%FT%TZ)" "$(printf '%s' "$B" | grep -c .)" >"$STATE_FILE"
	exit 0
fi

# Backup unreachable: HAProxy's own health check will handle it. Nothing to force.
if [ -z "$B" ]; then
	log "backup unreachable — HAProxy health check owns this"
	exit 0
fi

PH=$(printf '%s' "$P" | sha256sum | cut -d' ' -f1)
BH=$(printf '%s' "$B" | sha256sum | cut -d' ' -f1)
MISSING=$(comm -23 <(printf '%s\n' "$P") <(printf '%s\n' "$B") | tr '\n' ',')
EXTRA=$(comm -13 <(printf '%s\n' "$P") <(printf '%s\n' "$B") | tr '\n' ',')

set_state() {
	# $1 = maint|ready
	[ -S "$SOCK" ] || {
		log "WARN admin socket $SOCK absent — cannot enforce"
		return 3
	}
	echo "set server $BACKEND/$SERVER state $1" | socat stdio "$SOCK" >/dev/null 2>&1
}

if [ "$PH" = "$BH" ]; then
	log "PARITY OK primary=$PH backup=$BH models=$(printf '%s' "$P" | grep -c .)"
	set_state ready
	printf '{"ts":"%s","verdict":"PARITY_OK","hash":"%s","models":%d,"backup_maint":false}\n' \
		"$(date -u +%FT%TZ)" "$PH" "$(printf '%s' "$P" | grep -c .)" >"$STATE_FILE"
	exit 0
fi

log "DRIFT primary=$PH backupset=$BH"
log "  missing_on_backup: ${MISSING:-none}"
log "  extra_on_backup:   ${EXTRA:-none}"

set_state maint
RC=$?

RID="$RECEIPT_DIR/drift-$(date -u +%Y%m%dT%H%M%SZ).json"
printf '{"ts":"%s","verdict":"DRIFT","primary_hash":"%s","backup_hash":"%s","missing_on_backup":"%s","extra_on_backup":"%s","action":"backup->MAINT","enforced":%s}\n' \
	"$(date -u +%FT%TZ)" "$PH" "$BH" "$MISSING" "$EXTRA" \
	"$([ $RC -eq 0 ] && echo true || echo false)" >"$RID"
printf '{"ts":"%s","verdict":"DRIFT","hash":"%s","backup_maint":true}\n' "$(date -u +%FT%TZ)" "$PH" >"$STATE_FILE"
log "receipt: $RID"
exit 1
