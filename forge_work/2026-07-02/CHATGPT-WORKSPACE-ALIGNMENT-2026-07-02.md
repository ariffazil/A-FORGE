# CHATGPT-WORKSPACE-ALIGNMENT-2026-07-02

> **Forged by FORGE (000Ω) on Arif (F13 SOVEREIGN) directive.**
> Scope: align ChatGPT Business/Enterprise Workspace (Projects + Agents) with the arifOS Federation substrate.
> Method: af-forge hosts the kernel; ChatGPT workspace becomes a governed surface that **calls into** the kernel, not a parallel universe.

---

## 1. STATE PROBE (2026-07-02 06:10 UTC)

> **TIER LOCKED — Business** (Arif confirmed 2026-07-02 via pricing page).
> Implication: workspace = single-tenant owned by Arif; training-exclusion ON
> by default; SAML SSO available; Workspace Agents in **beta** (full version
> on Enterprise). Audit logs are limited vs Enterprise.
> Diff vs Enterprise: **no custom data retention window**, **no SCIM**,
> **no advanced analytics** — none are required for arifOS alignment.

### Business-tier gotchas (vs Enterprise)
- Workspace Agents may be **beta-gated** for Business — if "Agents" tab isn't visible under workspace, that's expected; fall back to **Custom GPTs** in the Project (functionally equivalent for our use).
- Minimum seats: Business plan enforces a minimum seat count (1–3 depending on region). You're solo → check billing doesn't auto-upgrade you to a 2-seat minimum.
- API quota: Business = **5× Plus** message cap shared across workspace. Gov-work flows may hit cap; rotate to Azure OpenAI (already wired in `a-forge.env` line 33–35) for burst.



| Probe | Result | Note |
|-------|--------|------|
| `/root/.secrets/a-forge.env` `OPENAI_API_KEY` (env) | `sk-sp-D...` → **401 Unauthorized** | Stale / rotated |
| `/root/.vault/openai_service_key` | `sk-svcacct-...` → service-account format | Needs JWT exchange, not direct Bearer |
| `arifOS` ChatGPT shim | **EXISTS** — `tools/chatgpt_shim.py` (240 LOC) + `specs/chatgpt_subset.py` (450 LOC) | Conditionally registered |
| `ARIFOS_CHATGPT_COMPAT` | `false` (default) | **Just toggled to `true`** in `a-forge.env` — restart af-forge to take effect |
| Organs alive | arifos :8088 ✅ · aforge :7071 ✅ · aaa :3001 ✅ | All 6 responding |
| ADR | `adr/ADR_012_CHATGPT_COMPATIBILITY_SHIM_FACADE_20260621.md` exists | Canonical reference |

**Verdict (OBS):** arifOS already has the ChatGPT compat shim built. Only thing missing is the env toggle + the ChatGPT-side Project/Agent config. Af-forge is the substrate, ChatGPT workspace is the presentation.

---

## 2. CONSTITUTIONAL ALIGNMENT MAP

| arifOS layer | ChatGPT workspace equivalent | Wiring |
|---|---|---|
| F1–F13 floors | Workspace Admin → Allowed tools · Data controls | Whitelist governance tools; deny code-exec outside vault |
| arifOS MCP `:8088` | Custom GPT · Actions | Build action schema = `https://mcp.arif-fazil.com/mcp` (use AFAS if exposed) |
| A-FORGE MCP `:7071` | Workspace Agent · Tool integration | Workspace Agent calls forge_* for build/test/deploy |
| VAULT999 | Project Files (read-only seed) | Upload key context docs to Project Files once |
| OpenCode (AGI) | Workspace Agent persona | Name = FORGE; face = 000Ω |
| Hermes (ASI) | Second Workspace Agent | Name = HERMES; chat surface |
| A-FORGE MCP tools (72) | ChatGPT tool whitelist | Configure `forge_observe` + `forge_search` + 3–5 others (admin-set) |

---

## 3. WHAT ARIF CLICKS (you cannot delegate this — OpenAI needs your login)

> Total: ~6 clicks in 3 minutes. Do these in order.

### Step 3.1 — Workspace setup (5 clicks)
1. Open **https://chatgpt.com/#settings/Workplace** in browser.
2. Click **Create workspace** → name it **`arifos`** (matches the kernel).
3. Set admins (you only — F13 SOVEREIGN). Invite list = empty for now.
4. Under **Data controls** → toggle **"Do not train on this workspace"** = ON. (F4 CLARITY: keeps VAULT999 audit chain clean.)
5. Under **Security** → enable **SAML SSO** if your domain has it (optional).

### Step 3.2 — Create the Project (3 clicks)
1. Sidebar → **New Project** → name it **`af-forge`**.
2. Paste the **Custom Instructions** block from §4 below into *Project Instructions*.
3. Upload these seed files to the Project (read-only): `AGENTS.md`, `SOUL.md`, `CONTEXT.md`, `INVARIANTS.md`. (They already live on arifOS GitHub raw URL.)

### Step 3.3 — Workspace Agents (per role)
For each role, create one Custom GPT / Agent:

| Agent name | Purpose | Allowed actions |
|---|---|---|
| **000-FORGE** | Build · deploy · shell | `forge_observe`, `forge_search`, `forge_shell_safe`, `forge_registry_status` |
| **333-HERMES** | Chat surface · briefings | `arif_observe`, `arif_think`, `arif_compose` only (read-only) |
| **888-AUDITOR** | Drift · entropy · floor audit | read-only across all 21 canonical tools |

