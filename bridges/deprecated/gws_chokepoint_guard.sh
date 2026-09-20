#!/usr/bin/env bash
# gws_chokepoint_guard.sh — arifOS gws Chokepoint Interceptor
# Canonical Spec: /root/AAA/canon/FEDERATION_GMAIL_GATEWAY_SPEC.md
#
# ⚠ NOT WIRED — 2026-09-20 (Hermes, independent probe)
# ----------------------------------------------------------------------------
# This script is NOT on PATH, NOT aliased, NOT wrapped, and NOT called by any
# component except its own test. `mail_gateway.py` calls bare `["gws", ...]`,
# which resolves via PATH to /usr/bin/gws and never touches this file.
#
# It also carries an env-var bypass: ARIFOS_MAIL_GATEWAY_INTERNAL=1 is settable
# by any process, so it is a convention, not a control.
#
# Measured (verify_gmail_chokepoint.py PART A, 2026-09-20): 4 bypass paths OPEN.
# Suite verdict: GOVERNED-WRAPPER ONLY — NOT_A_CHOKEPOINT (exit 2).
#
# Do NOT cite this script as evidence of a security boundary. Wiring it up as-is
# would produce security theatre: it would block honest callers while any caller
# who sets one env var, or reaches the absolute path, passes straight through.
# A real boundary is OS-level — see the Spec's "Not yet implemented".
# ----------------------------------------------------------------------------
#
# Intercepts direct 'gws gmail' executions by citizen agents (HERMES, OpenCode, Qwen, etc.)
# Enforces complete mediation: only internal mail_gateway execution is permitted.

if [ "$1" = "gmail" ] && [ "$ARIFOS_MAIL_GATEWAY_INTERNAL" != "1" ]; then
    echo "==================================================================" >&2
    echo "DENIED: Direct Gmail invocation via gws is strictly forbidden." >&2
    echo "Authority Envelope Policy: Capability ≠ Authority." >&2
    echo "Access Gmail exclusively via arifOS Mail Gateway:" >&2
    echo "  python3 /root/A-FORGE/bridges/mail_gateway.py dispatch \\" >&2
    echo "    --actor-id <ID> --purpose <PURPOSE> --intent <INTENT> --params '<JSON>'" >&2
    echo "==================================================================" >&2
    exit 13
fi

# Pass-through to underlying gws binary for non-Gmail services (drive, calendar, sheets)
# or authorized internal mail_gateway execution
exec /usr/bin/gws "$@"
