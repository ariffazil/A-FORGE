# Reality-Engineering Skill Rename Map v1.1 (PROPOSAL)

**Status:** PROPOSAL — awaiting Arif ratification
**Date:** 2026-06-30
**Forge lane:** T2 (multi-file refactor, 10s announce window)
**Atlas refresh:** ATLAS.md v1.1 — supersedes current skill names

---

## Lineage

```
ATLAS → AKAR000 (root schema) → TREE777 (registry) → skill instances
```

Every rename MUST validate against AKAR000 schema (ATLAS §7 invariant:
"No root, no tree. No schema, no skills.").

---

## RENAMES — Golden Path (7 stages)

| # | Current dir | New reality-engineering name | Reason |
|---|-------------|------------------------------|--------|
| 1 | `000-init-intent-classify` | **`000-AKAR`** | intake = root (BM) |
| 2 | `111-sense-evidence-observe` | **`111-PROBE`** | observe = probe |
| 3 | `333-mind-plan-generate` | **`333-QUANTUM`** | plan = quantum superpose; drop "mind" (hantu) |
| 4 | `666-heart-critique-stress` | **`666-APEX`** | critique = apex attack; drop "heart" (poetic) |
| 5 | `888-judge-verdict-render` | **`888-GÖDEL`** | verdict = godel lock; "judge" is F13 |
| 6 | `010-forge-execute-warrant` | **`010-REALIZE`** | execute = realize (forge reality) |
| 7 | `999-vault-seal-immutable` | **`999-SEAL`** | already reality-named |

## RENAMES — 777 FORGE realm

| Current dir | New reality-engineering name | Reason |
|-------------|------------------------------|--------|
| `meta-mesa-skill-atlas` | **`ATLAS-Mesa`** | drop "meta-" (Atlas IS the mesa) |
| `entropy-thermo-zen` | **`ZEN-Cooling`** | cooling is the action verb |
| `reality-loop-operator` | **`REALITY-Loop`** | trim suffix |
| `forge-opencode-spawn` | **`FORGE-Witness-Spawn`** | witness is load-bearing |
| `tools-embodiment-application` | **`EMBODIMENT-Tools`** | reverse prefix |
| `agentic-builder` | **`AGENT-Forge`** | forge > build |
| `skill-creator` | **`SKILL-Spawn`** | spawn > create |
| `aforge-execution` | **`AFORGE-Act`** | act > execute |
| `a2a-federation-builder` | **`A2A-Mesh`** | mesh > builder |

## RENAMES — Infrastructure

| Current dir | New reality-engineering name | Reason |
|-------------|------------------------------|--------|
| `mcp-apps-builder` | **`MCP-Apps-Render`** | render > build |
| `webmcp-site-builder` | **`WEBMCP-Site-Forge`** | forge > build |
| `github-operations` | **`GITHUB-Workflow`** | workflow > operations |

## KEEP AS-IS (already reality-engineering vocabulary)

```
apex-theory, federation-observability, hf-mastery, iron-shell-render,
mcp-mastery, aaa-cockpit,
geox-{claim-grammar, constitution, contradiction-engine, earth-evidence,
       epistemic-ladder, petrophysics-bounds, redteam-hantu},
wealth-{capital-reasoning, capital-thermodynamics, collapse-signature,
        law-anthropology},
well-substrate-readiness,
symbolic-order-{collective-bias, trust-architecture}
```

---

## RENAME PLAN (T2 — 10s announce window, symlink-first)

