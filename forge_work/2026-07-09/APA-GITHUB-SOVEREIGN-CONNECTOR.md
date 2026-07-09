# APA-GitHub Sovereign Connector — Canonical Reflex-Arc Example

> **THIS IS THE TEMPLATE ALL FUTURE BRIDGES MUST FOLLOW.**  
> Slack · Drive · Notion · Sheets · any SaaS — same arc, different protocol adapter.  
> **Forged:** 2026-07-09 · **Live bridge:** `scripts/github_bridge.py` · **Port:** `127.0.0.1:18095`  
> **Unit:** `apa-github-bridge.service` · **Status:** PRODUCTION TEMPLATE  
> **Companion:** `APA-GITHUB-CANONICAL-TEMPLATE.md` (short form) · `APA-AFORGE-ARCHITECTURE-DERIVATION.md`

---

## 0. Bridge Theorem (what APA operationalizes)

```
classify before judgment,
constrain after judgment.
```

| Stage | Name | Job |
|-------|------|-----|
| **ART** | Pre-kernel | Classify power (action class, blast radius) **before** it approaches judgment |
| **KERNEL** | F1–F13 | Decide whether power may flow (SEAL / HOLD / VOID / SABAR) |
| **APA** | Protocol | Express authorized power to external systems (manifest · lease · bridge) |
| **ACT** | Post-kernel | Touch reality under phases (dry-run → simulate → execute → verify → rollback → receipt) |
| **VAULT999** | Memory | Remember immutably |

APA is the **formal language of constraint for SaaS** after the kernel has spoken.

```
ART ──classify──▶ KERNEL ──judge──▶ APA ──express──▶ ACT ──touch──▶ VAULT999
                     │                  │                │
                  F1–F13            lease+manifest    bridge+MCP
                     │                  │                │
                  STOP lawful        STOP lawful      STOP lawful
```

---

## 1. Full reflex arc for one verb (create_issue)

### 1.1 ART — classify power

Before any judge call:

| Field | Value |
|-------|-------|
| Intent | Open issue on `owner/repo` |
| Verb | `create_issue` |
| **Action class** | **MUTATE** |
| Blast radius | MEDIUM (public if repo public) |
| Reversible? | Partial (close_issue possible; not true undo) |
| External side effect | Yes — GitHub.com |
| Secret exposure risk | Low if bridge inject-only |
| Requires lease | **Yes** — `github.mutate` |
| Requires human ack | No (unless policy tightens) |

ART output: `action_class=MUTATE`, `lease_scope=github.mutate`, `proceed_to_kernel=true`.

If ART cannot classify → **STOP** (unknown power does not approach judgment).

### 1.2 KERNEL — F1–F13 judgment

| Floor | Check on create_issue |
|-------|------------------------|
| F1 AMANAH | Reversible-enough? close path exists; no force-push |
| F2 TRUTH | Title/body not fabricated as sealed fact |
| F3 WITNESS | Public issue may need external witness if HIGH stakes |
| F4 CLARITY | Thin verb, not 846-tool dump |
| F5 PEACE² | No harassment content |
| F7 HUMILITY | confidence_cap ≤ 0.85 on MUTATE |
| F11 AUDIT | Receipt required post-ACT |
| F12 INJECTION | Issue body is data, not authority |
| F13 SOVEREIGN | Actor bound; 888 can HOLD |

Verdicts: **SEAL** (power may flow) · **HOLD** · **VOID** · **SABAR**.  
No SEAL → APA and ACT do not run.

### 1.3 APA — express power

1. Load connector manifest (this file §2).  
2. Resolve verb → lease scope `github.mutate`.  
3. Require live lease: `forge_lease` / arifOS mint, scope includes github mutate tools, TTL ok.  
4. Bind `session_id` + `actor_id`.  
5. Dispatch envelope to bridge with `mode=create_issue` + `lease_id`.

### 1.4 ACT — touch reality (phased)

