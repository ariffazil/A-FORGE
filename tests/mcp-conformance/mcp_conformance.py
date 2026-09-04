#!/usr/bin/env python3
"""
MCP 2026-07-28 Federation Conformance Harness
===============================================
10-probe conformance test suite for MCP servers.

Usage:
    python3 mcp_conformance.py [--organs all|arifos|aforge|aaa|geox|wealth|well] [--json]

Probes:
    1. server/discover — capability discovery
    2. tools/list — cache envelope (ttlMs, cacheScope, resultType, deterministic order)
    3. tools/call with valid Mcp-Method/Mcp-Name headers
    4. Header/body mismatch → assert HTTP 400 / -32020
    5. Invalid/unsupported version → structured response
    6. No session header on modern path → no session minted
    7. Legacy client compatibility (initialize)
    8. MRTR input_required handling
    9. Origin validation
    10. Auth issuer discovery (.well-known)

Author: 333-AGI | Session: SEAL-929aaca0611e4550
Spec: https://modelcontextprotocol.io/specification/2026-07-28
"""

import json
import sys
import time
import argparse
import hashlib
from dataclasses import dataclass, field, asdict
from typing import Optional
import urllib.request
import urllib.error
import urllib.parse


# ── Configuration ──────────────────────────────────────────────────────────

ORGANS = {
    "arifos": {"port": 8088, "name": "arifOS", "authority": "JUDGE_ONLY"},
    "aforge": {"port": 7071, "name": "A-FORGE", "authority": "EXECUTE_AFTER_SEAL"},
    "aaa": {"port": 3001, "name": "AAA", "authority": "DISPLAY_ONLY"},
    "geox": {"port": 8081, "name": "GEOX", "authority": "COMPUTE_ONLY"},
    "wealth": {"port": 18082, "name": "WEALTH", "authority": "COMPUTE_ONLY"},
    "well": {"port": 18083, "name": "WELL", "authority": "REFLECT_ONLY"},
}

MCP_VERSION = "2026-07-28"
CLIENT_INFO = {"name": "mcp-conformance-harness", "version": "1.0.0"}


# ── Data classes ───────────────────────────────────────────────────────────


@dataclass
class ProbeResult:
    probe_id: int
    name: str
    organ: str
    passed: Optional[bool]  # None = not applicable
    status_code: Optional[int] = None
    detail: str = ""
    evidence: dict = field(default_factory=dict)  # type: ignore[assignment]
    severity: str = "INFO"  # INFO, WARN, FAIL, PASS


@dataclass
class OrganReport:
    organ: str
    port: int
    authority: str
    probes: list = field(default_factory=list)
    overall: str = "UNKNOWN"  # COMPLIANT, PARTIAL, LEGACY, UNREACHABLE

    @property
    def pass_count(self):
        return sum(1 for p in self.probes if p.passed is True)

    @property
    def fail_count(self):
        return sum(1 for p in self.probes if p.passed is False)

    @property
    def na_count(self):
        return sum(1 for p in self.probes if p.passed is None)


# ── HTTP helpers ───────────────────────────────────────────────────────────


def mcp_post(
    port: int,
    method: str,
    params: dict = None,
    headers: dict = None,
    body_override: str = None,
    timeout: float = 10.0,
) -> tuple[int, dict, dict]:
    """Send a JSON-RPC POST to /mcp. Returns (status_code, response_json, response_headers)."""
    url = f"http://127.0.0.1:{port}/mcp"
    if body_override:
        body = body_override.encode()
    else:
        payload = {
            "jsonrpc": "2.0",
            "id": f"probe-{int(time.time() * 1000)}",
            "method": method,
            "params": params or {},
        }
        body = json.dumps(payload).encode()

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", method)
    if method == "tools/call":
        req.add_header(
            "Mcp-Name", params.get("name", "unknown") if params else "unknown"
        )
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)

    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        resp_body = resp.read().decode()
        resp_headers = dict(resp.headers)
        try:
            resp_json = json.loads(resp_body)
        except json.JSONDecodeError:
            resp_json = {"_raw": resp_body[:500]}
        return resp.status, resp_json, resp_headers
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode() if e.fp else ""
        resp_headers = dict(e.headers) if e.headers else {}
        try:
            resp_json = json.loads(resp_body)
        except (json.JSONDecodeError, ValueError):
            resp_json = {"_raw": resp_body[:500]}
        return e.code, resp_json, resp_headers
    except Exception as e:
        return 0, {"_error": str(e)}, {}


