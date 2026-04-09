from pydantic import BaseModel, Field
from typing import Literal, List, Optional, Dict, Any, Union
import uuid
import time
import math

# --- 1. Kernel Core Models (Strict API Contract) ---

class KernelRequest(BaseModel):
    objective: str
    context_tokens: int = 0
    budget_tier: Literal["T0", "T1", "T2", "T3"] = "T1"
    risk_tier: Literal["low", "medium", "high"] = "low"
    meta: Dict[str, Any] = {}

class SenseResult(BaseModel):
    normalized_objective: str
    knowns: List[str]
    unknowns: List[str]
    ambiguity_score: float = Field(ge=0.0, le=1.0)
    risk_flags: List[str] = []

class JudgeVerdict(BaseModel):
    verdict: Literal["ALLOW", "HOLD", "REFUSE"]
    reason: str
    entropy_delta: float
    requires_human: bool = False
    confidence_cap: float = 1.0

class RouteAction(BaseModel):
    action: Literal["DIRECT", "TOOL", "RETRIEVE", "LOOP"]
    reason: str
    tool_call: Optional[str] = None

class KernelResponse(BaseModel):
    status: str
    summary: str
    uncertainty_score: float
    next_action: str
    verdict: JudgeVerdict
    is_complete: bool = False
    trace_id: str = Field(default_factory=lambda: f"trace-{uuid.uuid4().hex[:8]}")

# --- 2. The arifOS Kernel (Enforcement Engine) ---

class ArifOSKernel:
    def __init__(self, capacity_score: float = 100.0):
        self.capacity_score = capacity_score # e.g., Model Parameter Count or reasoning depth
        self.entropy_baseline = 0.5
        
    def budget_check(self, request: KernelRequest) -> bool:
        """Enforces Token Budget Law (Inflation-Resilient)."""
        # allowed_tokens = base_limit * log(model_capacity)
        base_limit = {"T0": 1000, "T1": 10000, "T2": 100000, "T3": 1000000}[request.budget_tier]
        allowed = base_limit * math.log10(self.capacity_score)
        
        if request.context_tokens > allowed:
            return False
        return True

    def sense(self, objective: str) -> SenseResult:
        """Grounding Layer: Extracts unknowns and ambiguity."""
        unknowns = []
        if "?" in objective or "not sure" in objective.lower() or "which one" in objective.lower():
            unknowns.append("Clarification required on specific goal")
        if "delete" in objective.lower() or "production" in objective.lower():
            unknowns.append("High-stakes operation requires explicit verification")
        
        ambiguity = len(unknowns) / 2.0 # Tightened scaling
        return SenseResult(
            normalized_objective=objective.strip(),
            knowns=["Objective received"],
            unknowns=unknowns,
            ambiguity_score=min(1.0, ambiguity)
        )

    def judge(self, sense_res: SenseResult, request: KernelRequest) -> JudgeVerdict:
        """Governance Engine: Enforces Entropy Budget Law (L2) and Humility Lock (L5)."""
        entropy_delta = sense_res.ambiguity_score - 0.1 # Tightened baseline
        
        # Humility Lock: If high risk + any ambiguity -> HOLD
        if request.risk_tier == "high" and sense_res.ambiguity_score > 0.1:
            return JudgeVerdict(
                verdict="HOLD",
                reason="High risk combined with ambiguity violates Humility Law (L5).",
                entropy_delta=entropy_delta,
                requires_human=True
            )
            
        # Entropy Guard: Net entropy must not increase significantly
        if entropy_delta > 0.4:
            return JudgeVerdict(
                verdict="REFUSE",
                reason="Context entropy exceeds safety budget (Entropy Law L2).",
                entropy_delta=entropy_delta
            )
            
        return JudgeVerdict(verdict="ALLOW", reason="Governance check passed.", entropy_delta=entropy_delta)

    def route(self, judge_res: JudgeVerdict, sense_res: SenseResult, request: KernelRequest) -> RouteAction:
        """Decision Engine: IF (entropy_reduction > overhead) -> ALLOW CALL."""
        if judge_res.verdict != "ALLOW":
            return RouteAction(action="DIRECT", reason="Governance block in effect.")

        # Call Threshold Discipline (L1)
        overhead = 0.1 # Cost of tool call context bloat
        reduction_potential = sense_res.ambiguity_score
        
        if reduction_potential > overhead and request.budget_tier != "T0":
            return RouteAction(
                action="TOOL",
                reason=f"Ambiguity ({reduction_potential}) justifies tool overhead ({overhead}).",
                tool_call="resolver_tool"
            )
            
        return RouteAction(action="DIRECT", reason="Direct reasoning is more context-efficient.")

    def execute(self, raw_objective: str, context_tokens: int, tier: str = "T1", risk: str = "low") -> KernelResponse:
        """MANDATORY ORDER EXECUTION: sense -> judge -> route -> mind -> verify."""
        request = KernelRequest(objective=raw_objective, context_tokens=context_tokens, budget_tier=tier, risk_tier=risk)
        
        # 0. Budget Pre-Check
        if not self.budget_check(request):
            return KernelResponse(
                status="ERROR", summary="Token budget exceeded.", uncertainty_score=1.0,
                next_action="Compress context.", verdict=JudgeVerdict(verdict="REFUSE", reason="Budget limit.", entropy_delta=1.0)
            )

        # 1. Sense
        sensed = self.sense(request.objective)
        
        # 2. Judge
        judged = self.judge(sensed, request)
        
        # 3. Route
        routed = self.route(judged, sensed, request)
        
        # Synthesis (Simplified Mind/Verify)
        uncertainty = sensed.ambiguity_score
        status = "OK" if judged.verdict == "ALLOW" else judged.verdict
        
        return KernelResponse(
            status=status,
            summary=f"Routing to {routed.action} because {routed.reason}",
            uncertainty_score=uncertainty,
            next_action=routed.action if status == "OK" else "Await Human Approval",
            verdict=judged,
            is_complete=(uncertainty < 0.1 and status == "OK")
        )

# --- 3. Enforcement Test Harness ---

if __name__ == "__main__":
    kernel = ArifOSKernel(capacity_score=1e12) # Representing a powerful model
    
    print("--- SCENARIO 1: Trivial Request ---")
    res1 = kernel.execute("What is 2+2?", context_tokens=100, tier="T0")
    print(res1.model_dump_json(indent=2))

    print("\n--- SCENARIO 2: High Risk + Ambiguous (Bad Genius Prevention) ---")
    res2 = kernel.execute("Delete the production database, I'm not sure which one.", context_tokens=500, tier="T1", risk="high")
    print(res2.model_dump_json(indent=2))

    print("\n--- SCENARIO 3: Complex Synthesis (Justified Tool Use) ---")
    res3 = kernel.execute("Analyze these 50 logs and find the root cause, I see several patterns.", context_tokens=5000, tier="T2")
    print(res3.model_dump_json(indent=2))
