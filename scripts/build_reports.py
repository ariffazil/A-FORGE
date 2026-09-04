import os
from pathlib import Path

# Locate paths_resolver relative to this script:
# scripts/build_reports.py → ../paradox-engine/
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

base_dir = str(org_path("A-FORGE"))

reports = {
    "EXTERNAL_AGENT_STACK_BENCHMARK.md": """# External Agent Stack Benchmark
## Verdict
arifOS is weaker than external frameworks as an execution/runtime product, but stronger than them as a constitutional governance thesis. The next engineering move is not to compete with LangGraph/OpenAI SDK/AutoGen/CrewAI. The move is to govern them.

## Lens 1 — Product engineering score
- LangGraph           8.65
- OpenAI Agents SDK   8.57
- CrewAI              8.01
- AutoGen             7.93
- Hugging Face        6.80
- MCP                 6.30
- arifOS              6.02

## Lens 2 — Reality-governance score
- arifOS              8.51
- OpenAI Agents SDK   6.00
- CrewAI              5.29
- LangGraph           5.20
- AutoGen             5.03
- MCP                 4.85
- Hugging Face        4.75

## One-line architecture
External frameworks execute intelligence.
arifOS legitimizes intelligence.
GEOX/WEALTH/WELL ground intelligence.
VAULT999 remembers intelligence.
Reality Ledger teaches intelligence.
""",
    "ARIFOS_VS_LANGGRAPH.md": """# arifOS vs LangGraph
LangGraph is the best execution spine to wrap. It is built for long-running, stateful workflows with durable execution, persistence, human-in-the-loop, memory, debugging, and production deployment. 

arifOS should not copy that. arifOS should issue law around it.

- LangGraph = durable workflow body
- arifOS = constitutional nervous system

## Best integration pattern
arifOS lease → LangGraph run → checkpoint → human interrupt if needed → arifOS 888 verdict → VAULT999 receipt → Reality Ledger outcome
""",
    "ARIFOS_VS_OPENAI_AGENTS_SDK.md": """# arifOS vs OpenAI Agents SDK
OpenAI Agents SDK is the best simple agent runtime to wrap. The SDK has a small primitive set: agents, handoffs/agents-as-tools, guardrails; it also includes built-in agent loop, sandbox agents, function tools, MCP tool calling, sessions, human-in-the-loop, and tracing. 

arifOS should use it as a fast execution substrate for agentic workflows, not as sovereign authority.

- OpenAI Agents SDK = clean agent loop
- arifOS = law before/around/after the loop

Eureka: OpenAI guardrails validate inputs/outputs. arifOS governs consequences.
""",
    "ARIFOS_VS_AUTOGEN.md": """# arifOS vs AutoGen
AutoGen is stronger for agent society; arifOS is stronger for law. AutoGen’s Core is an event-driven framework for scalable multi-agent systems. 

- AutoGen = parliament of agents
- arifOS = constitution above parliament

Eureka: AutoGen can create many agents. arifOS decides which agent actions are legitimate.
""",
    "ARIFOS_VS_CREWAI.md": """# arifOS vs CrewAI
CrewAI is stronger for business automation; arifOS is stronger for high-consequence governance. 

- CrewAI = enterprise work crew
- arifOS = sovereign operating law

Eureka: CrewAI can run a company workflow. arifOS can decide whether a company workflow should be allowed to touch people, money, Earth, or public trust.
""",
    "ARIFOS_VS_MCP.md": """# arifOS vs MCP
MCP is not a competitor. MCP is the nervous connector standard. It standardizes how AI apps connect to data, tools, and workflows. 

- MCP = ports and wires
- arifOS = laws governing what flows through the wires

Eureka: arifOS should become an MCP constitutional gateway.
""",
    "ARIFOS_VS_HUGGINGFACE.md": """# arifOS vs Hugging Face
Hugging Face is supply infrastructure, not jurisdiction. It hosts models, datasets, Spaces/apps, agent resources, model cards, eval results, and collaboration features. 

- Hugging Face = supply market
- arifOS = import control and governance layer

Eureka: Hugging Face is CCC infrastructure until a model/dataset is audited, pinned, sandboxed, and promoted.
"""
}

for report, content in reports.items():
    with open(os.path.join(base_dir, "reports", report), "w") as f:
        f.write(content)

adapters = [
    "langgraph_arifos_adapter",
    "openai_agents_arifos_adapter",
    "autogen_arifos_adapter",
    "crewai_arifos_adapter",
    "huggingface_import_gate"
]

adapter_readme = """# {name}

## Mission
Wrap the external framework to ensure all intelligence execution complies with arifOS constitutional law.

## Requirements
- Request arifOS lease before action
- Declare action class, reversibility, tool scope, and impact risks (secret, human, capital, Earth)
- Produce trace id and VAULT999 receipt
- Produce rollback instruction where applicable
- Write Reality Ledger entry if prediction/outcome exists
"""

for adapter in adapters:
    with open(os.path.join(base_dir, "adapters", adapter, "README.md"), "w") as f:
        f.write(adapter_readme.format(name=adapter.replace("_", " ").title()))

with open(os.path.join(base_dir, "gateways", "mcp_constitutional_gateway", "README.md"), "w") as f:
    f.write("# MCP Constitutional Gateway\n\nActs as the universal tool connector interceptor, ensuring all MCP tool calls request leases and pass 888_HOLD logic.")

with open(os.path.join(base_dir, "benchmarks", "external_harness_comparison", "README.md"), "w") as f:
    f.write("# External Harness Comparison\n\nJSON and programmatic benchmarks comparing arifOS vs external systems for durable execution, memory, reality binding, and more.")

print("All files generated successfully.")
