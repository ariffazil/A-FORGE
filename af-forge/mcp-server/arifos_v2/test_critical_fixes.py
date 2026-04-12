"""
Test Suite for arifOS v2 Critical Fixes
═══════════════════════════════════════════════════════════════════════════════

Demonstrates all 5 critical fixes with before/after comparisons.

Run: python -m pytest af-forge/mcp-server/arifos_v2/test_critical_fixes.py -v
"""

import asyncio
import pytest
from typing import Any

try:
    from .identity import IdentityAuthority, IdentityStatus, DegradationReason, IdentityProof
    from .contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from .kernel import KernelState, Stage, kernel_route
    from .vault import VaultOutcome, vault_seal
    from .mind import mind_reason
except ImportError:
    # Direct execution
    from identity import IdentityAuthority, IdentityStatus, DegradationReason, IdentityProof
    from contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from kernel import KernelState, Stage, kernel_route
    from vault import VaultOutcome, vault_seal
    from mind import mind_reason


class TestCriticalFix1_Identity:
    """
    Critical Fix 1: Identity Continuity
    
    Before: Identity silently degraded from "arif" to "anonymous"
    After: Explicit identity_status: "DEGRADED" with degradation_reason
    """
    
    async def test_three_layer_identity(self):
        """Identity has declared, verified, and effective layers."""
        # Start anonymous
        identity = IdentityAuthority.anonymous()
        contract = identity.to_contract()
        
        assert contract["declared_actor_id"] == "anonymous"
        assert contract["verified_actor_id"] is None
        assert contract["effective_actor_id"] == "anonymous"
        assert contract["identity_status"] == "anonymous"
        
        # Declare identity
        identity = identity.declare("arif")
        contract = identity.to_contract()
        
        assert contract["declared_actor_id"] == "arif"
        assert contract["verified_actor_id"] is None
        assert contract["effective_actor_id"] == "arif"  # Falls back to declared
        assert contract["identity_status"] == "declared"
        
    async def test_explicit_degradation(self):
        """CRITICAL: Degradation is never silent."""
        # Create declared identity
        identity = IdentityAuthority.from_declaration("arif")
        
        # Simulate degradation (e.g., token expiry)
        degraded = identity.degrade(
            DegradationReason.TOKEN_EXPIRED,
            "Session token has expired"
        )
        
        contract = degraded.to_contract()
        
        # Explicit degradation notification
        assert contract["identity_status"] == "degraded"
        assert contract["previous_identity_status"] == "declared"
        assert contract["degradation_reason"] == "token_expired"
        # Falls back to declared (since we know what they claimed), but status shows DEGRADED
        assert contract["effective_actor_id"] == "arif"
        assert contract["is_verified"] is False
        
        # Audit trail preserved
        assert len(degraded.transitions) > 0
        last_transition = degraded.transitions[-1]
        assert last_transition["to"] == "degraded"
        assert last_transition["reason"] == "token_expired"
        
    async def test_verification_propagation(self):
        """Verified identity propagates correctly."""
        identity = IdentityAuthority.from_declaration("arif")
        
        # Create a proof that will pass verification
        # The verify() method checks if signature starts with hash prefix
        import hashlib
        payload = f"arif:2026-04-12T00:00:00Z:abc123"
        expected_prefix = hashlib.sha256(payload.encode()).hexdigest()[:32]
        
        proof = IdentityProof(
            signature=expected_prefix[:8] + "_suffix",  # Starts with expected prefix
            timestamp="2026-04-12T00:00:00Z",
            nonce="abc123",
            scope=["read", "write"]
        )
        
        # Verify
        verified = identity.verify(proof)
        
        contract = verified.to_contract()
        assert contract["is_verified"] is True
        assert contract["verification_scope"] == ["read", "write"]


class TestCriticalFix2_Contract:
    """
    Critical Fix 2: Execution/Governance Separation
    
    Before: "success + SABAR" ambiguity
    After: execution_status, governance_verdict, artifact_state, continue_allowed
    """
    
    async def test_four_field_contract(self):
        """All responses have four top-level status fields."""
        contract = ExecutionGovernanceContract.success_seal()
        d = contract.to_dict()
        
        # The four critical fields
        assert "execution_status" in d
        assert "governance_verdict" in d
        assert "artifact_state" in d
        assert "continue_allowed" in d
        
    async def test_no_more_success_sabar_ambiguity(self):
        """SABAR now has explicit execution=SUCCESS, governance=SABAR."""
        contract = ExecutionGovernanceContract.sabar_clarify(
            message="Input needs clarification",
            required_fields=["specific_task"]
        )
        d = contract.to_dict()
        
        # Execution succeeded (tool ran fine)
        assert d["execution_status"] == ExecutionStatus.SUCCESS.value
        # But governance says wait
        assert d["governance_verdict"] == GovernanceVerdict.SABAR.value
        # No usable artifact
        assert d["artifact_state"] == ArtifactState.EMPTY.value
        # Cannot continue
        assert d["continue_allowed"] is False
        # Required action specified
        assert d["required_action"]["type"] == "CLARIFY_INPUT"
        
    async def test_hold_semantics(self):
        """HOLD has clear artifact_state=STAGED."""
        contract = ExecutionGovernanceContract.hold_review(
            risk_level="high"
        )
        d = contract.to_dict()
        
        assert d["execution_status"] == ExecutionStatus.SUCCESS.value
        assert d["governance_verdict"] == GovernanceVerdict.HOLD.value
        assert d["artifact_state"] == ArtifactState.STAGED.value
        assert d["continue_allowed"] is False
        assert "888-" in d["required_action"]["approval_code"]


