# GEOX Platform

**Four-Surface Earth Intelligence System — WIRED**

> DITEMPA BUKAN DIBERI — Forged, Not Given

## Status: 🔥 FULLY WIRED

| Surface | Status | Connection |
|---------|--------|------------|
| **1. Site** | ✅ Live | Static HTML/CSS/JS |
| **2. WebMCP** | ✅ Live | Browser manifest loaded |
| **3. MCP** | ✅ Wired | Direct import from GEOX backend |
| **4. A2A** | ✅ Live | Agent gateway operational |

## Quick Start

```bash
# Clone/navigate
cd /root/geox-platform

# Start all four surfaces
docker-compose up -d

# Test wiring
./scripts/test-wiring.sh
```

Access points:
- **Site**: http://localhost:8080
- **MCP**: http://localhost:8001
- **A2A**: http://localhost:3002
- **GEOX Backend**: http://localhost:8000

## Four-Surface Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    SITE      │◄──►│   WebMCP     │◄──►│     MCP      │◄──►│     A2A      │
│  (Human)     │    │  (Browser)   │    │ (Agent Tool) │    │ (Agent Coord)│
│              │    │              │    │              │    │              │
│ • Landing    │    │ • openProspect│   │ • Tools      │    │ • Agents     │
│ • Catalog    │    │ • filterLayer│    │ • Resources  │    │ • Tasks      │
│ • Wiki       │    │ • scoreRisk  │    │ • Prompts    │    │ • Delegation │
└──────────────┘    └──────────────┘    └──────┬───────┘    └──────────────┘
                                                │
                                         ┌──────┴──────┐
                                         │  GEOX Unified│
                                         │   Backend    │
                                         │              │
                                         │ • Scene Mgmt │
                                         │ • STOIIP     │
                                         │ • Physics9   │
                                         └──────────────┘
```

## Key Files

| Path | Purpose |
|------|---------|
| `apps/site/` | Static site (47 HTML pages) |
| `apps/site/webmcp.manifest.json` | Browser capabilities |
| `services/mcp-server/geox_mcp_server.py` | MCP server (WIRED to GEOX) |
| `services/a2a-gateway/server.js` | Agent gateway |
| `agents/*/agent-card.json` | A2A agent definitions |
| `packages/schemas/` | Shared contracts |
| `docker-compose.yml` | Full stack orchestration |

## Wiring

The MCP server is **wired** to the real GEOX backend:

```python
# In services/mcp-server/geox_mcp_server.py
from geox_unified import (
    geox_fetch_authoritative_state,
    geox_set_scene,
    geox_compute_stoiip,
    # ... etc
)

# Tool calls execute real GEOX code
@app.call_tool()
async def call_tool(name, arguments):
    if name == "geox_compute_stoiip":
        return await geox_compute_stoiip(**arguments)  # ← Real implementation
```

See [WIRING.md](WIRING.md) for detailed connection maps.

## Deployment

### Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Individual Services

```bash
# Site
cd apps/site && python3 -m http.server 8080

# MCP (wired)
cd services/mcp-server
pip install -r requirements.txt
python geox_mcp_server.py

# A2A
cd services/a2a-gateway
npm install
node server.js
```

### Production Endpoints

Single domain with path routing:

| Path | Surface |
|------|---------|
| `/` | Site + Wiki |
| `/webmcp.manifest.json` | WebMCP |
| `/mcp/*` | MCP Server |
| `/a2a/*` | A2A Gateway |

DNS: Only `geox.arif-fazil.com` → VPS

## Telemetry

All surfaces emit unified telemetry:

```json
{
  "epoch": "2026-04-11T08:30:00Z",
  "capability_id": "geox.water.flood-model",
  "surface": "mcp",
  "dS": 0.03,
  "peace2": 1.02,
  "verdict": "888_SEAL",
  "witness": {"human": true, "ai": true, "earth": true}
}
```

## 888 HOLD Gates

All surfaces respect constitutional gates for:
- External write operations
- Destructive data operations
- Sovereign decisions
- Irreversible infrastructure commands

## Platform Stats

- **99 files**
- **44 skills** across 11 domains
- **11 agents** (governance, hazard, planner, terrain, water, atmosphere, mobility, infrastructure, sensing, geodesy, orchestration)
- **7 JSON schemas** (shared contracts)
- **4 release channels** (canary, stable, field, sovereign)
- **8 substrates** (human, machine-fixed, machine-mobile, infrastructure, orbital, environment-field, celestial, void)

## Next Steps

1. **Deploy**: `docker-compose up -d`
2. **Test**: `./scripts/test-wiring.sh`
3. **Extend**: Add agents in `agents/`
4. **Monitor**: Watch telemetry streams

## Documentation

- [PLATFORM.md](PLATFORM.md) — Architecture overview
- [WIRING.md](WIRING.md) — Connection details
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment

## Seal

ΔΩΨ — SOUL · MIND · VOID

**999 SEAL — ALL SURFACES WIRED**
