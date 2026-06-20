# A-FORGE Gateway Tool Contracts v1.0

**Status:** DRAFT  
**Date:** 2026-06-16  
**Authority:** arifOS constitutional kernel, F13 sovereign  
**Scope:** P1 MCP internalization — replace raw external MCP calls with kernel-governed A-FORGE gateway tools.  
**Prerequisite:** ADR-001 kernel-issued A-FORGE leases must be implemented before any MUTATE-class gateway may execute.

---

## 1. Contract Template

Every gateway tool contract contains:

| Field | Meaning |
|-------|---------|
| `tool` | Canonical A-FORGE tool name |
| `replaces` | External MCP(s) / raw API this gateway replaces |
| `action_class` | OBSERVE / PLAN / MUTATE |
| `lease_required` | True if tool requires a kernel-issued A-FORGE lease |
| `hold_triggers` | Conditions that force 888_HOLD |
| `input_schema` | Pydantic v2 / Zod v4 shape |
| `output_schema` | Pydantic v2 / Zod v4 shape |
| `receipt` | What gets written to VAULT999 |
| `fallback` | Behavior when external MCP is unreachable |

---

## 2. Research & Search Gateways

### 2.1 `forge_research`

**Replaces:** Perplexity, Tavily, Exa, Meyhem  
**Action class:** OBSERVE  
**Lease required:** No (read-only external query)  
**Hold triggers:**
- Query targets sovereign identity, biometrics, legal proceedings, or private individuals
- Query requests investment/trading advice without WEALTH routing
- Query requests medical/psychological diagnosis without WELL routing

**Input schema:**
```json
{
  "query": "string (required, max 500 chars)",
  "depth": "enum: quick | standard | deep (default: standard)",
  "sources": ["enum: web | news | academic | docs | all (default: all)"],
  "time_horizon": "enum: any | day | week | month | year (default: any)",
  "max_results": "integer (1-50, default: 10)",
  "include_citations": "boolean (default: true)",
  "request_id": "string (UUID, required for receipt)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "answer": "string",
  "citations": [
    {"title": "string", "url": "string", "source": "string", "date": "string|null"}
  ],
  "confidence": "enum: high | medium | low",
  "gaps": ["string"],
  "receipt_id": "string (VAULT999 pointer)"
}
```

**Receipt:** query, provider used, citation URLs, confidence, gaps  
**Fallback:** Return `confidence: low` with explicit gaps; do not synthesize ungrounded answers.

---

### 2.2 `forge_search`

**Replaces:** Brave Search, web_search  
**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Search query is PII, credential, or secret-like
- Search intended to enumerate infrastructure, vulnerabilities, or private assets

**Input schema:**
```json
{
  "query": "string (required, max 400 chars)",
  "count": "integer (1-20, default: 10)",
  "freshness": "enum: any | day | week | month | year (default: any)",
  "safesearch": "enum: off | moderate | strict (default: moderate)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "results": [
    {"title": "string", "url": "string", "snippet": "string", "date": "string|null"}
  ],
  "provider": "string",
  "receipt_id": "string"
}
```

**Receipt:** query, result URLs, provider  
**Fallback:** Empty results with explicit provider failure message.

---

### 2.3 `forge_docs_lookup`

**Replaces:** Context7  
**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Request asks for proprietary/internal docs not in indexed corpus
- Request includes credential or secret patterns

**Input schema:**
```json
{
  "query": "string (required)",
  "corpus": "enum: arifos | geox | wealth | well | aforge | cloudflare | workers | all (default: all)",
  "max_results": "integer (1-20, default: 5)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "results": [
    {"title": "string", "source": "string", "content": "string", "score": "number"}
  ],
  "receipt_id": "string"
}
```

**Receipt:** query, corpus, source identifiers, scores  
**Fallback:** Empty results; surface index status.

---

## 3. Browser Gateways

All `forge_browser_*` tools replace Playwright-MCP. They are OBSERVE-class only. No MUTATE-class browser actions are permitted through A-FORGE without an explicit 888_HOLD and human approval.

