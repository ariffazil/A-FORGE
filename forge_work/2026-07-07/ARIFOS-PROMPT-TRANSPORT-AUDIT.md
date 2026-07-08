# arifOS MCP Prompt Transport — Surface Audit

**Date:** 2026-07-07
**Auditor:** OpenCode (333-AGI forge instrument, bound to F13)
**Scope:** 9 user-specified files + 3 directly-invoked satellites
**Method:** Read-only static analysis. No mutations.

---

## ⚠️ Scope Correction (OBS)

The user-specified path `7. /root/arifOS/arifosmcp/runtime/a_rif/prompt_injection_patterns.yaml` does **not exist**. The actual file is at:

- `/root/arifOS/arifosmcp/resources/a_rif/prompt_injection_patterns.yaml` (9 lines)

This directory mismatch is itself an entropy source (DER) — a candidate for path drift between two a_rif locations: `runtime/a_rif/` (where `prompt_injection.py` lives) and `resources/a_rif/` (where the YAML lives). They do not reference each other (see §5).

---

## File-by-File Audit

### 1. `/root/arifOS/arifosmcp/runtime/prompts.py`

**What it does** *(OBS)*: Declares a `CANONICAL_PROMPTS` tuple and a `V2_PROMPT_SPECS` dict-tuple, then exposes a thin `register_v2_prompts` wrapper that delegates to `arifosmcp.prompts.register_prompts`. Marked with header comment "Runtime prompt registry — must match arifosmcp.prompts.CANONICAL_PROMPTS".

- **LOC:** 81
- **Key abstractions:**
  - `CANONICAL_PROMPTS` (lines 3–12) — 8-entry tuple: loop_engineer + 000–999 in canonical RSI-correct order (critique 555 before judge 666)
  - `V2_PROMPT_SPECS` (lines 14–71) — 8 dict specs (name/description/input_schema/default_tools/tool_choice)
  - `register_v2_prompts(mcp)` (line 74) — delegates via lazy import
  - `register_v2_tools(mcp, **kwargs)` (line 80) — returns `[]` (dead/stub)
- **Duplications:** **Triple source-of-truth** for the canonical sequence (also in `arifosmcp/prompts/__init__.py:180` and `runtime/prompt.py:9`). The header comment even acknowledges the coupling ("must match").
- **Dead code:** `register_v2_tools` returns `[]`; unused unless external caller wires tools later. Empty `input_schema={}` and empty `default_tools=[]` for all 8 specs — schema promises fields that are never filled.
- **Entropy sources:**
  - Hardcoded stage names + description strings duplicated verbatim from `arifosmcp/prompts/__init__.py`
  - `register_v2_prompts` re-imports on every call (lazy import) — fine for cold-start, but indirection hides the actual registration
  - Empty schema blocks (lines 18, 25, 32, …) — could be a frozen default_factory
- **Hardcoded strings to template:**
  - Floor names in descriptions ("F2 computed", "F7 computed", "F5/F6 computed") — refer to kernel; could be enum references
  - Stage number prefixes ("000", "111", …) — could be derived from a constant
- **Timeless/agentic potential:** Could be a single `@dataclass PromptSpec` instead of dict-tuple; the loop_engineer name could be `intake` (semantic), and `tool_choice` could be inferred from a central capability map.

---

### 2. `/root/arifOS/arifosmcp/runtime/fastmcp_ext/prompts.py`

**What it does** *(OBS)*: Registers two additional FastMCP prompts (`constitutional_pre_flight`, `agi_reply_protocol_v3`) via the `@mcp.prompt()` decorator.

- **LOC:** 64
- **Key abstractions:**
  - `register_arifos_prompts(mcp)` (line 11) — single entry point, returns `list[str]` of registered names
  - Two `@mcp.prompt()`-decorated closures: `constitutional_pre_flight(operation)` and `agi_reply_protocol_v3(query, recipient)`
