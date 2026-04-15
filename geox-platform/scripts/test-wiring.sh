#!/bin/bash
# GEOX Platform Wiring Test

echo "═══════════════════════════════════════════════════════════"
echo "GEOX Platform Wiring Test"
echo "═══════════════════════════════════════════════════════════"

# Test endpoints
echo ""
echo "Testing services..."

curl -s http://localhost:8080/health 2>/dev/null || echo "Site: http://localhost:8080"
curl -s http://localhost:8000/health 2>/dev/null || echo "GEOX Backend: http://localhost:8000"
curl -s http://localhost:8001/health 2>/dev/null || echo "MCP: http://localhost:8001"
curl -s http://localhost:3002/health 2>/dev/null || echo "A2A: http://localhost:3002"

echo ""
echo "Test complete."
