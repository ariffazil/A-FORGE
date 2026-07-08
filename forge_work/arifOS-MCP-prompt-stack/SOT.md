# arifOS MCP Prompt Architecture — SOT

**Verdict:** DRAFT_ONLY · **Band:** YELLOW · **Evidence:** L2 (MCP spec + FastMCP docs)
**Author:** FORGE (000Ω) for Arif (F13 SOVEREIGN)
**Date:** 2026-07-08
**Location:** `/root/A-FORGE/forge_work/arifOS-MCP-prompt-stack/`

---

## The three MCP primitives

MCP defines three primitives. They are not interchangeable:

```
Prompts  = adab     = how to think     = user-controlled cognitive templates
Resources = tanah    = what is         = evidence / state / context substrate
Tools    = tangan   = what to do      = executable capabilities with blast radius
```

| Primitive | Control | FastMCP method | arifOS role |
|---|---|---|---|
| Prompts | User-selected | `get_prompt()` | Cognitive templates — think in this shape |
| Tools | Model-controlled + policy | `call_tool()` | Action capabilities — do this with consequence |
| Resources | Application-driven | `read_resource()` | Evidence surface — here is state you may inspect |

Prompts are not enforcement. Enforcement is in schemas, runtime gates, leases, and judgment tools.

---

## The 8 canonical cognitive templates

These are prompts — cognitive templates for governed reasoning:

| Prompt | Purpose |
|---|---|
| `arif_reality_loop` | Run the 000-999 reality engineering loop |
| `arif_evidence_audit` | Classify claims by L1-L4 evidence layer |
| `arif_autonomy_gate` | Classify autonomy band (GREEN/YELLOW/ORANGE/RED/BLACK) |
| `arif_organ_route` | Route to correct organ (AAA/arifOS/A-FORGE/GEOX/WEALTH/WELL/VAULT999/F13) |
| `arif_judgment_brief` | Prepare F1-F13 brief for arifOS judge |
| `arif_vault_receipt_draft` | Draft VAULT999 receipt (DRAFT_RECEIPT ≠ SEAL) |
| `arif_counter_hantu` | Detect hallucinated authority/tools/facts/seals |
| `arif_maruah_check` | Human dignity, peace, and HEART check |

---

## Gap vs current deployed prompts

Current server has 8 prompts (000_init, 111_sense, 333_reason, 555_critique, 666_judge, 777_forge, 999_seal, arifosmcp_loop_engineer) — stage-based paradigm.

Design calls for 8 purpose-built prompts — different paradigm. Gap is structural, not cosmetic.

---

## Status

| Item | Status |
|---|---|
| Design draft (REGISTRY.yaml) | Written — DRAFT_ONLY |
| Production prompts | Unchanged — requires server restart + 888_HOLD |
| Server restart | Pending — 888_HOLD required |
| Production deployment | Not authorized |

---

## The geological analogy

Do not drill because the map looks good. First classify seismic quality, trap risk, pressure uncertainty, economics, environmental consequence, and authority to drill.

arifOS treats every digital action like a subsurface intervention: model first, test next, drill only under permit.

---

## Reference

- MCP spec: https://modelcontextprotocol.io/specification/2025-11-25
- FastMCP prompts: https://gofastmcp.com/clients/prompts
- REGISTRY.yaml: full YAML templates for all 8 prompts
- REFLECTION.md: what changed vs the 11-prompt design, and why