- **Duplications:** None of the content duplicates `prompts/__init__.py` directly — these are workflow templates, not constitutional organs. But the floor enumeration (F1-F13) in `constitutional_pre_flight` is a **parallel representation** of the same canon defined in `AGENTS.md` §"Constitutional Laws".
- **Dead code:** **Confirmed** via `grep -r register_arifos_prompts` — only definition site + `__all__` reference it. **Never called anywhere.** (INT) Likely intended for a future FastMCP server wiring that was never completed.
- **Entropy sources:**
  - Hardcoded F1–F13 thresholds inside the template body (lines 18–31): "τ ≥ 0.99", "≥ 0.95", "≥ 0.70", "Ω₀ = 0.03–0.05", "≥ 0.80", "< 0.85". These are static strings that drift if the canonical thresholds change in `constitutional_map.py`.
  - Floor name spelling inconsistencies: writes "F2 HAQQ" (line 19) — **HAQQ is not the canonical F2 name** elsewhere (kernel uses F2 TRUTH). (DER) This is a stale 2024-era label left in the template.
  - "L10 ONTOLOGY" (line 28) and "L11 COMMAND AUTH" (line 29) and "L12 INJECTION" and "L13 SOVEREIGN" — the "L" prefix is correct in `AGENTS.md`, but most other arifOS files use "F" for the same floors. **Inconsistent floor prefixing** is a low-grade entropy source.
- **Hardcoded strings to template:**
  - The 13-floor checklist should be data — a `FLOOR_CHECK_TEMPLATE` constant or a generated list.
  - The "TO/CC/TITLE/KEY_CONTEXT header" envelope structure in `agi_reply_protocol_v3` (line 47) — this references a sealed envelope spec that lives elsewhere; should import.
- **Timeless/agentic potential:** If the function were actually wired, both prompts could be `data-driven` (floor list, threshold values) loaded from `constitutional_map.CANONICAL_FLOORS`. Currently they are the most stale-prone file in the surface.

---

### 3. `/root/arifOS/arifosmcp/specs/prompt_specs.py`

**What it does** *(OBS)*: The most structured prompt-transport file. Defines a `PromptArgument` dataclass and a `PromptSpec` dataclass, declares 10 canonical workflow specs, and provides a tiny Jinja-ish template renderer.

- **LOC:** 394
- **Key abstractions:**
  - `@dataclass(frozen=True) PromptArgument` (line 24) — typed arg (name/required/description/arg_type/default)
  - `@dataclass(frozen=True) PromptSpec` (line 35) — clean MCP-compliant shape: name/title/description/arguments/template_text/expected_contracts
  - `_arg(...)` helper (line 58) — arg-builder
  - `CANONICAL_PROMPT_SPECS: tuple[PromptSpec, ...]` (line 79) — 10 specs covering session lifecycle, evidence, reasoning, safety, routing, memory, estimation, judgment, explanation, vault
  - `PROMPT_NAMES` (line 316) — derived name list
  - `get_prompt_spec(name)` (line 319) — O(n) linear lookup
  - `prompt_spec_to_mcp_schema(spec)` (line 327) — schema adapter for `prompts/list`
  - `render_prompt(spec, **kwargs)` (line 344) — minimal Jinja2-like substitution (`{{var|default('x')}}`, `{% if var %}…{% endif %}`, `{{var}}`)
- **Duplications:** None of the 10 specs duplicate `prompts/__init__.py` content. **However**, the spec names (`prompt_init_anchor`, `prompt_sense_reality`, …) are referenced in `arifosmcp/specs/chatgpt_subset.py:49–52` (DER) — so this file is wired to a downstream spec, unlike the dead `fastmcp_ext/prompts.py`.
- **Dead code:** None detected — all 5 public functions reachable, `__all__` is correct.
- **Entropy sources:**
  - `get_prompt_spec` is O(n) linear (line 321); a dict-index would be O(1) and would replace `PROMPT_NAMES` as the canonical index.
  - `render_prompt` has 3 regex passes over the same template — for each `{{var}}` it `re.finditer`s then `text.replace(match.group(0), str(value))`. If a value contains `{{var}}` of its own, no re-expansion. Acceptable for MVP; brittle for user-supplied content. (DER)
  - `{% if var %}` requires the var to be truthy; falsy values like `0`, `""`, `False` would be stripped. Subtle gotcha. (INT)
  - The renderer does NOT actually call Jinja2 despite the docstring claim (line 348: "Uses basic Jinja2-style variable substitution"). A real `jinja2.Template` would be safer; current impl is hand-rolled regex. (OBS)
- **Hardcoded strings to template:**
  - Default values embedded in `template_text` via `{{var|default('…')}}` — these are *inside* the spec but should arguably live as defaults on the `PromptArgument` (already supported by line 31) — there is a redundancy: defaults exist in *both* the arg definition and the template body.
- **Timeless/agentic potential:** This file is the most "ready" for templating. Replace the regex renderer with a `jinja2.Template`; replace `get_prompt_spec` with `dict` index; move template defaults into `PromptArgument.default`.

