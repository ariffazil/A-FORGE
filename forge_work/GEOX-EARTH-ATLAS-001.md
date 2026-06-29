# GEOX-EARTH-ATLAS-001 — Phase 1 Blueprint
**Plan ID:** GEOX-EARTH-ATLAS-001  
**Created:** 2026-06-29  
**Status:** F13 RATIFICATION PENDING  
**Phase:** 1 (Design + Prototype)  
**Arif:** Muhammad Arif bin Fazil — F13 SOVEREIGN  

---

## Context: What Exists vs What Is Missing

### What GEOX Already Has

| Artifact | Type | Purpose | Gap |
|----------|------|---------|-----|
| `geox_ratlas.html` | Well-log material reference atlas | 99 canonical subsurface materials (SAND_QZ_CLEAN, LIMESTONE_CC, etc.) + physics equations (Archie, Gardner, Wyllie) | Subsurface rock physics — NOT surface geography |
| `geox_atlas_99_materials.csv` | Physics database | Matrix density, NPHI, GR, RT per material | Same — well-log physics |
| `spatial_block.py` | Spatial CV validation | GEOX's own sample distribution validation (haversine distances, block CV) | GEOX internal data only |
| `skill-spatial-grounding.md` | Agent config skill | VPS spatial awareness for agents | VPS topology, not Earth map |
| `geox.arif-fazil.com/viewer/` | Web surface | RATLAS + physics reference UI | Same — well-log materials |
| `geox_context_at_location` | Proposed tool (inactive) | Was planned for Malay Basin grounding | Never built |

### What GEOX Does NOT Have

❌ **No world map base layers** (countries, coastlines, cities, roads)  
❌ **No surface geography API** for agents to query "what is at lat X, lon Y?"  
❌ **No PostGIS / OSM / Natural Earth data** loaded  
❌ **No geospatial MCP tool** that agents can call  
❌ **No map tile server** (even for visual display)

**This is the gap.** RATLAS is a *well-log material* atlas — different thing entirely.

---

## What "Real Earth Map Atlas" Means Here

Arif's question: *"Do we have a real earth map in GEOX available as resources if any agent need to use it?"*

**Answer: NO. But the path to YES is clear and forgeable.**

A real Earth map atlas for agents/humans means:
1. **Vector geometry** — country boundaries, coastlines, rivers, roads, cities
2. **Queryable** — "What country is this coordinate in?" / "What's the nearest city?" / "Show me the coastline within 50km"
3. **Sovereign** — self-hosted, no external API dependency for core queries
4. **Agent-callable** — MCP tool surface, not just a web page
5. **Grounded** — links to GEOX's existing basin/well context

---

## Phase 1: Design + Prototype Blueprint

### A. Data Layer (PostGIS + OSM)

**Recommended stack:**
```
PostgreSQL + PostGIS extension
  └── osm2pgsql (loads OSM extract into PostGIS)
        └── OpenStreetMap data (Malaysia extract + global context)
  └── Natural Earth (countries, coastlines, physical features)
```

**Why PostGIS:**
- Industry standard spatial database — 20+ years production use
- Spatial SQL queries are precise, auditable, reversible
- OSM data is free, public domain, sovereign-loadable
- Malaysia OSM extract is small (~500MB compressed) — fast first load
- Spatial joins with GEOX well/seismic data possible

**Minimal OSM schema (v1):**
```sql
-- Countries (Natural Earth)
CREATE TABLE ne_countries (
    ogc_fid SERIAL PRIMARY KEY,
    name VARCHAR(100),
    iso_a3 VARCHAR(3),
    continent VARCHAR(50),
    geom GEOMETRY(MULTIPOLYGON, 4326)
);

-- Malaysia roads (OSM)
CREATE TABLE osm_malaysia_roads (
    osm_id BIGINT PRIMARY KEY,
    name VARCHAR(200),
    highway VARCHAR(50),
    geom GEOMETRY(LINESTRING, 4326)
);

-- Malaysia waterways (OSM)  
CREATE TABLE osm_malaysia_waterways (
    osm_id BIGINT PRIMARY KEY,
    name VARCHAR(200),
    waterway VARCHAR(50),
    geom GEOMETRY(LINESTRING, 4326)
);

-- Coastal points (OSM)
CREATE TABLE osm_coastline_points (
    osm_id BIGINT,
    sequence_id INT,
    geom GEOMETRY(POINT, 4326)
);
```

**Alternative if PostGIS is too heavy:**
DuckDB + spatial extension — single-file, no server, fast for ad-hoc queries. Good for VPS. Consider DuckDB first, graduate to PostGIS if GEOX spatial needs grow.

### B. MCP Tool Surface (Phase 1 minimal)

**4 tools to expose under `geox_` prefix:**

| Tool | Mode | What it does |
|------|------|-------------|
| `geox_context_at_location` | point | Lat/lon → country, nearest city, coastline distance, elevation estimate |
| `geox_geography_query` | sql | Natural language → spatial SQL → GeoJSON result |
| `geox_buffer_query` | radius | Lat/lon + radius → all features within (roads, water, settlements) |
| `geox_distance_between` | haversine | Two lat/lon points → great-circle distance in km |

