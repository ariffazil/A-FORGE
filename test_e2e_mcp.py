
import asyncio
import json
import os
import sys

# Add arifOS to path
sys.path.insert(0, "/root/arifOS")

from arifosmcp.runtime.server import create_aaa_mcp_server

async def test_e2e_mcp():
    print("--- STARTING E2E MCP TEST ---")
    mcp = create_aaa_mcp_server()
    
    # 1. Test tools/list
    print("\n[1] Listing tools...")
    tools = await mcp.list_tools()
    tool_names = [t.name for t in tools]
    print(f"Exposed Tool Names: {tool_names}")
    
    expected_functional_names = [
        "init_session_anchor",
        "get_tool_registry",
        "sense_reality",
        "reason_synthesis",
        "critique_safety",
        "route_execution",
        "load_memory_context",
        "estimate_ops",
        "judge_verdict",
        "record_vault_entry",
        "execute_vps_task"
    ]
    
    missing = [name for name in expected_functional_names if name not in tool_names]
    if missing:
        print(f"❌ FAILED: Missing functional tools: {missing}")
    else:
        print("✅ SUCCESS: All functional tools exposed.")

    # 2. Test resources/list
    print("\n[2] Listing resources...")
    resources = await mcp.list_resources()
    resource_uris = [str(r.uri) for r in resources]
    print(f"Exposed Resource URIs: {resource_uris}")
    
    expected_uris = [
        "arifos://bootstrap",
        "arifos://governance/floors",
        "arifos://status/vitals",
        "arifos://agents/skills",
        "arifos://vault/recent",
        "ui://arifos/vault-seal-widget.html"
    ]
    
    templates = await mcp.list_resource_templates()
    template_uris = [t.uri_template for t in templates]
    print(f"Exposed Templates: {template_uris}")
    
    all_uris = resource_uris + template_uris
    missing_uris = [u for u in expected_uris if u not in all_uris]
    
    if not missing_uris:
        print("✅ SUCCESS: All functional resources exposed.")
    else:
        print(f"❌ FAILED: Missing resources: {missing_uris}")

    # 3. Test prompts/list
    print("\n[3] Listing prompts...")
    prompts = await mcp.list_prompts()
    prompt_names = [p.name for p in prompts]
    print(f"Exposed Prompts: {prompt_names}")
    
    if "prompt_init_anchor" in prompt_names and "prompt_judge_verdict" in prompt_names:
        print("✅ SUCCESS: Task-based prompts exposed.")
    else:
        print("❌ FAILED: Task-based prompts missing.")

if __name__ == "__main__":
    asyncio.run(test_e2e_mcp())
