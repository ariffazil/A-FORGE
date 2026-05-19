<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-19
valid_from: 2026-05-19
valid_until: 2026-06-19
confidence: high
scope: /root/A-FORGE
epistemic_status: CLAIM
-->

# A-FORGE — Infrastructure & Deployment Shell

> **Status:** OPERATIONAL | **Organ:** FORGE (A) | **Authority:** arifOS

## 🏛️ What this repo is

The centralized deployment and infrastructure orchestration shell for the arifOS federation. A-FORGE owns all Docker Compose manifests, Caddy routing configurations, systemd service definitions, and the substrate wrapper that boots the full federation stack on VPS.

**A-FORGE owns the FORGE — the metabolic infrastructure that keeps every organ alive.**

## 📦 Ownership

- **Owns**: Docker Compose manifests, Caddy routing, Prometheus/Grafana monitoring, systemd services, VPS deployment scripts.
- **Does NOT own**: Application logic (AAA), Kernel logic (arifOS), Domain logic (GEOX/WELL).

## 🏗️ Current Structure

```
A-FORGE/
├── deploy/                    # Centralized Docker Compose manifests
│   ├── AAA/                 # AAA Caddy + compose
│   ├── arifOS/              # arifOS Caddy + compose (copilot-gateway, machine-law)
│   ├── arif-sites/          # arif-sites Caddy + Dockerfile
│   ├── caddy/              # Caddy v2 reverse proxy config
│   ├── grafana/
│   └── prometheus/
├── deployments/
│   └── arifOS/             # Substrate wrapper + VPS deploy scripts
│       ├── substrate_wrapper.py   # Boot orchestration
│       ├── deploy.sh
│       ├── vps-deploy.yml
│       └── af-forge/       # af-bridge deployment
│           ├── docker-compose.yml
│           ├── nginx.conf
│           └── startup.sh
├── src/                     # TypeScript source (AgentEngine, CLI, governance, tools)
│   ├── server.ts           # HTTP Bridge (Express, port 7071)
│   ├── cli.ts              # CLI entry point
│   ├── engine/              # AgentEngine, BudgetManager
│   ├── governance/         # F3-F13 floor implementations
│   ├── llm/               # Provider abstractions
│   ├── tools/              # BaseTool, ToolRegistry, File/Search/Shell/Editor
│   ├── vault/              # VAULT999 client
│   └── ops/               # ThermodynamicCostEstimator (OPS/777)
├── test/                   # 16 node:test files
├── docs/
│   ├── AGENT_LAYOUT_CONTRACT.md
│   └── RELEASE_NOTES_2026.05.16.md
└── Makefile               # build, up, down, test, clean
```

## 🚀 Verified Commands

```bash
# Install TypeScript dependencies
npm install

# Build TypeScript → dist/
npm run build

# Run tests
npm test              # or: make test

# Docker Compose (full federation)
docker compose -f deploy/arifOS/docker-compose.yml up -d

# Docker Compose (AAA)
docker compose -f deploy/AAA/docker-compose.yml up -d
```

## 🔗 Federation Loop

- [arifOS](https://github.com/ariffazil/arifOS) — Kernel (constitutional judgment)
- [AAA](https://github.com/ariffazil/AAA) — Body (session cockpit)
- [arif-sites](https://github.com/ariffazil/arif-sites) — Static surfaces (Cloudflare Pages)

---

*Last Verified: 2026.05.16 | 999 SEAL ALIVE*
