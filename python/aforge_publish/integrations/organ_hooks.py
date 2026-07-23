"""Organ integration hooks — federated MCP adapters.

GEOX  :8081, WELL :18083, WEALTH :18082, arifOS :8088
All call the MCP JSON-RPC 2.0 endpoint directly over HTTP.

Each hook exposes two operations:
- `probe()` → organ health + tool surface summary
- `fetch(query)` → domain-specific evidence pull
"""

from __future__ import annotations

import json
import logging
from typing import Any

import urllib.request
import urllib.error

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Generic MCP-over-HTTP client
# ---------------------------------------------------------------------------
class MCPClient:
    """Minimal JSON-RPC 2.0 client for arifOS MCP servers."""

    def __init__(self, name: str, base_url: str, timeout: float = 30.0):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._req_id = 0

    def call(
        self,
        tool: str,
        arguments: dict[str, Any] | None = None,
        session_id: str | None = None,
        session_token: str | None = None,
        actor_id: str | None = None,
    ) -> dict[str, Any]:
        self._req_id += 1
        params: dict[str, Any] = {"name": tool, "arguments": arguments or {}}
        if session_id:
            params["session_id"] = session_id
        if session_token:
            params["session_token"] = session_token
        if actor_id:
            params["actor_id"] = actor_id
        payload = json.dumps(
            {
                "jsonrpc": "2.0",
                "id": self._req_id,
                "method": "tools/call",
                "params": params,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/mcp",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return {
                "_mcp_error": True,
                "status": e.code,
                "body": e.read().decode("utf-8", "replace")[:500],
            }
        except Exception as e:
            return {
                "_mcp_error": True,
                "exception": type(e).__name__,
                "msg": str(e)[:500],
            }
        try:
            return json.loads(body)
        except Exception:
            return {"_mcp_error": True, "raw": body[:500]}

    def health(self) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(f"{self.base_url}/health", timeout=5) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            return {"_error": str(e)[:200]}


# ---------------------------------------------------------------------------
# GEOX Hook — basin intelligence
# ---------------------------------------------------------------------------
class GeoxHook:
    """Earth Intelligence organ — basin profile, evidence, falsification."""

    DEFAULT_PORT = 8081

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or f"http://127.0.0.1:{self.DEFAULT_PORT}"
        self.client = MCPClient("geox", self.base_url)

    def probe(self) -> dict[str, Any]:
        return self.client.health()

    def basin_profile(
        self, basin_name: str, session_id: str, actor_id: str = "arif"
    ) -> dict[str, Any]:
        return self.client.call(
            "geox_basin",
            {"mode": "profile", "basin_name": basin_name, "profile_mode": "overview"},
            session_id=session_id,
            actor_id=actor_id,
        )

    def falsify(
        self,
        claim_text: str,
        claim_type: str = "basin_classification",
        session_id: str | None = None,
        actor_id: str = "arif",
    ) -> dict[str, Any]:
        return self.client.call(
            "geox_falsify",
            {"claim_text": claim_text, "claim_type": claim_type, "mode": "full"},
            session_id=session_id,
            actor_id=actor_id,
        )

    def deep_time(self, age_ma: float) -> dict[str, Any]:
        return self.client.call("geox_deep_time_state", {"age_ma": age_ma})

    def claim_create(
        self, claim_text: str, claim_type: str, evidence_ids: list[str] | None = None
    ) -> dict[str, Any]:
        return self.client.call(
            "geox_claim",
            {
                "mode": "create",
                "claim_text": claim_text,
                "claim_type": claim_type,
                "evidence_ids": evidence_ids or [],
            },
        )

    def gather_basin_evidence(self, basin_name: str, session_id: str) -> dict[str, Any]:
        """Convenience: basin profile + falsify on default classification claim."""
        return {
            "basin_profile": self.basin_profile(basin_name, session_id),
            "falsify_classification": self.falsify(
                f"{basin_name} classification as documented in peer-reviewed literature is consistent with multi-physics evidence",
                session_id=session_id,
            ),
        }


# ---------------------------------------------------------------------------
# WELL Hook — human readiness + petrophysics
# ---------------------------------------------------------------------------
class WellHook:
    """Universal Substrate Vitality Mirror — operator readiness + machine state."""

    DEFAULT_PORT = 18083

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or f"http://127.0.0.1:{self.DEFAULT_PORT}"
        self.client = MCPClient("well", self.base_url)

    def probe(self) -> dict[str, Any]:
        return self.client.health()

    def validate_vitality(
        self, intent: str, decision_class: str = "C3"
    ) -> dict[str, Any]:
        return self.client.call(
            "well_validate_vitality",
            {"mode": "readiness", "intent": intent, "decision_class": decision_class},
        )

    def assess_homeostasis(self, mode: str = "sleep") -> dict[str, Any]:
        return self.client.call("well_assess_homeostasis", {"mode": mode})

    def assess_reliability(self) -> dict[str, Any]:
        return self.client.call("well_assess_reliability", {"mode": "health"})


# ---------------------------------------------------------------------------
# WEALTH Hook — capital intelligence
# ---------------------------------------------------------------------------
class WealthHook:
    """Capital intelligence organ — NPV, IRR, EMV, conservation."""

    DEFAULT_PORT = 18082

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or f"http://127.0.0.1:{self.DEFAULT_PORT}"
        self.client = MCPClient("wealth", self.base_url)

    def probe(self) -> dict[str, Any]:
        return self.client.health()

    def conservation(
        self, assets: list[dict], liabilities: list[dict]
    ) -> dict[str, Any]:
        return self.client.call(
            "wealth_capital_health",
            {
                "mode": "conservation",
                "assets": assets,
                "liabilities": liabilities,
            },
        )

    def npv(self, cash_flows: list[float], discount_rate: float) -> dict[str, Any]:
        return self.client.call(
            "wealth_capital_primitive",
            {
                "mode": "npv",
                "cash_flows": cash_flows,
                "discount_rate": discount_rate,
            },
        )

    def irr(self, cash_flows: list[float]) -> dict[str, Any]:
        return self.client.call(
            "wealth_capital_primitive",
            {
                "mode": "irr",
                "cash_flows": cash_flows,
            },
        )

    def emv(self, outcomes: list[float], probabilities: list[float]) -> dict[str, Any]:
        return self.client.call(
            "wealth_capital_primitive",
            {
                "mode": "emv",
                "outcomes": outcomes,
                "probabilities": probabilities,
            },
        )


# ---------------------------------------------------------------------------
# arifOS Hook — kernel + judge + seal
# ---------------------------------------------------------------------------
class ArifOSHook:
    """Constitutional kernel — session bind, judge, seal, memory."""

    DEFAULT_PORT = 8088

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or f"http://127.0.0.1:{self.DEFAULT_PORT}"
        self.client = MCPClient("arifos", self.base_url)

    def probe(self) -> dict[str, Any]:
        return self.client.health()

    def session_init(
        self,
        actor_id: str = "arif",
        intent: str = "tier3-compile",
        requested_authority: str = "OBSERVE_ONLY",
    ) -> dict[str, Any]:
        return self.client.call(
            "arif_init",
            {
                "mode": "init",
                "actor_id": actor_id,
                "intent": intent,
                "requested_authority": requested_authority,
                "ack_irreversible": False,
            },
        )
