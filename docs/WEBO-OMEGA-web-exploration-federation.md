# WEBO-Ω — Web Exploration Federation in A-FORGE
## Deep Research & Formal Design · APEX Theory Applied

> **Status:** DRAFT_FOR_REVIEW (FI-008, 2026-10-18)
> **Subject:** Federating web exploration tools (search · fetch · extract · browse · research)
> under one governed control plane in A-FORGE, formalized with APEX theory.
> **Grounding:** `/root/arifOS/docs/APEX_MATH_CANON.md` (F13-sealed 2026-07-28) ·
> `/root/arifFlow/spec/QG_V0_3_VECTOR_SPEC.md` (SEALED v0.3.1-AMD) ·
> `/root/WEALTH/docs/OMEGA_ARCHITECTURE.md` · `/root/AAA/canon/A-Z-APEX-ZEN-DOCTRINE.md`
> **Honesty rule (F2):** equations marked **[COINED]** are new formalizations proposed here,
> not recovered from canon. Equations marked **[CANON]** are sealed or code-verified.

---

## 0. The Human Problem (Anti-Bangang Law 4)

**Satu ayat:** *Agent cari maklumat atas internet guna 8+ tools yang berpecah, lane mati
senyap, dan tiada sesiapa tahu exploration kita sebenar atau tidak sehingga manusia kena
probe sendiri.*

Failure classes observed live (2026-10-18 probe, receipts in session):

| # | Failure class | Evidence |
|---|---|---|
| F1 | Silent lane death | Brave 402 (credit), MiniMax (balance), Moonshot 403 — 3 of 8 lanes dead with no alarm |
| F2 | Stale state representation | FED said DeepSeek $4.15 "insolvent"; live truth $6.46 available |
| F3 | Dead generality | `scoreProviders` declares 4 intents; only "discovery" ever called |
| F4 | Stateless hysteresis | circuit breaker is in-memory — restart forgets provider failures |
| F5 | Fragmented surfaces | HERMES/firecrawl/arif_observe/browser sit in 4 different control planes |
| F6 | No health scalar | no G-equivalent for "is exploration working?" — humans probe manually |

This document designs one federation that eliminates F1–F6, and nothing more (Canon #0
three-test gate: demonstrated failure class ✓ · enforceable mechanism ✓ · better decisions ✓).

---

## 1. System Definition

### 1.1 The exploration plant

Let the web-exploration federation be the plant

```
𝒫 = (P, T, I, R, B)
```

- `P = {p₁ … pₙ}` — **providers** (search backends): brave, searxng, deepseek, ddgs, minimax, context7
- `T = {search, fetch, extract, browse, research}` — **tool verbs**
- `I = {discovery, verification, extraction, research}` — **intents** (already in `scoreProviders`)
- `R` — **receipt ledger** (`/root/A-FORGE/data/gateway_receipts.jsonl`, 9,802 rows)
- `B` — **budget** (USD + QPS + attention)

### 1.2 Request state (the atom)

**[COINED — Def 1]** An exploration request is

```
r = (q, i, k, t)     query q, intent i ∈ I, result count k, time t
```

with outcome `o(r) ∈ {S, E, F}` = Success(non-empty) · Empty · Failure.

### 1.3 Provider capability field

**[COINED — Def 2]** Each provider carries a capability field over intents:

```
c_p : I → [0,1]          (the capabilityMatrix in gatewayTools.ts — code-verified)
a_p(t) ∈ {0,1}           availability (live probe / circuit state)
γ_p ≥ 0                  cost per successful request
τ_p ≥ 0                  latency

S_p(i) = c_p(i)·a_p(t) + b_local·𝟙[p local] − Θ(circuit_open(p))
routing: p* = argmax_p S_p(i),   fallback = descending S_p until success
```

