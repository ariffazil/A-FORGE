"""
tests/mcp-conformance/test_telemetry_transport_vs_governance.py

Round 2, item 4. Bug: A-FORGE telemetry conflates transport success
with governance success. The wrapper at
src/interfaces/mcp/telemetry.ts:327-356 records every handler that
returns (no throw) as `action: "success"`. The governance tools
(forge_check_governance, forge_heart_critique, forge_judge_proxy, …)
return governance HOLD/VOID/SEAL verdicts inside a `{ok: true, ...}`
envelope. The envelope is `ok: true` even when the verdict is HOLD,
so the wrapper records the call as a SUCCESS even though the
governance said HOLD.

Run 2 reproduced this live: forge_check_governance was called twice
and both were blocked; both were counted as 2 successes.

Fix contract (RED→green):

  RED:  telemetry.successes and audit event action="success" are
        both incremented for non-SEAL governance verdicts.
  GREEN: telemetry exposes separate transport_ok and governance_verdict
         fields. successes counts only transport_ok + verdict==SEAL.
         A new field (held/blocked) counts transport_ok + verdict!=SEAL.
         Audit events carry both fields.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


TELEMETRY_PATH = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "interfaces"
    / "mcp"
    / "telemetry.ts"
)


def _read() -> str:
    assert TELEMETRY_PATH.exists(), f"telemetry file missing: {TELEMETRY_PATH}"
    return TELEMETRY_PATH.read_text()


class TestTelemetrySplit:
    def test_wrapper_does_not_record_success_for_hold_verdict(self) -> None:
        """The wrapper at line 327 unconditionally calls
        recordSuccess(toolName) on the try-branch. A handler that
        returns a HOLD verdict (e.g. forge_check_governance blocked
        by kernel) must NOT count as a success.
        """
        src = _read()
        # Find the wrapper body.
        wrapper_match = re.search(
            r"export\s+function\s+withTelemetry[\s\S]*?return\s+async\s*\(args[\s\S]*?\}\s*\)\s*;",
            src,
        )
        assert wrapper_match, "could not locate withTelemetry wrapper body"
        body = wrapper_match.group(0)

        # The wrapper must extract a verdict from the handler result
        # and route recordSuccess / recordBlocked based on that
        # verdict. We look for the routing pattern anywhere in the
        # wrapper body.
        has_verdict_routing = bool(
            re.search(
                r"(verdict|governanceVerdict)\s*===?\s*[\"']SEAL[\"']",
                body,
            )
            and re.search(
                r"recordBlocked",
                body,
            )
        )
        assert has_verdict_routing, (
            "RED: the withTelemetry wrapper does not route on governance "
            "verdict. Either it calls recordSuccess unconditionally, or it "
            "never extracts a verdict from the handler result. Either way, "
            "transport-OK + HOLD is counted as a success. Fix: extract a "
            "verdict from the handler's content[0].text and route to "
            "recordBlocked (for HOLD/VOID/SABAR) vs recordSuccess (SEAL)."
        )

    def test_audit_event_carries_transport_ok_and_governance_verdict(self) -> None:
        """The audit event must carry both transport_ok and
        governance_verdict so a downstream consumer can distinguish
        'the call reached the server' from 'the governance approved it'.
        """
        src = _read()
        audit_interface = re.search(
            r"export\s+interface\s+AuditEvent\s*\{(.*?)\n\}",
            src,
            re.DOTALL,
        )
        assert audit_interface, "could not locate AuditEvent interface"
        body = audit_interface.group(1)
        assert "transport_ok" in body, (
            "RED: AuditEvent does not declare a transport_ok field. "
            "Add it (boolean) so audit consumers can distinguish transport "
            "delivery from governance approval."
        )
        assert "governance_verdict" in body, (
            "RED: AuditEvent does not declare a governance_verdict field. "
            "Add it (SEAL | HOLD | VOID | SABAR | UNKNOWN) so audit "
            "consumers know what the governance actually said."
        )

    def test_telemetry_summary_exposes_blocked_counter(self) -> None:
        """The TelemetrySummary interface must expose a blocked (or
        equivalent non-success) counter so dashboards can surface
        'transport-OK but governance-not-SEAL' as a distinct metric.
        """
        src = _read()
        summary_interface = re.search(
            r"export\s+interface\s+TelemetrySummary\s*\{(.*?)\n\}",
            src,
            re.DOTALL,
        )
        assert summary_interface, "could not locate TelemetrySummary interface"
        body = summary_interface.group(1)
        has_blocked = bool(
            re.search(r"\bblocked\b", body)
            or re.search(r"\bgovernance_holds\b", body)
            or re.search(r"\bnon_seal\b", body)
        )
        assert has_blocked, (
            "RED: TelemetrySummary exposes only `successes` and `failures`. "
            "Add a third counter for transport-OK + governance-not-SEAL "
            "so dashboards can show 'the system held correctly' vs "
            "'the system was bypassed'."
        )
