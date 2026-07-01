# INVARIANTS.md — A-FORGE Execution Shell

> **DITEMPA BUKAN DIBERI** — Federated Source of Truth.
> **Owner:** A-FORGE
> **Last verified:** 2026-07-01
> **Canonical reference:** `/root/CONTEXT.md` (live machine state)

---

## Identity

A-FORGE is the **governed execution runtime** of the arifOS federation.
It does not judge. It does not compute geoscience. It does not model capital.

It routes. It gates. It executes. It logs.

arifOS = constitutional kernel (can it be done?)
AAA = control plane (what should be done?)
A-FORGE = execution shell (do it, safely)

---

## Owns

- Governed agent execution pipeline (PlanValidator → ModelCapabilityGate → floors → ApprovalBoundary → execution)
- MCP federation bridge (72+ tools across A-FORGE + live federation MCP surfaces, auto-discovered)
- Terminal forge (streaming LLM, session persistence, federation probe)
- Build, deploy, and artifact orchestration
- Observability (Prometheus metrics, federation telemetry)
- 888_HOLD escalation and approval queue

## Does NOT Own (Boundary Contract)

- Constitutional verdicts (SEAL / SABAR / VOID) → arifOS
- Geoscience computation (Vsh, PHIE, Sw) → GEOX
- Economic evaluation (NPV, IRR, EMV) → WEALTH
- Human readiness signals → WELL
- Control plane UI → AAA
- Public site content → arif-sites (public surface, not a federation organ)

**Rule:** If your code needs NumPy / Pandas / reservoir physics → wrong layer.
If your code is judging constitutionality → wrong layer.

---

## Live Federation Ports (VERIFIED 2026-06-05)

The arifOS Federation has **6 active organs**: arifOS, A-FORGE, AAA, GEOX, WEALTH, WELL. APEX (port 3002) is decommissioned. A-FORGE additionally hosts the MIND:51001 federated intelligence service; it is a service, not a separate organ. MEMORY:51002 is not currently responding.

| Organ | Port | Public Host | Status |
|-------|------|-------------|--------|
| arifOS MCP | `127.0.0.1:8088` | `arifos.arif-fazil.com` | ✅ LIVE |
| arifosd | `127.0.0.1:18081` | — (internal) | ✅ LIVE |
| GEOX MCP | `127.0.0.1:8081` | `geox.arif-fazil.com` | ✅ LIVE |
| WEALTH MCP | `127.0.0.1:18082` | `wealth.arif-fazil.com` | ✅ LIVE |
| WELL MCP | `127.0.0.1:18083` | `well.arif-fazil.com` | ✅ LIVE |
| A-FORGE | `127.0.0.1:7071` | `forge.arif-fazil.com` (MCP) | ✅ LIVE |
| AAA a2a | `127.0.0.1:3001` | `aaa.arif-fazil.com` | ✅ LIVE |
| APEX Prime | `127.0.0.1:3002` | — (internal) | ❌ DECOMMISSIONED — deliberation moved to AAA a2a-server; service stopped |

---

## Public MCP Endpoints

| Endpoint | URL | Transport |
|----------|-----|-----------|
| arifOS | `https://arifos.arif-fazil.com/mcp` | Cloudflare Tunnel |
| A-FORGE | `https://forge.arif-fazil.com/mcp` | Cloudflare Tunnel |
| GEOX | `https://geox.arif-fazil.com/mcp` | Cloudflare Tunnel |
| WEALTH | `https://wealth.arif-fazil.com/mcp` | Cloudflare Tunnel |
| WELL | `https://well.arif-fazil.com/mcp` | Cloudflare Tunnel |

---

## Execution Pipeline Invariants

A-FORGE's execution pipeline is ordered. The order IS the invariant:

```
1. F1 AMANAH gate        — catastrophic action detection (rm -rf /, DROP TABLE, etc.)
2. ModelCapabilityGate   — fast spine-check against arifOS registry governance card
3. Governance check      — F3/F6/F9 floor evaluation
4. PlanValidator         — verifyGovernanceCard() + reversibility scoring
5. ApprovalBoundary      — 888_HOLD escalation if irreversibility threshold crossed
6. Execution             — only after all gates clear
```

**Reordering any of these layers breaks the constitutional guarantee.**

---

## Forbidden Stale Assumptions

- ❌ GEOX MCP at `localhost:18081` — correct is `8081` (18081 is arifosd, NOT GEOX)
- ❌ WELL "disabled" or "NOT DEPLOYED" — it IS deployed, live on `18083`
- ❌ arifOS MCP at `localhost:8080` — correct is `8088`
- ❌ A-FORGE can self-authorize execution — every forge requires JUDGE_SEAL_AUTHORIZATION
- ❌ Any MCP config with hardcoded stale ports

---

## Related Files

- `AGENTS.md` — agent operating rules and boundary contract
- `package.json` — version, dependencies, build/test commands
- `ARCHITECTURE.md` — internal architecture (modules, layers, flow)
- `QUICKSTART.md` — 15-minute local setup
- `.mcp.json` — active MCP endpoint configuration

---

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