### 3.1 `forge_browser_navigate`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- URL is private/internal/admin endpoint not on whitelist
- URL contains credential tokens, session IDs, or auth params
- URL is a file:// or localhost non-public port

**Input schema:**
```json
{
  "url": "string (required, must be http/https)",
  "wait_until": "enum: load | domcontentloaded | networkidle (default: networkidle)",
  "timeout_ms": "integer (1000-30000, default: 15000)",
  "request_id": "string (UUID, required)",
  "task_context": {
    "task": "string (required) — trusted agent task authority (CONTEXT B)",
    "expected_outcome": "string (optional)",
    "source": "enum: agent | user | kernel (default: agent)"
  },
  "page_context": {
    "url": "string (required) — untrusted page evidence (CONTEXT A)",
    "origin_domain": "string (required)",
    "snippet": "string (optional)"
  }
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "url": "string",
  "title": "string",
  "status": "integer",
  "receipt_id": "string",
  "origin_domain": "string|null",
  "page_authority_tier": "enum: task_directed | untrusted_evidence",
  "task_aligned": "boolean"
}
```

**Receipt:** URL, final URL, title, HTTP status, task_context summary, page_origin

**Injection sentinel:** Before forwarding to Playwright MCP, the call is checked by `browserInjectionSentinel`. Missing `task_context`, unknown page origin, or mismatch between task and page content returns `HOLD` or `VOID`. See [Browser Rights Charter](../docs/governance/BROWSER_RIGHTS_CHARTER.md).

---

### 3.2 `forge_browser_click`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Target selector matches input[type=password], input[name*=token], etc.
- Click would trigger download/submit/confirmation outside read scope

**Input schema:**
```json
{
  "selector": "string (required, CSS selector)",
  "button": "enum: left | right | middle (default: left)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "clicked": "boolean",
  "new_url": "string|null",
  "receipt_id": "string"
}
```

**Receipt:** selector, button, new_url

---

### 3.3 `forge_browser_type`

**Action class:** OBSERVE (read-only form exploration)  
**Lease required:** No  
**Hold triggers:**
- Selector matches password, credit card, SSN, token, secret fields
- Text appears credential-like

**Input schema:**
```json
{
  "selector": "string (required, CSS selector)",
  "text": "string (required, max 1000 chars)",
  "submit": "boolean (default: false)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "typed": "boolean",
  "submitted": "boolean",
  "receipt_id": "string"
}
```

**Receipt:** selector, submitted flag, text length (not content if sensitive)

---

### 3.4 `forge_browser_screenshot`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Page contains sensitive dashboard, PII, credentials, or secrets
- Screenshot requested of non-public/admin page

**Input schema:**
```json
{
  "selector": "string|null (CSS selector, default: full page)",
  "full_page": "boolean (default: false)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "image_base64": "string (PNG)",
  "mime_type": "image/png",
  "receipt_id": "string"
}
```

**Receipt:** URL at screenshot time, selector, dimensions

---

### 3.5 `forge_browser_extract_text`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Extract targets a page known to contain PII/secrets

**Input schema:**
```json
{
  "selector": "string|null (default: body)",
  "max_chars": "integer (default: 50000)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "text": "string",
  "element_count": "integer",
  "receipt_id": "string"
}
```

**Receipt:** URL, selector, text length

---

### 3.6 `forge_browser_evaluate_js`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Script contains network requests, storage access, cookie reads, eval, fetch, XHR
- Script targets auth/session/login flows

**Input schema:**
```json
{
  "script": "string (required, max 2000 chars)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "result": "any",
  "receipt_id": "string"
}
```

**Receipt:** script hash (SHA-256), result type, URL

---

## 4. GitHub Gateways

All `forge_github_*` tools replace GitHub-MCP. OBSERVE-class tools require no lease. MUTATE-class tools require a kernel-issued A-FORGE lease and are 888_HOLD by default.

### 4.1 `forge_github_search_code`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Query targets private repos without explicit scope
- Query includes credential/secret patterns