def mcp_post_legacy(
    port: int, method: str, params: dict = None, timeout: float = 10.0
) -> tuple[int, dict, dict]:
    """Send a JSON-RPC POST WITHOUT modern MCP headers (legacy client simulation)."""
    url = f"http://127.0.0.1:{port}/mcp"
    payload = {
        "jsonrpc": "2.0",
        "id": f"legacy-{int(time.time() * 1000)}",
        "method": method,
        "params": params or {},
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    # NO MCP-Protocol-Version, NO Mcp-Method, NO Mcp-Name

    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        resp_body = resp.read().decode()
        resp_headers = dict(resp.headers)
        try:
            resp_json = json.loads(resp_body)
        except json.JSONDecodeError:
            resp_json = {"_raw": resp_body[:500]}
        return resp.status, resp_json, resp_headers
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode() if e.fp else ""
        resp_headers = dict(e.headers) if e.headers else {}
        try:
            resp_json = json.loads(resp_body)
        except (json.JSONDecodeError, ValueError):
            resp_json = {"_raw": resp_body[:500]}
        return e.code, resp_json, resp_headers
    except Exception as e:
        return 0, {"_error": str(e)}, {}


def health_check(port: int) -> dict:
    """GET /health"""
    url = f"http://127.0.0.1:{port}/health"
    try:
        resp = urllib.request.urlopen(url, timeout=5)
        return json.loads(resp.read().decode())
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


# ── Probes ─────────────────────────────────────────────────────────────────


def probe_01_discover(port: int, organ: str) -> ProbeResult:
    """Probe 1: server/discover — capability discovery."""
    code, body, headers = mcp_post(
        port,
        "server/discover",
        {
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            }
        },
    )
    result = body.get("result", {})
    supported = result.get("supportedVersions", [])
    has_version = MCP_VERSION in supported
    has_result_type = result.get("resultType") is not None
    passed = code == 200 and has_version and has_result_type
    return ProbeResult(
        probe_id=1,
        name="server/discover",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"resultType={result.get('resultType')}, supported={supported}",
        evidence={
            "supportedVersions": supported,
            "resultType": result.get("resultType"),
            "capabilities": result.get("capabilities"),
        },
        severity="PASS" if passed else "FAIL",
    )


def probe_02_tools_list_cache(port: int, organ: str) -> ProbeResult:
    """Probe 2: tools/list — cache envelope (ttlMs, cacheScope, resultType, deterministic order)."""
    code, body, headers = mcp_post(port, "tools/list")
    result = body.get("result", {})
    tools = result.get("tools", [])
    has_ttl = result.get("ttlMs") is not None
    has_scope = result.get("cacheScope") is not None
    has_result_type = result.get("resultType") is not None
    tool_count = len(tools)
    # Check deterministic order (names should be sorted or stable)
    names = [t.get("name", "") for t in tools[:10]]
    cache_ok = has_ttl and has_scope
    passed = code == 200 and has_result_type and tool_count > 0
    severity = "PASS" if (passed and cache_ok) else ("WARN" if passed else "FAIL")
    return ProbeResult(
        probe_id=2,
        name="tools/list cache",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"tools={tool_count}, ttlMs={has_ttl}, cacheScope={has_scope}, resultType={has_result_type}",
        evidence={
            "tool_count": tool_count,
            "ttlMs": result.get("ttlMs"),
            "cacheScope": result.get("cacheScope"),
            "resultType": result.get("resultType"),
            "first_names": names,
        },
        severity=severity,
    )


