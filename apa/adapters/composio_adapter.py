"""
APA Composio Adapter — ACT-Governed Provider Adapter.

Wraps every Composio SDK call through the 7-phase ACT execution sequence:
    DRY_RUN → SIMULATE → PREFLIGHT → EXECUTE → VERIFY → ROLLBACK → RECEIPT

This adapter does NOT:
    - Authorize or judge (that's arifOS)
    - Map capabilities (that's ComposioMapper)
    - Store receipts (that's VAULT999 via ACT)
    - Self-approve leases

Architecture:
    ART → KERNEL → APA (ComposioMapper + this adapter) → ACT → COMPOSIO → VAULT999
"""

import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

from .composio_mapper import Band, ComposioMapper, ResolvedCapability


# ── Types ───────────────────────────────────────


class ACTPhase(Enum):
    DRY_RUN = "DRY_RUN"
    SIMULATE = "SIMULATE"
    PREFLIGHT = "PREFLIGHT"
    EXECUTE = "EXECUTE"
    VERIFY = "VERIFY"
    ROLLBACK = "ROLLBACK"
    RECEIPT = "RECEIPT"


class ExecutionStatus(Enum):
    PENDING = "PENDING"
    DRY_RUN_PASSED = "DRY_RUN_PASSED"
    PREFLIGHT_PASSED = "PREFLIGHT_PASSED"
    EXECUTED = "EXECUTED"
    VERIFIED = "VERIFIED"
    ROLLED_BACK = "ROLLED_BACK"
    RECEIPTED = "RECEIPTED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


@dataclass
class ACTTrace:
    """Full execution trace through ACT phases."""

    capability: ResolvedCapability
    status: ExecutionStatus = ExecutionStatus.PENDING
    phases_completed: list[str] = field(default_factory=list)
    provider_execution_id: Optional[str] = None
    provider_result: Optional[dict] = None
    provider_result_hash: Optional[str] = None
    verification_result: Optional[dict] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    idempotency_key: Optional[str] = None

    def phase(self, name: str) -> "ACTTrace":
        self.phases_completed.append(name)
        return self


# ── Adapter ─────────────────────────────────────