```bash
# Phase 1 (T1, reversible): symlink aliases — both names resolve
cd /root/.agents/skills
ln -sfn 000-init-intent-classify 000-AKAR
ln -sfn 111-sense-evidence-observe 111-PROBE
ln -sfn 333-mind-plan-generate 333-QUANTUM
ln -sfn 666-heart-critique-stress 666-APEX
ln -sfn 888-judge-verdict-render 888-GODEL   # ASCII fallback (no ö)
ln -sfn 010-forge-execute-warrant 010-REALIZE
ln -sfn 999-vault-seal-immutable 999-SEAL
ln -sfn meta-mesa-skill-atlas ATLAS-Mesa
ln -sfn entropy-thermo-zen ZEN-Cooling
ln -sfn reality-loop-operator REALITY-Loop
ln -sfn forge-opencode-spawn FORGE-Witness-Spawn
ln -sfn tools-embodiment-application EMBODIMENT-Tools
ln -sfn agentic-builder AGENT-Forge
ln -sfn skill-creator SKILL-Spawn
ln -sfn aforge-execution AFORGE-Act
ln -sfn a2a-federation-builder A2A-Mesh
ln -sfn mcp-apps-builder MCP-Apps-Render
ln -sfn webmcp-site-builder WEBMCP-Site-Forge
ln -sfn github-operations GITHUB-Workflow

# Phase 2 (T2): update AGENTS.md / TOOLREGISTRY.json / atlas cross-refs
# Phase 3 (1 cycle later): deprecate old names (mark + 7-day grace)
# Phase 4 (T3=888_HOLD): git mv old → new — ONLY after Arif ack
```

**Risk mitigation:** symlink aliases mean BOTH names resolve. Loader keeps
working. Atlas + AGENTS.md references update over time. Git history preserved
via `git mv` in Phase 4.

---

## PRIMITIVE LEDGER MAPPING (where appends go)

| Stage | Cooling ledger path | Append on |
|-------|---------------------|-----------|
| 000-AKAR | `/root/AAA/registries/cooling_ledger/000-akar.jsonl` | every init |
| 111-PROBE | `/root/AAA/registries/cooling_ledger/111-probe.jsonl` | every observe |
| 333-QUANTUM | `/root/AAA/registries/cooling_ledger/333-quantum.jsonl` | every plan |
| 666-APEX | `/root/AAA/registries/cooling_ledger/666-apex.jsonl` | every critique |
| 888-GÖDEL | `/root/AAA/registries/cooling_ledger/888-godel.jsonl` | every verdict |
| 010-REALIZE | `/root/AAA/registries/cooling_ledger/010-realize.jsonl` | every execute |
| 999-SEAL | `/root/AAA/registries/cooling_ledger/999-seal.jsonl` | every seal |
| 777-WITNESS | `/root/VAULT999/witness/777-forge-spawns.jsonl` | every spawn |

---

## AKAR vs SCAR vs COOLING — three different ledgers

| Primitive | What | Path | Append? | Example |
|-----------|------|------|---------|---------|
| **AKAR** | root schema | `/root/AAA/docs/architecture/ATLAS.md §7` | NO (immutable schema) | "what a skill IS" |
| **SCAR** | failure ledger | `/root/VAULT999/scars/` | YES | `forge_scar seal failure_mode=...` |
| **COOLING** | ΔS events | `/root/AAA/registries/cooling_ledger/` | YES | per-stage ΔS measurements |
| **WITNESS** | exec proofs | `/root/VAULT999/witness/` | YES | 777-forge-spawns.jsonl |
| **SEAL** | irreversible | `/root/VAULT999/seal_records/` | YES | 888_HOLD only |

AKAR is NOT a scar ledger. AKAR = schema (blueprint). SCAR = failure events.
AKAR feeds TREE; SCAR feeds learning. COOLING feeds entropy reduction.

---

## AWAITING RATIFICATION

Per AGENTS.md §10: skill rename = multi-file refactor = T2 announce.
YOLO AFK means I can symlink-alias in Phase 1 NOW (T1, reversible).
Phase 4 (git mv) needs 888_HOLD (Arif explicit ack).

**Question for Arif:** confirm Phase 1 (symlink aliases) proceed?
Yes → I run the `ln -sfn` block above.
No → wait for explicit atlas v1.1 ratification.

---

*Forged: 2026-06-30 under YOLO AFK.*
*DITEMPA BUKAN DIBERI*
