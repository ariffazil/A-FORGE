#!/bin/bash
# Federation Lane Conformance — one-shot runner (Lane B + Lane A + Lane C).
#
# Usage:
#   AF_SESSION_ID=<sess> AF_ACT=<act_v1.*> bash /root/A-FORGE/conformance/lease-lane/run_all.sh
# Without credentials, Lane B runs and A3–A5/C1–C2 are marked SKIP.
#
# Exit 0 = every hard assertion held across all lanes.

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "─── Lane B: deterministic lease-gate matrix (deployed dist module) ───"
node --test "$HERE/leaseLaneConformance.test.mjs" || LANE_B=1
LANE_B=${LANE_B:-0}

echo ""
echo "─── Lane A + C: live ingress + kernel seal gate probes ───"
python3 "$HERE/lease_lane_probe.py" || LANE_AC=1
LANE_AC=${LANE_AC:-0}

echo ""
if [ "$LANE_B" -ne 0 ] || [ "$LANE_AC" -ne 0 ]; then
	echo "FAIL: at least one lane failed — see results above"
	exit 1
fi
echo "PASS: all federation lane conformance assertions held"
