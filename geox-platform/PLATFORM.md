# GEOX Platform Architecture

## The Four-Surface Model

GEOX is packaged as a **four-surface system** where each surface serves a distinct purpose while sharing common contracts and ontology.

```
┌─────────────────────────────────────────────────────────────────┐
│                         HUMAN USERS                              │
│                    (Geoscientists, Analysts)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│     Site      │      │    WebMCP     │      │  MCP Clients  │
│  (Static)     │◄────►│  (Browser)    │      │  (AI Hosts)   │
│               │      │               │      │               │
│ • Wiki        │      │ • openProspect│      │ • Claude      │
│ • Catalog     │      │ • filterLayer │      │ • Cursor      │
│ • Skill Docs  │      │ • scoreRisk   │      │ • ChatGPT     │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   GEOX Platform     │
                    │   (Shared Core)     │
                    │                     │
                    │ • Registry          │
                    │ • Schemas           │
                    │ • Telemetry         │
                    │ • Auth/Policy       │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  MCP Server   │     │ A2A Gateway   │     │   Registry    │
│  (Tools)      │     │  (Agents)     │     │    API        │
│               │     │               │     │               │
│ • search      │     │ • planner     │     │ • skills      │
│ • score_risk  │     │ • terrain     │     │ • agents      │
│ • gate        │     │ • hazard      │     │ • schemas     │
└───────────────┘     │ • governance  │     └───────────────┘
                      └───────────────┘
```

## Surface Definitions

### 1. Site (Static)

**Purpose**: Human-facing documentation, wiki, and skill catalog.

**Technology**: Pure HTML/CSS/JS, no frameworks, static hosting.

**Key Files**:
- `index.html` — Landing page
- `catalog.html` — ASM-style skill catalog with search
- `wiki.html` — Karpathy-style doctrine wiki
- `styles.css` — Minimal, fast CSS
- `app.js` — Client-side search/filter

**Deploy Target**: Cloudflare Pages / GitHub Pages / VPS

**Domain**: `geox.arif-fazil.com`

### 2. WebMCP (Browser-Native)

**Purpose**: Browser-native capabilities for user-in-session work. Exposes structured tools from the webpage itself.

**Technology**: JavaScript + Manifest + Session-scoped handlers.

**Key File**: `webmcp.manifest.json`

**Capabilities**:
- `openProspect` — Open basin prospect in map view
- `filterBasinLayer` — Apply filters to data layers
- `showWellTrack` — Display well trajectory
- `scoreRiskScenario` — Run constitutional risk scoring
- `exportEvidencePack` — Generate audit package

**Deploy Target**: Same as Site (loaded as manifest)

**Domain**: `geox.arif-fazil.com` (manifest) / `apps.geox.arif-fazil.com` (runtime)

### 3. MCP (Agent-to-Tool)

**Purpose**: Runtime tool access for AI hosts (Claude, Cursor, ChatGPT, etc.).

**Technology**: FastMCP / SSE / JSON-RPC 2.0

**Key Files**:
- `geox_mcp_server.py` — MCP server implementation
- `requirements.txt` — Python dependencies

**Resources**:
- `geox://registry` — Full skill registry
- `geox://domains/{id}` — Domain definitions
- `geox://resources/{domain}/{skill}` — Individual skills

**Tools**:
- `geox_search_skills` — Search skill catalog
- `geox_get_skill` — Get skill details
- `geox_score_risk` — Score risk scenario
- `geox_constitutional_gate` — Evaluate against F1-F13

**Prompts**:
- `geox_interpret_prospect` — Guide for basin interpretation
- `geox_compare_scenarios` — Compare operational scenarios
- `geox_issue_verdict` — Issue constitutional verdict

**Deploy Target**: VPS (Docker) with SSE streaming

**Domain**: `geox.arif-fazil.com/mcp`

### 4. A2A (Agent-to-Agent)

**Purpose**: Multi-agent coordination, delegation, and collaboration.

