# A-FORGE Actuator Descriptions (canonical contrast)

Every entry is an **actuator**, not a plugin, not a kernel verb.

### `forge_abort`
- **class:** `execute` · **mutation:** `MUTATE`
- **surface:** `aforge.execute.abort`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · execute · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Safe stop + rollback for running execution. Requires lease or session auth. P2.3 canonical gap fill.

### `forge_agent`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.agent`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Agent identity management. Modes: register, status, list, kill. F11 AUTH.

### `forge_approve`
- **class:** `governance` · **mutation:** `MUTATE`
- **surface:** `aforge.governance.approve`
- **kernel:** `888_JUDGE` → `arif_judge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · governance · MUTATE · kernel-supervised by 888_JUDGE (arif_judge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Refuses approval — A-FORGE cannot self-authorize. Route to arifOS arif_judge_deliberate via forge_judge_proxy instead.

### `forge_boundaries_assert`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.boundaries_assert`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Machine Constitution drift detector. Asserts live ports/services/cron against the saved Machine Constitution registry 

### `forge_browser_click`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_click`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Click a browser element. OBSERVE-class.

### `forge_browser_evaluate_js`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_evaluate_js`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Evaluate JS in browser context. OBSERVE-class.

### `forge_browser_extract_text`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_extract_text`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Extract text from browser page. OBSERVE-class.

### `forge_browser_navigate`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_navigate`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Navigate browser to URL. OBSERVE-class.

### `forge_browser_screenshot`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_screenshot`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Take a browser screenshot. OBSERVE-class.

### `forge_browser_type`
- **class:** `browser` · **mutation:** `OBSERVE`
- **surface:** `aforge.browser.browser_type`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · browser · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Type text into a browser element. OBSERVE-class.

### `forge_chart`
- **class:** `meta` · **mutation:** `OBSERVE`
- **surface:** `aforge.meta.chart`
- **kernel:** `333_THINK` → `arif_think`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · meta · OBSERVE · kernel-supervised by 333_THINK (arif_think). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Agentic charting + quantum eureka discovery margin patterns. Input data series or records; returns SVG + summary + eureka_c

### `forge_check_governance`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.check_governance`
- **kernel:** `555_CRITIQUE` → `arif_critique`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 555_CRITIQUE (arif_critique). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Constitutional governance check — delegates to arifOS. A-FORGE NEVER adjudicates constitutional floors.

### `forge_docker`
- **class:** `docker` · **mutation:** `MUTATE`
- **surface:** `aforge.docker.docker`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · docker · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Canonical Docker primitive. Modes: ps, logs, exec, images. Destructive operations stay out of this read/exec surface.

### `forge_docket_prep`
- **class:** `meta` · **mutation:** `OBSERVE`
- **surface:** `aforge.meta.docket_prep`
- **kernel:** `888_JUDGE` → `arif_judge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · meta · OBSERVE · kernel-supervised by 888_JUDGE (arif_judge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Package all evidence and hand off to arifOS. A-FORGE RELINQUISHES CONTROL — docket is read-only.

### `forge_docs_lookup`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.docs_lookup`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Governed docs lookup via Context7. OBSERVE-class.

### `forge_document_ingest`
- **class:** `meta` · **mutation:** `OBSERVE`
- **surface:** `aforge.meta.document_ingest`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · meta · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Document intelligence engine — layout-first parsing with bounding-box provenance.

Modes:
  analyze  — Layout analysis only

### `forge_evaluate`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.evaluate`
- **kernel:** `333_THINK` → `arif_think`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 333_THINK (arif_think). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. APEX v36Ω evaluation gate. Computes G = A·P·E·X·Φ (Nash bargaining product) and C_dark = A·(1-P)·(1-X) for a candidat

### `forge_execute`
- **class:** `execute` · **mutation:** `MUTATE`
- **surface:** `aforge.execute.execute`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=True approval=True
- **desc:** ACTUATOR · execute · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=Y approval=Y. Execution and motor cortex (Stage 777 FORGE). Use this to execute an action plan. Requires cc_id for mutations (INV-4).

