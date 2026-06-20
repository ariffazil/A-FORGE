# A-FORGE State of the Tree (SOT) — 2026-05-20

> **Status:** ACTIVE  
> **Scope:** `/root/A-FORGE`  
> **Epistemic tag:** CLAIM

## Canonical architecture truth

A-FORGE is a **governed execution shell** with three live surfaces:

1. **CLI surface** — `src/cli.ts`, `src/cli/*`
2. **MCP surface** — `src/mcp/*`
3. **HTTP bridge/operator surface** — `src/server.ts`, `src/routes/*`

## Current structural anchors

| Concern | Canonical path |
|---|---|
| HTTP composition root | `src/server.ts` |
| Governance route module | `src/routes/governanceRoutes.ts` |
| Approval/operator routes | `src/routes/approvalOperatorRoutes.ts` |
| Vault merkle routes | `src/routes/vaultMerkleRoutes.ts` |
| MCP tool registry | `src/mcp/core.ts` |
| MCP resource registry | `src/mcp/resources.ts` |
| Typed filter boundary | `src/approval/filterParsing.ts` |
| Agent runtime loop | `src/engine/AgentEngine.ts` |

## Entropy reduction milestones

| Commit | Outcome |
|---|---|
| `b619eb1` | Docs topology cleanup (`docs/api`, `docs/deployment`, `docs/governance`, `docs/archive`) |
| `7a6afba` | `as any` reduced to **0**, governance/resources extraction completed |

## Quality baseline (2026-05-20)

- TypeScript build: pass
- Tests: pass (7/7)
- `as any` in `src/` + `test/`: **0**

## SOT law

- Historical runtime snapshots remain in `docs/archive/*SOT*.md`
- Current truth for implementation is this file + root `README.md`
- Runtime health claims must be re-verified against live endpoints before publication

---

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