This is exactly what `webSearchWithFallback` implements today (brave → searxng → deepseek,
local bonus +0.05, circuit-breaker skip). The federation makes `a_p(t)` **measured, not
assumed**, and `i` **plumbed through** instead of hardcoded "discovery".

---

## 2. Physics — the Ω01–Ω12 mapping

The WEALTH organ ships Ω semantics **without equations** (verified: `OMEGA_ARCHITECTURE.md`
+ `canonical.py` Ω00 lattice only). The following equations are therefore **[COINED]**,
offered as the physics layer of exploration. Each is falsifiable.

| Ω | Canon question | Exploration reading | Equation [COINED unless noted] |
|---|---|---|---|
| Ω01 Conservation | What exists? | Every call emits exactly one receipt; budget only decreases | `N_calls = N_receipts` (enforced by construction) · `B(t) = B₀ − Σ γ_p·𝟙[o=S]` |
| Ω02 Flow | Where is it moving? | Request traffic through provider queues | `ρ_p = λ_p·τ_p` (utilization, Little: `L = λW`) · DeepSeek QPS 5 = μ cap |
| Ω03 Gradient | What drives movement? | Least-power gradient down the authority ladder | `routing = −∇_p [U(q)/cost_p]` — descend to cheapest sufficient power (the ladder IS the gradient) |
| Ω04 Entropy | How disordered? | Answer-space uncertainty of the task | `S = U` (belief entropy) · successful search: `ΔS = −I(q;R) ≤ 0` (F4 floor!) · empty: `ΔS = 0` · dead lane: `ΔS_sys > 0` (system learns its map is stale) |
| Ω05 Energy | Output per input? | Evidence yield per dollar / per second | `η = I(q;R) / (γ_p + w_τ·τ_p)` (information per unit cost+latency) |
| Ω06 Time | Future value now? | Evidence freshness decay **[CANON]** | `w(Δt) = e^(−λΔt)` (APEX canon `q_time`) · INV-8: stale → UNMEASURED, never 0 |
| Ω07 Inertia | What resists change? | Cache + provider stickiness + retry backoff | `J_inertia = Σ cache_hits·Δt + Σ backoff_periods` |
| Ω08 Field | Macro regime? | The provider landscape itself | `𝒜(t) = (a₁(t),…,aₙ(t))` availability field; 2026-10-18 measurement: `𝒜 = (0,1,1,0,0,·)` = 3/8 dead |
| Ω09 Signal | What deserves belief? | Result quality | `Q(r) = rerank_score·authority/4 · W³_provenance` (DeepSeek rerank ∈ [0,3], authority ∈ [0,4] — code-verified fields) |
| Ω10 Game | What incentives? | Adversarial page content, SEO, prompt injection | already mechanized: `browserInjectionSentinel` + content boundaries |
| Ω11 Boundary | What cannot be crossed? | SSRF, robots, QPS, billing caps | mechanized: `ssrfGuard`, QPS 429s, spend ceilings |
| Ω12 Hysteresis | How does history constrain? | **Circuit breaker = hysteron** | **[COINED]** elementary relay: `σ = H(f, f_max=3, Δ=60s)` — open at 3 consecutive failures, half-open after cooldown. Defect today: σ is volatile (RAM). Federation makes σ **non-volatile** (persisted) → true hysteresis across restarts |

**The second law of exploration (Ω04 corollary) [COINED]:**

```
ΔS_total = −I(q;R) + ε_waste        ε_waste = spend on empty/failed calls
Exploration is healthy  ⇔  ΔS_total ≤ 0  per window
```

This matches the sealed F4 floor `ΔS ≤ 0` from the QG vector spec.

---

## 3. Math — health, debt, and time-to-frontier

### 3.1 Federation health G_fed — the Nash product **[CANON construction, new domain]**

The sealed G-formula (`APEX_MATH_CANON.md`, uniqueness by Aczél 1966):

```
G = (A · P · E · X)^(1/4)        any dial ≤ 0 → G = 0   (Nash collapse, A1)
```