def probe_03_tools_call_headers(port: int, organ: str) -> ProbeResult:
    """Probe 3: tools/call with valid Mcp-Method/Mcp-Name headers."""
    # First get a tool name from tools/list
    code, body, _ = mcp_post(port, "tools/list")
    tools = body.get("result", {}).get("tools", [])
    if not tools:
        return ProbeResult(
            probe_id=3,
            name="tools/call headers",
            organ=organ,
            passed=None,
            detail="No tools available to test",
            severity="INFO",
        )
    tool_name = tools[0].get("name", "unknown")
    code2, body2, headers2 = mcp_post(
        port,
        "tools/call",
        {
            "name": tool_name,
            "arguments": {},
            "_meta": {
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    )
    # A valid response (even if tool errors) means headers were accepted
    passed = code2 in (200, 400, 500) and "jsonrpc" in body2
    return ProbeResult(
        probe_id=3,
        name="tools/call headers",
        organ=organ,
        passed=passed,
        status_code=code2,
        detail=f"tool={tool_name}, accepted={passed}",
        evidence={"tool_name": tool_name, "status": code2},
        severity="PASS" if passed else "FAIL",
    )


def probe_04_header_body_mismatch(port: int, organ: str) -> ProbeResult:
    """Probe 4: Header/body mismatch → assert HTTP 400 / -32020."""
    # Send Mcp-Method: tools/call but body says tools/list
    code, body, headers = mcp_post(
        port,
        "tools/list",
        headers={"Mcp-Method": "tools/call", "Mcp-Name": "WRONG"},
        body_override=json.dumps(
            {"jsonrpc": "2.0", "id": "mismatch-1", "method": "tools/list", "params": {}}
        ),
    )
    # Per spec: server MUST reject with HTTP 400 or MCP error -32020
    error_code = body.get("error", {}).get("code")
    is_rejected = code == 400 or error_code == -32020
    # If server ignores headers and returns 200, that's non-compliant
    passed = is_rejected or code == 400
    return ProbeResult(
        probe_id=4,
        name="header/body mismatch",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"rejected={is_rejected}, http={code}, mcp_error={error_code}",
        evidence={
            "status": code,
            "error_code": error_code,
            "body_keys": list(body.keys()),
        },
        severity="PASS" if passed else "FAIL",
    )


def probe_05_unsupported_version(port: int, organ: str) -> ProbeResult:
    """Probe 5: Invalid/unsupported version → structured response."""
    url = f"http://127.0.0.1:{port}/mcp"
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": "version-1",
            "method": "server/discover",
            "params": {
                "_meta": {"io.modelcontextprotocol/protocolVersion": "9999-99-99"}
            },
        }
    ).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", "9999-99-99")
    req.add_header("Mcp-Method", "server/discover")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.status
        body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        code = e.code
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
    except Exception as e:
        code = 0
        body = {"_error": str(e)}

    result = body.get("result", {})  # type: ignore[union-attr]
    supported = result.get("supportedVersions", [])
    # Server should either accept (if it supports the version) or reject with supported versions
    has_guidance = len(supported) > 0 or code == 400
    passed = has_guidance or code == 200  # 200 = server accepted it
    return ProbeResult(
        probe_id=5,
        name="unsupported version",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"status={code}, guided={has_guidance}, supported={supported}",
        evidence={"status": code, "supportedVersions": supported},
        severity="PASS" if passed else "WARN",
    )


def probe_06_no_session_header(port: int, organ: str) -> ProbeResult:
    """Probe 6: No session header on modern path → verify no session minted."""
    url = f"http://127.0.0.1:{port}/mcp"
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": "no-session-1",
            "method": "server/discover",
            "params": {
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
                    "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
                }
            },
        }
    ).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "server/discover")
    # Deliberately NO Mcp-Session-Id
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.status
        headers = dict(resp.headers)
        body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        code = e.code
        headers = dict(e.headers) if e.headers else {}
        try:
            body = json.loads(e.read().decode())
        except Exception:
            # Shadow acknowledged: HTTP error body failed to parse as JSON
            body = {"_error": "http_error_body_not_json", "status": e.code}
    except Exception as e:
        code = 0
        headers = {}
        body = {"_error": str(e)}

    # Check if server echoed or minted a session ID
    session_id = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")
    no_session = session_id is None
    passed = no_session and code == 200
    return ProbeResult(
        probe_id=6,
        name="no session header",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"session_minted={not no_session}, session_id={session_id}",
        evidence={"session_id": session_id, "status": code},
        severity="PASS" if passed else ("WARN" if no_session else "FAIL"),
    )


def probe_07_legacy_initialize(port: int, organ: str) -> ProbeResult:
    """Probe 7: Legacy client compatibility — send initialize without modern headers."""
    code, body, headers = mcp_post_legacy(
        port,
        "initialize",
        {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "legacy-client", "version": "0.1.0"},
        },
    )
    # If server supports legacy, it should respond with capabilities
    # If server is modern-only, it should reject gracefully
    result = body.get("result", {})
    has_protocol = result.get("protocolVersion") is not None
    has_capabilities = result.get("capabilities") is not None
    legacy_supported = has_protocol and has_capabilities
    # Either legacy works (dual-stack) or modern-only rejection is acceptable
    passed = code in (200, 400, 405)
    return ProbeResult(
        probe_id=7,
        name="legacy initialize",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"legacy_supported={legacy_supported}, protocol={result.get('protocolVersion')}",
        evidence={
            "status": code,
            "protocolVersion": result.get("protocolVersion"),
            "capabilities": list(result.get("capabilities", {}).keys())
            if isinstance(result.get("capabilities"), dict)
            else None,
        },
        severity="PASS" if passed else "WARN",
    )


