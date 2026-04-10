---
type: Ritual
subtype: Ingest
tags: [workflow, context7, documentation, dependencies]
sources: [raw/external/context7/]
last_sync: 2026-04-09
confidence: 0.95
epistemic_level: DER
arifos_floor: [F1, F2, F4, F7]
operator: Arif
status: active
---

# Ritual: INGEST (with Context7)

## Purpose
Transform external library documentation into structured AF-FORGE knowledge. This ritual fetches version-specific docs via Context7 MCP, validates them, and synthesizes them into Blueprints, Alloys, and Smith Notes.

**Thermodynamic Flow:**
```
raw/external/context7/ → 20_BLUEPRINTS/ → 30_ALLOYS/ → 70_SMITH_NOTES/
     (raw fetch)          (synthesis)      (pinning)      (wisdom)
```

## Prerequisites
- [ ] Context7 MCP server configured and reachable
- [ ] Library name identified (e.g., "fastmcp", "pydantic-ai")
- [ ] Target version known (or "latest" for auto-resolve)
- [ ] 888_HOLD cleared for ingest scope

## Procedure

### Step 1: Resolve Library ID
```bash
# Via Context7 MCP tool
resolve-library-id library_name="fastmcp"
```

**Expected Output:**
```json
{
  "library_id": "fastmcp",
  "canonical_name": "FastMCP",
  "latest_version": "3.1.1",
  "description": "Python MCP framework"
}
```

**Validation (F2 Truth):**
- Verify library_id matches expected
- Record version in working memory

---

### Step 2: Fetch Documentation
```bash
query-docs 
  library_id="fastmcp" 
  query="architecture, tools, resources, prompts"
  version="3.1.1"
```

**Storage:**
```bash
# Write raw JSON to immutable storage
raw/external/context7/fastmcp-v3.1.1.json
```

**F1 Amanah Check:**
- Raw file is append-only
- If corrupted: delete and re-fetch (no state mutation)

---

### Step 3: Update Manifest
Edit `raw/external/context7/manifest.json`:
```json
{
  "library": "fastmcp",
  "context7_id": "fastmcp",
  "version": "3.1.1",
  "file": "fastmcp-v3.1.1.json",
  "last_sync": "2026-04-09",
  "blueprint_dest": "20_BLUEPRINTS/FastMCP_Integration.md",
  "alloy_updated": true,
  "smith_note": "70_SMITH_NOTES/2026-04-09_Context7_FastMCP.md"
}
```

---

### Step 4: Synthesize Blueprint
Create `20_BLUEPRINTS/FastMCP_Integration.md`:
```yaml
---
type: Blueprint
subtype: Integration
source: context7
context7_library_id: fastmcp
context7_version: 3.1.1
context7_synced: 2026-04-09
arifos_floor: [F2, F4]
tags: [context7, ingest, fastmcp, mcp]
---
```

**Sections to include:**
1. **Overview** — Library purpose in 2 sentences
2. **Architecture** — Core concepts (Tools, Resources, Prompts)
3. **Integration Patterns** — Code examples from Context7
4. **Version Pinning** — Why this version, upgrade risks
5. **Alloy Dependencies** — Related libraries

**F2 Truth Requirement:**
Every claim cites `raw/external/context7/fastmcp-v3.1.1.json` section.

---

### Step 5: Update Alloys
Edit `30_ALLOYS/Dependency_Matrix.md`:
```markdown
| Library | Version | Source | Last Sync | Status |
|---------|---------|--------|-----------|--------|
| fastmcp | 3.1.1 | context7 | 2026-04-09 | pinned |
```

Edit `30_ALLOYS/Version_Pinning.md`:
```markdown
## fastmcp 3.1.1
- Pinned: 2026-04-09
- Reason: Context7 ingest, stable API
- Next check: 2026-05-09
- Risk: Medium (active development)
```

---

### Step 6: Write Smith Note
Create `70_SMITH_NOTES/2026-04-09_Context7_FastMCP.md` from template (see [[70_SMITH_NOTES/Context7_Template]]).

