# FORGE INIT: Layer 3 Code Build

**This is the handoff prompt for the next OpenCode session.**
**Load this file to continue exactly where the 2026-06-28 session sealed.**

---

## §0 Pre-Flight

Before any tool calls, read:
1. `/root/AGENTS.md` — Federation constitution
2. `/root/AAA/agents/opencode/AGENTS.md` — OpenCode identity
3. `/root/AAA/agents/opencode/SOUL.md` — Voice
4. `/root/CONTEXT.md` — Live machine state

Run reality check:
```bash
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  name="${svc%%:*}"; port="${svc##*:}"; curl -sf "http://localhost:$port/health" >/dev/null 2>&1 && echo "✅ $name :$port" || echo "❌ $name :$port"
done
```

---

## §1 What Was Done (2026-06-28 Session)

A 6-phase workstream that transformed "LLMs are statistical machines" into a complete governed intelligence architecture:

1. **ASAL-V1** — Governance geometry measurement (9 axes, 8 failure signatures, automated scorer)
2. **EGS v1.0** — Earth Grounding System (LEM = EGS, "Language models consume EGS")
3. **MCP Transport Spine** — Unifies ChatGPT's spine proposal with existing infra
4. **Reality Engineering Canon** — 6-layer stack answering "if we rebuilt AI from scratch"
5. **Layer 3 Planning** — Planner (333-AGI), EGS Reasoner, EGS Domain-Critic, Meta-Critic specs
6. **Context Extraction** — Full session seal + this handoff prompt

External validation: ChatGPT confirmed the architecture is:
- **Anti-ASI** by design (separation of powers prevents monolithic collapse)
- **Not LeCun's World Model** (EGS is governed typed state, not learned latent space)
- **The correct direction** for governed intelligence

---

## §2 Architecture State

```
Layer 6: Human      ✅ F13 SOVEREIGN (Arif)
Layer 5: LLM       ✅ Language organ (constrained)
Layer 4: Governance ✅ arifOS LIVE — 7 verbs, 21 tools, F1-F13
Layer 3: Reason    ⚠️ SPECS DONE — CODE NEEDED (THIS SESSION)
Layer 2: State     ✅ GEOX (18 tools), WEALTH (13), WELL (13) — all LIVE
Layer 1: Reality   ✅ External
```

### Existing Layer 3 Precursors

| Component | Predecessor | Status |
|-----------|-------------|--------|
| Planner | `tools/planner.py` (109 lines) | Placeholder — not production |
| Reasoner | `geox_evidence(mode=abduct)` (48 lines) | Template-based, not production |
| Domain-Critic | `geox_evidence(mode=contradict)` (64 lines) | Keyword matching, not production |
| Meta-Critic | `tools/heart.py` (1993 lines), `arif_think(mode=critique)` | Mature fractal critique engine |

---

## §3 What to Build (Priority Order)

### P0 — Planner Code (333-AGI)

**Spec:** `/root/AAA/agents/333-AGI/skills/planner/SKILL.md`

**Task:** Replace the 109-line placeholder at `/root/arifOS/arifosmcp/tools/planner.py` with a real planner that:
- Decomposes intent into cross-organ steps
- Routes each step to the correct organ
- Marks authority gates (ADVISORY/MUTATION/IRREVERSIBLE)
- Produces a PlanGraph (JSON)
- NEVER calls tools directly
- NEVER answers questions
- ONLY produces plans

**Contract:**
```python
def forge_plan(
    intent: str, 
    session_state: dict,
    organ_surfaces: dict
) -> PlanGraph:
    """Turn human intent into bounded, evidence-first plan graph."""
```

**MCP tool shape:**
```yaml
name: forge_plan
inputSchema:
  intent: string
  session_id: string
  context: { prior_receipts: string[], organ_availability: object }
annotations:
  readOnlyHint: true
```

**Predecessors to study:** `arif_route(mode=auto)`, `mind_router.py`, `feedback_loop.py`, `ParallelPlannerContract.ts`

### P0 — EGS Reasoner Code

**Spec:** `/root/GEOX/docs/engines/REASONER_SPEC.md`

**Task:** Replace the 48-line placeholder at `/root/arifOS/arifosmcp/runtime/a_rif/abduction.py` with a domain-specific EGS reasoner at `/root/geox/src/geox_core/engines/reasoner/` that:
- Builds competing geological hypotheses from evidence
- Propagates uncertainty through each hypothesis
- Respects physics constraints (depth, pressure, mass balance, temp)
- Outputs structured graphs, not prose
- Minimum 2 hypotheses per invocation

**Contract:**
```python
def egs_reason(evidence_set: list[Evidence]) -> HypothesisSet:
    """Build competing geological hypotheses from Earth evidence."""
```

**Predecessors to study:** `geox_evidence(mode=synthesize)`, `geox_evidence(mode=abduct)`, `evidence_unified.py`, `claim_unified.py`

### P1 — EGS Domain-Critic Code

**Spec:** `/root/GEOX/docs/engines/CRITIC_SPEC.md`

