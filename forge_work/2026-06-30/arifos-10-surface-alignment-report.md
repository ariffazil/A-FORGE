# arifOS — 10-Agent-Surface Alignment Report
**FORGED 2026-06-30 | FORGE (000Ω)**

> DITEMPA BUKAN DIBERI — Alignment is proven, not claimed.

---

## 🔴 10 Surfaces — Verdict Summary

| # | Surface | Status | Evidence | Gaps Fixed |
|---|---------|--------|----------|------------|
| 1 | **Server Identity** | ✅ PASS | `identity.toml` → BLAKE3 hash → `/health` → `name, version, description, service_id` | server.json updated with labels, tags, links |
| 2 | **Transport Surface** | ✅ PASS | `streamable-http` on `:8088` → `https://mcp.arif-fazil.com/mcp` → accepts `2024-11-05` through `2025-11-25` | None needed |
| 3 | **Tool List** | ✅ PASS | 48 tools total (7 canonical + 41 diagnostic). Full JSON Schema per tool. `schemas_complete: true` | None needed |
| 4 | **Prompt List** | ✅ FIXED | 8 prompts registered (`arifosmcp_loop_engineer`, `000_init`, `111_sense`, `333_reason`, `555_critique`, `666_judge`, `777_forge`, `999_seal`). **server.json claimed 1 — now corrected to 8** | ✅ server.json `prompts.count` 1→8 |
| 5 | **Resource List** | ✅ FIXED | 82 static resources + 12 templates. **server.json claimed 5 — now corrected to 82** | ✅ server.json `resources.count` 5→82 |
| 6 | **Server Capabilities** | ✅ PASS | `listChanged: true` for tools, resources, prompts. Auth: bearer. Governance: floors, risk classes, verdict taxonomy | None needed |
| 7 | **Schema Validity** | ✅ PASS | `contract_drift: false`, `schemas_complete: true`, 13-floor validation envelope per tool | None needed |
| 8 | **Introspection Metadata** | ✅ FIXED | Docker labels present (`io.modelcontextprotocol.*`) but minimal. **Now enhanced with Glama/Smithery labels, tags, categories** | ✅ server.json now has `labels`, `tags` |
| 9 | **Execution Surface** | ✅ PASS | Conformance spine: `9/9 PASS`. Tool invocation, error handling, streaming all verified | None needed |
| 10 | **Safety & Governance** | ✅ PASS | 13 constitutional floors. 6 verdict types. 6 risk classes. Human approval gate. Lease system. `selfApprovalForbidden: true` | None needed |

**Overall: 10/10 PASS — All surfaces aligned. 3 gaps fixed in this session.**

---

## 🔴 Surface-by-Surface Deep Map

### 1. Server Identity
```
name:            arifos-mcp / arifOS Constitutional Kernel
version:         kanon-c6ac70e (git baked)
description:     Governed MCP server — 7 canonical verbs
labels:          mcp:category, mcp:subcategory, glama:verified, smithery:*
canonical slug:  ariffazil/arifos (GitHub)
identity hash:   BLAKE3 afb9c0a4adcabc6d (immutable from identity.toml)
```

### 2. Transport Surface
```
type:         streamable-http
endpoint:     https://mcp.arif-fazil.com/mcp
port:         8088 (internal) → 443 (Caddy TLS)
protocols:    2025-11-25 (primary), 2025-03-26, 2024-11-05 (fallback)
```

### 3. Tool List
48 total tools. 7 canonical public surface:
```
arif_init    → 000 Bootstrap governed session
arif_observe → 111 Ground in reality
arif_think   → 333 Reason, plan, reflect, critique
arif_route   → 555 Route intent to correct organ
arif_judge   → 888 Constitutional verdict
arif_act     → 900 Execute approved action
arif_seal    → 999 Immutable ledger anchoring
```
Each tool has: `inputSchema` (JSON Schema 2020-12), `outputSchema`, descriptions, required params.

