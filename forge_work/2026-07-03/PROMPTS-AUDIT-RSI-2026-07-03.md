# Prompts Audit + RSI — A-FORGE MCP Prompt Surface

> **Forged:** 2026-07-03 by FORGE (000Ω) for F13 SOVEREIGN  
> **References:** MCP llms.txt · GoFastMCP llms.txt · A2A Protocol (GitHub)  
> **Session:** SEAL-04005456a4a44d22 | Actor: arif-888-SOVEREIGN  

---

## Audit Summary

| Metric | Before | After | Δ |
|--------|--------|-------|----|
| Total prompts | 13 | 13 | Unchanged (all retained) |
| Lines of code | 769 | 809 | +40 (richer guidance) |
| SEP references | 0 | 4 (973, 986, 2549, 2322) | +4 |
| A2A references | 0 | 3 | +3 |
| forge_systemctl references | 1 | 0 | -1 (removed) |
| forge_policy references | 0 | 2 | +2 |
| arif_route references | 1 | 3 | +2 |
| forge_document_ingest refs | 0 | 2 | +2 |
| forge_probe references | 1 | 5 | +4 |
| Hardcoded port mappings | 1 | 0 | -1 (→ arif_route) |
| TypeScript compilation | ✅ | ✅ | No regression |

---

## Audit Findings Against Reference Standards

### 1. MCP Official Spec (modelcontextprotocol.io/llms.txt)

| Requirement | Status | Notes |
|-------------|--------|-------|
| `server.prompt()` with name + description | ✅ | All 13 prompts have descriptive names + descriptions |
| Zod schema for arguments | ✅ | All use `z.string()`, `z.enum()`, `z.boolean()` etc |
| `prompts/list` discovery | ✅ | Handled by SDK's server.prompt registration |
| `prompts/get` with argument rendering | ✅ | Template strings with `args.*` interpolation |
| SEP-973 metadata enrichment | ✅ | Added SEP refs, expanded descriptions, categorized prompts |
| SEP-986 kebab-case naming | ✅ | All prompts: `fix-bug`, `refactor-module`, etc |
| SEP-2549 TTL annotations | 🔲 Future | Prompts list caching optimization — not yet critical |

### 2. FastMCP / GoFastMCP (gofastmcp.com/llms.txt)

| Requirement | Status | Notes |
|-------------|--------|-------|
| "Rendered message templates" pattern | ✅ | All prompts return structured messages with template text |
| Auto-serialization of args | ✅ | Zod schemas + `${args.*}` interpolation |
| Human-in-the-loop approval gates | ✅ | `deploy-service` mentions 888_HOLD, forge_lease |
| Tool annotations in prompt content | ✅ | All prompts reference actual forge_* tools by correct name |

### 3. A2A Protocol (github.com/a2aproject/A2A)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Agent Card capability mapping | ✅ | cross-organ-query now describes Agent Card discovery |
| Skill-based routing | ✅ | arif_route now primary dispatch mechanism |
| JSON-RPC 2.0 alignment | ✅ | A-FORGE MCP uses streamable-http transport |
| `/.well-known/agent.json` references | ✅ | cross-organ-query mentions per-repo agent cards |

---

## Key RSI Changes

### 1. `deploy-service` — Deprecation Routing
- `forge_systemctl` → `forge_shell('systemctl ...')`  
- Added `forge_vault` routing note (write/seal → arifOS)  
- Added `forge_probe` for health verification (not raw curl)

### 2. `cross-organ-query` — Intent-Based Routing
- `arif_route` is now PRIMARY dispatch mechanism (not hardcoded port map)  
- Added A2A discovery workflow (Agent Cards, `.well-known/agent.json`)  
- Added routing rules table (boundary contract enforcement)  

### 3. `audit-code` — Surface + Policy Audits
- Added `mcp-surface` focus for tool registry vs affordance drift detection  
- Added `forge_policy(mode=list)` for governance audits  
- Added audit type notes (security/governance/mcp-surface/performance)

### 4. `research-topic` — Document Intelligence
- Added `forge_document_ingest` as a gather source (PDF/image with bbox provenance)  
- Added `document_path` argument for document-specific research  

### 5. Module Headers — Standards Alignment
- SEP compliance block (SEP-973, 986, 2549, 2322)  
- A2A alignment block (Agent Cards, skill discovery)  
- Updated tool reference map with `forge_probe`, `forge_policy`, `arif_route`  

---

## Remaining Debt (Carry-Forward)

| Item | Priority | Why Not Done |
|------|----------|-------------|
| SEP-2549 TTL annotations | Low | Requires SDK support for prompts/list caching |
| SEP-2322 MRTR prompts | Low | Multi-round-trip prompts need new prompt pattern |
| `forge_document_ingest` dedicated prompt | Medium | Deserves its own prompt — deferred to keep scope focused |
| Reply prompt template | Low | A-FORGE uses forge_compose for replies, not standalone prompt |

---

## Evidence

| Artifact | Path |
|----------|------|
| Prompt surface file | `/root/A-FORGE/src/interfaces/mcp/prompts.ts` |
| Diff: +128/-89 lines | `git diff HEAD -- src/interfaces/mcp/prompts.ts` |
| Reference: MCP spec | `https://modelcontextprotocol.io/llms.txt` |
| Reference: FastMCP | `https://gofastmcp.com/llms.txt` |
| Reference: A2A protocol | `https://github.com/a2aproject/A2A` |

**DITEMPA BUKAN DIBERI — Prompts audited, RSI complete, TypeScript clean.** 🔥⚒️
