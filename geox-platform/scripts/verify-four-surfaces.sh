#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GEOX Four-Surface Verification Script
# Tests all surfaces after deployment
# ═══════════════════════════════════════════════════════════════════════════════

set -e

BASE_URL="${GEOX_URL:-https://geox.arif-fazil.com}"

echo "═══════════════════════════════════════════════════════════"
echo "GEOX Four-Surface Verification"
echo "Testing: $BASE_URL"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_surface() {
    local name=$1
    local path=$2
    local expect_code=${3:-200}
    local expect_content=$4
    
    echo -n "Testing $name ($path)... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" 2>/dev/null || echo "000")
    
    if [ "$response" -eq "$expect_code" ]; then
        echo -e "${GREEN}✓ OK ($response)${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL ($response, expected $expect_code)${NC}"
        return 1
    fi
}

test_json() {
    local name=$1
    local path=$2
    
    echo -n "Testing $name JSON validity... "
    
    if curl -s "$BASE_URL$path" 2>/dev/null | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid JSON${NC}"
        return 0
    else
        echo -e "${RED}✗ Invalid JSON${NC}"
        return 1
    fi
}

# ─── SURFACE 1: Site ───
echo "📦 SURFACE 1: Site (Static)"
test_surface "Landing page" "/" 200
test_surface "Catalog" "/catalog.html" 200
test_surface "Wiki" "/wiki.html" 200
test_surface "Network map" "/network.html" 200
echo ""

# ─── SURFACE 2: WebMCP ───
echo "📦 SURFACE 2: WebMCP (Browser-Native)"
test_surface "WebMCP manifest" "/webmcp.manifest.json" 200
test_json "WebMCP manifest" "/webmcp.manifest.json"
echo ""

# ─── SURFACE 3: MCP ───
echo "📦 SURFACE 3: MCP (Agent-to-Tool)"
test_surface "MCP canonical redirect" "/mcp" 308
test_surface "MCP endpoint" "/mcp/" 200
test_surface "MCP health" "/mcp/health" 200
test_json "MCP health" "/mcp/health"
echo ""

# ─── SURFACE 4: A2A ───
echo "📦 SURFACE 4: A2A (Agent-to-Agent)"
test_surface "A2A canonical redirect" "/a2a" 308
test_surface "A2A gateway" "/a2a/" 200
test_surface "A2A health" "/a2a/health" 200
test_surface "A2A agents list" "/a2a/agents" 200
test_json "A2A health" "/a2a/health"
echo ""

# ─── Summary ───
echo "═══════════════════════════════════════════════════════════"
echo "Verification Complete"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Four-Surface Status:"
echo "  1. Site      /        - Static HTML/CSS/JS"
echo "  2. WebMCP   /webmcp.manifest.json - Browser capabilities"
echo "  3. MCP      /mcp/    - Model Context Protocol"
echo "  4. A2A      /a2a/    - Agent-to-Agent coordination"
echo ""
echo "DITEMPA BUKAN DIBERI — 999 SEAL"
