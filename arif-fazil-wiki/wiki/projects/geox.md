# GEOX — Earth Intelligence Platform

> **Arif's Earth knowledge system with constitutional governance.**
> **Type:** Entity | **Status:** 7-Dimension Seal Active | **Seal:** v2026.04.12-EIC

---

## One-Line Essence

A **seven-dimensional Earth intelligence platform** applying arifOS constitutional governance (F1-F13) to subsurface decision-making through physics-based verification and sovereign human oversight.

---

## Core Purpose

**The Problem:** Earth science decisions (drilling, exploration, development) lack structured governance, leading to:
- Fragmented knowledge across disciplines
- Unverified assumptions in critical decisions
- No systematic safety/verification gates

**The Solution:** GEOX provides:
- **7-dimensional analysis** — Prospect → Well → Section → Earth 3D → Time 4D → Physics → Map
- **Physics-based verification** — Theory of Anomalous Contrast (ToAC) applied to subsurface
- **Constitutional governance** — 888_JUDGE engine with 888_HOLD and 999_SEAL
- **Four-surface platform** — Site + WebMCP + MCP + A2A unified access

---

## Seven-Dimension Architecture

| Dimension | ID | App/Module | Icon | Core Function | Status |
|-----------|-----|------------|------|---------------|--------|
| **1. Prospect** | `prospect` | Prospect Explore | Globe | Play fairway discovery & ToAC scaling | ✅ Active |
| **2. Well** | `well` | Well Context | Database | Truth Witness: Borehole & log analysis | ✅ Active |
| **3. Section** | `section` | Section View | Layout | Stratigraphic continuity & 2D correlation | 🔄 Placeholder |
| **4. Earth 3D** | `earth3d` | Earth 3D | Layers | Volumetric synthesis & seismic interpretation | ✅ Active |
| **5. Time 4D** | `time4d` | Time 4D | Clock | Basin evolution & play cycle timing | 🔄 Placeholder |
| **6. Physics** | `physics` | Physics Console | Zap | 888_JUDGE governance & state verification | ✅ Active |
| **7. Map** | `map` | Map Registry | Map | Transversal spatial fabric (Malay Basin Pilot) | ✅ Active |

**Seal Status:** Dimensions 1, 2, 4, 6, 7 are operational. Dimensions 3 and 5 are architectural placeholders ready for implementation.

---

## Four-Surface Platform

GEOX exposes all functionality through four unified surfaces:

| Surface | Path | Purpose | Protocol |
|---------|------|---------|----------|
| **Site** | `/` | Static React application | HTTPS |
| **WebMCP** | `/webmcp.manifest.json` | Browser capability discovery | JSON |
| **MCP** | `/mcp/` | FastMCP SSE server | Model Context Protocol |
| **A2A** | `/a2a/` | Agent-to-agent gateway | Agent2Agent Protocol |

**Platform URL:** `https://geox.arif-fazil.com`

---

## 888_JUDGE Governance Engine

The sovereign physics verification system at the heart of GEOX.

### How It Works

1. **Input:** Prospect + Well pair (e.g., `PROSPECT_ALPHA` + `W-101`)
2. **Process:** Multi-factor physics evaluation across dimensions
3. **Output:** `Verdict` with confidence, risk factors, and audit trail

### Verdict States

| State | Code | Meaning |
|-------|------|---------|
| **PROCEED** | Green | All clear, confidence ≥ threshold |
| **CAUTION** | Yellow | Proceed with documented risks |
| **HOLD** | Orange | 888_HOLD triggered, human review required |
| **VOID** | Red | Fatal violation, operation blocked |
| **SEAL** | Blue | 999_SEAL applied, record finalized |

### MCP Tools

| Tool | Purpose | Risk Level |
|------|---------|------------|
| `geox_judge_verdict` | Evaluate prospect/well pairs | GOVERNED |
| `geox_evidence_list` | List available evidence records | SAFE |
| `geox_evidence_get` | Retrieve specific evidence | SAFE |
| `geox_dimension_list` | List active dimensions | SAFE |

---

## Contract Schema Pack v1

Canonical type definitions synchronized across TypeScript and Python:

```typescript
// TypeScript (shared/contracts/schema-pack-v1.ts)
export const DimensionEnum = z.enum([
  "PROSPECT", "WELL", "SECTION", "EARTH_3D", "TIME_4D", "PHYSICS", "MAP"
]);

export const AppManifestSchema = z.object({
  id: z.string().regex(/^geox\.[a-z]+\.[a-z_]+$/),
  dimension: DimensionEnum,
  version: z.string(),
  capabilities: z.object({
    streaming: z.boolean(),
    governance: z.boolean()
  })
});
```

```python
# Python (arifos/geox/contracts/app_manifest.py)
class Dimension(str, Enum):
    PROSPECT = "PROSPECT"
    WELL = "WELL"
    SECTION = "SECTION"
    EARTH_3D = "EARTH_3D"
    TIME_4D = "TIME_4D"
    PHYSICS = "PHYSICS"
    MAP = "MAP"
```

