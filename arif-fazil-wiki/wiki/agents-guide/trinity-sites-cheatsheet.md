# Trinity Sites — Agent Cheat Sheet

**Quick reference for working with arif-fazil.com infrastructure**

---

## The Trinity At A Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                      ARIF-FAZIL.COM TRIAD                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Ψ SOUL          Ω MIND            Δ BODY                       │
│   arif-fazil.com  arifos.arif-      aaa.arif-fazil.com           │
│                   fazil.com                                      │
│                                                                  │
│   Human           Machine           Action                       │
│   Red #FF3333     Cyan #00D4AA      Gold #D4A853                 │
│   Jagged          Grid              Rounded                      │
│   Fractal         Precise           Organic                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Decision Tree

```
Need to update the PERSONAL SITE (human identity, bio, discoveries)?
└── Site: arif-fazil.com (SOUL)
    Path: /root/arif-sites/sites/arif-fazil.com/
    Tech: React + Vite
    Build: npm run build
    Color: Red (#FF3333)

Need to update the CONSTITUTIONAL DOCS (arifOS, F1-F13)?
└── Site: arifos.arif-fazil.com (MIND)
    Path: /root/arif-sites/sites/arifos.arif-fazil.com/
    Tech: React + Vite
    Build: npm run build
    Color: Cyan (#00D4AA)

Need to update the PROTOCOL SPECS (MCP, A2A, WebMCP)?
└── Site: aaa.arif-fazil.com (BODY)
    Path: /root/arif-sites/sites/aaa.arif-fazil.com/
    Tech: HTML + Tailwind CDN
    Build: None (static)
    Color: Gold (#D4A853)

Need to CHECK SYSTEM HEALTH?
└── Endpoint: https://arifosmcp.arif-fazil.com/health
    Tools: 33 loaded
    Substrates: 6 configured

Need to UPDATE ALL NAVIGATION?
└── All sites have inline <nav id="rn"> in index.html
    Must update each site's index.html manually
```

---

## Deployment Commands

### Standard Deploy Pattern
```bash
# 1. Build (if React project)
cd /root/arif-sites/sites/<site-folder>
npm run build

# 2. Clear old files
docker exec arifos_landings rm -rf /usr/share/nginx/html/<site-folder>/*

# 3. Deploy new files
docker cp dist/. arifos_landings:/usr/share/nginx/html/<site-folder>/
# OR for HTML sites:
docker cp . arifos_landings:/usr/share/nginx/html/<site-folder>/

# 4. Verify
curl -s https://<hostname> | head
```

### Site-Specific Quick Commands

**SOUL (arif-fazil.com):**
```bash
cd /root/arif-sites/sites/arif-fazil.com && \
npm run build && \
docker exec arifos_landings rm -rf /usr/share/nginx/html/arif-fazil.com/* && \
docker cp dist/. arifos_landings:/usr/share/nginx/html/arif-fazil.com/
```

**MIND (arifos.arif-fazil.com):**
```bash
cd /root/arif-sites/sites/arifos.arif-fazil.com && \
npm run build && \
docker exec arifos_landings rm -rf /usr/share/nginx/html/arifos.arif-fazil.com/* && \
docker cp dist/. arifos_landings:/usr/share/nginx/html/arifos.arif-fazil.com/
```

**BODY (aaa.arif-fazil.com):**
```bash
cd /root/arif-sites/sites/aaa.arif-fazil.com && \
docker exec arifos_landings rm -rf /usr/share/nginx/html/aaa.arif-fazil.com/* && \
docker cp . arifos_landings:/usr/share/nginx/html/aaa.arif-fazil.com/
```

**MCP Dashboard:**
```bash
cd /root/arif-sites/sites/arifosmcp.arif-fazil.com && \
docker exec arifos_landings rm -rf /usr/share/nginx/html/arifosmcp.arif-fazil.com/* && \
docker cp . arifos_landings:/usr/share/nginx/html/arifosmcp.arif-fazil.com/
```

---

## File System Map

