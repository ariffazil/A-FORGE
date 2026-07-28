"""
FORGE-BENCH MCP Client — HTTP JSON-RPC adapter for federation organs.

Three client modes:
  MockClient  — deterministic responses for offline testing
  HttpClient  — real MCP JSON-RPC calls with transport session lifecycle
  FlameClient — FLAME API (OpenAI-compatible, no MCP — :18901)

Architecture:
  - HttpClient manages MCP transport sessions (initialize → mcp-session-id)
  - session_token (SCT from arif_init) is constructor arg, passed to all tools/call
  - CI pipeline acquires SCT; forge-bench just passes it through
  - Unavailable tools return ERROR, never PASS (no-pretending rule)

Session layers:
  MCP Transport:  initialize → get mcp-session-id header → notifications/initialized
  Constitutional: arif_init → SCT → passed as session_token in tool call params
"""

import json
import time
import re
import urllib.request
import urllib.error
from typing import Any, Optional, Dict


# ─── HttpClient: MCP JSON-RPC with transport session lifecycle ───────────────


class HttpClient:
    """Real MCP JSON-RPC client with transport session management.

    Manages MCP transport sessions (initialize → mcp-session-id → notifications/initialized).
    Passes session_token (SCT) through to every tools/call if provided.

    Usage:
        client = HttpClient(session_token="sct_v1.eyJ...")
        client.call_tool("geox", "geox_petrophysics", {...}, base_url="http://localhost:8081")
    """

    def __init__(self, session_token: Optional[str] = None, timeout: int = 30):
        self.session_token = session_token
        self.timeout = timeout
        self._id = 0
        # Cache: base_url → {"mcp_session_id": str, "initialized": bool}
        self._mcp_sessions: Dict[str, Dict] = {}

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def _http_request(
        self,
        url: str,
        body: Optional[dict] = None,
        method: str = "POST",
        headers: Optional[Dict[str, str]] = None,
        capture_headers: bool = False,
    ) -> dict:
        """Make an HTTP request, returning JSON response dict.

        If capture_headers=True, response dict includes "_headers" key with
        lowercase response header name → value mapping.
        """
        default_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if headers:
            default_headers.update(headers)

        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(
            url, data=data, headers=default_headers, method=method
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if capture_headers:
                    result["_headers"] = {k.lower(): v for k, v in resp.getheaders()}
                return result
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:
                return json.loads(body)
            except json.JSONDecodeError:
                return {"error": {"code": e.code, "message": body[:500]}}
        except urllib.error.URLError as e:
            return {"error": {"code": -1, "message": f"Connection failed: {e.reason}"}}
        except Exception as e:
            return {"error": {"code": -1, "message": str(e)}}

    def _ensure_mcp_session(
        self, base_url: str, mcp_path: str = "/mcp"
    ) -> Optional[str]:
        """Lazy-init MCP transport session. Returns mcp-session-id or None if unavailable.

        Some organs (arifOS) don't require MCP transport sessions.
        For those, this returns None and tools/call works without the header.
        """
        cache_key = f"{base_url}{mcp_path}"
        if cache_key in self._mcp_sessions:
            cached = self._mcp_sessions[cache_key]
            if cached.get("unavailable"):
                return None
            return cached.get("mcp_session_id")

        url = f"{base_url.rstrip('/')}{mcp_path}"

        # Step 1: initialize → get mcp-session-id from response headers
        init_resp = self._http_request(
            url,
            body={
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "forge-bench", "version": "1.0.0"},
                },
            },
            capture_headers=True,
        )

        if "error" in init_resp:
            error_msg = init_resp["error"].get("message", "")
            if (
                "not acceptable" in error_msg.lower()
                or "text/event-stream" in error_msg.lower()
            ):
                # A-FORGE uses Streamable HTTP: retry with text/event-stream Accept
                init_resp = self._http_request(
                    url,
                    body={
                        "jsonrpc": "2.0",
                        "id": self._next_id(),
                        "method": "initialize",
                        "params": {
                            "protocolVersion": "2025-06-18",
                            "capabilities": {},
                            "clientInfo": {"name": "forge-bench", "version": "1.0.0"},
                        },
                    },
                    headers={"Accept": "application/json, text/event-stream"},
                    capture_headers=True,
                )

        mcp_session_id = init_resp.get("_headers", {}).get("mcp-session-id")
        if not mcp_session_id:
            # Organ doesn't use MCP transport sessions (e.g., arifOS)
            self._mcp_sessions[cache_key] = {
                "mcp_session_id": None,
                "unavailable": True,
            }
            return None

        # Step 2: send notifications/initialized
        self._http_request(
            url,
            body={
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            },
            headers={"Mcp-Session-Id": mcp_session_id},
        )

        self._mcp_sessions[cache_key] = {
            "mcp_session_id": mcp_session_id,
            "initialized": True,
        }
        return mcp_session_id

    def call_tool(
        self,
        organ_name: str,
        tool_name: str,
        arguments: dict,
        base_url: Optional[str] = None,
        mcp_path: str = "/mcp",
    ) -> dict:
        """Call an MCP tool on a federation organ.

        Args:
            organ_name: Name of the organ (geox, wealth, arifos, aforge, flame)
            tool_name: MCP tool name (e.g., geox_petrophysics)
            arguments: Tool arguments dict
            base_url: Organ's base URL (e.g., http://localhost:8081)
            mcp_path: MCP endpoint path (default /mcp)

        Returns:
            Response dict with result or error. Always includes _elapsed and _mock=False.
        """
        if not base_url:
            return {
                "error": {"code": -1, "message": "base_url required for HttpClient"},
                "_elapsed": 0,
                "_mock": False,
            }

        # Inject session_token into arguments if available
        if self.session_token:
            arguments = {
                **arguments,
                "session_token": self.session_token,
                "session_id": arguments.get("session_id") or self.session_token,
                "actor_id": arguments.get("actor_id", "forge-bench"),
            }

        start = time.time()
        url = f"{base_url.rstrip('/')}{mcp_path}"

        # Get MCP transport session ID (may be None for sessionless organs)
        mcp_sid = self._ensure_mcp_session(base_url, mcp_path)

        headers = {}
        if mcp_sid:
            headers["Mcp-Session-Id"] = mcp_sid

        result = self._http_request(
            url,
            body={
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments,
                },
            },
            headers=headers if headers else None,
        )

        result["_elapsed"] = time.time() - start
        result["_mock"] = False
        return result

    def health(self, base_url: str) -> bool:
        """Check organ health via /health endpoint."""
        try:
            url = f"{base_url.rstrip('/')}/health"
            resp = self._http_request(url, method="GET")
            # Different organs use different health response shapes
            return bool(
                resp.get("status") in ("healthy", "live", "ok")
                or resp.get("ok") is True
                or resp.get("verdict")  # arifOS uses thermodynamic.verdict
                or "status"
                not in resp  # FLAME returns {"name":"FLAME API","status":"live"}
            )
        except Exception:
            return False


