#!/bin/sh
# admission-deny-path fixtures — STAGE ONLY (Arif 2026-11-19): harmless sandbox.
# Proves the deny CONTRACT before any production wiring. No sudoers installed.
# Fixture gate reads an admission JSON path and enforces:
#   ALLOW  -> run bounded stub op, exit 0, receipt line
#   DENY   -> refuse, exit 7, reason + receipt line
#   MISSING/STALE/MALFORMED -> fail closed, exit 9
# Real wrapper (Phase 2) will reuse this exact contract against
# /run/arifos/admission.json + sudoers boundary. These fixtures never touch prod.
set -u
GATE_AGE_MAX="${GATE_AGE_MAX:-900}"
adm="${1:-${ADMISSION_PATH:-/run/arifos/admission.json}}"
rc=0
now=$(date +%s)
verdict="UNKNOWN"; reason="no verdict path"; mtime=0
if [ ! -r "$adm" ]; then
  verdict="UNKNOWN"; reason="admission missing/unreadable"
elif ! python3 -c "import json,sys;json.load(open('$adm'))" 2>/dev/null; then
  verdict="UNKNOWN"; reason="admission malformed"
else
  mtime=$(stat -c %Y "$adm")
  age=$((now - mtime))
  if [ "$age" -gt "$GATE_AGE_MAX" ]; then
    verdict="UNKNOWN"; reason="admission stale (${age}s > ${GATE_AGE_MAX}s)"
  else
    verdict=$(python3 -c "import json;print(json.load(open('$adm')).get('machine',{}).get('health','UNKNOWN'))")
    reason="health=$verdict"
  fi
fi
case "$verdict" in
  OK)
    echo "RECEIPT admit=ALLOW op=stub-bounded result=executed reason='$reason'"
    rc=0 ;;
  RED|DEGRADED)
    echo "RECEIPT admit=DENY op=stub-bounded result=REFUSED exit=7 reason='$reason (deny-path contract)'"
    rc=7 ;;
  *)
    echo "RECEIPT admit=UNKNOWN op=stub-bounded result=FAIL_CLOSED exit=9 reason='$reason'"
    rc=9 ;;
esac
exit $rc