**Tool contract example:**
```
geox_context_at_location(lat: float, lon: float) → {
  country: str,
  country_iso3: str, 
  nearest_city_km: float,
  city_name: str,
  coastline_distance_km: float,
  elevation_estimate_m: int,
  basin_name: str,        -- links to GEOX existing basin intelligence
  confidence: float
}
```

### C. Integration with Existing GEOX

- `geox_context_at_location` should return `basin_name` by linking to GEOX's existing basin registry (`geox://basins/index`)
- Spatial block validation (`spatial_block.py`) can use OSM coastline for validation
- Malay Basin, Sabah Basin, Sarawak Basin contexts pre-loaded

### D. Visuals (Optional, Phase 1.5)

- Leaflet.js or MapLibre GL JS map component in `geox-gui/`
- Renders GeoJSON from tool responses
- Tile server (Martini/TileServer GL) for basemap tiles

---

## Three Build Options (Arif Decides)

| Option | Stack | Sovereignty | Effort | Best For |
|--------|-------|-----------|--------|---------|
| **A — DuckDB + GeoJSON** | DuckDB spatial, Natural Earth GeoJSON files | Full sovereign | Low (days) | Quick win, VPS-friendly |
| **B — PostGIS + OSM** | PostGIS + osm2pgsql + Malaysia OSM extract | Full sovereign | Medium (weeks) | Production, full query power |
| **C — Hybrid (recommended)** | DuckDB for quick queries + PostGIS for complex + Nominatim for geocoding | High sovereign | Medium | Balances speed + capability |

**FORGE recommendation: Option C (Hybrid)**  
Start with DuckDB + Natural Earth for immediate capability. Graduate to PostGIS + OSM as Phase 2.

---

## Phase 1 Tasks (Post-Ratification)

### Week 1: Data Foundation
- [ ] Audit Docker/VPS: check if PostGIS or DuckDB already installed
- [ ] Download Natural Earth countries GeoJSON (10m resolution)
- [ ] Download Malaysia OSM extract (pbf file)
- [ ] Design minimal DuckDB schema or PostGIS schema

### Week 2: Tool Prototype  
- [ ] Build `geox_context_at_location` MCP tool (hardened stub)
- [ ] Test with known coordinates (Kuala Lumpur, Miri, offshore Sarawak)
- [ ] Verify tool returns basin_name from existing GEOX basin registry
- [ ] Write 3 golden tests

### Week 3: Integration + Seal
- [ ] Connect tool to existing GEOX well desurvey (geox_well_desurvey already computes TVD/X/Y!)
- [ ] Run GEOX spatial_block.py validation with OSM coastline
- [ ] Constitutional review (F1–F13 gates)
- [ ] Submit for 888_JUDGE + 999_VAULT seal

---

## What Agents Get (Post-Phase 1)

**Example agent query:**
```
Agent: "What's the geographic context for well DUNLIN-1 in the Malay Basin?"
GEOX: {
  country: "Malaysia",
  country_iso3: "MYS", 
  nearest_city_km: 85.3,
  city_name: "Kuala Terengganu",
  coastline_distance_km: 12.7,
  elevation_estimate_m: 23,
  basin_name: "Malay Basin",
  basin_region: "PM9A",
  latitude: 4.123,
  longitude: 103.456,
  confidence: 0.91
}
```

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| OSM data quality in Malaysia | LOW | Use Natural Earth for country boundaries, OSM for roads/waterways |
| PostGIS setup complexity | MEDIUM | Start with DuckDB — simpler, no server |
| OSM extract size | LOW | Malaysia-only extract is ~500MB |
| Agent hallucinating geography | HIGH | Every response must include `confidence` + `data_source` |
| Sovereignty violation | HIGH | No external API dependency for core layer |

---

## Constitutional Alignment

| Floor | How Addressed |
|-------|---------------|
| F1 AMANAH | Reversible design: DuckDB/GeoJSON files, no DB migration in Phase 1 |
| F2 TRUTH | Every tool response labels data_source (OBS/DERIVED) + confidence score |
| F4 CLARITY | Clean tool schema, one purpose per tool, no ambiguity |
| F7 HUMILITY | Confidence hard-capped at 0.90; responses say "estimate" not "is" |
| F9 ANTI-HANTU | Atlas is a tool, not a sensor — agents query, not hallucinate |
| F11 AUDIT | All tool calls logged to VAULT999 via forge_work/ receipt |

---

## F13 Sovereign Decision Required

Arif — three things I need from you:

**1. Build option?**
- A = DuckDB only (fastest, simplest)
- B = PostGIS + OSM (production-grade)
- C = Hybrid (recommended — DuckDB now, PostGIS later)

**2. Malaysia-first or Global-first?**
- Malaysia-first: load Malaysia OSM extract + Natural Earth global first
- Global-first: load Natural Earth global boundaries (all countries) as v1

**3. Phase 1 seal threshold?**
- Minimum: `geox_context_at_location` (just returns country + nearest city + basin name)
- Full Phase 1: all 4 tools + DuckDB setup + 3 golden tests

**Reply with option letter + number** (e.g., "C, Malaysia-first, minimum") and I proceed to Phase 1 design.

Or say "stop" — your call, Arif.

---

*DITEMPA BUKAN DIBERI — The atlas gap is real. The forge path is clear. The sovereign decides.*
*Plan ID: GEOX-EARTH-ATLAS-001 | Phase: 1 | Status: F13 RATIFICATION PENDING*