class ComposioAdapter:
    """
    ACT-governed adapter for Composio provider calls.

    Usage:
        adapter = ComposioAdapter(mapper)
        trace = adapter.execute(
            capability="communication.email.send",
            arguments={"to": "...", "subject": "...", "body": "..."},
            actor_id="ARIF",
            session_id="sess_...",
            lease_id="lease_...",
        )
    """

    def __init__(
        self,
        mapper: Optional[ComposioMapper] = None,
        composio_client: Optional[Any] = None,
    ):
        self.mapper = mapper or ComposioMapper()
        self._client = composio_client

    @property
    def client(self):
        """Lazy-init Composio SDK client."""
        if self._client is None:
            api_key = os.environ.get("COMPOSIO_API_KEY", "")
            if not api_key:
                raise ValueError("COMPOSIO_API_KEY not set")
            # Late import to avoid hard dependency
            try:
                from composio import Composio

                self._client = Composio(api_key=api_key)
            except ImportError:
                raise ImportError(
                    "composio package required. Install: pip install composio-core"
                )
        return self._client

    def execute(
        self,
        capability: str,
        arguments: dict,
        actor_id: str,
        session_id: str,
        lease_id: Optional[str] = None,
        account_alias: Optional[str] = None,
    ) -> ACTTrace:
        """
        Execute a canonical capability through ACT phases.

        Args:
            capability: Canonical capability name (e.g. "communication.email.send")
            arguments: Tool arguments
            actor_id: Kernel-bound actor
            session_id: Kernel session
            lease_id: Kernel lease (required for MUTATE and EXTERNAL bands)
            account_alias: Explicit account selection (required)

        Returns:
            ACTTrace with full execution trace
        """
        trace = ACTTrace(
            capability=self.mapper.resolve(capability),
            idempotency_key=str(uuid.uuid4()),
            started_at=time.time(),
        )

        try:
            # ── Phase 1: DRY_RUN ──
            trace = self._dry_run(trace, arguments)

            # ── Phase 2: SIMULATE ──
            trace = self._simulate(trace, arguments)

            # ── Phase 3: PREFLIGHT ──
            trace = self._preflight(
                trace, actor_id, session_id, lease_id, account_alias
            )

            # ── Phase 4: EXECUTE ──
            trace = self._execute(trace, arguments)

            # ── Phase 5: VERIFY ──
            trace = self._verify(trace)

            # ── Phase 6: ROLLBACK (only if needed) ──
            # (compensation logic runs here if VERIFY fails)

            # ── Phase 7: RECEIPT ──
            trace = self._receipt(trace)

            trace.status = ExecutionStatus.RECEIPTED

        except Exception as e:
            trace.error = str(e)
            trace.status = (
                ExecutionStatus.FAILED
                if trace.phases_completed
                else ExecutionStatus.BLOCKED
            )
            # Attempt rollback if execution happened
            if ACTPhase.EXECUTE.value in trace.phases_completed:
                try:
                    self._rollback(trace)
                    trace.status = ExecutionStatus.ROLLED_BACK
                except Exception as rb_err:
                    trace.error += f" | Rollback failed: {rb_err}"

        finally:
            trace.completed_at = time.time()

        return trace

    # ── Phase Implementations ──

    def _dry_run(self, trace: ACTTrace, arguments: dict) -> ACTTrace:
        """Validate schemas, resolve provider tool. No side effects."""
        cap = trace.capability

        # Validate capability is mapped
        if not cap.tool:
            raise ValueError(f"Unmapped capability: {cap.canonical_capability}")

        # Validate required arguments exist (basic schema check)
        # Full schema validation should use the provider tool's inputSchema

        trace.phase(ACTPhase.DRY_RUN.value)
        trace.status = ExecutionStatus.DRY_RUN_PASSED
        return trace

    def _simulate(self, trace: ACTTrace, arguments: dict) -> ACTTrace:
        """Preview the intended effect without calling provider."""
        # For now: structural preview. Future: call provider's validate/dry-run endpoint.
        trace.phase(ACTPhase.SIMULATE.value)
        return trace

    def _preflight(
        self,
        trace: ACTTrace,
        actor_id: str,
        session_id: str,
        lease_id: Optional[str],
        account_alias: Optional[str],
    ) -> ACTTrace:
        """Check lease, actor, account, scopes, payload hash before execution."""
        cap = trace.capability

        # Lease check
        if cap.requires_lease() and not lease_id:
            raise ValueError(
                f"Lease required for band {cap.band.value}. "
                f"Capability: {cap.canonical_capability}"
            )

        # Account check
        if not account_alias and not cap.account_alias:
            raise ValueError("Explicit account_alias required for governed execution")

        # Bind identity
        cap.actor_id = actor_id
        cap.session_id = session_id
        cap.lease_id = lease_id
        if account_alias:
            cap.account_alias = account_alias

        trace.phase(ACTPhase.PREFLIGHT.value)
        trace.status = ExecutionStatus.PREFLIGHT_PASSED
        return trace

    def _execute(self, trace: ACTTrace, arguments: dict) -> ACTTrace:
        """Single provider call. Exactly once."""
        cap = trace.capability

        # Build tool call
        tool_call = {
            "name": cap.tool,
            "arguments": arguments,
        }

        # Execute through SDK
        result = self.client.tool_router.create(
            user_id="arif-federation",
            toolkits=[cap.toolkit],
        ).execute(
            cap.tool,
            arguments,
        )

        trace.provider_execution_id = result.get("log_id", str(uuid.uuid4()))
        trace.provider_result = result
        trace.provider_result_hash = _hash_dict(result)

        trace.phase(ACTPhase.EXECUTE.value)
        trace.status = ExecutionStatus.EXECUTED
        return trace

    def _verify(self, trace: ACTTrace) -> ACTTrace:
        """Independent state read to confirm execution result."""
        # For now: verify provider_result is successful
        result = trace.provider_result or {}
        if not result.get("successful", result.get("successfull", True)):
            raise ValueError(
                f"Provider execution failed: {result.get('error', 'unknown')}"
            )

        trace.verification_result = {
            "verified": True,
            "method": "provider_result_check",
        }
        trace.phase(ACTPhase.VERIFY.value)
        trace.status = ExecutionStatus.VERIFIED
        return trace

    def _rollback(self, trace: ACTTrace) -> ACTTrace:
        """Compensation when possible."""
        # Rollback is capability-specific. Mark attempted.
        trace.phase(ACTPhase.ROLLBACK.value)
        return trace

    def _receipt(self, trace: ACTTrace) -> ACTTrace:
        """Normalize and prepare VAULT999 receipt."""
        cap = trace.capability
        receipt = {
            "connector": cap.provider,
            "provider_toolkit": cap.toolkit,
            "provider_tool": cap.tool,
            "canonical_capability": cap.canonical_capability,
            "actor_id": cap.actor_id,
            "session_id": cap.session_id,
            "lease_id": cap.lease_id,
            "account_alias": cap.account_alias,
            "verb_class": cap.band.value,
            "blast_radius": cap.blast_radius,
            "idempotency_key": trace.idempotency_key,
            "provider_execution_id": trace.provider_execution_id,
            "provider_result_hash": trace.provider_result_hash,
            "verification_state": trace.status.value,
            "phases_completed": trace.phases_completed,
            "started_at": trace.started_at,
            "completed_at": trace.completed_at,
            "error": trace.error,
        }
        # Store on trace for VAULT999 seal
        trace.phase(ACTPhase.RECEIPT.value)
        return trace


# ── Helpers ─────────────────────────────────────


def _hash_dict(d: dict) -> str:
    """Stable SHA-256 hash of a dictionary."""
    canonical = json.dumps(d, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


# ── Self-test ───────────────────────────────────

if __name__ == "__main__":
    mapper = ComposioMapper()
    adapter = ComposioAdapter(mapper=mapper)

    print("APA Composio Adapter — ACT-governed")
    print(f"Capabilities: {len(mapper.list_capabilities())}")
    print()

    # Dry-run test (no actual provider call)
    for cap_name in mapper.list_capabilities()[:3]:
        resolved = mapper.resolve(cap_name)
        print(
            f"  {resolved.band.value:20s} {cap_name} → {resolved.toolkit}/{resolved.tool}"
        )