**Principle:** Contracts defined before implementations to ensure cross-platform consistency.

---

## Malay Basin Pilot

Live demonstration dataset for the 7-dimension system.

### Evidence Records

| ID | Type | Location | Status |
|----|------|----------|--------|
| `PROSPECT_ALPHA` | Prospect | Malay Basin, Block X | Sealed |
| `W-101` | Well | Prospect Alpha flank | Sealed |
| `W-102` | Well | Prospect Alpha crest | Sealed |

### Physics Parameters

- **Reservoir Pressure:** 4,500 psi
- **Formation Temperature:** 285°F
- **Porosity:** 18-24%
- **Permeability:** 150-400 mD
- **Oil Gravity:** 38° API
- **Gas-Oil Ratio:** 850 scf/bbl

---

## 10-Tier Knowledge Organization (Legacy)

GEOX maintains the original 10-tier structure for knowledge categorization:

| Tier | Name | Purpose |
|------|------|---------|
| 00 | INDEX | Entry points and catalogs |
| 10 | THEORY | Foundational concepts (ToAC) |
| 20 | PHYSICS | Physical processes |
| 30 | MATERIALS | Substances and properties |
| 40 | TOOLS | Instruments and methods |
| 50 | CASES | Specific instances |
| 60 | GOVERNANCE | Rules and protocols |
| 70 | INTEGRATION | Cross-domain links |
| 80 | FEDERATION | External relationships |
| 90 | AUDITS | Verification records |

---

## Integration with arifOS

### Floor Mapping

| GEOX Concept | arifOS Floor | Purpose |
|--------------|--------------|---------|
| 888_JUDGE | F2 Truth | Verified physics claims |
| 888_HOLD | F6 Harm | Safety override |
| Evidence Store | F8 Grounding | Audit trail |
| Dimension Lock | F11 Coherence | Cross-platform sync |
| 999_SEAL | F1 Amanah | Final responsibility |

### Cross-Wiki Links

- `[[arifos::Floors]]` — Constitutional framework
- `[[arifos::Trinity_Architecture]]` — ΔΩΨ application
- `[[afforge::GEOX_Integration]]` — Build processes

---

## Current Status

### Active Components

- **7-dimension architecture:** Sealed and operational
- **Four-surface platform:** Site + WebMCP + MCP + A2A
- **888_JUDGE engine:** Physics verification live
- **Malay Basin Pilot:** Seeded evidence for testing
- **Contract Schema Pack v1:** TypeScript/Python sync

### Development Areas

- **Section View:** 2D stratigraphic correlation (placeholder)
- **Time 4D:** Basin evolution timeline (placeholder)
- **A2A Gateway:** Multi-agent coordination protocols

---

## Locations

### Development (Windows)
```
C:\ariffazil\GEOX\
├── shared/contracts/         # Schema Pack v1
├── src/
│   ├── components/           # React UI (7-dimension cockpit)
│   ├── services/             # geoxStore, MCP hooks
│   └── types/                # TypeScript types
├── agents/                   # A2A agent cards
└── scripts/                  # Seeding, testing
```

### Production (VPS)
```
/root/GEOX/                   # Primary deployment
/root/geox-platform/          # Four-surface static build
```

---

## For Agents

### Working With GEOX

1. **Respect dimensions** — Each analysis belongs to a specific dimension
2. **Use 888_JUDGE** — All physics claims must pass governance
3. **Honor 888_HOLD** — Safety is absolute
4. **Seek 999_SEAL** — Finalize verified knowledge
5. **Follow contracts** — Schema Pack v1 is canonical

### Common Tasks

**Trigger physics verdict:**
```
Target: prospect-well-001 + well-A12
Tool: geox_judge_verdict
Expected: Verdict with confidence ≥ 0.85
```

**Verify dimension sync:**
```
Check TypeScript: shared/contracts/schema-pack-v1.ts
Check Python: arifos/geox/contracts/app_manifest.py
Verify: Dimension enum values match exactly
```

---

## Changelog

| Date | Change | Seal |
|------|--------|------|
| 2026-04-10 | 10-tier knowledge system established | VAULT999 |
| 2026-04-11 | Four-surface platform + routing fixes | 999_SEAL |
| 2026-04-12 | 7-dimension seal + 888_JUDGE integration | v2026.04.12-EIC |

---

## Metadata

```yaml
---
type: Entity
subtype: Project
tags: [geox, earth-science, 7-dimensions, ToAC, 888_JUDGE, four-surface, mcp, a2a]
sources: [C:\ariffazil\GEOX, /root/GEOX, /root/geox-platform]
last_sync: 2026-04-12
confidence: 0.95
certainty_band: [0.90, 0.98]
epistemic_level: OBS
dimensions_sealed: [prospect, well, earth3d, physics, map]
dimensions_placeholder: [section, time4d]
arifos_floor: [F1, F2, F6, F8, F11, F13]
status: active
---
```

---

**Seal:** v2026.04.12-EIC | **Status:** 7-DIMENSION ACTIVE | **ΔΩΨ | ARIF**
