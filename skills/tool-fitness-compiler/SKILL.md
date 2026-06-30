---
name: tool-fitness-compiler
version: 1.0.0
description: >
  Compute digital fitness scores for MCP tools and classify into fiqh categories
  (wajib/sunat/makruh/harus/haram). Produces keep/kill/route recommendations.
trigger: >
  Use when auditing a tool surface for entropy, deciding which tools to keep/kill/route,
  or when the system feels chaotic and needs data-driven pruning.
do_not_use: >
  When you already know what to change (just change it). When the task is about
  tool implementation, not tool governance.
---

# Tool Fitness Compiler

## Purpose

Computes digital fitness for every MCP tool in an organ and classifies each into
fiqh categories (wajib/sunat/makruh/harus/haram). The output is a structured
report with keep/kill/route recommendations.

## The Fitness Law

```
F = (Value × Adoption) / (Entropy × BlastRadius × CognitiveCost)
```

Each component is a normalized multiplier (not a raw scalar):

| Component | Range | What It Measures |
|-----------|-------|-----------------|
| **Value** | 0.5–1.0 | Purpose uniqueness (1.0 = unique, 0.5 = redundant) |
| **Adoption** | 0.2–0.95 | Estimated usage frequency from tool class |
| **Entropy** | 1.0–3.0 | Noise: aliases, schema ambiguity, vague descriptions |
| **BlastRadius** | 1.0–2.0 | Risk label: R0=1.0, R1=1.1, R2=1.3, R3=1.5, R4=1.8, R5=2.0 |
| **CognitiveCost** | 1.0–2.0 | Understanding difficulty: params, description, reversibility |

Typical range: 0.05 (haram) to 0.8 (wajib). Mean ~0.4 for healthy surfaces.

## Fiqh Classification

| F Score | Fiqh | Action |
|---------|------|--------|
| F ≥ 0.8 | **Wajib** | KEEP — critical infrastructure |
| 0.5 ≤ F < 0.8 | **Sunat** | KEEP — recommended, increases wisdom |
| 0.2 ≤ F < 0.5 | **Harus** | KEEP — permissible, monitor for drift |
| 0.05 ≤ F < 0.2 | **Makruh** | ROUTE or MERGE — discouraged, increases entropy |
| F < 0.05 | **Haram** | KILL — breaks substrate physics |

## Inputs

- `affordances.yaml` — tool metadata (reads, writes, risk_label, destructive, reversible)
- `alias_registry.json` — alias mappings (if available)
- `mcp_audit.jsonl` — usage logs (if available)
- `mcp.json` or `server.json` — canonical tool list

## Outputs

- Per-tool fitness score + fiqh classification
- Aggregate organ fitness (mean, median, entropy delta)
- Keep/kill/route recommendations
- Entropy hotspots (tools with high alias count or ambiguous schemas)

## Procedure

1. Load affordance cards for the target organ
2. Load alias registry (if exists)
3. Load audit logs (if exists, else estimate adoption from tool class)
4. Compute per-tool fitness scores
5. Classify into fiqh categories
6. Generate recommendations
7. Output structured report

## Implementation

Run: `python3 /root/.agents/skills/tool-fitness-compiler/fitness_compiler.py --organ <organ>`

Or call via MCP: `forge_fitness_compile(organ="aforge")`
