---
type: Documentation
title: OKF Overlay — How to Use
description: This directory is an Open Knowledge Format (OKF) overlay for the arifOS federation. It provides an OKF-compliant entry layer that points into the existing markdown doc graph without rewriting it.
tags: [okf, interoperability, documentation]
timestamp: 2026-07-20T08:00:00Z
links:
  - index.md
  - organs/arifos.md
  - atlas333.md
---
# OKF Overlay — arifOS Federation

## What This Is

This `/root/okf/` directory is an **OKF-compliant entry layer** for the arifOS federation. It follows the [Open Knowledge Format](https://openknowledgeformat.com) spec (v1.0, June 2026) to enable:

- **External agent discovery** — AI agents can find federation concepts via OKF tools
- **Cross-org interoperability** — Share knowledge boundaries without exposing internals
- **Version-controlled knowledge** — Git-diffable, portable, no SDK required

## What This Is NOT

- ❌ A rewrite of the 900+ existing markdown files
- ❌ A migration project
- ❌ A replacement for existing index systems

## How to Extend

1. **Adding an organ or subsystem?** Create a new `.md` file in the appropriate subdirectory with OKF frontmatter (required: `type`; optional: `title`, `description`, `tags`, `resource`, `timestamp`)
2. **Linking concepts?** Use relative markdown links `[target](/path/to/target.md)`
3. **Needs validation?** Run `okf validate /root/okf/` if OKF CLI tools are available

## OKF Type Taxonomy (Federation-Specific)

| OKF Type | Our Analogue | Used For |
|----------|-------------|----------|
| `System` | Organ, MCP server | arifOS, GEOX, A-FORGE |
| `Specification` | Protocol, canon | ATLAS333, GENESIS docs |
| `Documentation` | Index, guide | README, overlay entry point |
| `Runbook` | Ops guide | RUNBOOK.md |
| `Configuration` | Identity, manifest | identity.toml, organ.yaml |
| `Metric` | Service health | Organ /health endpoints |