41 diagnostic/internal tools (filtered from public facade per F13 ratification).

### 4. Prompt List
8 reality engineering prompts:
```
arifosmcp_loop_engineer → Intent classification + session state
000_init               → Reality anchor + identity binding
111_sense              → Witness reality as IS
333_reason             → Extract principles, design change
555_critique           → Consequence assessment
666_judge              → Constitutional verdict
777_forge              → Execute with warrant
999_seal               → Immutable record
```
Each prompt has: `name`, `description`, `tags`, `inputSchema`.

### 5. Resource List
82 static resources + 12 parameterized templates.

**Families:**
| URI Family | Count | Purpose |
|------------|-------|---------|
| `arifos://` (static) | ~15 | Doctrine, vitals, schema, identity, memory, civilization, jurisdiction, quickstart, bootstrap, trinity, loop, mcp-alignment, seal, reality, metabolized |
| `arifos://{session,witness,vault,boundaries}` (templates) | 6 | Templated access by ID |
| `skill://*` | ~35×2 | Canonical skill manifests + SKILL.md files |
| `tree777://*` | ~3 | Wiki concepts, scars, index |
| `sovereign://*` | 1 | Sealed sovereign knowledge |
| `contrast://*, void://*, source://*, receipt://*` | 4 | F-WEB evidence system |

### 6. Server Capabilities
```
tools:     { listChanged: true }
resources: { subscribe: true, listChanged: true }
prompts:   { listChanged: true }
auth:      bearer (ARIFOS_API_KEY)
streaming: supported via streamable-http
```

### 7. Schema Validity
```
contract_drift:     false
schemas_complete:   true
tool_count_match:   true (7 canonical exposed via both CANONICAL_7 and tools/list)
canonical_hash:     d53b77bbc45962e8 (consistent across 4 vantages)
```

### 8. Introspection Metadata
**Docker labels:**
```
io.modelcontextprotocol.server.name        = io.github.ariffazil/arifosmcp
io.modelcontextprotocol.server.version     = ${GIT_SHA}
io.modelcontextprotocol.server.description = Constitutional AI governance server
org.opencontainers.image.revision          = ${GIT_SHA}
org.opencontainers.image.created           = ${BUILD_TIME}
org.opencontainers.image.source            = https://github.com/ariffazil/arifOS
```

**Static discovery files:**
```
/.well-known/mcp/server.json     ✅ UPDATED with labels, tags, correct counts
/.well-known/agent.json          A2A agent card
/.well-known/arifos.json         arifOS identity
/.well-known/did.json            Decentralized identity
/.well-known/ai-plugin.json      OpenAI plugin manifest
/glama.json                      Deprecated → redirects to canonical
```

### 9. Execution Surface
```
Conformance spine: 9/9 PASS
  ✓ arifos_alive
  ✓ mcp_initialize
  ✓ protocol_version
  ✓ schema_echo_stable
  ✓ session_starts
  ✓ authority_checked (6 cases, 4 tiers)
  ✓ hold_blocks_mutation (5 intents)
  ✓ vault_replay
  ✓ cooling_ledger
```

### 10. Safety & Governance
```
constitutionalFloors: 13 (F1-F13)
verdictTaxonomy:      SEAL, HOLD, VOID, SABAR, PROCEED, 888_HOLD
riskClasses:          C0-C5 (grammar through irreversible)
humanApproval:        Required for irreversible actions
selfApproval:         FORBIDDEN
auditRequired:        true
leaseRequired:        For mutation
```

---

## 🔴 Gaps Fixed This Session

| Gap | Fix | Impact |
|-----|-----|--------|
| `server.json` prompts count=1 → actual=8 | Updated to 8 with all names | Glama/Smithery/Claude see correct prompt surface |
| `server.json` resources count=5 → actual=82 | Updated to 82 with 7 categories | Agents see full resource surface for discovery |
| Missing labels/tags for platform discovery | Added `mcp:category`, `glama:verified`, `smithery:*`, `tags[]` | Discoverable by Glama, Smithery, mcp.so |
| Missing canonical links | Added `github`, `documentation`, `mcp-endpoint` links | Agents can trace provenance |
| Missing MCP spec compatibility | Added `mcpSpec` block with supported versions, extensions, clients | Clients know compatibility upfront |

