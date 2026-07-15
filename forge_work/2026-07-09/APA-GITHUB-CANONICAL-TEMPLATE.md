# APA-GitHub — Canonical Connector Template

> **Short form.** Full reflex-arc canon (ART→KERNEL→APA→ACT→VAULT999) is:  
> **`APA-GITHUB-SOVEREIGN-CONNECTOR.md`** — clone that for Slack/Drive/Notion.  
> **Forged:** 2026-07-09 · **Bridge:** `scripts/github_bridge.py` :18095  
> **Status:** PRODUCTION TEMPLATE · service `apa-github-bridge`

Copy this pattern for email, calendar, Slack, Drive — same shape, different protocol.

---

## 1. Verb matrix (action class)

| Verb | Action class | Lease scope | GitHub API |
|------|--------------|-------------|------------|
| `search_repos` | OBSERVE | `github.read` (optional) | `GET /search/repositories` |
| `get_repo` | OBSERVE | `github.read` | `GET /repos/{o}/{r}` |
| `list_issues` | OBSERVE | `github.read` | `GET /repos/{o}/{r}/issues` |
| `list_pull_requests` | OBSERVE | `github.read` | `GET /repos/{o}/{r}/pulls` |
| `create_issue` | MUTATE | `github.mutate` **required** | `POST …/issues` |
| `close_issue` | MUTATE | `github.mutate` **required** | `PATCH …/issues/{n}` |
| `create_pr` | MUTATE | `github.mutate` | `POST …/pulls` |
| `merge_pr` | **IRREVERSIBLE** | `github.merge` short TTL + **ACK** | `PUT …/pulls/{n}/merge` |

**Blast radius rule:**

- OBSERVE → no lease at APA layer (session/transport may still apply on MCP)  
- MUTATE → lease `github.mutate`  
- IRREVERSIBLE → lease `github.merge` TTL≤300s + `ack_irreversible` + F13 path  

---

## 2. Lease scopes (APA-typed capabilities)

```yaml
scopes:
  github.read:
    verbs: [search_repos, get_repo, list_issues, list_pull_requests]
    max_action_class: OBSERVE
  github.mutate:
    verbs: [create_issue, close_issue, create_pr, add_issue_comment, …]
    max_action_class: MUTATE
    ttl_default: 3600
  github.merge:
    verbs: [merge_pr]
    max_action_class: IRREVERSIBLE
    ttl_default: 300
    requires_ack: true
```

### Example lease (illustrative)

```yaml
lease:
  lease_id: "LCL-…"           # issued by forge_lease / arifOS
  actor_id: "arif"
  scope:
    - github
    - forge_github
    - github.mutate          # or map to tool names A-FORGE already uses
  max_action_class: MUTATE
  ttl_seconds: 3600
  session_id: "SEAL-…"
```

Map to live A-FORGE call:

```
forge_lease(
  mode="request",
  agent_id="arif",
  scope=["github", "forge_github"],
  max_action_class="EXECUTE_REVERSIBLE",  # MUTATE
  ttl_seconds=3600
)
```

For merge, use short TTL + higher class (`EXECUTE_HIGH_IMPACT` / IRREVERSIBLE) + human ack.

---

## 3. Bridge contract

**Path:** `/root/A-FORGE/scripts/github_bridge.py` (not `bridges/` — real tree)  
**Unit:** `apa-github-bridge.service`  
**Port:** `127.0.0.1:18095`

| Endpoint | Role |
|----------|------|
| `GET /health` | READY + verb list + scope map |
| `GET /manifest` | verb × action_class |
| `POST /` body `{ "mode", "lease_id"?, …params }` | execute |

**Auth:** `GITHUB_TOKEN` env or `/root/.secrets/env/github-bridge.env` or `/root/.secrets/github/token.json`  
**Never** log or return token.

**Response envelope (canonical):**

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
  "result": { "number": 561, "url": "https://…" },
  "result_sha256": "…",
  "vault_anchor_material": {
    "connector": "github",
    "verb": "create_issue",
    "result_sha256": "…",
    "lease_id": "LCL-…"
  }
}
```

VAULT999 **seal** is A-FORGE/arifOS responsibility using `vault_anchor_material` — bridge does not self-seal.

---

## 4. MCP surface (A-FORGE)

Already registered (TS):

| MCP tool | Class | Maps toward |
|----------|-------|-------------|
| `forge_github` | OBSERVE/PR modes | search + pr list/get |
| `forge_github_search_repos` | OBSERVE | search_repos |
| `forge_github_create_issue` | MUTATE | create_issue |
| `forge_github_create_pull_request` | MUTATE | create_pr |
| … | | |

**Template for a thin proxy tool (future/optional):**

```
name: forge_github_create_issue
required: [lease_id, owner, repo, title]
→ validate lease scope github.mutate
→ POST http://127.0.0.1:18095  { mode: create_issue, lease_id, … }
→ attach vault receipt id from arif_seal / recordReceipt
```

Input schema (normative):

```json
{
  "type": "object",
  "properties": {
    "lease_id": { "type": "string" },
    "owner": { "type": "string" },
    "repo": { "type": "string" },
    "title": { "type": "string" },
    "body": { "type": "string" }
  },
  "required": ["lease_id", "owner", "repo", "title"]
}
```

---

## 5. Production checklist

- [x] Bridge live on :18095  
- [x] `apa-github-bridge.service` enabled  
- [x] Token via EnvironmentFile (not unit hardcode)  
- [x] OBSERVE + MUTATE + IRREVERSIBLE verbs in one adapter  
- [x] APA envelope with `result_sha256`  
- [ ] Optional: hard `APA_REQUIRE_LEASE_ID=1` on bridge for MUTATE  
- [ ] Optional: single MCP tool `forge_github_apa` proxying all modes to :18095  
- [ ] Email/Calendar clone this file structure when App Passwords land  

---

## 6. Clone recipe (next connector)

1. Copy this doc → `APA-<NAME>-CANONICAL-TEMPLATE.md`  
2. Copy `github_bridge.py` → `<name>_bridge.py`; swap HTTP paths for protocol  
3. systemd `apa-<name>-bridge.service`  
4. Manifest verbs + lease scopes  
5. MCP register + STATELESS only for OBSERVE R0  
6. Smoke: health → OBSERVE → MUTATE+lease  

---

## 7. Smoke (localhost)

```bash
# Health
curl -s http://127.0.0.1:18095/health | jq .

# OBSERVE
curl -s -X POST http://127.0.0.1:18095 \
  -H 'Content-Type: application/json' \
  -d '{"mode":"search_repos","q":"ComposioHQ/composio","limit":3}' | jq .

# MUTATE (needs real lease_id from forge_lease for production governance)
curl -s -X POST http://127.0.0.1:18095 \
  -H 'Content-Type: application/json' \
  -d '{"mode":"create_issue","lease_id":"LCL-…","owner":"…","repo":"…","title":"APA smoke","body":"…"}'
```

---

**DITEMPA BUKAN DIBERI** — first fully shaped APA connector; all others inherit this geometry.
