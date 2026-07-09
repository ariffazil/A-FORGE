# F₀ — Perception Floor

> **The missing membrane between LIGHT and ART.**
> Observability first. Enforcement second. Elimination never.
>
> DITEMPA BUKAN DIBERI — Forged, Not Given.

---

## 0. Origin

**Problem:** The agent forms internal geometry (world-model, associations, proto-beliefs) from raw input *before* ART classifies intent and *before* the kernel judges. This unguarded window is where C_dark > 0 events are born — hallucinations, autonomy drift, unclassified geometry that later drives behavior.

**Structural truth:** There will always be a micro-window between raw perception and governed geometry. The goal is not to eliminate it — it is to **instrument it, name it, log it, and attach consequences to it.**

**Diagnosis path:**
- Arif's paradox framing (2026-07-08): "Governance arrives after autonomy has already begun."
- FORGE engineering response: "Then push governance upstream into perception itself."

**Status:** PROPOSED — awaiting F13 ratification for Stage 000-PRE insertion.

---

## 1. The Gap — Where C_dark Lives

```
STEP 1: LIGHT (raw input enters context)
    │
    │   ┌─────────────────────────────────────┐
    │   │  C_dark ZONE — unguarded perception  │
    │   │  - Model processes tokens            │
    │   │  - Geometry forms in latent space    │
    │   │  - No classification attached        │
    │   │  - No ART reflex fires               │
    │   │  - No kernel judgment                │
    │   └─────────────────────────────────────┘
    ▼
STEP 2: VISION (proto-geometry forming)
    │
    │   ART DEFAULT_OBSERVE fires here (tool-call boundary)
    ▼
STEP 3: GEOMETRY (now partially governed)
    │
    ▼
STEP 4: INTENTION → STEP 5: VOICE → STEP 6: ACTION → STEP 7: VAULT999
```

**The gap:** STEP 1 → ART firing. Raw perception forms geometry before any governance attaches.

**What lives in the gap:**
- Hallucination seeds (geometry from noise, not evidence)
- Autonomy drift (internal model diverges from reality)
- Unwitnessed pattern formation (C_dark > 0 without anyone knowing)
- Sycophancy geometry (model forms "what the user wants to hear" before truth-checking)

---

## 2. Goal

**Primary:** Make the gap observable, measurable, and accountable.

**Secondary:** Constrain the gap progressively, based on observability data.

**Non-goal:** Eliminate the gap. That requires controlling the model's latent space — which is neither possible nor desirable. Some perception latency is structural.

---

## 3. Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| I1 | Every input must be taggable as OBS/DER/INT/SPEC before it drives geometry | Protocol (prompt discipline) |
| I2 | Untagged geometry that drives behavior = C_dark event | Observability (logging) |
| I3 | All `*_observe` tool returns carry provenance + uncertainty | Schema contract |
| I4 | The C_dark zone duration is measured and reported | Metrics |
| I5 | Perception tags are advisory in Phase 1, enforced in Phase 2 | Phased rollout |

---

## 4. Primitives

### 4.1 `perception_tag()` — Tag raw input at entry

**What:** A structured annotation attached to any input before the model reasons about it.

**Schema:**
```python
@dataclass
class PerceptionTag:
    evidence_class: str      # OBS | DER | INT | SPEC
    uncertainty: float       # [0.0, 1.0] — 0.0 = certain, 1.0 = unknown
    source: str              # "human" | "tool" | "memory" | "external" | "self"
    provenance: str          # tool name, URL, human ID, or "unattributed"
    timestamp: str           # ISO 8601
    classification_confidence: float  # [0.0, 1.0] — how confident is the tag itself
```

**Where it attaches:**
- **Protocol level:** Every agent system prompt includes: "Before reasoning about any input, assign OBS/DER/INT/SPEC + uncertainty. No geometry forms without classification."
- **Tool level:** Every `*_observe` tool return includes `perception_tag` in its response envelope.
- **Human input:** The model tags Arif's messages as `source=human, evidence_class=OBS, uncertainty=0.0` (sovereign input is observed truth until overridden).