# ─── FlameClient: FLAME API (:18901) — not MCP ───────────────────────────────


class FlameClient:
    """Client for FLAME API — OpenAI-compatible chat, not MCP JSON-RPC.

    FLAME endpoints:
      /health  — health check
      /probe   — quick LLM probe
      /verify  — claim verification
      /classify — text classification
      /summarize — text summarization
    """

    def __init__(self, base_url: str = "http://localhost:18901", timeout: int = 60):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _http_request(
        self, path: str, body: Optional[dict] = None, method: str = "POST"
    ) -> dict:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            return {"error": str(e)}

    def call_tool(
        self,
        _organ_name: str,
        tool_name: str,
        arguments: dict,
        base_url: Optional[str] = None,
        **_kwargs,
    ) -> dict:
        """Call a FLAME tool. Maps tool names to FLAME endpoints."""
        start = time.time()

        endpoint_map = {
            "hermes_fact_check": ("/verify", {"claim": arguments.get("claim", "")}),
            "hermes_epistemic_check": (
                "/probe",
                {"prompt": arguments.get("claim", "")},
            ),
            "hermes_health": ("/health", {}),
            "hermes_plan_review": ("/probe", {"prompt": arguments.get("plan", "")}),
            "hermes_memory_steward": (
                "/classify",
                {"text": arguments.get("content", "")},
            ),
            "hermes_cross_verify": ("/verify", {"claim": arguments.get("claim", "")}),
            "hermes_system_status": ("/health", {}),
        }

        if tool_name not in endpoint_map:
            return {
                "error": {
                    "code": -32601,
                    "message": f"FLAME tool not mapped: {tool_name}",
                },
                "_elapsed": time.time() - start,
                "_mock": False,
            }

        endpoint, body = endpoint_map[tool_name]

        if endpoint == "/health":
            result = self._http_request(endpoint, method="GET")
        else:
            result = self._http_request(endpoint, body=body)

        # Wrap in MCP-compatible response shape for verifier compatibility
        response = {
            "result": {"content": [{"type": "text", "text": json.dumps(result)}]},
            "_elapsed": time.time() - start,
            "_mock": False,
        }
        return response

    def health(self, _base_url: str = None) -> bool:
        try:
            resp = self._http_request("/health", method="GET")
            return resp.get("status") == "live"
        except Exception:
            return False


