# PR-FED-1 — Attribution & Lineage Convergence Specification

- **Reference:** `ARIFOS::FED_PR1_CONVERGENCE_EXECUTION::2026-11-22`
- **Authority:** ARIF (F13 Human Sovereign)
- **Mode:** `GOVERNED_CODE_EXECUTION | ISOLATED_WORKTREE | NO_LIVE_DEPLOY`
- **Status:** `READY_FOR_REVIEW` (PR ONLY — NO MERGE, NO LIVE DEPLOY, NO SERVICE RESTART)

---

## 1. Baseline & Live-State Isolation Receipt `[OBS]`

- **Worktree:** `/root/worktrees/agy-cli/A-FORGE-pr-fed-1/`
- **Repository:** `https://github.com/ariffazil/A-FORGE.git`
- **Branch:** `agy-cli/pr-fed-1-attribution-lineage`
- **Starting HEAD:** `9ba25f6616b2f807220d6589ccb3062dfaff6a09` (`main`)
- **Concurrent Writer Check:** Zero active writers or `.lock` files in worktree (`lsof` / `ps` verified).
- **Live Isolation Proof:**
  - Worktree is strictly separate from live `/root/A-FORGE` and `/opt`.
  - Zero edited files are symlinks resolving into `/root/A-FORGE` or `/opt`.
  - All tests use `tmp_path` SQLite DBs, synthetic credentials, and offline LiteLLM stubs.
  - Uncommitted live diff in `/root/A-FORGE/litellm-config.yaml` (`SHA-256: 252ee1b8b11f87edc050e40fbcb7258d0ba6b6f51fa74a8f85cab693cec4c383`) was observed read-only and left completely untouched (out of scope).

### Baseline File Hashes (Pre-Convergence)

| File | Baseline SHA-256 |
|---|---|
| `scripts/fed_attribution_callback.py` | `a78016cad8cc66cfed55995c4769d9a1a5f63b2f37b5b3c9efb8d9391f5c6f10` |
| `tests/fed/test_pr_fed_1_attribution.py` | `a56a9fa7080bef3fb72bc08dea9a92a5f40797cbb7ee34d059e2acf091e504e8` |
| `scripts/fed_token_reconciliation.py` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (0 bytes) |
| `scripts/fed_spend_callback.py` | `6c0216e548704352f3b9a4cbcff5d2ec8cad6ec412153f6db54f8cab695574a9` |
| `hooks/pre-commit-lsp-gate.sh` | `b6007a7d65130e0ced1bd7e2f36f8301042d59ce44e0aea31a8e2dc83c8d0029` |

---

## 2. Convergence Decision (A + B + C → ONE Canonical Write Path)

### Three Prior Implementations Inspected `[OBS]`
- **A. PR #120 (`scripts/fed_spend_callback.py` on `stab-round2-item4-telemetry-split`):** P1.5-B precedence (`explicit metadata > vk-alias > GROUP_AGENT_MAP > unknown`), `CONTRADICTION` fail-closed, `HOST_MAP`, 10-column SQLite writer.
- **B. KVM4 Schema & Writer (`100.64.0.5:/root/A-FORGE/scripts/data/`):** 23-column / 32-column `token_bank_spend` table with `/app/data` mounted read-only; older 15 KB callback swallowing write failures silently (`except Exception: pass`).
- **C. PR-FED-1 Worktree (`scripts/fed_attribution_callback.py`):** 34+ column lineage callback with provider taxonomy, cost classes, and microsecond UTC timestamps (interrupted draft had a 44-vs-41 SQL column mismatch and treated caller headers as resolved identity).

### Explicit Relationship to PR #120
- **PR-FED-1 supersedes the `scripts/fed_spend_callback.py` attribution portion of PR #120.**
- PR-FED-1 **does NOT require PR #120 first**: it incorporates PR #120's P1.5-B precedence (`explicit_trusted_metadata > verified_credential/vk-alias > approved_lane_group > UNKNOWN`), `GROUP_AGENT_MAP`, `HOST_MAP`, and fail-closed `CONTRADICTION` policy directly into `scripts/fed_attribution_callback.py`, and converts `scripts/fed_spend_callback.py` into a thin compatibility adapter delegating to `fed_attribution_callback.py`.
- PR #120's unrelated TypeScript MCP telemetry split files remain separate and untouched by PR-FED-1.

### Canonical Write Path & Retained Adapters
- **Single Canonical Writer:** `scripts/fed_attribution_callback.py` (`write_spend_row` / `FedAttributionCallback`).
- **Retained Adapters:**
  - `scripts/fed_spend_callback.py`: thin delegating adapter preserving `HOST_MAP`, `GROUP_AGENT_MAP`, `_resolve_provider`, `_resolve_agent`, and `FedSpendCallback` (deduplicated by `inner_attempt_id` so no duplicate row can ever be written).
  - `project_canonical_to_kvm4()` & `adapt_kvm4_row_to_canonical()`: bidirectional KVM4 23-column compatibility adapters.

---

## 3. Compatibility Matrix (A / B / C → Canonical)

