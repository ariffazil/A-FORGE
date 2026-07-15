# A-FORGE Federation Alignment Receipt

**When:** 2026-07-08T23:47:20.650901+00:00  
**Doctrine locked:** Kernel Verbs = law · A-FORGE = hands · MCP tools = envelope

## Delivered (Directive 1–5)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Unique capability surface per tool | **DONE** — 99 unique `aforge.{class}.{name}` |
| 1 | Affordance class declared | **DONE** — shell/fs/git/docker/browser/vps/execute/probe/registry/health/vault/… |
| 2 | Map to AAA kernel verbs 000→999 | **DONE** — `kernel_verb` + `kernel_wire` per tool |
| 2 | Lease/gate conditions exposed | **DONE** — gates object + ACTUATOR description header |
| 3 | Unrestricted logical access | **DONE** — all 99 in tools/list; missing cards filled; deny via gate only |
| 4 | OBSERVE: SESSION+GATE | **DONE** — min_mode THINK, no human approval |
| 4 | MUTATE: SESSION+LEASE+GATE(+SEAL) | **DONE** — GOVERN + requires_human_approval + lease flags |
| 5 | Registry clarity / not plugins | **DONE** — 99/99 descriptions start with ACTUATOR |

## Runtime proof
- `tools/list`: 99 tools, **99 ACTUATOR** prefixes
- A-THINK: **99 affordance cards** loaded
- OBSERVE allow: `forge_filesystem_read`, `forge_vps_services`, `forge_probe` → ALLOWED
- MUTATE hold: `forge_execute`, `forge_git`, `forge_filesystem_write` → HOLD (human/lease/SEAL path)
- Host impact still live: `forge_shell` SEAL + execute

## Files
- `/root/A-FORGE/a_think/affordances.yaml` (99 cards)
- `/root/A-FORGE/a_think/federation_alignment_registry.json`
- `/root/A-FORGE/forge_work/2026-07-08/AFORGE-FEDERATION-ALIGNMENT-REGISTRY.json`
- `/root/A-FORGE/forge_work/2026-07-08/KERNEL-VERB-TABLE.md`
- `/root/A-FORGE/forge_work/2026-07-08/AFORGE-ACTUATOR-DESCRIPTIONS.md`
- `/root/A-FORGE/src/domain/registry/federationAlignment.ts`
- `core.ts` description enrichment on registerTool + tool()

## Services restarted
- `a-forge.service` (7071 sense)
- `a-forge-mcp.service` (7072 MCP)

## Canonical one-liner
> Kernel Verbs = constitutional primitives; A-FORGE tools = execution actuators. MCP “tools” = envelope only.