### `forge_execute_sealed`
- **class:** `execute` · **mutation:** `MUTATE`
- **surface:** `aforge.execute.execute_sealed`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=True approval=True
- **desc:** ACTUATOR · execute · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=Y approval=Y. Execute with VAULT999 seal. FAILS HARD without valid seal — no self-authorization possible.

### `forge_fetch`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.fetch`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Governed URL evidence intake + self-hosted web search. Modes: html, markdown, text, json, readable, metadata, links

### `forge_fetch_json`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.fetch_json`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Fetch a URL and parse as JSON. OBSERVE-class, SSRF-protected. Equivalent to forge_fetch(mode=json).

### `forge_fetch_links`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.fetch_links`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Extract all links from a URL. OBSERVE-class, SSRF-protected. Equivalent to forge_fetch(mode=links).

### `forge_fetch_metadata`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.fetch_metadata`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Fetch URL metadata (title, author, description, dates, links). OBSERVE-class, SSRF-protected. Equivalent to forge_f

### `forge_fetch_url`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.fetch_url`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Fetch a URL and return content as markdown. OBSERVE-class, SSRF-protected. Equivalent to forge_fetch(mode=readable)

### `forge_filesystem`
- **class:** `fs` · **mutation:** `OBSERVE`
- **surface:** `aforge.fs.filesystem`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · fs · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Canonical governed filesystem primitive. Modes: read, write, patch, glob, grep, stat, tree, move, delete, restore. F8 scoped 

### `forge_filesystem_delete`
- **class:** `fs` · **mutation:** `MUTATE`
- **surface:** `aforge.fs.filesystem_delete`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=True approval=True
- **desc:** ACTUATOR · fs · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=Y approval=Y. Delete a file (quarantine by default). IRREVERSIBLE for hard delete — requires 888_HOLD.

### `forge_filesystem_move`
- **class:** `fs` · **mutation:** `MUTATE`
- **surface:** `aforge.fs.filesystem_move`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · fs · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Move a file or directory. EXECUTE-class, requires lease. Reversible.

### `forge_filesystem_patch`
- **class:** `fs` · **mutation:** `MUTATE`
- **surface:** `aforge.fs.filesystem_patch`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · fs · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Surgical text replacement in a file. EXECUTE-class, requires lease. Returns diff preview in dry_run mode.

### `forge_filesystem_read`
- **class:** `fs` · **mutation:** `OBSERVE`
- **surface:** `aforge.fs.filesystem_read`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · fs · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Read a file or list a directory. OBSERVE-class, no lease required. F8 scoped to /root, /tmp, /data, /var/log.

### `forge_filesystem_search`
- **class:** `fs` · **mutation:** `OBSERVE`
- **surface:** `aforge.fs.filesystem_search`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · fs · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Search file contents by regex pattern. OBSERVE-class, no lease required.

### `forge_filesystem_stat`
- **class:** `fs` · **mutation:** `OBSERVE`
- **surface:** `aforge.fs.filesystem_stat`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · fs · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Get file/directory metadata including sha256 hash. OBSERVE-class, no lease required.

### `forge_filesystem_tree`
- **class:** `fs` · **mutation:** `OBSERVE`
- **surface:** `aforge.fs.filesystem_tree`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · fs · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. List directory tree structure. OBSERVE-class, no lease required.

### `forge_filesystem_write`
- **class:** `fs` · **mutation:** `MUTATE`
- **surface:** `aforge.fs.filesystem_write`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · fs · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Create or overwrite a file. EXECUTE-class, requires lease. F1 AMANAH: backup before overwrite.

### `forge_fingerprint_check`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.fingerprint_check`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Compute and verify tool fingerprints. Detects duplicate tools (same name + schema) and schema drift.

### `forge_git`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.git`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Canonical git primitive. Modes: status, diff, log, commit. Mutating modes are floor-gated by A-FORGE MCP ingress.