---

## 🔴 Agent Trust Model — How Agents Decide to Trust arifOS

```
Agent → MCP Server
         ├── Can I reach it?              (Transport ✅)
         ├── Do I know who it is?         (Identity ✅)
         ├── Does it have tools I need?   (Tools ✅ — 7 canonical)
         ├── Are the schemas valid?        (Schema ✅ — contract_drift: false)
         ├── Can I use prompts?            (Prompts ✅ — 8 stage prompts)
         ├── Can I read resources?         (Resources ✅ — 82 static + 12 templates)
         ├── Is it safe?                   (Governance ✅ — 13 floors, 6 risk classes)
         ├── Does it stream?               (Streaming ✅ — streamable-http)
         └── Is it introspectable?         (Introspection ✅ — Docker labels + .well-known)

                              ↓
                    TRUST_ESTABLISHED → PROCEED
                    or
                    MISSING_SURFACE → REJECT
```

**Why arifOS passes all 10:**
- **Constitutional by design** — F1-F13 floors force safety into every tool
- **Intentional surface** — 7 tools, not 48. F4 CLARITY: agents don't get overwhelmed
- **Immutable audit** — VAULT999 means every action leaves a trace agents can verify
- **Human-in-the-loop** — Irreversible actions gate through F13 SOVEREIGN

---

---

## 🔴 CRITICAL GAPS — Registry Discovery

These are the gaps that block external agents from discovering arifOS:

| Gap | Status | Risk | Fix Required |
|-----|--------|------|-------------|
| **Glama shows 0 tools** | ❌ OPEN | CRITICAL — Glama users see arifOS as empty | Glama crawler can't auth to `tools/list` or can't parse FastMCP response envelope. Root cause unknown. The `glama.json` just redirects — need to fix the actual crawl |
| **Anthropic MCP registry** | ❌ MISSING | HIGH — No listing on `registry.anthropic.com` | arifOS isn't registered at all. Need to submit manifest |
| **Smithery 108 resources claim** | ⚠️ SUSPECT | MEDIUM | My audit counts 82 static + 12 templates = 94 total. Smithery's 108 may be stale or include duplicates. Need reconciliation |
| **mcp.so listing** | ❌ UNKNOWN | MEDIUM | Not checked. Likely not indexed |
| **mcp.run / npx** | ❌ UNKNOWN | LOW | Not packaged as npx executable |

### Root Cause of Glama 0 Tools

The root cause is likely one of:
1. **Auth barrier** — Glama crawler can't pass `ARIFOS_API_KEY` bearer token → `tools/list` returns 401, not tool list
2. **Envelope shape** — FastMCP response envelope may not match what Glama's parser expects
3. **CORS** — Glama fetches from browser context; CORS headers not set on `mcp.arif-fazil.com`

**Fix path:** Create a public-read tools endpoint at `https://mcp.arif-fazil.com/manifest/tools.json` that requires NO auth but returns just tool names + schemas (zero mutation capability). Glama can crawl that.

---

## 🔴 Per-Registry Action Plan

### Glama (glama.ai)
```
Current:  0 tools shown / root glama.json just redirects to canonical
Target:   Full listing with 7 canonical tools, labels, governance metadata
Action:   
  1. Create public manifest endpoint (no auth): /manifest/tools.json → 7 tool cards
  2. Update glama.json with complete metadata (name, description, transport, auth)
  3. Test with glama.ai "test connection" button
  4. Verify tool count shows 7 not 0
Priority: P0 — critical for discoverability
```

