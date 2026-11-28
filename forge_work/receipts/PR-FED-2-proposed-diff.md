# PR-FED-2 Proposed Diff — Deployment Identity & Fallback Hygiene

**Config SHA256 (baseline)**: `26b84d6b67b3b563e13ae05bcf12933e3943cb312242ff651f5abc2457721d80`
**Branch**: `pr-fed-2-deployment-identity`
**Mode**: PROPOSED DIFF ONLY — NOT APPLIED
**Lease**: F13 titah 2026-11-22, scope PR-FED-2 feature branch only

---

## Summary of Proposed Changes

| Change Type | Count | Description |
|-------------|-------|-------------|
| Add `model_info.id` | 168 | Stable deterministic IDs for all model_list entries |
| Remove FALSE_LOOP primary groups | 13 | Primary groups with zero active deployments |
| Prune SAME_ENDPOINT edges | 12 | Fallbacks pointing to identical endpoint+credentials |
| Flag SAME_CREDENTIAL edges | 6 | Annotate shared-credential fallbacks for monitoring |
| Add typed cooldown config | 6 | Per-exception cooldown: 401/402, 429, 403, 5xx, Timeout, Default |
| Update retry_policy | — | Explicit zero retries for auth/notfound/contentpolicy |
| Add audit metadata | 1 | Fallback classification audit trail |

---

## 1. model_info.id Assignments (ALL 168 entries)

```yaml
# For each entry in model_list, add:
model_info:
  id: "<model_name_sanitized>-<index:03d>-<sha256(model_name|index|model|api_base)[:12]>"
```

Example:
```yaml
- model_name: apex-888
  litellm_params:
    model: openai/deepseek/deepseek-v4.1-flash
    api_base: https://openrouter.ai/api/v1
    api_key: os.environ/OPENROUTER_API_KEY
    order: 1
  model_info:
    id: "apex-888-000-56c8f32d7b61"  # NEW
    notes: "apex-888 P1 (OpenRouter): DeepSeek-V4.1 via OpenRouter free tier. Judge lane primary."
    cost_class: "free"
    price_status: "active"
```

Full list in `PR-FED-2-identity-inventory-receipt.md`.

---

## 2. router_settings.fallbacks — Pruned (remove 13 groups, 12 edges)

### REMOVE: 13 Primary Groups with ZERO Active Entries (31 FALSE_LOOP edges)

```yaml
# DELETE these entire fallback groups from router_settings.fallbacks:
- qwen3.8-max:           # 3 edges
- qwen3.6-plus:          # 3 edges
- mimo-v2.5-pro:         # 2 edges
- mimo-v2.6-pro-ultraspeed:  # 1 edge
- mimo-v2.6-pro-payg:    # 1 edge
- mimo-v2.6-flash-payg:  # 1 edge
- mimo-v2.5:             # 2 edges
- kimi-k3:               # 3 edges
- kimi-k3.1-pro:         # 3 edges
- kimi-k3.1-pro-highspeed:  # 2 edges
- MiniMax-M3:            # 3 edges
- MiniMax-M3.1-Flash-Preview:  # 3 edges
- qwen-auto:             # 4 edges
```

### PRUNE: 8 SAME_ENDPOINT Edges from Remaining Groups

```yaml
# In forge-scout: REMOVE 'mimo-v2.6-pro' (same MiMo token-plan endpoint)
# In forge-scout-pro: REMOVE 'mimo-v2.6-flash' (same MiMo token-plan endpoint)
# In forge-builder: REMOVE 'emergency-deepseek-v4-pro' (same DeepSeek endpoint)
# In forge-economy: REMOVE 'emergency-deepseek-v4-pro' (same DeepSeek endpoint)
# In opencode: REMOVE 'deepseek-v4-flash' (same DeepSeek endpoint)
# In hermes-asi: REMOVE 'deepseek-v4-flash' (same DeepSeek endpoint)
# In glm-5.2: REMOVE 'glm-5.3' (same ZAI endpoint)
# In fed/vision: REMOVE 'deepseek-v4-flash-vision' (same DeepSeek endpoint)
```

### RESULTING router_settings.fallbacks (20 groups, 50 edges)