### `forge_github`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.github`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Canonical GitHub primitive. Modes: search, pr. Use type for search variants instead of separate tools.

### `forge_github_create_issue`
- **class:** `git` · **mutation:** `MUTATE`
- **surface:** `aforge.git.github_create_issue`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · git · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Create a GitHub issue. MUTATE — lease required.

### `forge_github_create_or_update_file`
- **class:** `git` · **mutation:** `MUTATE`
- **surface:** `aforge.git.github_create_or_update_file`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · git · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Create or update a file on GitHub. MUTATE — lease required.

### `forge_github_create_pull_request`
- **class:** `git` · **mutation:** `MUTATE`
- **surface:** `aforge.git.github_create_pull_request`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · git · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Create a GitHub pull request. MUTATE — lease required.

### `forge_github_get_file`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.github_get_file`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Read a file from GitHub. OBSERVE-class.

### `forge_github_search_code`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.github_search_code`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Search GitHub code. OBSERVE-class.

### `forge_github_search_repos`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.github_search_repos`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Search GitHub repositories. OBSERVE-class.

### `forge_health_check`
- **class:** `health` · **mutation:** `OBSERVE`
- **surface:** `aforge.health.health_check`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · health · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Return A-FORGE server health and constitutional genome (v2.0) status.

### `forge_heart_critique`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.heart_critique`
- **kernel:** `555_CRITIQUE` → `arif_critique`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 555_CRITIQUE (arif_critique). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Risk assessment and ethical review — delegates to arifOS 666 HEART pipeline. A-FORGE does NOT adjudicate floors

### `forge_isomorphism_check`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.isomorphism_check`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. J‑space manifold stability check. Verifies GEOX ↔ arifOS isomorphism pairs (Identity, Authority, Irreversibility) thro

### `forge_job`
- **class:** `job` · **mutation:** `OBSERVE`
- **surface:** `aforge.job.job`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · job · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Background job system. Modes: submit, status.

### `forge_journalctl`
- **class:** `vps` · **mutation:** `OBSERVE`
- **surface:** `aforge.vps.journalctl`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vps · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Query systemd journal logs (read-only, PII-redacted). Modes: logs, errors, tail, grep.

### `forge_judge_proxy`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.judge_proxy`
- **kernel:** `888_JUDGE` → `arif_judge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 888_JUDGE (arif_judge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Proxy forwarder to canonical arifOS constitutional judge.

### `forge_lease`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.lease`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Lease lifecycle. Modes: request, status, revoke. A-FORGE does not self-issue leases — arifOS mints them.

### `forge_lock`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.lock`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Amanah/F1 lock primitive. Modes: acquire (reversible F1 gate before mutation), release (free lock).

### `forge_memory`
- **class:** `memory` · **mutation:** `OBSERVE`
- **surface:** `aforge.memory.memory`
- **kernel:** `MEMORY` → `arif_memory`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · memory · OBSERVE · kernel-supervised by MEMORY (arif_memory). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Canonical memory primitive. Modes: recall. Reads VAULT999 local files, then vault999-api fallback.

### `forge_minimax_search`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.minimax_search`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Search the web via MiniMax. OBSERVE-class.

### `forge_netdata_alarms`
- **class:** `health` · **mutation:** `OBSERVE`
- **surface:** `aforge.health.netdata_alarms`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · health · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Read Netdata alarms. OBSERVE-class.

### `forge_netdata_metrics`
- **class:** `health` · **mutation:** `OBSERVE`
- **surface:** `aforge.health.netdata_metrics`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · health · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Read Netdata chart data. OBSERVE-class.

### `forge_pipeline_run`
- **class:** `execute` · **mutation:** `MUTATE`
- **surface:** `aforge.execute.pipeline_run`
- **kernel:** `444_ROUTE` → `arif_route`
- **gates:** session=True lease=True seal=True approval=True
- **desc:** ACTUATOR · execute · MUTATE · kernel-supervised by 444_ROUTE (arif_route). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=Y approval=Y. Autonomous intelligence pipeline (canonical). Routes organs, evidence→compute→(optional judge+seal). Requires cc_id/hold 

