# EXPLORATION ≠ RESEARCH — Orthogonalization of Web Tools
## Deep Research: Compare · Contrast · Orthogonalize · Why "Deep Research" Is Deep Exploration

> **Status:** ANALYSIS + CONTRACT (FI-008, 2026-10-18)
> **Companion:** `WEBO-OMEGA-web-exploration-federation.md` (the physics layer)
> **Evidence rule (F2):** every claim below is code-verified or file-cited. Marketing
> language of products is treated as CLAIM, not fact (R-FILTER doctrine applies).

---

## 0. The Question Behind the Question

> *"Why do AI agents use deep research as deep exploration tools? idk right?"*

**Short answer: because that is all those tools ever were.** "Deep research" is a
marketing name layered on top of an exploration loop. The industry never shipped the
epistemic operation called research — they shipped `search → fetch → summarize` with
iteration depth. Agents use them as exploration tools because calling an exploration
loop "research" does not make it research. The name is aspirational; the mechanism is
cartographic. This doc proves it (§2, from our own code — the same lie lives here),
then orthogonalizes the space properly (§3–4), and gives the math (§5).

---

## 1. Compare & Contrast — the tool census (live, 2026-10-18)

| Tool (ours or market) | Declared | Actual operation | Axis (see §3) | Verdict |
|---|---|---|---|---|
| `forge_search` | web search | 1-hop provider fan-out → results | **discover** | ✅ honest |
| `forge_search(source=research)` / `handleForgeResearch` | "deep research" | **1 search call → join bullets → confidence = (n>5)** | discover + **narrate** | ❌ misnamed (§2) |
| `forge_fetch` | URL intake | pointer → content (SSRF-guarded) | **resolve** | ✅ honest |
| `forge_web_extract` | page extract | content → structured (+browser render) | **extract** | ✅ honest |
| `forge_browser_*` (6 tools) | browser ops | stateful interaction | **interact** | ✅ honest |
| `arif_observe(fetch)` | constitutional evidence | resolve + epistemic envelope | resolve + **witness** | ✅ honest |
| firecrawl scrape/search/crawl | "agent-ready web" | resolve/extract at scale | resolve/extract | ✅ honest |
| OpenAI/Gemini/Perplexity "Deep Research" | research | multi-hop explore + synthesis report | explore + narrate | ❌ same misname |
| `hermes_claim_validate` | claim validation | claim → verdict + evidence demand | **claim** | ✅ honest |
| `hermes_counterstory_test` | counter-explanations | interpretation → falsifiers | **falsify** | ✅ honest |
| `chron_record_verification` | close the arrow | prediction → outcome vs reality | **calibrate** | ✅ honest |

**The pattern is unmistakable:** the tools that call themselves "research" are the ones
doing exploration + narration. The tools that actually perform research operations
(claim, falsify, calibrate) never use the word "research" in their names.

---

## 2. The Smoking Gun — in OUR code (code-verified this session)

`gatewayTools.ts:459-487` — `handleForgeResearch`, reachable via
`forge_search(source=research)`, described in `agentic-web.md` as "deep multi-source
research, multi-hop, cited":

```ts
const { query, depth, sources, ... } = args;        // depth: "quick|standard|deep"
const search = await webSearchWithFallback(...);     // ← ONE search call. depth NEVER USED.
const answer = results.map(r => `- ${r.title}: ${r.description}`).join("\n");
const confidence = results.length > 5 ? "high" : ... // ← confidence = RESULT COUNT
```

Anatomy of the lie, measured:
1. **Zero hops.** One provider call. "Multi-hop" appears nowhere in the code path.
2. **`depth` is dead.** Accepted, logged to receipt, never read again (F3-class defect).
3. **Narration ≠ synthesis.** `answer` is bullet-joining snippets — no contradiction
   check, no source weighting, no gap analysis beyond "no results".
4. **Confidence from cardinality.** `n > 5 → high` is Goodhart's law in one line.
   Compare QG canon: confidence comes from witness structure and band functions,
   never from sample count.
5. **No claim, no falsifier, no verification.** The three things that separate research
   from exploration are exactly the three missing things.

This is not unique to us — it is the industry template. We inherited it by copying the
pattern, then named it honestly in the doc (`deep multi-source research`) which made the
gap worse (representation ≠ reality, third exhibit this quarter).

---

## 3. Orthogonalization — the seven axes

Tool operations decompose along **seven orthogonal epistemic axes**. A tool is honest
iff its name states its axis. Composition happens at the process level (§4), never by
smuggling one axis into another's name.

```
AXIS        OPERATION                      OUTPUT           STOPS WHEN
─────────────────────────────────────────────────────────────────────────
discover    find pointers to knowledge      URLs + snippets   budget / coverage
resolve     pointer → content              text              fetch complete
extract     content → structure            fields/tables     schema satisfied
interact    stateful page manipulation     state change      goal state reached
explore     loop of discover+resolve+extract, map unknown    frontier reached (T-score)
narrate     evidence → prose               report            length / format
research    claim → gather → falsify → calibrated belief      convergence OR falsified
```

**Research is not "exploration with more steps."** It has a different *terminal
condition* (convergence/falsification vs coverage) and a different *output type*
(calibrated belief vs map). Composing exploration N times yields a bigger map — never a
belief. `explore^n ≠ research` for any n. This is the algebraic core of the answer.

### Overlap audit of our surfaces (non-orthogonal spots)