```yaml
router_settings:
  fallbacks:
  - i-arif:
    - mimo-v2.6-pro
    - deepseek-v4-flash
    - glm-5.3-flash
    - sovereign-west
  - asi-555:
    - deepseek-v4-flash
    - glm-5.3
    - mimo-v2.6-flash
    - sovereign-west
  - apex-888:
    - glm-5.3
    - deepseek-v4-flash
    - sovereign-west
  - forge-777:
    - deepseek-v4-flash
    - glm-5.3
    - mimo-v2.6-flash
    - sovereign-west
  - forge-scout:
    - sovereign-west
  - forge-scout-pro:
    - sovereign-west
  - forge-builder:
    - glm-5.3
    - sovereign-west
  - forge-economy:
    - glm-5.3-flash
    - mimo-v2.6-flash
    - sovereign-west
  - forge-judge:
    - mimo-v2.6-flash
    - glm-5.3
    - sovereign-west
  - forge-planner:
    - glm-5.3-flash
    - mimo-v2.6-flash
    - sovereign-west
  - openclaw:
    - deepseek-v4-flash
    - glm-5.3-flash
    - mimo-v2.6-flash
    - sovereign-west
  - opencode:
    - forge-777
    - glm-5.3-flash
    - sovereign-west
  - hermes-asi:
    - glm-5.3
    - mimo-v2.6-flash
    - sovereign-west
  - mimo-v2.6-pro:
    - sovereign-west
  - mimo-v2.6-flash:
    - sovereign-west
  - glm-5.2:
    - mimo-v2.6-flash
    - sovereign-west
  - glm-5.3:
    - mimo-v2.6-flash
    - sovereign-west
  - fed/vision:
    - sovereign-west
  - hermes-asi-vision:
    - glm-5.3-flash
    - deepseek-v4-flash
    - sovereign-west
  - fed/sealion:
    - mimo-v2.6-flash
    - sovereign-west
```

---

## 3. SAME_CREDENTIAL Edge Flags (annotate, don't prune)

Add `fallback_edge_classifications` array to `router_settings` with per-edge metadata:

```yaml
router_settings:
  fallback_edge_classifications:
  - primary: "i-arif"
    fallback: "glm-5.3-flash"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/ZAI_API_KEY"
    primary_model_info_id: "i-arif-136-889c70553283"
    fallback_model_info_id: "glm-5-3-flash-125-115ca2e3db6e"
    note: "ZAI_API_KEY shared — 401/402 kills both"
  - primary: "asi-555"
    fallback: "glm-5.3"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/ZAI_API_KEY"
    primary_model_info_id: "asi-555-019-61f04bc5d9ec"
    fallback_model_info_id: "glm-5-3-103-bee34b92dde8"
    note: "ZAI_API_KEY shared — 401/402 kills both"
  - primary: "forge-777"
    fallback: "glm-5.3"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/ZAI_API_KEY"
    primary_model_info_id: "forge-777-046-91f535f822bb"
    fallback_model_info_id: "glm-5-3-103-bee34b92dde8"
    note: "ZAI_API_KEY shared — 401/402 kills both"
  - primary: "forge-planner"
    fallback: "glm-5.3-flash"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/ZAI_API_KEY"
    primary_model_info_id: "forge-planner-042-2a6ac5a7a696"
    fallback_model_info_id: "glm-5-3-flash-125-115ca2e3db6e"
    note: "ZAI_API_KEY shared — 401/402 kills both"
  - primary: "openclaw"
    fallback: "glm-5.3-flash"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/ZAI_API_KEY"
    primary_model_info_id: "openclaw-058-64b892a863e1"
    fallback_model_info_id: "glm-5-3-flash-125-115ca2e3db6e"
    note: "ZAI_API_KEY shared — 401/402 kills both"
  - primary: "hermes-asi-vision"
    fallback: "deepseek-v4-flash"
    classification: "SAME_CREDENTIAL"
    shared_credential: "os.environ/DEEPSEEK_API_KEY"
    primary_model_info_id: "hermes-asi-vision-109-bf86fbe580b2"
    fallback_model_info_id: "deepseek-v4-flash-094-bf02a1760b61"
    note: "DEEPSEEK_API_KEY shared — 401/402 kills both"
```

---

## 4. Typed Cooldown Configuration (NEW)

```yaml
router_settings:
  # Existing settings retained:
  num_retries: 1
  allowed_fails: 2
  cooldown_time: 60
  retry_policy:
    TimeoutErrorRetries: 1
    RateLimitErrorRetries: 1
    AuthenticationErrorRetries: 0      # 401 - NO RETRY
    PermissionDeniedErrorRetries: 1    # 403 - single retry with reason parsing
    NotFoundErrorRetries: 0
    ContentPolicyViolationErrorRetries: 0
    InternalServerErrorRetries: 1
    DefaultRetries: 1

  # NEW: Per-exception cooldown config
  cooldown_config:
    AuthenticationError:        # 401/402 - billing/auth failure
      cooldown_seconds: 300     # 5 minutes
      max_retries: 0
      reason: "Auth/billing failure requires human intervention; no tight retry loop"

    RateLimitError:             # 429 - rate limited
      cooldown_seconds: 60      # Base cooldown
      max_retries: 1
      respect_retry_after: true # Honor Retry-After header from provider
      reason: "Rate limited — honor Retry-After, single retry only"

    PermissionDeniedError:      # 403 - permission/quota
      cooldown_seconds: 120     # 2 minutes
      max_retries: 1
      parse_reason: true        # Parse response body for reason (quota vs policy)
      reason: "Permission denied — parse reason field before retry (quota exhausted vs policy violation)"

    InternalServerError:        # 5xx - transient server error
      cooldown_seconds: 30
      max_retries: 1
      reason: "Transient server error — short cooldown, single retry"

    TimeoutError:               # Request timeout
      cooldown_seconds: 10
      max_retries: 1
      reason: "Timeout — short cooldown, single retry"

    Default:                    # All other errors
      cooldown_seconds: 60
      max_retries: 1
      reason: "Default fallback cooldown"

  # NEW: allowed_fails_policy with typed cooldowns
  allowed_fails_policy:
    cooldown_time: 60
    AuthenticationError:
      cooldown_time: 300
    RateLimitError:
      cooldown_time: 60
      respect_retry_after: true
    PermissionDeniedError:
      cooldown_time: 120
      parse_reason: true
    InternalServerError:
      cooldown_time: 30
    TimeoutError:
      cooldown_time: 10
```