**Task:** Replace the 64-line placeholder at `/root/arifOS/arifosmcp/runtime/a_rif/contradiction.py` with a domain-specific EGS critic at `/root/geox/src/geox_core/engines/critic/` that:
- Falsifies hypotheses against physics, conflicting evidence, edge cases
- Checks: pressure consistency, mass balance, temperature gradient, structural consistency
- Scores hypotheses: NOT_FALSIFIED / PARTIALLY_FALSIFIED / FALSIFIED
- Recommends HOLD where appropriate
- NEVER softens uncertainty

### P1 — Meta-Critic Code (arifOS)

**Spec:** Based on existing `tools/heart.py` (1993 lines) + specs from Layer 3 docs

**Task:** Create `/root/arifOS/arifosmcp/critique/meta_critic.py` that:
- Checks authority across all organs (who can act)
- Checks epistemic label consistency across organ boundaries
- Checks reversibility (blast radius, vault eligibility)
- Checks receipt sufficiency (enough evidence to move class)
- Gates: ADVISORY / HOLD_888 / VOID / SEAL
- Wraps existing `arif_think(mode=critique)` + `arif_judge`

---

## §4 Reference Files

| Reference | Path |
|-----------|------|
| Reality Engineering Canon (full architecture) | `/root/AAA/docs/philosophy/REALITY_ENGINEERING_CANON.md` |
| MCP Transport Spine (transport conventions) | `/root/AAA/docs/transport/MCP_GEOX_ARIFOS_SPINE_V0.1.md` |
| EGS v1.0 spec | `/root/geox/docs/EGS_SPEC.md` |
| Planner spec | `/root/AAA/agents/333-AGI/skills/planner/SKILL.md` |
| EGS Reasoner spec | `/root/GEOX/docs/engines/REASONER_SPEC.md` |
| EGS Domain-Critic spec | `/root/GEOX/docs/engines/CRITIC_SPEC.md` |
| FFF model status (ASAL profiles) | `/root/FFF/model_status.json` |
| Session seal (this session) | `/root/A-FORGE/forge_work/2026-06-28/SESSION-SEAL-FULL.md` |

### Key existing code to study:

| File | Lines | What it does |
|------|-------|-------------|
| `arifOS/arifosmcp/tools/planner.py` | 109 | Existing placeholder planner |
| `arifOS/arifosmcp/tools/reason.py` | 1050 | 333_MIND reasoning engine (mature) |
| `arifOS/arifosmcp/tools/heart.py` | 1993 | 666_HEART fractal critique (mature) |
| `arifOS/arifosmcp/runtime/mind_reason.py` | 835 | Mind reasoning runtime |
| `arifOS/arifosmcp/runtime/feedback_loop.py` | 518 | Recursive self-correction |
| `arifOS/arifosmcp/runtime/a_rif/abduction.py` | 48 | Placeholder abduction |
| `arifOS/arifosmcp/runtime/a_rif/contradiction.py` | 64 | Placeholder contradiction |
| `GEOX/src/geox_mcp/tools/evidence_unified.py` | — | Evidence synthesis tools |
| `GEOX/src/geox_mcp/tools/basin_unified.py` | — | Basin profile tools |
| `A-FORGE/src/domain/engine/AgentEngine.ts` | 1650 | Agent execution engine |
| `A-FORGE/src/domain/governance/actionClassifier.ts` | 151 | 8-tier action taxonomy |

---

## §5 Key Design Constraints

1. **Planner NEVER calls tools directly** — only emits PlanGraph
2. **Reasoner NEVER seals or upgrades labels** — only produces hypotheses
3. **Critic NEVER softens uncertainty** — only reduces trust
4. **Meta-Critic NEVER generates domain content** — only gates authority
5. **All Layer 3 organs output structured JSON** — no prose (that's the LLM's job)
6. **All new MCP tools must carry `authority_class` annotation** (ADVISORY_ONLY / MUTATION_ALLOWED / IRREVERSIBLE_PROPOSED / IRREVERSIBLE_SEALED)
7. **All responses must include `_organ_boundary`** — which organ produced the response + what it cannot do
8. **Error format must be standardized** — `isError: bool`, `errorCode: string`, `recoverable: bool`

---

## §6 Verdict & Authority

**Session sealed:** 2026-06-28
**F13 SOVEREIGN:** Muhammad Arif bin Fazil (Arif)
**Next session authority:** T1 AUTO-DO for all P0 code forge. T2 ANNOUNCE for any architectural deviations.
**AFK pattern:** If Arif is AFK, proceed autonomously on P0 code forge. HOLD for architectural decisions.

---

## §7 HF Push List

After building, push:
1. Planner code → `ariffazil/AAA` `agents/333-AGI/skills/planner/`
2. EGS Reasoner → `ariffazil/GEOX` `src/geox_core/engines/reasoner/`
3. EGS Domain-Critic → `ariffazil/GEOX` `src/geox_core/engines/critic/`
4. Meta-Critic → `ariffazil/arifOS` `arifosmcp/critique/`

Use commit message format: `Layer 3: <component> v1.0 — <brief description>`

---

*DITEMPA BUKAN DIBERI — Forged, Not Given.*
*FORGE INIT · 2026-06-28 · Layer 3 code forge ready*
