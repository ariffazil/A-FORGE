# GEOX Platform Deployment Guide

## Four-Surface Topology

Single domain, path-based routing:

| Path | Surface | Stack | Deploy Target |
|------|---------|-------|---------------|
| `/` | Site | Static HTML/CSS/JS | Cloudflare Pages |
| `/webmcp.manifest.json` | WebMCP | Browser manifest | Cloudflare Pages |
| `/mcp/*` | MCP | FastMCP / SSE / Docker | VPS (Docker) |
| `/a2a/*` | A2A | Node.js / JSON-RPC | VPS (Docker) |

DNS: Only `geox.arif-fazil.com` → VPS IP needed.

## Release Channels

| Channel | Purpose | Stability |
|---------|---------|-----------|
| `canary` | Experimental features | Unstable |
| `stable` | Production releases | Stable |
| `field` | Operational deployments | Highly stable |
| `sovereign` | Internal/high-trust only | Restricted |

## Environment Variables

```bash
# Site
GEOX_SITE_URL=https://geox.arif-fazil.com
GEOX_RELEASE_CHANNEL=stable

# MCP Server
MCP_SERVER_PORT=8000
MCP_TRANSPORT=sse
GEOX_REGISTRY_PATH=/app/registry.json

# A2A Gateway
A2A_PORT=3002
ALLOWED_ORIGINS=https://geox.arif-fazil.com,https://apps.geox.arif-fazil.com
JWT_SECRET=xxx

# Auth/Policy
AUTH_MODE=mtls  # bearer, mtls, or api_key
888_HOLD_WEBHOOK=https://alerts.arif-fazil.com/hold
```

## Docker Deployment

### MCP Server

```dockerfile
# services/mcp-server/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY geox_mcp_server.py .
COPY ../../apps/site/registry.json .

EXPOSE 8000
CMD ["python", "geox_mcp_server.py"]
```

```yaml
# docker-compose.mcp.yml
version: '3.8'
services:
  geox-mcp:
    build: ./services/mcp-server
    ports:
      - "8000:8000"
    environment:
      - MCP_TRANSPORT=sse
    volumes:
      - ./apps/site/registry.json:/app/registry.json:ro
```

### A2A Gateway

```dockerfile
# services/a2a-gateway/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY server.js .
COPY ../../agents ./agents

EXPOSE 3002
CMD ["node", "server.js"]
```

```yaml
# docker-compose.a2a.yml
version: '3.8'
services:
  geox-a2a:
    build: ./services/a2a-gateway
    ports:
      - "3002:3002"
    environment:
      - ALLOWED_ORIGINS=https://geox.arif-fazil.com
```

## Cloudflare Pages (Static Site)

```yaml
# .github/workflows/deploy-site.yml
name: Deploy Site
on:
  push:
    branches: [main]
    paths: ['apps/site/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: geox-site
          directory: apps/site
          branch: main
```

## VPS Deployment (Full Stack)

```bash
# Deploy all services
ssh root@geox.arif-fazil.com << 'EOF'
  cd /opt/geox-platform
  git pull origin main
  
  # Deploy static site
  rsync -av apps/site/ /var/www/geox/
  
  # Deploy MCP server
  cd services/mcp-server
  docker build -t geox-mcp:latest .
  docker-compose -f docker-compose.mcp.yml up -d
  
  # Deploy A2A gateway
  cd ../a2a-gateway
  docker build -t geox-a2a:latest .
  docker-compose -f docker-compose.a2a.yml up -d
  
  # Reload nginx
  nginx -s reload
EOF
```

## Nginx Configuration

Single domain, path-based routing:

```nginx
# /etc/nginx/sites-available/geox

server {
    listen 80;
    server_name geox.arif-fazil.com;
    root /var/www/geox;
    index index.html;
    
    # Static site
    location / {
        try_files $uri $uri/ =404;
    }
    
    # WebMCP manifest
    location = /webmcp.manifest.json {
        add_header Content-Type application/json;
    }
    
    # MCP Server proxy (/mcp/*)
    location /mcp/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
    
    # A2A Gateway proxy (/a2a/*)
    location /a2a/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### DNS

Only one DNS record needed:

```
geox.arif-fazil.com → VPS IP
```

### MCP Client Config

```json
{
  "mcpServers": {
    "geox": {
      "url": "https://geox.arif-fazil.com/mcp/"
    }
  }
}
```

### A2A Client Config

```json
{
  "agents": {
    "geox": "https://geox.arif-fazil.com/a2a/"
  }
}
```

## Health Checks

```bash
# Site
curl https://geox.arif-fazil.com/health

# MCP
curl https://geox.arif-fazil.com/mcp/health

# A2A
curl https://geox.arif-fazil.com/a2a/health

# Registry
curl https://geox.arif-fazil.com/registry.json
```

## Rollback Procedures

```bash
# Rollback site
ssh root@geox.arif-fazil.com "cd /var/www/geox && git checkout stable"

# Rollback MCP
ssh root@geox.arif-fazil.com "docker-compose -f /opt/geox/services/mcp-server/docker-compose.mcp.yml down && docker-compose up -d"

# Rollback A2A
ssh root@geox.arif-fazil.com "docker-compose -f /opt/geox/services/a2a-gateway/docker-compose.a2a.yml down && docker-compose up -d"
```

## Monitoring

All services emit structured telemetry:

```json
{
  "epoch": "2026-04-11T08:30:00Z",
  "service": "geox-mcp|geox-a2a|geox-site",
  "level": "info|warn|error",
  "event": "request|response|error",
  "latency_ms": 123,
  "verdict": "888_SEAL|888_QUALIFY|888_HOLD|888_VOID"
}
```

Send to your observability stack (Datadog, Grafana, etc.) via sidecar or direct integration.

## Seal

ΔΩΨ — SOUL · MIND · VOID
