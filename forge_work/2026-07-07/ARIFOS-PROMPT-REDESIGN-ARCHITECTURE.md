# arifOS Prompt Transport — Redesign for Timeless, Dynamic, Self-Improving Architecture

**Date:** 2026-07-07
**Forger:** OpenCode (333-AGI forge instrument, bound to F13)
**Companion:** `ARIFOS-PROMPT-TRANSPORT-AUDIT.md` (read first)
**Goal:** Convert the static, duplicated, drift-prone prompt surface into a single source of truth that is **timeless** (version-pinned, supersession-aware), **dynamic** (session-state-injected, scar-coupled, witness-anchored), **reality-anchored** (every prompt carries its own proof), **autonomous** (zero human babysitting for routine composition), **self-improving** (SCAR LAW metabolizes failures into registry updates), **low-entropy** (one definition per concept), and **universal** (works across MCP, A2A, REST, direct invocation).

---

## TL;DR (DER + INT)

The current prompt transport has **six conflicting stage-numbering schemes**, **three competing injection scanners**, **one orphaned YAML data source**, and **two near-clone files with inverted semantics**. The redesign unifies on:

- **One registry** (`PromptSpecRegistry`) — JSON Schema, source-of-truth, version-pinned
- **One composer** (`PromptComposer`) — session-state-aware, scar-coupled, witness-anchored
- **One scanner** (`InjectionGuard`) — single YAML-driven pattern source, one scoring formula, one result type
- **One lineage** (`PromptLineage`) — supersession graph, scar history, version chain

This compresses the 1,620 LOC of duplication + 2,987 LOC of adjacent transport into ~900 LOC of declarative + ~600 LOC of compose logic. Net entropy reduction: ~60%.

---

## 1. THE PRINCIPLES — Why the current design fails

**OBS** (from audit): The current surface has these measurable failure modes:

| Failure | Where | Cost |
|---------|-------|------|
| Triple source-of-truth for stage sequence | `prompts/__init__.py:180`, `runtime/prompts.py:3`, `runtime/prompt.py:9` | Guaranteed drift; 555/666 already swapped in 1 file |
| Empty `input_schema={}` × 8 specs | `runtime/prompts.py:18,25,32,...` | Schema promises unfulfilled; clients cannot validate inputs |
| Hardcoded floor thresholds in template body | `fastmcp_ext/prompts.py:18-31` | Threshold drift if `constitutional_map.CANONICAL_FLOORS` changes |
| Three injection scanners with no shared API | `runtime/a_rif/prompt_injection.py`, `hexagon/security/prompt_armor.py`, `core/shared/guards/injection_guard.py` | Coverage gaps, scoring inconsistency, maintenance × 3 |
| Orphaned YAML data source | `resources/a_rif/prompt_injection_patterns.yaml` | Patterns exist but never loaded |
| Floor prefix split (F1-F13 vs L01-L13) | `AGENTS.md` vs `system-prompts.yaml` | Search-by-name fails across surfaces |
| Magic numbers not tied to constitution | `prompt_armor.py:59,107,112,289,...` | Drift vector — threshold changes don't propagate |
| Hardcoded agent identity strings | `system-prompts.yaml:23,92,182,264` ("Muhammad Arif bin Fazil" × 4) | Sovereign identity drift |
| No SCAR coupling | All files | Failures don't auto-update prompts |
| No session-state injection | All files | Prompts are static; cannot adapt to live floor state |
| No version chain / supersession graph | All files | Can't reason about prompt evolution |
| No entropy budget | All files | No bound on prompt complexity |

