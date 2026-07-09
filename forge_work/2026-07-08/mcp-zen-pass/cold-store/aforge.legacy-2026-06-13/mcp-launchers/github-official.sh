#!/usr/bin/env bash
# arifOS MCP launcher — github-official (A-FORGE variant)
# Mirrors ~/.claude/mcp-launchers/github-official.sh for A-FORGE agents.
# A-FORGE has higher trust — gets `actions` and `code_security` toolsets by default.
set -euo pipefail
TOKEN="$(gh auth token 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  echo "github-official MCP: gh auth token returned empty — run 'gh auth login'" >&2
  exit 1
fi
export GITHUB_PERSONAL_ACCESS_TOKEN="$TOKEN"
# A-FORGE: extended toolsets (actions + code_security unlocked, users included)
export GITHUB_TOOLSETS="${GITHUB_TOOLSETS:-context,repos,issues,pull_requests,users,actions,code_security}"
exec npx -y @github/github-mcp-server