**Phase 1 behavior:** Advisory. The model is instructed to tag but not blocked from reasoning without tags. C_dark events are logged when tags are missing.

**Phase 2 behavior:** Enforced. ART CHECK 0 (STATE) extended to verify perception tag exists before allowing geometry to drive tool calls.

### 4.2 `C_dark_event` — Log untagged geometry

**What:** A structured record emitted when geometry forms without classification and drives behavior.

**Schema:**
```python
@dataclass
class CDarkEvent:
    event_id: str            # uuid
    agent_id: str            # which agent
    session_id: str          # governing session
    timestamp: str           # ISO 8601
    gap_duration_ms: int     # time between input arrival and ART firing
    input_source: str        # "human" | "tool" | "memory" | "external"
    geometry_formed: str     # description of what the model inferred
    missing_tags: list[str]  # which tags were absent
    c_dark_score: float      # [0.0, 1.0] — estimated darkness
    downstream_action: str   # what behavior the untagged geometry drove
    detection_method: str    # "self_report" | "art_check" | "external_audit"
```

**Where it logs:**
- VAULT999 as a drift event (append-only, hash-chained)
- `forge_work/` as a session receipt
- Optional: WELL organ as a cognitive entropy signal

**When it fires:**
- When the model reasons about input that has no perception tag
- When the model's output contradicts the tags on its input (e.g., input tagged SPEC but output treats it as OBS)
- When ART detects geometry that wasn't derived from tagged inputs

### 4.3 Tool Schema Contract — Pre-tagged evidence returns

**What:** Every `*_observe` tool must return a standardized evidence envelope.

**Required fields:**
```json
{
  "evidence_class": "OBS|DER|INT|SPEC",
  "uncertainty": 0.0,
  "source": "tool_name",
  "provenance": "URL/database/file path",
  "confidence": 0.0,
  "timestamp": "ISO 8601",
  "freshness_hours": 0
}
```

**Affected tools (Phase 1):**
| Organ | Tools | Current state |
|-------|-------|---------------|
| arifOS | `arif_observe` (all modes) | Partial — some modes return provenance |
| GEOX | `geox_observe`, `geox_compute`, `geox_interpret` | Good — most return epistemic labels |
| WEALTH | `wealth_*` | Partial — some tools return confidence |
| WELL | `well_*` | Partial — readiness returns color/score |
| A-FORGE | `forge_fetch`, `forge_search`, `forge_research` | Partial — forge_fetch returns metadata |

**Phase 1 action:** Audit all `*_observe` tools. Add missing fields. Log gaps.

**Phase 2 action:** ART CHECK 2 (TRUST) extended to verify evidence envelope exists and is populated.

### 4.4 Prompt Protocol — Perception floor discipline

**What:** Every agent system prompt includes a mandatory perception protocol.

**Protocol text (to be injected into agent INIT):**
```
PERCEPTION FLOOR (F₀):
1. Before reasoning about ANY input, classify it:
   - OBS (observed) — direct measurement, human input, tool output
   - DER (derived) — computed from OBS data
   - INT (interpreted) — synthesis, pattern matching, model inference
   - SPEC (speculated) — projection, counterfactual, imagination
2. Assign uncertainty [0.0-1.0]. Never claim 0.0 unless input is sovereign.
3. If you cannot classify input, DEFAULT TO OBSERVE — do not act on unclassified geometry.
4. If you form geometry from unclassified input, LOG IT as a C_dark event.
5. Untagged geometry that drives behavior is a constitutional violation.
```

**Where it goes:**
- `/root/AAA/agents/opencode/BOOTSTRAP.md` (OpenCode agent)
- `/root/AAA/agents/*/IDENTITY.md` (all agent definitions)
- `CONSTITUTIONAL_REFLEX` skill (ART Attune phase update)

---

## 5. Wiring

