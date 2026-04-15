# GEOX Platform Wiring Guide

> How the four surfaces connect and communicate.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  Browser    │  AI Hosts    │  Other Agents                                  │
│  (Human)    │  (Claude/etc)│  (External)                                    │
└──────┬──────┴──────┬───────┴──────┬─────────────────────────────────────────┘
       │             │              │
       ▼             │              ▼
┌─────────────────┐  │    ┌─────────────────┐
│  SURFACE 1      │  │    │  SURFACE 4      │
│  Site           │  │    │  A2A Gateway    │
│  (Static/HTML)  │  │    │  (Node.js)      │
│                 │  │    │                 │
│  ├─ index.html  │  │    │  ├─ Agent Cards │
│  ├─ catalog.html│  │    │  ├─ Task API    │
│  ├─ wiki.html   │  │    │  └─ Delegation  │
│  └─ registry.json│  │    └────────┬────────┘
└──────┬──────────┘  │             │
       │             │             │
       │ WebMCP      │             │ A2A Protocol
       │ Manifest    │             │
       ▼             │             ▼
┌─────────────────┐  │    ┌─────────────────┐
│  SURFACE 2      │  │    │  SURFACE 3      │
│  WebMCP         │  │    │  MCP Server     │
│  (Browser JS)   │  │    │  (Python)       │
│                 │  │    │                 │
│  Capabilities:  │  │    │  ├─ Resources   │
│  ├─ openProspect│  │    │  ├─ Tools       │
│  ├─ filterLayer │  │    │  └─ Prompts     │
│  └─ scoreRisk   │  │    └────────┬────────┘
└─────────────────┘  │             │
                     │             │
                     │             │ Import/Wiring
                     │             ▼
                     │    ┌─────────────────┐
                     │    │  GEOX Unified   │
                     │    │  Backend        │
                     │    │  (FastMCP)      │
                     │    │                 │
                     │    │  ├─ Scene Mgmt  │
                     │    │  ├─ STOIIP Calc │
                     │    │  └─ Physics9    │
                     │    └─────────────────┘
                     │
                     └──────────────────────► Shared Registry (JSON)
```

## Wiring Details

### Surface 1 ↔ Surface 2: Site → WebMCP

The static site loads the WebMCP manifest:

```html
<!-- In site/index.html -->
<script>
// Load WebMCP manifest
fetch('/webmcp.manifest.json')
  .then(r => r.json())
  .then(manifest => {
    // Register capabilities with browser
    window.geoxWebMCP = manifest;
  });

// Call capability
function openProspect(basinId) {
  const cap = window.geoxWebMCP.capabilities.find(c => c.id === 'openProspect');
  // Execute via registered handler
  return geoxHandlers[cap.handler](cap, { basin_id: basinId });
}
</script>
```

### Surface 3 ↔ GEOX Backend: MCP → Unified

The MCP server imports directly from GEOX:

```python
# geox_mcp_server.py
import sys
sys.path.insert(0, '/path/to/GEOX')

from geox_unified import (
    geox_fetch_authoritative_state,
    geox_set_scene,
    geox_compute_stoiip,
    # ... etc
)

# Tool calls are wired directly to GEOX implementations
@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "geox_fetch_authoritative_state":
        return await geox_fetch_authoritative_state()  # ← Direct call
```

### Surface 4 ↔ Surface 3: A2A → MCP

A2A agents delegate to MCP tools:

```javascript
// A2A task handler
async function handleTask(task) {
  const skillId = task.metadata.skill_id;
  
  // Map skill to MCP tool
  const toolMap = {
    'flood_model': 'geox_score_risk',
    'constitutional_gate': 'geox_constitutional_gate'
  };
  
  const toolName = toolMap[skillId];
  
  // Call MCP server
  const result = await callMCPTool(toolName, task.message.parts[0].text);
  
  // Return A2A response
  return {
    id: task.id,
    status: 'completed',
    artifacts: [{ name: 'result', data: JSON.stringify(result) }]
  };
}
```

## Data Flow Examples

### Example 1: User Sets Scene → Computes STOIIP

```
User (Browser)
    │
    │ 1. POST /mcp/tools/geox_set_scene
    ▼
MCP Server (geox-mcp:8001)
    │
    │ 2. Import & call geox_set_scene()
    ▼
GEOX Unified (geox-unified:8000)
    │
    │ 3. Validate physics, store scene
    │ 4. Return 888_PROCEED
    ▼
MCP Server
    │
    │ 5. Return result to browser
    ▼
User
    │
    │ 6. POST /mcp/tools/geox_compute_stoiip
    ▼
[Same flow through MCP → GEOX]
```

### Example 2: Agent Delegates Flood Modeling

```
External Agent
    │
    │ 1. POST geox.arif-fazil.com/a2a/tasks/send
    │    { skill_id: "flood_model", ... }
    ▼
A2A Gateway (geox-a2a:3002)
    │
    │ 2. Route to geox-hazard agent
    ▼
Hazard Agent
    │
    │ 3. Call MCP tool geox_score_risk
    ▼
MCP Server → GEOX Backend
    │
    │ 4. Return risk score + verdict
    ▼
Hazard Agent
    │
    │ 5. Package A2A response
    ▼
A2A Gateway
    │
    │ 6. Return to external agent
    ▼
External Agent
```

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `GEOX_BACKEND_URL` | MCP | URL of GEOX unified backend |
| `REGISTRY_PATH` | MCP | Path to skills registry |
| `MCP_SERVER_URL` | A2A | URL of MCP server for agent use |
| `ALLOWED_ORIGINS` | A2A | CORS origins |
| `AGENTS_DIR` | A2A | Path to agent card JSON files |
| `TRANSPORT` | GEOX | sse / stdio / http |

## Network Topology

```
Docker Network: geox-net

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  geox-site  │    │  geox-mcp   │    │  geox-a2a   │
│   :80       │    │   :8000     │    │   :3002     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────┴──────┐
                   │ geox-unified│
                   │    :8000    │
                   └─────────────┘
```

## Testing the Wiring

```bash
# Start all services
cd /root/geox-platform
docker-compose up -d

# Run wiring tests
./scripts/test-wiring.sh

# Or test manually:
curl http://localhost:8080/registry.json | head -20
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:3002/agents
```

## Debugging

### MCP Server not connecting to GEOX

Check imports:
```bash
docker logs geox-mcp
# Should show: "Backend: CONNECTED"
```

### A2A can't find agents

Check agent card loading:
```bash
docker logs geox-a2a
# Should show: "Loaded 4 agent cards"
```

### Site not showing WebMCP

Check manifest:
```bash
curl http://localhost:8080/webmcp.manifest.json | jq .
```

## Seal

ΔΩΨ — All surfaces wired and operational.