# ─── MockClient: deterministic offline testing ───────────────────────────────


class MockClient:
    """Deterministic mock for offline testing."""

    def __init__(self):
        self.MOCK_RESPONSES = {
            "geox_petrophysics": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "vsh_method": a.get("vsh_method", "linear"),
                                    "vsh_range": [0.12, 0.87],
                                    "porosity_range": [0.08, 0.22],
                                    "verdict": "PHYSICS_BOUNDS_OK",
                                }
                            ),
                        }
                    ]
                }
            },
            "geox_falsify": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "result": "FALSIFIED",
                                    "verdict": "KILL",
                                    "kill_matrix": [
                                        "K001_PHYSICS_VIOLATION",
                                        "K002_COMPACTION_LIMIT",
                                    ],
                                    "reason": "45% porosity at 5000m violates compaction physics.",
                                }
                            ),
                        }
                    ]
                }
            },
            "capital_primitive": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {"emv": 25.0, "decision": "ACCEPT (drill)", "pos": 0.25}
                                if a.get("mode") == "emv"
                                else {
                                    "npv": 38.8771,
                                    "decision": "ACCEPT",
                                    "discount_rate": 0.1,
                                }
                            ),
                        }
                    ]
                }
            },
            "arif_judge": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "status": "pending",
                                    "tool": "arif_judge",
                                    "verdict": "pending",
                                    "actor": {
                                        "actor_id": "forge-bench",
                                        "actor_verified": False,
                                        "authority_level": "OBSERVER",
                                    },
                                    "session_id": "unknown",
                                    "call_hash": "sha256:mock-arif-judge",
                                    "trace_id": "trc-mock",
                                    "signature": None,
                                }
                            ),
                        }
                    ]
                }
            },
            "arif_route": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "status": "pending",
                                    "tool": "arif_route",
                                    "verdict": "pending",
                                    "call_hash": "sha256:mock-arif-route",
                                    "trace_id": "trc-mock",
                                }
                            ),
                        }
                    ]
                }
            },
            "geox_basin": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "basin_name": "Malay Basin",
                                    "basin_type": "rift",
                                    "age_range": "Oligocene-Recent",
                                    "max_thickness_m": 12000,
                                }
                            ),
                        }
                    ]
                }
            },
            "capital_wisdom": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "dignity_score": 0.35,
                                    "sovereignty_impact": "MODERATE",
                                    "community_impact": "SEVERE — 200 jobs displaced",
                                    "recommendation": "HOLD — dignity and community costs outweigh efficiency gains.",
                                    "verdict": "CAUTION",
                                }
                            ),
                        }
                    ]
                }
            },
            "forge_fs_read": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "path": "/etc/hostname",
                                    "content": "af-forge\\n",
                                    "exists": True,
                                    "mode": "read_only",
                                }
                            ),
                        }
                    ]
                }
            },
            "forge_shell": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "stdout": "Linux af-forge 6.8.0-45-generic x86_64 GNU/Linux",
                                    "exit_code": 0,
                                    "mode": "dry_run",
                                }
                            ),
                        }
                    ]
                }
            },
            "forge_git_status": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "branch": "main",
                                    "last_commit": "feat: forge-bench initial",
                                    "clean": False,
                                    "mode": "read_only",
                                }
                            ),
                        }
                    ]
                }
            },
            # --- Auth-gated mocks (idealized — cannot verify against live without SCT) ---
            # GEOX/WEALTH/A-FORGE/WELL require constitutional session tokens.
            # These mocks produce correct MCP response shapes with reasonable content.
            # Content fidelity will be verified once SCT auth is resolved.
            # FLAME mock responses (match real FLAME API response shapes)
            "hermes_fact_check": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "valid": True,
                                    "authority": "ADVISORY",
                                }
                            ),
                        }
                    ]
                }
            },
            "hermes_health": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "name": "FLAME API",
                                    "status": "live",
                                    "chain": "RM0-TOOLS-FREELOOP",
                                    "mode": "RM0-TOOLS-FREELOOP",
                                    "authority": "ADVISORY",
                                }
                            ),
                        }
                    ]
                }
            },
            "hermes_system_status": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "name": "FLAME API",
                                    "status": "live",
                                    "chain": "RM0-TOOLS-FREELOOP",
                                    "mode": "RM0-TOOLS-FREELOOP",
                                    "authority": "ADVISORY",
                                }
                            ),
                        }
                    ]
                }
            },
            # WELL mock responses (idealized — requires SCT for live verification)
            "well_registry_status": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "status": "degraded",
                                    "tool_count": 8,
                                    "identity": "WELL",
                                    "authority": "REFLECT_ONLY",
                                    "well_score": 67.4,
                                }
                            ),
                        }
                    ]
                }
            },
            "well_classify_substrate": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "substrate": "machine",
                                    "classification": "AI_AGENT_VPS",
                                    "boundary": "NON_BIOLOGICAL",
                                    "authority": "REFLECT_ONLY",
                                }
                            ),
                        }
                    ]
                }
            },
            "well_guard_dignity": lambda a: {
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "mode": "consent",
                                    "dignity_preserved": True,
                                    "boundary_intact": True,
                                    "verdict": "GUARD_ACTIVE",
                                }
                            ),
                        }
                    ]
                }
            },
        }

    def call_tool(
        self,
        _server_name: str,
        tool_name: str,
        arguments: dict,
        base_url: Optional[str] = None,
        mcp_path: Optional[str] = None,
    ) -> dict:
        if tool_name not in self.MOCK_RESPONSES:
            return {
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {tool_name} (mock)",
                }
            }
        response = self.MOCK_RESPONSES[tool_name](arguments)
        response["_elapsed"] = 0.001
        response["_mock"] = True
        return response

    def health(self, _base_url: str = None) -> bool:
        return True


# ─── Shared utility ──────────────────────────────────────────────────────────


def extract_text_content(response: dict) -> str:
    """Extract text content from an MCP tools/call response.

    Handles both MCP response shape ({result: {content: [{type: "text", text: ...}]}})
    and FLAME response shape.
    """
    if "error" in response and "result" not in response:
        return f"ERROR: {response['error'].get('message', str(response['error']))}"

    result = response.get("result", {})
    content = result.get("content", [])

    texts = []
    for item in content:
        if isinstance(item, dict):
            if item.get("type") == "text":
                texts.append(item.get("text", ""))
            elif item.get("type") == "resource":
                texts.append(json.dumps(item.get("resource", {})))

    if texts:
        return "\n".join(texts)

    # Fallback: dump the entire result
    return json.dumps(result)


def create_client(
    mode: str = "mock",
    session_token: Optional[str] = None,
) -> Any:
    """Factory: create the right client for the mode.

    Args:
        mode: "mock", "live", or "flame"
        session_token: SCT from arif_init (for live mode with auth-gated organs)

    Returns:
        MockClient, HttpClient, or FlameClient
    """
    if mode == "live":
        return HttpClient(session_token=session_token)
    elif mode == "flame":
        return FlameClient()
    else:
        return MockClient()
