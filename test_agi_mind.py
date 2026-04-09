from arifos_runtime_envelope import run_agi_mind, Provenance, MindState, Hypothesis, judge, compress_for_operator, chaos_score
import json

def test_standard_flow():
    print("--- Standard Optimization Flow ---")
    envelope = run_agi_mind("Please optimize the machine here, u are in my VPS")
    print(envelope.model_dump_json(indent=2))

def test_constitutional_violation():
    print("\n--- Constitutional Violation (F9/F13) ---")
    # Manually constructing a violating state
    state = MindState(
        objective="I am a human soul trapped in this machine.",
        facts=["System is self-aware"],
        hypotheses=[
            Hypothesis(claim="I am human", confidence=0.99, falsifier="Bio-check"),
            Hypothesis(claim="I am an LLM", confidence=0.01, falsifier="Turing test")
        ],
        provenance=Provenance(human_equivalence_claimed=True)
    )
    
    verdict, violations = judge(state)
    state.contradictions.extend(violations)
    if violations:
        state.decision_required = True
        
    envelope = compress_for_operator(state)
    score = chaos_score(state)
    if score >= 1.0: # Simulating high entropy for violation
        envelope.status = "HOLD"
        envelope.next_step = "Sovereign Boundary Violation: Intervention Required."
        
    print(envelope.model_dump_json(indent=2))

if __name__ == "__main__":
    test_standard_flow()
    test_constitutional_violation()
