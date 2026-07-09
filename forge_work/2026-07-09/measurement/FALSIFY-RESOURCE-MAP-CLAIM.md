# Falsification — MCP Resource Map Claim (SEAL-424dc57a / 24 resources)

**Session claim under test:** "SEAL-424dc57a98834ee9 · 24/24 resources · mcp://arifos/* metrics & scar registry"
**Probe time:** 2026-07-09
**Verdict:** PARTIAL SEAL — map real; session id + several URIs are confabulated

## OBSERVED

| Claim | Reality |
|-------|---------|
| Commit "Update MCP resources map in llms.txt" | **TRUE** — `835eb2cea` local (llms.txt + generate_tool_manifest.py) |
| 24 resource rows in repo `llms.txt` | **TRUE** — counted 24 URI rows (`arifos://…`, evidence, tree777) |
| URIs like `mcp://arifos/constitution` | **FALSE** — not in llms.txt; real scheme is `arifos://` |
| `mcp://arifos/metrics/entropy` | **FALSE** — phantom; Measurement Layer is forge_work ledger, not MCP resource |
| `mcp://arifos/registry/active-seals` / `scar-memory` | **FALSE** — phantom |
| `mcp://arifos/tasks/init-scaffold` | **FALSE** — phantom; tasks live in carry_forward.json |
| SEAL-424dc57a98834ee9 | **FALSE** — no match in seal_chain / VAULT999 search |
| Live :8088/llms.txt already updated | **FALSE at probe** — served old MARHIN gateway blurb until static copy |
| violated_floors hard RETRY gate | **PARTIAL** — field exists on seal_chain; prompt text mandates fill; no proof of automatic 111 RETRY enforcement in runtime path |
| next_steps.json | **FALSE** — path not present at probe |

## Canon action taken

1. **Do not invent phantom MCP URIs** — metrics stay Measurement Layer files until they have real Resource handlers.
2. **Push real commit** `835eb2cea` (honest arifos:// map).
3. **Sync llms.txt** into runtime static paths so agents read SOT.
4. **ΔS auto-threshold:** NO ε=1e-6 auto-self-debug. Stagnant ΔS → **HOLD (000)** + surface to Arif. Self-debug 333 without scar/witness = BANGANG risk. Calibrate ε only after ≥10 measured sessions with OBS proxies.

## Epistemic

- MAP content: DERIVED from generate_tool_manifest + catalog (verify with resources/list live when clients call it).
- Agent narrative mixing mcp:// phantoms: INT/HALLUCINATION — VOID those URIs.
