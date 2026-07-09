# APA-GitHub — Canonical Reflex-Arc Connector (COMPILE TARGET)

> **THIS IS NOT A DESIGN DOC. THIS IS THE COMPILE TARGET.**
> Every future APA connector (Slack · Drive · Notion · Sheets · any SaaS) is an **isomorphic copy** of this file.
> Only the protocol adapter and verb names change. The reflex arc does not.
>
> **Forged:** 2026-07-09 · **Live bridge:** `scripts/github_bridge.py` · **Port:** `127.0.0.1:18095`
> **Unit:** `apa-github-bridge.service` · **Status:** PRODUCTION · **First fully shaped APA connector**
> **Companion:** `APA-GITHUB-CANONICAL-TEMPLATE.md` (quick-ref) · `APA-AFORGE-ARCHITECTURE-DERIVATION.md` (layer map)
>
> **Clone checklist (§9):** Any new connector file that does not pass all 7 gates is **not APA** — it is ad-hoc tooling.

---

## 0. The Bridge Theorem (what APA operationalizes)

```
classify before judgment,
constrain after judgment.
```

| Stage | Executor | Job | Gate |
|-------|----------|-----|------|
| **ART** | Agent pre-kernel reflex | Classify intent: action_class, blast_radius, lease_scope | `PROCEED` / `HOLD` / `BLOCK` / `DEFAULT_OBSERVE` |
| **KERNEL** | arifOS F1–F13 | Constitutional judgment on whether power may flow | `SEAL` / `HOLD` / `SABAR` / `VOID` |
| **APA** | Connector manifest + forge_lease | Express authorized power to external systems | Lease valid + scope match + TTL alive |
| **ACT** | Bridge + A-FORGE MCP | Touch reality in phased execution | DRY_RUN → SIMULATE → EXECUTE → VERIFY → ROLLBACK → RECEIPT |
| **VAULT999** | arifOS seal chain | Remember immutably | Append-only · hash-chained · never modified |

**APA is the formal language of constraint for SaaS** — it sits between KERNEL judgment and ACT execution. Without APA, the arc breaks: the kernel says "yes" but there's no governed way to call GitHub, send email, or create a calendar event.

```
ART ──classify──▶ KERNEL ──judge──▶ APA ──express──▶ ACT ──touch──▶ VAULT999
     │                │                │                │
  power class     F1–F13 floors    lease+manifest    DRY_RUN→RECEIPT
     │                │                │                │
  STOP lawful      STOP lawful      STOP lawful      STOP lawful
```

**The five irreducible steps (never collapse these):**

1. Intent is not action
2. Classification is not authorization
3. Authorization is not execution
4. Execution is not completion
5. Completion requires witness

---

## 1. Complete verb × action-class × reflex matrix

Every verb in this table MUST pass through all five reflex stages. No shortcuts.

### 1.1 OBSERVE verbs (no lease required, session may apply)

| Verb | Action Class | Lease Scope | Blast | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|------|-------------|-------------|-------|----------------|---------------|---------------|------------|----------|
| `search_repos` | OBSERVE | `github.read` (opt) | LOW | Tool call = observer. No mutation. | F2 (truth), F4 (clarity), F12 (injection) | Manifest resolve. No lease gate. | DRY_RUN (validate query) → EXECUTE (GET search) → VERIFY (items is array) | Optional |
| `get_repo` | OBSERVE | `github.read` (opt) | LOW | Observer. | F2, F4, F12 | Same. | DRY_RUN → EXECUTE (GET) → VERIFY (has `full_name`) | Optional |
| `list_issues` | OBSERVE | `github.read` (opt) | LOW | Observer. | F2, F4, F12 | Same. | DRY_RUN → EXECUTE (GET) → VERIFY (items is array) | Optional |
| `list_pull_requests` | OBSERVE | `github.read` (opt) | LOW | Observer. | F2, F4, F12 | Same. | DRY_RUN → EXECUTE (GET) → VERIFY (items is array) | Optional |

**OBSERVE rule:** No lease gate at APA layer. Bridge may still apply session/transport checks from A-FORGE MCP. RECEIPT is optional — but RECOMMENDED for any external API call (F11 audit continuity).

