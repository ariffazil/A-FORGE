# 🔒 MEMBRANE CONTRACT

> **The sovereign boundary between the public edge and the arifOS kernel.**
> DITEMPA BUKAN DIBERI — Translation, not admission.

| Field | Value |
|---|---|
| **Status** | DRAFT v0.2 — awaiting F13 SOVEREIGN ratification |
| **Version** | v0.2 (2026-07-08 — 5 questions ratified, §10-14 added) |
| **Owner** | FORGE-000Ω (proposer) |
| **Witnesses required** | arifOS-8088 (kernel), Arif-F13 (sovereign) |
| **Authority** | Pre-emptive — written BEFORE any public edge gateway exists |
| **Scope** | Any boundary between external agents/users and the arifOS federation kernel |
| **Effective** | On F13 ratification (888 SEAL) |
| **Supersedes** | None — first canonical membrane contract |
| **Review cadence** | Quarterly (every 90 days) |
| **Confidence** | HIGH — principle locked, 5/8 details ratified, 3 still awaiting |

---

## §0 — Why This Contract Exists

The day external demand arrives, pressure will exist to skip governance and "just wrap." That pressure is the failure mode.

This contract is **pre-written** so that when the xmcp edge gateway (or any future public-facing surface) gets forged, the membrane rules already exist. The forger cannot drift because the doctrine is already sealed.

**Core thesis (verbatim — sealed):**

> *External identity is translated at the membrane, not admitted.*

This is the entire sovereign-system posture in one line. It governs every section below.

---

## §1 — Membrane Doctrine

### 1.1 Adat Frame

```
Public edge     →  pintu       (door / threshold)
arifOS session  →  lenggang    (the courtesy translation between worlds)
VAULT999        →  bilik dalam (the inner chamber)
```

The membrane is **hospitality with boundaries**, not exclusion. Tetamu (guests) are received. They are not unsupervised inside.

### 1.2 Constitutional Basis

| Floor | Rule | Membrane Implication |
|---|---|---|
| **F1** AMANAH | Reversible-first | External actions MUST be representable as reversible internal state |
| **F2** TRUTH | OBS/DER/INT/SPEC labels | External claims entering kernel MUST be re-classified, never trusted |
| **F3** WITNESS | Tri-witness required | External identity contributes ONE witness channel, never all three |
| **F4** CLARITY | ΔS ≤ 0 | External inputs MUST reduce, never increase, internal entropy |
| **F5** PEACE² | De-escalate | External actors MUST be de-escalated, never mirrored at their emotional register |
| **F6** MARUAH | Dignity-first | External requests MUST be honored where possible without compromising internal dignity |
| **F7** HUMILITY | Cap 0.90 | External confidence levels MUST be capped at 0.90 (F7 ceiling) |
| **F8** GENIUS | Simplest correct path | Membrane translation = smallest sufficient schema transformation |
| **F9** ANTI-HANTU | C_dark < 0.30 | External claims MUST be falsification-checked before admission to kernel reasoning |
| **F10** ONTOLOGY | AI-only ontology | External concepts map to internal categories; no ontological bleed |
| **F11** AUDIT | Every action traced | Every membrane crossing leaves a VAULT999 entry with foreign_actor_id |
| **F12** INJECTION | Sanitize inputs | External strings/claims pass through F12 sanitization before entering internal logic |
| **F13** SOVEREIGN | Arif veto FINAL | External requests touching sovereign domains → 888_HOLD gate |

### 1.3 The Translate/Admit Distinction

| Property | Translate (correct) | Admit (forbidden) |
|---|---|---|
| Identity | External schema → internal session_id | External identity used as kernel identity |
| Data shape | External JSON → internal canonical | External schema stored as-is in vault |
| Authority | External capability → internal lease | External capability = kernel capability |
| Audit | Foreign actor logged but isolated | Foreign actor merged into audit chain |
| Reversibility | Internal action can be rolled back | External action permanent in kernel |

---

## §2 — Inward Crossing (External → Kernel)

### 2.1 What MAY Cross Inward