Port to exploration (dials re-bound, construction preserved):

```
G_fed = (A · P · E · X)^(1/4)     where
  A = |{p : a_p = 1}| / |P|              lane availability
  P = N_receipts / N_calls               provenance integrity (≡ 1 by construction)
  E = N_success / N_calls                evidence yield
  X = 1 − max_{i≠j} Jaccard(R_i, R_j)    provider independence (Gödel E3)

Gates (same thresholds as forge_evaluate):
  G_fed ≥ 0.80 → HEALTHY   ·   ≥ 0.50 → DEGRADED   ·   < 0.50 → AVOID_AUTONOMY
```

Properties inherited from A1–A8: permutation symmetry over providers, monotonicity
(`∂G/∂d = ¼·G/d > 0`), multiplicativity, normalization `G(k,k,k,k)=k`, equal dignity.
Axioms hold because the port is a re-binding of dials, not a new aggregator.

### 3.2 Dark debt C_dark_web **[COINED]** (EMD-style, echoes `emdGate.ts` penalties)

```
C_dark = 0.4·empty_rate + 0.3·dead_lane_ratio + 0.3·stale_evidence_ratio
thresholds (borrowed from emdGate):  ≥0.50 VOID-EXPLORATION | ≥0.30 HOLD | ≥0.15 CAUTION
```

### 3.3 QG-web vector **[COINED, mirrors QG_V0_3]** 

```
V_web = (G_fed, C_dark, ΔS, FQ_exp, τ, Ω₀)
FQ_exp = |verify| / |execute|  on the search tool family   [CANON formula]
  dual-rate [CANON]: daily FQ (OBS) vs 7-day governance FQ (DER); FQ_g < 0.7 → HOLD
h_eff = h · 2^(−τ/τ½)          τ½: LIVE 10 · MEASURE 100 · WITNESS 250  [CANON]
Rank = ( ∏ hᵢ^wᵢ )^(1/Σwᵢ)     weighted geometric mean, fail-closed     [CANON]
Independence: pairwise |ρ| ≤ 0.85 else COLLAPSE_DETECTED               [CANON]
```

### 3.4 Time-to-Frontier — T-SCORE port **[COINED, using CANON first-passage math]**

Black–Cox with moving barrier (sealed T-SCORE derivation):

```
T = ln(V/B) / (λ − μ)      survival ⇔ μ > λ
```

Re-bound for exploration of a topic (sign convention DECLARED — roles flipped vs
barrier-growth form: uncertainty **decays** toward the frontier at net rate ν):

```
V = remaining uncertainty U(t)         B = target uncertainty U*
μ = discovery rate (new signal per session)
λ = decay of discovery yield + λ_governance (policy floor ≥ 0)
ν = μ − λ          T = ln(V/B) / ν     survival ⇔ ν > 0 ⇔ μ > λ
```

Same Black–Cox first-passage identity `T = ln(V/B)/relative-rate`; the canon form
`T = ln(V/B)/(λ−μ)` assumes a growing barrier catching a drifting value, while
exploration is a decaying quantity reaching a fixed target. Code declares both.

```
T < 12 sessions → topic nearly exhausted (stop or narrow)
ν ≤ 0           → STAGNATION (Ω₀ pathology, constellation state in QG spec)
```

This answers "when should an agent stop researching and start acting?" — the decision
the current stack cannot make.

### 3.5 Impulse response h(t) for lane-death events **[CANON estimator, new event class]**

The RSI engine measures `h(t)` for `888_HOLD | scar_seal | tool_failure | fix_deployment`.
**Proposal:** add `lane_death` as an impulse class (brave 402, moonshot 403 are impulses):
EMA `cumulativeInfluence_k = 0.3·rate_k + 0.7·prev`, causal half-life = first k below 0.5·baseline.
This measures how long agents keep hitting a dead lane before behavior adapts — the F1
failure class, quantified.

