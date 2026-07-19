"""
APA Composio Mapper — Canonical Capability → Provider Tool Resolver.

Translates stable arifOS capabilities into unstable Composio provider tool calls.
The constitution governs the capability, not the vendor tool name.

Example:
    Agent requests: "communication.email.send"
    APA resolves:   provider=composio, toolkit=gmail, tool=GMAIL_SEND_EMAIL

Architecture:
    ART → KERNEL → APA (this mapper) → ACT → COMPOSIO → VAULT999
"""

import hashlib
import hmac
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import yaml


# ── Types ───────────────────────────────────────


class Band(Enum):
    OBSERVE = "observe"
    MUTATE = "mutate"
    EXTERNAL = "external_consequence"


@dataclass
class ResolvedCapability:
    """The result of resolving a canonical capability to a provider tool."""

    canonical_capability: str
    provider: str
    toolkit: str
    tool: str
    account_alias: str
    band: Band

    # From kernel lease
    actor_id: Optional[str] = None
    session_id: Optional[str] = None
    lease_id: Optional[str] = None
    idempotency_key: Optional[str] = None

    # Security
    payload_hash: Optional[str] = None
    blast_radius: str = "LOW"

    def requires_lease(self) -> bool:
        return self.band in (Band.MUTATE, Band.EXTERNAL)

    def requires_ack(self) -> bool:
        return self.band == Band.EXTERNAL

    def to_dict(self) -> dict:
        return {
            "canonical_capability": self.canonical_capability,
            "provider": self.provider,
            "toolkit": self.toolkit,
            "tool": self.tool,
            "account_alias": self.account_alias,
            "band": self.band.value,
            "actor_id": self.actor_id,
            "session_id": self.session_id,
            "lease_id": self.lease_id,
            "requires_lease": self.requires_lease(),
            "requires_ack": self.requires_ack(),
        }


# ── Identity Binding ────────────────────────────


class IdentityMapper:
    """
    Maps arifOS sovereign identity to stable Composio user_id.
    Uses HMAC-SHA256 to prevent:
      - Raw sovereign ID leaking to vendor
      - Cross-organ identity mixing
      - Display-name-based routing drift
    """

    def __init__(self, secret: Optional[str] = None):
        self.secret = secret or os.environ.get("APA_IDENTITY_SECRET", "")
        if not self.secret:
            raise ValueError("APA_IDENTITY_SECRET must be set")

    def composio_user_id(
        self,
        sovereign_id: str,
        environment: str = "production",
        tenant: str = "arif-federation",
    ) -> str:
        """Produce a deterministic, non-reversible Composio user_id."""
        key = self.secret.encode("utf-8")
        msg = f"{sovereign_id}:{environment}:{tenant}".encode("utf-8")
        digest = hmac.new(key, msg, hashlib.sha256).hexdigest()[:16]
        return f"arf_{environment}_{digest}"


# ── Capability Mapper ───────────────────────────


class ComposioMapper:
    """
    Resolves canonical arifOS capabilities to Composio provider tools.

    Loads mapping from composio.yaml manifest.
    """

    def __init__(self, manifest_path: Optional[str] = None):
        self.manifest_path = manifest_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "manifests",
            "composio.yaml",
        )
        self._capabilities: dict = {}
        self._allowlist: dict = {}
        self._load()

    def _load(self):
        """Load capability mappings and allowlist from manifest."""
        with open(self.manifest_path) as f:
            manifest = yaml.safe_load(f)

        self._capabilities = manifest.get("capabilities", {})
        self._session_config = manifest.get("session", {})
        self._execution_config = manifest.get("execution", {})
        self._identity_config = manifest.get("identity", {})
        self._forbidden = manifest.get("forbidden", [])

        # Load allowlist
        allowlist_path = os.path.join(
            os.path.dirname(self.manifest_path),
            "..",
            "policy",
            "composio_allowlist.yaml",
        )
        if os.path.exists(allowlist_path):
            with open(allowlist_path) as f:
                self._allowlist = yaml.safe_load(f)

    def resolve(self, canonical_capability: str) -> ResolvedCapability:
        """
        Resolve a canonical capability to a provider tool.

        Args:
            canonical_capability: e.g. "communication.email.send"

        Returns:
            ResolvedCapability with provider, toolkit, tool, band

        Raises:
            ValueError: if capability is not mapped or is forbidden
        """
        mapping = self._capabilities.get(canonical_capability)
        if not mapping:
            raise ValueError(
                f"Unmapped capability: {canonical_capability}. "
                f"Known capabilities: {sorted(self._capabilities.keys())}"
            )

        provider = mapping["provider"]
        toolkit = mapping["toolkit"]
        tool = mapping["tool"]
        band = Band(mapping["band"])

        # Hard-block check
        if f"{toolkit}.{tool}".lower() in [f.lower() for f in self._forbidden]:
            raise ValueError(
                f"Forbidden tool: {toolkit}.{tool} for {canonical_capability}"
            )

        # Allowlist check (soft — warns if allowlist exists but tool not listed)
        if self._allowlist:
            band_key = f"band_{band.value}"
            allowed_toolkits = self._allowlist.get(band_key, {})
            allowed_tools = allowed_toolkits.get(toolkit, [])
            if allowed_tools and tool not in allowed_tools:
                # Hard-block: remote bash/workbench
                if toolkit in ("remote_bash", "remote_workbench"):
                    raise ValueError(f"Hard-blocked toolkit: {toolkit}. Fail-closed.")
                # Soft-warn for new tools not yet in allowlist
                import warnings

                warnings.warn(
                    f"Tool {tool} not in allowlist for band {band.value}. "
                    f"Consider adding to composio_allowlist.yaml."
                )

        return ResolvedCapability(
            canonical_capability=canonical_capability,
            provider=provider,
            toolkit=toolkit,
            tool=tool,
            account_alias=mapping.get("account_alias", "primary"),
            band=band,
        )

    def list_capabilities(self) -> list[str]:
        """List all registered canonical capabilities."""
        return sorted(self._capabilities.keys())

    def list_toolkits(self) -> list[str]:
        """List all registered Composio toolkits."""
        return sorted(set(m["toolkit"] for m in self._capabilities.values()))

    def is_forbidden(self, toolkit: str, tool: str) -> bool:
        """Check if a tool is in the forbidden list."""
        return f"{toolkit}.{tool}".lower() in [f.lower() for f in self._forbidden]


# ── Self-test ───────────────────────────────────

if __name__ == "__main__":
    mapper = ComposioMapper()
    print("APA Composio Mapper — canonical capability resolver")
    print(f"Capabilities: {len(mapper.list_capabilities())}")
    print(f"Toolkits: {mapper.list_toolkits()}")
    print()

    for cap in mapper.list_capabilities():
        resolved = mapper.resolve(cap)
        status = (
            "🔴"
            if resolved.requires_ack()
            else ("🟡" if resolved.requires_lease() else "🟢")
        )
        print(
            f"  {status} {cap} → {resolved.provider}/{resolved.toolkit}/{resolved.tool}"
        )