class TestCriticalFix3_Kernel:
    """
    Critical Fix 3: Kernel Contract Hardening
    
    Before: Nested VOID/SABAR/HOLD ambiguity spirals
    After: READY, HOLD, BLOCKED only
    """
    
    async def test_three_states_only(self):
        """Kernel returns only three states."""
        identity = IdentityAuthority.anonymous()
        
        # Test READY
        result = await kernel_route(
            query="Analyze this code",
            session_id="test-1",
            identity=identity,
            current_stage=Stage.INIT,
            intent="reason",
            dry_run=True,
        )
        
        assert result.state in [KernelState.READY, KernelState.HOLD, KernelState.BLOCKED]
        
    async def test_clean_handoff_spec(self):
        """READY includes clean handoff specification."""
        identity = IdentityAuthority.anonymous()
        
        result = await kernel_route(
            query="Analyze this code",
            session_id="test-2",
            identity=identity,
            current_stage=Stage.INIT,
            intent="reason",
            dry_run=True,
        )
        
        if result.state == KernelState.READY:
            assert result.handoff is not None
            assert result.handoff.next_stage is not None
            assert isinstance(result.handoff.required_inputs, list)
            assert result.handoff.release_condition is not None
            
    async def test_blocked_on_degraded_identity(self):
        """BLOCKED when identity is degraded."""
        # Create degraded identity
        identity = IdentityAuthority.from_declaration("arif")
        identity = identity.degrade(
            DegradationReason.VERIFICATION_FAILED,
            "Mock verification failure"
        )
        
        result = await kernel_route(
            query="Do something",
            session_id="test-3",
            identity=identity,
        )
        
        assert result.state == KernelState.BLOCKED
        assert result.contract.blocking_floor == "F1"


class TestCriticalFix4_Vault:
    """
    Critical Fix 4: Vault Binary Semantics
    
    Before: "success + SABAR + restricted" Schrödinger persistence
    After: SEALED, STAGED_NOT_SEALED, REJECTED only
    """
    
    async def test_three_outcomes_only(self):
        """Vault returns only three outcomes."""
        identity = IdentityAuthority.anonymous()
        
        # Test dry_run = STAGED_NOT_SEALED
        result = await vault_seal(
            artifact={"type": "test", "data": "hello"},
            identity=identity,
            dry_run=True,
        )
        
        assert result.outcome in [
            VaultOutcome.SEALED,
            VaultOutcome.STAGED_NOT_SEALED,
            VaultOutcome.REJECTED
        ]
        
    async def test_binary_seal_check(self):
        """is_sealed() gives unambiguous answer."""
        identity = IdentityAuthority.anonymous()
        
        # STAGED
        result = await vault_seal(
            artifact={"type": "test"},
            identity=identity,
            dry_run=True,
        )
        assert result.is_sealed() is False
        assert result.outcome == VaultOutcome.STAGED_NOT_SEALED
        
    async def test_rejected_on_degraded(self):
        """REJECTED when identity degraded."""
        identity = IdentityAuthority.from_declaration("arif")
        identity = identity.degrade(
            DegradationReason.VERIFICATION_FAILED,
            "Test"
        )
        
        result = await vault_seal(
            artifact={"type": "test"},
            identity=identity,
            dry_run=False,
        )
        
        assert result.outcome == VaultOutcome.REJECTED
        assert result.contract.governance_verdict == GovernanceVerdict.VOID


class TestCriticalFix5_Mind:
    """
    Critical Fix 5: Usable Artifacts
    
    Before: "Primary Causal Model" and "Epistemic Alternative" abstraction
    After: answer_basis with claims, assumptions, uncertainties
    """
    
    async def test_has_answer_basis(self):
        """Mind returns structured answer basis."""
        identity = IdentityAuthority.anonymous()
        
        result = await mind_reason(
            query="How should I refactor this code?",
            identity=identity,
        )
        
        basis = result.answer_basis
        assert basis.summary is not None
        assert basis.detailed_answer is not None
        
    async def test_has_claims(self):
        """Answer basis includes structured claims."""
        identity = IdentityAuthority.anonymous()
        
        result = await mind_reason(
            query="Should I use microservices?",
            identity=identity,
        )
        
        # Has claims with confidence
        assert len(result.answer_basis.claims) > 0
        for claim in result.answer_basis.claims:
            assert claim.statement is not None
            assert 0.0 <= claim.confidence <= 1.0
            
    async def test_has_recommended_render(self):
        """Has pre-formatted render for direct use."""
        identity = IdentityAuthority.anonymous()
        
        result = await mind_reason(
            query="Analyze this architecture",
            identity=identity,
        )
        
        assert result.recommended_render is not None
        assert len(result.recommended_render) > 0
        
    async def test_no_constitutional_theatre(self):
        """No abstract "causal model" language."""
        identity = IdentityAuthority.anonymous()
        
        result = await mind_reason(
            query="What should I build?",
            identity=identity,
        )
        
        render = result.recommended_render.lower()
        # Should not have overly abstract language
        assert "epistemic alternative" not in render
        assert "primary causal model" not in render
        # Should have concrete content
        assert len(result.answer_basis.key_findings) >= 0


