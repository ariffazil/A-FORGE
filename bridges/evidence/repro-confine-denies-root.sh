#!/usr/bin/env bash
# repro-confine-denies-root.sh — reproducible proof for the 2026-09-20 finding.
#
# CLAIM UNDER TEST
#   gws_truth_test.py's verdict text states:
#     "No filesystem or LSM mechanism denies root on the same kernel.
#      Fix = run citizens as non-root, or move token custody off-box."
#
#   That conclusion is FALSE, and the suite's own V2 already contradicts it
#   (absolute /usr/bin/gws, executed as root, is denied with exit 4 — because
#   that exec enters an AppArmor profile).
#
# WHAT THIS SCRIPT SHOWS
#   Two identical shell scripts read /root/.config/gws/.encryption_key.
#   One is covered by an AppArmor profile, one is not. Both run as uid 0.
#   CONTROL   (unconfined root) -> READABLE
#   TREATMENT (confined   root) -> DENIED
#   Same uid, same kernel, same file. Only the LSM label differs.
#
# WHY IT MATTERS
#   The remedy is therefore NOT "move the files to another uid" — root reads any
#   file regardless of ownership — and NOT "non-root citizens" (a much larger
#   change). The remedy is to CONFINE THE CALLERS. The mechanism already exists
#   on this host and already binds root. It is simply not applied to the
#   processes that constitute the threat.
#
# RUN
#   sudo bash repro-confine-denies-root.sh          # loads profile, proves, cleans up
set -euo pipefail

PROFILE_NAME="arifos-citizen-probe"
FREE=/tmp/citizen-free.sh
CONF=/tmp/citizen-conf.sh
PROFILE_SRC=/tmp/${PROFILE_NAME}.src

cleanup() {
  apparmor_parser -R /etc/apparmor.d/${PROFILE_NAME} 2>/dev/null || true
  rm -f /etc/apparmor.d/${PROFILE_NAME} "$FREE" "$CONF" "$PROFILE_SRC"
}
trap cleanup EXIT

cat > "$FREE" <<'EOF'
#!/bin/sh
if head -c 16 /root/.config/gws/.encryption_key >/dev/null 2>&1; then
    echo "TOKENSTORE=READABLE"
else
    echo "TOKENSTORE=DENIED"
fi
EOF

cat > "$CONF" <<'EOF'
#!/bin/sh
if head -c 16 /root/.config/gws/.encryption_key >/dev/null 2>&1; then
    echo "TOKENSTORE=READABLE"
else
    echo "TOKENSTORE=DENIED"
fi
EOF
chmod +x "$FREE" "$CONF"

cat > "$PROFILE_SRC" <<EOF
#include <tunables/global>
profile ${PROFILE_NAME} ${CONF} flags=(attach_disconnected) {
  ${CONF} r,
  /lib/** rm,
  /usr/lib/** rm,
  /usr/local/lib/** rm,
  /etc/ld.so.cache r,
  /etc/ld.so.preload r,
  /{usr/,}bin/sh rix,
  /{usr/,}bin/dash rix,
  /usr/bin/head rix,
  /dev/null rw,
  deny /root/.config/gws/** rwklm,
}
EOF

cp "$PROFILE_SRC" /etc/apparmor.d/${PROFILE_NAME}
apparmor_parser -r /etc/apparmor.d/${PROFILE_NAME}

echo "uid under test: $(id -u)"
echo "--- CONTROL   (unconfined root) ---"; "$FREE"
echo "--- TREATMENT (confined   root) ---"; "$CONF"
echo
echo "READABLE + DENIED at the same uid => the LSM does bind root."
echo "=> remedy is to confine the CALLERS, not to move the files."