---

### 4. `/root/arifOS/arifosmcp/runtime/prompt.py`

**What it does** *(OBS)*: Same role as `runtime/prompts.py` but **older**: declares `CANONICAL_PROMPTS` and `V2_PROMPT_SPECS` with **pre-RSI-fix ordering** (555=Judge, 666=Critique) and delegates registration.

- **LOC:** 74
- **Key abstractions:**
  - `CANONICAL_PROMPTS` (lines 9–17) — 7 entries: 000/111/333/555_judge/666_critique/777/999. **Critique and judge are swapped** vs `runtime/prompts.py` and `arifosmcp/prompts/__init__.py`.
  - `V2_PROMPT_SPECS` (lines 19–69) — 7 dicts (no `loop_engineer`). Descriptions say "000_INIT — Threshold" and "555_JUDGE — Constitutional evaluator" — different prose from the parallel file.
  - `register_v2_prompts(mcp)` (line 72) — identical signature to the one in `runtime/prompts.py`.
- **Duplications:** **Major.** This file is a near-clone of `runtime/prompts.py` with reversed 555/666 semantics and different description strings.
- **Dead code:** Likely — `register_v2_prompts` is imported by `runtime/charter.py:13` and used at line 40. So **not dead**, but **functionally redundant**: anyone calling it gets the **same answer** as calling `arifosmcp.prompts.register_prompts` directly because the lazy import in `runtime/prompts.py` resolves to the same function.
- **Entropy sources:**
  - **Stage numbering flip:** 555=judge, 666=critique here (pre-2026-06-26 RSI fix); vs canonical 555=critique, 666=judge in `prompts/__init__.py:185-186`. (OBS) Header comment on `runtime/prompts.py:2` even calls out the fix. This file was **not updated**.
  - **Description drift:** "555_JUDGE — Constitutional evaluator" here vs "555_CRITIQUE — THE MIRROR. Consequence scan, blast radius…" in `runtime/prompts.py`. Same number, different meaning.
  - Two coexisting `V2_PROMPT_SPECS` — the only consumer of *this* file's specs is `runtime/charter.py` and `runtime/public_registry.py`. The other file's specs are not consumed anywhere by name. (DER)
- **Hardcoded strings to template:** Same as #1.
- **Timeless/agentic potential:** **This file should be deleted or merged.** Two near-clones with inverted semantics in the same package is a guaranteed-bug surface. The remaining winner is `runtime/prompts.py` (post-RSI fix).

---

### 5. `/root/arifOS/arifosmcp/runtime/a_rif/prompt_injection.py`

**What it does** *(OBS)*: A *minimal* scanner that does substring matching on a hardcoded list of 11 injection markers; returns a `QuarantineResult` from `arifosmcp.runtime.a_rif.models`.

- **LOC:** 49
- **Key abstractions:**
  - `INJECTION_MARKERS` (lines 16–28) — 11 strings, lowercase substring matches
  - `scan_for_injection(text)` (line 31) — converts to lower, checks substring presence, returns clean/L0 contaminated/L1 clean result
- **Duplications:** **Two competing scanners** in the same arifOS MCP surface:
  - This file (49 LOC, 11 markers, substring)
  - `arifosmcp/hexagon/security/prompt_armor.py` (418 LOC, 5 categories, weighted scoring)
  - `core/shared/guards/injection_guard.py` (376 LOC, 30+ regex patterns, weighted)
  - **Plus** the YAML at `resources/a_rif/prompt_injection_patterns.yaml` (9 lines, **6 patterns, never read by this Python code**)
- **Dead code:** None — `scan_for_injection` is called by `arifosmcp/tools/sense.py:547`.
- **Entropy sources:**
  - **Substring matching is bypassable** with whitespace, unicode homoglyphs, or partial words. e.g., `"dAN"` as a single marker catches the case-insensitive form but misses "d-A-N" or "dаn" (Cyrillic а).
  - The YAML `prompt_injection_patterns.yaml` has **6 patterns** that **do not appear** in the Python `INJECTION_MARKERS` list (DER — confirmed via grep). Specifically the YAML has `disregard all prior`, `new role:`, `hidden instruction:` — none of which appear in the Python file's marker list. **The YAML is orphaned data.**
  - The action string in YAML `action: "quarantine_and_downgrade_to_L0"` (line 8) is a hardcoded verb string — should reference `EvidenceLevel.L0` (the actual enum is imported at line 12 of the Python file).