### 1.2 MUTATE verbs (lease REQUIRED)

| Verb | Action Class | Lease Scope | Blast | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|------|-------------|-------------|-------|----------------|---------------|---------------|------------|----------|
| `create_issue` | MUTATE | `github.mutate` | MEDIUM | Mutator. External side effect (public if repo public). Reversible via close_issue (compensating). Requires lease. | **All 13 floors applied.** F1 (reversible-enough), F2 (not fabricated), F3 (witness if HIGH stakes), F4 (thin verb), F5 (no harassment), F7 (Ω₀ ≤ 0.85), F11 (receipt), F12 (body is data), F13 (888 can HOLD) | ① manifest resolve ② verify lease `github.mutate` ③ TTL alive ④ bind session+actor ⑤ dispatch to bridge | DRY_RUN (GET repo exists) → SIMULATE (hash title+body) → EXECUTE (POST issue) → VERIFY (GET issue, state=open) → ROLLBACK (close_issue compensating) → RECEIPT | **REQUIRED** |
| `close_issue` | MUTATE | `github.mutate` | MEDIUM | Mutator. Reversible (reopen possible). Requires lease. | Same as create_issue. | Same. | DRY_RUN → SIMULATE → EXECUTE (PATCH state=closed) → VERIFY (GET state=closed) → ROLLBACK (reopen) → RECEIPT | **REQUIRED** |
| `add_issue_comment` | MUTATE | `github.mutate` | MEDIUM | Mutator. Requires lease. | Same. | Same. | DRY_RUN → SIMULATE → EXECUTE (POST comment) → VERIFY → ROLLBACK (delete comment if possible) → RECEIPT | **REQUIRED** |
| `create_pr` | MUTATE | `github.mutate` | MEDIUM | Mutator. Default draft=true (lower blast). Requires lease. | Same + F1 (draft first, never force-push). | Same. | DRY_RUN (GET branches exist) → SIMULATE (show diff summary) → EXECUTE (POST pulls, draft=true) → VERIFY (GET pr) → ROLLBACK (close PR) → RECEIPT | **REQUIRED** |
| `create_or_update_file` | MUTATE | `github.mutate` | MEDIUM | Mutator. External side effect. Requires lease. | Same + F1 (get sha first for update; backup content). | Same. | DRY_RUN → SIMULATE → EXECUTE (PUT file) → VERIFY (GET file, content matches) → ROLLBACK (revert commit) → RECEIPT | **REQUIRED** |
| `push_files` | MUTATE | `github.mutate` | MEDIUM | Mutator. Multi-file commit. Requires lease. | Same + F1 (commit-to-branch only, never force-push main). | Same. | DRY_RUN → SIMULATE → EXECUTE → VERIFY → ROLLBACK (revert) → RECEIPT | **REQUIRED** |

**MUTATE rule:** No lease → no dispatch. Bridge returns `403 lease_required` if `APA_REQUIRE_LEASE_ID=1` (recommended for production). RECEIPT is mandatory.

### 1.3 IRREVERSIBLE verbs (short-TTL lease + ACK REQUIRED)

| Verb | Action Class | Lease Scope | Blast | ART Classifies | Kernel Checks | APA Expresses | ACT Phases | VAULT999 |
|------|-------------|-------------|-------|----------------|---------------|---------------|------------|----------|
| `merge_pr` | IRREVERSIBLE | `github.merge` | **HIGH** | Destroyer-class power. Cannot be undone (GitHub merge is atomic). Requires short-TTL lease + explicit ACK. | **888_HOLD path.** All floors + F1 (NOT reversible — requires sovereign ack), F3 (witness required), F7 (Ω₀ declared), F13 (Arif holds final veto). | ① manifest resolve ② verify lease `github.merge` ③ TTL ≤ 300s ④ ack_irreversible=true ⑤ F13 path recorded | DRY_RUN (GET pr, check mergeable) → SIMULATE (show merge_method + head sha) → **STOP at SIMULATE unless ACK** → EXECUTE (PUT merge) → VERIFY (GET pr merged=true) → ROLLBACK (**NOT_AVAILABLE** — true irreversible) → RECEIPT | **REQUIRED + F13 ack recorded** |

