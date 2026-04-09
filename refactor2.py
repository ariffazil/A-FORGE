import re
import sys

with open("/root/arifOS/arifosmcp/runtime/tools.py", "r") as f:
    content = f.read()

def refactor_tool(tool_name, stage_str, description):
    global content
    pattern = rf'async def {tool_name}\(.*?\) -> RuntimeEnvelope:.*?return result'
    
    new_func = f"""async def {tool_name}(
    mode: str,
    payload: dict[str, Any],
    session_id: Optional[str] = None,
    risk_tier: str = "medium",
    dry_run: bool = True,
) -> RuntimeEnvelope:
    \"\"\"
    {description}
    Refactored to Unified Intelligence Envelope (Internal Richness -> External Compression).
    \"\"\"
    from arifosmcp.runtime.models import RuntimeEnvelope, RuntimeStatus, Verdict
    from arifosmcp.runtime.envelope import run_agi_mind
    
    # Extract input
    raw_input = str(payload)
    
    # Run the new Unified Intelligence Pipeline
    envelope = run_agi_mind(raw_input)
    
    status_map = {{
        "OK": RuntimeStatus.SUCCESS,
        "PARTIAL": RuntimeStatus.SABAR,
        "HOLD": RuntimeStatus.ERROR,
        "ERROR": RuntimeStatus.ERROR
    }}
    
    verdict_map = {{
        "OK": Verdict.SEAL,
        "PARTIAL": Verdict.SABAR,
        "HOLD": Verdict.VOID,
        "ERROR": Verdict.VOID
    }}
    
    return RuntimeEnvelope(
        tool="{tool_name.replace('_v2', '')}",
        stage="{stage_str}",
        status=status_map.get(envelope.status, RuntimeStatus.SUCCESS),
        verdict=verdict_map.get(envelope.status, Verdict.SEAL),
        session_id=session_id,
        payload=envelope.model_dump()
    )"""
    
    content = re.sub(pattern, new_func, content, flags=re.DOTALL)

refactor_tool("sense_v2", "111_SENSE", "arifos.sense — Reality Grounding with ToM.")
refactor_tool("heart_v2", "666_HEART", "arifos.heart — Safety and Human Modeling with ToM.")
refactor_tool("judge_v2", "888_JUDGE", "arifos.judge — Constitutional Validation with ToM.")
refactor_tool("forge_v2", "999_FORGE", "arifos.forge — Execution Drafting with ToM.")
refactor_tool("vault_v2", "VAULT_LEDGER", "arifos.vault — Audit and Seal with ToM.")
refactor_tool("memory_v2", "555_MEMORY", "arifos.memory — Engineering Memory with ToM.")
refactor_tool("ops_v2", "MATH_ESTIMATOR", "arifos.ops — Mathematics and Operations with ToM.")
refactor_tool("init_v2", "000_INIT", "arifos.init — System Initialization with ToM.")
refactor_tool("route_v2", "ROUTER", "arifos.route — Task Routing with ToM.")

with open("/root/arifOS/arifosmcp/runtime/tools.py", "w") as f:
    f.write(content)

print("Refactored all tools in tools.py to unified intelligence.")
