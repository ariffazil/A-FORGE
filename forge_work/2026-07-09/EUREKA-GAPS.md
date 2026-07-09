# APA Eureka Gaps — What The Session Revealed

> **FORGE (000Ω) · 2026-07-09 · Post-session reflection**

---

## GAP 1: ACT Rollback Per Verb

**What:** The 7-phase ACT executor has a generic `_rollback()` that logs and flags. It doesn't actually reverse actions. Each IRREVERSIBLE verb needs an inverse operation.

**Why it matters:** If `merge_pr` fails at VERIFY, there's no automatic undo. The rollback just says "manual intervention needed."

**Eureka:** APA manifests already declare `reversible: true/false` and `endpoint`. The rollback could be auto-derived: if `create_issue` → `close_issue` is the inverse. If `merge_pr` → no inverse (truly irreversible). The manifest IS the rollback map.

**Fix:** `act_executor.py` reads `reversible` from the YAML manifest and attempts auto-rollback for `reversible: true` verbs.

---

## GAP 2: Provider Portability Not Tested

**What:** APA claims "change 1 URL to switch providers." This is architectural truth but not empirically proven.

**Why it matters:** The ILMU lesson: claims without evidence are the sovereign vendor pattern. APA must not become what it critiques.

**Eureka:** Test Calendar with Radicale (self-hosted CalDAV). Test Email with a non-Gmail IMAP provider. If both work, APA's portability claim is verified.

**Fix:** Deploy Radicale on af-forge, switch calendar_bridge.py URL, verify `list_events` still works.

---

## GAP 3: Lease Engine Not Wired to arifOS Kernel

**What:** `lease_engine.py` works standalone but doesn't call `arif_judge` for constitutional validation. Leases are issued without kernel judgment.

**Why it matters:** The reflex arc says KERNEL judges before APA constrains. Currently lease_engine self-issues leases. This is "A-FORGE self-authorizing" — the exact constitutional violation the doctrine forbids.

**Eureka:** The `activate()` method should POST to arifOS:8088 for `arif_judge` before setting status=ACTIVE. This closes the KERNEL→APA gap.

**Fix:** `lease_engine.py` → `activate()` → HTTP POST to `arif_judge` → only set ACTIVE on SEAL verdict.

---

## GAP 4: VAULT999 Receipt Schema Not Standardized

**What:** Each bridge writes receipts differently. No unified schema for `{lease_id, verb, result, sha256}`.

**Why it matters:** Without a standard receipt schema, cross-connector audit is impossible. An agent can't answer "what did APA do in the last 24 hours?" without parsing 4 different formats.

**Eureka:** The ACT executor's `_receipt()` method already produces a schema. Standardize it and enforce it at the bridge level.

**Fix:** `apa/core/receipt.py` — single `ReceiptSchema` class that all bridges must use.

---

## GAP 5: No Connector Discovery

**What:** Agents must know connector names and verbs a priori. There's no `forge_connector_list()` or `forge_connector_manifest("github")`.

**Why it matters:** Composio's value prop is "1,000+ tools, discoverable." APA's counter is "quality over quantity." But even 4 connectors need discovery. An agent should be able to ask "what external systems can I touch?"

**Eureka:** The YAML manifests are already machine-readable. `forge_registry` could scan `apa/manifests/*.yaml` and return available connectors + verbs.

**Fix:** Add `apa/core/discovery.py` → reads all YAML manifests → returns connector catalog.

---

## GAP 6: The 33-Surface Doctrine Needs Automation

**What:** The 33-app audit is a static markdown document. It should be a live probe.

**Why it matters:** If a machine-layer app goes down (Redis, Caddy), the audit should reflect it. Static ≠ sovereign.

**Fix:** `forge_health_check` extended to probe all 33 surfaces and return live scorecard.

---

## PRIORITY

| # | Gap | Impact | Effort |
|---|-----|:------:|:------:|
| 1 | Lease → arifOS kernel | **CRITICAL** — constitutional gap | 1 hour |
| 2 | Standard receipt schema | HIGH — audit integrity | 1 hour |
| 3 | Connector discovery | MEDIUM — agent UX | 1 hour |
| 4 | ACT rollback per verb | MEDIUM — reversibility | 2 hours |
| 5 | Provider portability test | LOW — truth claim verification | 2 hours |
| 6 | 33-surface live probe | LOW — monitoring | 2 hours |

---

*DITEMPA BUKAN DIBERI — Gaps are not failures. They are the next forge.*
