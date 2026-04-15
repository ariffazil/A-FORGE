#!/usr/bin/env python3
"""
GEOX MCP Server Test Client
Tests the MCP server tools, prompts, and resources
"""

import json
import subprocess
import sys
import os

TESTS_PASSED = 0
TESTS_FAILED = 0


def test(name, fn):
    global TESTS_PASSED, TESTS_FAILED
    try:
        fn()
        TESTS_PASSED += 1
        print(f"  ✓ {name}")
    except Exception as e:
        TESTS_FAILED += 1
        print(f"  ✗ {name}: {e}")


def assert_json(data, message=""):
    if isinstance(data, str):
        try:
            json.loads(data)
        except json.JSONDecodeError:
            raise AssertionError(f"{message}: Invalid JSON")
    elif not isinstance(data, (dict, list)):
        raise AssertionError(f"{message}: Not a valid JSON structure")


def test_registry_loading():
    """Test that registry loads correctly"""
    registry_path = os.path.join(
        os.path.dirname(__file__), "..", "apps", "site", "registry.json"
    )
    with open(registry_path) as f:
        registry = json.load(f)
    assert "skills" in registry, "Missing skills field"
    assert len(registry["skills"]) == 44, (
        f"Expected 44 skills, got {len(registry['skills'])}"
    )


def test_skill_lookup():
    """Test that individual skills can be looked up"""
    registry_path = os.path.join(
        os.path.dirname(__file__), "..", "apps", "site", "registry.json"
    )
    with open(registry_path) as f:
        registry = json.load(f)

    # Test a few specific skills
    for skill_id in ["flood_model", "constitutional_gate", "coordinate_transform"]:
        assert skill_id in registry["skills"], f"Missing skill: {skill_id}"
        skill = registry["skills"][skill_id]
        assert "domain" in skill, f"Missing domain in {skill_id}"
        assert "mcp_resource" in skill, f"Missing mcp_resource in {skill_id}"


def test_domain_coverage():
    """Test that all 11 domains have skills"""
    registry_path = os.path.join(
        os.path.dirname(__file__), "..", "apps", "site", "registry.json"
    )
    with open(registry_path) as f:
        registry = json.load(f)

    expected_domains = [
        "sensing",
        "geodesy",
        "terrain",
        "water",
        "atmosphere",
        "mobility",
        "infrastructure",
        "hazards",
        "governance",
        "time",
        "orchestration",
    ]

    found_domains = set()
    for skill in registry["skills"].values():
        found_domains.add(skill["domain"])

    for domain in expected_domains:
        assert domain in found_domains, f"Missing domain: {domain}"


def test_skill_dependencies():
    """Test that skill dependencies are valid"""
    registry_path = os.path.join(
        os.path.dirname(__file__), "..", "apps", "site", "registry.json"
    )
    with open(registry_path) as f:
        registry = json.load(f)

    skill_ids = set(registry["skills"].keys())
    for skill_id, skill in registry["skills"].items():
        for dep in skill.get("dependencies", []):
            assert dep in skill_ids, f"Invalid dependency {dep} for skill {skill_id}"


def test_constitutional_gate():
    """Test constitutional gate skill exists and has correct structure"""
    registry_path = os.path.join(
        os.path.dirname(__file__), "..", "apps", "site", "registry.json"
    )
    with open(registry_path) as f:
        registry = json.load(f)

    assert "constitutional_gate" in registry["skills"], "Missing constitutional_gate"
    skill = registry["skills"]["constitutional_gate"]
    assert skill["domain"] == "governance", "Wrong domain for constitutional_gate"
    assert skill["complexity"] == 5, "Constitutional gate should be complexity 5"


def test_mcp_tools_exist():
    """Test that MCP server defines expected tools"""
    mcp_path = os.path.join(
        os.path.dirname(__file__), "..", "services", "mcp-server", "geox_mcp_server.py"
    )
    with open(mcp_path) as f:
        content = f.read()

    expected_tools = [
        "geox_search_skills",
        "geox_get_skill",
        "geox_score_risk",
        "geox_constitutional_gate",
    ]
    for tool in expected_tools:
        assert f'"{tool}"' in content or f"'{tool}'" in content, f"Missing tool: {tool}"


def test_mcp_prompts_exist():
    """Test that MCP server defines expected prompts"""
    mcp_path = os.path.join(
        os.path.dirname(__file__), "..", "services", "mcp-server", "geox_mcp_server.py"
    )
    with open(mcp_path) as f:
        content = f.read()

    expected_prompts = [
        "geox_interpret_prospect",
        "geox_compare_scenarios",
        "geox_issue_verdict",
    ]
    for prompt in expected_prompts:
        assert f'"{prompt}"' in content or f"'{prompt}'" in content, (
            f"Missing prompt: {prompt}"
        )


def test_agent_cards():
    """Test that all 11 agent cards exist and are valid"""
    agents_dir = os.path.join(os.path.dirname(__file__), "..", "agents")
    expected_domains = [
        "governance",
        "hazard",
        "planner",
        "terrain",
        "water",
        "atmosphere",
        "mobility",
        "infrastructure",
        "sensing",
        "geodesy",
        "orchestration",
    ]

    for domain in expected_domains:
        card_path = os.path.join(agents_dir, domain, "agent-card.json")
        assert os.path.exists(card_path), f"Missing agent card: {domain}"
        with open(card_path) as f:
            card = json.load(f)
        assert "name" in card, f"Missing name in {domain} card"
        assert "skills" in card, f"Missing skills in {domain} card"
        assert "_geox" in card, f"Missing _geox in {domain} card"


print("\n╔══════════════════════════════════════════════════════════╗")
print("║  GEOX MCP/Registry Test Suite                          ║")
print("╚══════════════════════════════════════════════════════════╝\n")

print("Testing Registry:")
test("Registry loads correctly", test_registry_loading)
test("Skill lookup works", test_skill_lookup)
test("All 11 domains covered", test_domain_coverage)
test("Dependencies are valid", test_skill_dependencies)
test("Constitutional gate exists", test_constitutional_gate)

print("\nTesting MCP Server:")
test("All 4 tools defined", test_mcp_tools_exist)
test("All 3 prompts defined", test_mcp_prompts_exist)

print("\nTesting Agent Cards:")
test("All 11 agent cards valid", test_agent_cards)

print("\n╔══════════════════════════════════════════════════════════╗")
print(
    f"║  RESULTS: {TESTS_PASSED} passed, {TESTS_FAILED} failed                       ║"
)
print("╚══════════════════════════════════════════════════════════╝\n")

sys.exit(0 if TESTS_FAILED == 0 else 1)