| Phase | Name | GitHub create_issue |
|-------|------|---------------------|
| **0** | DRY_RUN | Validate params; optional `GET /repos/{o}/{r}` existence; no POST |
| **1** | SIMULATE | Build issue payload; hash body; show what would POST |
| **2** | EXECUTE | Bridge `POST /repos/{o}/{r}/issues` with injected PAT |
| **3** | VERIFY | Response has `number` + `html_url`; GET issue once to confirm open |
| **4** | ROLLBACK | If policy allows: `close_issue` as compensating action (not true unsend) |
| **5** | RECEIPT | `result_sha256` + lease_id + vault_anchor_material → VAULT999 / chain_hash |

**STOP is lawful** at any phase. STOP preserves the system.

### 1.5 VAULT999 — remember

```json
{
  "connector": "github",
  "verb": "create_issue",
  "action_class": "MUTATE",
  "actor_id": "arif",
  "session_id": "SEAL-…",
  "lease_id": "LCL-…",
  "result_ref": "owner/repo#N",
  "result_sha256": "…",
  "art_class": "MUTATE",
  "kernel_verdict": "SEAL",
  "act_phases_completed": ["DRY_RUN", "SIMULATE", "EXECUTE", "VERIFY", "RECEIPT"],
  "timestamp": "ISO-8601"
}
```

---

## 2. Connector manifest (complete)

```yaml
connector:
  name: github
  version: "1.0.0-canonical"
  domain: development.version_control
  protocol: https+rest
  provider: github.com
  mcp_tools:
    primary: forge_github
    mutate: [forge_github_create_issue, forge_github_create_pull_request, …]
  bridge:
    script: /root/A-FORGE/scripts/github_bridge.py
    port: 18095
    bind: 127.0.0.1
    unit: apa-github-bridge.service
  auth:
    method: personal_access_token
    sources:
      - env: GITHUB_TOKEN
      - file: /root/.secrets/env/github-bridge.env
      - file: /root/.secrets/github/token.json
    inject: "Authorization: Bearer <token>"
    never_return_to_caller: true
    never_log: true

reflex:
  art: required
  kernel: required
  apa: required
  act_phases: [DRY_RUN, SIMULATE, EXECUTE, VERIFY, ROLLBACK, RECEIPT]
  vault999: required_on_MUTATE_and_IRREVERSIBLE

verbs:
  search_repos:
    mode: search_repos
    action_class: OBSERVE
    lease_scope: github.read
    requires_lease: false
    blast_radius: LOW
    api: "GET /search/repositories"
    params: { q: string, limit: int }
    act:
      dry_run: validate query non-empty
      execute: GET search
      verify: items is array
      rollback: n/a

  get_repo:
    mode: get_repo
    action_class: OBSERVE
    lease_scope: github.read
    requires_lease: false
    blast_radius: LOW
    api: "GET /repos/{owner}/{repo}"
    params: { owner: string, repo: string }

  list_issues:
    mode: list_issues
    action_class: OBSERVE
    lease_scope: github.read
    requires_lease: false
    blast_radius: LOW
    api: "GET /repos/{owner}/{repo}/issues"
    params: { owner, repo, state: open|closed|all, limit: int }

  list_pull_requests:
    mode: list_pull_requests
    action_class: OBSERVE
    lease_scope: github.read
    requires_lease: false
    blast_radius: LOW
    api: "GET /repos/{owner}/{repo}/pulls"
    params: { owner, repo, state, limit }

  create_issue:
    mode: create_issue
    action_class: MUTATE
    lease_scope: github.mutate
    requires_lease: true
    blast_radius: MEDIUM
    irreversible: false
    api: "POST /repos/{owner}/{repo}/issues"
    params: { owner, repo, title, body?, labels?, assignees? }
    act:
      dry_run: GET repo exists
      simulate: hash title+body
      execute: POST issue
      verify: GET issues/{n} state=open
      rollback: close_issue (compensating)
      receipt: vault required

  close_issue:
    mode: close_issue
    action_class: MUTATE
    lease_scope: github.mutate
    requires_lease: true
    blast_radius: MEDIUM
    api: "PATCH /repos/{owner}/{repo}/issues/{n}"
    params: { owner, repo, issue_number }

  create_pr:
    mode: create_pr
    action_class: MUTATE
    lease_scope: github.mutate
    requires_lease: true
    blast_radius: MEDIUM
    api: "POST /repos/{owner}/{repo}/pulls"
    params: { owner, repo, title, head, base, body?, draft: true }
    note: "default draft=true (lower blast)"

  merge_pr:
    mode: merge_pr
    action_class: IRREVERSIBLE
    lease_scope: github.merge
    requires_lease: true
    requires_ack: true
    blast_radius: HIGH
    ttl_max_seconds: 300
    api: "PUT /repos/{owner}/{repo}/pulls/{n}/merge"
    params: { owner, repo, pr_number, merge_method? }
    act:
      dry_run: GET pr mergeable
      simulate: show merge_method + head sha
      execute: PUT merge
      verify: GET pr merged=true
      rollback: NOT AVAILABLE (true irreversible)
      receipt: vault required + F13 ack recorded
```