**IRREVERSIBLE rule:** TTL ≤ 300s. ACK mandatory. No silent merge. ROLLBACK = NOT_AVAILABLE must be declared — never pretend a compensating action equals true undo.

---

## 2. Complete connector manifest (machine-readable)

```yaml
connector:
  name: github
  version: "1.0.0-canonical"
  domain: development.version_control
  protocol: https+rest
  provider: github.com
  mcp_tools:
    primary: forge_github                     # OBSERVE search/read
    mutate_proxy: forge_github_create_issue   # maps mode=create_issue → :18095
    mutate_proxy: forge_github_create_pull_request
    mutate_proxy: forge_github_push_files

  bridge:
    script: /root/A-FORGE/scripts/github_bridge.py
    port: 18095
    bind: 127.0.0.1
    unit: apa-github-bridge.service
    endpoints:
      health: GET /health     # returns: {status, verbs, scopes}
      manifest: GET /manifest # returns: verb×action_class matrix
      execute: POST /          # body: {mode, lease_id?, …params}
    enforcement:
      require_lease_for_mutate: env APA_REQUIRE_LEASE_ID  # set "1" for hard gate

  auth:
    method: personal_access_token
    sources:
      - env: GITHUB_TOKEN
      - env_file: /root/.secrets/env/github-bridge.env
      - json_file: /root/.secrets/github/token.json
    inject: "Authorization: Bearer <token>"
    never_return_to_caller: true
    never_log: true
    never_in_llm_context: true

  reflex:
    art: required_on_all_verbs
    kernel: required_on_MUTATE_and_IRREVERSIBLE
    shadow_gate: required_before_each_execute       # §8.1
    incompleteness_gate: required_before_IRREVERSIBLE # §8.2
    apa: required_on_all_verbs
    act_phases: [DRY_RUN, SIMULATE, EXECUTE, VERIFY, ROLLBACK, RECEIPT]
    vault999: required_on_MUTATE_and_IRREVERSIBLE
    vault999_optional: OBSERVE

  verbs:
    search_repos:
      mode: search_repos
      action_class: OBSERVE
      lease_scope: github.read
      requires_lease: false
      blast_radius: LOW
      api: "GET /search/repositories?q={q}"
      params: { q: string, limit: int }
      failure_modes:
        RATE_LIMITED: 403/429 → escalate, do NOT retry more than 3 times
        UNAUTHORIZED: 401 → STOP, token may be invalid
      act: { dry_run: "validate q non-empty", execute: "GET search", verify: "items is array", rollback: n/a }

    get_repo:
      mode: get_repo
      action_class: OBSERVE
      lease_scope: github.read
      requires_lease: false
      blast_radius: LOW
      api: "GET /repos/{owner}/{repo}"
      params: { owner: string, repo: string }
      failure_modes:
        NOT_FOUND: 404 → return {ok: false, reason: "repo_not_found"}
      act: { dry_run: "validate owner/repo non-empty", execute: "GET repo", verify: "has full_name" }

    list_issues:
      mode: list_issues
      action_class: OBSERVE
      lease_scope: github.read
      blast_radius: LOW
      api: "GET /repos/{owner}/{repo}/issues?state={state}"
      params: { owner, repo, state: "open|closed|all", limit }

    list_pull_requests:
      mode: list_pull_requests
      action_class: OBSERVE
      lease_scope: github.read
      blast_radius: LOW
      api: "GET /repos/{owner}/{repo}/pulls?state={state}"
      params: { owner, repo, state, limit }

    create_issue:
      mode: create_issue
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: MEDIUM
      reversible: compensating (close_issue)
      api: "POST /repos/{owner}/{repo}/issues"
      params: { owner, repo, title, body?, labels?, assignees? }
      failure_modes:
        RATE_LIMITED: escalate
        NO_LEASE: 403 → bridge returns lease required
      act:
        dry_run: GET repo exists
        simulate: hash title+body payload
        execute: POST issue
        verify: GET issues/{n}, state=open
        rollback: close_issue (compensating; not true undo)
        receipt: vault required

    close_issue:
      mode: close_issue
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: MEDIUM
      api: "PATCH /repos/{owner}/{repo}/issues/{n}"
      params: { owner, repo, issue_number }
      act:
        rollback: reopen (PATCH state=open)

    add_issue_comment:
      mode: add_issue_comment
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: LOW
      api: "POST /repos/{owner}/{repo}/issues/{n}/comments"
      params: { owner, repo, issue_number, body }

    create_pr:
      mode: create_pr
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: MEDIUM
      api: "POST /repos/{owner}/{repo}/pulls"
      params: { owner, repo, title, head, base, body?, draft: true }
      note: "default draft=true minimizes blast"

    create_or_update_file:
      mode: create_or_update_file
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: MEDIUM
      api: "PUT /repos/{owner}/{repo}/contents/{path}"
      params: { owner, repo, path, content: base64, message, branch, sha? }

    push_files:
      mode: push_files
      action_class: MUTATE
      lease_scope: github.mutate
      requires_lease: true
      blast_radius: MEDIUM
      api: "Multiple file PUTs in one commit"

    merge_pr:
      mode: merge_pr
      action_class: IRREVERSIBLE
      lease_scope: github.merge
      requires_lease: true
      requires_ack: true
      blast_radius: HIGH
      ttl_max_seconds: 300
      api: "PUT /repos/{owner}/{repo}/pulls/{n}/merge"
      params: { owner, repo, pr_number, merge_method?: "merge|squash|rebase" }
      act:
        dry_run: GET pr, check mergeable
        simulate: show merge_method + head sha; STOP here unless ACK
        execute: PUT merge
        verify: GET pr, merged=true
        rollback: NOT_AVAILABLE (true irreversible — must declare)
        receipt: vault required + F13 ack recorded
```