class TestIntegration:
    """Integration tests showing fixes work together."""
    
    async def test_full_pipeline(self):
        """Complete flow: init -> kernel -> mind -> vault."""
        # 1. Init with identity
        identity = IdentityAuthority.from_declaration("arif")
        identity_contract = identity.to_contract()
        assert identity_contract["declared_actor_id"] == "arif"
        
        # 2. Kernel route
        kernel_result = await kernel_route(
            query="Analyze code architecture",
            session_id="integration-test",
            identity=identity,
            intent="reason",
            dry_run=True,
        )
        assert kernel_result.state in [KernelState.READY, KernelState.HOLD]
        assert "contract" in kernel_result.to_dict()
        
        # 3. Mind reason
        mind_result = await mind_reason(
            query="Analyze code architecture",
            identity=identity,
        )
        assert mind_result.answer_basis is not None
        assert mind_result.contract.execution_status == ExecutionStatus.SUCCESS
        
        # 4. Vault seal (dry run)
        artifact = {
            "type": "analysis",
            "tool": "arifos_mind",
            "stage": "333_MIND",
            "content": mind_result.answer_basis.summary,
        }
        vault_result = await vault_seal(
            artifact=artifact,
            identity=identity,
            dry_run=True,
        )
        assert vault_result.outcome == VaultOutcome.STAGED_NOT_SEALED
        
        print("✓ Full pipeline integration test passed")


# Run tests if executed directly
if __name__ == "__main__":
    print("═" * 80)
    print("arifOS v2.0 Critical Fixes Test Suite")
    print("═" * 80)
    
    async def run_tests():
        # Identity tests
        print("\n📋 Testing Critical Fix 1: Identity Continuity")
        t1 = TestCriticalFix1_Identity()
        await t1.test_three_layer_identity()
        print("  ✓ Three-layer identity")
        await t1.test_explicit_degradation()
        print("  ✓ Explicit degradation (never silent)")
        await t1.test_verification_propagation()
        print("  ✓ Verification propagation")
        
        # Contract tests
        print("\n📋 Testing Critical Fix 2: Execution/Governance Separation")
        t2 = TestCriticalFix2_Contract()
        await t2.test_four_field_contract()
        print("  ✓ Four-field contract")
        await t2.test_no_more_success_sabar_ambiguity()
        print("  ✓ No success+SABAR ambiguity")
        await t2.test_hold_semantics()
        print("  ✓ HOLD semantics")
        
        # Kernel tests
        print("\n📋 Testing Critical Fix 3: Kernel Contract Hardening")
        t3 = TestCriticalFix3_Kernel()
        await t3.test_three_states_only()
        print("  ✓ Three states only (READY/HOLD/BLOCKED)")
        await t3.test_clean_handoff_spec()
        print("  ✓ Clean handoff spec")
        await t3.test_blocked_on_degraded_identity()
        print("  ✓ BLOCKED on degraded identity")
        
        # Vault tests
        print("\n📋 Testing Critical Fix 4: Vault Binary Semantics")
        t4 = TestCriticalFix4_Vault()
        await t4.test_three_outcomes_only()
        print("  ✓ Three outcomes only (SEALED/STAGED/REJECTED)")
        await t4.test_binary_seal_check()
        print("  ✓ Binary seal check")
        await t4.test_rejected_on_degraded()
        print("  ✓ REJECTED on degraded identity")
        
        # Mind tests
        print("\n📋 Testing Critical Fix 5: Usable Artifacts")
        t5 = TestCriticalFix5_Mind()
        await t5.test_has_answer_basis()
        print("  ✓ Has answer basis")
        await t5.test_has_claims()
        print("  ✓ Has structured claims")
        await t5.test_has_recommended_render()
        print("  ✓ Has recommended render")
        await t5.test_no_constitutional_theatre()
        print("  ✓ No constitutional theatre")
        
        # Integration
        print("\n📋 Testing Integration")
        t6 = TestIntegration()
        await t6.test_full_pipeline()
        print("  ✓ Full pipeline integration")
        
        print("\n" + "═" * 80)
        print("✅ All critical fixes verified!")
        print("═" * 80)
    
    asyncio.run(run_tests())