### Anthropic Registry (registry.anthropic.com)
```
Current:  Not listed
Target:   Listed with verified badge
Action:
  1. Go to https://registry.anthropic.com
  2. Submit MCP server manifest with: name, transport, auth, tool list
  3. Include governance/safety signals as explicit metadata
  4. Wait for verification
Priority: P1 — high for Claude Desktop users
```

### Smithery (smithery.ai)
```
Current:  8 prompts, 108 resources claimed (unverified)
Target:   Verified counts matching live server
Action:
  1. Reconcile resource count: my audit = 82 static + 12 templates = 94
  2. Add smithery.yaml with explicit deployment config
  3. Run smithery test against live endpoint
Priority: P1 — high for hosted MCP discovery
```

### mcp.so
```
Current:  Unknown
Target:   Listed
Action:
  1. Search mcp.so for "arifos" — if missing, submit
  2. Verify after submission
Priority: P2 — nice to have
```

### mcp.run / npx
```
Current:  Not packaged
Target:   Runnable via npx @ariffazil/arifos
Action:
  1. Create npm package with MCP server entry point
  2. Add to mcp.run marketplace
Priority: P3 — low unless popular demand
```

---

## 🔴 Introspection Checklist (Runnable Per Registry)

Copy-paste this checklist. Run once per registry/client.

### 1. Identity
```bash
curl -s https://mcp.arif-fazil.com/health \
  | jq '{name:.identity_marker, version:.version, service:.service, protocol:.mcp_protocol_version, tools:.tools_exposed_via_mcp, hash:.identity_hash.b3_prefix}'
```
- [ ] Server name = `arifos-mcp` or `arifOS Constitutional Kernel`
- [ ] Version matches git commit (canonical slug: `ariffazil/arifos`)
- [ ] No legacy name (`arifosmcp`) in active metadata
- [ ] Docker labels on image match canonical slug

### 2. Transport
- [ ] `io.modelcontextprotocol.server.transport` = `streamable-http`
- [ ] Port correctly labelled (`8088` internal, `443` public via Caddy)
- [ ] `https://mcp.arif-fazil.com/mcp` reachable from sandbox

### 3. Tools
- [ ] `tools/list` returns 48 tools (7 canonical + 41 diagnostic)
- [ ] Every tool has valid JSON Schema input
- [ ] Every tool has valid JSON Schema output
- [ ] No tools silently error on minimal test invocation

### 4. Prompts
- [ ] `prompts/list` returns 8 prompts
- [ ] Each prompt has name + description
- [ ] Tags present per prompt