| Overlap | Tools | Problem | Fix |
|---|---|---|---|
| resolve ×3 | `forge_fetch`, `forge_web_extract(render=static)`, `arif_observe(fetch)` | 3 owners of pointer→content | keep: forge_fetch = fast path; web_extract = structured/render; arif_observe = constitutional envelope. **Different warranty, same axis — declared, not merged** |
| extract ×2 | `forge_web_extract`, `forge_browser_extract_text` | browser text vs static extract | browser variant is `extract` under `interact` context — declared in name ✅ |
| research misname | `handleForgeResearch` | axis lie | renamed contract §6 |
| dead param | `depth` | F3-class dead generality | wired or removed §6 |

---

## 4. The Correct Composition (what "deep research" should mean)

```
RESEARCH(claim q) =
    explore(q)                        → evidence set E
    ├─ claim_validate(q, E)           → verdict + what evidence would change it
    ├─ counterstory_test(q)           → competing explanations + cheapest falsifier
    ├─ resolve+extract(falsifier)     → discriminating observation
    └─ record_verification(q, outcome)→ Brier score → calibration (chron)
  stop when: converged (claim survives falsifiers) OR falsified OR T-score exhausted
```

Every organ in that pipeline **already exists** in the federation (HERMES claim tools,
chron verification, WEBO-Ω T-score). The reason agents reach for "deep research"
products instead: those products hide the composition behind one button and return
prose. The federation exposes the composition as governance. That is a trade of
convenience for honesty — the correct trade (F2), but it explains the usage pattern.

---

## 5. Math & Physics of the Distinction

### 5.1 Information geometry [COINED]

Let `U` = uncertainty about the territory, `C` = confidence in a claim.

- **Exploration** maximizes mutual information with the world:
  `explore: max I(θ_world ; evidence) s.t. budget` — reduces `U`, says nothing about `C`.
- **Research** is Bayesian updating under adversarial pressure:
  `research: P(q|E) ∝ P(E|q)·P(q)`, then **falsification attempts** drive `P(E|¬q)`.
  Output: `P(q|E)` with declared falsifiers. Reduces `C`'s entropy only when evidence
  discriminates.

The operations are **orthogonal in information space**: exploration moves along the
`U` axis, research along the `C` axis. A 10× deeper exploration (more hops, more pages)
still moves only `U`. No amount of `U` reduction crosses into `C` without the
falsification operator. That is why "deep exploration" cannot substitute for research
regardless of depth — the axes commute with neither.

### 5.2 Physics reading (Ω mapping, companion doc's table extended)

| | Exploration | Research |
|---|---|---|
| Ω04 Entropy | reduces territorial entropy `U` | reduces belief entropy `H(P(q))` |
| Ω03 Gradient | coverage gradient (next unexplored region) | evidence gradient (most discriminating test) |
| Ω06 Time terminal | frontier reached (T-score) | convergence / falsification |
| Ω09 Signal | freshness, authority of sources | likelihood ratio `P(E|q)/P(E|¬q)` |
| Ω12 Hysteresis | caches, seen-URL memory | priors, scar weights (past falsifications) |

### 5.3 Why the industry conflated them (R-FILTER + Proxy-Reality)

1. **Goodhart:** "research" is the valued word (procurement, pricing power), so the
   proxy (product name) diverged from reality (mechanism). `$200/mo for Deep Research`
   prices the claim, not the cartography.
2. **R-FILTER:** the training record contains millions of "research reports" — which
   are narration artifacts. Models learned *research looks like fluent synthesis over
   cited URLs*, not *research is surviving falsification*. So agents do the look-alike.
3. **The verification gap is invisible in demos.** Exploration output (clean report)
   and research output (calibrated belief + falsifiers) look identical until a claim
   fails. The market cannot price what it cannot see → sells the visible proxy.
4. **Our own FQ metric shows it:** `hermes-asi FQ = 0.34 (STUCK)` — execution outruns
   verification everywhere in the stack, not just in web tools. "Deep research" without
   verify steps is the tool-level version of the same pathology.

---

## 6. Orthogonalization Contract (binding for this codebase)

1. **Naming law:** tool names state their axis (`search`=discover, `fetch`=resolve,
   `extract`=extract, `browser`=interact). The word `research` is reserved for
   processes that include claim + falsify + verify. Nothing else may use it.
2. **`handleForgeSearch(source=research)` gets an honest epistemic label** — output
   declares `research_class: "EXPLORATION_SYNTHESIS"` + `_axis: [discover, narrate]`,
   so downstream agents cannot launder it as research (the APEX `epistemicGuard` rule,
   applied to tool metadata).
3. **`depth` is either wired or declared dead.** Wired target: `depth` controls content
   resolution depth (snippets → resolve top-k URLs via forge_fetch → extract). Until
   then, `depth_implemented: false` in the response (present tense is a claim —
   so we state the status, not the aspiration).
4. **True research is composition, not a tool:** `research` becomes a skill/playbook
   that orchestrates explore → hermes_claim_validate → hermes_counterstory_test →
   chron_record_verification (§4 pipeline). It lives as a recipe over existing verbs —
   zero new tools (Law 8).
5. **Confidence never comes from cardinality** (delete `n>5→high` thinking everywhere).
   Until calibrated, confidence = `UNMEASURED` with reason (INV-8 discipline).

---

## 7. One-sentence answers (Arif Test, Law 6)

- **Why do agents use "deep research" as exploration?** Because those tools ARE
  exploration loops with a report hat — one search, join bullets, call it research;
  agents behave correctly given what the mechanism actually does.
- **Why does it matter?** Exploration moves uncertainty `U`; research moves belief `P(q)`.
  They are orthogonal axes — depth on one never crosses to the other.
- **What did we do?** Named the axes, audited our own lie in code, and made the
  contract: `research` = explore + claim + falsify + verify, or it isn't research.

DITEMPA BUKAN DIBERI ⚒️
