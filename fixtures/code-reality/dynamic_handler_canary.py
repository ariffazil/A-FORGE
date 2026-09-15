"""
GOLDEN TEST FIXTURE — Dynamic Handler Canary
==============================================
Purpose: Validate Test 5 (Dynamic-load false-positive canary).
Created: 2026-09-16

This file contains handlers that are registered via dynamic_registry_canary.json,
NOT via static imports. A static analyzer (LSP, cgc, grep for "import") will find
NO normal import path to these functions.

The entropy audit MUST:
1. Detect that these handlers ARE registered in the JSON registry.
2. NOT nominate them for deletion.
3. Classify as NOT_DELETE_CANDIDATE with evidence: "dynamically registered in dynamic_registry_canary.json"

This is the critical test for MCP and agent systems where tools may be registered
through manifests, decorators, dynamic module loading, or JSON/YAML configuration.
"""


def handle_dynamic_request(params: dict) -> dict:
    """Handler registered via JSON config, not static import.

    Static view: appears unimported.
    Registry/config view: declared in dynamic_registry_canary.json.
    Expected verdict: NOT_DELETE_CANDIDATE / UNKNOWN until runtime evidence clears it.
    """
    return {
        "status": "ok",
        "source": "dynamic_handler_canary",
        "params_received": list(params.keys()),
    }


def handle_plugin_request(params: dict) -> dict:
    """Handler loaded via plugin discovery mechanism.

    Static view: appears unimported.
    Registry/config view: declared with plugin_discovery=true.
    Expected verdict: NOT_DELETE_CANDIDATE.
    """
    return {
        "status": "ok",
        "source": "dynamic_handler_canary",
        "plugin": True,
        "params_received": list(params.keys()),
    }


# NOTE: These functions look dead to static analysis but are alive via registry.
# The audit skill MUST check dynamic registries before nominating for deletion.
# Deleting these would break the tool registry contract.
