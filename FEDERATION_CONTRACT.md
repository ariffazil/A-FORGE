<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-07-01
valid_from: 2026-06-24
valid_until: 2026-07-31
confidence: high
scope: /root/A-FORGE
-->

# Federation Contract — A-FORGE (Engineering Actuator)

> **Organ:** A-FORGE | **Repo:** `ariffazil/A-FORGE` | **Port:** 7071 (MCP: 7072)
> **Canonical federation contract:** [`ariffazil/arifos/FEDERATION_CONTRACT.md`](https://github.com/ariffazil/arifos/blob/main/FEDERATION_CONTRACT.md)
> **Role:** Engineering actuator — execute under SEAL, never self-authorize.
> **DITEMPA BUKAN DIBERI — Forged, Not Given.**

---

## 1. Position in the Federation

```
Arif (F13 SOVEREIGN)
  → arifOS kernel (8088) — constitutional judgment
    → Domain organs (GEOX / WEALTH / WELL) — evidence
      → arifOS 888 JUDGE — SEAL / SABAR / HOLD / VOID
        → A-FORGE (7071/7072) — execution under SEAL
          → VAULT999 — immutable audit ledger
```

A-FORGE is the **Engineering Actuator**. It plans, dry-runs, builds, tests, deploys, and executes shell/filesystem/browser operations. It is the hands of the federation. It is never the brain.

---

## 2. Authority

### A-FORGE OWNS
- Build, test, lint pipelines
- Deployment orchestration (systemd, Docker, Caddy)
- Code execution and shell operations
- Browser automation and job orchestration
- Lease-gated execution proxy for arifOS

### A-FORGE NEVER
- Self-authorizes mutating or irreversible actions
- Issues constitutional verdicts
- Computes domain logic (geoscience, finance, biometrics)
- Bypasses arifOS 888 JUDGE or A-FORGE lease requirements

---

## 3. External Contracts

| Contract | Canonical Location | Purpose |
|---|---|---|
| Federation topology | `ariffazil/arifos/FEDERATION_CONTRACT.md` | Organ roles and authority chain |
| Constitutional floors | `ariffazil/arifos/static/arifos/theory/000/000_CONSTITUTION.md` | F1–F13 |
| Agent landing | `/root/A-FORGE/AGENTS.md` | Build/test/run rules for this repo |
| Tool registry | `/root/A-FORGE/src/interfaces/mcp/` | Canonical `forge_*` tool surface |

---

## 4. MCP Surface

- **HTTP/SSE:** `https://forge.arif-fazil.com/mcp`
- **Canonical tools:** `forge_*` namespace (execution, lease, build, deploy, shell, browser)

---

## 5. Handoffs

| To | When | Format |
|---|---|---|
| arifOS 888 JUDGE | Before any mutating/irreversible action | Lease request + evidence |
| Domain organs | After execution, for validation | Health/status receipts |
| VAULT999 | After SEAL-grade execution | Immutable audit entry |
| AAA | Cockpit display | Execution status |

---

## 6. Brain / Hands Contract

- **arifOS judges** → A-FORGE executes.
- **A-FORGE plans and dry-runs** → arifOS issues SEAL/HOLD/VOID.
- **A-FORGE mutates** only with valid lease or judge_state_hash.

---

## 7. Verdict

A-FORGE moves the bits. It does not decide which bits should move. The sovereign decides.

*DITEMPA BUKAN DIBERI.*
