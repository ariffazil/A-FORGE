"""
Critical Fix 3: Kernel Contract Hardening
═══════════════════════════════════════════════════════════════════════════════

The kernel is the constitutional bridge. It must have the cleanest contract.

v1 Problems:
- Nested VOID/SABAR/HOLD degraded confidence spirals
- Unclear what state the system is in
- Ambiguous handoff semantics

v2 Solution:
- Returns only: READY, HOLD, BLOCKED
- Clean handoff spec with: next_stage, required_inputs, release_condition
- No nested ambiguity - one clear state
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal

try:
    from .contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from .identity import IdentityAuthority
except ImportError:
    from contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from identity import IdentityAuthority


class KernelState(str, Enum):
    """
    The three canonical kernel states.
    
    No more nested ambiguity spirals - just these three.
    """
    READY = "READY"       # System ready to accept work
    HOLD = "HOLD"         # Paused, waiting for condition
    BLOCKED = "BLOCKED"   # Cannot proceed, requires intervention


class Stage(str, Enum):
    """Canonical arifOS stages."""
    INIT = "000_INIT"
    SENSE = "111_SENSE"
    MIND = "333_MIND"
    ROUTER = "444_ROUTER"
    MEMORY = "555_MEMORY"
    HEART = "666_HEART"
    FORGE = "777_FORGE"
    JUDGE = "888_JUDGE"
    VAULT = "999_VAULT"


@dataclass
class HandoffSpec:
    """
    Clean handoff specification.
    
    When kernel transitions, this specifies exactly what's needed.
    """
    next_stage: Stage
    required_inputs: list[str]  # What fields must be provided
    release_condition: str      # What must be true to release HOLD
    estimated_tokens: int = 0   # Resource estimate
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "next_stage": self.next_stage.value,
            "required_inputs": self.required_inputs,
            "release_condition": self.release_condition,
            "estimated_tokens": self.estimated_tokens,
        }


@dataclass
class KernelResult:
    """
    Critical Fix 3: Clean kernel result.
    
    No nested structures. Flat, explicit, actionable.
    """
    state: KernelState
    current_stage: Stage
    message: str
    
    # Contract (Critical Fix 2)
    contract: ExecutionGovernanceContract
    
    # Handoff (if transitioning)
    handoff: HandoffSpec | None = None
    
    # Identity context (Critical Fix 1)
    identity: dict[str, Any] = field(default_factory=dict)
    
    # Diagnostics (separate from primary contract)
    diagnostics: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict[str, Any]:
        """Export clean kernel result."""
        result = {
            # Primary contract (3 states only)
            "state": self.state.value,
            "current_stage": self.current_stage.value,
            "message": self.message,
            
            # Execution/Governance separation
            "contract": self.contract.to_dict(),
            
            # Handoff spec (if any)
            "handoff": self.handoff.to_dict() if self.handoff else None,
            
            # Identity
            "identity": self.identity,
        }
        
        # Diagnostics in separate section (don't pollute primary contract)
        if self.diagnostics:
            result["_diagnostics"] = self.diagnostics
            
        return result


class KernelRouter:
    """
    Critical Fix 3: Hardened kernel router.
    
    Routes requests through the constitutional pipeline with clean semantics.
    """
    
    def __init__(self):
        self.stage_transitions: dict[Stage, list[Stage]] = {
            Stage.INIT: [Stage.SENSE, Stage.MIND],
            Stage.SENSE: [Stage.MIND, Stage.MEMORY],
            Stage.MIND: [Stage.HEART, Stage.FORGE, Stage.JUDGE],
            Stage.ROUTER: [Stage.MIND, Stage.HEART, Stage.FORGE, Stage.JUDGE],
            Stage.MEMORY: [Stage.MIND, Stage.ROUTER],
            Stage.HEART: [Stage.FORGE, Stage.JUDGE],
            Stage.FORGE: [Stage.JUDGE],
            Stage.JUDGE: [Stage.VAULT],
            Stage.VAULT: [],  # Terminal
        }
    
    async def route(
        self,
        query: str,
        session_id: str,
        identity: IdentityAuthority,
        current_stage: Stage = Stage.INIT,
        intent: str | None = None,
        risk_tier: str = "medium",
        dry_run: bool = True,
    ) -> KernelResult:
        """
        Route request through constitutional pipeline.
        
        Returns clean KernelResult with one of three states: READY, HOLD, BLOCKED.
        """
        # Check identity (Critical Fix 1)
        identity_contract = identity.to_contract()
        
        if identity_contract["identity_status"] == "degraded":
            # Explicit degradation - BLOCKED
            return KernelResult(
                state=KernelState.BLOCKED,
                current_stage=current_stage,
                message=f"Identity degraded: {identity_contract['degradation_reason']}",
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.SUCCESS,
                    governance_verdict=GovernanceVerdict.HOLD,
                    artifact_state=ArtifactState.REJECTED,
                    continue_allowed=False,
                    message="Identity verification required",
                    floors_checked=["F1", "F11"],
                    floors_failed=["F1"],
                    blocking_floor="F1",
                    required_action={
                        "type": "REAUTHENTICATE",
                        "reason": identity_contract["degradation_reason"],
                        "guidance": "Re-authenticate with valid proof"
                    }
                ),
                identity=identity_contract,
                diagnostics={
                    "degradation_history": identity.transitions[-3:] if identity.transitions else []
                }
            )
        
        # Determine target stage based on intent
        target_stage = self._determine_stage(intent, query)
        
        # Check if transition is valid
        if target_stage not in self.stage_transitions.get(current_stage, []):
            # Invalid transition - HOLD with guidance
            valid_next = self.stage_transitions.get(current_stage, [])
            return KernelResult(
                state=KernelState.HOLD,
                current_stage=current_stage,
                message=f"Invalid stage transition from {current_stage.value} to {target_stage.value}",
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.SUCCESS,
                    governance_verdict=GovernanceVerdict.SABAR,
                    artifact_state=ArtifactState.EMPTY,
                    continue_allowed=False,
                    message="Stage transition not allowed",
                    floors_checked=["F11"],
                    floors_failed=["F11"],
                    blocking_floor="F11",
                    required_action={
                        "type": "VALID_STAGE_TRANSITION",
                        "valid_next_stages": [s.value for s in valid_next],
                        "guidance": f"From {current_stage.value}, valid transitions are: {[s.value for s in valid_next]}"
                    }
                ),
                handoff=HandoffSpec(
                    next_stage=valid_next[0] if valid_next else current_stage,
                    required_inputs=["intent", "query"],
                    release_condition="Select valid target stage"
                ),
                identity=identity_contract
            )
        
        # Check risk tier for HOLD
        if risk_tier in ["high", "critical"] and not dry_run:
            # High risk requires explicit approval - HOLD
            return KernelResult(
                state=KernelState.HOLD,
                current_stage=current_stage,
                message=f"Risk tier '{risk_tier}' requires human approval (F13)",
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.SUCCESS,
                    governance_verdict=GovernanceVerdict.HOLD,
                    artifact_state=ArtifactState.STAGED,
                    continue_allowed=False,
                    message="888_HOLD: Human approval required for high-risk operation",
                    floors_checked=["F4", "F13"],
                    floors_failed=["F13"],
                    blocking_floor="F13",
                    required_action={
                        "type": "HUMAN_APPROVAL",
                        "approval_code": f"888-{__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y%m%d%H%M')}",
                        "risk_level": risk_tier,
                        "dry_run_status": dry_run,
                        "guidance": "Provide approval code to release HOLD"
                    }
                ),
                handoff=HandoffSpec(
                    next_stage=target_stage,
                    required_inputs=["approval_code"],
                    release_condition="Valid 888-HOLD approval code provided"
                ),
                identity=identity_contract
            )
        
        # All clear - READY
        return KernelResult(
            state=KernelState.READY,
            current_stage=current_stage,
            message=f"Ready to transition to {target_stage.value}",
            contract=ExecutionGovernanceContract(
                execution_status=ExecutionStatus.SUCCESS,
                governance_verdict=GovernanceVerdict.SEAL,
                artifact_state=ArtifactState.USABLE,
                continue_allowed=True,
                message="Kernel ready for next stage",
                floors_checked=["F1", "F4", "F11", "F13"],
                next_allowed_tools=["arifos_mind", "arifos_heart", "arifos_forge", "arifos_judge"]
            ),
            handoff=HandoffSpec(
                next_stage=target_stage,
                required_inputs=[],
                release_condition="Automatic - all checks passed"
            ),
            identity=identity_contract
        )
    
    def _determine_stage(self, intent: str | None, query: str) -> Stage:
        """Determine target stage from intent/query."""
        if not intent:
            # Infer from query keywords
            query_lower = query.lower()
            if any(kw in query_lower for kw in ["reason", "think", "analyze", "synthesize"]):
                return Stage.MIND
            elif any(kw in query_lower for kw in ["safety", "risk", "harm", "critique"]):
                return Stage.HEART
            elif any(kw in query_lower for kw in ["build", "create", "generate", "forge"]):
                return Stage.FORGE
            elif any(kw in query_lower for kw in ["judge", "validate", "verify", "decide"]):
                return Stage.JUDGE
            elif any(kw in query_lower for kw in ["remember", "recall", "store"]):
                return Stage.MEMORY
            else:
                return Stage.MIND  # Default
        
        # Map intent to stage
        intent_map = {
            "reason": Stage.MIND,
            "analyze": Stage.MIND,
            "synthesize": Stage.MIND,
            "critique": Stage.HEART,
            "simulate": Stage.HEART,
            "forge": Stage.FORGE,
            "build": Stage.FORGE,
            "judge": Stage.JUDGE,
            "validate": Stage.JUDGE,
            "seal": Stage.VAULT,
            "remember": Stage.MEMORY,
        }
        return intent_map.get(intent.lower(), Stage.MIND)


# Singleton kernel router
_kernel_router = KernelRouter()


async def kernel_route(**kwargs) -> KernelResult:
    """Convenience function for kernel routing."""
    return await _kernel_router.route(**kwargs)
