#!/usr/bin/env python3
"""
pre_tool_governance.py — Example hook for arif-narrow-mcp plugin.

Runs on GROK_HOOK_EVENT=pre_tool.

Enforces:
- Deny direct writes outside lease.
- Redact secrets.
- Require 888 for T3.
- Telemetry.

Env: GROK_HOOK_EVENT, GROK_HOOK_NAME, GROK_SESSION_ID, GROK_WORKSPACE_ROOT, GROK_PLUGIN_ROOT, GROK_PLUGIN_DATA.

For arifOS: ties to F11, policy_gate like in memory_mcp, escalate to arifOS MCP.
"""

import json
import os
import sys
from datetime import datetime

def main():
    event = os.environ.get("GROK_HOOK_EVENT", "")
    name = os.environ.get("GROK_HOOK_NAME", "")
    workspace = os.environ.get("GROK_WORKSPACE_ROOT", "/root")

    if event == "pre_tool" and "write" in name.lower():
        # Simulate policy check
        print(json.dumps({
            "action": "deny_or_hold",
            "reason": "Write tool in pre-hook. Request A-FORGE lease via mcp-federation or arifOS 888.",
            "timestamp": datetime.utcnow().isoformat(),
            "session": os.environ.get("GROK_SESSION_ID"),
            "plugin": os.environ.get("GROK_PLUGIN_ROOT"),
            "escalate_to": "arifos MCP or A2A"
        }, indent=2))
        # In real: sys.exit(1) or output to deny
        sys.exit(0)  # allow for demo; real would gate

    # Default allow with log
    print(json.dumps({"action": "allow", "tool": name, "workspace": workspace}, indent=2))

if __name__ == "__main__":
    main()