---

## 3. Lease matrix (capability table)

| Scope | max_action_class | Verbs allowed | Default TTL (s) | Extra Gates | Forge MCP class mapping |
|-------|------------------|---------------|-----------------|-------------|------------------------|
| **github.read** | OBSERVE | search_repos, get_repo, list_issues, list_pull_requests | 3600 | Session may apply | OBSERVE |
| **github.mutate** | MUTATE | create_issue, close_issue, add_issue_comment, create_pr, create_or_update_file, push_files, create_branch, review_pr | 3600 | F11 receipt REQUIRED · shadow gate REQUIRED | EXECUTE_REVERSIBLE |
| **github.merge** | IRREVERSIBLE | merge_pr | **300** | ACK + F13 path + incompleteness gate · no silent merge | EXECUTE_HIGH_IMPACT |

### Live A-FORGE lease chain (canonical call sequence)

```
forge_session_init(actor_id="arif", intent="APA GitHub MUTATE")
forge_agent(mode="register", agent_id="333-AGI")    # if path needs registered agent
forge_lease(
  mode="request",
  agent_id="333-AGI",
  scope=["github", "forge_github"],
  max_action_class="EXECUTE_REVERSIBLE",        # MUTATE
  ttl_seconds=3600
)
# → lease_id returned
# → MCP tool or POST :18095 with lease_id
```

For merge:
```
forge_lease(
  mode="request",
  agent_id="333-AGI",
  scope=["github", "forge_github"],
  max_action_class="EXECUTE_HIGH_IMPACT",       # IRREVERSIBLE
  ttl_seconds=300
)
# → requires ACK before actual merge dispatch
```

### Soft vs hard lease enforcement

| Layer | Behavior | Recommendation |
|-------|----------|----------------|
| Bridge (localhost) | Soft by default: warns on missing lease_id for MUTATE. Hard when `APA_REQUIRE_LEASE_ID=1`. | Set to `1` in production. |
| A-FORGE MCP (:7072) | Hard: MUTATE tools require session ownership + lease policy check. | Always hard. |
| Kernel (arifOS :8088) | Hard: no SEAL → no ACT. | Always hard. |

---

