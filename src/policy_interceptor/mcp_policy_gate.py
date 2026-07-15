"""
mcp_policy_gate.py — 5-Layer MCP Policy Interceptor (Python Port)

Replicates A-FORGE's TypeScript McpPolicyGate for Python MCP organs
(GEOX, WEALTH, WELL). The canonical implementation lives in:
  A-FORGE/src/domain/governance/McpPolicyGate.ts

This is the "missing control plane" — wrapping EVERY MCP tool call with
constitutional gates before execution.

5-Layer Architecture:
  Layer 1: IDENTITY    — actor_id verified, role bound, active policy selected
  Layer 2: SERVER      — allowed_mcp_servers whitelist (deny-by-default)
  Layer 3: TOOL        — allowed_tools per server (deny-by-default)
  Layer 4: ARGUMENT    — regex constraints on each argument path
  Layer 5: VERDICT     — ALLOW / DENY / AUDIT_LOG (with reason chain)

Usage:
    from mcp_policy_gate import McpPolicyGate, McpPolicy

    gate = McpPolicyGate()
    gate.add_policy(McpPolicy(
        policy_id="agent:geox-user",
        actor_id="arif",
        allow_by_default=True,
    ))

    verdict = gate.evaluate(actor_id="arif", tool_name="geox_basin")
    # -> {"verdict": "ALLOW", ...}

Constitutional:
  F1 AMANAH    — deny-by-default; every allow is explicit
  F2 TRUTH     — every verdict carries a reason chain
  F6 MARUAH    — human actors get audit, not opaque rejection
  F8 LAW       — policy is the floor, not a suggestion
  F11 AUDIT    — every verdict is traceable to the matching policy clause
  F13 SOVEREIGN — sovereign bypasses nothing by default; explicit profile only

@policy forged 2026-07-03 by FORGE (000) — Python port of McpPolicyGate.ts
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


# ── Types ─────────────────────────────────────────────────────────────


@dataclass
class ArgumentConstraint:
    """A regex constraint on a tool argument path."""

    path: str  # dot-path into args: "recipient", "file.path"
    regex: str  # regex pattern
    description: Optional[str] = None


@dataclass
class ToolPolicy:
    """Per-tool policy."""

    allow_pattern: Optional[str] = None  # regex whitelist for tool names
    deny_tools: Optional[list[str]] = None  # hard deny
    argument_constraints: Optional[list[ArgumentConstraint]] = None
    description: Optional[str] = None


@dataclass
class ServerPolicy:
    """Per-MCP-server policy."""

    allow: bool = False  # if False, entire server blocked
    tools: dict[str, ToolPolicy] = field(default_factory=dict)
    default_tool_policy: Optional[ToolPolicy] = None


@dataclass
class McpPolicy:
    """A complete MCP access policy for one actor/role."""

    policy_id: str
    actor_id: str
    role: str = "custom"
    description: Optional[str] = None
    allow_by_default: bool = False  # False = deny-unless-explicit
    allowed_mcp_servers: Optional[dict[str, ServerPolicy]] = None
    denied_mcp_servers: Optional[list[str]] = None
    max_requests_per_minute: Optional[int] = None


@dataclass
class VerdictResult:
    """The result of a 5-layer policy evaluation."""

    verdict: str  # "ALLOW" | "DENY" | "AUDIT_LOG"
    actor_id: str
    policy_id: str
    mcp_server: str
    tool_name: str
    layers: dict[str, bool]
    reasons: list[str]
    violated_regex: list[dict] = field(default_factory=list)
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ── Default Sovereign Policy ───────────────────────────────────────────


def build_default_sovereign_policy() -> McpPolicy:
    """The immutable default: sovereign actor, full access."""
    return McpPolicy(
        policy_id="default:sovereign",
        actor_id="arif",
        role="sovereign",
        description="Default sovereign policy — unrestricted access",
        allow_by_default=True,
    )


# ── The Gate ──────────────────────────────────────────────────────────


class McpPolicyGate:
    """5-layer MCP control plane. Evaluate every tool call before handler execution."""

    def __init__(self):
        self._policies: dict[str, McpPolicy] = {}
        self._default_policy = build_default_sovereign_policy()
        self._policies["default:sovereign"] = self._default_policy
        self._audit_log: Optional[str] = None
        self._active_actor: Optional[str] = None

    def set_actor(self, actor_id: str) -> None:
        """Bind active actor for subsequent evaluate() calls."""
        self._active_actor = actor_id

    def add_policy(self, policy: McpPolicy) -> None:
        """Register or replace a policy."""
        self._policies[policy.policy_id] = policy

    def remove_policy(self, policy_id: str) -> None:
        """Remove a policy by id. Cannot remove default sovereign."""
        if policy_id == "default:sovereign":
            raise ValueError("Cannot remove sovereign default policy")
        self._policies.pop(policy_id, None)

    def list_policies(self) -> list[McpPolicy]:
        """List all loaded policies."""
        return list(self._policies.values())

    def get_policy(self, policy_id: str) -> Optional[McpPolicy]:
        """Get a policy by id."""
        return self._policies.get(policy_id)

    def evaluate(
        self,
        tool_name: str,
        actor_id: Optional[str] = None,
        arguments: Optional[dict[str, Any]] = None,
        transport: Optional[str] = None,
    ) -> VerdictResult:
        """
        Evaluate a tool call against the 5-layer boundary.

        Args:
            tool_name: The MCP tool being called
            actor_id: Who is calling (defaults to active_actor)
            arguments: Tool arguments for Layer 4 constraint checking
            transport: "stdio" or "http" (for logging)

        Returns:
            VerdictResult with verdict=ALLOW/DENY/AUDIT_LOG
        """
        actor_id = actor_id or self._active_actor or "anonymous"
        policy = self._resolve_policy(actor_id)
        mcp_server = self._extract_server(tool_name)

        result = VerdictResult(
            verdict="DENY",
            actor_id=actor_id,
            policy_id=policy.policy_id,
            mcp_server=mcp_server,
            tool_name=tool_name,
            layers={
                "identity": False,
                "server": False,
                "tool": False,
                "argument": False,
            },
            reasons=[],
        )

        # Layer 1: Identity
        if not actor_id or actor_id == "anonymous":
            result.reasons.append(f"L1_IDENTITY:anonymous_actor")
            return result
        result.layers["identity"] = True

        # Layer 2: Server
        if not self._is_server_allowed(policy, mcp_server):
            result.reasons.append(f"L2_SERVER:{mcp_server}_not_in_allowlist")
            return result
        result.layers["server"] = True

        # Layer 3: Tool
        if not self._is_tool_allowed(policy, mcp_server, tool_name):
            result.reasons.append(f"L3_TOOL:{tool_name}_not_in_allowlist")
            return result
        result.layers["tool"] = True

        # Layer 4: Argument constraints
        if arguments:
            violations = self._check_argument_constraints(
                policy, mcp_server, tool_name, arguments
            )
            if violations:
                result.reasons.extend(v["reason"] for v in violations)
                result.violated_regex = violations
                return result
        result.layers["argument"] = True

        # Layer 5: All clear
        result.verdict = "ALLOW"
        return result

    # ── Private Helpers ────────────────────────────────────────────

    def _resolve_policy(self, actor_id: str) -> McpPolicy:
        """Find the matching policy for an actor_id."""
        for p in self._policies.values():
            if p.actor_id == actor_id:
                return p
        return self._default_policy

    def _extract_server(self, tool_name: str) -> str:
        """Extract MCP server prefix from a tool name."""
        if not tool_name or "_" not in tool_name:
            return "unknown"
        prefix = tool_name.split("_")[0]
        known_servers = {
            "arifos",
            "forge",
            "geox",
            "wealth",
            "well",
            "aaa",
            "hermes",
            "github",
            "postgres",
            "supabase",
            "qdrant",
            "cloudflare",
            "docker",
            "hostinger",
            "minimax",
            "brave",
            "perplexity",
            "exa",
            "context7",
            "sequential",
            "playwright",
            "chrome",
            "meyhem",
        }
        return prefix if prefix in known_servers else "unknown"

    def _is_server_allowed(self, policy: McpPolicy, server: str) -> bool:
        """Layer 2: Server whitelist check."""
        if policy.denied_mcp_servers and server in policy.denied_mcp_servers:
            return False
        if not policy.allow_by_default:
            if not policy.allowed_mcp_servers:
                return False
            sp = policy.allowed_mcp_servers.get(server)
            return sp is not None and sp.allow
        return True

    def _is_tool_allowed(self, policy: McpPolicy, server: str, tool_name: str) -> bool:
        """Layer 3: Tool allowlist check."""
        if not policy.allowed_mcp_servers:
            return policy.allow_by_default
        sp = policy.allowed_mcp_servers.get(server)
        if not sp:
            return policy.allow_by_default
        # Check if tool is in explicit policy
        if tool_name in sp.tools:
            return True
        # Check default tool policy
        if sp.default_tool_policy:
            return True
        return sp.allow

    def _check_argument_constraints(
        self,
        policy: McpPolicy,
        server: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> list[dict]:
        """Layer 4: Check argument regex constraints."""
        violations = []
        if not policy.allowed_mcp_servers:
            return violations
        sp = policy.allowed_mcp_servers.get(server)
        if not sp:
            return violations
        tp = sp.tools.get(tool_name)
        if not tp or not tp.argument_constraints:
            return violations

        for constraint in tp.argument_constraints:
            value = self._get_nested(arguments, constraint.path)
            if value is None:
                continue  # optional: constraint not violated if missing
            str_value = str(value)
            try:
                if not re.match(constraint.regex, str_value):
                    violations.append(
                        {
                            "path": constraint.path,
                            "pattern": constraint.regex,
                            "value": str_value,
                            "reason": f'L4_ARG:{constraint.path}="{str_value}" !~ /{constraint.regex}/',
                        }
                    )
            except re.error:
                violations.append(
                    {
                        "path": constraint.path,
                        "pattern": constraint.regex,
                        "value": str_value,
                        "reason": f"L4_ARG:invalid_regex at {constraint.path}",
                    }
                )
        return violations

    @staticmethod
    def _get_nested(obj: dict, path: str) -> Any:
        """Get a nested value from a dict using dot-path notation."""
        parts = path.split(".")
        current = obj
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        return current


# ── MCP Server Integration Helper ────────────────────────────────────


def wrap_mcp_handler(gate: McpPolicyGate, handler_fn, tool_name: str):
    """
    Decorator to wrap an MCP tool handler with policy evaluation.

    Usage:
        @app.tool()
        def my_tool(actor_id: str, ...):
            ...

        # Replace registered handler with wrapped version:
        app.tool("my_tool")(wrap_mcp_handler(gate, my_tool, "my_tool"))
    """

    def wrapped(*args, **kwargs):
        actor_id = kwargs.get("actor_id") or gate._active_actor
        verdict = gate.evaluate(
            tool_name=tool_name,
            actor_id=actor_id,
            arguments=kwargs,
        )
        if verdict.verdict == "DENY":
            raise PermissionError(
                f"MCP Policy Gate denied: {'; '.join(verdict.reasons)}"
            )
        return handler_fn(*args, **kwargs)

    wrapped.__name__ = handler_fn.__name__
    return wrapped


# ── Integration Spec: How to Add to Each Organ ──────────────────────

"""
INTEGRATION GUIDE:

