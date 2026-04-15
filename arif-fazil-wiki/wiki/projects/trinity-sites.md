# Trinity Sites Architecture

**999_SEAL VERIFIED** | Version 4.0 | 2026-04-11

---

## Overview

The arif-fazil.com domain hosts a **constitutional triad** of sites representing the three aspects of sovereign AI governance: SOUL (human identity), MIND (constitutional kernel), and BODY (protocol execution).

```
        Ψ SOUL          Ω MIND          Δ BODY
    arif-fazil.com  arifos.arif-fazil.com  aaa.arif-fazil.com
         │                │                    │
         └────────────────┼────────────────────┘
                          │
                   ◉ FORGE (unified)
```

---

## Ψ SOUL — arif-fazil.com

### Identity
- **Purpose**: Human anchor / Personal brand / Field geoscientist
- **Persona**: The Human — listening to the earth
- **Metaphor**: Strata / Igneous / Fractal

### Visual Design
| Element | Value |
|---------|-------|
| Primary | `#FF3333` (Igneous Red) |
| Secondary | `#3366FF` (Deep Strata Blue) |
| Accent | `#FFCC00` (Discovery Gold) |
| Shape | Jagged clip-paths, polygon edges |
| Motion | Fractal noise, drift particles |
| Typography | Space Grotesk, monospace accents |

### Technology
- **Stack**: React 18 + Vite + Framer Motion
- **Build**: TypeScript → dist/ → Docker
- **Deployment**: arifos_landings nginx container

### Key Features
- Biological age clock (9-decimal precision)
- Fractal stratigraphic canvas animation
- Discovery cards (4 major wells)
- Jagged button components

---

## Ω MIND — arifos.arif-fazil.com

### Identity
- **Purpose**: arifOS constitutional kernel documentation
- **Persona**: The Machine — constitutional governance
- **Metaphor**: Code / Precision / Grid

### Visual Design
| Element | Value |
|---------|-------|
| Primary | `#00D4AA` (Cyan) |
| Secondary | `#008866` (Teal) |
| Accent | `#00FFAA` (Mint) |
| Shape | Rectilinear, grid-based |
| Motion | Precise snapping, calculated |
| Typography | JetBrains Mono |

### Technology
- **Stack**: React 18 + Vite
- **Content**: 13 constitutional floors (F1-F13)
- **API**: MCP protocol documentation

---

## Δ BODY — aaa.arif-fazil.com

### Identity
- **Purpose**: AAA Wire — MCP/WebMCP/A2A protocols
- **Persona**: The Action — execution, connection
- **Metaphor**: Wire / Network / Protocol

### Visual Design
| Element | Value |
|---------|-------|
| Primary | `#D4A853` (Gold) |
| Secondary | `#C4791A` (Amber) |
| Accent | `#E3B341` (Light Gold) |
| Shape | Rounded corners, soft edges |
| Motion | Smooth easing, organic curves |
| Typography | Inter |

### Technology
- **Stack**: HTML5 + Tailwind CSS CDN
- **Content**: Protocol specs, A2A architecture
- **Style**: Primer-inspired dark theme

---

## Theory of Anomalous Contrast

The three sites are designed to be **visually distinct** through a systematic application of anomalous contrast:

```
            ┌─────────────────────────────────────────┐
            │         ANOMALOUS CONTRAST              │
            │                                         │
    SOUL    │  Red  ·  Jagged   ·  Fractal   · Human │
    MIND    │  Cyan ·  Grid     ·  Precise   · Machine│
    BODY    │  Gold ·  Rounded  ·  Organic   · Action │
            │                                         │
            └─────────────────────────────────────────┘
```

This ensures users can instantly identify which ring they're in by visual cues alone.

---

## Infrastructure Sites

### MCP Dashboard — arifosmcp.arif-fazil.com
- **Type**: Dynamic API-driven dashboard
- **Data Source**: `/health` endpoint (live)
- **Features**: 33 tools, 6 substrates, thermodynamic metrics
- **SEAL Badge**: Real-time system status

### GEOX — geox.arif-fazil.com
- **Type**: Earth Intelligence Core GUI
- **Route**: Traefik (not landings container)
- **MCP**: geox_eic on port 8000
- **Theme**: Deep space geoscience

### FORGE — forge.arif-fazil.com
- **Type**: Unified entry point (future)
- **Status**: Placeholder
- **Purpose**: AF-FORGE agent workbench

---

## Deployment Architecture

```
Internet → Cloudflare (DNS/SSL) → Traefik → Services
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              arifos_landings              geox_gui                arifosmcp
              (nginx:80)                   (:3000)                 (:8080)
                    │
        ┌───────────┼───────────┐
        │           │           │
    arif-     arifos.      aaa.
    fazil.com arif-fazil.com arif-fazil.com
```

### Quick Deploy Commands

**SOUL:**
```bash
cd /root/arif-sites/sites/arif-fazil.com
npm run build
docker cp dist/. arifos_landings:/usr/share/nginx/html/arif-fazil.com/
```

**MIND:**
```bash
cd /root/arif-sites/sites/arifos.arif-fazil.com
npm run build
docker cp dist/. arifos_landings:/usr/share/nginx/html/arifos.arif-fazil.com/
```

**BODY:**
```bash
cd /root/arif-sites/sites/aaa.arif-fazil.com
docker cp . arifos_landings:/usr/share/nginx/html/aaa.arif-fazil.com/
```

---

## Unified Navigation

All sites share a **Trinity Footer Navigation**:

```html
<nav id="rn">
  <a href="https://arif-fazil.com" style="color:#ff3333">Ψ SOUL</a>
  <a href="https://arifos.arif-fazil.com" style="color:#00d4aa">Ω MIND</a>
  <a href="https://aaa.arif-fazil.com" style="color:#d4a853">Δ BODY</a>
  <a href="https://forge.arif-fazil.com" style="color:#888">◉ FORGE</a>
</nav>
```

The active site is highlighted with a bottom border.

---

## Status

| Site | Status | Last Deploy |
|------|--------|-------------|
| arif-fazil.com | ✅ 999_SEAL | 2026-04-11 |
| arifos.arif-fazil.com | ✅ 999_SEAL | 2026-04-11 |
| aaa.arif-fazil.com | ✅ 999_SEAL | 2026-04-11 |
| arifosmcp.arif-fazil.com | ✅ 999_SEAL | 2026-04-11 |
| geox.arif-fazil.com | ✅ 999_SEAL | 2026-04-11 |

---

*Ditempa Bukan Diberi — Forged, Not Given*