| Field | Meaning | Producer | Trust Source | Precedence | Nullable | Contradiction Behavior | Storage | Privacy | Consumer | Migration Impact |
|---|---|---|---|---|---|---|---|---|---|---|
| `actor_claimed` | Caller-supplied identity claim | Caller headers / untrusted metadata / tags | Untrusted caller | Header → metadata → tags → service → `UNKNOWN` | No (`UNKNOWN`) | Preserved alongside `CONTRADICTION` | `token_bank_spend` | Internal ID only (secret-scrubbed) | Audit / spoof detection | Additive column |
| `actor_resolved` | Verified actor identity | Gateway / auth layer | Trusted metadata / credential / `GROUP_AGENT_MAP` | `explicit_trusted_metadata` → `verified_credential` → `approved_lane_group` → `UNKNOWN` | No (`UNKNOWN` / `CONTRADICTION`) | Fail-closed (`CONTRADICTION`); never overwritten by unverified claim | `token_bank_spend` | Internal ID only | FED / CHRON / billing | Additive column |
| `actor_resolution_source` | Which trusted tier resolved actor | Callback | Derived from auth layer | Matches `actor_resolved` | No | `CONTRADICTION` | `token_bank_spend` | Non-PII enum | Audit / BL12 | Additive column |
| `actor_verification_state` | Verification status | Callback | Derived | `VERIFIED` / `CLAIMED_UNVERIFIED` / `CONTRADICTION` / `UNKNOWN` | No | `CONTRADICTION` (+ HTTP 403 in strict mode) | `token_bank_spend` | Non-PII enum | FED / FRAME | Additive column |
| `session_id` / `task_id` / `purpose` / `trace_id` | Lineage correlation IDs | Caller / gateway | Sanitised metadata | Header → metadata → tags | Empty string | N/A | `token_bank_spend` | Secret-scrubbed, no prompts | CHRON / FRAME / audit | Already in KVM8/KVM4 |
| `capability_id` / `task_class` | A2A capability & task classification | Caller / A2A envelope | Sanitised metadata | Header → metadata → tags | Empty string | N/A | `token_bank_spend` | Non-PII slug | FED / CHRON BL12 | Additive columns |
| `transport_protocol` / `entry_gateway` / `serving_provider` | Split transport vs door vs real provider | Callback | Response provider → verified direct host → `UNKNOWN` | Never `"openai"` from transport alone | No (`UNKNOWN` / `other`) | Explicit `UNKNOWN` if unverified intermediary | `token_bank_spend` | Hostname only (`api_base_host_redacted`) | FED / cost reports | Additive / aligned |
| `deployment_id` | PR-FED-2 `model_info.id` | LiteLLM config / hidden params | Config `model_info.id` | Validated against PR-FED-2 / safe regex | Empty if absent | `INVALID_DEPLOYMENT_ID` + `deployment_id_valid=0` | `token_bank_spend` | Non-PII ID | PR-FED-2 / FED | Additive (`deployment_id_valid`) |
| `failure_domain` / `fallback_used` / `fallback_edge_id` | Physical failure domain & fallback edge | Callback | Verified host/intermediary + config edges | Declared edge → `UNKNOWN_EDGE:...` | Empty if no fallback | Undeclared edge flagged visibly | `token_bank_spend` | Hostname only | PR-FED-2 / reliability | Additive columns |
| `outer_attempt_id` / `inner_attempt_id` / `attempt_layer` | Attempt hierarchy & idempotency key | Caller + LiteLLM | `logical_request_id` / `litellm_call_id` | Deduplicates retries & duplicate callbacks | `inner_attempt_id` nullable if absent | Duplicate `inner_attempt_id` returns `deduplicated=True` | `token_bank_spend` (indexed) | Non-PII UUID/ID | Reconciliation | Additive + index |
| `attempted_*` / `replayed_*` / `unique_*` / `accepted_*` tokens | Explicit token semantics | Provider usage + cache state + downstream acceptance | Response `usage` + cache status | `accepted_*` ALWAYS `NULL` at inference time | Yes (`NULL` when unavailable; never manufactured 0) | Unknown cache state leaves `unique_*` `NULL` | `token_bank_spend` | Numeric counts only | Token reconciliation / CFO | Additive columns |
| `cost_evidence_class` / `cost_provenance` | Economic cost classification | Callback | Plan/quota markers → provider cost → LiteLLM calc → `UNKNOWN_COST` | Never labels prepaid usage `"free"` | No (`UNKNOWN_COST`) | Explicit `UNKNOWN_COST` | `token_bank_spend` | Non-PII enum | WEALTH / FED | Canonicalized enum |
| `outcome_state` / `accepted_by` / `acceptance_*` | Downstream acceptance separation | Downstream verifier ONLY | `record_downstream_acceptance(authorized_downstream=True)` | Producer ALWAYS writes `outcome_pending` + `NULL` | Yes (`NULL` until accepted) | Producer spoof stripped + flagged; unauthorized call raises | `token_bank_spend` | Internal ID only | CHRON / BL12 | Additive columns |
| `called_at` | UTC ISO-8601 microsecond timestamp | Callback | `datetime.now(timezone.utc)` | Validated via `validate_utc_timestamp()` | No | Invalid / literal `%f` raises `ValueError` | `token_bank_spend` | Non-PII timestamp | All consumers | Legacy `.%fZ` quarantined read-only |

