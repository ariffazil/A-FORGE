"""
Critical Fix 5: Usable Artifacts from Mind/Reply
═══════════════════════════════════════════════════════════════════════════════

v1 Problems:
- Too much constitutional self-description
- "Primary Causal Model" and "Epistemic Alternative" but no synthesized answer
- Governance theatre over substance

v2 Solution:
- Return structured usable payloads
- answer_basis, claims, assumptions, uncertainties
- recommended_render for direct downstream use
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

try:
    from .contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from .identity import IdentityAuthority
except ImportError:
    from contract import ExecutionGovernanceContract, ExecutionStatus, GovernanceVerdict, ArtifactState
    from identity import IdentityAuthority


@dataclass
class Claim:
    """A single claim with grounding."""
    statement: str
    confidence: float  # 0.0 to 1.0
    evidence: list[str] = field(default_factory=list)
    source: str = "inferred"  # grounded, inferred, assumed
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "statement": self.statement,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "source": self.source,
        }


@dataclass
class AnswerBasis:
    """
    The substance of a mind/reply response.
    
    Not constitutional theatre - actual usable content.
    """
    # Core answer
    summary: str  # One-line executive summary
    detailed_answer: str  # Full answer
    
    # Structured components
    claims: list[Claim] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    uncertainties: list[str] = field(default_factory=list)
    
    # For downstream use
    key_findings: list[str] = field(default_factory=list)
    recommended_actions: list[str] = field(default_factory=list)
    
    # Alternative perspectives (epistemic humility)
    alternative_views: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "detailed_answer": self.detailed_answer,
            "claims": [c.to_dict() for c in self.claims],
            "assumptions": self.assumptions,
            "uncertainties": self.uncertainties,
            "key_findings": self.key_findings,
            "recommended_actions": self.recommended_actions,
            "alternative_views": self.alternative_views,
        }


@dataclass
class MindResult:
    """
    Critical Fix 5: Mind/Reply with usable artifacts.
    
    Provides both structured basis and recommended render.
    """
    # The usable payload
    answer_basis: AnswerBasis
    
    # Direct use
    recommended_render: str  # Pre-formatted for immediate use
    
    # Contract
    contract: ExecutionGovernanceContract
    
    # Identity
    identity: dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    mode: str = "reason"  # reason, reflect, synthesize
    stage: str = "333_MIND"
    
    # Diagnostics
    reasoning_trace: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        return {
            # Primary: usable artifact
            "answer_basis": self.answer_basis.to_dict(),
            "recommended_render": self.recommended_render,
            
            # Contract
            "contract": self.contract.to_dict(),
            
            # Identity
            "identity": self.identity,
            
            # Metadata
            "mode": self.mode,
            "stage": self.stage,
            
            # Diagnostics in separate section
            "_reasoning_trace": self.reasoning_trace if self.reasoning_trace else None,
        }


class MindEngine:
    """
    Critical Fix 5: Mind engine producing usable artifacts.
    
    Replaces abstract "causal model" language with concrete answer basis.
    """
    
    async def reason(
        self,
        query: str,
        identity: IdentityAuthority,
        context: str | None = None,
        mode: Literal["reason", "reflect", "synthesize"] = "reason",
    ) -> MindResult:
        """
        Generate reasoned response with usable artifacts.
        """
        # Build answer basis from query
        # In production, this would use actual LLM reasoning
        
        # Parse query for structure
        claims = self._extract_claims(query, context)
        assumptions = self._extract_assumptions(query)
        uncertainties = self._identify_uncertainties(query)
        
        # Build basis
        basis = AnswerBasis(
            summary=self._generate_summary(query, claims),
            detailed_answer=self._generate_detailed(query, claims, context),
            claims=claims,
            assumptions=assumptions,
            uncertainties=uncertainties,
            key_findings=[c.statement for c in claims if c.confidence > 0.7],
            recommended_actions=self._suggest_actions(query, claims),
            alternative_views=self._generate_alternatives(query),
        )
        
        # Generate recommended render
        render = self._render_recommended(basis, mode)
        
        # Determine contract
        has_high_confidence = any(c.confidence > 0.8 for c in claims)
        has_uncertainty = len(uncertainties) > 0
        
        if has_high_confidence and not has_uncertainty:
            contract = ExecutionGovernanceContract.success_seal(
                message="Reasoning complete with high confidence",
                floors_checked=["F2", "F4", "F7", "F8"]
            )
        elif has_uncertainty:
            contract = ExecutionGovernanceContract(
                execution_status=ExecutionStatus.SUCCESS,
                governance_verdict=GovernanceVerdict.PROVISIONAL,
                artifact_state=ArtifactState.PARTIAL,
                continue_allowed=True,
                message="Reasoning complete with noted uncertainties (F7)",
                floors_checked=["F2", "F4", "F7", "F8"],
                floors_failed=[],
                required_action={
                    "type": "ACKNOWLEDGE_UNCERTAINTY",
                    "uncertainties": uncertainties,
                    "guidance": "Review uncertainties before proceeding"
                }
            )
        else:
            contract = ExecutionGovernanceContract.success_seal(
                message="Reasoning complete",
                floors_checked=["F2", "F4", "F7", "F8"]
            )
        
        return MindResult(
            answer_basis=basis,
            recommended_render=render,
            contract=contract,
            identity=identity.to_contract(),
            mode=mode,
            reasoning_trace=[
                f"Analyzed query: {query[:50]}...",
                f"Extracted {len(claims)} claims",
                f"Identified {len(assumptions)} assumptions",
                f"Noted {len(uncertainties)} uncertainties",
            ]
        )
    
    def _extract_claims(self, query: str, context: str | None) -> list[Claim]:
        """Extract claims from query (simplified - would use LLM)."""
        # Simplified extraction
        claims = []
        
        # Check for explicit claims in query
        if "because" in query.lower():
            parts = query.split("because", 1)
            if len(parts) == 2:
                claims.append(Claim(
                    statement=parts[0].strip(),
                    confidence=0.75,
                    evidence=[f"Stated in query: {parts[1].strip()[:100]}"],
                    source="grounded"
                ))
        
        # Default claim from query
        if not claims:
            claims.append(Claim(
                statement=f"Request to: {query[:80]}",
                confidence=0.9,
                evidence=["Explicit user request"],
                source="grounded"
            ))
        
        return claims
    
    def _extract_assumptions(self, query: str) -> list[str]:
        """Identify implicit assumptions."""
        assumptions = []
        
        # Common assumption patterns
        if "improve" in query.lower():
            assumptions.append("Current state is suboptimal")
        if "fix" in query.lower():
            assumptions.append("Something is broken")
        if "better" in query.lower():
            assumptions.append("There exists a better alternative")
        
        return assumptions
    
    def _identify_uncertainties(self, query: str) -> list[str]:
        """Identify areas of uncertainty."""
        uncertainties = []
        
        # Uncertainty markers
        uncertainty_words = ["maybe", "probably", "might", "could", "possibly"]
        for word in uncertainty_words:
            if word in query.lower():
                uncertainties.append(f"Query contains uncertainty marker: '{word}'")
        
        # Ambiguity
        if len(query.split()) < 5:
            uncertainties.append("Query is brief - may lack context")
        
        return uncertainties
    
    def _generate_summary(self, query: str, claims: list[Claim]) -> str:
        """Generate one-line summary."""
        if claims:
            return claims[0].statement[:100]
        return query[:100]
    
    def _generate_detailed(self, query: str, claims: list[Claim], context: str | None) -> str:
        """Generate detailed answer."""
        parts = [f"## Analysis: {query[:80]}"]
        
        if context:
            parts.append(f"\nContext: {context[:200]}")
        
        parts.append("\n### Claims:")
        for i, claim in enumerate(claims, 1):
            parts.append(f"{i}. {claim.statement} (confidence: {claim.confidence:.0%})")
        
        return "\n".join(parts)
    
    def _suggest_actions(self, query: str, claims: list[Claim]) -> list[str]:
        """Suggest actions based on reasoning."""
        actions = []
        
        if "improve" in query.lower() or "fix" in query.lower():
            actions.append("Assess current state before making changes")
            actions.append("Identify specific improvement metrics")
        
        if "analyze" in query.lower():
            actions.append("Gather relevant data sources")
            actions.append("Define analysis boundaries")
        
        if not actions:
            actions.append("Clarify objective if needed")
            actions.append("Proceed with available information")
        
        return actions
    
    def _generate_alternatives(self, query: str) -> list[str]:
        """Generate alternative perspectives."""
        alternatives = []
        
        if "should" in query.lower():
            alternatives.append("Alternative: Consider what should NOT be done")
        
        if "best" in query.lower():
            alternatives.append("Alternative: 'Best' depends on criteria - what are they?")
        
        return alternatives
    
    def _render_recommended(self, basis: AnswerBasis, mode: str) -> str:
        """Generate recommended render format."""
        lines = [
            f"## {basis.summary}",
            "",
            basis.detailed_answer,
            "",
        ]
        
        if basis.key_findings:
            lines.append("### Key Findings:")
            for finding in basis.key_findings:
                lines.append(f"- {finding}")
            lines.append("")
        
        if basis.recommended_actions:
            lines.append("### Recommended Actions:")
            for action in basis.recommended_actions:
                lines.append(f"1. {action}")
            lines.append("")
        
        if basis.uncertainties:
            lines.append("### ⚠️ Uncertainties:")
            for unc in basis.uncertainties:
                lines.append(f"- {unc}")
            lines.append("")
        
        return "\n".join(lines)


# Singleton
_mind_engine = MindEngine()


async def mind_reason(**kwargs) -> MindResult:
    """Convenience function."""
    return await _mind_engine.reason(**kwargs)