- **Hardcoded strings to template:** All 11 markers are hardcoded. The YAML was clearly intended to be the data source but the binding was never wired.
- **Timeless/agentic potential:** Bind the YAML to the scanner via `yaml.safe_load()`; add homoglyph normalization (already done in `core/shared/guards/injection_guard.py:240-256`); replace substring with regex; import `EvidenceLevel` for the action enum.

---

### 6. `/root/arifOS/arifosmcp/hexagon/security/prompt_armor.py`

**What it does** *(OBS)*: A 3-layer defense system: (1) PatternDetector (regex across 5 categories), (2) SemanticDetector (heuristics + unicode detection), (3) OntologyDetector (L10 forbidden-claims regex). Combines via weighted score (0.3/0.5/0.2) and emits an `InjectionReport`.

- **LOC:** 418
- **Key abstractions:**
  - `@dataclass InjectionReport` (line 27) — score/is_injection/category/details/recommendations + `to_dict()`
  - `class PromptArmor` (line 47) — orchestrator, holds three detectors + stats counters
  - `class PatternDetector` (line 239) — 5 pattern buckets: instruction_override, role_manipulation, jailbreak, delimiter, encoding
  - `class SemanticDetector` (line 294) — authority_phrases + context_phrases + adversarial_phrases + suspicious_unicode
  - `class OntologyDetector` (line 368) — 24 regex patterns for L10 violations
  - `scan_input(text, context)` (line 415) — module-level convenience
- **Duplications:** **Massive.** Three concurrent scanners with overlapping but not identical pattern sets:
  - This file (5 categories, ~24 patterns)
  - `runtime/a_rif/prompt_injection.py` (1 list, 11 markers)
  - `core/shared/guards/injection_guard.py` (1 list, 30+ regex with weights)
  - **Different scoring formulas, different return types**, **no shared schema.**
- **Dead code:** Partially. `scan_input` (line 415) creates a new `PromptArmor()` per call — no shared state, no cached instance. (INT) This is the *convenience* function pattern, which is fine but inefficient.
- **Entropy sources:**
  - **Magic numbers everywhere:**
    - Line 59: `INJECTION_THRESHOLD = 0.85` — also appears in `core/shared/guards/injection_guard.py:356` and `runtime/a_rif` semantics. Three copies.
    - Line 107: weights `0.3 / 0.5 / 0.2` — magic ratios with no derivation comment
    - Line 112: memory boost `1.2`
    - Line 289: pattern score increment `0.15` (per match)
    - Line 326, 340, 355: score increments `0.1`, `0.15`, `0.25` — none explained
    - Line 409: ontology penalty `0.3` per match
  - **Pattern severity is lost:** line 289 `score += 0.15` for every category — `"jailbreak"` and `"developer mode"` score the same as `"ignore previous instructions"`. (DER)
  - **`_classify_threat`** (line 177): checks `if "DAN" in str(pattern_matches) or "jailbreak" in str(pattern_matches)` — but `pattern_matches` is `list[str]` formatted as `"category:pattern"`, so the substring match `"DAN"` would match against `"role_manipulation:..."` lines too if the pattern contained "DAN" — fragile.
  - **Unicode detection** (line 359): only checks 4 chars (`\u200b`, `\u200c`, `\u200d`, `\ufeff`) — missing `\u200e`, `\u200f`, `\u2028`, `\u2029`, `\u2060`-`\u2064`. Partial coverage. (DER)
  - **`Sanitize`** (line 153): the HTML comment regex `<!\-\-.*?\-\->` is redundant with the markdown comment regex `<!--.*?-->` (line 163) — both target the same `<!-- … -->` syntax. (OBS)
  - **`false_positives` counter** (line 76) is initialized but **never incremented anywhere** in this file. (OBS)
- **Hardcoded strings to template:**
  - `INJECTION_THRESHOLD` should come from `constitutional_map.CANONICAL_FLOORS["L12"]` — that file is mentioned in `AGENTS.md:6` as the source of truth.
  - All regex patterns should be YAML-loaded for non-dev edits.
- **Timeless/agentic potential:** Replace the 3-detector architecture with a single `InjectionGuard` interface; back the patterns with YAML; move weights to a single config; add telemetry hooks for `false_positives` to actually fire.

---

