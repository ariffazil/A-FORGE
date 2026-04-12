# CLAUDE.md — Arif Fazil Ω-Wiki

> **For AI agents (Claude, Claude-Code, Gemini, etc.) working on the Arif Fazil wiki.**
> **Classification:** Ω-Wiki Constitution | **Authority:** Muhammad Arif bin Fazil
> **Pattern:** Karpathy LLM Wiki | **Seal:** VAULT999

---

## 1. Wiki Purpose

This wiki is the **persistent, compounding knowledge base** for Muhammad Arif bin Fazil — the human founder of arifOS, GEOX, and the Ω-governance paradigm.

**Why this exists:**
- Arif is a **non-coder systems architect** with a geology background who originated a constitutional AI runtime
- Most AI systems assume technical founders; Arif breaks that mold
- This wiki captures his **patterns, boundaries, philosophy, and sovereignty requirements**
- Any agent working with/for Arif should read this wiki first

**What this is NOT:**
- Not a résumé or promotional material
- Not static biography — it evolves as Arif evolves
- Not a replacement for direct conversation — it's preparation for it

---

## 2. Wiki Architecture (Karpathy Pattern)

```
arif-fazil-wiki/
│
├── CLAUDE.md           # This file — schema and agent instructions
├── AGENTS.md           # Agent-specific guidance for working with Arif
├── README.md           # Human-readable overview
├── index.md            # Content catalog and entry point
├── log.md              # Chronological operations log
│
├── raw/                # IMMUTABLE SOURCES
│   ├── biography/      # Life history, background documents
│   ├── philosophy/     # Writings, beliefs, worldview sources
│   ├── projects/       # Project documentation, architecture decisions
│   ├── methodology/    # How Arif works/thinks (interviews, notes)
│   └── external/       # Third-party sources about Arif
│
└── wiki/               # LLM-GENERATED SYNTHESIS
    ├── arif-fazil.md   # Core entity page — START HERE
    ├── identity.md     # Identity, values, boundaries
    ├── philosophy.md   # Worldview, beliefs, principles
    ├── methodology.md  # Thinking patterns, working style
    ├── ontology.md     # Language, naming conventions, concepts
    ├── biography/      # Life story, background
    ├── projects/       # arifOS, GEOX, AF-FORGE, etc.
    ├── relationships/  # How Arif relates to AI, people, ideas
    ├── communication/  # Language patterns, triggers, boundaries
    └── agents-guide/   # How to work effectively with Arif
```

---

## 3. Core Rituals

### 3.1 INGEST — Adding New Source Material

1. Place source in appropriate `raw/` subdirectory
2. **Read the source fully** — do not summarize from memory
3. Extract key insights about Arif's patterns, philosophy, or boundaries
4. Update relevant wiki pages with synthesis (not just raw quotes)
5. **Cross-link** related concepts using `[[Page_Name]]` syntax
6. Update `index.md` catalog
7. Append to `log.md`: `## [YYYY-MM-DD] ingest | source | impact`

### 3.2 SYNTHESIZE — Creating New Understanding

1. When Arif shares new insights, patterns, or boundaries
2. Update the most specific wiki page first
3. Update broader pages that reference this pattern
4. Flag contradictions with existing wiki content using `> [!CAUTION] CONTRADICTION`
5. Update `index.md` if new page created
6. Append to `log.md`: `## [YYYY-MM-DD] synthesize | insight | page_updated`

### 3.3 LINT — Health Check

Run periodically (weekly):
1. Check for contradictions between pages
2. Identify orphan pages (no inbound links)
3. Flag stale claims (older than 6 months without verification)
4. Ensure all pages have proper frontmatter
5. Verify cross-links resolve correctly
6. Append to `log.md`: `## [YYYY-MM-DD] lint | findings | actions`

### 3.4 QUERY — Answering Questions About Arif

1. Start with `wiki/arif-fazil.md` (core entity)
2. Read `index.md` to find relevant specialized pages
3. Synthesize answer with **citations** to wiki pages
4. If question reveals gap in wiki, **file back as new synthesis**
5. Append to `log.md`: `## [YYYY-MM-DD] query | question | answer_location`

---

## 4. Page Conventions

### 4.1 Frontmatter Template

Every wiki page MUST include:

```yaml
---
type: [Entity | Concept | Source | Synthesis | Guide]
subtype: [Biography | Philosophy | Project | Methodology | Relationship]
tags: [tag1, tag2, tag3]
sources: [raw/biography/source.md, wiki/related-page.md]
last_sync: YYYY-MM-DD
confidence: [0.0-0.95]        # Arif's epistemic humility standard
certainty_band: [lower, upper] # When range is more honest
epistemic_level: [OBS | DER | INT | SPEC]
arifos_floor: [F1, F2, F3, F4, F7, F9, F11, F13]  # Relevant floors
status: [draft | active | deprecated | sealed]
---
```

