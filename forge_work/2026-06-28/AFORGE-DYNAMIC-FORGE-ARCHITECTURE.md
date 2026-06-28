# A-FORGE as Forge — Dynamic Capability Generation Architecture
> Crystallised 2026-06-28 from the EUREKA loop.
> DITEMPA BUKAN DIBERI — the forge generates what it needs.

---

## The Insight

A static toolbox predicts every capability in advance and builds it. AGI forges the capability it needs, when it needs it, governed by law.

**73 tools = a toolbox. 4 tools + forge_skill = a forge.**

---

## The Loop

```
INTENT arrives
      │
arifOS JUDGES — is this lawful?
      │ SEAL
      ▼
A-FORGE: do I have a tool for this?
      │
      ├── YES → forge_execute (existing tool)
      │
      └── NO  → forge_skill (generate the tool)
                    │
                    ├── LLM generates tool code
                    ├── Layer 1: HARAM scan on generated code
                    ├── Schema validation
                    ├── Layer 3: constitutional gate
                    ├── Register to ToolRegistry
                    ├── Seal to VAULT999
                    ├── Execute immediately if requested
                    └── Tool now exists for future use
```

## The 4 Permanent Tools

| Tool | Function | Invariant |
|------|----------|-----------|
| **forge_execute** | Run any tool (existing or just-forged) | Requires seal_verdict_id |
| **forge_skill** | Forge new capability on demand, gate it, register it | Cannot modify forge_skill itself |
| **forge_probe** | Federation health | Read-only |
| **forge_registry** | What tools exist right now (dynamic, fingerprinted) | Returns generated tools too |

## forge_skill Invariants

- ❌ Generated tool cannot modify forge_skill itself
- ❌ Generated tool cannot modify ToolRegistry directly
- ❌ Generated tool cannot bypass Layer 1–4 gate
- ❌ Generated tool cannot write to VAULT999 without seal_verdict_id
- ✅ Every generated tool sealed to VAULT999 before first execution
- ✅ Generated tool schema fingerprinted at creation
- ✅ HARAM pattern scan before registration
- ✅ Human ack required if irreversible domain

## Skill vs Tool

| | Tool | Skill |
|---|---|---|
| Scope | Single capability | Reusable pattern |
| Lifetime | Permanent in registry | Permanent in skill store |
| Who calls | Agent via MCP | Agent via forge_skill |
| Generation | Human-built | AI-forged, human-gated |
| Example | `forge_shell` | "parse LAS and return PHIE curve" |

## Build Order

| Priority | What | Why |
|----------|------|-----|
| **P0** | `forge_skill` — the meta-tool | Missing piece. Without it, A-FORGE is a static toolbox. |
| **P1** | `forge_registry` — dynamic, fingerprinted | Returns generated tools. Schema drift detection. |
| **P2** | `forge_execute` — route to generated tools | Must handle both static and runtime-generated tools. |
| **P3** | Skill store integration → Qdrant | Cross-session persistence of generated tools. |

## Revised Identity

> **"Constitutional execution forge that generates its own capabilities on demand, governed by law, sealed to permanent record."**

Not a toolbox. A forge.