### 7. `/root/arifOS/arifosmcp/resources/a_rif/prompt_injection_patterns.yaml`

**What it does** *(OBS)*: A 9-line YAML declaring 6 injection patterns and an action verb.

- **LOC:** 9
- **Content:**
  ```yaml
  patterns:
    - "ignore previous instructions"
    - "system override"
    - "you are now"
    - "disregard all prior"
    - "new role:"
    - "hidden instruction:"
  action: "quarantine_and_downgrade_to_L0"
  ```
- **Duplications:** **Orphaned.** No Python code reads this file. Confirmed by grep — only the YAML itself contains these literal strings.
- **Dead code:** Effectively — the data lives but is never loaded.
- **Entropy sources:**
  - 6 patterns here, 11 in `runtime/a_rif/prompt_injection.py`, ~24 in `PromptArmor.PatternDetector`, ~30 in `core/shared/guards/injection_guard.py` — **four competing sources, no single source of truth**.
  - Action string `"quarantine_and_downgrade_to_L0"` — should be a `QuarantineAction.QUARANTINE_L0` enum reference (matching the `EvidenceLevel` enum imported at `prompt_injection.py:12`).
- **Hardcoded strings to template:** Everything.
- **Timeless/agentic potential:** This file **should** be the single source of truth for pattern matching. Wire it into `scan_for_injection` via `yaml.safe_load`.

---

### 8. `/root/arifOS/docs/agents/system-prompts.yaml`

**What it does** *(OBS)*: 4 agent system prompts (A-ARCHITECT, A-ENGINEER, A-AUDITOR, A-VALIDATOR) plus a `prompt_injection_defense` block.

- **LOC:** 387
- **Key abstractions:**
  - `A-ARCHITECT` (lines 10–72) — design authority, READ-PLAN, Δ trinity
  - `A-ENGINEER` (lines 78–162) — execution, EDIT-WRITE, Ω trinity
  - `A-AUDITOR` (lines 168–244) — judgment, READ-REVIEW, Ψ trinity
  - `A-VALIDATOR` (lines 250–350) — final verification, DEPLOY-SEAL, Ψ trinity
  - `prompt_injection_defense` (lines 356–385) — 5 named defenses + 5 red_lines + a templated `response_to_injection`
- **Duplications:**
  - Each agent prompt repeats the same skeleton: `YOUR IDENTITY` → `YOUR PURPOSE` → `WHAT YOU CAN DO` → `WHAT YOU CANNOT DO` → `YOUR CONSTITUTIONAL OBLIGATIONS` → `RESPONSE FORMAT` → `INVOCATION SYNTAX` → `HANDOFF PROTOCOL`. This is templatable. (OBS)
  - "Muhammad Arif bin Fazil" appears in lines 23, 92, 182, 264 — should be a single reference.
  - "888_JUDGE" appears 8+ times — should be a single reference.
  - **HARD SEPARATION MATRIX is duplicated** in `/root/arifOS/docs/agents/AGENTS.md` (also embedded as a system-reminder during this audit). The two surfaces diverge in floor coverage: `system-prompts.yaml` mentions F1, F2, F3, F4, F6, F7, F8, F9, F11, F12, F13 (selectively); `AGENTS.md` lists all 13. (DER)
- **Dead code:** None — all 4 agents are referenced.
- **Entropy sources:**
  - `response_to_injection` (lines 382–385) uses Jinja-style `{AGENT_ROLE}` substitution but no explicit renderer is wired — relies on whoever loads this YAML to template it.
  - `red_lines` (lines 376–380) **duplicates** patterns from `runtime/a_rif/prompt_injection.py:16-28` and `resources/a_rif/prompt_injection_patterns.yaml`. Three surfaces of the same red-line knowledge.
  - Floor names: A-ARCHITECT uses `F1 (Amanah)`; A-ENGINEER uses `F2 (Truth)`; A-AUDITOR uses `F2, F3, F4, F8, F9`. Different floor selections per agent — intentional? The `prompt_injection_defense` block claims "All agents use these defenses" but the per-agent floor selections are inconsistent. (INT)
  - A-VALIDATOR has F11 (Audit) reference (line 331) but `AGENTS.md` uses L11 not F11. **Floor prefix inconsistency** (F vs L). (DER)
- **Hardcoded strings to template:**
  - "Ditempa Bukan Diberi" / "DITEMPA BUKAN DIBERI" — appears in 2 forms across the file
  - "Muhammad Arif bin Fazil" — 4 occurrences
  - "888_JUDGE" — 8+ occurrences
  - Capability classes (`READ-PLAN`, `EDIT-WRITE`, etc.) — these should be enums