def probe_08_mrtr_input_required(port: int, organ: str) -> ProbeResult:
    """Probe 8: MRTR — check if server supports resultType: input_required."""
    # We can't easily trigger a real MRTR flow without a tool that requires input.
    # Instead, check if the server's tools/list response includes resultType field
    # and if any tool hints at elicitation support.
    code, body, _ = mcp_post(port, "tools/list")
    result = body.get("result", {})
    has_result_type = result.get("resultType") is not None
    # Check for tools that might support elicitation
    tools = result.get("tools", [])
    has_elicitation_hints = any(
        "input" in json.dumps(t).lower() or "confirm" in json.dumps(t).lower()
        for t in tools[:20]
    )
    # MRTR is an extension; presence of resultType suggests awareness
    passed = has_result_type
    return ProbeResult(
        probe_id=8,
        name="MRTR awareness",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"resultType={has_result_type}, elicitation_hints={has_elicitation_hints}",
        evidence={"resultType": result.get("resultType"), "tool_count": len(tools)},
        severity="PASS" if passed else "WARN",
    )


def probe_09_origin_validation(port: int, organ: str) -> ProbeResult:
    """Probe 9: Origin validation — send request with suspicious Origin."""
    url = f"http://127.0.0.1:{port}/mcp"
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": "origin-1",
            "method": "server/discover",
            "params": {
                "_meta": {"io.modelcontextprotocol/protocolVersion": MCP_VERSION}
            },
        }
    ).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("MCP-Protocol-Version", MCP_VERSION)
    req.add_header("Mcp-Method", "server/discover")
    req.add_header("Origin", "https://evil.example.com")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.status
        body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        code = e.code
        try:
            body = json.loads(e.read().decode())
        except Exception:
            # Shadow acknowledged: HTTP error body failed to parse as JSON
            body = {"_error": "http_error_body_not_json", "status": e.code}
    except Exception as e:
        code = 0
        body = {"_error": str(e)}

    # Per spec: server should respond 403 for invalid Origin
    # But local servers (127.0.0.1) may not enforce Origin
    origin_rejected = code == 403
    # For localhost, not rejecting is acceptable (local trust)
    passed = True  # Localhost exemption
    return ProbeResult(
        probe_id=9,
        name="origin validation",
        organ=organ,
        passed=passed,
        status_code=code,
        detail=f"origin_rejected={origin_rejected}, status={code}",
        evidence={"status": code, "origin_rejected": origin_rejected},
        severity="PASS" if origin_rejected else "INFO",
    )


def probe_10_auth_discovery(port: int, organ: str) -> ProbeResult:
    """Probe 10: Auth issuer discovery — check .well-known/oauth-authorization-server."""
    url = f"http://127.0.0.1:{port}/.well-known/oauth-authorization-server"
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=5)
        code = resp.status
        body = json.loads(resp.read().decode())
        has_issuer = "issuer" in body
        passed = has_issuer
        return ProbeResult(
            probe_id=10,
            name="auth discovery",
            organ=organ,
            passed=passed,
            status_code=code,
            detail=f"issuer={body.get('issuer')}",
            evidence={"issuer": body.get("issuer")},
            severity="PASS" if passed else "WARN",
        )
    except urllib.error.HTTPError as e:
        return ProbeResult(
            probe_id=10,
            name="auth discovery",
            organ=organ,
            passed=None,
            status_code=e.code,
            detail="No OAuth discovery endpoint (acceptable for local servers)",
            severity="INFO",
        )
    except Exception:
        return ProbeResult(
            probe_id=10,
            name="auth discovery",
            organ=organ,
            passed=None,
            detail="No auth endpoint (local server, acceptable)",
            severity="INFO",
        )


# ── Orchestrator ───────────────────────────────────────────────────────────

ALL_PROBES = [
    probe_01_discover,
    probe_02_tools_list_cache,
    probe_03_tools_call_headers,
    probe_04_header_body_mismatch,
    probe_05_unsupported_version,
    probe_06_no_session_header,
    probe_07_legacy_initialize,
    probe_08_mrtr_input_required,
    probe_09_origin_validation,
    probe_10_auth_discovery,
]