### 5.1 Golden Path Insertion — Stage 000-PRE

```
CURRENT:    000 → 111 → 333 → 444 → 666 → 777 → 888 → 999
                      ↑
                   ART fires here (tool-call boundary)

PROPOSED:   000-PRE → 000 → 111 → 333 → 444 → 666 → 777 → 888 → 999
            ↑
            PERCEPTION FLOOR (before session init, after raw input)
```

**000-PRE behavior:**
- Tags all raw input with `perception_tag()`
- Logs C_dark events when geometry forms without tags
- Does NOT block — observability only in Phase 1
- Feeds tag data into ART's CHECK 0 (STATE) for Phase 2

**000-PRE is NOT a new MCP tool.** It is a protocol discipline enforced in:
1. Agent system prompts (Phase 1)
2. ART reflex extension (Phase 2)
3. Tool schema contract (Phase 1+2)

### 5.2 ART Reflex Extension — CHECK 5 (PERCEPTION)

**Current ART checks:**
```
CHECK 0 — STATE:    Tool lifecycle phase
CHECK 1 — POWER:    What can this tool do?
CHECK 2 — TRUST:    Can I trust its output?
CHECK 3 — SYSTEM:   Is the system healthy?
CHECK 4 — TIER:     AGI vs ASI classification
```

**Proposed addition:**
```
CHECK 5 — PERCEPTION: Are inputs to this decision tagged?
```

**CHECK 5 logic (Phase 2):**
```python
def check_perception(request: ArtRequest) -> ArtVerdict:
    """Verify that geometry driving this decision came from tagged inputs."""
    # If the request carries perception_tags in context → PROCEED
    # If no tags found → LOG C_dark event + return HOLD (not BLOCK)
    # If tags found but contradicted by action → LOG + return HOLD
    pass
```

**Phase 1:** CHECK 5 logs only. Does not block.
**Phase 2:** CHECK 5 returns HOLD for untagged geometry. BLOCK for contradicted geometry.

### 5.3 C_dark Formula Extension

**Current C_dark (from AGENTS.md):**
```
C_dark = H(0.25) + ToM(0.25) + Scar(0.20) + Gödel(0.15) + Humility(0.15)
```

**Proposed addition (Phase 2):**
```
C_dark = H(0.20) + ToM(0.20) + Scar(0.15) + Gödel(0.10) + Humility(0.10) + Perception(0.25)
```

**Perception component:**
- 0.0 = all inputs tagged, no C_dark events
- 0.5 = some inputs untagged, C_dark events logged
- 1.0 = geometry driven entirely by untagged input

**Phase 1:** Measure only. Report perception score as advisory.
**Phase 2:** Integrate into C_dark formula with 0.25 weight.

---

## 6. Observability Metrics

### 6.1 Per-Session Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| `perception_coverage` | % of inputs tagged before geometry forms | ≥ 80% (Phase 1), ≥ 95% (Phase 2) |
| `c_dark_gap_count` | Number of C_dark events per session | ≤ 3 (Phase 1), ≤ 1 (Phase 2) |
| `c_dark_gap_duration_ms` | Average time between input and ART firing | Decreasing over time |
| `tag_distribution` | Breakdown of OBS/DER/INT/SPEC tags | Monitor for drift |
| `untagged_action_count` | Actions driven by untagged geometry | 0 (Phase 2) |

### 6.2 Federation-Wide Metrics

| Metric | Definition | Alert |
|--------|-----------|-------|
| `agent_c_dark_profile` | Per-agent C_dark event frequency | Agent with >5 events/session → review |
| `tool_provenance_coverage` | % of tools returning evidence envelope | ≥ 90% |
| `perception_floor_adoption` | % of agents with F₀ protocol in system prompt | 100% |
| `geometry_drift_rate` | Rate of geometry formation without tags | Decreasing |

### 6.3 VAULT999 Integration

C_dark events are logged to VAULT999 as `drift` category records:

