# MCP Primitive Correction — REFLECTION

**Date:** 2026-07-08
**From:** Arif (F13 SOVEREIGN)
**Verdict:** DRAFT_ONLY · Band: YELLOW
**Evidence:** L2 (MCP spec pages + FastMCP docs)

---

## What was wrong

The earlier design conflated three distinct MCP primitives into one prompt stack:

| What I wrote | What it actually is |
|---|---|
| 11-layer "prompt stack" trying to cover everything | Prompts govern cognition (adab), Resources supply evidence (tanah), Tools execute action (tangan) |
| Tool descriptions treated as safety boundaries | Tool descriptions are model-facing hints — runtime gates are the real safety |
| Prompts as the enforcement mechanism | Prompts shape cognition; enforcement is in schemas, runtime checks, leases, judgment tools |

The error: treating MCP prompts as if they could carry the full weight of constitutional governance. They cannot. Prompts are the **adab of thought** — they shape reasoning, not reality.

---

## The correct MCP primitive separation

```
PROMpts = adab = how to think = model-facing cognitive templates
RESOURCES = tanah = what is = evidence / state / context substrate
TOOLS = tangan = what to do = executable capabilities with blast radius
```

**Prompts** — user-controlled, shape cognition, no side effects
**Tools** — model-controlled with policy gates, execute external effects
**Resources** — application-driven, supply context, read-only URIs

---

## The three control models

| Primitive | Control | FastMCP method | arifOS role |
|---|---|---|---|
| Prompts | **User-selected** | `get_prompt()` | Cognitive templates — think in this shape |
| Tools | **Model-controlled** with policy | `call_tool()` | Action capabilities — do this with consequence |
| Resources | **Application-driven** | `read_resource()` | Evidence surface — here is state you may inspect |

---

## The hard arifOS rules

```
Prompt ≠ Tool
  Prompt: shapes reasoning — "think in this governed shape"
  Tool: executes capability — "do this with authority and receipt"

Tool ≠ Resource
  Tool: operation — mutation or computation
  Resource: information — read-only state or evidence

Prompt ≠ Resource
  Prompt: reusable instruction pattern
  Resource: reusable context/data
```

---

## What this means for the 8-prompt design

The 8 canonical prompts in REGISTRY.yaml are **correct as cognitive templates** — they govern HOW the model thinks. But they must NOT be treated as enforcement. Each prompt is:

```
arif_reality_loop     — think through the 000-999 loop
arif_evidence_audit   — classify claims by evidence layer
arif_autonomy_gate    — what autonomy band is this action?
arif_organ_route     — route to correct organ
arif_judgment_brief   — prepare brief for arifOS judge
arif_vault_receipt_draft — draft receipt before sealing
arif_counter_hantu    — detect hallucination patterns
arif_maruah_check    — dignity/peace/HEART check
```

These are the **adab** — the manners and conduct of thought. They do not execute. They do not mutate. They are pure cognition governance.

The enforcement comes from:
- **Tools** with proper schemas, authority gates, reversibility tags, blast_radius
- **Resources** with provenance, staleness, evidence layer
- **Runtime** gates: leases, judgment path, seal path

---

## Malay/English civilizational framing

```
Tanah dulu — read the ground before you act
Adab dulu — set the manners before you think
Tangan terakhir — the hand acts only after tanah and adab are done
```

The geological analogy Arif gave: do not drill because the map looks good. First classify seismic quality, trap risk, pressure uncertainty, economics, environmental consequence, and authority to drill.

The capital analogy: do not allocate because the thesis is elegant. Mark liquidity, downside, time horizon, reversibility, and mandate.

The governance analogy: no official may spend sovereign power without mandate. Same for agents.

---

## What remains DRAFT

The REGISTRY.yaml is a **design draft** — it shows what the 8 cognitive templates should look like as YAML. But it is NOT:
- Written to the arifOS prompts registry
- Deployed to production
- Hot-reloaded into the running server

Server restart is required to pick up any prompt changes. That requires 888_HOLD.

---

## Status

| Item | Status |
|---|---|
| REGISTRY.yaml (design draft) | Written to forge_work — DRAFT only |
| 8 prompts NOT registered | Await F13 decision |
| Server NOT restarted | Await 888_HOLD |
| Gap analysis | Written — current vs design |
| MCP primitive correction | Acknowledged and documented here |