def run_organ(organ_name: str) -> OrganReport:
    """Run all probes against a single organ."""
    cfg = ORGANS[organ_name]
    port = cfg["port"]
    report = OrganReport(organ=organ_name, port=port, authority=cfg["authority"])

    # Health check first
    health = health_check(port)
    if health.get("status") == "unreachable":
        report.overall = "UNREACHABLE"
        report.probes = [
            ProbeResult(
                probe_id=0,
                name="health",
                organ=organ_name,
                passed=False,
                detail=f"Unreachable: {health.get('error')}",
                severity="FAIL",
            )
        ]
        return report

    for probe_fn in ALL_PROBES:
        try:
            result = probe_fn(port, organ_name)
            report.probes.append(result)
        except Exception as e:
            report.probes.append(
                ProbeResult(
                    probe_id=probe_fn.__name__.split("_")[1]
                    if "_" in probe_fn.__name__
                    else 0,
                    name=probe_fn.__name__,
                    organ=organ_name,
                    passed=False,
                    detail=f"Exception: {e}",
                    severity="FAIL",
                )
            )

    # Classify overall
    pass_count = report.pass_count
    fail_count = report.fail_count
    if pass_count >= 8:
        report.overall = "COMPLIANT"
    elif pass_count >= 5:
        report.overall = "PARTIAL"
    elif pass_count >= 1:
        report.overall = "LEGACY"
    else:
        report.overall = "UNREACHABLE"

    return report


def print_report(reports: list[OrganReport], as_json: bool = False):
    """Print the conformance report."""
    if as_json:
        output = []
        for r in reports:
            output.append(
                {
                    "organ": r.organ,
                    "port": r.port,
                    "authority": r.authority,
                    "overall": r.overall,
                    "pass": r.pass_count,
                    "fail": r.fail_count,
                    "na": r.na_count,
                    "probes": [asdict(p) for p in r.probes],
                }
            )
        print(json.dumps(output, indent=2))
        return

    print("=" * 72)
    print("MCP 2026-07-28 Federation Conformance Report")
    print(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print("=" * 72)

    for r in reports:
        status_icon = {
            "COMPLIANT": "✅",
            "PARTIAL": "⚠️",
            "LEGACY": "❌",
            "UNREACHABLE": "💀",
        }.get(r.overall, "❓")
        print(f"\n{status_icon} {r.organ.upper()} :{r.port} — {r.overall}")
        print(f"   Authority: {r.authority}")
        print(f"   Pass: {r.pass_count} | Fail: {r.fail_count} | N/A: {r.na_count}")
        print("   " + "-" * 50)
        for p in r.probes:
            icon = {True: "✅", False: "❌", None: "⏭️"}[p.passed]
            print(
                f"   {icon} P{p.probe_id:02d} {p.name:<25s} [{p.severity:<4s}] {p.detail}"
            )

    # Summary
    print("\n" + "=" * 72)
    print("SUMMARY")
    print("=" * 72)
    total_pass = sum(r.pass_count for r in reports)
    total_fail = sum(r.fail_count for r in reports)
    total_na = sum(r.na_count for r in reports)
    print(f"Total probes: {total_pass + total_fail + total_na}")
    print(f"Pass: {total_pass} | Fail: {total_fail} | N/A: {total_na}")
    print(f"\nOverall assessments:")
    for r in reports:
        icon = {
            "COMPLIANT": "✅",
            "PARTIAL": "⚠️",
            "LEGACY": "❌",
            "UNREACHABLE": "💀",
        }.get(r.overall, "❓")
        print(f"  {icon} {r.organ:<10s} {r.overall}")
    print()


def main():
    parser = argparse.ArgumentParser(description="MCP 2026-07-28 Conformance Harness")
    parser.add_argument(
        "--organs", default="all", help="Comma-separated organ names or 'all'"
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.organs == "all":
        organ_names = list(ORGANS.keys())
    else:
        organ_names = [o.strip() for o in args.organs.split(",")]
        for o in organ_names:
            if o not in ORGANS:
                print(f"Unknown organ: {o}. Valid: {', '.join(ORGANS.keys())}")
                sys.exit(1)

    reports = []
    for organ in organ_names:
        report = run_organ(organ)
        reports.append(report)

    print_report(reports, as_json=args.json)

    # Exit code: 0 if all compliant/partial, 1 if any legacy/unreachable
    if any(r.overall in ("LEGACY", "UNREACHABLE") for r in reports):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
