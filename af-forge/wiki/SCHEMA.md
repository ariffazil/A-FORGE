# AF-FORGE Wiki Constitution

> **Authority**: Muhammad Arif bin Fazil  
> **Version**: 2026.04.10  
> **Pattern**: Karpathy-style persistent LLM wiki for VPS infrastructure and components  
> **Motto**: *DITEMPA BUKAN DIBERI*

AF-FORGE is the **infrastructure wiki** for the VPS, services, operational rituals, components, failures, and recovery knowledge that keep the machine useful.

It is not the constitutional kernel itself, and it is not the Earth-domain model.
It is the forge floor, the machine room, the build memory.

## Core idea

AF-FORGE follows the persistent wiki pattern:
- **raw/** = immutable source material
- **wiki/** = synthesized operational knowledge
- **SCHEMA.md** = maintenance law for the wiki
- **index.md** = content-oriented entry point
- **log.md** = chronological history of ingests, fixes, and audits

The wiki should compound over time.
Answers that matter should survive as pages, not evaporate in chat.

## Scope

AF-FORGE covers:
- VPS topology
- containers and services
- ports, domains, networks, compose boundaries
- operational rituals and runbooks
- dependencies and tooling surfaces
- cracks, incidents, and recovery logic
- cross-links into arifOS and GEOX where needed

AF-FORGE does **not** replace:
- **arifOS wiki** for constitutional/runtime philosophy
- **GEOX wiki** for Earth/domain truth

## Directory structure

```text
wiki/
  SCHEMA.md            # this file
  index.md             # content-oriented map
  log.md               # append-only history
  raw/                 # immutable source copies
  00_OPERATORS/        # people, roles, sovereign/operator runbooks
  10_RITUALS/          # repeatable operational procedures
  20_BLUEPRINTS/       # architecture and component maps
  30_ALLOYS/           # dependencies and pinned surfaces
  40_HAMMERS/          # tools and operational tooling
  50_CRACKS/           # failures, risks, broken states
  60_TEMPERATURES/     # live status and machine telemetry snapshots
  70_SMITH_NOTES/      # judgment, lessons, heuristics
  80_FEDERATION/       # relationships with arifOS/GEOX/other systems
  90_AUDITS/           # sealed audits, manifests, historical records
```

## Page types

Recommended frontmatter for wiki pages:

```yaml
---
type: Operator | Ritual | Blueprint | Alloy | Hammer | Crack | Temperature | SmithNote | Federation | Audit | Meta
tags: [tag1, tag2]
sources: [raw/README.md, raw/MAP.md]
last_sync: 2026-04-10
confidence: 0.90
status: active | draft | sealed | superseded
operator: Arif | agent-name
---
```

Not every page needs every field, but **type, tags, sources, last_sync, confidence** should be standard.

## Page standards

### F2 Truth
- Claims about the VPS or components should cite files in `wiki/raw/` or direct observed state.
- If a page is based on live observation, say that clearly.
- If confidence is partial, say so.

### F9 Contradictions
- Surface drift instead of smoothing it over.
- Example: “compose says X, running container state says Y”.

### F11 Audit
- Any meaningful wiki change should add a note to `log.md`.

### F1 Reversibility
- Runbooks must describe rollback where relevant.
- Do not mix irreversible commands into “safe” rituals.

## Workflows

### Ingest
1. Copy source material into `wiki/raw/`.
2. Update or create synthesis pages under the right section.
3. Update `index.md` if a new page matters to navigation.
4. Append a dated note to `log.md`.

### Query
1. Read `index.md` first.
2. Follow relevant section pages.
3. Use raw sources when claims need grounding.
4. If a useful answer is novel and durable, write it back into the wiki.

### Lint
Periodically check for:
- dead links
- index drift
- pages mentioned but missing
- stale telemetry snapshots
- cracks that are resolved but still marked active

## Relationship to the other wikis

- **arifOS wiki** answers: what governs actions?
- **GEOX wiki** answers: what is physically true in Earth reasoning?
- **AF-FORGE wiki** answers: what is running, how it is wired, how to operate it, and what broke.

## One-line law

AF-FORGE is the persistent operational wiki for the VPS and its components: grounded, auditable, reversible, and maintained as a compounding artifact.