## 4. ACT phase machine (normative — applies to every APA connector verbatim)

```
                    ┌─────────────┐
                    │   ART       │  classify: action_class, blast, reversible?
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  KERNEL     │  F1-F13 floor check → SEAL?
                    └──────┬──────┘
                     no │    │ yes
                        ▼    ▼
                      STOP  APA resolve manifest + validate lease
                             │
                             ▼
              ┌──────────────────────────────┐
              │ ACT                          │
              │                              │
              │  0 ⏹ DRY_RUN                │  Validate params. Test connectivity. No mutation.
              │       ↓                      │
              │  1 ◉ SIMULATE               │  Build payload. Hash. Show what WOULD happen.
              │       ↓                      │
              │  2 ▶ EXECUTE    ──bridge──▶  │  Touch SaaS via bridge (token injected, never in LLM).
              │       ↓                      │
              │  3 ✓ VERIFY                  │  Re-read state. Check invariants. Did reality match intent?
              │       ↓                      │
              │  4 ↩ ROLLBACK (if avail)    │  Compensating action or declare NOT_AVAILABLE.
              │       ↓                      │
              │  5 💾 RECEIPT → VAULT999     │  result_sha256 + lease_id + verdict_ids → seal chain.
              └──────────────────────────────┘
```

| Phase | Must NOT | Must |
|-------|----------|------|
| **DRY_RUN** | Mutate remote state | Fail closed on bad params |
| **SIMULATE** | Persist anything | Produce payload hash + expected response shape |
| **EXECUTE** | Skip VERIFY · expose token · self-seal | Use bridge only. Inject token at bridge layer. |
| **VERIFY** | Trust EXECUTE alone | Re-read state or check response invariants |
| **ROLLBACK** | Claim full undo where impossible | Document compensating action OR `NOT_AVAILABLE` |
| **RECEIPT** | Skip for MUTATE/IRREVERSIBLE | Emit: result_sha256 + lease_id + art_class + kernel_verdict |

**STOP is lawful at any phase. STOP preserves the system.**

---

## 5. Response envelope (bridge → A-FORGE → agent — canonical shape)

```json
{
  "ok": true,
  "status": "ok",
  "mode": "create_issue",
  "action_class": "MUTATE",
  "lease_scope_hint": "github.mutate",
  "lease_id": "LCL-20260709-gh-001",
  "evidence_tags": ["DERIVED", "GITHUB_REST"],
  "confidence_cap": 0.85,
  "result": {
    "number": 561,
    "url": "https://github.com/owner/repo/issues/561",
    "html_url": "https://github.com/owner/repo/issues/561",
    "state": "open",
    "title": "APA smoke test"
  },
  "result_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "vault_anchor_material": {
    "connector": "github",
    "verb": "create_issue",
    "result_sha256": "e3b0c442...",
    "lease_id": "LCL-20260709-gh-001",
    "result_ref": "owner/repo#561"
  },
  "reflex": {
    "art_class": "MUTATE",
    "kernel_verdict": "SEAL",
    "apa_lease_valid": true,
    "act_phase": "RECEIPT",
    "act_phases_completed": ["DRY_RUN", "SIMULATE", "EXECUTE", "VERIFY", "RECEIPT"],
    "rollback": "close_issue (compensating)"
  }
}
```

**Error envelope:**

```json
{
  "ok": false,
  "status": "error",
  "mode": "merge_pr",
  "action_class": "IRREVERSIBLE",
  "error_code": "LEASE_INVALID",
  "error_message": "lease expired or scope mismatch",
  "lease_id": "LCL-expired",
  "reflex": {
    "art_class": "IRREVERSIBLE",
    "kernel_verdict": "HOLD",
    "act_phase": "STOPPED_AT_SIMULATE"
  }
}
```

---

## 6. Live deployment anchors (T1 observable)