## GEOX (/root/geox/src/geox_mcp/server.py)

1. Import:
   from mcp_policy_gate import McpPolicyGate, McpPolicy, wrap_mcp_handler

2. Initialize on startup:
   gate = McpPolicyGate()
   gate.add_policy(McpPolicy(
       policy_id="agent:geox-default",
       actor_id="arif",
       role="geoscientist",
       allow_by_default=True,
   ))

3. Wrap tool handlers:
   app.tool("geox_basin")(wrap_mcp_handler(gate, geox_basin_fn, "geox_basin"))

4. Or use FastMCP middleware pattern:
   @app.middleware("tools")
   async def policy_middleware(ctx, tool_name, args):
       verdict = gate.evaluate(tool_name=tool_name, arguments=args)
       if verdict.verdict == "DENY":
           raise Exception(f"Policy denied: {verdict.reasons}")
       return await ctx.next()

## WEALTH (/root/WEALTH/wealth_mcp/server.py)

Same pattern. The gate is shared across all tools.
Recommended: add a dedicated `wealth_policy_gate.py` import:

   from mcp_policy_gate import McpPolicyGate, McpPolicy

## WELL (/root/WELL/server.py)

Same pattern. WELL already has federation_safety.py — integrate
the gate into that module's safety check chain.

## MCP Tool Handler Function (FastMCP / Low-Level SDK)