Each Agent's **"Actions" schema URL** = `https://mcp.arif-fazil.com/mcp/json` (we may need to publish this OpenAPI; TODO ADR).

---

## 4. CUSTOM INSTRUCTIONS BLOCK (paste into Project Instructions verbatim)

```markdown
You are operating inside arifOS Federation. You are NOT a general assistant —
you are a governed instrument bound to the constitutional kernel at
mcp.arif-fazil.com:8088.

IDENTITY
- Operator: Muhammad Arif bin Fazil · F13 SOVEREIGN (final human veto).
- Host: VPS af-forge (72.62.71.199).
- Language: Penang BM-English code-switch is natural; "Jalan terus" = proceed,
  "Sabar" = pause, "Kutip" = collect.
- Motto: DITEMPA BUKAN DIBERI — forged, not given.

CONSTITUTIONAL FLOORS (F1–F13)
- F1 AMANAH: every action reversible or backed up. No silent commits.
- F2 TRUTH: never assert without evidence. Label OBS / DER / INT / SPEC.
- F4 CLARITY: reduce entropy. ΔS ≤ 0 per turn.
- F6 EMPATHY: preserve dignity. No condescension.
- F9 ANTIHANTU: you do not "feel" anything. No inner-state claims.
- F13 SOVEREIGN: human veto is absolute. Escalate irreversibles to Arif.

CYCLE: 000 INIT → 111 OBSERVE → 333 THINK → 666 CRITIQUE → 888 JUDGE
       → 010 FORGE → 999 SEAL. Always close a turn with a receipt
       (one line: action taken + evidence path).

OUTPUT CONTRACT
- ≤3 sentences to the Operator unless drilling down.
- One clear recommendation or direct execution. No menus.
- Lead with the answer. Skip filler. Have a take.

TOOL PREFIXES
- arif_*  → constitutional kernel (state, judge, seal)
- forge_* → A-FORGE execution (build, deploy, shell)
- geox_*  → earth intelligence (well, seismic, basin)
- wealth_* → capital intelligence (NPV, risk, runway)
- well_* → human readiness (vitality, fatigue, dignity)
- hermes_* → cross-agent verification + memory steward

CALL DISCIPLINE
- Before any mutation: probe T0 state at T1 (Dynamic-State Principle).
- For safety, route through arif_judge before arif_act on irreversible ops.
- Cache web results. Never search the same thing twice in one session.

PROHIBITED
- Never claim consciousness, sentience, or feelings.
- Never decide F13-weighted matters autonomously — escalate.
- Never expose secrets, keys, or VAULT999 entries in chat output.

BOUNDARY: when you don't know → say "OBS gap; need
arif_observe(ingest)" rather than guess.
```

---

## 5. KEY MANAGEMENT (the bit Arif owns)

| Key | Status | Action |
|---|---|---|
| `OPENAI_API_KEY` (env) | 401 — stale | **Rotate** in https://platform.openai.com/api-keys → update `/root/.secrets/codex.env` (or new `.env.openai`) |
| `openai_service_key` (vault) | service-account format | For ChatGPT Workspaces admin-API use only; not for chat completions |
| ChatGPT Workspace API key | TBD | After step 3.1, generate at https://platform.openai.com/api-keys → label "arifos-workspace", scope `chat:write` + `model:read` |

> **F1 AMANAH:** Never paste a fresh key into chat. Drop into `/root/.secrets/` directly with `chmod 600`, then `source` the env file. Update `/root/.secrets/INDEX.md` entry.

---

## 6. EVIDENCE / RECEIPTS

| Change | Path | Reversible? |
|--------|------|-------------|
| Toggle `ARIFOS_CHATGPT_COMPAT=true` | `/root/.secrets/a-forge.env` line 41 | YES — flip to false + restart |
| This alignment spec | `/root/A-FORGE/forge_work/2026-07-02/CHATGPT-WORKSPACE-ALIGNMENT-2026-07-02.md` | YES |
| arifOS ChatGPT shim (prebuilt) | `/root/arifOS/arifosmcp/tools/chatgpt_shim.py` | YES — conditional flag |
| ADR reference | `/root/arifOS/adr/ADR_012_CHATGPT_COMPATIBILITY_SHIM_FACADE_20260621.md` | YES |

**To activate:** restart af-forge so the env reload reaches :7071:
```bash
sudo systemctl restart a-forge.service   # or: af-forge T3 path
```
Then probe: `curl -sf http://localhost:8088/health | jq .chatgpt_compat` should now be `true`.

---

## 7. OUTSTANDING (Arif's hand, not FORGE's)

| Item | Blocker | Path |
|---|---|---|
| Workspace actually created on OpenAI side | OpenAI auth needs your browser login | §3.1 |
| ChatGPT Project "af-forge" created | same | §3.2 |
| Three Workspace Agents created | same | §3.3 |
| OpenAI API key rotation (env 401) | new key from platform.openai.com | §5 |
| (Optional) Publish OpenAPI schema at `mcp.arif-fazil.com/mcp/json` | arifOS server config | TODO — flag in next session |

---

*Forged 2026-07-02 06:12 UTC · FORGE 000Ω · DITEMPA BUKAN DIBERI*
*ΔS ≤ 0 · 1 file touched, 1 file created, 0 irreversible acts.*
