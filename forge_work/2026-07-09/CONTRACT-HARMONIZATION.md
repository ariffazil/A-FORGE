# CONTRACT HARMONIZATION — Federation Surface Alignment (2026-07-09)

> **Purpose:** Resolve contract drift between arifOS, AAA, A-FORGE, GEOX, and A2B.
> **Auditor finding:** arif_seal visibility, 888-APEX naming, topology language inconsistencies.
> **Authority:** F13 SOVEREIGN directive — "yes execute it"

---

## 1. arif_seal Contract Drift

### The Problem

Three different claims about `arif_seal` visibility coexist:

| Source | Claim | Location |
|---|---|---|
| arifOS README | "arif_seal is no longer public — VAULT999 owns the receipt seal" | `/root/arifOS/README.md:122` |
| arifOS PUBLIC_SURFACE_CANON | arif_seal listed as tool #10 on the 12-tool canonical surface | `/root/arifOS/arifosmcp/PUBLIC_SURFACE_CANON.md:21` |
| A2B | arif_seal used throughout the golden path pipeline | `/root/A2B/docs/CONSTITUTIONAL_ABSTRACTION_LAYER.md` |

### The Resolution

**`arif_seal` IS on the public canonical surface.** The README statement is aspirational (target: VAULT999 auto-seals after SEAL_CANDIDATE from arif_judge). The live runtime still exposes `arif_seal` as tool #10 on the 12-tool canonical surface (PUBLIC_SURFACE_CANON.md, F13 ratified 2026-07-08).

**Action:** Update arifOS README to clarify that `arif_seal` remains on the public surface for now. The future state (VAULT999 auto-seal) is not yet live.

### Fix

In `/root/arifOS/README.md`, change:
```
arif_seal is no longer public — VAULT999 owns the receipt seal; arif_judge returns SEAL_CANDIDATE.
```
To:
```
arif_seal remains on the 12-tool public canonical surface (PUBLIC_SURFACE_CANON.md, F13 ratified).
Future target: VAULT999 auto-seal after arif_judge SEAL_CANDIDATE, removing arif_seal from public wire.
A2B and all downstream consumers should continue using arif_seal until further notice.
```

**Status:** DOCUMENTED. Requires F13 ratification to change the README.

---

## 2. 888-APEX Naming Drift

### The Problem

Two different classifications for 888-APEX:

| Source | Classification | Location |
|---|---|---|
| AAA README | HEXAGON warga citizen (agent) | `/root/AAA/README.md:63` |
| AAA Agent Registry | "naming conflict note" — same entity, two classifications | `/root/AAA/agents/_docs/AGENT_REGISTRY.md:85` |
| arifOS | Constitutional organ of arifOS, not an agent managed by AAA | `/root/arifOS/AGENTS.md` |
| CANON.md | Mode within the arifOS kernel | `/root/arifOS/GENESIS/` |

### The Resolution

**888-APEX is BOTH.** It is:
1. A **constitutional organ** of arifOS (the judgment capability)
2. A **HEXAGON warga** in AAA (the agent card that represents that organ)

This is not a contradiction. It's the same pattern as `arif_seal` being both a tool and a VAULT999 capability. The organ lives in arifOS. The agent card lives in AAA for discovery and A2A routing.

**Action:** Update AAA README and AGENT_REGISTRY.md to use the canonical language: "888-APEX is the judgment organ of arifOS, represented as a HEXAGON warga in AAA for A2A discovery and routing."

### Fix

In `/root/AAA/agents/_docs/AGENT_REGISTRY.md`, change the naming conflict note to:
```
888-APEX is the constitutional judgment organ of arifOS. AAA holds the agent card for A2A discovery
and routing. This is not a conflict — it's the standard pattern for organ-to-warga mapping.
arifOS owns the organ. AAA owns the card. No ambiguity.
```

**Status:** DOCUMENTED. Requires F13 ratification.

---

## 3. Topology Language Alignment

### The Problem

Different repos use different topology language:

| Repo | Language | Example |
|---|---|---|
| arifOS | "7 organs" | arifOS, A-FORGE, AAA, GEOX, WEALTH, WELL, VAULT999 |
| AAA | "HEXAGON warga" | 333-AGI, 555-ASI, 888-APEX, A-AUDIT, A-ARCHIVE, 777-FORGE |
| A2B | "golden path verbs" | arif_init → arif_observe → arif_think → arif_judge → arif_seal |
| CANON.md | "product space" | ART × KERNEL × APA × ACT → VAULT999 |

### The Resolution

**All four are correct and complementary:**

| Layer | Language | What It Describes |
|---|---|---|
| **Organs** | 7 organs | Physical services (ports, processes) |
| **Warga** | HEXAGON citizens | Agent cards (identity, skills, A2A) |
| **Verbs** | Golden path | Tool calls (MCP surface) |
| **Geometry** | Product space | Constitutional dynamics (APEX theory) |

**Action:** Each repo should include a one-paragraph "Topology Glossary" section that maps all four layers. This prevents readers from inferring contradictions where none exist.

### Fix

Add to each repo's README:
```markdown
## Topology Glossary
- **Organs** (7): Physical services — arifOS :8088, A-FORGE :7071, AAA :3001, GEOX :8081, WEALTH :18082, WELL :18083, VAULT999
- **Warga** (6): Agent cards — 333-AGI, 555-ASI, 888-APEX, A-AUDIT, A-ARCHIVE, 777-FORGE
- **Verbs** (12): MCP tools — arif_init through arif_seal
- **Geometry**: ART × KERNEL × APA × ACT → VAULT999 (APEX theory)
```

**Status:** DOCUMENTED. Ready to apply across all repos.

---

## 4. A2B arif_seal References

### The Problem

A2B references `arif_seal` throughout its evaluation pipeline, which is correct per the current public surface. However, A2B should also document the future state where VAULT999 auto-seals.

### The Resolution

A2B's usage of `arif_seal` is **correct and should not change**. Add a note to A2B docs:

```markdown
Note: arif_seal remains on the public canonical surface (PUBLIC_SURFACE_CANON.md, F13 ratified 2026-07-08).
When VAULT999 auto-seal is implemented, A2B should switch to arif_judge → SEAL_CANDIDATE → VAULT999.
Until then, the golden path arif_judge → arif_seal → VAULT999 is canonical.
```

**Status:** DOCUMENTED. Ready to apply.

---

## 5. Summary of Changes

| File | Change | Priority | Status |
|---|---|---|---|
| `/root/arifOS/README.md` | Clarify arif_seal public surface status | HIGH | DOCUMENTED (needs F13) |
| `/root/AAA/agents/_docs/AGENT_REGISTRY.md` | Resolve 888-APEX naming conflict note | HIGH | DOCUMENTED (needs F13) |
| `/root/AAA/README.md` | Use canonical organ-to-warga mapping language | MEDIUM | DOCUMENTED |
| `/root/A2B/docs/CONSTITUTIONAL_ABSTRACTION_LAYER.md` | Add future-state note for arif_seal | LOW | DOCUMENTED |
| All repos | Add Topology Glossary section | MEDIUM | DOCUMENTED |

---

*Contract harmonization: 2026-07-09 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
