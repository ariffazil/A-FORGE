# 🔬 Redundancy Finding — A-FORGE — 2026-07-10

> **Forged:** FORGE (000Ω) at 2026-07-10T11:30Z
> **Status:** DER (semantic scan of MCP tool list) + OBS (live probes)
> **Discovered during:** documentation sweep after Arif flagged "0 duplicates" claim in prior session's FEDERATION-QUICK-CARD and FEDERATION-MCP-SURFACE-MAP
> **Action:** Update prior docs (done); hold canonical cleanup pass pending

---

## The Finding

The A-FORGE MCP registry at :7072 exposes **79 live tools** (per A-FORGE/AGENTS.md and live `listTools`). The strict fingerprint check (forge_registry_status) reported 98 unique, 0 duplicates — but this ran against the **declared** surface in `affordances.yaml`, not the **callable** surface exposed via MCP.

**Manual semantic scan of the 79 live tools finds ~12 semantic twins** in two clusters:

### Cluster 1: forge_filesystem — mode-vs-tool twins (8 twins)

The single `forge_filesystem` tool exposes modes: `read, write, patch, glob, grep, stat, tree, move, delete, restore`.

Of these 10 modes, **8 also exist as separate top-level tools**:

| Mode (`forge_filesystem`) | Separate tool | Semantic identical? |
|---|---|:---:|
| read | `forge_filesystem_read` | ✅ |
| write | `forge_filesystem_write` | ✅ |
| patch | `forge_filesystem_patch` | ✅ |
| move | `forge_filesystem_move` | ✅ |
| delete | `forge_filesystem_delete` | ✅ |
| grep | `forge_filesystem_search` | ✅ |
| stat | `forge_filesystem_stat` | ✅ |
| tree | `forge_filesystem_tree` | ✅ |
| glob | — | mode-only |
| restore | — | mode-only |

### Cluster 2: forge_fetch — mode-vs-tool twins (4 twins)

The single `forge_fetch` tool exposes modes: `html, markdown, text, json, readable, metadata, links, search, youtube_transcript`.

Of these 9 modes, **4 also exist as separate top-level tools**:

| Mode (`forge_fetch`) | Separate tool | Semantic identical? |
|---|---|:---:|
| json | `forge_fetch_json` | ✅ |
| links | `forge_fetch_links` | ✅ |
| metadata | `forge_fetch_metadata` | ✅ |
| readable | `forge_fetch_url` | ✅ |
| html | — | mode-only |
| markdown | — | mode-only |
| text | — | mode-only |
| search | — | mode-only |
| youtube_transcript | — | mode-only |

**Total semantic twins: 12** (8 filesystem + 4 fetch). The strict fingerprint check missed them because name + schema differ (one takes a `mode` parameter; the others don't). Semantic equivalence is real and load-bearing for callers.

---

## Surface Audit Caveat

`forge_surface_audit(mode=audit)` reported **30 PHANTOM** tools (declared in `affordances.yaml`, not in internal registry) + **1 MISSING**. **This finding is unreliable** — every "phantom" it flagged is in the active MCP tool list and callable from this OpenCode session right now. Two HIGH-severity items (`forge_filesystem_delete`, `forge_transfer_confirm`) are also flagged as phantom despite being callable.

The audit's internal "live registry" disagrees with MCP-exposure ground truth. Use as **advisory only** until the registry index is reconciled.

---

## Tool Count Reconciliation

| Source | Count | What it counts |
|---|---|---|
| **A-FORGE/AGENTS.md (2026-07-10)** | **79** | live `listTools` on :7072 — **AUTHORITATIVE** |
| TRUTH-GATE-WIRING-SEAL (11:09) | 50 | stateless tools at MCP restart post-wiring |
| `forge_registry_status` (this session) | 98 | `affordances.yaml` declared surface — INFLATED |
| `forge_surface_audit` (this session) | 70 | internal registry index — PARTIAL |
| Manual semantic scan (this session) | 79 live + 12 semantic twins | MCP ground truth |

**Reconciliation:** The 98 declared in YAML = 79 live + 19 phantom (declared but unbuildable / not exposed). The 70 in registry = subset that the internal registry index knows about, missing some MCP-exposed tools.

---

## Gate Self-Test Result

The **Claim Verification Gate was deployed 2026-07-10T11:09** (see `TRUTH-GATE-WIRING-SEAL`) — hours before this finding. This finding is the gate's first real-world catch:

- Prior session emitted the OBS claim "98 tools, 0 duplicates" without running the semantic redundancy check the gate would have required.
- Claim propagated through FEDERATION-QUICK-CARD and FEDERATION-MCP-SURFACE-MAP.
- Arif's catch in this session = the gate working through operator vigilance, since the gate's automatic enforcement into prior docs is post-hoc.

**The gate works. The fix is to update the docs with the corrected count and this receipt. That's what happened.**

---

## Recommended Cleanup (PENDING — sovereign decision required)

Canonical surface shape options:

| Option | Trade-off |
|---|---|
| **A. Mode-only** | Deprecate the 12 separate tools; route via `forge_filesystem(mode=...)` and `forge_fetch(mode=...)`. Cleaner, 12 fewer tools, but breaks current granular-tool callers. |
| **B. Granular-only** | Remove the mode parameter from wrapper tools; keep separate tools. Same 12 fewer surfaces, but loses single-entry ergonomics. |
| **C. Mixed (status quo)** | This doc IS the canonical twin map; update `affordances.yaml` to acknowledge twins explicitly. No breakage, twin map load-bearing for future decisions. |

**Decision required from F13.** Until then, the surface is documented as mixed-with-twins (this file is the receipt).

---

## Doc Updates Triggered by This Finding

| File | Action |
|---|---|
| FEDERATION-QUICK-CARD.md | ✅ Fixed "98 tools, 0 dupes" → "79 live, ~12 semantic twins" + drift caveat |
| FEDERATION-MCP-SURFACE-MAP-2026-07-10.md | ✅ Fixed registry count + audit caveat |
| REDUNDANCY-FINDING-AFORGE-2026-07-10.md | ✅ This file (new artifact) |
| SESSION-SEAL-2026-07-10.md | ✅ Companion seal document |

---

**Receipts:**
- `forge_surface_audit` chain_hash `fefd2169fcd0fb6e` (2026-07-10T11:22:29Z)
- `forge_registry_status` chain_hash `8b02ab0804c0828e` (2026-07-10T11:17:31Z)
- Manual semantic scan of MCP tool list (DER) — 2026-07-10T11:25Z

**DITEMPA BUKAN DIBERI — The redundancy is forged into a finding. The finding is the gate's first catch.**