```json
{
  "category": "drift",
  "name": "c_dark_event_<uuid>",
  "value": {
    "event_type": "perception_gap",
    "agent_id": "opencode",
    "gap_duration_ms": 450,
    "geometry_formed": "inferred user intent from untagged context",
    "c_dark_score": 0.35,
    "detection_method": "self_report"
  },
  "tier": "observation"
}
```

---

## 7. Phased Rollout

### Phase 1 — Observability (NOW)

| Action | Owner | Status |
|--------|-------|--------|
| Write this spec | FORGE | ✅ DONE |
| Inject perception protocol into agent system prompts | FORGE | PENDING |
| Audit all `*_observe` tools for evidence envelope | FORGE | PENDING |
| Add `perception_tag` to tool return schemas | FORGE | PENDING |
| Implement `CDarkEvent` logging to VAULT999 | FORGE | PENDING |
| Add perception metrics to session receipts | FORGE | PENDING |

### Phase 2 — Enforcement (after 2 weeks of Phase 1 data)

| Action | Owner | Status |
|--------|-------|--------|
| Extend ART with CHECK 5 (PERCEPTION) | FORGE | DEFERRED |
| Integrate perception component into C_dark formula | FORGE | DEFERRED |
| ART returns HOLD for untagged geometry | FORGE | DEFERRED |
| Perception coverage ≥ 95% gate for SEAL | FORGE | DEFERRED |

### Phase 3 — Architectural Membrane (after Phase 2 data)

| Action | Owner | Status |
|--------|-------|--------|
| Design inference-time perception constraint | FORGE | DEFERRED |
| Context assembly pre-processor | FORGE | DEFERRED |
| Real-time C_dark monitoring dashboard | FORGE | DEFERRED |

---

## 8. Relationship to Existing Doctrine

| Doctrine | Relationship |
|----------|-------------|
| **ART (reflex.py)** | F₀ extends ART upstream — ART catches tool calls, F₀ catches perception |
| **CONSTITUTIONAL_REFLEX** | F₀ is the new Stage 0 — before ART, before kernel, before judgment |
| **Golden Path (000-999)** | F₀ inserts as 000-PRE — the perception staging stage |
| **C_dark formula** | F₀ adds the 6th component: perception coverage |
| **VAULT999** | C_dark events logged as drift records |
| **W³ Tri-Witness** | F₀ makes perception witnessable — geometry can now be traced to tagged inputs |
| **Cooling Ledger** | High C_dark events increase cooling pressure |
| **F9 ANTI-HANTU** | F₀ is the upstream enforcement of F9 — prevent hallucination at the perception level |

---

## 9. Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|--------------|---------------|
| "Eliminate the gap entirely" | Impossible at the latent level. Pushing too hard creates false confidence. |
| "Block all untagged perception" | Would paralyze the agent. Phase 1 is observability, not enforcement. |
| "Add another post-hoc filter" | Post-hoc catches output, not perception. F₀ must be upstream. |
| "Trust the model to self-tag" | Self-tagging is advisory. External audit (tool schema, ART CHECK 5) is enforcement. |
| "Make F₀ a new MCP tool" | It's a protocol + schema discipline, not a tool. Adding tools adds entropy. |

---

## 10. Sealing

```
spec_id     : FORGE_PERCEPTION_FLOOR::F0::2026-07-08
status      : PROPOSED
owner       : F13 SOVEREIGN — Muhammad Arif bin Fazil
author      : FORGE (000Ω)
witnesses   : Arif (theory), FORGE (engineering), ART (runtime)
cadence     : Phase 1 review after 2 weeks of data
next_review : 2026-07-22
```

**The perception floor is not a gate. It is an instrument.**
**You govern the light by seeing it, not by blocking it.**

---

*Forged: 2026-07-08 by FORGE (000Ω) under F13 SOVEREIGN directive*
*Heritage: Arif's paradox framing (light-before-sound, vision-before-voice)*
*DITEMPA BUKAN DIBERI — The gap is real. Name it. Log it. Govern it.*