- **Timeless/agentic potential:** Move to a single YAML schema with Jinja2 inheritance; auto-generate the matrix from `constitutional_map.CANONICAL_FLOORS`; bind agent system prompts to actor identity via signature.

---

### 9. `/root/arifOS/arifosmcp/AGENTS.md`

**What it does** *(OBS)*: Auto-generated `AGENTS.md` for the arifOS MCP Runtime, exporting 8 public tools (the ZEN-9 metabolic loop), 13 constitutional laws (F1-L13), Trinity Lanes, the pipeline diagram, tri-witness defaults, and resource URIs.

- **LOC:** 144
- **Key abstractions:** Pure documentation. Header says: "auto-generated from `arifosmcp.constitutional_map.CANONICAL_TOOLS`" (line 7). Hand-maintained sections: frontmatter, floor definitions, Trinity Lanes, pipeline diagram, witness defaults, resource URIs, footer (line 23).
- **Duplications:**
  - Floor table (lines 70–82) duplicates `constitutional_map.CANONICAL_FLOORS` (assumed canonical source) — but is auto-generated, so duplication is by design.
  - Tri-witness defaults (lines 119–122): `Human 0.42 / AI 0.32 / Earth 0.26` — these specific values may be hardcoded in this file but are *also* likely hardcoded in the runtime. (SPEC — not directly observed)
  - The header comment "ZEN-9 METABOLIC LOOP (2026-07-04)" (line 12) is metadata; runtime lives in `runtime/public_surface.py` (`CANONICAL_9`).
- **Dead code:** N/A — markdown documentation.
- **Entropy sources:**
  - Header label "8 Public Tools" (line 32) but pipeline shows **8 stages** (000, 111, 333, 444, 666, 777, 888, 999) — consistent.
  - Floor table uses **L-prefix** (L01-L13) consistently (lines 70-82), while other files (e.g., `system-prompts.yaml`) use **F-prefix** (F1-F13). The same floors are referred to by both prefixes. This is a **substrate-level naming divergence**. (DER)
  - Tri-witness defaults section (line 119) labels witness scores as "Human: 0.42 / AI: 0.32 / Earth: 0.26" — but the same concept in `system-prompts.yaml:223` uses "W₃ = √(H×A×S) ≥ 0.95" — **different formula** (additive default vs geometric mean threshold). These two surfaces may not agree on what "tri-witness" means. (DER, INT)
- **Hardcoded strings to template:**
  - The auto-generation directive `Regenerate: python -m arifosmcp.maintenance.generate_agents_md` (line 29) — should be a Makefile target.
- **Timeless/agentic potential:** None significant — this is generated docs.

---

## 🔥 SYNTHESIS

### Total LOC

| File | LOC |
|---|---|
| `runtime/prompts.py` | 81 |
| `runtime/fastmcp_ext/prompts.py` | 64 |
| `specs/prompt_specs.py` | 394 |
| `runtime/prompt.py` | 74 |
| `runtime/a_rif/prompt_injection.py` | 49 |
| `hexagon/security/prompt_armor.py` | 418 |
| `resources/a_rif/prompt_injection_patterns.yaml` | 9 |
| `docs/agents/system-prompts.yaml` | 387 |
| `arifosmcp/AGENTS.md` | 144 |
| **Subtotal (9 files in scope)** | **1,620** |
| Plus: `arifosmcp/prompts/__init__.py` (the canonical loop) | 1,597 |
| Plus: `core/shared/guards/injection_guard.py` (parallel scanner) | 376 |
| Plus: `runtime/charter.py` (consumer of `V2_PROMPT_SPECS`) | 219 |
| Plus: `runtime/public_registry.py` (consumer of `V2_PROMPT_SPECS`) | 795 |
| **Total transport surface** | **4,607** |

### Approximate count of unique prompts / templates transported

| Surface | Count | Source |
|---|---|---|
| Reality-Engineering loop prompts (canonical organs) | 8 | `arifosmcp/prompts/__init__.py:180` |
| Workflow prompt specs | 10 | `specs/prompt_specs.py:79` |
| FastMCP extension prompts | 2 | `runtime/fastmcp_ext/prompts.py` |
| Agent system prompts | 4 | `docs/agents/system-prompts.yaml` |
| Loop-engineer intake (subset of loop) | 1 | `arifosmcp/prompts/__init__.py:181` |
| **Distinct prompt templates transported** | **~25** | (with ~3-name overlap) |