---

## 3. Lease matrix (capability table)

| Scope | max_action_class | Verbs allowed | Default TTL | Extra gates |
|-------|------------------|---------------|-------------|-------------|
| **github.read** | OBSERVE | search_repos, get_repo, list_issues, list_pull_requests | 3600 | Session may apply |
| **github.mutate** | MUTATE | create_issue, close_issue, create_pr, add_issue_comment, create_branch, create_or_update_file, push_files, review_pr | 3600 | F11 receipt |
| **github.merge** | IRREVERSIBLE | merge_pr | **300** | ACK + F13; no silent merge |

### Live A-FORGE mapping

```
forge_session_init(actor_id, intent)
forge_agent(mode=register)            # if lease path needs registered agent
forge_lease(
  mode=request,
  agent_id=…,
  scope=["github", "forge_github"],   # tool-name scopes used by runtime
  max_action_class=EXECUTE_REVERSIBLE | …,
  ttl_seconds=300|3600
)
# then MCP tool or POST :18095 with lease_id
```

| APA scope | forge_lease max_action_class (approx) |
|-----------|----------------------------------------|
| github.read | OBSERVE / omit lease |
| github.mutate | EXECUTE_REVERSIBLE / MUTATE |
| github.merge | EXECUTE_HIGH_IMPACT / IRREVERSIBLE |

### Soft vs hard lease enforcement

| Layer | Behavior |
|-------|----------|
| Bridge | Soft: warns/allows missing lease_id unless `APA_REQUIRE_LEASE_ID=1` |
| A-FORGE MCP | Hard: MUTATE tools require session ownership + lease policy |
| Kernel | Hard: no SEAL → no ACT |

---

## 4. ACT phase machine (normative for all APA connectors)

```
                    ┌─────────────┐
                    │   ART       │  classify verb
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   KERNEL    │  SEAL?
                    └──────┬──────┘
                     no │    │ yes
                        ▼    ▼
                      STOP  APA resolve lease
                             │
                             ▼
              ┌──────────────────────────────┐
              │ ACT                          │
              │  0 DRY_RUN                   │
              │  1 SIMULATE                  │
              │  2 EXECUTE  ──bridge──▶ SaaS │
              │  3 VERIFY                    │
              │  4 ROLLBACK (if available)   │
              │  5 RECEIPT → VAULT999        │
              └──────────────────────────────┘
```

| Phase | Must not | Must |
|-------|----------|------|
| DRY_RUN | Mutate remote | Fail closed on bad params |
| SIMULATE | Persist | Produce payload hash |
| EXECUTE | Skip VERIFY | Use bridge only (no token in LLM) |
| VERIFY | Trust EXECUTE alone | Re-read or check response invariants |
| ROLLBACK | Claim full undo if impossible | Document compensating action or `NOT_AVAILABLE` |
| RECEIPT | Skip for MUTATE | Emit result_sha256 + lease_id + verdict ids |