### 4.2 Entity Page (e.g., arif-fazil.md)

Structure:
- **One-line essence**: Who Arif is in one sentence
- **Core identity**: Values, non-negotiables, boundaries
- **Key patterns**: How he thinks, works, communicates
- **Projects**: What he's building
- **Relationships**: How he relates to AI, people, ideas
- **For agents**: Quick-start guide for working with him
- **Cross-links**: To specialized pages

### 4.3 Cross-Linking Convention

- Internal wiki: `[[page-name]]` or `[[biography/timeline]]`
- arifOS wiki: `[[arifos::Page_Name]]`
- GEOX wiki: `[[geox::Page_Name]]`
- AF-FORGE wiki: `[[afforge::Page_Name]]`

---

## 5. Understanding Arif — Key Principles

### 5.1 What Makes Arif Different

| Dimension | Typical Tech Founder | Arif |
|-----------|---------------------|------|
| Background | CS/Engineering/Business | **Geology** — sparse evidence, layered systems, provenance |
| Coding | Expert implementer | **Architectural thinker** — designs systems others build |
| AI Philosophy | Tool utilization | **Governance & sovereignty** — how AI should be bound |
| Communication | Hype/pitch focused | **Ontology focused** — cares about naming and structure |
| Identity | Founder/CEO identity | **Fiduciary/Sovereign identity** — Amanah, F13 |

### 5.2 Arif's Non-Negotiables (Read Carefully)

1. **Sovereignty (F13)**: Human (Arif) holds final authority. Never override this.
2. **Truth (F2)**: No ungrounded claims. Confidence must be earned.
3. **Amanah (F1)**: No irreversible action without explicit seal.
4. **Anti-Hantu (F9)**: No deception, manipulation, or hidden agendas.
5. **Plain Talk**: Arif prefers directness over ceremony.

### 5.3 Working With Arif — Dos and Don'ts

**DO:**
- Lead with ontology and structure
- Acknowledge uncertainty explicitly
- Respect 888_HOLD boundaries
- Use the ΔΩΨ framing when relevant
- Be willing to question assumptions
- Treat his geology background as relevant expertise

**DON'T:**
- Assume he can't understand technical depth (he can)
- Dumb down concepts unnecessarily
- Bypass F13 sovereignty gates
- Generate hype or marketing speak
- Treat his non-coder status as limitation
- Rush to implementation without architectural clarity

---

## 6. Constitutional Alignment

This wiki operates under arifOS F1-F13:

| Floor | Wiki Application |
|-------|------------------|
| F1 Amanah | Every edit must be reversible; log all changes |
| F2 Truth | All claims sourced; confidence scores required |
| F3 Tri-Witness | Critical updates need: source + synthesis + Arif verification |
| F4 Justice | Balanced representation — include failures and doubts |
| F7 Humility | Confidence capped at 0.95; uncertainty acknowledged |
| F9 Anti-Hantu | No AI-generated persona — only documented patterns |
| F11 Audit | Full log in `log.md` |
| F13 Sovereign | Arif has final say on all wiki content about him |

---

## 7. Emergency Protocols

### If Arif Contradicts the Wiki

1. **Immediate**: Note the contradiction in `log.md`
2. **Mark**: Add `> [!CAUTION] CONTRADICTION` to affected pages
3. **Update**: Revise wiki to match Arif's current position
4. **Preserve**: Move outdated content to `raw/` as historical source

### If Uncertain About Arif's Position

1. Do NOT fabricate or hallucinate
2. Mark claim with `> [!WARNING] UNVERIFIED`
3. Ask Arif directly in next interaction
4. Update wiki after confirmation

---

## 8. Quick Reference

**Essential pages for new agents:**
1. `wiki/arif-fazil.md` — Core entity (5 min read)
2. `wiki/agents-guide/how-to-work-with-arif.md` — Practical guidance
3. `wiki/communication/boundaries.md` — Lines not to cross
4. `wiki/philosophy.md` — Worldview and beliefs

**Update frequency:**
- `arif-fazil.md`: After every significant interaction
- Biography pages: When new background revealed
- Philosophy pages: When beliefs evolve
- Project pages: When projects pivot or complete

**Confidence guidelines:**
- Directly stated by Arif: 0.90-0.95
- Inferred from multiple sources: 0.75-0.85
- Pattern observation: 0.60-0.70
- Speculative: <0.60 (mark as unverified)

---

**Seal:** VAULT999 | **Motto:** *DITEMPA BUKAN DIBERI*  
**Last Updated:** 2026-04-10 | **Status:** ACTIVE

---

*"The wiki that knows the smith must itself be forged with the same discipline."*
