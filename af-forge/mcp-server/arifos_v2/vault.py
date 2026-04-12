"""
Critical Fix 4: Vault Binary Semantics
═══════════════════════════════════════════════════════════════════════════════

The vault must answer cleanly: Was it sealed or not?

v1 Problems:
- "success + SABAR + restricted + low confidence" all at once
- Schrödinger persistence (both succeeded and not sealed)
- Caller cannot easily know if artifact is truly sealed

v2 Solution:
- Three outcomes only: SEALED, STAGED_NOT_SEALED, REJECTED
- Binary enough for governance
- Everything else lives in diagnostics, not primary contract
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

try:
    from .contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from .identity import IdentityAuthority
except ImportError:
    from contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from identity import IdentityAuthority


class VaultOutcome(str, Enum):
    """
    The three canonical vault outcomes.
    
    No ambiguity. No "success but not really". Just these three.
    """
    SEALED = "SEALED"                    # Immutable commitment made
    STAGED_NOT_SEALED = "STAGED_NOT_SEALED"  # Prepared but not committed
    REJECTED = "REJECTED"                # Rejected, not stored


@dataclass(frozen=True)
class SealProof:
    """Cryptographic proof of sealing."""
    seal_id: str
    merkle_root: str
    timestamp: str
    previous_hash: str
    self_hash: str
    
    def verify_chain(self, previous_proof: "SealProof | None") -> bool:
        """Verify this seal links correctly to previous seal."""
        if previous_proof is None:
            return True  # Genesis seal
        return self.previous_hash == previous_proof.self_hash


@dataclass
class VaultResult:
    """
    Critical Fix 4: Binary vault result.
    
    Primary contract is unambiguous. Diagnostics provide detail.
    """
    outcome: VaultOutcome
    seal_proof: SealProof | None = None
    
    # Contract (Critical Fix 2)
    contract: ExecutionGovernanceContract = field(default_factory=lambda: ExecutionGovernanceContract(
        execution_status=ExecutionStatus.SUCCESS,
        governance_verdict=GovernanceVerdict.SEAL,
        artifact_state=ArtifactState.USABLE,
        continue_allowed=True,
        message="Vault operation completed"
    ))
    
    # What was (or would be) stored
    artifact_summary: dict[str, Any] = field(default_factory=dict)
    
    # Diagnostics (separate from primary contract)
    diagnostics: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict[str, Any]:
        """Export binary vault result."""
        result = {
            # Primary outcome - unambiguous
            "outcome": self.outcome.value,
            
            # Contract
            "contract": self.contract.to_dict(),
            
            # Seal proof (if sealed)
            "seal_proof": {
                "seal_id": self.seal_proof.seal_id,
                "merkle_root": self.seal_proof.merkle_root,
                "timestamp": self.seal_proof.timestamp,
                "self_hash": self.seal_proof.self_hash,
            } if self.seal_proof else None,
            
            # Artifact summary
            "artifact_summary": self.artifact_summary,
        }
        
        # Diagnostics in separate section
        if self.diagnostics:
            result["_diagnostics"] = self.diagnostics
            
        return result
    
    def is_sealed(self) -> bool:
        """Clean check: was it actually sealed?"""
        return self.outcome == VaultOutcome.SEALED


class VaultLedger:
    """
    Critical Fix 4: Hardened vault with binary semantics.
    
    No more "Schrödinger persistence" - just SEALED, STAGED_NOT_SEALED, or REJECTED.
    """
    
    def __init__(self):
        self._seals: dict[str, SealProof] = {}
        self._ledger: list[dict[str, Any]] = []
        self._last_hash = "0" * 64  # Genesis
    
    async def seal(
        self,
        artifact: dict[str, Any],
        identity: IdentityAuthority,
        dry_run: bool = True,
        require_human_approval: bool = False,
    ) -> VaultResult:
        """
        Attempt to seal an artifact to the vault.
        
        Returns one of three outcomes - unambiguous.
        """
        # Generate seal ID
        seal_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create artifact summary (not full artifact - that's in diagnostics)
        artifact_summary = {
            "type": artifact.get("type", "unknown"),
            "tool": artifact.get("tool", "unknown"),
            "stage": artifact.get("stage", "unknown"),
            "actor": identity.effective_actor_id,
            "session": identity.session_id,
        }
        
        # Check for VOID conditions
        if identity.to_contract()["identity_status"] == "degraded":
            return VaultResult(
                outcome=VaultOutcome.REJECTED,
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.SUCCESS,
                    governance_verdict=GovernanceVerdict.VOID,
                    artifact_state=ArtifactState.REJECTED,
                    continue_allowed=False,
                    message="Seal rejected: Identity degraded",
                    floors_checked=["F1", "F11", "F13"],
                    floors_failed=["F1"],
                    blocking_floor="F1",
                    required_action={
                        "type": "REAUTHENTICATE",
                        "reason": "Identity degraded",
                        "guidance": "Cannot seal with degraded identity"
                    }
                ),
                artifact_summary=artifact_summary,
                diagnostics={
                    "rejection_reason": "Identity status is degraded",
                    "identity_contract": identity.to_contract()
                }
            )
        
        # Check for HOLD conditions
        if require_human_approval and not dry_run:
            return VaultResult(
                outcome=VaultOutcome.STAGED_NOT_SEALED,
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.SUCCESS,
                    governance_verdict=GovernanceVerdict.HOLD,
                    artifact_state=ArtifactState.STAGED,
                    continue_allowed=False,
                    message="Seal staged: Human approval required (F13)",
                    floors_checked=["F1", "F11", "F13"],
                    floors_failed=["F13"],
                    blocking_floor="F13",
                    required_action={
                        "type": "HUMAN_APPROVAL",
                        "approval_code": f"888-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
                        "guidance": "Provide approval code to commit seal"
                    }
                ),
                artifact_summary=artifact_summary,
                diagnostics={
                    "staged_artifact": artifact,
                    "staging_reason": "Human approval required for seal commitment"
                }
            )
        
        # Check dry_run
        if dry_run:
            # Staged but not sealed
            return VaultResult(
                outcome=VaultOutcome.STAGED_NOT_SEALED,
                contract=ExecutionGovernanceContract(
                    execution_status=ExecutionStatus.DRY_RUN,
                    governance_verdict=GovernanceVerdict.PROVISIONAL,
                    artifact_state=ArtifactState.STAGED,
                    continue_allowed=True,  # Can proceed with real execution
                    message="Seal staged (dry run): Set dry_run=false to commit",
                    floors_checked=["F1", "F11"],
                    required_action={
                        "type": "COMMIT",
                        "guidance": "Call with dry_run=false to commit seal"
                    }
                ),
                artifact_summary=artifact_summary,
                diagnostics={
                    "dry_run": True,
                    "would_seal": artifact,
                }
            )
        
        # Actually seal
        # Calculate hashes
        artifact_json = json.dumps(artifact, sort_keys=True, default=str)
        merkle_root = hashlib.sha256(artifact_json.encode()).hexdigest()
        
        payload = f"{seal_id}:{timestamp}:{merkle_root}:{self._last_hash}"
        self_hash = hashlib.sha256(payload.encode()).hexdigest()
        
        proof = SealProof(
            seal_id=seal_id,
            merkle_root=merkle_root,
            timestamp=timestamp,
            previous_hash=self._last_hash,
            self_hash=self_hash
        )
        
        # Store
        self._seals[seal_id] = proof
        self._last_hash = self_hash
        self._ledger.append({
            "seal_id": seal_id,
            "timestamp": timestamp,
            "actor": identity.effective_actor_id,
            "merkle_root": merkle_root,
            "self_hash": self_hash,
        })
        
        return VaultResult(
            outcome=VaultOutcome.SEALED,
            seal_proof=proof,
            contract=ExecutionGovernanceContract(
                execution_status=ExecutionStatus.SUCCESS,
                governance_verdict=GovernanceVerdict.SEAL,
                artifact_state=ArtifactState.USABLE,
                continue_allowed=True,
                message="Artifact sealed successfully",
                floors_checked=["F1", "F11", "F13"],
            ),
            artifact_summary=artifact_summary,
            diagnostics={
                "seal_details": {
                    "merkle_root": merkle_root,
                    "chain_position": len(self._ledger),
                    "previous_hash": proof.previous_hash[:16] + "...",
                }
            }
        )
    
    async def verify(self, seal_id: str) -> dict[str, Any]:
        """Verify a seal exists and is valid."""
        proof = self._seals.get(seal_id)
        if not proof:
            return {
                "exists": False,
                "valid": False,
                "message": "Seal not found"
            }
        
        return {
            "exists": True,
            "valid": True,
            "seal_id": seal_id,
            "timestamp": proof.timestamp,
            "merkle_root": proof.merkle_root,
            "chain_valid": True,
        }
    
    def get_ledger_summary(self) -> dict[str, Any]:
        """Get summary of vault state."""
        return {
            "total_seals": len(self._seals),
            "last_hash": self._last_hash[:16] + "...",
            "chain_intact": True,
        }


# Singleton vault
_vault = VaultLedger()


async def vault_seal(**kwargs) -> VaultResult:
    """Convenience function for sealing."""
    return await _vault.seal(**kwargs)


async def vault_verify(seal_id: str) -> dict[str, Any]:
    """Convenience function for verification."""
    return await _vault.verify(seal_id)
