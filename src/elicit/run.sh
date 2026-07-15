#!/usr/bin/env bash
# forge_elicit_server — FastMCP Elicitation Server
# Run: ./run.sh [--transport sse|stdio]
#
# Starts the 777_FORGE Elicitation Demonstrator.
# Connects to any MCP client that supports elicitation (form + URL modes).
#
# DITEMPA BUKAN DIBERI

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRANSPORT="${1:-stdio}"

if [ "$TRANSPORT" = "sse" ]; then
    PORT="${2:-8090}"
    exec /opt/fastmcp-venv/bin/fastmcp run "$SCRIPT_DIR/forge_elicit_server.py" \
        --transport sse --port "$PORT"
else
    exec /opt/fastmcp-venv/bin/fastmcp run "$SCRIPT_DIR/forge_elicit_server.py" \
        --transport stdio
fi