**Input schema:**
```json
{
  "q": "string (required, GitHub search syntax)",
  "per_page": "integer (1-100, default: 30)",
  "page": "integer (default: 1)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "total_count": "integer",
  "items": [
    {"repo": "string", "path": "string", "url": "string", "snippet": "string"}
  ],
  "receipt_id": "string"
}
```

**Receipt:** query, result count, top result repo/path URLs

---

### 4.2 `forge_github_search_repos`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Query targets private/internal org repos without scope

**Input schema:**
```json
{
  "q": "string (required)",
  "per_page": "integer (1-100, default: 30)",
  "page": "integer (default: 1)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "total_count": "integer",
  "items": [
    {"full_name": "string", "description": "string", "url": "string", "stars": "integer"}
  ],
  "receipt_id": "string"
}
```

**Receipt:** query, result count, repo names

---

### 4.3 `forge_github_get_file`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Path is in .secrets, .env, key store, or known sensitive file list
- Request targets repo outside approved read scope

**Input schema:**
```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "path": "string (required)",
  "branch": "string (default: main)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "content": "string",
  "sha": "string",
  "size": "integer",
  "encoding": "utf-8",
  "receipt_id": "string"
}
```

**Receipt:** owner/repo/path/branch, sha, size

---

### 4.4 `forge_github_create_or_update_file` ⛔ 888_HOLD

**Action class:** MUTATE  
**Lease required:** Yes  
**Hold triggers:**
- All invocations trigger 888_HOLD by default
- Path is .env, secrets, CI/CD config, firewall, DNS, or system config
- Content contains credential-like patterns
- Branch is `main` and no PR workflow

**Input schema:**
```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "path": "string (required)",
  "branch": "string (required)",
  "content": "string (required, base64)",
  "message": "string (required)",
  "sha": "string|null (required for update)",
  "create_pr": "boolean (default: true)",
  "pr_base": "string (default: main)",
  "request_id": "string (UUID, required)",
  "lease_id": "string (required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "commit_sha": "string|null",
  "pr_url": "string|null",
  "file_sha": "string",
  "receipt_id": "string"
}
```

**Receipt:** owner/repo/path/branch, commit_sha, pr_url, lease_id, content hash

---

### 4.5 `forge_github_create_issue` ⛔ 888_HOLD

**Action class:** MUTATE  
**Lease required:** Yes  
**Hold triggers:**
- All invocations trigger 888_HOLD by default
- Issue body contains credentials, secrets, or PII

**Input schema:**
```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "title": "string (required)",
  "body": "string (required)",
  "labels": ["string"],
  "assignees": ["string"],
  "request_id": "string (UUID, required)",
  "lease_id": "string (required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "issue_number": "integer",
  "issue_url": "string",
  "receipt_id": "string"
}
```

**Receipt:** owner/repo, issue number, title, lease_id

---

### 4.6 `forge_github_create_pull_request` ⛔ 888_HOLD

**Action class:** MUTATE  
**Lease required:** Yes  
**Hold triggers:**
- All invocations trigger 888_HOLD by default
- Base is `main`
- Head branch unknown or not from approved source
- PR touches constitutional files, CI/CD, secrets, or infra

**Input schema:**
```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "title": "string (required)",
  "body": "string (required)",
  "head": "string (required)",
  "base": "string (default: main)",
  "draft": "boolean (default: true)",
  "request_id": "string (UUID, required)",
  "lease_id": "string (required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "pr_number": "integer",
  "pr_url": "string",
  "receipt_id": "string"
}
```

**Receipt:** owner/repo, pr_number, head/base, draft flag, lease_id

---

## 5. Netdata / Infrastructure Gateways

### 5.1 `forge_netdata_alarms`

**Replaces:** Netdata local agent  
**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Query asks to acknowledge/clear alarms (MUTATE; not allowed here)

**Input schema:**
```json
{
  "host": "string (default: localhost)",
  "status": "enum: all | raised | clear | warning | critical (default: raised)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "alarms": [
    {"id": "string", "name": "string", "status": "string", "value": "number", "info": "string"}
  ],
  "receipt_id": "string"
}
```

**Receipt:** host, alarm count, critical count

---

### 5.2 `forge_netdata_metrics`

**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Query asks to mutate any metric source