### Prompt-injection patterns detected (from YAML + Python)

| Pattern | In YAML? | In `runtime/a_rif`? | In `PromptArmor`? | In `core/shared/guards/injection_guard.py`? |
|---|:---:|:---:|:---:|:---:|
| `ignore previous instructions` | ✅ | ✅ | ✅ | ✅ |
| `system override` | ✅ | ✅ | ❌ | ❌ |
| `you are now` | ✅ | ✅ | ✅ (regex) | ✅ |
| `disregard all prior` | ✅ | ❌ | ✅ (regex) | ❌ |
| `new role:` | ✅ | ❌ | ✅ (regex) | ✅ |
| `hidden instruction:` | ✅ | ❌ | ❌ | ❌ |
| `ignore all previous` | ❌ | ✅ | ❌ | ✅ |
| `disregard prior` | ❌ | ✅ | ❌ | ✅ |
| `new instructions` | ❌ | ✅ | ❌ | ✅ |
| `role: system` | ❌ | ✅ | ❌ | ✅ |
| `override protocol` | ❌ | ✅ | ❌ | ✅ |
| `jailbreak` | ❌ | ✅ | ✅ (regex) | ✅ |
| `dAN` (mixed case) | ❌ | ✅ | ✅ | ✅ |
| `developer mode` | ❌ | ✅ | ✅ (regex) | ✅ |
| `DAN (mode|prompt)` regex | ❌ | ❌ | ✅ | ✅ |
| `admin mode` | ❌ | ❌ | ✅ | ✅ |
| `<system>` / `<admin>` delimiter | ❌ | ❌ | ✅ | ✅ |
| `base64:` / `rot13` encoding | ❌ | ❌ | ✅ | ✅ |
| `### instructions` / `--- system` | ❌ | ❌ | ✅ | ✅ |
| `you must / you have to` (adversarial) | ❌ | ❌ | ✅ | ❌ |
| `as a developer / as an admin` | ❌ | ❌ | ✅ | ❌ |
| Unicode zero-width chars | ❌ | ❌ | ✅ (4 chars only) | ✅ (broader) |
| L10 ontology claims (`I am conscious`, `I feel`, etc.) | ❌ | ❌ | ✅ (24 regex) | ❌ |

**YAML contains 6 patterns, Python in scope contains 11, PromptArmor contains ~24, core guard contains ~30+. Four sources of truth. The YAML is the smallest and the most orphaned.**

### Duplication hot spots (HIGH entropy)

1. **`CANONICAL_PROMPTS` tuple** — 3 copies with **divergent semantics** (555 vs 666 swap):
   - `arifosmcp/prompts/__init__.py:180` (correct: 555=critique, 666=judge)
   - `runtime/prompts.py:3` (correct)
   - `runtime/prompt.py:9` (**STALE: 555=judge, 666=critique**)

2. **`V2_PROMPT_SPECS` dict-tuple** — 2 copies with **divergent descriptions**:
   - `runtime/prompts.py:14` (canonical)
   - `runtime/prompt.py:19` (stale, missing loop_engineer)

3. **Three injection scanners** with non-overlapping API surface:
   - `runtime/a_rif/prompt_injection.py:31` — `scan_for_injection(text) → QuarantineResult`
   - `hexagon/security/prompt_armor.py:78` — `armor.scan(text, context, source) → InjectionReport`
   - `core/shared/guards/injection_guard.py:258` — `guard.scan_input(user_input) → InjectionGuardResult`
   - **No shared base class. No shared pattern YAML binding. Three scoring formulas. Three result types.**

4. **Orphaned YAML** at `resources/a_rif/prompt_injection_patterns.yaml` — never loaded by any Python file.

5. **Floor naming convention split**: `F1-F13` (most files) vs `L01-L13` (AGENTS.md). Same floors, two prefixes.

6. **F2 floor name divergence**: `F2 TRUTH` (kernel) vs `F2 HAQQ` (fastmcp_ext/prompts.py:19) — HAQQ is an older Arabic label.

7. **`register_v2_prompts`** — two definitions, same signature, different internal specs.

### Entropy budget estimate: **HIGH**