---

## 4. Pre-Commit Gate Diagnosis & Repair `[OBS]`

- **Root Cause of PR-FED-2 `--no-verify`:** PR-FED-2's worktree git config carried a stale/misspelled 33-byte email (`arifazil@users.noreply.github.com`) vs the 44-byte registered email (`210893902+ariffazil@users.noreply.github.com`), and PII redaction obscured the mismatch.
- **Minimal Repair (`hooks/pre-commit-lsp-gate.sh` in PR-FED-1 worktree):**
  - Enforces non-empty `user.email` alongside `user.name` and `user.signingkey`.
  - Passes identity strings via `ENVIRON` instead of `awk -v` (preventing backslash escape issues) and strips only trailing `\r` from registry lines without weakening exact byte-equality.
  - Emits explicit byte-length diagnostics on mismatch.
  - Verified by `tests/fed/test_precommit_lane_gate.py` (4/4 deterministic fixtures).

---

## 5. Post-PR Shadow Validation Plan (NOT AUTHORIZED — DO NOT EXECUTE)

> **STATUS: PLAN ONLY. NOT AUTHORIZED FOR EXECUTION.**

1. **Exact Artifact to Deploy:** `scripts/fed_attribution_callback.py` + `scripts/fed_spend_callback.py` (from reviewed & merged PR-FED-1 commit SHA).
2. **Target Host & Service:** KVM8 (`af-forge`, `100.64.0.2`), `litellm-federation.service` (`:4013` behind HAProxy `:4000`). Secondary standby KVM4 (`100.64.0.5`) only after IRFANclaw completes `ro→rw` mount fix.
3. **Maintenance / Restart Required:** Controlled reload/restart of `litellm-federation.service` (separate F13 authorization required).
4. **Pre-Deploy DB Backup:** `sqlite3 /root/.local/share/arifos/token_bank.db ".backup '/root/.local/share/arifos/token_bank.db.bak-<UTC>'"` + record SHA-256.
5. **Schema Migration Behavior:** Idempotent, additive `ALTER TABLE ... ADD COLUMN` via `ensure_attribution_schema()` on first write; zero historical rows modified or backfilled.
6. **Rollback:** Restore backed-up `/root/.local/share/arifos/fed_attribution_callback.py.bak-*` and restart `litellm-federation.service` (additive columns remain harmlessly nullable).
7. **Expected First Attributed Rows:**
   - First-party callers with virtual keys / trusted metadata emit `actor_verification_state='VERIFIED'`, `actor_resolved != 'UNKNOWN'`, `outcome_state='outcome_pending'`, `accepted_by IS NULL`.
   - Unauthenticated callers emit explicit `actor_resolved='UNKNOWN'` (zero silent defaults).
8. **Comparison vs Legacy Rows:** Legacy 49,386 `.%fZ` rows remain untouched and classify as `LEGACY_MALFORMED_LITERAL_PERCENT_F`; all new rows match `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$`.
9. **Sample Size & Freshness:** Minimum `n >= 20` fresh post-deploy rows within 30 minutes across interactive + background callers.
10. **Zero Silent Defaults & Duplicate-Write Detection:** Verify `COUNT(*) == COUNT(DISTINCT inner_attempt_id)` for post-deploy rows and 0 rows with `provider_name='openai'` on non-`api.openai.com` hosts.
11. **Token-Semantic Reconciliation:** Run `summarize_ledger_tokens_readonly()` confirming `attempted >= unique`, `replayed > 0` on cache hits with `unique == 0`, and `accepted_input_tokens IS NULL` until downstream acceptance.
12. **Secret-Leakage Checks:** Grep new `fed_attribution_log.jsonl` and new DB rows for `Bearer `, `sk-`, `api_key=`, prompt/response text → must be 0 hits.
13. **Before/After 404 & Latency:** Compare `litellm-federation` journal HTTP status distribution and p50/p95 latency (excluding negative-control ports `58402`/`42960`).
14. **Independent Witness:** 555-ASI / FRAME independent probe verifying live DB rows against request `trace_id`.
15. **Human Acceptance Boundary:** F13 (Muhammad Arif bin Fazil) reviews shadow witness receipt before constitutional SEAL or PR-FED-4 unlock.

---

## 6. Explicit Holds (Not Touched by PR-FED-1)

- Historical backfill of 49,386 malformed `.%fZ` timestamp rows
- Production restart of LiteLLM or FED
- Production deployment of PR-FED-1
- Merge of PR-FED-1
- Deletion of fallback edges (PR-FED-2)
- Langfuse live environment mutation (PR-FED-3)
- `fed_contrast` live deployment
- `mcp-compressor` retirement
- PR-FED-4 OpenRouter pilot
- BL12 activation
- `fq = 1.253` adjudication
- Secret rotation
- Disposition of uncommitted live `/root/A-FORGE/litellm-config.yaml` diff
- Attribution of unexplained 08:10Z container restart
