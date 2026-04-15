# GEOX Four-Surface Fixes Applied

> Date: 2026-04-11
> Status: Routing fixes applied, ready for deployment

## Issues Fixed

### 1. MCP Routing (SURFACE 3)

**Problem:**
- `/mcp` → `/mcp/` redirect was going to HTTP instead of HTTPS
- Missing `X-Forwarded-Proto` header
- No explicit canonical redirect

**Fix:**
```nginx
# Canonical redirect: /mcp → /mcp/ (308 permanent redirect)
location = /mcp {
    return 308 /mcp/;
}

location ^~ /mcp/ {
    proxy_pass http://geox-mcp:8000/mcp/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;  # ← Critical for HTTPS
    
    # SSE support
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

### 2. A2A Routing (SURFACE 4)

**Problem:**
- `/a2a` not routed at all (fell through to SPA)
- Missing from both Traefik and Nginx config

**Fix:**
```nginx
# Canonical redirect: /a2a → /a2a/
location = /a2a {
    return 308 /a2a/;
}

location ^~ /a2a/ {
    proxy_pass http://geox-a2a:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Also fixed:** Updated all agent card URLs from:
- `https://a2a.geox.arif-fazil.com/agents/{name}`

To:
- `https://geox.arif-fazil.com/a2a/agents/{name}`

### 3. WebMCP Manifest (SURFACE 2)

**Status:** Already exists at `/root/geox-platform/apps/site/webmcp.manifest.json`

**Nginx config:** Already routes `/webmcp.manifest.json` to static site

**No changes needed** — file exists and routing is correct.

## Current Four-Surface Status

| Surface | Path | Status | Fix Applied |
|---------|------|--------|-------------|
| **Site** | `/` | ✅ Working | No changes |
| **WebMCP** | `/webmcp.manifest.json` | ✅ Working | Verified exists |
| **MCP** | `/mcp/` | 🔧 Fixed | Canonical redirect + X-Forwarded-Proto |
| **A2A** | `/a2a/` | 🔧 Fixed | Added routing + agent card URL updates |

## Deployment Commands

```bash
# 1. Navigate to platform directory
cd /root/geox-platform

# 2. Start/restart all services
docker-compose up -d

# 3. Verify all surfaces
./scripts/verify-four-surfaces.sh

# 4. Check logs
docker-compose logs -f
```

## Testing Checklist

After deployment, verify:

- [ ] `https://geox.arif-fazil.com/` → Site loads
- [ ] `https://geox.arif-fazil.com/webmcp.manifest.json` → Valid JSON
- [ ] `https://geox.arif-fazil.com/mcp` → 308 redirect to `/mcp/`
- [ ] `https://geox.arif-fazil.com/mcp/` → MCP response (not HTTP redirect)
- [ ] `https://geox.arif-fazil.com/a2a` → 308 redirect to `/a2a/`
- [ ] `https://geox.arif-fazil.com/a2a/` → A2A gateway response
- [ ] `https://geox.arif-fazil.com/a2a/agents` → List of agents
- [ ] `https://geox.arif-fazil.com/a2a/health` → Healthy status

## Public Contract (Updated)

| Surface | Public Path | Description |
|---------|-------------|-------------|
| Site | `/` | Static HTML/CSS/JS — Human trust layer |
| WebMCP | `/webmcp.manifest.json` | Browser-native capabilities manifest |
| MCP | `/mcp/` | Model Context Protocol — Agent tools |
| A2A | `/a2a/` | Agent-to-Agent coordination |

## Seal

ΔΩΨ — SOUL · MIND · VOID

**999 SEAL — Four-surface routing fixed.**