---

## 4. Architecture — one plane, not four

```
                    ┌─────────────────────────────────────────────┐
   warga agents ──▶ │  A-FORGE :7072  WEB EXPLORATION PLANE        │
   HERMES ────────▶ │  ┌───────────────────────────────────────┐  │
   cron/skills ───▶ │  │ webFederation (NEW domain module)     │  │
                    │  │  · circuit σ persisted (Ω12)          │  │
                    │  │  · intent plumbing (Ω03)              │  │
                    │  │  · G_fed / C_dark / V_web (§3)        │  │
                    │  │  · lane-death detector (Ω08)          │  │
                    │  └───────────────────────────────────────┘  │
                    │  forge_search · forge_fetch · forge_web_extract│
                    │  forge_browser_* · forge_scan · forge_probe_site│
                    └─────────────────────────────────────────────┘
                       providers: searxng(free) deepseek(paid) brave(dead→skip)
                       external bridges stay EXTERNAL: firecrawl (rich render),
                       arif_observe (constitutional envelope) — by design, not neglect
```

Separation of powers preserved: A-FORGE executes and meters; arifOS judges; receipts
witness. **CAPABILITY ≠ AUTHORITY** — this federation adds capability plumbing, zero
authority change. New tool count: **zero** (Law 8) — `webFederation` is a module behind
existing verbs; status rides in the existing response envelope.

---

## 5. Implementation plan (code, in this repo)

| Step | File | Change |
|---|---|---|
| 1 | `src/domain/web/federation.ts` **[NEW]** | Ω12 persistent hysteron (atomic JSON at `data/web_federation_state.json`) · G_fed/C_dark/V_web math · T-SCORE `timeToFrontier` · intent classifier |
| 2 | `src/interfaces/mcp/gatewayTools.ts` | load/persist circuit state · plumb `intent` through `scoreProviders` (kills F3) · `_federation` metadata block in search responses · fix hardcoded `providers_considered` |
| 3 | `test/webFederation.test.ts` **[NEW]** | Nash-collapse, normalization, monotonicity, persistence round-trip, frontier math |
| 4 | deploy | build · restart `a-forge-mcp` · live probe G_fed |

Success criteria (falsifiable):
1. Restart does not forget circuit state (F4 dead).
2. `source=research` routes with `research` intent scores, not `discovery` (F3 dead).
3. Every search response carries a live G_fed (F6 dead).
4. When a lane dies, `dead_lane_ratio` moves C_dark within one window (F1 becomes visible).

---

## 6. Honest gaps (what this doc does NOT claim)

1. **Ω01–Ω12 equations above are coined.** Canon provides semantics + the Ω00 lattice
   only. If the org rejects these bindings, the code still works — the math is advisory.
2. **T-SCORE port is a new use** of sealed first-passage math; its parameters (μ, λ for
   topics) are unmeasured. Until calibrated, `timeToFrontier` returns UNMEASURED.
3. **X-independence via Jaccard** is one choice; the canon test is Pearson |ρ| ≤ 0.85 on
   dimension traces. Jaccard-over-results is a cheaper proxy; declare the substitution
   (INV-6 violation if presented as the canon test).
4. **The breath loop has no dynamics in canon** — the federation does not fix that; it
   operates inside the ACT phase only.
5. DeepSeek billing (2026-11-01) remains an open F13 binary — this federation meters it
   but does not decide it.

---

## 7. Verification receipt

Written 2026-10-18 by FI-008. Sources probed live this session: A-FORGE :7072 (111 tools),
arifOS :8088, arifFlow :7073, WEALTH Ω table, QG spec, APEX math canon, gateway receipt
ledger (9,802 rows). Lane census measured, not assumed: `𝒜 = (brave=0, searxng=1,
deepseek=1, ddgs=?, minimax=0, context7=?, firecrawl-external=1)`.

DITEMPA BUKAN DIBERI ⚒️
