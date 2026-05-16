"""
arifOS Gateway — Deployment Entrypoint
This file acts as the primary bridge for cloud deployments (FastMCP/afwell).
It routes the shell to the WELL truth engine.
"""

import sys
import os

# Ensure the root and WELL directories are in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from WELL.server import mcp
except ImportError:
    # Fallback for different deployment layouts
    from server import mcp

if __name__ == "__main__":
    mcp.run()