---

## 5. Audit Metadata (NEW)

```yaml
router_settings:
  fallback_classification_audit:
    generated_at: "2026-11-22"
    generator: "PR-FED-2-deployment-identity"
    config_sha256_baseline: "26b84d6b67b3b563e13ae05bcf12933e3943cb312242ff651f5abc2457721d80"
    summary:
      total_fallback_groups_before: 33
      total_fallback_edges_before: 89
      primary_groups_removed_no_active_entries: 13
      edges_pruned_same_endpoint: 8
      edges_flagged_same_credential: 6
      edges_flagged_same_intermediary: 0
      final_fallback_groups: 20
      final_fallback_edges: 50
      independent_edges: 44
      same_credential_edges: 6
    removed_primary_groups:
      - "qwen3.8-max"
      - "qwen3.6-plus"
      - "mimo-v2.5-pro"
      - "mimo-v2.6-pro-ultraspeed"
      - "mimo-v2.6-pro-payg"
      - "mimo-v2.6-flash-payg"
      - "mimo-v2.5"
      - "kimi-k3"
      - "kimi-k3.1-pro"
      - "kimi-k3.1-pro-highspeed"
      - "MiniMax-M3"
      - "MiniMax-M3.1-Flash-Preview"
      - "qwen-auto"
    pruned_same_endpoint_edges:
      - "forge-scout -> mimo-v2.6-pro"
      - "forge-scout-pro -> mimo-v2.6-flash"
      - "forge-builder -> emergency-deepseek-v4-pro"
      - "forge-economy -> emergency-deepseek-v4-pro"
      - "opencode -> deepseek-v4-flash"
      - "hermes-asi -> deepseek-v4-flash"
      - "glm-5.2 -> glm-5.3"
      - "fed/vision -> deepseek-v4-flash-vision"
    flagged_same_credential_edges:
      - "i-arif -> glm-5.3-flash (ZAI_API_KEY)"
      - "asi-555 -> glm-5.3 (ZAI_API_KEY)"
      - "forge-777 -> glm-5.3 (ZAI_API_KEY)"
      - "forge-planner -> glm-5.3-flash (ZAI_API_KEY)"
      - "openclaw -> glm-5.3-flash (ZAI_API_KEY)"
      - "hermes-asi-vision -> deepseek-v4-flash (DEEPSEEK_API_KEY)"
```

---

## 6. Single Retry Owner = LiteLLM (Verified)

Current config already enforces:
```yaml
litellm_settings:
  num_retries: 1
router_settings:
  num_retries: 1
  retry_policy:
    AuthenticationErrorRetries: 0
    NotFoundErrorRetries: 0
    ContentPolicyViolationErrorRetries: 0
```

**No stacked retries elsewhere** — verified no other retry configuration in `general_settings`, `pass_through_endpoints`, or model-level params.

---

## Files to Modify (if applied)

1. `deploy/fed/litellm-config.yaml` — All changes above
2. No other files affected

---

## Verification Checklist (for reviewer)

- [ ] All 168 model_list entries have `model_info.id` assigned
- [ ] 13 FALSE_LOOP primary groups removed from `router_settings.fallbacks`
- [ ] 8 SAME_ENDPOINT edges pruned from remaining fallback chains
- [ ] 6 SAME_CREDENTIAL edges flagged in `fallback_edge_classifications`
- [ ] 0 SAME_INTERMEDIARY edges (no HF entries in config)
- [ ] 68 INDEPENDENT edges verified — no shared host/credential/intermediary
- [ ] Typed cooldown config added for 401/402, 429, 403, 5xx, Timeout, Default
- [ ] `retry_policy` explicitly zeros auth/notfound/contentpolicy retries
- [ ] Single retry owner = LiteLLM (`num_retries: 1` at both litellm_settings and router_settings)
- [ ] Audit metadata records baseline SHA256 and all classification decisions
- [ ] Order-based fallback chains (28 edges) documented but NOT modified (implicit, requires model_list restructuring)