### `forge_policy`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.policy`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Governed MCP Policy Engine. Modes: check (simulate call), set (add/update policy, sovereign-only), remove (delete pol

### `forge_postgres`
- **class:** `db` · **mutation:** `OBSERVE`
- **surface:** `aforge.db.postgres`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · db · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Canonical Postgres primitive. Modes: query, schema. Writes require mutate=true and remain floor-gated.

### `forge_predict`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.predict`
- **kernel:** `333_THINK` → `arif_think`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 333_THINK (arif_think). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Pre-action simulation layer (prediction bridge). GEOX/WEALTH forward models run BEFORE forge_execute. Result attached

### `forge_probe`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.probe`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Federation organ liveness. Probes all 5 organs + latency. OBSERVE-class. P2.1 canonical gap fill.

### `forge_probe_site`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.probe_site`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Probe a web site or cockpit surface for federation resilience and compliance checks. Returns status, static fallbacks,

### `forge_reality_loop`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.reality_loop`
- **kernel:** `333_THINK` → `arif_think`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 333_THINK (arif_think). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Intent compiler: 7-stage state-tracking ledger (MEANING→OBSERVE→ENCODE→IMPROVE→VERIFY→SEAL→RETURN). Modes: start | ad

### `forge_receipt_draft`
- **class:** `vault` · **mutation:** `OBSERVE`
- **surface:** `aforge.vault.receipt_draft`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vault · OBSERVE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Draft a structured compliance receipt for a deployment or change. Output is standard markdown formatted for arifOS VAULT999 

### `forge_register`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.register`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. APEX v36Ω gated registration gate. Registers a tool ONLY after all gates pass: SEAL verdict from forge_evaluate, CONS

### `forge_registry`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.registry`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Dynamic skill registry. Modes: list (all generated tools + Decision Field), get (one tool manifest), scars (Scar Law 

### `forge_registry_status`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.registry_status`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Full A-FORGE tool registry: callable, blocked, degraded, and drift status for all registered tools. Includes tool fin

### `forge_research`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.research`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Governed research across web sources. OBSERVE-class.

### `forge_sandbox_run`
- **class:** `execute` · **mutation:** `MUTATE`
- **surface:** `aforge.execute.sandbox_run`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · execute · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Execute staged artifact in isolated sandbox. ABSOLUTE timeout — cannot be overridden.

### `forge_scan`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.scan`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Security scan a file or directory before code execution. Detects dangerous patterns. OBSERVE-class. P2.5 canonical gap

### `forge_scar`
- **class:** `vault` · **mutation:** `OBSERVE`
- **surface:** `aforge.vault.scar`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vault · OBSERVE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. APEX v36Ω scar metabolization gate. Seals failures as permanent constitutional constraints. Modes: seal (record failure), li

### `forge_scar_scan`
- **class:** `vault` · **mutation:** `OBSERVE`
- **surface:** `aforge.vault.scar_scan`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vault · OBSERVE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Check artifact against SCAR database. A-FORGE detects but CANNOT judge — arifOS judges.

### `forge_seal`
- **class:** `vault` · **mutation:** `MUTATE`
- **surface:** `aforge.vault.seal`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=True seal=True approval=True
- **desc:** ACTUATOR · vault · MUTATE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=Y approval=Y. Seal a Tri-Witness validated skill into permanent VAULT999 memory. Irreversible. Sealed skills cannot be deleted, demoted bel

### `forge_search`
- **class:** `research` · **mutation:** `OBSERVE`
- **surface:** `aforge.research.search`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · research · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Governed web search via Brave. OBSERVE-class.