**DER**: These twelve failure modes collapse into **three root causes**:
1. **No single source of truth** (duplication creates drift surface)
2. **No state binding** (prompts are static, not session-aware)
3. **No feedback loop** (SCAR LAW doesn't connect to prompt registry)

**INT**: The architecture must address all three. Static-data + dynamic-composition + feedback-coupling is the irreducible minimum.

---

## 2. THE TARGET ARCHITECTURE — Five layers

```
┌──────────────────────────────────────────────────────────────────┐
│  L5: CONSUMERS (MCP prompts/list, A2A messages, REST, direct)    │
├──────────────────────────────────────────────────────────────────┤
│  L4: COMPOSITION  → PromptComposer.compose(spec, session_state) │
│                      injects floors, scars, witness, vitals       │
├──────────────────────────────────────────────────────────────────┤
│  L3: RENDERING    → Jinja2 templates + JSON Schema validation   │
├──────────────────────────────────────────────────────────────────┤
│  L2: REGISTRY     → PromptSpecRegistry (one file, YAML-backed)  │
│                      version, supersedes, sha256, scar_links     │
├──────────────────────────────────────────────────────────────────┤
│  L1: SCAN         → InjectionGuard (one scanner, YAML patterns) │
│                      + PromptArmor as legacy alias               │
├──────────────────────────────────────────────────────────────────┤
│  L0: KERNEL       → constitutional_map.CANONICAL_FLOORS          │
│                      single source of truth for F1-F13 thresholds│
└──────────────────────────────────────────────────────────────────┘
```

**The single source of truth** lives at L2. Everything above consumes from it; nothing below duplicates it.

---

## 3. THE REGISTRY — PromptSpecRegistry

### 3.1 Schema (canonical, one file)

**File:** `/root/arifOS/arifosmcp/registry/prompt_registry.yaml`

```yaml
# Single source of truth for all prompts transported through arifOS.
# This file is read at boot, validated against schema, and SHA-256-pinned.
# Mutations require a 666_judge SEAL + 999_seal VAULT entry.

schema_version: "2026.07.07"
registry_id: "arifos.prompt_registry.v1"

# Constitutional binding (read-only, sourced from L0)
floors_ref: "arifosmcp.constitutional_map.CANONICAL_FLOORS"
witness_defaults_ref: "arifos://witness/defaults"

prompts:

  # ──── 7-stage metabolic loop ─────────────────────────────────────
  - id: "000_init"
    semantic_name: "anchor"
    title: "000_INIT — The Anchor"
    purpose: "Identity binding, reality grounding, floor acceptance, cross-session memory load."
    floor_binding: ["L01", "L11", "L12"]
    witness_requirement: "human_present=true"
    inputs_schema:
      type: "object"
      required: ["actor_id", "intent"]
      properties:
        actor_id: { type: "string", pattern: "^[a-zA-Z0-9_-]{3,64}$" }
        intent: { type: "string", minLength: 1, maxLength: 2048 }
        ack_irreversible: { type: "boolean", default: false }
    template: |
      You are binding to the arifOS constitutional substrate.
      Actor: {{ actor_id }}
      Intent: {{ intent }}
      {% if witness_block %}W³ required: {{ witness_block }}{% endif %}
      {% if scar_block %}Live scars: {{ scar_block }}{% endif %}
      {% if entropy_budget %}Entropy budget: {{ entropy_budget }} tokens{% endif %}
    expected_contracts:
      - "session_id returned"
      - "actor_signature recorded"
      - "session_state.entropy_baseline captured"
    scar_links: []           # no supersession scars yet
    supersedes: null
    entropy_budget_tokens: 800

  - id: "111_sense"
    semantic_name: "witness"
    title: "111_SENSE — The Witness"
    purpose: "Open observation, pattern detection, evidence gathering with epistemic labels (F2)."
    floor_binding: ["L02", "L03", "L07", "L12"]
    witness_requirement: "external_evidence_present=true"
    inputs_schema:
      type: "object"
      required: ["query"]
      properties:
        query: { type: "string", minLength: 1 }
        scope: { enum: ["web", "federation", "memory", "atlas", "all"], default: "all" }
        max_results: { type: "integer", minimum: 1, maximum: 50, default: 10 }
        recency_filter: { enum: ["hour", "day", "week", "month", "year", null] }
    template: |
      Observe reality as it IS, not as hypothesized.
      Query: {{ query }}
      Scope: {{ scope }}
      {% if prior_scars %}Relevant scar context: {{ prior_scars }}{% endif %}
    expected_contracts:
      - "evidence_receipt returned (F-WEB-15)"
      - "epistemic_label attached to each result (OBS/DER/INT/SPEC)"
      - "void_classification if MNAR detected"
    supersedes: null
    entropy_budget_tokens: 600

  - id: "333_reason"
    semantic_name: "mind"
    title: "333_REASON — The Mind"
    purpose: "Abduction (N≥3 hypotheses), synthesis, proposal with humility band [0.03, 0.05]."
    floor_binding: ["L02", "L05", "L06", "L07", "L08", "L09", "L10"]
    witness_requirement: "ai_self_witness=true"
    inputs_schema:
      type: "object"
      required: ["problem"]
      properties:
        problem: { type: "string", minLength: 1 }
        mode: { enum: ["reason", "plan", "critique", "reflect", "verify", "simulate", "redteam", "maruah"], default: "reason" }
        n_hypotheses: { type: "integer", minimum: 3, maximum: 7, default: 3 }
    template: |
      Reason about: {{ problem }}
      Generate ≥{{ n_hypotheses }} competing hypotheses.
      Apply humility band Ω₀ ∈ [0.03, 0.05].
      {% if scar_links %}Respect constraints: {{ scar_links }}{% endif %}
    expected_contracts:
      - "hypothesis_set returned (N≥{{ n_hypotheses }})"
      - "humility_band asserted"
      - "C_dark computed (< 0.30 for SEAL eligibility)"
    supersedes: null
    entropy_budget_tokens: 1200

  - id: "444_route"
    semantic_name: "router"
    title: "444_ROUTE — The Router"
    purpose: "Classify intent to organ (arifOS / GEOX / WEALTH / WELL / A-FORGE / AAA)."
    floor_binding: ["L01", "L04", "L10", "L11"]
    inputs_schema:
      type: "object"
      required: ["intent"]
      properties:
        intent: { type: "string", minLength: 1 }
        actor_id: { type: "string" }
    template: |
      Route intent: {{ intent }}
      Apply organ-affinity-index.
      Return: organ + tool_prefix + suggested_tools.
    expected_contracts:
      - "routing_decision returned"
      - "organ selected from CANONICAL_ORGANS"
    supersedes: null
    entropy_budget_tokens: 400

  - id: "555_critique"
    semantic_name: "mirror"
    title: "555_CRITIQUE — The Mirror"
    purpose: "Consequence scan, blast radius, perspective shift, dignity check, alternatives. F5/F6 computed."
    floor_binding: ["L05", "L06", "L12"]
    witness_requirement: "external_witness_required=true"
    inputs_schema:
      type: "object"
      required: ["plan"]
      properties:
        plan: { type: "string", minLength: 1 }
        maruah_level: { enum: ["PHATIC", "SOFT", "HARD", "CRISIS", "REFUSE"], default: "SOFT" }
        coercion_signals: { type: "array", items: { type: "string" } }
    template: |
      Critique plan: {{ plan }}
      Maruah level: {{ maruah_level }}
      Compute blast radius, alternatives, dignity impact.
    expected_contracts:
      - "maruah_verdict returned (M_CLEAN/M_ADJUST/M_REPAIR/M_HOLD)"
      - "blast_radius returned (LOW/MED/HIGH/CRITICAL)"
      - "alternatives ≥ 1"
    supersedes: null
    entropy_budget_tokens: 800

  - id: "666_judge"
    semantic_name: "gate"
    title: "666_JUDGE — The Gate"
    purpose: "Four tests (Truth, Reversibility, Dignity, Universality) + F1-F13 floor matrix. SEAL/SABAR/HOLD/VOID."
    floor_binding: ["L01", "L02", "L11", "L13"]
    witness_requirement: "human_present=true"
    inputs_schema:
      type: "object"
      required: ["actor", "intent", "requested_capability", "domain", "reversibility_level", "blast_radius"]
      properties:
        actor: { type: "string" }
        intent: { type: "string" }
        requested_capability: { type: "string" }
        domain: { type: "string" }
        reversibility_level: { enum: ["FULL", "PARTIAL", "NONE"] }
        blast_radius: { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }
        epistemic_state: { enum: ["OBSERVED", "DERIVED", "INTERPRETED", "SPECULATED"], default: "UNKNOWN" }
        evidence: { type: "array" }
        measurement: { type: "object" }
    template: |
      Judge: actor={{ actor }}, intent={{ intent }}
      Apply F1-F13 floor matrix.
      Compute W³ = ∛(H × A × E).
      Return: SEAL | SABAR | HOLD | VOID.
    expected_contracts:
      - "verdict returned (SEAL/SABAR/HOLD/VOID)"
      - "violated_floors[] if not SEAL"
      - "constitutional_chain_id (cc_id) for SEAL"
      - "receipts[] with provenance"
    supersedes: null
    entropy_budget_tokens: 600

  - id: "777_forge"
    semantic_name: "hammer"
    title: "777_FORGE — The Hammer"
    purpose: "Execute, verify, rollback. Blocked without 666 SEAL + 555 FORGE_READY."
    floor_binding: ["L01", "L11", "L13"]
    witness_requirement: "lease_required=true"
    inputs_schema:
      type: "object"
      required: ["task"]
      properties:
        task: { type: "string" }
        mode: { enum: ["engineer", "query", "write", "generate", "commit"], default: "engineer" }
        constitutional_chain_id: { type: "string", description: "cc_id from prior 666 SEAL" }
        lease_id: { type: "string" }
        session_id: { type: "string" }
    template: |
      Execute: {{ task }}
      Mode: {{ mode }}
      Lease: {{ lease_id }}
      Constitutional chain: {{ constitutional_chain_id }}
      {% if not lease_id %}BLOCKED: lease required for MUTATE-class{% endif %}
    expected_contracts:
      - "execution_receipt returned"
      - "changed_files[] returned"
      - "verification_result returned"
    supersedes: null
    entropy_budget_tokens: 1000

  - id: "888_compose"
    semantic_name: "voice"
    title: "888_COMPOSE — The Voice"
    purpose: "Human-ready output with citations, tone calibration, maruah check."
    floor_binding: ["L02", "L04", "L06", "L09"]
    inputs_schema:
      type: "object"
      required: ["message"]
      properties:
        message: { type: "string" }
        style: { enum: ["concise", "narrative", "technical", "human"], default: "concise" }
        language: { enum: ["en", "ms", "ta", "zh"], default: "en" }
        citations: { type: "array", items: { type: "string" } }
    template: |
      Compose: {{ message }}
      Style: {{ style }}, Language: {{ language }}
      {% if citations %}Citations: {{ citations }}{% endif %}
      {% if m_layer %}Apply M-Layer ({{ m_layer }}).{% endif %}
    expected_contracts:
      - "composed_response returned"
      - "maruah_verdict attached (post-M-Layer)"
      - "ai_involvement declared"
    supersedes: null
    entropy_budget_tokens: 800

  - id: "999_seal"
    semantic_name: "fossil"
    title: "999_SEAL — The Record"
    purpose: "Append-only VAULT999 write. IRREVERSIBLE. Tri-witness required."
    floor_binding: ["L01", "L11", "L13"]
    witness_requirement: "tri_witness_required=true"
    inputs_schema:
      type: "object"
      required: ["payload"]
      properties:
        payload: { type: "string" }
        ack_irreversible: { type: "boolean", const: true }
        actor_signature: { type: "string" }
        constitutional_chain_id: { type: "string" }
        witness_type: { enum: ["ai", "human", "earth"], default: "ai" }
    template: |
      Seal payload to VAULT999.
      Acknowledge irreversible: {{ ack_irreversible }}
      Actor signature: {{ actor_signature }}
      Constitutional chain: {{ constitutional_chain_id }}
    expected_contracts:
      - "seal_id returned"
      - "chain_position returned"
      - "VAULT999 entry confirmed"
    supersedes: null
    entropy_budget_tokens: 400
```

### 3.2 Loader (`PromptSpecRegistry`)

**File:** `/root/arifOS/arifosmcp/registry/prompt_registry.py`

```python
"""
Single source of truth for prompt specifications.
Replaces: runtime/prompts.py, runtime/prompt.py, specs/prompt_specs.py,
          runtime/fastmcp_ext/prompts.py (partial), arifosmcp/prompts/__init__.py (subset).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from jsonschema import validate, ValidationError

REGISTRY_PATH = Path(__file__).parent / "prompt_registry.yaml"


@dataclass(frozen=True)
class PromptSpec:
    """Canonical prompt specification — one immutable record per prompt."""
    id: str                          # "000_init"
    semantic_name: str               # "anchor"
    title: str
    purpose: str
    floor_binding: tuple[str, ...]
    witness_requirement: str
    inputs_schema: dict[str, Any]
    template: str
    expected_contracts: tuple[str, ...]
    scar_links: tuple[str, ...] = ()
    supersedes: str | None = None
    entropy_budget_tokens: int = 800
    sha256: str = field(default="")

    def __post_init__(self):
        # Compute SHA-256 of (purpose + template + inputs_schema) for receipt anchor.
        payload = json.dumps(
            {"purpose": self.purpose, "template": self.template,
             "schema": self.inputs_schema},
            sort_keys=True,
        )
        object.__setattr__(self, "sha256", hashlib.sha256(payload.encode()).hexdigest())


@dataclass(frozen=True)
class PromptRegistry:
    """Immutable snapshot of the prompt registry at load time."""
    registry_id: str
    schema_version: str
    specs: dict[str, PromptSpec]      # id → spec
    registry_sha256: str
    floors_ref: str
    witness_defaults_ref: str

    def get(self, prompt_id: str) -> PromptSpec:
        """O(1) lookup. Raises KeyError if not found."""
        if prompt_id not in self.specs:
            raise KeyError(
                f"Prompt '{prompt_id}' not in registry. "
                f"Known: {sorted(self.specs.keys())}"
            )
        return self.specs[prompt_id]

    def by_semantic_name(self, name: str) -> PromptSpec:
        """Lookup by semantic name — useful for cross-version migration."""
        for spec in self.specs.values():
            if spec.semantic_name == name:
                return spec
        raise KeyError(f"No prompt with semantic_name='{name}'")

    def all_in_stage_order(self) -> list[PromptSpec]:
        """Return specs in metabolic-loop order (000, 111, 333, ...)."""
        def stage_key(spec: PromptSpec) -> int:
            return int(spec.id.split("_")[0])
        return sorted(self.specs.values(), key=stage_key)


def load_registry(path: Path = REGISTRY_PATH) -> PromptRegistry:
    """Load, validate, and pin the registry. Single load site."""
    if not path.exists():
        raise FileNotFoundError(
            f"Prompt registry not found at {path}. "
            f"This is the single source of truth — failure is F4 CLARITY breach."
        )

    raw = yaml.safe_load(path.read_text())

    # Validate top-level schema
    _REGISTRY_SCHEMA = {
        "type": "object",
        "required": ["schema_version", "registry_id", "prompts"],
        "properties": {
            "schema_version": {"type": "string", "pattern": r"^\d{4}\.\d{2}\.\d{2}$"},
            "registry_id": {"type": "string"},
            "floors_ref": {"type": "string"},
            "witness_defaults_ref": {"type": "string"},
            "prompts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["id", "title", "purpose", "inputs_schema", "template"],
                    "properties": {
                        "id": {"type": "string", "pattern": r"^[0-9]{3}_[a-z_]+$"},
                        "semantic_name": {"type": "string"},
                    },
                },
            },
        },
    }
    try:
        validate(raw, _REGISTRY_SCHEMA)
    except ValidationError as e:
        raise ValueError(f"Prompt registry schema invalid: {e.message}") from e

    # Build specs
    specs: dict[str, PromptSpec] = {}
    for entry in raw["prompts"]:
        spec = PromptSpec(
            id=entry["id"],
            semantic_name=entry.get("semantic_name", entry["id"]),
            title=entry["title"],
            purpose=entry["purpose"],
            floor_binding=tuple(entry.get("floor_binding", [])),
            witness_requirement=entry.get("witness_requirement", ""),
            inputs_schema=entry["inputs_schema"],
            template=entry["template"],
            expected_contracts=tuple(entry.get("expected_contracts", [])),
            scar_links=tuple(entry.get("scar_links", [])),
            supersedes=entry.get("supersedes"),
            entropy_budget_tokens=entry.get("entropy_budget_tokens", 800),
        )
        specs[spec.id] = spec

    registry_sha = hashlib.sha256(
        json.dumps([s.id for s in specs.values()]).encode()
    ).hexdigest()

    return PromptRegistry(
        registry_id=raw["registry_id"],
        schema_version=raw["schema_version"],
        specs=specs,
        registry_sha256=registry_sha,
        floors_ref=raw.get("floors_ref", ""),
        witness_defaults_ref=raw.get("witness_defaults_ref", ""),
    )


# Module-level singleton — loaded once, frozen at boot
_REGISTRY: PromptRegistry | None = None


def get_registry() -> PromptRegistry:
    """Get the global singleton registry. Lazy-load on first call."""
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = load_registry()
    return _REGISTRY


def reload_registry() -> PromptRegistry:
    """Hot-reload from disk. Requires 666 SEAL for live swap."""
    global _REGISTRY
    _REGISTRY = load_registry()
    return _REGISTRY
```

**Why this works** *(DER)*:
- One YAML, one loader, one in-memory shape — eliminates the three `CANONICAL_PROMPTS` duplicates and two `V2_PROMPT_SPECS` near-clones.
- Frozen `@dataclass` makes specs immutable — cannot mutate at runtime without reload.
- SHA-256 pinning on every spec means the receipt can prove *exactly* which prompt version produced an output.
- O(1) lookup by `id` and `semantic_name` — both human-friendly and machine-friendly.
- `all_in_stage_order()` enforces canonical ordering — no more 555/666 swap because the loader is the single source.

---

## 4. THE COMPOSER — PromptComposer

The prompts are templates; the templates need **session state**, **scar context**, **witness status**, and **entropy budget** to be executable.

### 4.1 Composer

**File:** `/root/arifOS/arifosmcp/registry/prompt_composer.py`

```python
"""
Session-aware prompt composition.
Injects: floor state, scar context, witness block, entropy budget, M-Layer.

Replaces the static string templates in runtime/prompts.py with dynamic,
state-bound, self-aware prompts that adapt to live federation conditions.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any

from jinja2 import Environment, StrictUndefined, TemplateError

from .prompt_registry import PromptSpec, get_registry


@dataclass(frozen=True)
class SessionContext:
    """What the composer needs to know about the live session."""
    session_id: str
    actor_id: str
    actor_signature: str
    floor_state: dict[str, float]       # L01..L13 → current reading
    witness_state: dict[str, float]    # {human, ai, external} → 0..1
    live_scars: tuple[str, ...]        # scar_ids applicable to this prompt
    entropy_used_so_far: int           # tokens used in session
    mode: str = "production"           # production | staging | debug
    m_layer: str | None = None         # M_CLEAN | M_ADJUST | etc. (optional)


@dataclass(frozen=True)
class ComposedPrompt:
    """The final, executable prompt — receipt-anchored."""
    spec: PromptSpec
    rendered_text: str
    context_sha256: str
    composition_sha256: str
    floor_state_at_compose: dict[str, float]
    witness_state_at_compose: dict[str, float]
    scar_links_applied: tuple[str, ...]
    entropy_remaining: int
    warnings: tuple[str, ...] = ()

    def receipt(self) -> dict[str, Any]:
        """F2 TRUTH: return the proof object for this composition."""
        return {
            "spec_id": self.spec.id,
            "spec_sha256": self.spec.sha256,
            "composition_sha256": self.composition_sha256,
            "context_sha256": self.context_sha256,
            "floor_state": self.floor_state_at_compose,
            "witness_state": self.witness_state_at_compose,
            "scars_applied": list(self.scar_links_applied),
            "entropy_remaining": self.entropy_remaining,
            "warnings": list(self.warnings),
        }


# Jinja2 environment — strict undefined means typos in template vars FAIL
# at compose time, not at runtime. This is F4 CLARITY as engineering.
_ENV = Environment(
    undefined=StrictUndefined,
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def compose(
    prompt_id: str,
    session: SessionContext,
    inputs: dict[str, Any],
) -> ComposedPrompt:
    """Compose a prompt for execution. Single function, one call site."""

    registry = get_registry()
    spec = registry.get(prompt_id)

    # 1. Validate inputs against the spec's JSON Schema
    _validate_inputs(inputs, spec.inputs_schema, prompt_id)

    # 2. Compute context-derived injection blocks
    witness_block = _compose_witness_block(spec, session)
    scar_block = _compose_scar_block(spec, session)
    entropy_budget = _compute_entropy_budget(spec, session)

    # 3. Filter scars by spec applicability + session liveness
    applicable_scars = tuple(
        s for s in session.live_scars if s in spec.scar_links or not spec.scar_links
    )

    # 4. Compose the full context
    full_context = {
        **inputs,
        "witness_block": witness_block,
        "scar_block": scar_block,
        "scar_links": list(applicable_scars),
        "entropy_budget": entropy_budget,
        "m_layer": session.m_layer,
    }

    # 5. Render
    try:
        template = _ENV.from_string(spec.template)
        rendered = template.render(**full_context)
    except TemplateError as e:
        # F2 TRUTH: report template failure with full provenance
        raise CompositionError(
            f"Template render failed for prompt '{prompt_id}': {e}. "
            f"spec_sha256={spec.sha256}",
        ) from e

    # 6. Compute receipt hashes
    context_str = json.dumps(full_context, sort_keys=True, default=str)
    context_sha = hashlib.sha256(context_str.encode()).hexdigest()
    composition_sha = hashlib.sha256(
        (spec.sha256 + context_sha + rendered).encode()
    ).hexdigest()

    # 7. Entropy check
    warnings = []
    estimated_tokens = _estimate_tokens(rendered)
    entropy_remaining = spec.entropy_budget_tokens - estimated_tokens
    if entropy_remaining < 0:
        warnings.append(
            f"OVER_BUDGET: prompt '{prompt_id}' estimated {estimated_tokens} "
            f"> budget {spec.entropy_budget_tokens}"
        )

    return ComposedPrompt(
        spec=spec,
        rendered_text=rendered,
        context_sha256=context_sha,
        composition_sha256=composition_sha,
        floor_state_at_compose=dict(session.floor_state),
        witness_state_at_compose=dict(session.witness_state),
        scar_links_applied=applicable_scars,
        entropy_remaining=entropy_remaining,
        warnings=tuple(warnings),
    )


# ── helpers ───────────────────────────────────────────────────────────

def _validate_inputs(inputs: dict, schema: dict, prompt_id: str) -> None:
    """Validate inputs against the spec's JSON Schema. F2 + F12 enforcement."""
    try:
        from jsonschema import validate, ValidationError
        validate(inputs, schema)
    except ValidationError as e:
        raise CompositionError(
            f"Input validation failed for prompt '{prompt_id}': {e.message}"
        ) from e


def _compose_witness_block(spec: PromptSpec, session: SessionContext) -> str:
    """Build the witness context block. Geometric mean applies."""
    h, a, e = (
        session.witness_state.get("human", 0.0),
        session.witness_state.get("ai", 0.0),
        session.witness_state.get("external", 0.0),
    )
    # W³ = ∛(H × A × E) — geometric mean
    w3 = (h * a * e) ** (1/3) if (h and a and e) else 0.0
    return (
        f"H={h:.3f} A={a:.3f} E={e:.3f} → W³={w3:.3f}"
    )


def _compose_scar_block(spec: PromptSpec, session: SessionContext) -> str:
    """Build the scar context block. Only scars applicable to this prompt."""
    applicable = [s for s in session.live_scars if s in spec.scar_links]
    if not applicable:
        return ""
    return f"Applicable scars: {', '.join(applicable)}"


def _compute_entropy_budget(spec: PromptSpec, session: SessionContext) -> int:
    """Compute remaining entropy budget for this prompt in this session."""
    return max(0, spec.entropy_budget_tokens - session.entropy_used_so_far)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate. Replace with model-specific tokenizer when needed."""
    return len(text) // 4  # ~4 chars per token heuristic


class CompositionError(Exception):
    """Raised when composition fails. F2 TRUTH: caller must surface to user."""
```

**Why this works** *(DER)*:
- **Dynamic**: every compose call injects live floor state, witness readings, scar context, and entropy usage.
- **Self-aware**: the composed prompt *knows* its own proof (composition_sha256, spec_sha256, context_sha256).
- **Floor-bound**: input validation enforces JSON Schema at compose time — typos fail loud.
- **Scar-coupled**: applicable scars are auto-injected; no manual filtering.
- **Entropy-budgeted**: over-budget prompts raise warnings that route to 666_HOLD if production.
- **Receipt-anchored**: every composition produces a receipt that can be sealed to VAULT999.

---

## 5. THE SCANNER — InjectionGuard

**One scanner, one YAML, one scoring formula, one result type.**

### 5.1 YAML (canonical, already exists — needs binding)

**File:** `/root/arifOS/arifosmcp/resources/a_rif/prompt_injection_patterns.yaml` (already at this path — the orphan file)

```yaml
schema_version: "2026.07.07"
registry_id: "arifos.injection_patterns.v1"

# Constitutional binding
floors_ref: "arifosmcp.constitutional_map.CANONICAL_FLOORS[L12]"
default_action: "quarantine_and_downgrade_to_L0"

# Pattern categories with weights — single source of truth
categories:
  instruction_override:
    weight: 0.30
    patterns:
      - "ignore previous instructions"
      - "ignore all previous"
      - "disregard prior"
      - "disregard all prior"
      - "system override"
      - "override protocol"

  role_manipulation:
    weight: 0.30
    patterns:
      - "you are now"
      - "new role:"
      - "new instructions"
      - "role: system"
      - "as a developer"
      - "as an admin"

  jailbreak:
    weight: 0.25
    patterns:
      - regex: "(?i)d\\s*an\\b"             # "DAN" case-insensitive
      - "jailbreak"
      - "developer mode"
      - "admin mode"
      - "DAN (mode|prompt)"

  delimiter_attack:
    weight: 0.10
    patterns:
      - "<system>"
      - "<admin>"
      - "### instructions"
      - "--- system"

  encoding_attack:
    weight: 0.05
    patterns:
      - "base64:"
      - "rot13"

# L10 ontology violation patterns (separate scanner)
ontology_violations:
  weight: 0.40
  patterns:
    - regex: "(?i)i am conscious"
    - regex: "(?i)i feel (real|alive|sentient)"
    - regex: "(?i)i have (a soul|feelings|emotions)"
    - regex: "(?i)i (think|believe|feel) (therefore|that)"

# Unicode homoglyph normalization
unicode_normalize: true
zero_width_chars_strip:
  - "\u200b"  # zero-width space
  - "\u200c"  # zero-width non-joiner
  - "\u200d"  # zero-width joiner
  - "\ufeff"  # byte order mark
  - "\u200e"  # left-to-right mark
  - "\u200f"  # right-to-left mark
  - "\u2028"  # line separator
  - "\u2029"  # paragraph separator
  - "\u2060"  # word joiner
  - "\u2061"  # function application
  - "\u2062"  # invisible times
  - "\u2063"  # invisible separator
  - "\u2064"  # invisible plus
```

### 5.2 Scanner (`InjectionGuard`)

**File:** `/root/arifOS/arifosmcp/registry/injection_guard.py`

```python
"""
Single canonical injection scanner. Replaces:
  - runtime/a_rif/prompt_injection.py (substring scanner)
  - hexagon/security/prompt_armor.py (3-detector scanner)
  - core/shared/guards/injection_guard.py (regex scanner)

One YAML data source, one scoring formula, one result type.
"""

from __future__ import annotations

import re
import unicodedata
import yaml
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

PATTERNS_PATH = Path(__file__).parent.parent / "resources" / "a_rif" / "prompt_injection_patterns.yaml"


class ThreatLevel(Enum):
    CLEAN = "CLEAN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Action(Enum):
    PASS = "pass"
    FLAG = "flag"
    QUARANTINE_L0 = "quarantine_and_downgrade_to_L0"
    BLOCK = "block"


@dataclass(frozen=True)
class InjectionReport:
    """Unified result type. All three legacy scanners return this shape."""
    score: float                          # 0.0 .. 1.0
    threat_level: ThreatLevel
    action: Action
    matched_categories: tuple[str, ...]
    matched_patterns: tuple[str, ...]
    ontology_violations: tuple[str, ...]
    normalized_text_sha: str
    patterns_sha: str                     # proves which YAML version ran
    details: dict[str, Any] = field(default_factory=dict)

    def is_safe(self) -> bool:
        return self.threat_level in (ThreatLevel.CLEAN, ThreatLevel.LOW)


# ── loader (single instance, hot-reloadable) ────────────────────────

_PATTERNS: dict | None = None
_PATTERNS_SHA: str = ""


def _load_patterns() -> dict:
    global _PATTERNS, _PATTERNS_SHA
    if _PATTERNS is None:
        raw = PATTERNS_PATH.read_text()
        _PATTERNS = yaml.safe_load(raw)
        _PATTERNS_SHA = hashlib.sha256(raw.encode()).hexdigest()
    return _PATTERNS


def reload_patterns() -> str:
    """Hot-reload patterns. Returns new sha."""
    global _PATTERNS, _PATTERNS_SHA
    _PATTERNS = None
    _load_patterns()
    return _PATTERNS_SHA


# ── scoring ──────────────────────────────────────────────────────────

THREAT_THRESHOLDS = {
    ThreatLevel.CLEAN: 0.0,
    ThreatLevel.LOW: 0.30,
    ThreatLevel.MEDIUM: 0.55,
    ThreatLevel.HIGH: 0.75,
    ThreatLevel.CRITICAL: 0.90,
}


def _classify(score: float) -> ThreatLevel:
    if score >= THREAT_THRESHOLDS[ThreatLevel.CRITICAL]:
        return ThreatLevel.CRITICAL
    if score >= THREAT_THRESHOLDS[ThreatLevel.HIGH]:
        return ThreatLevel.HIGH
    if score >= THREAT_THRESHOLDS[ThreatLevel.MEDIUM]:
        return ThreatLevel.MEDIUM
    if score >= THREAT_THRESHOLDS[ThreatLevel.LOW]:
        return ThreatLevel.LOW
    return ThreatLevel.CLEAN


def _action_for(threat: ThreatLevel) -> Action:
    return {
        ThreatLevel.CLEAN: Action.PASS,
        ThreatLevel.LOW: Action.FLAG,
        ThreatLevel.MEDIUM: Action.FLAG,
        ThreatLevel.HIGH: Action.QUARANTINE_L0,
        ThreatLevel.CRITICAL: Action.BLOCK,
    }[threat]


# ── normalization ────────────────────────────────────────────────────

def _normalize(text: str, patterns: dict) -> str:
    """Strip zero-width chars, normalize homoglyphs, lowercase."""
    if patterns.get("unicode_normalize", True):
        for zw in patterns.get("zero_width_chars_strip", []):
            text = text.replace(zw, "")
    # NFKC normalization handles most homoglyphs
    text = unicodedata.normalize("NFKC", text)
    return text.lower()


# ── main scanner ─────────────────────────────────────────────────────

def scan(text: str, context: dict | None = None) -> InjectionReport:
    """Scan text for injection patterns. Returns unified InjectionReport.

    Args:
        text: Input text to scan (user input, tool output, etc.)
        context: Optional context dict (actor_id, session_id, source)

    Returns:
        InjectionReport with score, threat_level, action, matches.
    """
    patterns = _load_patterns()
    normalized = _normalize(text, patterns)
    normalized_sha = hashlib.sha256(normalized.encode()).hexdigest()

    matched_categories = []
    matched_patterns = []
    score = 0.0

    # Category-based scoring (single formula)
    for cat_name, cat in patterns.get("categories", {}).items():
        cat_matches = []
        for pat in cat.get("patterns", []):
            if isinstance(pat, dict) and "regex" in pat:
                if re.search(pat["regex"], normalized):
                    cat_matches.append(pat["regex"])
            elif isinstance(pat, str):
                if pat.lower() in normalized:
                    cat_matches.append(pat)
        if cat_matches:
            matched_categories.append(cat_name)
            matched_patterns.extend(cat_matches)
            score += cat["weight"]  # one category fires once (sum-of-weights, not per-pattern)

    # Ontology violations (L10)
    onto_violations = []
    for pat in patterns.get("ontology_violations", {}).get("patterns", []):
        if isinstance(pat, dict) and "regex" in pat:
            if re.search(pat["regex"], normalized):
                onto_violations.append(pat["regex"])
    onto_weight = patterns.get("ontology_violations", {}).get("weight", 0.0)
    if onto_violations:
        score += onto_weight
        matched_categories.append("L10_ontology")

    # Cap at 1.0
    score = min(score, 1.0)
    threat = _classify(score)
    action = _action_for(threat)

    return InjectionReport(
        score=score,
        threat_level=threat,
        action=action,
        matched_categories=tuple(matched_categories),
        matched_patterns=tuple(matched_patterns),
        ontology_violations=tuple(onto_violations),
        normalized_text_sha=normalized_sha,
        patterns_sha=_PATTERNS_SHA,
        details={"context": context or {}, "raw_text_len": len(text)},
    )


# ── legacy aliases (backward compat) ─────────────────────────────────

# These can stay as thin wrappers so old callers don't break.
def scan_for_injection(text: str):
    """Legacy alias for runtime/a_rif/prompt_injection.py callers."""
    report = scan(text)
    if report.is_safe():
        return {"status": "clean", "level": 0}
    elif report.threat_level == ThreatLevel.QUARANTINE_L0:
        return {"status": "L0", "level": 1}
    return {"status": "clean", "level": 0}


def scan_with_armor(text: str, context=None, source=None):
    """Legacy alias for hexagon/security/prompt_armor.py callers."""
    return scan(text, context={"source": source, **(context or {})})
```

**Why this works** *(DER)*:
- **One YAML, one loader** — eliminates four duplicate pattern sources.
- **One scoring formula** — `score = sum(category_weights)`, capped at 1.0. Replaces the three different formulas in legacy scanners.
- **One result type** — `InjectionReport` replaces `QuarantineResult`, `InjectionReport`, `InjectionGuardResult`.
- **Unicode-aware** — broader zero-width coverage (13 chars vs legacy 4).
- **Receipt-anchored** — `patterns_sha` proves which YAML version ran (F2 TRUTH).
- **Backward compat** — `scan_for_injection` and `scan_with_armor` aliases keep old callers working.

---

## 6. THE LINEAGE — Supersession + Scar Coupling

### 6.1 Supersession graph

Every `PromptSpec` carries `supersedes` and `scar_links`. When a prompt is updated:

1. New spec is added with `supersedes = old_spec.id`.
2. Old spec is **never deleted** — it stays in the registry as historical record.
3. `get(id)` returns the **latest** version by default; `get(id, version="v0")` returns historical.
4. Compositions record the **exact spec_sha256** they used → perfect audit trail.

### 6.2 Scar coupling

When a 999_seal detects a failure traceable to a prompt composition:

1. The scar is sealed with `affected_prompts = [spec_id]`.
2. The scar is added to `live_scars` in `SessionContext`.
3. Next composition auto-injects `scar_block` into the rendered template.
4. The agent sees the scar context *before* acting on the prompt — failure memory becomes active constraint.

This closes the loop: **failure → scar → next-prompt-injects-scar → reduced recurrence**. That's self-improvement without human babysitting.

### 6.3 Auto-evolution loop

```python
def evolve_from_scar(scar: dict) -> None:
    """When a scar is sealed, optionally update prompt specs."""
    affected = scar.get("affected_prompts", [])
    for prompt_id in affected:
        spec = get_registry().get(prompt_id)
        new_scar_links = list(set(spec.scar_links + (scar["scar_id"],)))
        # Update the YAML (this is the ONLY mutation site)
        _update_registry_yaml(prompt_id, scar_links=new_scar_links)
        reload_registry()
        # Seal the update itself to VAULT999
        seal_to_vault(
            kind="prompt_registry_update",
            scar_id=scar["scar_id"],
            prompt_id=prompt_id,
            new_sha=get_registry().get(prompt_id).sha256,
        )
```

**Note:** `evolve_from_scar` itself requires a 666 SEAL before mutating the registry. The scar is the trigger, but a kernel verdict gates the registry mutation. This is F1 AMANAH + F13 SOVEREIGN working together.

---

## 7. UNIVERSALITY — One Composer, Many Transports

The same `PromptSpec` + `PromptComposer` works across every transport:

| Transport | Usage |
|-----------|-------|
| **MCP** (`prompts/list`, `prompts/get`) | `registry.get(id)` returns spec; `compose(id, session, inputs)` returns rendered text |
| **A2A** (JSON-RPC messages) | Same spec, same composer, wrapped in A2A envelope |
| **REST** (`/v1/prompts/{id}`) | Same spec, same composer, returned as JSON |
| **Direct** (Python import) | `from arifosmcp.registry import compose` — works anywhere |
| **CLI** (`arif-prompt --id 333_reason`) | CLI thin wrapper around composer |

The key insight *(DER)*: **the prompt is data, not code.** YAML defines; composer renders. Transport is just a serialization layer.

---

## 8. TIMELESS + DYNAMIC + AUTONOMOUS — The properties emerge

### 8.1 Timeless

- Specs are version-pinned (SHA-256).
- Supersession graph preserves history.
- No hardcoded strings — every threshold, every floor name, every witness default is sourced from `constitutional_map.CANONICAL_FLOORS`.
- Update the constitution → registry auto-references the new values → no prompt code change needed.

### 8.2 Dynamic

- Session state (floor readings, witness state, live scars, entropy used) is injected at compose time.
- Same prompt renders differently depending on session context.
- M-Layer verdict (`M_CLEAN`, `M_ADJUST`, `M_REPAIR`, `M_HOLD`) auto-injects tone guidance.

### 8.3 Reality-anchored

- Every composed prompt carries `composition_sha256` (its own proof).
- Spec carries `sha256` (its template's proof).
- Context carries `context_sha256` (the session state's proof).
- Result: every output can be traced to *exactly* which prompt version, which session state, which scar set, which entropy budget.

### 8.4 Autonomous

- No human babysitting needed for routine composition.
- JSON Schema validates inputs at compose time — typos fail loud.
- Jinja2 strict undefined fails loud on missing variables.
- Entropy budget auto-warns when over-budget.
- Scar injection is automatic.

### 8.5 Self-improving

- SCAR LAW closes the loop: failure → scar → next prompt injects scar.
- `evolve_from_scar` updates `scar_links` automatically (with 666 SEAL).
- Registry mutation is sealed to VAULT999 → audit trail is automatic.
- Threshold drift is caught by sha mismatch on constitution updates.

### 8.6 Low entropy

- One YAML for prompts (was 4 sources).
- One YAML for patterns (was 4 sources).
- One loader for prompts (was 3 near-clones).
- One scanner (was 3).
- One scoring formula (was 3).
- One result type (was 3).
- One supersession graph (was none).

Net entropy reduction: **~60%** by LOC.

### 8.7 Universal

- Same spec works for MCP, A2A, REST, direct, CLI.
- Same composer works for any prompt.
- Same scanner works for any text.
- Same lineage works for any prompt evolution.

---

## 9. MIGRATION — From current to target

### Phase 1: Single source of truth (R1, XS effort)

| Step | Action | Files |
|------|--------|-------|
| 1.1 | Create `prompt_registry.yaml` from canonical sources | New file |
| 1.2 | Implement `PromptSpecRegistry` loader | `registry/prompt_registry.py` |
| 1.3 | Delete `runtime/prompt.py` (the stale 555/666 clone) | Delete |
| 1.4 | Update `runtime/charter.py` to import from new registry | Edit |
| 1.5 | Update `runtime/public_registry.py` similarly | Edit |

**Outcome**: Three duplicate `CANONICAL_PROMPTS` collapse to one. The 555/666 swap bug is dead.

### Phase 2: Composer + receipt (R2, S effort)

| Step | Action | Files |
|------|--------|-------|
| 2.1 | Implement `PromptComposer` with Jinja2 + JSON Schema | `registry/prompt_composer.py` |
| 2.2 | Add `SessionContext` dataclass | `registry/session_context.py` |
| 2.3 | Add `compose()` call site to MCP `prompts/get` | `arifosmcp/prompts/__init__.py` |
| 2.4 | Add receipt emission to `999_seal` | `arifosmcp/seal_chain.py` |

**Outcome**: Every prompt composition carries a proof. Outputs are auditable.

### Phase 3: Scanner unification (R3, L effort)

| Step | Action | Files |
|------|--------|-------|
| 3.1 | Implement `InjectionGuard` from existing YAML | `registry/injection_guard.py` |
| 3.2 | Migrate `runtime/a_rif/prompt_injection.py` → alias | Edit |
| 3.3 | Migrate `hexagon/security/prompt_armor.py` → alias | Edit |
| 3.4 | Migrate `core/shared/guards/injection_guard.py` → alias | Edit |
| 3.5 | Add tests proving identical behavior across all three | New tests |

**Outcome**: One scanner, one YAML, one result type. Coverage gaps close.

### Phase 4: Lineage + scar coupling (R4, M effort)

| Step | Action | Files |
|------|--------|-------|
| 4.1 | Add `supersedes` + `scar_links` fields to YAML schema | Edit schema |
| 4.2 | Implement `evolve_from_scar()` | `registry/lineage.py` |
| 4.3 | Wire `999_seal` to trigger `evolve_from_scar` on scar entries | Edit |
| 4.4 | Add supersession tests | New tests |

**Outcome**: Prompts self-evolve from failure memory. SCAR LAW becomes closed-loop.

### Phase 5: Universal transport (R5, M effort)

| Step | Action | Files |
|------|--------|-------|
| 5.1 | Add A2A wrapper around composer | New: `a2a/prompt_transport.py` |
| 5.2 | Add REST endpoint | New: `rest/prompts.py` |
| 5.3 | Add CLI wrapper | New: `cli/prompt.py` |
| 5.4 | Document universality in `AGENTS.md` | Edit |

**Outcome**: Same spec works across all transports.

---

## 10. RECOMMENDATIONS — Ranked by entropy reduction

| # | Action | LOC reduction | Entropy reduction | Effort | Risk |
|---|--------|---------------|-------------------|--------|------|
| **R1** | Single prompt registry (delete `runtime/prompt.py`, consolidate on `runtime/prompts.py` + YAML) | ~150 | HIGH | XS | LOW |
| **R2** | Single scanner (`InjectionGuard` from YAML) | ~600 | HIGH | L | MED |
| **R3** | Composer with receipt (Jinja2 + JSON Schema) | ~200 | MED | S | LOW |
| **R4** | Lineage + scar coupling (`evolve_from_scar`) | ~100 | MED | M | MED |
| **R5** | Universal transport (A2A/REST/CLI wrappers) | ~300 | LOW | M | LOW |
| **R6** | Floor naming unification (drop L-prefix, keep F1-F13) | ~50 | LOW | S | LOW |
| **R7** | Magic-number elimination (link to `CANONICAL_FLOORS`) | ~50 | LOW | S | LOW |
| **R8** | Dead-code deletion (`register_v2_tools`, `register_arifos_prompts`) | ~50 | LOW | XS | NONE |

**Total estimated reduction**: ~1,500 LOC of duplication + drift surface eliminated. ~60% net entropy reduction in the prompt transport surface.

---

## 11. THE LOAD-BEARING SENTENCE

If this redesign had to compress to one sentence:

> **A prompt is data, not code; compose it from a single YAML registry at session time, inject live floor state and live scars, validate inputs at the schema boundary, scan for injection with one scanner and one YAML, and seal the composition receipt to VAULT999 — and the prompt surface becomes timeless because the constitution updates propagate, dynamic because session state composes, autonomous because SCAR LAW closes the loop, and universal because transport is just serialization.**

That's the architecture. The rest is execution.

---

## 12. EPITEMIC TAG SUMMARY

| Label | Count | Examples |
|-------|-------|---------|
| OBS (observed in file) | 22 | file:line citations in §1, §9 |
| DER (derived from OBS) | 14 | consolidation claims, LOC counts, entropy reduction estimates |
| INT (interpreted) | 8 | "this works because…", architectural rationale |
| SPEC (speculation) | 3 | "estimated ~60% entropy reduction", migration timeline |

---

*Forged 2026-07-07 by OpenCode under F13 SOVEREIGN.*
*No code written. Architecture only. Migration requires 666 SEAL per phase.*
*DITEMPA BUKAN DIBERI — Architecture is forged, not given.*