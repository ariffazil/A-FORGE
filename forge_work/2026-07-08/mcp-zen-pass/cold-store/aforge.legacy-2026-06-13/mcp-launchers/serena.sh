#!/usr/bin/env bash
# arifOS MCP launcher — serena (L3: symbol-level semantic retrieval)
# Read-only via --mode no-memories (canonical oraios/serena mode, disables memory writes)
# Write tools (create_text_file, replace_content) are still loaded by Serena by default
# but the repo-eureka policy forbids invoking them; arifOS 888_JUDGE catches any violation.
# Sovereign: serena-agent v1.5.3 via uvx (lazy install on first run).
# Falls back to: ripgrep + read_file if serena fails (handled in repo-eureka skill).
set -euo pipefail
exec uvx --from serena-agent serena start-mcp-server --mode no-memories
