#!/usr/bin/env bash
# arifOS MCP launcher — repomapper (L2: structural map, tree-sitter + PageRank)
# Sovereign self-host: source at /root/.arifos/agents/forge/RepoMapper
# Isolated venv at /root/venvs/repomapper (per python-tool-isolation)
# Read-only by design: this tool emits a repo map, never writes to target.
set -euo pipefail
exec /root/venvs/repomapper/bin/python /root/.arifos/agents/forge/RepoMapper/repomap_server.py