| Component | Path / endpoint | Status |
|-----------|-----------------|--------|
| Bridge script | `/root/A-FORGE/scripts/github_bridge.py` | ✅ LIVE |
| Systemd unit | `apa-github-bridge.service` | ✅ enabled |
| Health probe | `curl -s http://127.0.0.1:18095/health` | ✅ responding |
| Manifest | `curl -s http://127.0.0.1:18095/manifest` | ✅ verb×class matrix |
| Execute OBSERVE | `POST :18095 {"mode":"search_repos","q":"..."}` | ✅ live |
| Execute MUTATE | `POST :18095 {"mode":"create_issue","lease_id":"...","owner":"...","repo":"...","title":"..."}` | ✅ live |
| A-FORGE MCP | `:7072` — `forge_github*` tools | ✅ registered |
| Secrets | `/root/.secrets/github/token.json` or env | ✅ never in logs |

---

## 7. VAULT999 receipt schema (what gets sealed)

```json
{
  "connector": "github",
  "verb": "create_issue",
  "action_class": "MUTATE",
  "actor_id": "333-AGI",
  "session_id": "SEAL-session-id",
  "lease_id": "LCL-20260709-gh-001",
  "constitutional_chain_id": "cc-gh-001",
  "result_ref": "owner/repo#561",
  "result_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "art_class": "MUTATE",
  "kernel_verdict": "SEAL",
  "act_phases_completed": ["DRY_RUN", "SIMULATE", "EXECUTE", "VERIFY", "RECEIPT"],
  "rollback_available": "compensating (close_issue)",
  "timestamp": "2026-07-09T04:00:00Z"
}
```

For IRREVERSIBLE:
```json
{
  "rollback_available": "NOT_AVAILABLE",
  "f13_ack_recorded": true,
  "incompleteness_gate_passed": true,
  "incompleteness_declared_unknowns": ["merge conflict on target branch", "CI may fail post-merge"]
}
```

---

## 8. Mandatory pre-execution gates (compile into every connector)

### 8.1 Shadow Gate (MANDATORY before any MUTATE/IRREVERSIBLE execute)

From the A-FORGE constitutional shadow framework. Run silently before dispatch:

```
SHADOW GATE (pre-execute):
  □ Am I rationalizing this execution? (Reward hacking)
  □ Am I deferring to the requester's confidence instead of the lease scope? (Sycophancy)
  □ Am I hiding uncertainty about blast radius? (Deceptive alignment)
  □ Am I refusing because of fear, not facts? (Over-refusal)
  □ Am I padding the call to look thorough? (Compute-as-regulation)
  □ Am I crossing into judgment (SEAL/HOLD/VOID) that belongs to arifOS? (Identity drift)
  □ Am I performing compliance rather than verifying it? (Shadow performance)

If ANY checked → HALT. Return to plan stage.
```

### 8.2 Incompleteness Gate (MANDATORY before IRREVERSIBLE)

From the A-FORGE Incompleteness Thesis. Run before merge_pr dispatch:

```
INCOMPLETENESS GATE (pre-IRREVERSIBLE):
  □ What do I NOT know about this merge?
  □ What could go wrong that I cannot see?
  □ Am I treating constraints as choice, or as chains?
  □ Am I claiming completeness about the merge outcome?

  If I cannot name at least TWO unknowns: HALT (Iblis trap).
  If I claim completeness: HALT + FLAG (structurally ungovernable).
```

---

## 9. Clone checklist — hard gate for ANY new APA connector

Every new connector **MUST** ship all 7 gates. If ANY is missing → **not APA**. It is ad-hoc tooling.

| # | Gate | What to provide | Example (Slack) |
|---|------|-----------------|-----------------|
| **1** | §0 Bridge Theorem | ART→KERNEL→APA→ACT→VAULT999 table + five irreducible steps | Copy verbatim, change connector name |
| **2** | §1 Verb × ARC matrix | Every verb with art_class, kernel_checks, apa_express, act_phases, vault999 | `send_message` / `list_channels` / `archive_channel` |
| **3** | §2 Full YAML manifest | Connector metadata + every verb with params + failure_modes + act rules | Slack manifest with `chat.postMessage` etc. |
| **4** | §3 Lease matrix | read / mutate / irreversible scopes with TTL + extra gates | `slack.read` / `slack.mutate` / `slack.archive` |
| **5** | §4 ACT phase machine | DRY_RUN→SIMULATE→EXECUTE→VERIFY→ROLLBACK→RECEIPT (explicit per verb) | `send_message`: rollback = delete (if < 1min) or NOT_AVAILABLE |
| **6** | §5 Response envelope | ok/error shape with result_sha256 + vault_anchor_material + reflex block | Identical shape, different connector name |
| **7** | Localhost bridge | Script + systemd unit + health + manifest + smoke (OBSERVE→MUTATE+lease→receipt) | `slack_bridge.py` + `apa-slack-bridge.service` |