**Input schema:**
```json
{
  "host": "string (default: localhost)",
  "chart": "string (required)",
  "after": "integer|null (Unix timestamp)",
  "before": "integer|null (Unix timestamp)",
  "points": "integer (default: 100)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "chart": "string",
  "labels": ["string"],
  "data": [["number"]],
  "receipt_id": "string"
}
```

**Receipt:** host, chart, time range, point count

---

## 6. Model / Provider Gateways

### 6.1 `forge_minimax_search`

**Replaces:** MiniMax web_search capability  
**Action class:** OBSERVE  
**Lease required:** No  
**Hold triggers:**
- Same as `forge_search`

**Input schema:**
```json
{
  "query": "string (required, max 400 chars)",
  "max_results": "integer (1-20, default: 10)",
  "request_id": "string (UUID, required)"
}
```

**Output schema:**
```json
{
  "request_id": "string",
  "results": [
    {"title": "string", "url": "string", "snippet": "string"}
  ],
  "provider": "minimax",
  "receipt_id": "string"
}
```

**Receipt:** query, provider, result count, top URLs

---

## 7. Authority Matrix Summary

| Tool | Class | Lease | 888_HOLD |
|------|-------|-------|----------|
| forge_research | OBSERVE | No | Conditional |
| forge_search | OBSERVE | No | Conditional |
| forge_docs_lookup | OBSERVE | No | Conditional |
| forge_browser_navigate | OBSERVE | No | Conditional |
| forge_browser_click | OBSERVE | No | Conditional |
| forge_browser_type | OBSERVE | No | Conditional |
| forge_browser_screenshot | OBSERVE | No | Conditional |
| forge_browser_extract_text | OBSERVE | No | Conditional |
| forge_browser_evaluate_js | OBSERVE | No | Conditional |
| forge_github_search_code | OBSERVE | No | Conditional |
| forge_github_search_repos | OBSERVE | No | Conditional |
| forge_github_get_file | OBSERVE | No | Conditional |
| forge_github_create_or_update_file | MUTATE | Yes | Always |
| forge_github_create_issue | MUTATE | Yes | Always |
| forge_github_create_pull_request | MUTATE | Yes | Always |
| forge_netdata_alarms | OBSERVE | No | Conditional |
| forge_netdata_metrics | OBSERVE | No | Conditional |
| forge_minimax_search | OBSERVE | No | Conditional |

---

## 8. Cross-Cutting Rules

1. **No bypass.** Any MCP client (Kimi, Claude, OpenCode) must call `forge_*` tools, not raw external MCPs, for governed operations. The raw `playwright` MCP endpoint is disabled for opencode agents; use `forge_browser_*` instead.
2. **Every call gets a receipt.** All gateway invocations write a receipt pointer to VAULT999 with request_id, provider, action_class, lease_id (if any), and outcome summary.
3. **Fail-closed on lease failure.** MUTATE-class tools refuse execution if the kernel cannot validate the lease.
4. **No sovereign substitution.** A-FORGE never issues its own authority. It only presents kernel-issued leases.
5. **Human veto is absolute.** F13 sovereign may block any gateway call at any time.

---

## 9. Open Questions / TODO

- [ ] Should `forge_browser_*` support authenticated sessions? If yes, session cookies must be stored in arifOS L4/L6, not A-FORGE local state.
- [ ] Should `forge_github_create_or_update_file` default to PR creation (yes per contract) or allow direct commit on non-main branches?
- [ ] Should `forge_research` route to multiple providers in parallel and merge, or use a single provider per call?
- [ ] Should `forge_netdata_*` support remote hosts beyond localhost? If yes, need host whitelist in arifOS.
- [ ] Should `forge_docs_lookup` index internal wiki / `code-wiki` skill output?

---

## 10. Next Steps

1. Review and ratify this contract draft.
2. Implement ADR-001 kernel-issued A-FORGE leases.
3. Implement A-FORGE gateway handlers in TypeScript.
4. Update MCP client configs to register `forge_*` tools and retire redundant external MCPs.
5. Add contract-parity tests between gateway input/output schemas and A-FORGE runtime.
