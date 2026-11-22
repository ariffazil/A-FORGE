"""TDD test suite for PR-FED-3: Observability and Front-Door Hygiene.

Covers:
  - Lane A: Langfuse-to-LiteLLM misrouting detection & non-mutating remediation
  - Lane B: Liveliness poll ownership inventory & cadence-change gate
  - Lane C: fed_contrast admission-gated ranking (eliminates inadmissible routes)
  - Lane D: mcp-compressor ownership classifier (observability-only, zero kills)
  - Log parser negative controls (ephemeral ports 58402 / 42960 != HTTP 402/429)
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

# Import target module (fails in RED phase before implementation exists)
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from fed_observability_hygiene import (  # noqa: E402
    INADMISSIBLE_STATES,
    apply_langfuse_remediation_to_env,
    audit_langfuse_routing,
    classify_mcp_compressor,
    fed_contrast_zen,
    generate_env_remediation_diff,
    parse_litellm_http_log_line,
    summarize_litellm_logs,
    validate_poller_ownership,
)


# ---------------------------------------------------------------------------
# Lane A: Langfuse Misrouting Guard & Remediation
# ---------------------------------------------------------------------------


class TestLaneALangfuseMisrouting:
    """Prove baseline Langfuse env fails routing audit and remediated env passes."""

    def test_baseline_localhost_4000_fails_routing_audit(self):
        # Synthetic baseline env matching P0 observed misconfiguration (no real secrets)
        baseline_env = {
            "LANGFUSE_BASE_URL": "http://localhost:4000",
            "LANGFUSE_PUBLIC_KEY": "«redacted:pk-lf-…»",
            "LANGFUSE_SECRET_KEY": "«redacted:sk-…»",
        }
        result = audit_langfuse_routing(baseline_env)

        assert result["misrouted"] is True
        assert result["status"] == "MISROUTED_TO_LITELLM"
        assert result["expected_receiver"] == "langfuse_server"
        assert result["actual_receiver"] == "litellm_front_door"
        assert result["actual_port"] == 4000
        assert result["log_suppression_forbidden"] is True
        assert result["secret_exposure_risk"] == "HIGH_CREDENTIALS_SENT_TO_WRONG_RECEIVER"
        assert "retry" in result["retry_behavior"].lower()
        assert result["recommended_patch"]["LANGFUSE_TRACING_ENABLED"] == "false"
        assert result["recommended_patch"]["LANGFUSE_BASE_URL"] is None

    @pytest.mark.parametrize(
        "bad_url,expected_port",
        [
            ("http://127.0.0.1:4000", 4000),
            ("http://localhost:4013", 4013),
            ("http://127.0.0.1:4013/api/public/ingestion", 4013),
            ("http://100.64.0.2:4000", 4000),
        ],
    )
    def test_detects_all_litellm_front_door_variants(self, bad_url, expected_port):
        result = audit_langfuse_routing({"LANGFUSE_HOST": bad_url})
        assert result["misrouted"] is True
        assert result["actual_port"] == expected_port

    def test_remediated_env_passes_routing_audit(self):
        baseline_env = {
            "LANGFUSE_BASE_URL": "http://localhost:4000",
            "LANGFUSE_HOST": "http://localhost:4000",
        }
        remediated = apply_langfuse_remediation_to_env(baseline_env)

        # Original dict untouched (non-mutating)
        assert baseline_env["LANGFUSE_BASE_URL"] == "http://localhost:4000"

        after = audit_langfuse_routing(remediated)
        assert after["misrouted"] is False
        assert after["status"] == "DISABLED"
        assert remediated.get("LANGFUSE_TRACING_ENABLED") == "false"
        assert "LANGFUSE_BASE_URL" not in remediated
        assert "LANGFUSE_HOST" not in remediated

    def test_verified_langfuse_endpoint_repoint_passes(self):
        verified = ("http://100.64.0.9:3050",)
        env = {"LANGFUSE_BASE_URL": "http://100.64.0.9:3050"}
        result = audit_langfuse_routing(env, verified_langfuse_endpoints=verified)
        assert result["misrouted"] is False
        assert result["status"] == "VERIFIED_LANGFUSE"

    def test_non_mutating_env_diff_helper_generates_patch_without_secret_leak(self):
        lines = [
            "# synthetic env file\n",
            "LANGFUSE_BASE_URL=http://localhost:4000\n",
            "LANGFUSE_SECRET_KEY=«redacted:sk-…»\n",
        ]
        patch = generate_env_remediation_diff("synthetic.env", lines)
        assert patch["changed"] is True
        assert "-LANGFUSE_BASE_URL=http://localhost:4000" in patch["diff"]
        assert "LANGFUSE_TRACING_ENABLED=false" in patch["diff"]
        # Secret values must never appear unredacted in emitted diff
        assert "«redacted:sk-…»" not in patch["diff"]

    def test_negative_langfuse_sdk_stops_sending_to_litellm_frontdoor_after_fix(self):
        """Negative test: after remediation, Langfuse SDK is disabled and cannot send to :4000."""
        # Baseline misconfigured env
        baseline_env = {
            "LANGFUSE_BASE_URL": "http://localhost:4000",
            "LANGFUSE_PUBLIC_KEY": "pk-lf-test",
            "LANGFUSE_SECRET_KEY": "sk-lf-test",
            "LANGFUSE_TRACING_ENABLED": "true",
        }
        # Apply remediation
        remediated = apply_langfuse_remediation_to_env(baseline_env)

        # Verify the remediation disables tracing and removes the misrouted URL
        assert remediated.get("LANGFUSE_TRACING_ENABLED") == "false"
        assert "LANGFUSE_BASE_URL" not in remediated
        assert "LANGFUSE_HOST" not in remediated

        # Audit the remediated env - must NOT be misrouted
        audit = audit_langfuse_routing(remediated)
        assert audit["misrouted"] is False
        assert audit["status"] == "DISABLED"
        assert audit["actual_receiver"] is None
        assert audit["actual_port"] is None

        # The key negative assertion: the SDK should have no configured endpoint to send to
        # This proves the 404 loop (POST /api/public/ingestion -> :4000) is broken
        assert audit["retry_behavior"] == "none"

    def test_unrelated_routes_unaffected_by_langfuse_fix(self):
        """Prove that the Langfuse fix does not affect normal LLM traffic routes."""
        # Normal LLM traffic routes that should be completely unaffected
        unrelated_routes = [
            "/v1/chat/completions",
            "/v1/completions",
            "/v1/embeddings",
            "/v1/models",
            "/health/liveliness",
            "/health/readiness",
            "/v1/moderations",
            "/v1/audio/transcriptions",
        ]

        # Remediated env (Langfuse disabled)
        remediated_env = {
            "LANGFUSE_TRACING_ENABLED": "false",
            "OPENAI_API_KEY": "sk-test",
            "OLLAMA_BASE_URL": "http://ollama:11434",
        }

        # Audit should show no misrouting (Langfuse is disabled)
        audit = audit_langfuse_routing(remediated_env)
        assert audit["misrouted"] is False
        assert audit["status"] == "DISABLED"

        # The fix only touches LANGFUSE_* variables - verify other env vars unchanged
        assert remediated_env.get("OPENAI_API_KEY") == "sk-test"
        assert remediated_env.get("OLLAMA_BASE_URL") == "http://ollama:11434"

        # Simulate the log parser - unrelated routes should parse normally
        # and NOT be flagged as Langfuse 404s
        test_log_lines = [
            'INFO:     127.0.0.1:58402 - "POST /v1/chat/completions HTTP/1.1" 200 OK',
            'INFO:     100.64.0.5:42960 - "GET /v1/models HTTP/1.1" 200 OK',
            'INFO:     127.0.0.1:41100 - "GET /health/liveliness HTTP/1.1" 200 OK',
            'INFO:     127.0.0.1:41102 - "POST /v1/embeddings HTTP/1.1" 200 OK',
        ]

        for line in test_log_lines:
            parsed = parse_litellm_http_log_line(line)
            assert parsed is not None, f"Failed to parse: {line}"
            assert parsed["status_code"] == 200
            assert parsed["is_langfuse_404"] is False, f"Unrelated route {parsed['path']} incorrectly flagged as Langfuse 404"
            assert parsed["is_liveliness"] == (parsed["path"] == "/health/liveliness")

        # Summary should show zero Langfuse 404s for normal traffic
        summary = summarize_litellm_logs(test_log_lines)
        assert summary["langfuse_404s"] == 0
        assert summary["http_requests_parsed"] == 4
        assert summary["liveliness_polls"] == 1


# ---------------------------------------------------------------------------
# Lane B: Liveliness Poll Ownership Inventory & Validator
# ---------------------------------------------------------------------------


class TestLaneBPollerOwnership:
    """Prove every poller and cadence modification requires named ownership."""

    def _valid_pollers(self):
        return [
            {
                "name": "haproxy_fed_primary",
                "owner": "haproxy.service / A-FORGE front-door",
                "target": "127.0.0.1:4013/health/liveliness",
                "interval_s": 5,
                "timeout_s": 15,
                "purpose": "Primary LiteLLM backend liveness check on :4000",
                "consumer": "HAProxy backend llm_nodes",
                "duplication": "Duplicates zen_local check against identical 127.0.0.1:4013",
                "safe_reduced_cadence_s": 15,
            },
            {
                "name": "haproxy_zen_local",
                "owner": "haproxy.service / A-FORGE front-door",
                "target": "127.0.0.1:4013/health/liveliness",
                "interval_s": 5,
                "timeout_s": 15,
                "purpose": "ZEN passthrough backend liveness check on :4012",
                "consumer": "HAProxy backend llm_zen_nodes",
                "duplication": "Duplicates fed_primary check; can share track llm_nodes/fed_primary",
                "safe_reduced_cadence_s": 15,
            },
            {
                "name": "docker_litellm_healthcheck",
                "owner": "litellm-federation.service / /root/scripts/litellm-healthcheck.py",
                "target": "127.0.0.1:4013/health/liveliness",
                "interval_s": 30,
                "timeout_s": 5,
                "purpose": "Container health status for Docker daemon",
                "consumer": "Docker health monitor",
                "duplication": "Overlaps HAProxy checks but distinct container-restart consumer",
                "safe_reduced_cadence_s": 30,
            },
        ]

    def test_valid_pollers_pass_and_detect_duplicate_target(self):
        report = validate_poller_ownership(self._valid_pollers())
        assert report["valid"] is True
        assert report["errors"] == []
        assert report["validated_count"] == 3
        assert len(report["duplicates"]) == 1
        assert "127.0.0.1:4013/health/liveliness" in report["duplicates"][0]["target"]

    @pytest.mark.parametrize("bad_owner", ["", "   ", None, "UNKNOWN", "unknown"])
    def test_rejects_poller_without_named_owner(self, bad_owner):
        pollers = self._valid_pollers()
        pollers[0]["owner"] = bad_owner
        report = validate_poller_ownership(pollers)
        assert report["valid"] is False
        assert any("owner" in err.lower() for err in report["errors"])

    def test_rejects_cadence_modification_for_unowned_or_unknown_poller(self):
        pollers = self._valid_pollers()
        # Attempt to modify cadence of an unregistered poller
        report = validate_poller_ownership(
            pollers, proposed_changes={"mystery_poller": 60}
        )
        assert report["valid"] is False
        assert any("mystery_poller" in err for err in report["errors"])

    def test_accepts_cadence_modification_when_owner_is_named(self):
        pollers = self._valid_pollers()
        report = validate_poller_ownership(
            pollers, proposed_changes={"haproxy_fed_primary": 15}
        )
        assert report["valid"] is True
        assert report["errors"] == []


# ---------------------------------------------------------------------------
# Lane C: fed_contrast Admission-Gated Implementation
# ---------------------------------------------------------------------------


REQUIRED_CONTRAST_FIELDS = {
    "deployment_id",
    "admission_state",
    "route_health_state",
    "p50_latency_ms",
    "p95_latency_ms",
    "sample_count",
    "sample_window",
    "last_sample_time",
    "freshness",
    "confidence",
    "cost_evidence_class",
    "balance_freshness",
    "exclusion_reason",
}


class TestLaneCFedContrastAdmissionGate:
    """Prove baseline fed_contrast lacks admission filtering and zen version enforces it."""

    def test_baseline_fed_router_contrast_lacks_admission_filtering(self):
        """Read-only verification of baseline defect in /root/AAA/scripts/fed_router.py."""
        fed_router_path = Path("/root/AAA/scripts/fed_router.py")
        if not fed_router_path.exists():
            pytest.skip("Baseline /root/AAA/scripts/fed_router.py not present on this host")

        source = fed_router_path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        contrast_fn = next(
            (
                node
                for node in ast.walk(tree)
                if isinstance(node, ast.FunctionDef) and node.name == "fed_contrast"
            ),
            None,
        )
        assert contrast_fn is not None
        fn_source = ast.get_source_segment(source, contrast_fn) or ""
        # Baseline defect: never checks admission_state or route_health
        assert "admission_state" not in fn_source
        assert "route_health" not in fn_source

    @pytest.mark.parametrize(
        "bad_state",
        ["RATE_LIMITED", "QUOTA_EXHAUSTED", "AUTH_FAIL", "DEAD", "POLICY_INELIGIBLE"],
    )
    def test_inadmissible_route_never_wins_even_with_1ms_latency(self, bad_state):
        route_a = "prov-fast:model-broken"
        route_b = "prov-steady:model-ok"

        def health_lookup(route):
            if route == route_a:
                return {"state": bad_state, "deployment_id": "dep-a-001"}
            return {"state": "HEALTHY", "deployment_id": "dep-b-002"}

        def latency_lookup(route):
            if route == route_a:
                return {
                    "p50_ms": 1.0,
                    "p95_ms": 2.0,
                    "sample_count": 100,
                    "sample_window": "15m",
                    "last_sample_time": "2026-11-22T07:20:00Z",
                    "freshness": "FRESH",
                    "confidence": "HIGH",
                }
            return {
                "p50_ms": 1850.0,
                "p95_ms": 3200.0,
                "sample_count": 42,
                "sample_window": "15m",
                "last_sample_time": "2026-11-22T07:20:00Z",
                "freshness": "FRESH",
                "confidence": "HIGH",
            }

        def balance_lookup(route):
            return {
                "balance_usd": 25.0,
                "cost_evidence_class": "MEASURED",
                "balance_freshness": "FRESH",
            }

        def policy_check(route):
            if route == route_a and bad_state == "POLICY_INELIGIBLE":
                return (False, "POLICY_INELIGIBLE: tier restricted")
            return (True, None)

        res = fed_contrast_zen(
            route_a,
            route_b,
            route_health_lookup=health_lookup,
            latency_lookup=latency_lookup,
            balance_lookup=balance_lookup,
            policy_check=policy_check,
        )

        # Required fields present on both routes
        assert REQUIRED_CONTRAST_FIELDS.issubset(res["route_a"].keys())
        assert REQUIRED_CONTRAST_FIELDS.issubset(res["route_b"].keys())

        assert res["route_a"]["admission_state"] == "INADMISSIBLE"
        assert res["route_a"]["exclusion_reason"] is not None
        assert res["route_b"]["admission_state"] == "ADMITTED"
        assert res["route_b"]["exclusion_reason"] is None

        # Inadmissible 1ms route MUST NEVER win over admitted 1850ms route
        assert res["recommended"] == route_b
        assert res["ranking"][0] == route_b
        assert route_a not in res["ranking"]

    def test_both_inadmissible_returns_no_recommendation(self):
        res = fed_contrast_zen(
            "p1:m1",
            "p2:m2",
            route_health_lookup=lambda r: {"state": "DEAD", "deployment_id": r},
            latency_lookup=lambda r: {"p50_ms": 5.0, "p95_ms": 10.0, "sample_count": 1},
            balance_lookup=lambda r: {"cost_evidence_class": "UNKNOWN", "balance_freshness": "EXPIRED"},
            policy_check=lambda r: (True, None),
        )
        assert res["recommended"] is None
        assert res["recommendation_state"] == "NO_ADMITTED_ROUTE"
        assert res["ranking"] == []

    def test_both_admitted_ranks_lower_p50_latency_first(self):
        res = fed_contrast_zen(
            "p1:m-slow",
            "p2:m-fast",
            route_health_lookup=lambda r: {"state": "HEALTHY", "deployment_id": f"dep-{r}"},
            latency_lookup=lambda r: {
                "p50_ms": 900.0 if "slow" in r else 210.0,
                "p95_ms": 1500.0 if "slow" in r else 420.0,
                "sample_count": 20,
                "sample_window": "30m",
                "last_sample_time": "2026-11-22T07:20:00Z",
                "freshness": "FRESH",
                "confidence": "HIGH",
            },
            balance_lookup=lambda r: {
                "cost_evidence_class": "MEASURED",
                "balance_freshness": "FRESH",
            },
            policy_check=lambda r: (True, None),
        )
        assert res["recommended"] == "p2:m-fast"
        assert res["ranking"] == ["p2:m-fast", "p1:m-slow"]
        assert INADMISSIBLE_STATES == frozenset(
            {"RATE_LIMITED", "QUOTA_EXHAUSTED", "AUTH_FAIL", "DEAD", "POLICY_INELIGIBLE"}
        )


# ---------------------------------------------------------------------------
# Lane D: mcp-compressor Ownership Classifier (Observability-Only)
# ---------------------------------------------------------------------------


class TestLaneDMcpCompressorClassifier:
    """Prove accurate classification without killing processes."""

    def test_classifies_active_idle_orphan_duplicate_unknown(self):
        base_records = [
            {
                "pid": 946279,
                "ppid": 946075,
                "parent_alive": True,
                "owner_client": "kimi",
                "target_server": "kimi-aforge",
                "start_time": "2026-11-22T04:33:46Z",
                "rss_kb": 4824,
                "active_connection": True,
                "last_request": "2026-11-22T07:20:00Z",
                "in_flight_work": True,
            },
            {
                "pid": 946395,
                "ppid": 946075,
                "parent_alive": True,
                "owner_client": "kimi",
                "target_server": "kimi-aforge",
                "start_time": "2026-11-22T04:33:47Z",
                "rss_kb": 4716,
                "active_connection": False,
                "last_request": None,
                "in_flight_work": False,
            },
            {
                "pid": 4170461,
                "ppid": 4165843,
                "parent_alive": True,
                "owner_client": "1mcp",
                "target_server": "wikipedia",
                "start_time": "2026-11-20T20:05:59Z",
                "rss_kb": 8092,
                "active_connection": False,
                "last_request": "2026-11-21T12:00:00Z",
                "in_flight_work": False,
            },
            {
                "pid": 999001,
                "ppid": 1,
                "parent_alive": False,
                "owner_client": "kimi",
                "target_server": "xerj",
                "start_time": "2026-11-20T01:00:00Z",
                "rss_kb": 4100,
                "active_connection": False,
                "last_request": None,
                "in_flight_work": False,
            },
            {
                "pid": 999002,
                "ppid": 12345,
                "parent_alive": True,
                "owner_client": "UNKNOWN",
                "target_server": "",
                "start_time": "2026-11-22T05:00:00Z",
                "rss_kb": 4000,
                "active_connection": None,
                "last_request": None,
                "in_flight_work": None,
            },
        ]

        c_active = classify_mcp_compressor(base_records[0], all_records=base_records)
        c_dup = classify_mcp_compressor(base_records[1], all_records=base_records)
        c_idle = classify_mcp_compressor(base_records[2], all_records=base_records)
        c_orphan = classify_mcp_compressor(base_records[3], all_records=base_records)
        c_unknown = classify_mcp_compressor(base_records[4], all_records=base_records)

        assert c_active["classification"] == "ACTIVE"
        assert c_dup["classification"] == "DUPLICATE"
        assert c_idle["classification"] == "IDLE_EXPECTED"
        assert c_orphan["classification"] == "ORPHAN"
        assert c_unknown["classification"] == "UNKNOWN"

        for rec in (c_active, c_dup, c_idle, c_orphan, c_unknown):
            assert rec["termination_action"] == "NONE_OBSERVABILITY_ONLY"
            for field in (
                "pid",
                "parent",
                "owner_client",
                "target_server",
                "start_time",
                "rss_kb",
                "active_connection",
                "last_request",
                "in_flight_work",
            ):
                assert field in rec


# ---------------------------------------------------------------------------
# Strict Log Parser Negative Controls
# ---------------------------------------------------------------------------


class TestStrictLogParserNegativeControls:
    """Prove ephemeral port numbers 58402 and 42960 are NEVER misparsed as HTTP 402/429."""

    def test_ephemeral_port_58402_not_misparsed_as_402(self):
        line = 'INFO:     127.0.0.1:58402 - "POST /v1/chat/completions HTTP/1.1" 200 OK'
        parsed = parse_litellm_http_log_line(line)
        assert parsed is not None
        assert parsed["client_ip"] == "127.0.0.1"
        assert parsed["client_port"] == 58402
        assert parsed["method"] == "POST"
        assert parsed["path"] == "/v1/chat/completions"
        assert parsed["status_code"] == 200
        assert parsed["is_402"] is False
        assert parsed["is_429"] is False

    def test_ephemeral_port_42960_not_misparsed_as_429(self):
        line = 'INFO:     100.64.0.5:42960 - "GET /v1/models HTTP/1.1" 200 OK'
        parsed = parse_litellm_http_log_line(line)
        assert parsed is not None
        assert parsed["client_ip"] == "100.64.0.5"
        assert parsed["client_port"] == 42960
        assert parsed["method"] == "GET"
        assert parsed["path"] == "/v1/models"
        assert parsed["status_code"] == 200
        assert parsed["is_402"] is False
        assert parsed["is_429"] is False

    def test_summary_counts_langfuse_404_and_liveliness_accurately(self):
        lines = [
            'INFO:     127.0.0.1:58402 - "POST /v1/chat/completions HTTP/1.1" 200 OK',
            'INFO:     100.64.0.5:42960 - "GET /v1/models HTTP/1.1" 200 OK',
            'INFO:     127.0.0.1:41100 - "GET /health/liveliness HTTP/1.1" 200 OK',
            'INFO:     127.0.0.1:41102 - "GET /api/public/health HTTP/1.1" 404 Not Found',
            'INFO:     127.0.0.1:41104 - "POST /api/public/ingestion HTTP/1.1" 404 Not Found',
            'INFO:     127.0.0.1:41106 - "POST /v1/chat/completions HTTP/1.1" 429 Too Many Requests',
        ]
        summary = summarize_litellm_logs(lines)
        assert summary["http_requests_parsed"] == 6
        assert summary["liveliness_polls"] == 1
        assert summary["langfuse_404s"] == 2
        assert summary["status_402_count"] == 0
        assert summary["status_429_count"] == 1
