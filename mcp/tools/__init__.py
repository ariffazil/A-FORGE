"""
APA MCP Tools — Autonomous Protocol for Applications.

Each tool wraps an APA connector:
  forge_email    → email_bridge.py    (:18093)
  forge_calendar → calendar_bridge.py (:18094) 
  forge_github   → github_bridge.py   (:18095)

Pattern:
  MCP tool → lease check → F1-F13 gate → bridge dispatch → VAULT999 receipt
"""

from .forge_email import get_tool_definition as email_tool, execute as email_execute, get_verb_classes as email_verbs
from .forge_calendar import get_tool_definition as calendar_tool, execute as calendar_execute, get_verb_classes as calendar_verbs
from .forge_github import get_tool_definition as github_tool, execute as github_execute, get_verb_classes as github_verbs

APA_TOOLS = {
    "forge_email":    {"def": email_tool(),    "execute": email_execute,    "verbs": email_verbs()},
    "forge_calendar": {"def": calendar_tool(), "execute": calendar_execute, "verbs": calendar_verbs()},
    "forge_github":   {"def": github_tool(),   "execute": github_execute,   "verbs": github_verbs()},
}

def get_all_tools():
    return [t["def"] for t in APA_TOOLS.values()]

def execute_tool(name: str, params: dict):
    tool = APA_TOOLS.get(name)
    if not tool:
        return {"ok": False, "error": f"Unknown APA tool: {name}"}
    return tool["execute"](params)