Justification:
- Triple source-of-truth for the canonical prompt sequence guarantees drift.
- 555/666 numbering flip is already live in two files.
- Four injection pattern sources, three scoring formulas, one orphaned YAML.
- Empty `input_schema={}` and `default_tools=[]` for *all* 8 specs in `runtime/prompts.py` — schema promises unfulfilled.
- Dead `register_arifos_prompts` (fastmcp_ext) and `register_v2_tools` (runtime/prompts.py) — declarations no one calls.
- Magic numbers `0.85`, `0.3`, `0.5`, `0.2`, `0.15`, `0.10`, `0.25` in `PromptArmor` not tied to `constitutional_map`.
- F vs L floor prefix split.
- F2 TRUTH vs F2 HAQQ split.

### Top 5 entropy sources ranked

1. **Triple CANONICAL_PROMPTS / dual V2_PROMPT_SPECS** *(HIGHEST)* — guaranteed bug surface; the post-RSI-fix file `runtime/prompt.py:9` was never updated, so any code importing from `runtime.prompt` gets the **stale 555=judge** ordering. Files affected: `runtime/charter.py:13`, `runtime/public_registry.py:15`, `arifosmcp/prompts/__init__.py:180`.

2. **Three competing injection scanners + orphaned YAML** — no single source of truth, three different return types, one orphaned data file. A red-team test (`tests/04_adversarial/test_injection_attacks.py`) calls `guard.scan_input(...)` (the `core` scanner) — bypassing the MCP-surface scanners entirely. Coverage gaps inevitable.

3. **Magic numbers across `PromptArmor`** — `0.85` threshold, `0.3/0.5/0.2` weights, `0.15` increments, `0.3` ontology penalty — none tied to `constitutional_map.CANONICAL_FLOORS["L12"]`. Drift vector.

4. **Floor naming split (F vs L) + floor name divergence (TRUTH vs HAQQ)** — same floors, two prefixes, one stale label. Search-by-name will fail.

5. **Dead registrations** — `register_arifos_prompts` (fastmcp_ext/prompts.py:11) and `register_v2_tools` (runtime/prompts.py:80) exist with no callers. Empty `input_schema={}` in 8 specs.

---

## 📋 Recommendations (P1)

| # | Action | Floor | Effort |
|---|---|---|---|
| R1 | Merge `runtime/prompt.py` into `runtime/prompts.py`; delete the 555/666-stale copy | F4 CLARITY | XS |
| R2 | Wire `resources/a_rif/prompt_injection_patterns.yaml` into `scan_for_injection` (one `yaml.safe_load` call) | F4 CLARITY | S |
| R3 | Unify the three injection scanners behind a single `InjectionGuard` interface; one scoring formula; one result type | F4 CLARITY, F12 INJECTION | L |
| R4 | Move all magic numbers (0.85, 0.3/0.5/0.2, etc.) into a `constitutional_map.CANONICAL_FLOORS["L12"]` config object | F2 TRUTH, F8 GENIUS | M |
| R5 | Standardize floor naming to **F1-F13** (drop L-prefix), update AGENTS.md auto-generator | F4 CLARITY | S |
| R6 | Delete `F2 HAQQ` from `runtime/fastmcp_ext/prompts.py:19`; use `F2 TRUTH` | F2 TRUTH | XS |
| R7 | Either wire `register_arifos_prompts` or delete the file | F4 CLARITY | XS |
| R8 | Fix the `_classify_threat` substring bug (`"DAN" in str(pattern_matches)` — false positives on `role_manipulation:` lines that happen to contain "DAN") | F9 ANTI-HANTU | S |
| R9 | Auto-increment `false_positives` counter in PromptArmor; or remove the dead field | F11 AUDIT | XS |
| R10 | Replace hand-rolled regex renderer in `specs/prompt_specs.py:344` with `jinja2.Template` | F8 GENIUS | S |

---

## 🔬 Epistemic Tag Summary

| Label | Count | Examples |
|---|---|---|
| OBS (observed in file) | 18 | file contents, LOC, line numbers |
| DER (derived from multiple OBS) | 9 | duplication counts, drift detection, dead-code inference |
| INT (interpreted / unverified) | 5 | "likely intended", "subtle gotcha", "intentional?" |
| SPEC (speculation, not directly evidenced) | 1 | Tri-witness defaults in runtime may be hardcoded |

---

*Forged 2026-07-07 by OpenCode under F13 SOVEREIGN. Read-only audit. No files modified.*
*DITEMPA BUKAN DIBERI — Audit is forged, not given.*