**Technology**: Node.js / Express / JSON-RPC / WebSocket

**Key Files**:
- `server.js` — A2A gateway implementation
- `package.json` — Node dependencies
- `agents/*/agent-card.json` — Agent definitions

**Agents** (11 total):
- `geox-planner` — Mission decomposition and coordination
- `geox-terrain` — Surface and elevation analysis
- `geox-hazard` — Multi-risk assessment
- `geox-governance` — Constitutional enforcement
- `geox-water` — Hydrology, flood, watershed
- `geox-atmosphere` — Weather, climate, storms
- `geox-mobility` — Routing, traffic, navigation
- `geox-infrastructure` — Assets, networks, urban
- `geox-sensing` — Signals, telemetry, calibration
- `geox-geodesy` — Coordinates, datums, GPS RTK
- `geox-orchestration` — Multi-agent, void, fallback

**Endpoints**:
- `GET /agents` — List all agents
- `GET /agents/:name/card.json` — Get agent card
- `POST /tasks/send` — Submit task
- `GET /tasks/:id` — Get task status
- `POST /tasks/:id/cancel` — Cancel task

**Deploy Target**: VPS (Docker)

**Domain**: `geox.arif-fazil.com/a2a`

## Shared Contracts

All surfaces share canonical schemas in `packages/schemas/`:

| Schema | Purpose |
|--------|---------|
| `skill.schema.json` | Operational skill definitions |
| `tool.schema.json` | MCP tool specifications |
| `webmcp.manifest.schema.json` | Browser capability manifests |
| `a2a-agent-card.schema.json` | Agent discovery cards |
| `a2a-task.schema.json` | Task delegation envelopes |
| `telemetry.schema.json` | Runtime observability |
| `registry.schema.json` | Master registry structure |

## Unified Telemetry

All surfaces emit the same telemetry format:

```json
{
  "epoch": "2026-04-11T08:30:00+08:00",
  "capability_id": "geox.water.flood-model",
  "surface": "mcp|a2a|webmcp|site",
  "dS": 0.03,
  "peace2": 1.02,
  "kappa_r": 0.18,
  "confidence": 0.81,
  "verdict": "888_SEAL|888_QUALIFY|888_HOLD|888_VOID",
  "witness": {
    "human": true,
    "ai": true,
    "earth": true
  },
  "qdf": "evidence-linked"
}
```

## Constitutional Gates

All surfaces respect 888 HOLD for:
- External write actions
- Destructive data operations
- Sovereign/safety-critical decisions
- Automated production publication
- Irreversible infrastructure commands

## Release Channels

| Channel | Site | WebMCP | MCP | A2A |
|---------|------|--------|-----|-----|
| `canary` | Branch: `canary` | Manifest: `canary` | Image: `geox-mcp:canary` | Image: `geox-a2a:canary` |
| `stable` | Branch: `main` | Manifest: `stable` | Image: `geox-mcp:stable` | Image: `geox-a2a:stable` |
| `field` | Tag: `field` | Manifest: `field` | Image: `geox-mcp:field` | Image: `geox-a2a:field` |
| `sovereign` | Private repo | Signed manifest | Signed image | MTLS only |

## Getting Started

### 1. Clone and setup

```bash
git clone https://github.com/ariffazil/geox-platform.git
cd geox-platform
```

### 2. Run static site locally

```bash
cd apps/site
python3 -m http.server 8000
# Open http://localhost:8000
```

### 3. Run MCP server locally

```bash
cd services/mcp-server
pip install -r requirements.txt
python geox_mcp_server.py
```

### 4. Run A2A gateway locally

```bash
cd services/a2a-gateway
npm install
npm start
```

## Next Steps

- Add more agent cards in `agents/`
- Extend skill definitions in `content/skills/`
- Add wiki articles in `content/wiki/`
- Deploy to your infrastructure using `DEPLOYMENT.md`

## Seal

ΔΩΨ — SOUL · MIND · VOID

DITEMPA BUKAN DIBERI — Forged, Not Given