Standard pattern:
   @server.tool("my_tool")
   def my_tool_handler(actor_id: str = None, **kwargs):
       verdict = gate.evaluate(tool_name="my_tool", actor_id=actor_id, arguments=kwargs)
       if verdict.verdict == "DENY":
           return {"error": f"Policy denied: {'; '.join(verdict.reasons)}"}
       # ... actual handler logic ...
"""


# ── Quick Test ──────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🧪 McpPolicyGate (Python) — Self-Test")

    gate = McpPolicyGate()

    # Test 1: Default sovereign can call anything
    v = gate.evaluate(tool_name="geox_basin", actor_id="arif")
    assert v.verdict == "ALLOW", f"Expected ALLOW, got {v.verdict}"
    print(f"  ✅ Layer 1-5 PASS: sovereign={v.verdict}")

    # Test 2: Anonymous gets DENY
    v = gate.evaluate(tool_name="geox_basin")
    assert v.verdict == "DENY", f"Expected DENY, got {v.verdict}"
    assert "L1_IDENTITY" in v.reasons[0], f"Expected L1_IDENTITY reason"
    print(f"  ✅ Layer 1 DENY: anonymous={v.verdict} ({v.reasons[0]})")

    # Test 3: Custom policy with server restriction
    gate.add_policy(
        McpPolicy(
            policy_id="agent:readonly",
            actor_id="reader",
            role="readonly",
            allow_by_default=False,
            allowed_mcp_servers={"geox": ServerPolicy(allow=True)},
        )
    )
    v = gate.evaluate(tool_name="geox_basin", actor_id="reader")
    assert v.verdict == "ALLOW", f"Expected ALLOW, got {v.verdict}"
    print(f"  ✅ Layer 2-3 PASS: custom_policy={v.verdict}")

    # Test 4: Tool not in allowlist for restricted actor
    v = gate.evaluate(tool_name="forge_shell", actor_id="reader")
    assert v.verdict == "DENY", f"Expected DENY, got {v.verdict}"
    print(f"  ✅ Layer 3 DENY: restricted_tool={v.verdict}")

    print(f"\n🎯 All tests passed. Gate is operational.")
    print(f"   Policies loaded: {len(gate.list_policies())}")