### `forge_send_confirm`
- **class:** `confirm` · **mutation:** `OBSERVE`
- **surface:** `aforge.confirm.send_confirm`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · confirm · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Send data with human confirmation via elicitation. Supports form mode (standard) and URL mode (sensitive credentials). F

### `forge_session_init`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.session_init`
- **kernel:** `000_INIT` → `arif_init`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 000_INIT (arif_init). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Constitutional session ignition. Proxies to arifOS kernel — A-FORGE no longer mints independent sessions. (Stage 000 IN

### `forge_shell`
- **class:** `shell` · **mutation:** `MUTATE`
- **surface:** `aforge.shell.shell`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · shell · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Canonical governed shell execution. Executes commands through constitutional gate (ArifJudge) + hash-chain audit (ArifSeal)

### `forge_shell_alert_history`
- **class:** `shell` · **mutation:** `OBSERVE`
- **surface:** `aforge.shell.shell_alert_history`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · shell · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. View recent ArifJudge alert history (DENY/GATE/self-modification events). Read-only.

### `forge_shell_dryrun`
- **class:** `shell` · **mutation:** `OBSERVE`
- **surface:** `aforge.shell.shell_dryrun`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · shell · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Preview a shell command's output WITHOUT executing it. Returns what WOULD happen. F1 AMANAH: no mutation, pure dry-run

### `forge_shell_ledger`
- **class:** `shell` · **mutation:** `OBSERVE`
- **surface:** `aforge.shell.shell_ledger`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · shell · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Query recent ArifSeal hash-chain ledger entries. Read-only, paged. Returns last N records with chain integrity status.

### `forge_shell_status`
- **class:** `shell` · **mutation:** `OBSERVE`
- **surface:** `aforge.shell.shell_status`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · shell · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Check forge_shell subsystem health: ledger state, judge pattern count, defaults.

### `forge_skill`
- **class:** `skill` · **mutation:** `OBSERVE`
- **surface:** `aforge.skill.skill`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · skill · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Dynamic tool forge (APEX Epoch 34Ω). Generates a new MCP tool via LLM, gated by HARAM scan + Decision Field (G=Q·V·Ψ·Φ), s

### `forge_skillstore_read`
- **class:** `skill` · **mutation:** `OBSERVE`
- **surface:** `aforge.skill.skillstore_read`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · skill · OBSERVE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Query artifact store. Semantic search with tag filtering.

### `forge_skillstore_write`
- **class:** `skill` · **mutation:** `MUTATE`
- **surface:** `aforge.skill.skillstore_write`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · skill · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Store artifact with provenance. WRITE mode only. Two-layer retention with SCAR immunization.

### `forge_stage`
- **class:** `vault` · **mutation:** `OBSERVE`
- **surface:** `aforge.vault.stage`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vault · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Move artifact to quarantine staging. Spec becomes IMMUTABLE after staging.

### `forge_status`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.status`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Active execution state: jobs, leases, agents. INFRA-class. P2.2 canonical gap fill.

### `forge_surface_audit`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.surface_audit`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Audit MCP tool surface: compare live registry vs affordances.yaml to detect phantom entries, missing tools, descriptio

### `forge_surface_guard`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.surface_guard`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. MCP Surface Guard — schema fingerprinting + drift detection. Modes: check (run federation drift check), status (get ca

### `forge_synthesize`
- **class:** `skill` · **mutation:** `OBSERVE`
- **surface:** `aforge.skill.synthesize`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · skill · OBSERVE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Create artifact from intent. Code goes to temporary buffer ONLY — never touches filesystem.

### `forge_systemctl`
- **class:** `vps` · **mutation:** `MUTATE`
- **surface:** `aforge.vps.systemctl_deprecated`
- **kernel:** `777_FORGE` → `777_FORGE`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** 

### `forge_tier_bind`
- **class:** `registry` · **mutation:** `OBSERVE`
- **surface:** `aforge.registry.tier_bind`
- **kernel:** `000_TRIAGE` → `arif_triage`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · registry · OBSERVE · kernel-supervised by 000_TRIAGE (arif_triage). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Set trust tier LOWER BOUND only. A-FORGE cannot promote — only arifOS sets actual tier.

### `forge_transfer_confirm`
- **class:** `confirm` · **mutation:** `MUTATE`
- **surface:** `aforge.confirm.transfer_confirm`
- **kernel:** `777_FORGE` → `arif_forge`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · confirm · MUTATE · kernel-supervised by 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Transfer funds with human confirmation via form-mode elicitation. F13 consent gate. Blocks until user accept/decline/canc

### `forge_vault`
- **class:** `vault` · **mutation:** `OBSERVE`
- **surface:** `aforge.vault.vault`
- **kernel:** `999_SEAL` → `arif_seal`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · vault · OBSERVE · kernel-supervised by 999_SEAL (arif_seal). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. VAULT999 primitive. Modes: read, list, write, seal.

### `forge_verify_timeline`
- **class:** `probe` · **mutation:** `OBSERVE`
- **surface:** `aforge.probe.verify_timeline`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · probe · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Verify timeline claims require minimum 2 independent sources.
TIMELINE_MIN_SOURCES invariant: No timeline claim with f

### `forge_vps_cron`
- **class:** `vps` · **mutation:** `MUTATE`
- **surface:** `aforge.vps.vps_cron`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · vps · MUTATE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Machine Constitution cron registry. Lists cron jobs from root crontab, /etc/crontab, and /etc/cron.d. OBSERVE-class; does

### `forge_vps_ports`
- **class:** `vps` · **mutation:** `MUTATE`
- **surface:** `aforge.vps.vps_ports`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · vps · MUTATE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Machine Constitution port registry. Scans listening ports and classifies each as public, internal, or unknown. OBSERVE-cl

### `forge_vps_services`
- **class:** `vps` · **mutation:** `MUTATE`
- **surface:** `aforge.vps.vps_services`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=True seal=False approval=True
- **desc:** ACTUATOR · vps · MUTATE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=Y gate=Y seal=N approval=Y. Machine Constitution service registry. Lists running systemd services and Docker containers. OBSERVE-class; does not muta

### `forge_wealth`
- **class:** `org_bridge` · **mutation:** `OBSERVE`
- **surface:** `aforge.org_bridge.wealth`
- **kernel:** `444_ROUTE` → `arif_route`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · org_bridge · OBSERVE · kernel-supervised by 444_ROUTE (arif_route). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Route to WEALTH capital intelligence organ. Modes: emv, conservation, flow, runway, wisdom.

### `forge_well`
- **class:** `org_bridge` · **mutation:** `OBSERVE`
- **surface:** `aforge.org_bridge.well`
- **kernel:** `444_ROUTE` → `arif_route`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · org_bridge · OBSERVE · kernel-supervised by 444_ROUTE (arif_route). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. WELL human readiness primitive. Routes to WELL organ (port 18083). Modes: state, readiness, floors, anchor.

### `forge_witness`
- **class:** `governance` · **mutation:** `OBSERVE`
- **surface:** `aforge.governance.witness`
- **kernel:** `888_JUDGE` → `arif_judge`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · governance · OBSERVE · kernel-supervised by 888_JUDGE (arif_judge). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. APEX v36Ω tri-witness consensus gate. Computes W³ = ∛(Human × AI × External) via geometric mean (Nash 1950). Returns 

### `forge_worktree`
- **class:** `git` · **mutation:** `OBSERVE`
- **surface:** `aforge.git.worktree`
- **kernel:** `111_OBSERVE` → `arif_observe`
- **gates:** session=True lease=False seal=False approval=False
- **desc:** ACTUATOR · git · OBSERVE · kernel-supervised by 111_OBSERVE (arif_observe). Not a plugin. Not a kernel verb. A-FORGE hands only. Gates: session=Y lease=N gate=Y seal=N approval=N. Local git physics sensor. Returns branch, dirty state, stash, conflicts, in-progress ops, blast radius, and actionable r