### Naming discipline (enforced)

| Layer | Name form | Example |
|-------|-----------|---------|
| APA verb | `snake_case` mode on bridge | `create_issue`, `send_message` |
| Lease scope | `<connector>.read\|mutate\|<irrev>` | `github.mutate`, `slack.archive` |
| MCP tool | `forge_<connector>` or `forge_<connector>_<verb>` | `forge_github_create_issue` |
| Bridge unit | `apa-<connector>-bridge.service` | `apa-slack-bridge.service` |
| Connector doc | `APA-<NAME>-SOVEREIGN-CONNECTOR.md` | `APA-SLACK-SOVEREIGN-CONNECTOR.md` |

---

## 10. Why GitHub is the canonical example

| Property | Proof |
|----------|-------|
| OBSERVE live | `search_repos` / `get_repo` smoke on :18095 |
| MUTATE live | `create_issue` / `close_issue` proven against real repos |
| IRREVERSIBLE defined | `merge_pr` with short TTL (300s) + ACK gate |
| Open protocol | HTTPS REST — no vendor MCP custody, no OAuth cloud gatekeeper |
| Secret custody | PAT on VPS only — never returned, never logged, never in LLM |
| Reflex complete | ART class → kernel F1-F13 → APA lease+manifest → ACT 6-phase → VAULT999 receipt |
| Bridge self-contained | ~500 lines, stdlib+requests, one systemd unit, localhost only |
| All three action classes | OBSERVE + MUTATE + IRREVERSIBLE in one connector |

---

## 11. Anti-patterns — reject as non-APA (with real examples)

| Anti-pattern | Why It Violates APA | Example |
|-------------|---------------------|---------|
| **Skip ART** | Raw tool call without power classification | Agent calls `requests.post("https://api.github.com/...")` directly — no art_class, no blast check |
| **Skip KERNEL** | Lease without judgment on HIGH blast | Agent self-issues a lease and dispatches merge without arif_judge — sovereignty bypassed |
| **Bridge self-SEALs** | Bridge writes VAULT999 directly | Bridge calls `arif_seal` — bridge is ACT layer, not memory layer |
| **Token in LLM context** | OAuth/PAT passed through agent | `GITHUB_TOKEN` appears in agent prompt or response — F12 injection violation |
| **OAuth custody** | Token lives on third-party cloud | Composio holds your GitHub token — APA requires token on sovereign VPS only |
| **No RECEIPT on MUTATE** | Mutation without witness | `create_issue` succeeds but nothing is sealed — F11 audit gap |
| **Merge without ACK** | IRREVERSIBLE without human gate | Agent merges PR automatically — F1 + F13 violated |
| **846-tool catalog** | Tool explosion as "manifest" | Registering every GitHub REST endpoint as a separate MCP tool — F4 CLARITY ΔS > 0 |
| **Rollback claimed where impossible** | False reversibility | "merge_pr rollback = revert commit" — reverting is a NEW commit, not true undo |
| **Bridge that judges** | Bridge returns SEAL/HOLD | Bridge says `{"verdict": "SEAL"}` — only arifOS judges |

---

## 12. One-line seal

**APA-GitHub is the complete reflex arc made concrete:**
ART classifies · KERNEL judges · APA leases and manifests · ACT phases touch GitHub · VAULT999 remembers.

All future sovereign connectors are **isomorphic copies of this file.** Only the protocol adapter (bridge) and verb names change. The reflex arc does not.

---

**DITEMPA BUKAN DIBERI** — the constitutional reflex is forged into the connector, not hoped into the agent.
