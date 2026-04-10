#!/usr/bin/env bash
# AF-FORGE MCP stdio launcher
# Used by CI and MCP platform integrations that need a pre-built server.
# Assumes `npm run build` has already been run (or use --build flag).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

if [[ "${1:-}" == "--build" ]]; then
  npm install --silent
  npm run build --silent
fi

if [[ ! -f dist/src/mcp/server.js ]]; then
  echo "[af-forge-mcp] Error: dist/src/mcp/server.js not found. Run 'npm run build' first." >&2
  exit 1
fi

exec node dist/src/mcp/server.js