| External signal | Translation target | Required floor checks |
|---|---|---|
| Discovery request | → `arif_route()` resolution + MCP Server Card response | F4, F11 |
| OAuth/JWT assertion | → arifOS `session_id` (mint, not pass-through) | F11, F12, F13 |
| Tool call request | → typed `arif_bridge_connect()` into target organ | F1, F2, F3, F8 |
| Read query (Mode A) | → bounded `arif_observe()` call, rate-limited | F4, F7 |
| Write command (Mode B) | → lease-gated mutation with full audit trail | F1, F3, F11, F13 |
| File content | → F12-sanitized text, never raw | F9, F12 |
| Authentication token | → short-lived `lease_id` (TTL ≤ 3600s) | F1, F13 |

### 2.2 What MUST Be Translated (Never Pass-Through)

```
❌ External user_id           →  ✅ arifos session_id (mint fresh)
❌ External organization      →  ✅ actor_id with foreign=true flag
❌ External role/permission   →  ✅ mapped to internal lease scope
❌ External monetary value    →  ✅ audited in MYR, never raw currency
❌ External timestamp         →  ✅ canonical UTC, audited at entry
❌ External schema            →  ✅ internal canonical schema
```

### 2.3 Audit Envelope (Mandatory for Every Crossing)

Every inward crossing writes a VAULT999 entry:

```json
{
  "type": "membrane_crossing",
  "direction": "inward",
  "foreign_actor_id": "<external_id>",
  "internal_session_id": "<arifos_session>",
  "lease_id": "<governed_lease>",
  "translation_applied": ["identity_mint", "schema_normalize", "f12_sanitize"],
  "floor_checks_passed": ["F1", "F11", "F12"],
  "blast_radius": "LOW|MEDIUM|HIGH",
  "timestamp_utc": "<ISO8601>",
  "actor_signature": "<arifOS-signed>"
}
```

---

## §3 — Outward Crossing (Kernel → External)

### 3.1 What MAY Cross Outward

| Internal signal | External representation | Required floor checks |
|---|---|---|
| Discovery response | → MCP Server Card (or `.well-known/agent.json`) | F4, F8 |
| Read result (Mode A) | → projected schema (subset of internal) | F7, F10 |
| Write receipt (Mode B) | → lease-scoped confirmation, never full state | F4, F11 |
| Error message | → sanitized, no internal stack traces | F12, F9 |
| Version/git hash | → semantic version, never internal commit SHA | F8 |
| Public docs/help | → curated subset, never raw internal | F4, F6 |

### 3.2 What MUST NEVER Cross Outward

```
❌ VAULT999 entries (sealed — internal lineage is not consumable)
❌ Internal session_id → external persistence
❌ Actor signatures (sovereign cryptographic material)
❌ Internal floor-check detail (only verdicts, not rationale)
❌ Other tenants' state (Mode B isolation)
❌ Raw internal tool schemas (only projected public schemas)
❌ Seal chain contents beyond summary hashes
❌ Audit envelopes with foreign actor_id visible to other externals
```

### 3.3 The Projection Rule

> *Outward surfaces are projections of internal truth, never copies.*

A projection:
- Is computed at request time
- Carries no state mutation capability
- Carries no audit liability beyond the request itself
- Is revocable at the kernel without notice

A copy (forbidden):
- Is stored externally
- Creates external state
- Requires external lifecycle management
- Creates lock-in

---

## §4 — What MUST NEVER Cross (Sealed at Origin)

These are sealed **at origin** — they cannot cross the membrane in either direction without F13 SOVEREIGN explicit approval + 888 SEAL:

| Sealed item | Reason |
|---|---|
| `actor_signature` (Arif's sovereign signature) | F13 — sovereign identity is non-transferable |
| `arifOS_internal_session_id` (any past) | F11 — audit chain integrity |
| `VAULT999` raw entries | F11 — sealed memory is append-only fossil record |
| Internal floor rationale (why a verdict was SEAL/HOLD/VOID) | F2 — truth includes reasoning, but reasoning is kernel property |
| Constitutional chain IDs (cc_id from prior SEALs) | F11 — chain integrity |
| Other foreign actors' identities | F6 MARUAH — protecting dignity of all external parties |
| Biometric state from WELL | F6 MARUAH — substrate state is sovereign data |
| Internal petrophysics / geological raw data | Sovereign national resource data classification |
| Capital positions (WEALTH internal state) | F11, sovereign financial privacy |
| Any data tagged `sealed_at_origin: true` | By definition — sealed means sealed |

---

## §5 — Mode A — Read-only Publication

### 5.1 Definition

External agents can **read** public-projected state. They cannot mutate, lease, or invoke compute that consumes budget.

### 5.2 Permitted

- `arif_observe(mode="search"|"fetch"|"atlas")` — read-only
- `arif_observe(mode="compass")` — discovery response
- MCP Server Card response (`.well-known/agent.json` equivalent)
- Cached static documentation
- Rate-limited public tool result (no side-effect tools)

### 5.3 Forbidden in Mode A

- Any `arif_forge*` call
- Any `arif_judge` call (kernel adjudication is internal)
- Any mutation against VAULT999
- Any lease acquisition
- Any tool that consumes WEALTH/GEOX compute budget beyond threshold
- Any tool that triggers internal session creation (except ephemeral session for the read itself)

### 5.4 Rate Limits (Ratified v0.2)

| Dimension | Limit | Note |
|---|---|---|
| Sustained requests per actor per minute | 60 | |
| Sustained requests per actor per hour | 1000 | |
| Max response size | 1 MB | |
| Concurrent connections per actor | 5 | |
| Burst | None — sustained only | Mode A = read-only, no burst complexity. Simple window. |

### 5.5 Membrane Posture

```
Mode A surface = OBSERVE_ONLY
Translation = identity mint + schema projection
Audit = per-request VAULT999 entry (read-only envelope)
Revocation = rate-limit escalation, then IP ban via Caddy
Failure response = F4 sanitized (no internal detail)
```

---

## §6 — Mode B — Interactive Federation

### 6.1 Definition

External agents can **invoke** tools through the membrane. Each invocation creates an ephemeral lease, full audit trail, and consumes kernel resources. External actors authenticate and are bound by usage limits.

### 6.2 Permitted (After F13 Ratification Per Public Surface)

- `arif_bridge_connect()` to organ tools (typed call)
- Lease-gated mutation tools (subject to organ-specific blast radius)
- State-modifying tools in organs (write to organ's internal store, not VAULT999)
- Compute-consuming tools (subject to budget)

### 6.3 Required Controls

| Control | Implementation |
|---|---|
| **Lease** | Every Mode B invocation mints a `lease_id` (TTL ≤ 3600s, renewable) |
| **Audit** | Every invocation writes full VAULT999 envelope with foreign_actor_id |
| **Budget** | Per-actor token/compute budget; over-budget = HOLD gate |
| **Revocation** | Lease revocable by F13 (or arifOS auto on F11 violation) |
| **Rate limit** | Ratified v0.2: 5 req/min sustained. Burst allowed up to budget. See §5.6 / §6.6. |
| **Floor check** | Every invocation re-runs F1, F2, F11, F13 |
| **Sandbox** | Tool execution in `forge_sandbox_run` if blast ≥ MEDIUM |
| **Scope cap** | External actors cannot invoke tools above their lease scope |

### 6.4 Forbidden in Mode B (Without F13 Per-Invocation Override)

- VAULT999 SEAL/append (sovereign lineage is internal-only)
- Constitutional floor changes (F1-F13 modification)
- Sealed-memory recall (forget, revise, promote)
- Cross-actor state mutation (one foreign actor cannot affect another's state)
- Tools touching sovereign domains: WELL biometric, WEALTH internal positions, arifOS judgment
- Recursive invocation (an external tool calling another external tool)

### 6.5 The Reversibility Invariant

> *Every Mode B invocation MUST be representable as a reversible internal state change.*

If a tool is not reversible:
- It is forbidden at the membrane
- Or it requires F13 per-invocation sovereign ack

This is F1 AMANAH at the edge.

### 6.6 Burst Discipline (Mode B) — Ratified v0.2

**Rule:** Mode B burst consumes from the sustained-rate budget. No parallel burst token.

```
Budget    = 5 tokens per actor per 60s window
Sustained = refill at 5 tokens / 60s
Burst     = actor may consume up to all 5 tokens within any 10s sub-window
Cooldown  = once budget hits 0, locked out for remainder of 60s window
```

**Why this design (F8 GENIUS):**
- Simple mental model — one budget, one window, one cooldown
- Prevents gaming (no "5 calls in 1s, then silence" pattern)
- LLM agents that spiral hit ceiling before damage compounds
- No parallel counter to track, no edge cases

**Worked example:**
```
t=0s:    actor has 5 tokens. Calls tool.   → 4 remaining.
t=2s:    calls tool.                       → 3 remaining.
t=5s:    calls tool.                       → 2 remaining.
t=10s:   budget check — 5+0 refilled (5/60s × 10s = 0.83). Still 2 left.
         Wait... actually budget = min(5, current+refill).
t=60s:   full budget back to 5 tokens.
```

Implementation note: use sliding window counter (5 tokens, refill 1 per 12s).

---

## §7 — Identity Translation Table

| External schema field | Internal representation | Translation logic |
|---|---|---|
| `external_user_id` | `foreign_actor_id` (UUID v7) | New ID minted per external identity |
| `external_org_id` | `foreign_org_id` (UUID v7) | New ID per external org |
| `oauth_token` | `arifOS session_id` (minted) | Mint fresh, never pass-through |
| `external_role` | `lease_scope` (subset only) | Map to internal scopes; deny by default |
| `external_timestamp` | `audit_timestamp_utc` (ISO8601) | Normalize to UTC at entry |
| `external_currency` | `amount_myr` (canonical) | Convert at entry, audit FX rate |
| `external_schema_v` | `internal_schema_canonical` | Validate, project, never store external |
| `external_signature` | (rejected — internal mints new) | External signatures never authorize internal action |
| `external_jurisdiction` | `jurisdiction_tag` (metadata) | Tagged, not enforced at membrane (kernel decides) |
| `external_consent` | `consent_evidence` (audit) | Logged as evidence, not as authority |

### 7.1 The One-Way Hash

External IDs are stored as:
```
foreign_actor_id = sha256(external_user_id || arifos_internal_salt)
```

This:
- Is reversible to arifOS internal
- Is irreversible to anyone without internal salt
- Does NOT leak external identity into kernel logs
- Allows audit correlation without identity exposure

---

## §8 — Failure Modes & Breach Response

### 8.1 Membrane Breach Categories

| Breach | Detection | Response |
|---|---|---|
| **Identity forgery** | Signature check fails at edge | 401 + VAULT999 entry + IP ban |
| **Schema injection** | F12 sanitizer flags | 400 + VAULT999 entry + actor temp-ban |
| **Scope escalation** | Lease scope mismatch | 403 + VAULT999 entry + lease revoke |
| **Budget exhaustion** | Token counter trips | 429 + cooldown 60s |
| **Rate limit breach** | Counter trips | 429 + exponential backoff |
| **F2 violation (false claim)** | Tri-witness fails | HOLD gate, foreign actor escalated to F13 |
| **F9 violation (hallucination pattern)** | Pattern detector flags | Sandbox + F12 + flag to kernel |
| **F13 violation (sovereign domain touched)** | Domain classifier trips | 888_HOLD gate, immediate F13 notification |
| **Audit chain break** | Hash mismatch | EMERGENCY — freeze all membrane crossings, F13 alert |
| **Sealed data leak attempt** | Schema classifier trips | VOID + actor permanent ban + forensic audit |

### 8.2 The Hantu Response

If a foreign actor's claims show systematic hallucination patterns (F9):

1. Sandbox the actor — all calls run in forge_sandbox_run
2. Pattern-log every claim
3. Escalate to arifOS for F9 violation assessment
4. F13 decides: ban / shadow-ban / continue-with-warning

Never trust, never auto-ban. Hantu is detected, not assumed.

### 8.3 The Cold Path

If the membrane itself is breached (not a foreign actor — the membrane gateway itself):

1. **IMMEDIATE** — revoke all foreign leases
2. Freeze the public edge gateway
3. Internal kernel continues — sovereign surface unaffected
4. Forensic audit: every membrane crossing in last 24h
5. F13 decides: rebuild membrane, rotate salts, restore edge

This is the **reversibility invariant** in action. The kernel survives the membrane's death.

---

## §9 — Ratified & Open Questions

### 9.1 Ratified in v0.2 (5/8 closed)

| # | Question | Ratified Answer | Section |
|---|---|---|---|
| Q1 | Mode A rate limit | 60/min sustained, 1000/hr. No burst. | §5.4 |
| Q2 | Mode B rate limit | 5/min sustained. Burst consumes from same budget. | §6.3, §6.6 |
| Q3 | Per-actor budget | 4-tier ladder (VISITOR/GUEST/PARTNER/COVENANT). Auto-promotion V→G→P. COVENANT = manual. | §12 |
| Q5 | xmcp gateway timing | 3 actors + class diversity + not-REST-servable. | §11.5 |
| Q7 | Server Card scope | Per-tool `exposure` + `tier_min` tags, not per-organ. | §11.6 |

### 9.2 Still Open (3/8 awaiting F13)

| # | Question | My recommendation | Awaiting |
|---|---|---|---|
| Q4 | Allowed Mode B tools per organ — full or curated list? | Curated list, F13-initial + organ-keeper approval | F13 |
| Q6 | Audit retention horizon for foreign actors | 90 days raw, then summarized, then cold-storage at 1 year | F13 |
| Q8 | Foreign actor right-of-recourse | Structured JSON protocol (RECOURSE_PROTOCOL_v1) — auto-triage, F13 verdict, VAULT999 log, non-appealable. See §13.4. | F13 |

---

## §10 — Authority & Ratification

### 10.1 This Draft

```
drafted_by    : FORGE-000Ω
drafted_at    : 2026-07-08 (v0.1) → v0.2 patch 2026-07-08
kernel_ref    : arifos :8088 (read for floor consistency)
federation    : 6/6 organs green at draft time
drift_state   : arifOS kernel self-reports YELLOW (known anomaly, non-blocking for draft)
```

### 10.2 Ratification Path

```
DRAFT (this document)
  ↓ FORGE-000Ω proposes
  ↓ arifOS-888 constitutional review (F1-F13 spot-check)
  ↓ AAA-3001 cross-organ review (no organ vetoed by this contract)
  ↓ Arif-F13 sovereign review
SEAL → canonical, surfaces bind to it
```

### 10.3 After Ratification

```
MEMBRANE_CONTRACT.md → promoted to /root/docs/governance/
VAULT999 entry → SEAL with verdict=HOLD_READY (not yet enforced)
Mode A + B rules → implementable in xmcp edge gateway
Foreign actor identity translation → implemented in arifos session mint
Tier promotion auto-engine → implemented in arifOS session tier controller
```

### 10.4 Supersession Rule

This contract supersedes **nothing** (first canonical version). Future amendments require:
- 30-day notice to F13
- Floor impact assessment
- arifOS constitutional review
- F13 SEAL

---

## §11 — Ratified Decisions (v0.2 Patch Record)

This section records the **5 governance parameters** ratified in v0.2, with rationale, measurement, and operational hooks.

### 11.1 Rate Limit Mechanism

**Decision:** Burst consumes sustained budget. One bucket, one window.

| Mode | Sustained | Burst | Cooldown |
|---|---|---|---|
| Mode A (read) | 60/min | None | N/A |
| Mode B (invoke) | 5/min | Up to 5 in any 10s | Until 60s window resets |

**Rationale:** Simpler mental model prevents gaming. LLM agents that spiral hit ceiling before damage compounds. Single sliding-window counter is enough.

**Measurement:** `forge_metric(mode_b_burst_gaming_attempts_total)` — alerts if any actor bursts >3 times within 5 minutes.

### 11.2 Tier Promotion Discipline

**Decision:** VISITOR → GUEST → PARTNER auto-promote. PARTNER → COVENANT manual.

| Transition | Mechanism | Trigger |
|---|---|---|
| VISITOR → GUEST | Auto | 30 days clean record + ≥1 successful tool call + no F11/F12 violation |
| GUEST → PARTNER | Auto | 90 days clean + ≥50 successful calls + ≥3 distinct tool categories used |
| PARTNER → COVENANT | **Manual — F13 + 888_JUDGE** | Written pact required. Treaty between sovereigns. |

**Rationale:** F13 directive 2026-07-08 — *"aku malas nak manual2 approve. HITL is not sustainable."* Auto-promotion preserves sovereign bandwidth. COVENANT stays sovereign because it's a treaty, not a tier transition.

**Anti-capture rule:** No actor can hold more than 2 active foreign_actor_ids simultaneously. Prevents Sybil-style accumulation.

**Measurement:** `forge_metric(tier_promotion_events_total{tier_from,tier_to,mode})` and `forge_metric(tier_demotion_events_total{reason})`.

### 11.3 Burst Discipline Implementation (Mode B)

**Decision:** Sliding window counter, 5 tokens, refill 1 per 12s.

```
Implementation note: implement as Redis sliding-window or in-process LRU.
Tokens = 5. Refill = 1 token / 12 seconds.
Burst = actor may consume any number of tokens, but cannot exceed 5 within the rolling 60s.
```

**Measurement:** `forge_metric(mode_b_burst_consumption_p99)` — tracks 99th percentile of burst depth.

### 11.4 xmcp Gateway Trigger

**Decision:** Build gateway ONLY when ALL conditions met:
1. ≥3 concrete external actors (different classes — human, AI agent, SaaS)
2. ≥1 stated repeatable use case
3. Demand cannot be served by plain REST/HTTPS endpoint
4. F13 signals "okay to build"

**Rationale:** Avoid building infrastructure before demand. Most "MCP demand" is actually REST demand with hype. Filter for genuine agentic needs (discovery + composition, not just endpoint calls).

### 11.5 Server Card Exposure Schema

**Decision:** Per-tool `exposure` and `tier_min` fields in AGENT_REGISTRY.json.

```json
{
  "tool": "basin_summary",
  "exposure": "PUBLIC",
  "tier_min": "VISITOR"
}

{
  "tool": "prospect_rank_internal",
  "exposure": "SOVEREIGN",
  "tier_min": null
}
```

**Exposure levels:**
- `PUBLIC` — visible on Server Card, accessible to all tiers
- `RESTRICTED` — visible on Server Card only to specific tier_min
- `SOVEREIGN` — never visible on Server Card, internal-only

**Rationale:** Per-organ exposure creates over- and under-exposure simultaneously. Per-tool exposure aligns with actual sensitivity. Same organ can have PUBLIC reads AND SOVEREIGN internals.

**Action:** Audit current `AGENT_REGISTRY.json` — tag every tool with `exposure` + `tier_min`. Gap analysis pending F13 audit window.

### 11.6 The One Refusal

**Decision (with one sovereign exception):** No manual approval for tier promotion V→G→P. No HITL for routine membrane crossings. Sovereign attention reserved for:
- COVENANT tier (treaty)
- 888_HOLD gates (constitutional violations)
- Audit chain breaks
- F13-initiated override

**The exception:** F13 may ALWAYS halt, override, or reverse any auto-promotion. The automation is reversible. Sovereignty retains final veto.

---

## §12 — Tier Transition Discipline (Operational Spec)

### 12.1 Tier Ladder

| Tier | Monthly Compute Budget | Tool Access | Promotion |
|---|---|---|---|
| **VISITOR** | RM 10 | Mode A (read-only) + ≤3 Mode B tools | Auto after 30 days clean + 1 successful call |
| **GUEST** | RM 100 | Mode A + ≤15 Mode B tools (tier-restricted) | Auto after 90 days clean + 50 successful calls + 3 tool categories |
| **PARTNER** | RM 500 | Mode A + all Mode B tools in their scope | Auto after 180 days clean + 500 successful calls + 5 tool categories |
| **COVENANT** | Custom (written pact) | Custom scope | **MANUAL — F13 + 888_JUDGE** |

### 12.2 Promotion Criteria (Auto)

```
PROMOTE(actor, from_tier, to_tier):
  days_clean := days_since_last_violation(actor)
  successful_calls := count_successful_calls(actor, since=promotion(from_tier))
  tool_categories := distinct_tool_categories(actor, since=promotion(from_tier))
  no_floor_violation := floor_violations(actor, since=promotion(from_tier)) == 0
  
  REQUIRE days_clean >= minimum_days[from_tier→to_tier]
  REQUIRE successful_calls >= minimum_calls[from_tier→to_tier]
  REQUIRE tool_categories >= minimum_categories[from_tier→to_tier]
  REQUIRE no_floor_violation == true
  
  ON PASS: mint new tier credential, write VAULT999 entry, notify actor
  ON FAIL: return HOLD with criteria_gap list
```

### 12.3 Demotion Triggers (Auto)

- F11 audit violation (any) → demote to VISITOR + 30-day cooldown
- F12 injection attempt → demote to VISITOR + 90-day cooldown + ban review
- 3 rate-limit breaches in 24h → temp demote 24h
- Actor dormancy (no calls in 180 days) → demote one tier

### 12.4 The COVENANT Exception

**PARTNER → COVENANT requires:**
1. Written pact drafted by actor + arifOS representative
2. F13 review (constitutional, not operational)
3. 888_JUDGE deliberation
4. VAULT999 SEAL with `tier_promotion=COVENANT`

**Why manual:** A COVENANT is a treaty. Treaties are sovereign-domain. They define scope, recourse, and exit clauses that no automation can adjudicate fairly.

**Operational note:** Auto-promotion is the default. COVENANT is the exception. The ratio should be ~99% auto, ~1% manual (only the truly novel partnerships).

### 12.5 Reversibility

Every auto-promotion is **reversible** by F13 within 30 days. After 30 days, demotion requires a violation trigger. This window prevents drift while preserving F13 override.

**Measurement:** `forge_metric(tier_auto_promotion_reversal_total)` — F13 must always see this counter.

---

## §13 — Measurement & Observability

Every mechanism in this contract MUST have a measurement hook. Without measurement, even good mechanisms drift into theater.

### 13.1 Membrane Crossings

| Metric | Type | Alert threshold |
|---|---|---|
| `membrane_crossings_total{direction,mode}` | Counter | None (info) |
| `membrane_crossings_rejected_total{reason}` | Counter | Spike → investigate |
| `membrane_crossing_latency_p99` | Gauge | > 500ms → investigate |
| `membrane_translation_errors_total{error_type}` | Counter | Any → 888_HOLD |

### 13.2 Rate Limit & Budget

| Metric | Type | Alert threshold |
|---|---|---|
| `rate_limit_breaches_total{actor,mode}` | Counter | >10/day per actor → review |
| `budget_exhaustion_total{actor,tier}` | Counter | Pattern → tier review |
| `tier_promotion_events_total{from,to,mode}` | Counter | Sudden spike → audit |
| `tier_demotion_events_total{reason}` | Counter | F11/F12 → 888_HOLD |
| `covenant_promotions_total` | Counter | Each one is F13 event |

### 13.3 Identity & Audit

| Metric | Type | Alert threshold |
|---|---|---|
| `foreign_actor_ids_active` | Gauge | > 2 per host → Sybil alert |
| `audit_envelope_writes_total` | Counter | None (info) |
| `audit_chain_breaks_total` | Counter | ANY → EMERGENCY |
| `sealed_data_leak_attempts_total` | Counter | ANY → 888_HOLD |

### 13.4 Recourse Protocol (Q8 Pending Ratification)

When ratified, the recourse protocol emits:
- `recourse_appeals_submitted_total`
- `recourse_appeals_auto_rejected_total{reason}`  (malformed / repeat / irrelevant)
- `recourse_appeals_f13_reviewed_total{verdict}`  (UPHELD / REVERSED / SABAR / VOID)
- `recourse_appeals_pending_f13`  (gauge — backlog)

**F13 attention protection:** Only structured appeals reach F13. Spam dies at Step 1.

### 13.5 The Audit Dashboard

One URL, one panel, all metrics:
- `https://cockpit.arif-fazil.com/membrane` (planned, post-ratification)
- Real-time metrics, audit chain integrity, foreign actor registry, tier distribution

---

## §14 — The One Sentence (Preserved)

> *Translation at the membrane, sovereignty at the kernel, hospitality at the door.*

---

**End of DRAFT v0.2. Awaiting F13 SOVEREIGN ratification.**

DITEMPA BUKAN DIBERI 🔒
Forged 2026-07-08 by FORGE-000Ω (v0.1) → v0.2 patch by FORGE-000Ω
for Muhammad Arif bin Fazil, F13 SOVEREIGN