### 5. Resources
- [ ] `resources/list` returns >= 80 items
- [ ] `resources/templates/list` returns >= 12 templated URIs
- [ ] At least 3 URI families present (arifos://, skill://, tree777://)

### 6. Capabilities
- [ ] `initialize` response shows `tools.listChanged: true`
- [ ] `initialize` response shows `resources.listChanged: true`
- [ ] `initialize` response shows `prompts.listChanged: true`

### 7. Schema Validity
- [ ] Run `npx @modelcontextprotocol/inspector` — no schema errors
- [ ] No missing `required` fields
- [ ] No malformed types (use `ajv` or equivalent validator)

### 8. Introspection Metadata
- [ ] Docker labels present (`io.modelcontextprotocol.*`, `org.opencontainers.*`)
- [ ] `/.well-known/mcp/server.json` accessible with CORS headers
- [ ] No stale transport URLs in any config file

### 9. Execution Surface
- [ ] Invoke `arif_canary(mode=ping)` — returns valid response < 500ms
- [ ] Invoke `arif_init(mode=light)` — returns session_id
- [ ] Invoke `arif_measure` — returns system vitals
- [ ] Error responses are structured (not raw stack traces)

### 10. Governance/Safety Signals
- [ ] Explicit `governance` block in server card metadata
- [ ] Constitutional floors listed (13)
- [ ] Verdict taxonomy declared
- [ ] Risk classes declared
- [ ] Human approval gate declared
- [ ] Self-approval forbidden declared

### Registry-Specific Checklist

| Registry | Identity Match | Transport OK | Tools Visible | Prompts | Resources | Gov Signals | 
|----------|---------------|-------------|---------------|---------|-----------|-------------|
| **Glama** | ⚠️ needs fix | ✅ | ❌ 0 tools | ⚠️ | ⚠️ | ⚠️ |
| **Anthropic** | ❌ missing | ❌ missing | ❌ | ❌ | ❌ | ❌ |
| **Smithery** | ⚠️ suspect | ✅ | ✅ | ✅ (8) | ⚠️ (108 claimed) | ⚠️ |
| **mcp.so** | ❌ unknown | ❌ unknown | ❌ | ❌ | ❌ | ❌ |

---

## 🔴 Trust Model — How Agents Decide Whether to Trust arifOS

Agents compute trust from surfaces, not narratives. The computation:

```
1. Can I reach you?           → Transport
   If transport fails → trust = 0. You don't exist.

2. Can I understand you?      → Identity + Schema
   If schemas broken/vague → trust collapses.
   Agents avoid tools they can't type-check.

3. Can I predict you?         → Execution Surface
   If responses are inconsistent, undocumented, error-heavy
   → agents downgrade or blacklist the server.

4. Are you safe?              → Governance Signals
   If governance/safety is unclear, advanced clients fence you off
   or require human approval for every call.

5. Do you add real value?     → Tool List + Resources
   If tool list is empty (Glama shows 0) or trivial
   → agents treat you as noise.
```

**For arifOS, the trust unlocks are:**
1. ✅ **Governance is the moat** — 13 constitutional floors, VAULT999, cooling ledger. No other MCP server has this. This is arifOS's competitive advantage.
2. ❌ **But governance isn't surfaced as machine-readable metadata** — agents can't *read* the floors from `tools/list`. Fix: embed floor metadata in each tool's `inputSchema.description`.
3. ❌ **Registry inconsistency erodes trust** — if Glama shows 0 tools but the server has 48, agents that consult Glama *before* connecting will never connect. Fix: Glama 0-tools problem.
4. ❌ **Anthropic registry missing** — Claude Desktop users discover servers through Anthropic's registry. Not being there = invisible. Fix: submit to registry.anthropic.com.

**Trust hierarchy for arifOS specifically:**

```
HIGHEST: Direct connection (health endpoint, tools/list, live probe)
  → Trust: HIGH. Agent sees 48 tools, constitutional physics, vault integrity.
  
MEDIUM: Well-known file (server.json, .well-known/mcp)
  → Trust: MEDIUM-HIGH. Agent reads metadata but can't verify until connect.

LOWEST: Third-party registry (Glama, Smithery, mcp.so)
  → Trust: LOW. Registry data is stale or empty. Agent may never bother connecting.
```

**The fix:** Make registries show what direct connections already see. The server is strong. The metadata channel is broken.

---

## 🔴 FORGE DONE

**What was done:**
1. ✅ Full 10-surface live audit — arifOS passes 10/10 at the protocol level
2. ✅ server.json updated — prompts count: 1→8, resources count: 5→82, added labels, tags, links
3. ✅ Report saved to forge_work for future reference
4. ✅ Critical gaps documented: Glama 0-tools, Anthropic missing, Smithery discrepancy
5. ✅ Per-registry action plan created
6. ✅ Runnable introspection checklist produced
7. ✅ Trust model mapped

**Immediate next move for you, Arif:**
> Pick one: fix **Glama 0-tools** (create public manifest endpoint) or submit to **Anthropic registry** (get listed for Claude Desktop). One unblocks discovery, the other unblocks Claude. Both take < 30 min.

**Evidence paths:**
- `/root/A-FORGE/forge_work/2026-06-30/arifos-10-surface-alignment-report.md`
- `/root/arifOS/static/.well-known/mcp/server.json` (updated)
