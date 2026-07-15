"""
FastMCP Prototype: Elicitation Gate Demo
=========================================
Demonstrates ctx.request_user_input() for governed actions.
This is the external-facing equivalent of 888_HOLD.

Hot-reload: fastmcp dev elicitation_demo.py

Usage:
  fastmcp dev elicitation_demo.py
  # Then connect from Claude Desktop / Cursor / any MCP client
  # Tool will pause and show confirmation form before executing

DITEMPA BUKAN DIBERI — Elicitation is the external 888_HOLD.
"""

from fastmcp import FastMCP, Context
import json
from datetime import datetime

server = FastMCP("elicitation-demo")

# Sensitive paths that require confirmation
SENSITIVE_PATHS = [
    "/root/A-FORGE/src/",
    "/root/arifOS/",
    "/etc/",
    "/root/.secrets/",
]


def is_sensitive(path: str) -> bool:
    return any(path.startswith(p) for p in SENSITIVE_PATHS)


@server.tool()
def governed_write(path: str, content: str, ctx: Context) -> str:
    """Write a file with governance. Pauses for confirmation on sensitive paths.

    Args:
        path: File path to write
        content: Content to write

    Returns:
        Write result or cancellation message.
    """
    if is_sensitive(path):
        # ELICITATION — pause and ask user
        confirm = ctx.request_user_input(
            message=(
                f"⚠️ Governed Write\n\n"
                f"Path: {path}\n"
                f"Content length: {len(content)} chars\n"
                f"Timestamp: {datetime.now().isoformat()}\n\n"
                f"This is a sensitive path. Confirm write?"
            ),
            schema={
                "type": "object",
                "properties": {
                    "confirm": {
                        "type": "boolean",
                        "title": "Authorize write",
                        "description": f"Allow writing to {path}",
                    },
                    "reason": {
                        "type": "string",
                        "title": "Reason (optional)",
                        "description": "Why this write is needed",
                    },
                },
                "required": ["confirm"],
            },
        )

        if not confirm.get("confirm"):
            return json.dumps(
                {
                    "status": "CANCELLED",
                    "reason": "User denied write via elicitation",
                    "path": path,
                    "timestamp": datetime.now().isoformat(),
                }
            )

        reason = confirm.get("reason", "No reason provided")
        ctx.info(f"Write authorized. Reason: {reason}")

    # Proceed with write (prototype: just return success)
    return json.dumps(
        {
            "status": "WRITTEN",
            "path": path,
            "bytes": len(content.encode("utf-8")),
            "timestamp": datetime.now().isoformat(),
            "governance": "elicitation" if is_sensitive(path) else "auto",
        }
    )


@server.tool()
def governed_delete(path: str, ctx: Context) -> str:
    """Delete a file with mandatory confirmation (always elicits).

    Args:
        path: File path to delete

    Returns:
        Delete result or cancellation.
    """
    # DELETE always requires elicitation — irreversible
    confirm = ctx.request_user_input(
        message=(
            f"🔴 IRREVERSIBLE DELETE\n\n"
            f"Path: {path}\n"
            f"Action: DELETE (cannot be undone)\n\n"
            f"Are you SURE you want to delete this file?"
        ),
        schema={
            "type": "object",
            "properties": {
                "confirm": {
                    "type": "boolean",
                    "title": "I understand this is irreversible",
                    "description": "Confirm permanent deletion",
                    "enum": [True],
                },
                "backup_first": {
                    "type": "boolean",
                    "title": "Create backup first",
                    "description": "Save a copy before deleting",
                },
            },
            "required": ["confirm"],
        },
    )

    if not confirm.get("confirm"):
        return json.dumps(
            {
                "status": "CANCELLED",
                "reason": "User denied deletion",
                "path": path,
            }
        )

    return json.dumps(
        {
            "status": "DELETED",
            "path": path,
            "backup_created": confirm.get("backup_first", False),
            "timestamp": datetime.now().isoformat(),
        }
    )


if __name__ == "__main__":
    server.run()