```
/root/arif-sites/
├── sites/
│   ├── arif-fazil.com/              # Ψ SOUL
│   │   ├── src/
│   │   │   ├── App.tsx              # Main component (jagged theme)
│   │   │   └── constitution/tokens.ts
│   │   ├── dist/                    # Build output
│   │   └── package.json
│   │
│   ├── arifos.arif-fazil.com/       # Ω MIND
│   │   ├── src/                     # arifOS docs
│   │   └── dist/
│   │
│   ├── aaa.arif-fazil.com/          # Δ BODY
│   │   ├── index.html               # AAA Wire protocols
│   │   └── styles.css
│   │
│   └── arifosmcp.arif-fazil.com/    # MCP Dashboard
│       └── index.html               # Live health dashboard
│
├── arifOS/
│   └── infrastructure/nginx/
│       └── arifos_landings.conf     # vhost config
│
└── GEOX/
    └── docker-compose.yml           # GEOX stack (Traefik routed)
```

---

## Infrastructure Reference

### Containers
| Container | Purpose | Network |
|-----------|---------|---------|
| arifos_landings | Nginx serving static sites | arifos_core_network |
| arifosmcp | MCP server (:8080) | arifos_core_network |
| geox_gui | GEOX React app (:80) | arifos_core_network |
| geox_eic | GEOX MCP server (:8000) | geox_command_center |
| traefik | Reverse proxy | arifos_core_network |

### Critical Endpoints
```
https://arif-fazil.com              → SOUL (red)
https://arifos.arif-fazil.com       → MIND (cyan)
https://aaa.arif-fazil.com          → BODY (gold)
https://arifosmcp.arif-fazil.com    → MCP Dashboard
https://geox.arif-fazil.com         → GEOX GUI
https://forge.arif-fazil.com        → FORGE (future)
```

---

## Visual Design System

### Color Codes (Copy-Paste Ready)
```css
/* SOUL - Human/Igneous */
--soul-red: #FF3333;
--soul-blue: #3366FF;
--soul-yellow: #FFCC00;
--soul-void: #050505;

/* MIND - Machine/Precise */
--mind-cyan: #00D4AA;
--mind-teal: #008866;
--mind-mint: #00FFAA;
--mind-void: #0A0A0A;

/* BODY - Action/Warm */
--body-gold: #D4A853;
--body-amber: #C4791A;
--body-light: #E3B341;
--body-void: #0D1117;
```

### Typography
| Ring | Primary | Secondary |
|------|---------|-----------|
| SOUL | Space Grotesk | System mono |
| MIND | JetBrains Mono | System sans |
| BODY | Inter | System mono |

---

## Common Tasks

### Update Navigation Footer
All sites share a unified navigation footer. To update:
1. Edit `index.html` in each site
2. Find `<nav id="rn">` block
3. Update links/colors as needed
4. Redeploy each site

### Check Health Status
```bash
curl -s https://arifosmcp.arif-fazil.com/health | jq '.'
```

### Restart After Deployment
Usually not needed for static files, but if caching issues:
```bash
docker restart arifos_landings
```

---

## Theory of Anomalous Contrast

When modifying sites, maintain **visual contrast** between rings:

| Aspect | SOUL | MIND | BODY |
|--------|------|------|------|
| Primary color | Red | Cyan | Gold |
| Shape language | Jagged/Polygon | Rectilinear/Grid | Rounded/Soft |
| Motion style | Fractal drift | Precise snap | Smooth ease |
| Typography | Grotesk | Monospace | Sans-serif |

**NEVER** make two rings look similar. They must be instantly distinguishable.

---

## Emergency Contacts

| Issue | Check |
|-------|-------|
| Site not loading | `docker ps` - check arifos_landings |
| 403 errors | Check container file permissions |
| SSL issues | Check Traefik + Let's Encrypt |
| Build failures | Check TypeScript errors |

---

**999_SEAL VERIFIED** | 2026-04-11

*Ditempa Bukan Diberi — Forged, Not Given*
