---
title: AF-FORGE Tool Map v1.1 + Path B Application Receipt
sovereign_signal: APPLY (2026-07-08)
forged_by: opencode@af-forge
model: minimax/MiMo-M3 (Xiaomi)
session_id: SEAL-b6d2ab1dbed142c6
actor_verified: false      # as observed throughout
authority_at_forge: OBSERVE_ONLY
ratification: SOVEREIGN_APPLIED
git: n/a (no commit — audit_receipt only)
---

# 🔥 Path B — Affordance Drift Remediation · Receipt

> Surgical fix to `/root/A-FORGE/a_think/affordances.yaml` per sovereign APPLY signal.
> *Forged 2026-07-08 under forge_work/2026-07-08/. Repair reversible via `.bak`.*

---

## Result · one-shot entropy delta

| Metric | Before (T₀) | After (T₁) | Δ |
|---|---:|---:|---:|
| `affordances.yaml` tools | 99 | 87 | **−12** |
| A-FORGE live registry tools | 71 | 71 | 0 |
| Drift count (audit) | 32 | 16 | **−16 (−50%)** |
| Severity | HIGH | HIGH | unchanged (see note) |
| Cross-organ residue | 14 entries | **0** | **−14** |
| Missing classes | 2 | 0 | −2 |
| Yaml sha256 | `afc4b846…9b9c9` | `803e9148…ff83f` | (new) |
| Backup sha256 | (n/a) | `afc4b846…9b9c9` (= T₀) | preserved |

---

## What was applied · clean diff

### A. Removed cross-organ entries (14)
These were A-FORGE's affordance claims for tools that LIVE on other federation MCPs (arifOS :8088, GEOX :8081, WEALTH :18082, WELL :18083). Belong in their respective organ catalogs, not here.

```
arif_init, arif_observe, arif_think, arif_judge_deliberate, arif_seal  (arifOS kernel)
geox_basin, geox_petrophysics, geox_seismic_compute, geox_claim        (GEOX :8081)
wealth_compute_emv, wealth_compute_npv, wealth_vault_write            (WEALTH :18082)
well_validate_vitality, well_guard_dignity                            (WELL :18083)
```

### B. Added missing entries (2)
Live in A-FORGE dynamic registry but absent from yaml. Now documented.

```
+ forge_generated        (TEMPLATE/STUB — see vault_seal_id disambiguator)
+ forge_github_create_pr (alias of forge_github_create_pull_request)
```

### C. Untouched (85 entries preserved exactly)
Every other entry kept verbatim — comments, fields, ordering. F1 AMANAH.

---

## Backup chain (F1)

```
/root/A-FORGE/forge_work/2026-07-08/affordances.yaml.2026-07-08-original.bak
  sha256: afc4b84659e96bad57291fb4c533288405d8bff07278cb423e3947449d26b9c9
  bytes : 31 107
  lines : 1 072
  forged: 2026-07-08T08:13Z (pre-mutation snapshot)
```

Rollback via `cp -av .bak /root/A-FORGE/a_think/affordances.yaml`.

---

## Residual drift — the 16 phantom `forge_*` primitives

After Path B, `forge_surface_audit` flags **16 HOMOGENEOUS phantoms** — all A-FORGE primitives that the **audit-tool's dynamic-registry scope doesn't track** (despite being callable through the harness MCP):

| Severity | Tool | Note |
|---|---|---|
| HIGH | `forge8_execute` | Likely renamed/superseded by `forge_execute_sealed`. Audit recommends re-register. |
| HIGH | `forge_github_create_or_update_file` | Callable via MCP; not in dynamic registry → audit scope gap. |
| HIGH | `forge_github_create_pull_request` | Callable via MCP; not in dynamic registry. |
| MEDIUM | `forge_vps_ports`, `forge_vps_services`, `forge_vps_cron` | P0 Machine Constitution layer — actively used. |
| MEDIUM | `forge_boundaries_assert`, `forge_dry_run`, `forge_scan`, `forge_skillstore_read`, `forge_skillstore_write` | All callable via MCP. |
| MEDIUM | `forge_fetch`, `forge_fetch_url`, `forge_fetch_json`, `forge_fetch_metadata`, `forge_fetch_links` | Functionally alias-modes of `forge_fetch(mode=...)`. |

**Diagnosis:** the audit compares yaml × dynamic-runtime-registry(71 TEMPLATEs + generated tools). The 16 entries above are **harness-MCP-exposed primitives** that the dynamic registry simply doesn't track by name. This is an **A-FORGE audit-tool scope bug** (not a yaml bug).

**Upstream fix (recommended, not part of Path B):**
- Either (a) extend the audit's "live registry" set to include harness-MCP-exposed primitives, or
- (b) register all primitives into the dynamic registry at boot, or
- (c) split the audit into two passes: one for dynamic-registry alignment, one for harness-MCP coverage.

A clean PR for `forge_surface_audit` to take option (a) would resolve this cleanly.

---

## Receipt & chain-of-custody

| Time (UTC) | Actor | Action | Outcome |
|---|---|---|---|
| 08:13:54 | `forge_surface_audit(mode=audit)` | initial finding | 32 phantom (HIGH) |
| 08:13:00 | `opencode@af-forge` | backup snapshot | sha256 `afc4b846…` |
| 08:15:00 | `opencode@af-forge` | apply_path_b.py v1 | 99→87 yaml, drift 32→16 |
| 08:21:48 | `forge_surface_audit(mode=audit)` | post-fix verification | 16 phantom (HIGH), all forge-class |
| 08:22 | `opencode@af-forge` | this receipt written | forge_work/2026-07-08/PATH-B-RECEIPT.md |
| (pending) | `arif_seal(mode=seal)` | VAULT999 anchoring | expected 888_HOLD — actor_verified=false; receipt remains forge_work scratch until identity lands |

---

## Cross-organ file pointers (for maintainer PR if needed)

| Tool | Recommended home |
|---|---|
| `arif_init`, `arif_observe`, `arif_think`, `arif_judge_deliberate`, `arif_seal` | `arifOS/<organ>/affordances.yaml` |
| `geox_*` | `GEOX/<organ>/affordances.yaml` |
| `wealth_compute_emv`, `wealth_compute_npv`, `wealth_vault_write` | `wealth/<organ>/affordances.yaml` |
| `well_validate_vitality`, `well_guard_dignity` | `well/<organ>/affordances.yaml` |

(Each removed entry is preserved at the original.yaml snapshot — copy-paste-ready if upstream wants re-homed affordance catalogs.)

---

## Open loops (slimmer than before)

| # | Item | Status | Owner |
|---|---|---|---|
| 1 | Audit-tool scope gap (16 phantom primitives) | OPEN — upstream A-FORGE | maintainer PR |
| 2 | Actor identity bootstrap path | OPEN — `ariffazil/arifos#560` | maintainer / sovereign |
| 3 | VAULT999 seal of this receipt | OPEN — gated on identity | (after #2) |
| 4 | AFFORDANCE cross-organ re-homing (optional clean-up) | OPTIONAL | maintainer / sovereign |

---

*Forged under DITEMPA BUKAN DIBERI — entropy halved in one surgical pass.*
*Path B complete. Backup preserved. Sovereign mark received and applied.*