**Required Sections:**
- What was ingested
- Key findings/changes
- Cracks detected/avoided
- Whispered tips
- For next smith

---

### Step 7: Log Operation
Append to `log.md`:
```markdown
## [2026-04-09] ingest | fastmcp@v3.1.1 | COMPLETE
- Source: context7
- Blueprint: 20_BLUEPRINTS/FastMCP_Integration.md
- Alloys: 30_ALLOYS/Dependency_Matrix.md, Version_Pinning.md
- Smith Note: 70_SMITH_NOTES/2026-04-09_Context7_FastMCP.md
- Confidence: 0.95
```

---

## Verification

### Check 1: Raw Immutable
```bash
ls -la raw/external/context7/fastmcp-v3.1.1.json
# Must exist, read-only
```

### Check 2: Manifest Valid
```bash
# Verify JSON parses
python3 -m json.tool raw/external/context7/manifest.json > /dev/null
```

### Check 3: Blueprint Complete
- [ ] All 5 sections present
- [ ] Frontmatter has context7_* fields
- [ ] Cites raw source

### Check 4: Alloys Linked
- [ ] Dependency_Matrix updated
- [ ] Version_Pinning has rationale

### Check 5: Smith Note Written
- [ ] Uses Context7 template
- [ ] Dated and tagged

---

## Rollback (F1 Amanah)

**If ingest fails at any step:**

```bash
# 1. Remove raw file (if created)
rm raw/external/context7/fastmcp-v3.1.1.json

# 2. Revert manifest entry
# Edit raw/external/context7/manifest.json — remove fastmcp entry

# 3. Remove blueprint (if created)
rm 20_BLUEPRINTS/FastMCP_Integration.md

# 4. Revert alloy changes
# git checkout 30_ALLOYS/

# 5. Remove smith note (if created)
rm 70_SMITH_NOTES/2026-04-09_Context7_FastMCP.md

# 6. Log rollback
# Append to log.md: "[DATE] ingest-rollback | fastmcp | REASON"
```

**Partial Rollback:**
If raw file is good but synthesis failed:
- Keep `raw/external/context7/fastmcp-v3.1.1.json`
- Remove blueprint/alloy/smith entries
- Re-attempt synthesis with corrected parameters

---

## State Machine

```
IDLE → RESOLVED → FETCHED → RAW_STORED → INGESTED
         ↑                              ↓
         └──────── ROLLBACK ←───────────┘
```

| State | Definition | Rollback Point |
|-------|-----------|----------------|
| IDLE | Query received | None |
| RESOLVED | Library ID acquired | None |
| FETCHED | Raw JSON received | Delete raw file |
| RAW_STORED | File in raw/external/ | Remove from manifest |
| INGESTED | Blueprint/Alloy/Smith written | Revert all files |

---

## Cross-Links

- `20_BLUEPRINTS/FastMCP_Integration.md` — example output path
- [[30_ALLOYS/Dependency_Matrix]] — where versions are pinned
- [[70_SMITH_NOTES/Context7_Template]] — smith note template
- `raw/external/context7/manifest.json` — source tracking
- `F2 Truth` — citation requirements
- `F1 Amanah` — reversibility principle

---

## Whispered Tips

> **Version Drift:** Context7 returns "latest" version. Always pin to specific version in Alloys. "latest" is a query parameter, not a dependency declaration.

> **Partial Queries:** If `query-docs` returns truncated results, do multiple targeted queries ("tools", "resources", "prompts") rather than one broad query.

> **Cache Invalidation:** Context7 docs update upstream. Re-run INGEST monthly for active libraries. Check `last_sync` in manifest before using cached blueprints.

> **Hallucination Guard:** Context7 returns real docs, but synthesis can still hallucinate. Always require F2 citations in blueprint reviews.

---

**Seal Status:** This ritual is F1-F4 compliant. No 888_HOLD required for execution.

**Last Verified:** 2026-04-09