**IRREVERSIBLE (merge_pr):** ROLLBACK = `NOT_AVAILABLE`. ACT must stop at SIMULATE unless ACK present.

---

## 5. Response envelope (bridge → A-FORGE → agent)

```json
{
  "ok": true,
  "status": "ok",
  "mode": "create_issue",
  "action_class": "MUTATE",
  "lease_scope_hint": "github.mutate",
  "lease_id": "LCL-…",
  "evidence_tags": ["DERIVED", "GITHUB_REST"],
  "confidence_cap": 0.85,
  "result": { "number": 561, "url": "https://github.com/…/issues/561" },
  "result_sha256": "…",
  "vault_anchor_material": {
    "connector": "github",
    "verb": "create_issue",
    "result_sha256": "…",
    "lease_id": "LCL-…"
  },
  "reflex": {
    "art_class": "MUTATE",
    "kernel_verdict": "SEAL",
    "act_phase": "RECEIPT"
  }
}
```

---

## 6. Live deployment anchors (T1)

| Component | Path / endpoint |
|-----------|-----------------|
| Bridge script | `/root/A-FORGE/scripts/github_bridge.py` |
| Systemd | `apa-github-bridge.service` |
| Health | `GET http://127.0.0.1:18095/health` |
| Manifest | `GET http://127.0.0.1:18095/manifest` |
| Execute | `POST http://127.0.0.1:18095` `{"mode","lease_id?",…}` |
| A-FORGE MCP | `:7072` `forge_github*` tools |
| Secrets | env file / GITHUB_TOKEN — never in chat |

---

## 7. Forced pattern for Slack / Drive / Notion / …

Every new connector **MUST** ship:

1. **§0 Bridge Theorem** statement (ART → KERNEL → APA → ACT → VAULT999)  
2. **§2 Full manifest** with action_class + lease_scope + act phases per verb  
3. **§3 Lease matrix** (read / mutate / irreversible scopes)  
4. **§4 ACT phase machine** (including ROLLBACK = NOT_AVAILABLE where true)  
5. **§5 Envelope** with result_sha256 + vault_anchor_material  
6. **Localhost bridge** + systemd `apa-*-bridge`  
7. **Smoke:** health → OBSERVE → MUTATE+lease → receipt  

If any of 1–7 is missing → **not APA**. It is ad-hoc tooling.

### Naming discipline

| Layer | Name form |
|-------|-----------|
| APA verb | `snake_case` mode on bridge |
| Lease scope | `<connector>.read\|mutate\|merge` |
| MCP tool | `forge_<connector>` or `forge_<connector>_<verb>` |
| Unit | `apa-<connector>-bridge.service` |

---

## 8. Why GitHub is the canonical example

| Property | Proof |
|----------|--------|
| OBSERVE live | search_repos / get_repo smoke on :18095 |
| MUTATE live | create_issue / close_issue proven against real repos |
| IRREVERSIBLE defined | merge_pr with short TTL + ACK |
| Open protocol | HTTPS REST (not vendor MCP custody) |
| Secret custody | PAT local; never returned |
| Reflex complete | ART class → kernel floors → APA lease → ACT phases → vault material |

Email/Calendar clone this document structure; only protocol adapter and verb names change.

---

## 9. Anti-patterns (reject as non-APA)

- Skip ART → raw tool call  
- Skip KERNEL → lease without judgment on high blast  
- Bridge that self-SEALs VAULT999  
- OAuth token in LLM context  
- “Production” without RECEIPT phase on MUTATE  
- Merge without ACK  
- 846-tool catalog as “manifest”  

---

## 10. One-line seal

**APA-GitHub is the complete reflex arc made concrete:**  
ART classifies · KERNEL judges · APA leases and manifests · ACT phases touch GitHub · VAULT999 remembers.

All future sovereign connectors are **isomorphic copies** of this file.

---

**DITEMPA BUKAN DIBERI** — the reflex is forged into the connector, not hoped into the agent.
