import re

with open("/root/arifOS/arifosmcp/runtime/tools.py", "r") as f:
    content = f.read()

# I want to refactor mind_v2 to use the new pipeline.
# First, import the envelope module at the top
if "from arifosmcp.runtime.envelope import" not in content:
    content = content.replace("import logging\n", "import logging\nfrom arifosmcp.runtime.envelope import run_agi_mind, MindState, OutputEnvelope, Provenance\n")

# Replace mind_v2 implementation with one that uses the unified intelligence pipeline
new_mind_v2 = """async def mind_v2(
    mode: str,
    payload: dict[str, Any],
    session_id: Optional[str] = None,
    risk_tier: str = "medium",
    dry_run: bool = True,
) -> RuntimeEnvelope:
    \"\"\"
    arifos.mind — Structured Reasoning with ToM.
    Refactored to Unified Intelligence Envelope (Internal Richness -> External Compression).
    \"\"\"
    from arifosmcp.runtime.models import RuntimeEnvelope, RuntimeStatus, Verdict
    from arifosmcp.runtime.envelope import run_agi_mind
    
    # Extract query/problem
    raw_input = payload.get("problem_statement") or payload.get("query") or str(payload)
    
    # Run the new AGI Mind Pipeline which handles Sense -> Mind -> Heart -> Judge
    # and outputs a compressed OutputEnvelope with mandatory falsifier and chaos score.
    envelope = run_agi_mind(raw_input)
    
    status_map = {
        "OK": RuntimeStatus.SUCCESS,
        "PARTIAL": RuntimeStatus.SABAR,
        "HOLD": RuntimeStatus.ERROR,
        "ERROR": RuntimeStatus.ERROR
    }
    
    verdict_map = {
        "OK": Verdict.SEAL,
        "PARTIAL": Verdict.SABAR,
        "HOLD": Verdict.VOID,
        "ERROR": Verdict.VOID
    }
    
    return RuntimeEnvelope(
        tool="agi_mind",
        stage="333_MIND",
        status=status_map.get(envelope.status, RuntimeStatus.SUCCESS),
        verdict=verdict_map.get(envelope.status, Verdict.SEAL),
        session_id=session_id,
        payload=envelope.model_dump()
    )"""

content = re.sub(r'async def mind_v2\(.*?\)\s*->\s*RuntimeEnvelope:.*?return result', new_mind_v2, content, flags=re.DOTALL)

with open("/root/arifOS/arifosmcp/runtime/tools.py", "w") as f:
    f.write(content)

print("Refactored tools.py successfully.")
